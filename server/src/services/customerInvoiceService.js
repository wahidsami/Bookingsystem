const db = require('../models');
const { Op } = require('sequelize');

const INVOICE_PREFIX = 'CINV';

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
            metadata: { source: 'order' }
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
        paymentStatusSnapshot: { orderPaymentStatus: order.paymentStatus }
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
        include: [{ model: db.Service, as: 'service' }],
        transaction
    });
    if (!appointment) {
        throw new Error('Appointment not found while ensuring invoice');
    }

    const {
        subtotalAmount,
        vatAmount,
        totalAmount
    } = normalizeInvoiceAmounts(appointment.price, appointment.taxAmount);
    const paidAmount = formatAmount(appointment.totalPaid);
    const dueAmount = formatAmount(Math.max(0, totalAmount - paidAmount));

    let status = 'UNPAID';
    if (appointment.paymentStatus === 'fully_paid' || appointment.paymentStatus === 'paid') {
        status = 'PAID';
    } else if (appointment.paymentStatus === 'deposit_paid') {
        status = 'PARTIALLY_PAID';
    } else if (appointment.paymentStatus === 'refunded' || appointment.paymentStatus === 'partially_refunded') {
        status = 'REFUNDED';
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
            paymentMethodSnapshot: { paymentMethod: appointment.paymentMethod },
            paymentStatusSnapshot: { appointmentPaymentStatus: appointment.paymentStatus },
            issuedAt: appointment.createdAt || new Date(),
            paidAt: status === 'PAID' ? (appointment.paidAt || new Date()) : null,
            metadata: { source: 'appointment' }
        }, { transaction });

        await db.CustomerInvoiceItem.create({
            invoiceId: invoice.id,
            itemType: 'service',
            itemRefId: appointment.serviceId || null,
            nameEn: appointment.service?.name_en || 'Service',
            nameAr: appointment.service?.name_ar || appointment.service?.name_en || 'Service',
            quantity: 1,
            unitPrice: totalAmount,
            lineTotal: totalAmount,
            taxAmount: vatAmount,
            metadata: {
                bookingNumber: appointment.bookingNumber || null
            }
        }, { transaction });

        await appendEvent(invoice.id, {
            eventType: 'invoice_created',
            fromStatus: null,
            toStatus: status,
            triggerSource,
            payload: { entityType: 'appointment', entityId: appointment.id }
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
            paymentMethodSnapshot: { paymentMethod: appointment.paymentMethod },
            paymentStatusSnapshot: { appointmentPaymentStatus: appointment.paymentStatus }
        }, { transaction });

        if (prevStatus !== status) {
            await appendEvent(invoice.id, {
                eventType: 'payment_status_changed',
                fromStatus: prevStatus,
                toStatus: status,
                triggerSource,
                payload: {
                    appointmentId: appointment.id,
                    appointmentPaymentStatus: appointment.paymentStatus
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
