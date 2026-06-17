const db = require('../models');
const { Op } = require('sequelize');

const INVOICE_PREFIX = 'CINV';
const INVOICE_RENDER_VERSION = 2;

function formatAmount(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Number(n.toFixed(2));
}

function normalizeInvoiceAmounts(totalInput, vatInput) {
    const totalAmount = formatAmount(totalInput);
    let vatAmount = formatAmount(vatInput);

    // Keep VAT within a valid range so subtotal math is always consistent.
    if (vatAmount < 0) vatAmount = 0;
    if (vatAmount > totalAmount) vatAmount = totalAmount;

    const subtotalAmount = formatAmount(totalAmount - vatAmount);

    return {
        subtotalAmount,
        vatAmount,
        totalAmount
    };
}

function safeJsonObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildAppointmentPaymentBreakdown(paymentTransactions = []) {
    const transactions = [...(Array.isArray(paymentTransactions) ? paymentTransactions : [])]
        .filter((transaction) => transaction && ['completed', 'refunded'].includes(`${transaction.status || ''}`.toLowerCase()))
        .sort((a, b) => new Date(a.processedAt || a.createdAt || 0) - new Date(b.processedAt || b.createdAt || 0));

    const breakdown = transactions.map((transaction, index) => {
        const metadata = safeJsonObject(transaction.metadata);
        const amount = formatAmount(transaction.amount);
        const isRefund = `${transaction.status || ''}`.toLowerCase() === 'refunded' || `${transaction.type || ''}`.toLowerCase() === 'refund';
        return {
            id: transaction.id || `tx-${index + 1}`,
            type: transaction.type || null,
            status: transaction.status || null,
            amount: isRefund ? -amount : amount,
            paymentMethod: transaction.paymentMethod || null,
            transactionRef: transaction.transactionRef || null,
            processedAt: transaction.processedAt || transaction.createdAt || null,
            notes: transaction.notes || metadata.notes || null,
            source: metadata.source || null
        };
    });

    const positiveTotal = breakdown
        .filter((item) => Number(item.amount) > 0)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const negativeTotal = breakdown
        .filter((item) => Number(item.amount) < 0)
        .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
    const paymentMethods = [...new Set(breakdown.map((item) => item.paymentMethod).filter(Boolean))];

    return {
        paymentCollectionMode: breakdown.length > 1 ? 'split' : (breakdown[0]?.paymentMethod || null),
        paymentSummaryMethod: breakdown.length > 1 ? 'split' : (breakdown[0]?.paymentMethod || null),
        paymentBreakdown: breakdown,
        paymentMethods,
        breakdownCount: breakdown.length,
        paidTotal: formatAmount(positiveTotal),
        refundedTotal: formatAmount(negativeTotal),
        hasSplitPayments: breakdown.length > 1
    };
}

function buildAppointmentInvoicePaymentSnapshot(appointment, overrides = {}) {
    const paymentTransactions = Array.isArray(overrides.paymentTransactions)
        ? overrides.paymentTransactions
        : (appointment?.paymentTransactions || []);
    const breakdown = buildAppointmentPaymentBreakdown(paymentTransactions);
    const paymentMethod = overrides.paymentMethod || appointment?.paymentMethod || breakdown.paymentSummaryMethod || null;

    return {
        paymentMethod,
        paymentCollectionMode: breakdown.paymentCollectionMode,
        paymentSummaryMethod: breakdown.paymentSummaryMethod,
        paymentMethods: breakdown.paymentMethods,
        paymentBreakdown: breakdown.paymentBreakdown,
        breakdownCount: breakdown.breakdownCount,
        hasSplitPayments: breakdown.hasSplitPayments
    };
}

async function generateInvoiceNumber(transaction) {
    const now = new Date();
    const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `${INVOICE_PREFIX}-${period}-`;

    const lastInvoice = await db.CustomerInvoice.findOne({
        where: {
            invoiceNumber: {
                [Op.like]: `${prefix}%`
            }
        },
        order: [['createdAt', 'DESC']],
        transaction
    });

    let sequence = 1;
    if (lastInvoice?.invoiceNumber) {
        const suffix = `${lastInvoice.invoiceNumber}`.replace(prefix, '');
        const parsed = parseInt(suffix, 10);
        if (Number.isFinite(parsed)) {
            sequence = parsed + 1;
        }
    }

    return `${prefix}${String(sequence).padStart(6, '0')}`;
}

async function appendEvent(invoiceId, event, transaction) {
    await db.CustomerInvoiceEvent.create({
        invoiceId,
        eventType: event.eventType,
        fromStatus: event.fromStatus || null,
        toStatus: event.toStatus || null,
        triggerSource: event.triggerSource || 'system',
        actorType: event.actorType || null,
        actorId: event.actorId || null,
        payload: event.payload || {}
    }, { transaction });
}

async function ensureOrderInvoice(orderId, options = {}) {
    const transaction = options.transaction || null;
    const triggerSource = options.triggerSource || 'system';

    const order = await db.Order.findByPk(orderId, {
        include: [{ model: db.OrderItem, as: 'items' }],
        transaction
    });
    if (!order) {
        throw new Error('Order not found while ensuring invoice');
    }

    const {
        subtotalAmount,
        vatAmount,
        totalAmount
    } = normalizeInvoiceAmounts(order.totalAmount, order.taxAmount);

    let invoice = await db.CustomerInvoice.findOne({
        where: { entityType: 'order', entityId: order.id },
        transaction
    });

    if (!invoice) {
        invoice = await db.CustomerInvoice.create({
            invoiceNumber: await generateInvoiceNumber(transaction),
            tenantId: order.tenantId,
            platformUserId: order.platformUserId,
            entityType: 'order',
            entityId: order.id,
            status: order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID',
            currency: 'SAR',
            subtotalAmount,
            vatAmount,
            totalAmount,
            paidAmount: order.paymentStatus === 'paid' ? totalAmount : 0,
            dueAmount: order.paymentStatus === 'paid' ? 0 : totalAmount,
            paymentMethodSnapshot: { paymentMethod: order.paymentMethod },
            paymentStatusSnapshot: { orderPaymentStatus: order.paymentStatus },
            issuedAt: order.createdAt || new Date(),
            paidAt: order.paymentStatus === 'paid' ? (order.paidAt || new Date()) : null,
            metadata: { source: 'order', invoiceRenderVersion: INVOICE_RENDER_VERSION }
        }, { transaction });

        if (Array.isArray(order.items) && order.items.length > 0) {
            await db.CustomerInvoiceItem.bulkCreate(order.items.map((item) => ({
                invoiceId: invoice.id,
                itemType: 'product',
                itemRefId: item.productId || null,
                nameEn: item.productName || 'Product',
                nameAr: item.productNameAr || item.productName || 'Product',
                quantity: Number(item.quantity || 1),
                unitPrice: formatAmount(item.unitPrice),
                lineTotal: formatAmount(item.totalPrice),
                taxAmount: 0,
                metadata: {}
            })), { transaction });
        }

        await appendEvent(invoice.id, {
            eventType: 'invoice_created',
            fromStatus: null,
            toStatus: invoice.status,
            triggerSource,
            payload: { entityType: 'order', entityId: order.id }
        }, transaction);
    }

    return invoice;
}

async function syncOrderInvoiceStatus(orderId, options = {}) {
    const transaction = options.transaction || null;
    const triggerSource = options.triggerSource || 'system';

    const order = await db.Order.findByPk(orderId, { transaction });
    if (!order) return null;

    let invoice = await db.CustomerInvoice.findOne({
        where: { entityType: 'order', entityId: order.id },
        transaction
    });

    if (!invoice) {
        invoice = await ensureOrderInvoice(orderId, { transaction, triggerSource });
    }

    const { totalAmount } = normalizeInvoiceAmounts(order.totalAmount, order.taxAmount);
    let nextStatus = 'UNPAID';
    let paidAmount = 0;
    let dueAmount = totalAmount;

    if (order.paymentStatus === 'paid') {
        nextStatus = 'PAID';
        paidAmount = totalAmount;
        dueAmount = 0;
    } else if (order.paymentStatus === 'refunded') {
        nextStatus = 'REFUNDED';
        paidAmount = 0;
        dueAmount = 0;
    }

    const prevStatus = invoice.status;
    await invoice.update({
        status: nextStatus,
        paidAmount,
        dueAmount,
        paidAt: nextStatus === 'PAID' ? (order.paidAt || new Date()) : invoice.paidAt,
        paymentMethodSnapshot: { paymentMethod: order.paymentMethod },
        paymentStatusSnapshot: { orderPaymentStatus: order.paymentStatus },
        metadata: {
            ...(safeJsonObject(invoice.metadata)),
            source: 'order',
            invoiceRenderVersion: INVOICE_RENDER_VERSION
        }
    }, { transaction });

    if (prevStatus !== nextStatus) {
        await appendEvent(invoice.id, {
            eventType: 'payment_status_changed',
            fromStatus: prevStatus,
            toStatus: nextStatus,
            triggerSource,
            payload: {
                orderId: order.id,
                orderPaymentStatus: order.paymentStatus
            }
        }, transaction);
    }

    return invoice;
}

async function ensureAppointmentInvoice(appointmentId, options = {}) {
    const transaction = options.transaction || null;
    const triggerSource = options.triggerSource || 'system';

    const appointment = await db.Appointment.findByPk(appointmentId, {
        include: [
            { model: db.Service, as: 'service' },
            {
                model: db.PaymentTransaction,
                as: 'paymentTransactions',
                required: false
            }
        ],
        transaction
    });
    if (!appointment) {
        throw new Error('Appointment not found while ensuring invoice');
    }

    const sessionAppointments = Array.isArray(appointment.bookingSession?.appointments)
        ? appointment.bookingSession.appointments
            .filter((sessionAppointment) => sessionAppointment && `${sessionAppointment.status || ''}`.trim().toLowerCase() !== 'cancelled')
            .slice()
            .sort((left, right) => {
                const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
                const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
                if (leftIndex !== rightIndex) {
                    return leftIndex - rightIndex;
                }
                return new Date(left.startTime || 0) - new Date(right.startTime || 0);
            })
        : [];
    const isSessionInvoice = Boolean(appointment.bookingSession?.id && sessionAppointments.length > 1);
    const invoiceAppointments = isSessionInvoice ? sessionAppointments : [appointment];
    const paymentTransactions = invoiceAppointments
        .flatMap((sessionAppointment) => Array.isArray(sessionAppointment.paymentTransactions) ? sessionAppointment.paymentTransactions : []);
    const paymentSnapshot = buildAppointmentInvoicePaymentSnapshot(appointment, {
        paymentTransactions,
        paymentMethod: isSessionInvoice
            ? (appointment.bookingSession?.paymentMethod || appointment.paymentMethod || null)
            : undefined
    });

    const subtotalAmount = formatAmount(invoiceAppointments.reduce((sum, current) => sum + Number(current.rawPrice || 0), 0));
    const vatAmount = formatAmount(invoiceAppointments.reduce((sum, current) => sum + Number(current.taxAmount || 0), 0));
    const totalAmount = formatAmount(invoiceAppointments.reduce((sum, current) => sum + Number(current.price || 0), 0));
    const paidAmount = formatAmount(invoiceAppointments.reduce((sum, current) => sum + Number(current.totalPaid || 0), 0));
    const dueAmount = formatAmount(Math.max(0, totalAmount - paidAmount));
    const invoiceItems = invoiceAppointments.map((sourceAppointment, index) => ({
        itemType: 'service',
        itemRefId: sourceAppointment.serviceId || null,
        nameEn: sourceAppointment.service?.name_en || 'Service',
        nameAr: sourceAppointment.service?.name_ar || sourceAppointment.service?.name_en || 'Service',
        quantity: 1,
        unitPrice: formatAmount(sourceAppointment.price),
        lineTotal: formatAmount(sourceAppointment.price),
        taxAmount: formatAmount(sourceAppointment.taxAmount),
        metadata: {
            bookingNumber: sourceAppointment.bookingNumber || null,
            bookingSessionId: sourceAppointment.bookingSessionId || null,
            bookingReference: appointment.bookingSession?.bookingReference || sourceAppointment.bookingReference || null,
            bookingItemIndex: sourceAppointment.bookingItemIndex ?? index
        }
    }));
    const invoiceMetadata = {
        source: isSessionInvoice ? 'booking_session' : 'appointment',
        bookingNumber: appointment.bookingNumber || null,
        bookingReference: appointment.bookingSession?.bookingReference || null,
        bookingSessionId: appointment.bookingSession?.id || null,
        paymentCollectionMode: paymentSnapshot.paymentCollectionMode,
        paymentSummaryMethod: paymentSnapshot.paymentSummaryMethod,
        paymentBreakdown: paymentSnapshot.paymentBreakdown,
        paymentBreakdownCount: paymentSnapshot.breakdownCount,
        paymentMethods: paymentSnapshot.paymentMethods,
        hasSplitPayments: paymentSnapshot.hasSplitPayments,
        itemCount: invoiceAppointments.length
    };

    const allPaid = invoiceAppointments.length > 0
        && invoiceAppointments.every((current) => Number(current.totalPaid || 0) + 0.01 >= Number(current.price || 0));
    const allRefunded = invoiceAppointments.length > 0
        && invoiceAppointments.every((current) => ['refunded', 'partially_refunded'].includes(`${current.paymentStatus || ''}`.trim().toLowerCase())
            || Number(current.totalPaid || 0) <= 0.01);
    const anyPaid = invoiceAppointments.some((current) => Number(current.totalPaid || 0) > 0);
    let status = 'UNPAID';
    if (allPaid) {
        status = 'PAID';
    } else if (allRefunded && !anyPaid) {
        status = 'REFUNDED';
    } else if (anyPaid) {
        status = 'PARTIALLY_PAID';
    } else if (appointment.paymentStatus === 'deposit_paid') {
        status = 'PARTIALLY_PAID';
    }

    let invoice = await db.CustomerInvoice.findOne({
        where: { entityType: 'appointment', entityId: appointment.id },
        transaction
    });

    if (!invoice) {
        invoice = await db.CustomerInvoice.create({
            invoiceNumber: await generateInvoiceNumber(transaction),
            tenantId: appointment.tenantId,
            platformUserId: appointment.platformUserId,
            entityType: 'appointment',
            entityId: appointment.id,
            status,
            currency: 'SAR',
            subtotalAmount,
            vatAmount,
            totalAmount,
            paidAmount,
            dueAmount,
            paymentMethodSnapshot: {
                paymentMethod: paymentSnapshot.paymentMethod,
                paymentCollectionMode: paymentSnapshot.paymentCollectionMode,
                paymentSummaryMethod: paymentSnapshot.paymentSummaryMethod,
                paymentMethods: paymentSnapshot.paymentMethods,
                paymentBreakdown: paymentSnapshot.paymentBreakdown
            },
            paymentStatusSnapshot: {
                appointmentPaymentStatus: isSessionInvoice
                    ? (allPaid ? 'fully_paid' : (anyPaid ? 'deposit_paid' : appointment.paymentStatus))
                    : appointment.paymentStatus,
                appointmentPaymentSummaryMethod: paymentSnapshot.paymentSummaryMethod,
                appointmentPaymentCollectionMode: paymentSnapshot.paymentCollectionMode
            },
            issuedAt: appointment.createdAt || new Date(),
            paidAt: status === 'PAID' ? (appointment.paidAt || new Date()) : null,
            metadata: {
                ...invoiceMetadata,
                invoiceRenderVersion: INVOICE_RENDER_VERSION
            }
        }, { transaction });

        await db.CustomerInvoiceItem.bulkCreate(invoiceItems.map((item) => ({
            invoiceId: invoice.id,
            ...item
        })), { transaction });

        await appendEvent(invoice.id, {
            eventType: 'invoice_created',
            fromStatus: null,
            toStatus: status,
            triggerSource,
            payload: {
                entityType: 'appointment',
                entityId: appointment.id,
                bookingSessionId: appointment.bookingSession?.id || null
            }
        }, transaction);
    } else {
        const prevStatus = invoice.status;
        await invoice.update({
            status,
            subtotalAmount,
            vatAmount,
            totalAmount,
            paidAmount,
            dueAmount,
            paidAt: status === 'PAID' ? (appointment.paidAt || new Date()) : invoice.paidAt,
            paymentMethodSnapshot: {
                paymentMethod: paymentSnapshot.paymentMethod,
                paymentCollectionMode: paymentSnapshot.paymentCollectionMode,
                paymentSummaryMethod: paymentSnapshot.paymentSummaryMethod,
                paymentMethods: paymentSnapshot.paymentMethods,
                paymentBreakdown: paymentSnapshot.paymentBreakdown
            },
            paymentStatusSnapshot: {
                appointmentPaymentStatus: isSessionInvoice
                    ? (allPaid ? 'fully_paid' : (anyPaid ? 'deposit_paid' : appointment.paymentStatus))
                    : appointment.paymentStatus,
                appointmentPaymentSummaryMethod: paymentSnapshot.paymentSummaryMethod,
                appointmentPaymentCollectionMode: paymentSnapshot.paymentCollectionMode
            },
            metadata: {
                ...(safeJsonObject(invoice.metadata)),
                ...invoiceMetadata,
                invoiceRenderVersion: INVOICE_RENDER_VERSION
            }
        }, { transaction });

        if (isSessionInvoice) {
            await db.CustomerInvoiceItem.destroy({
                where: { invoiceId: invoice.id },
                transaction
            });

            await db.CustomerInvoiceItem.bulkCreate(invoiceItems.map((item) => ({
                invoiceId: invoice.id,
                ...item
            })), { transaction });
        }

        if (prevStatus !== status) {
            await appendEvent(invoice.id, {
                eventType: 'payment_status_changed',
                fromStatus: prevStatus,
                toStatus: status,
                triggerSource,
                payload: {
                    appointmentId: appointment.id,
                    appointmentPaymentStatus: isSessionInvoice
                        ? (allPaid ? 'fully_paid' : (anyPaid ? 'deposit_paid' : appointment.paymentStatus))
                        : appointment.paymentStatus,
                    bookingSessionId: appointment.bookingSession?.id || null
                }
            }, transaction);
        }
    }

    return invoice;
}

module.exports = {
    ensureOrderInvoice,
    syncOrderInvoiceStatus,
    ensureAppointmentInvoice
};
