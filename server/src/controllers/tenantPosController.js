const { Op } = require('sequelize');
const { ACTIVE_APPOINTMENT_STATUSES } = require('../utils/appointmentStatus');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../models');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const {
    loadTenantNotificationSettingsMap,
    normalizeAppointmentNotificationSettings
} = require('../services/appointmentAutomationService');
const {
    createAppointmentTransaction,
    createOrderTransaction
} = require('../services/paymentTransactionLedgerService');

const POS_QUEUE_LIMIT = 100;
const POS_TRANSACTION_LIMIT = 100;
const POS_ALERT_LIMIT = 10;
const REVIEW_ALERT_LOOKBACK_DAYS = 14;
const RESCHEDULE_ALERT_LOOKBACK_DAYS = 7;
const RESCHEDULE_AUDIT_MARKER = '[RESCHEDULE_AUDIT]';
const CANCELLATION_AUDIT_MARKER = '[CANCELLATION_AUDIT]';
const OPERATIONAL_ALERT_READ_ALL_KEY = '__all__';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
const GIFT_CARD_AUDIT_ENABLED = process.env.GIFT_CARD_AUDIT_LOGS !== '0';
const cairoFontPath = path.resolve(__dirname, '../templates/invoices/fonts/Cairo-Regular.ttf');
const logoFallbackPath = path.resolve(__dirname, '../templates/emails/RifahNewLogoWhite.png');

const parseDateRange = (startDate, endDate) => {
    const range = {};

    if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
            start.setHours(0, 0, 0, 0);
            range[Op.gte] = start;
        }
    }

    if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            range[Op.lte] = end;
        }
    }

    return Object.keys(range).length ? range : null;
};

const getCustomerName = (user) => {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || user?.email || user?.phone || 'Guest Customer';
};

const getServiceName = (service) => (
    service?.name_en || service?.name_ar || 'Service'
);

const getOrderLabel = (order) => {
    const itemNames = Array.isArray(order?.items)
        ? order.items
            .map((item) => item?.product?.name_en || item?.product?.name_ar)
            .filter(Boolean)
        : [];

    return itemNames.length
        ? itemNames.slice(0, 2).join(', ')
        : 'Product order';
};

const formatDateTimeLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return `${value || '-'}`;
    }

    return date.toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
};

const toTimestamp = (value) => {
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};

const getOperationalAlertPriority = (alert) => {
    const kind = `${alert?.kind || ''}`.trim();
    if (kind === 'appointment') return 4; // Customer cancel/reschedule must be most visible.
    if (kind === 'review') return 3;
    if (kind === 'pos') return 2;
    return 1;
};

const getOperationalAlertReaderId = (req) => req.tenantAccountId || req.userId || req.tenantId;

const getOperationalAlertsReadState = async (tenantId, readerId, alerts) => {
    if (!db.TenantOperationalAlertRead || !tenantId || !readerId || !Array.isArray(alerts) || alerts.length === 0) {
        return { readKeys: new Set(), readAllAt: null };
    }

    const alertKeys = alerts.map((alert) => `${alert.id || ''}`).filter(Boolean);
    const rows = await db.TenantOperationalAlertRead.findAll({
        where: {
            tenantId,
            readerId,
            alertKey: { [Op.in]: [OPERATIONAL_ALERT_READ_ALL_KEY, ...alertKeys] }
        },
        attributes: ['alertKey', 'readAt'],
        raw: true
    });

    const readKeys = new Set(rows.filter((row) => row.alertKey !== OPERATIONAL_ALERT_READ_ALL_KEY).map((row) => row.alertKey));
    const readAllRow = rows.find((row) => row.alertKey === OPERATIONAL_ALERT_READ_ALL_KEY);
    const readAllAt = readAllRow?.readAt ? new Date(readAllRow.readAt) : null;

    return { readKeys, readAllAt };
};

const getAppointmentDueAmount = (appointment) => {
    if (appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID) {
        const remainder = parseFloat(appointment.remainderAmount || 0);
        return Number.isFinite(remainder) && remainder > 0 ? remainder : 0;
    }

    const price = parseFloat(appointment.price || 0);
    const totalPaid = parseFloat(appointment.totalPaid || 0);
    const dueAmount = price - totalPaid;

    return Number.isFinite(dueAmount) && dueAmount > 0
        ? parseFloat(dueAmount.toFixed(2))
        : 0;
};

const formatPaymentMethodLabel = (paymentMethod) => ({
    online: 'Online',
    cash: 'Cash',
    card_pos: 'Card POS',
    wallet: 'Wallet',
    bank_transfer: 'Bank transfer',
    pay_on_visit: 'Pay on visit',
    cash_on_delivery: 'Cash on delivery'
}[paymentMethod] || paymentMethod || 'Not set');

const formatMoney = (amount, currency = 'SAR') => {
    const numericAmount = Number.parseFloat(amount || 0);
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return `${safeAmount.toFixed(2)} ${currency}`;
};

const escapeCsvField = (value) => {
    const stringValue = `${value ?? ''}`;
    return `"${stringValue.replace(/"/g, '""')}"`;
};

const getTransactionIncludes = ({ includeTenantOnlyFields = true } = {}) => ([
    {
        model: db.Appointment,
        as: 'appointment',
        attributes: includeTenantOnlyFields
            ? ['id', 'bookingNumber', 'tenantId', 'startTime', 'paymentStatus', 'status']
            : ['id', 'bookingNumber', 'tenantId', 'startTime', 'paymentStatus', 'status', 'price'],
        required: false,
        include: [
            {
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar'],
                required: false
            },
            {
                model: db.PlatformUser,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            }
        ]
    },
    {
        model: db.Order,
        as: 'order',
        attributes: includeTenantOnlyFields
            ? ['id', 'tenantId', 'orderNumber', 'paymentStatus', 'status', 'paymentMethod']
            : ['id', 'tenantId', 'orderNumber', 'paymentStatus', 'status', 'paymentMethod', 'totalAmount'],
        required: false,
        include: [
            {
                model: db.PlatformUser,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            },
            {
                model: db.OrderItem,
                as: 'items',
                include: [
                    {
                        model: db.Product,
                        as: 'product',
                        attributes: ['id', 'name_en', 'name_ar'],
                        required: false
                    }
                ],
                required: false
            }
        ]
    },
    {
        model: db.Staff,
        as: 'processor',
        attributes: ['id', 'name'],
        required: false
    }
]);

const fetchTenantPaymentEntityScope = async (tenantId) => {
    const [appointmentRows, orderRows] = await Promise.all([
        db.Appointment.findAll({
            where: { tenantId },
            attributes: ['id'],
            raw: true
        }),
        db.Order.findAll({
            where: { tenantId },
            attributes: ['id'],
            raw: true
        })
    ]);

    return {
        appointmentIds: appointmentRows.map((row) => row.id),
        orderIds: orderRows.map((row) => row.id)
    };
};

const buildTenantScopedTransactionWhere = (entityScope, filters = {}) => {
    const appointmentIds = entityScope?.appointmentIds?.length
        ? entityScope.appointmentIds
        : [NO_MATCH_UUID];
    const orderIds = entityScope?.orderIds?.length
        ? entityScope.orderIds
        : [NO_MATCH_UUID];

    const where = {
        [Op.or]: [
            { appointmentId: { [Op.in]: appointmentIds } },
            { orderId: { [Op.in]: orderIds } }
        ]
    };

    if (filters.processedAt) {
        where.processedAt = filters.processedAt;
    }

    if (filters.id) {
        where.id = filters.id;
    }

    const trimmedSearch = `${filters.search || ''}`.trim();
    if (trimmedSearch) {
        where[Op.and] = [{
            [Op.or]: [
                { transactionRef: { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$appointment.bookingNumber$': { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$order.orderNumber$': { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$appointment.user.firstName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$appointment.user.lastName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$appointment.user.phone$': { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$order.user.firstName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$order.user.lastName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                { '$order.user.phone$': { [Op.iLike]: `%${trimmedSearch}%` } }
            ]
        }];
    }

    return where;
};

const mapAppointmentQueueItem = (appointment) => ({
    id: `appointment-${appointment.id}`,
    entityType: 'appointment',
    entityId: appointment.id,
    reference: appointment.bookingNumber || appointment.id,
    customerName: getCustomerName(appointment.user),
    customerPhone: appointment.user?.phone || null,
    title: getServiceName(appointment.service),
    employeeName: appointment.staff?.name || null,
    scheduledAt: appointment.startTime,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    paymentIntent: appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
        ? 'deposit_remainder_due'
        : ['online', 'online-full', 'booking-fee'].includes(appointment.paymentMethod)
            ? 'online_payment_pending'
            : 'pay_at_center',
    paymentMethod: appointment.paymentMethod || 'cash',
    paymentMethodLabel: formatPaymentMethodLabel(appointment.paymentMethod || 'cash'),
    totalAmount: parseFloat(appointment.price || 0),
    paidAmount: parseFloat(appointment.totalPaid || 0),
    dueAmount: getAppointmentDueAmount(appointment),
    detailPath: `/dashboard/appointments/${appointment.id}`
});

const logGiftCardAudit = (event, payload = {}) => {
    if (!GIFT_CARD_AUDIT_ENABLED) return;
    try {
        console.info('[gift-card-pos-audit]', JSON.stringify({
            event,
            at: new Date().toISOString(),
            ...payload
        }));
    } catch (_err) {
        console.info('[gift-card-pos-audit]', event, payload);
    }
};

const normalizeGiftCardCode = (value) => `${value || ''}`.trim().toUpperCase();

const computeEntityDueAmount = (entityType, entity) => {
    if (entityType === 'appointment') {
        return getAppointmentDueAmount(entity);
    }
    const totalAmount = parseFloat(entity?.totalAmount || 0);
    return Number.isFinite(totalAmount) && totalAmount > 0 ? parseFloat(totalAmount.toFixed(2)) : 0;
};

const loadPosEntityForRedeem = async (tenantId, entityType, entityId, transaction) => {
    if (entityType === 'appointment') {
        const appointment = await db.Appointment.findByPk(entityId, { transaction });
        if (!appointment || appointment.tenantId !== tenantId) {
            return null;
        }
        return { entityType, entity: appointment };
    }

    if (entityType === 'order') {
        const order = await db.Order.findByPk(entityId, { transaction });
        if (!order || order.tenantId !== tenantId) {
            return null;
        }
        return { entityType, entity: order };
    }

    return null;
};

const isGiftCodeRedeemable = (giftCode, tenantId) => {
    if (!giftCode) return { ok: false, reason: 'Gift card code not found' };

    if (giftCode.scopeType === 'tenant_scoped' && giftCode.tenantId !== tenantId) {
        return { ok: false, reason: 'This gift card can only be used in the issuing center' };
    }

    if (giftCode.status === 'cancelled') {
        return { ok: false, reason: 'Gift card is cancelled' };
    }
    if (giftCode.status === 'redeemed') {
        return { ok: false, reason: 'Gift card is already redeemed' };
    }
    if (giftCode.status === 'expired') {
        return { ok: false, reason: 'Gift card is expired' };
    }
    if (giftCode.expiresAt && new Date(giftCode.expiresAt).getTime() < Date.now()) {
        return { ok: false, reason: 'Gift card is expired' };
    }

    const remainingAmount = parseFloat(giftCode.remainingAmount || 0);
    if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
        return { ok: false, reason: 'Gift card has no remaining balance' };
    }

    return { ok: true, reason: null };
};

exports.validateGiftCardForPos = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const code = normalizeGiftCardCode(req.query.code);
        const entityType = `${req.query.entityType || ''}`.trim();
        const entityId = `${req.query.entityId || ''}`.trim();

        if (!code) {
            logGiftCardAudit('validate_rejected', { tenantId, reason: 'missing_code' });
            return res.status(400).json({ success: false, message: 'Gift card code is required' });
        }
        if (!['appointment', 'order'].includes(entityType) || !UUID_REGEX.test(entityId)) {
            logGiftCardAudit('validate_rejected', { tenantId, code, entityType, entityId, reason: 'invalid_entity' });
            return res.status(400).json({ success: false, message: 'Valid entityType and entityId are required' });
        }

        const giftCode = await db.GiftCardCode.findOne({ where: { code } });
        const validity = isGiftCodeRedeemable(giftCode, tenantId);
        if (!validity.ok) {
            logGiftCardAudit('validate_failed', { tenantId, code, entityType, entityId, reason: validity.reason });
            return res.status(400).json({ success: false, message: validity.reason });
        }

        const entityScope = await loadPosEntityForRedeem(tenantId, entityType, entityId);
        if (!entityScope?.entity) {
            logGiftCardAudit('validate_failed', { tenantId, code, entityType, entityId, reason: 'entity_not_found' });
            return res.status(404).json({ success: false, message: 'POS item not found for this tenant' });
        }

        const dueAmount = computeEntityDueAmount(entityType, entityScope.entity);
        const remainingAmount = parseFloat(giftCode.remainingAmount || 0);
        const maxRedeemableAmount = parseFloat(Math.min(dueAmount, remainingAmount).toFixed(2));

        logGiftCardAudit('validate_success', {
            tenantId,
            code,
            entityType,
            entityId,
            dueAmount,
            remainingAmount,
            maxRedeemableAmount
        });
        return res.json({
            success: true,
            data: {
                code: giftCode.code,
                scopeType: giftCode.scopeType,
                remainingAmount,
                dueAmount,
                maxRedeemableAmount,
                currency: giftCode.currency || 'SAR',
                status: giftCode.status
            }
        });
    } catch (error) {
        console.error('Validate POS gift card error:', error);
        logGiftCardAudit('validate_error', { tenantId: req.tenantId, code: normalizeGiftCardCode(req.query?.code), message: error.message });
        return res.status(500).json({ success: false, message: 'Failed to validate gift card', error: error.message });
    }
};

exports.redeemGiftCardForPos = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const code = normalizeGiftCardCode(req.body?.code);
        const entityType = `${req.body?.entityType || ''}`.trim();
        const entityId = `${req.body?.entityId || ''}`.trim();
        const requestedAmount = Number(req.body?.amount || 0);
        const notes = `${req.body?.notes || ''}`.trim() || null;
        const transactionRef = `${req.body?.transactionRef || ''}`.trim() || null;

        if (!code) {
            await transaction.rollback();
            logGiftCardAudit('redeem_rejected', { tenantId, reason: 'missing_code' });
            return res.status(400).json({ success: false, message: 'Gift card code is required' });
        }
        if (!['appointment', 'order'].includes(entityType) || !UUID_REGEX.test(entityId)) {
            await transaction.rollback();
            logGiftCardAudit('redeem_rejected', { tenantId, code, entityType, entityId, reason: 'invalid_entity' });
            return res.status(400).json({ success: false, message: 'Valid entityType and entityId are required' });
        }

        const giftCode = await db.GiftCardCode.findOne({
            where: { code },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        const validity = isGiftCodeRedeemable(giftCode, tenantId);
        if (!validity.ok) {
            await transaction.rollback();
            logGiftCardAudit('redeem_failed', { tenantId, code, entityType, entityId, reason: validity.reason });
            return res.status(400).json({ success: false, message: validity.reason });
        }

        const entityScope = await loadPosEntityForRedeem(tenantId, entityType, entityId, transaction);
        if (!entityScope?.entity) {
            await transaction.rollback();
            logGiftCardAudit('redeem_failed', { tenantId, code, entityType, entityId, reason: 'entity_not_found' });
            return res.status(404).json({ success: false, message: 'POS item not found for this tenant' });
        }

        const dueAmount = computeEntityDueAmount(entityType, entityScope.entity);
        if (dueAmount <= 0) {
            await transaction.rollback();
            logGiftCardAudit('redeem_failed', { tenantId, code, entityType, entityId, reason: 'no_due_amount' });
            return res.status(400).json({ success: false, message: 'No due amount to redeem' });
        }

        const remainingAmount = parseFloat(giftCode.remainingAmount || 0);
        const maxRedeemableAmount = parseFloat(Math.min(dueAmount, remainingAmount).toFixed(2));
        const redeemAmount = requestedAmount > 0
            ? parseFloat(Math.min(requestedAmount, maxRedeemableAmount).toFixed(2))
            : maxRedeemableAmount;

        if (redeemAmount <= 0) {
            await transaction.rollback();
            logGiftCardAudit('redeem_failed', { tenantId, code, entityType, entityId, reason: 'invalid_redeem_amount' });
            return res.status(400).json({ success: false, message: 'Redeem amount must be greater than 0' });
        }

        const nextRemainingAmount = parseFloat((remainingAmount - redeemAmount).toFixed(2));
        giftCode.remainingAmount = nextRemainingAmount;
        giftCode.status = nextRemainingAmount <= 0 ? 'redeemed' : 'partially_redeemed';
        await giftCode.save({ transaction });

        if (giftCode.sourceGiftCardTransactionId) {
            const sourceTx = await db.GiftCardTransaction.findByPk(giftCode.sourceGiftCardTransactionId, { transaction });
            if (sourceTx) {
                sourceTx.status = nextRemainingAmount <= 0 ? 'redeemed' : 'partially_redeemed';
                await sourceTx.save({ transaction });
            }
        }

        if (giftCode.sourceTenantGiftCardTransactionId) {
            const sourceTx = await db.TenantGiftCardTransaction.findByPk(giftCode.sourceTenantGiftCardTransactionId, { transaction });
            if (sourceTx) {
                sourceTx.status = nextRemainingAmount <= 0 ? 'redeemed' : 'partially_redeemed';
                await sourceTx.save({ transaction });
            }
        }

        if (entityType === 'appointment') {
            const appointment = entityScope.entity;
            const totalPrice = parseFloat(appointment.price || 0);
            const previousPaid = parseFloat(appointment.totalPaid || 0);
            const nextPaid = parseFloat((previousPaid + redeemAmount).toFixed(2));
            const isFullyPaid = nextPaid >= totalPrice;

            appointment.totalPaid = Math.min(nextPaid, totalPrice);
            appointment.paymentMethod = 'wallet';
            appointment.depositPaid = appointment.totalPaid > 0;
            appointment.remainderAmount = parseFloat(Math.max(totalPrice - appointment.totalPaid, 0).toFixed(2));
            appointment.remainderPaid = appointment.remainderAmount <= 0;
            appointment.paymentStatus = isFullyPaid ? APPOINTMENT_PAYMENT_STATUS.FULLY_PAID : APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID;
            if (isFullyPaid) appointment.paidAt = new Date();
            if (appointment.status === 'pending') appointment.status = 'confirmed';
            await appointment.save({ transaction });

            await createAppointmentTransaction({
                appointmentId: appointment.id,
                type: isFullyPaid && previousPaid > 0 ? 'remainder' : 'full',
                amount: redeemAmount,
                paymentMethod: 'wallet',
                status: 'completed',
                transactionRef: transactionRef || `GFT-POS-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`,
                processedBy: null,
                processedAt: new Date(),
                notes: notes || `Paid using gift card ${giftCode.code}`,
                metadata: {
                    source: 'pos_gift_card_redeem',
                    giftCardCode: giftCode.code,
                    giftCardCodeId: giftCode.id
                }
            }, { transaction });
        } else {
            const order = entityScope.entity;
            order.paymentStatus = 'paid';
            order.paymentMethod = 'pay_on_visit';
            await order.save({ transaction });

            await createOrderTransaction({
                orderId: order.id,
                type: 'full',
                amount: redeemAmount,
                paymentMethod: 'wallet',
                status: 'completed',
                transactionRef: transactionRef || `GFT-POS-ORD-${order.orderNumber || order.id.slice(0, 8).toUpperCase()}`,
                processedBy: null,
                processedAt: new Date(),
                notes: notes || `Paid using gift card ${giftCode.code}`,
                metadata: {
                    source: 'pos_gift_card_redeem',
                    giftCardCode: giftCode.code,
                    giftCardCodeId: giftCode.id
                }
            }, { transaction });
        }

        await db.GiftCardCodeRedemption.create({
            giftCardCodeId: giftCode.id,
            tenantId,
            appointmentId: entityType === 'appointment' ? entityId : null,
            orderId: entityType === 'order' ? entityId : null,
            posInvoiceId: null,
            redeemedAmount: redeemAmount,
            remainingAfter: nextRemainingAmount,
            redeemedByStaffId: null,
            metadata: {
                source: 'tenant_pos',
                code: giftCode.code
            }
        }, { transaction });

        await transaction.commit();
        logGiftCardAudit('redeem_success', {
            tenantId,
            code,
            entityType,
            entityId,
            redeemAmount,
            remainingAmountAfter: nextRemainingAmount
        });
        return res.json({
            success: true,
            message: 'Gift card redeemed successfully',
            data: {
                code: giftCode.code,
                redeemedAmount: redeemAmount,
                remainingAmount: nextRemainingAmount,
                entityType,
                entityId
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Redeem POS gift card error:', error);
        logGiftCardAudit('redeem_error', { tenantId: req.tenantId, code: normalizeGiftCardCode(req.body?.code), message: error.message });
        return res.status(500).json({ success: false, message: 'Failed to redeem gift card', error: error.message });
    }
};

const mapOrderQueueItem = (order) => ({
    id: `order-${order.id}`,
    entityType: 'order',
    entityId: order.id,
    reference: order.orderNumber,
    customerName: getCustomerName(order.user),
    customerPhone: order.user?.phone || null,
    title: getOrderLabel(order),
    employeeName: null,
    scheduledAt: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentIntent: order.paymentMethod === 'pay_on_visit'
        ? 'pay_on_pickup'
        : 'cash_on_delivery',
    paymentMethod: order.paymentMethod,
    paymentMethodLabel: formatPaymentMethodLabel(order.paymentMethod),
    totalAmount: parseFloat(order.totalAmount || 0),
    paidAmount: 0,
    dueAmount: parseFloat(order.totalAmount || 0),
    detailPath: `/dashboard/orders/${order.id}`
});

const mapPosAlertFromQueueItem = (item) => {
    if (item.entityType === 'appointment') {
        const isCheckedInDue = item.status === 'checked_in';
        const isDepositRemainder = item.paymentIntent === 'deposit_remainder_due';

        return {
            id: `${item.entityId}:${item.paymentIntent}:${item.status}`,
            entityType: 'appointment',
            entityId: item.entityId,
            reference: item.reference,
            severity: isCheckedInDue ? 'high' : 'medium',
            title: isDepositRemainder
                ? `Remainder due for booking ${item.reference}`
                : `Payment due for booking ${item.reference}`,
            title_ar: isDepositRemainder
                ? `متبقي مستحق للحجز ${item.reference}`
                : `دفعة مستحقة للحجز ${item.reference}`,
            message: `${item.customerName} has ${item.dueAmount.toFixed(2)} SAR due for ${item.title}.`,
            message_ar: `${item.customerName} لديه مبلغ مستحق ${item.dueAmount.toFixed(2)} ر.س مقابل ${item.title}.`,
            amountDue: item.dueAmount,
            paymentIntent: item.paymentIntent,
            scheduledAt: item.scheduledAt,
            detailPath: item.detailPath
        };
    }

    const isCod = item.paymentIntent === 'cash_on_delivery';

    return {
        id: `${item.entityId}:${item.paymentIntent}:${item.status}`,
        entityType: 'order',
        entityId: item.entityId,
        reference: item.reference,
        severity: isCod ? 'medium' : 'low',
        title: isCod
            ? `COD payment pending for order ${item.reference}`
            : `Pickup payment pending for order ${item.reference}`,
        title_ar: isCod
            ? `دفع عند التوصيل مستحق للطلب ${item.reference}`
            : `دفع عند الاستلام مستحق للطلب ${item.reference}`,
        message: `${item.customerName} has ${item.dueAmount.toFixed(2)} SAR due for ${item.title}.`,
        message_ar: `${item.customerName} لديه مبلغ مستحق ${item.dueAmount.toFixed(2)} ر.س للطلب ${item.title}.`,
        amountDue: item.dueAmount,
        paymentIntent: item.paymentIntent,
        scheduledAt: item.scheduledAt,
        detailPath: item.detailPath
    };
};

const fetchReviewAttentionAlerts = async (tenantId, limit) => {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - REVIEW_ALERT_LOOKBACK_DAYS);

    const reviews = await db.Review.findAll({
        where: {
            tenantId,
            createdAt: { [Op.gte]: lookbackDate }
        },
        include: [
            {
                model: db.Staff,
                as: 'staff',
                attributes: ['id', 'name'],
                required: false
            }
        ],
        order: [['createdAt', 'DESC']],
        limit
    });

    const alerts = reviews.map((review) => {
        const customerName = review.customerName || 'Customer';
        const reviewText = review.comment ? `${review.comment}`.trim() : '';
        const shortComment = reviewText.length > 90 ? `${reviewText.slice(0, 87)}...` : reviewText;
        const hasReply = Boolean(review.staffReply);

        return {
            id: `review-${review.id}`,
            kind: 'review',
            entityType: 'review',
            entityId: review.id,
            reference: review.id,
            severity: review.rating <= 3 ? 'high' : 'medium',
            title: hasReply
                ? `Review updated by ${customerName}`
                : `New review from ${customerName}`,
            title_ar: hasReply
                ? `تم تحديث تقييم من ${customerName}`
                : `تقييم جديد من ${customerName}`,
            message: hasReply
                ? `Rating ${review.rating}/5${review.staff?.name ? ` for ${review.staff.name}` : ''}.`
                : `Rating ${review.rating}/5${review.staff?.name ? ` for ${review.staff.name}` : ''}${shortComment ? `: "${shortComment}"` : ''}`,
            message_ar: hasReply
                ? `بتقييم ${review.rating}/5${review.staff?.name ? ` لمقدم الخدمة ${review.staff.name}` : ''}.`
                : `بتقييم ${review.rating}/5${review.staff?.name ? ` لمقدم الخدمة ${review.staff.name}` : ''}${shortComment ? `: "${shortComment}"` : ''}`,
            amountDue: null,
            paymentIntent: null,
            scheduledAt: review.createdAt,
            detailPath: '/dashboard/reviews'
        };
    });

    return {
        alerts,
        summary: {
            reviewAlertCount: alerts.length,
            lowRatedReviewCount: alerts.filter((alert) => alert.severity === 'high').length,
            pendingReviewReplyCount: reviews.filter((review) => !review.staffReply).length
        }
    };
};

const mapPaymentTransaction = (transaction) => {
    const appointment = transaction.appointment;
    const order = transaction.order;
    const entityType = appointment ? 'appointment' : 'order';
    const reference = appointment?.bookingNumber || appointment?.id || order?.orderNumber || transaction.transactionRef || transaction.id;
    const user = appointment?.user || order?.user;

    return {
        id: transaction.id,
        entityType,
        entityId: appointment?.id || order?.id || null,
        reference,
        customerName: getCustomerName(user),
        title: appointment
            ? getServiceName(appointment.service)
            : getOrderLabel(order),
        amount: parseFloat(transaction.amount || 0),
        type: transaction.type,
        paymentMethod: transaction.paymentMethod,
        paymentMethodLabel: formatPaymentMethodLabel(transaction.paymentMethod),
        status: transaction.status,
        transactionRef: transaction.transactionRef,
        notes: transaction.notes,
        processedAt: transaction.processedAt,
        processorName: transaction.processor?.name || null,
        detailPath: appointment
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
};

const mapAppointmentAttentionAlert = (appointment, now = new Date()) => {
    const startTime = new Date(appointment.startTime);
    const graceMinutes = Number(
        appointment?.notificationSettings?.appointmentGracePeriodMinutes
        || 5
    );
    const overdueThreshold = new Date(startTime.getTime() + graceMinutes * 60 * 1000);
    const isOverdue = overdueThreshold.getTime() <= now.getTime();
    const reference = appointment.bookingNumber || appointment.id;
    const customerName = getCustomerName(appointment.user);
    const serviceName = getServiceName(appointment.service);
    const scheduledAt = appointment.startTime;

    return {
        id: `appointment-attention-${appointment.id}-${isOverdue ? 'overdue' : 'due'}`,
        kind: 'appointment',
        entityType: 'appointment',
        entityId: appointment.id,
        reference,
        severity: isOverdue ? 'high' : 'medium',
        title: isOverdue
            ? `Appointment overdue for booking ${reference}`
            : `Appointment needs check-in for booking ${reference}`,
        title_ar: isOverdue
            ? `الموعد متأخر للحجز ${reference}`
            : `الموعد يحتاج تسجيل حضور للحجز ${reference}`,
        message: isOverdue
            ? `${customerName} has not checked in for ${serviceName}; the booking time has passed.`
            : `${customerName} is scheduled for ${serviceName} and has not checked in yet.`,
        message_ar: isOverdue
            ? `لم يقم ${customerName} بتسجيل الحضور لخدمة ${serviceName} وقد انتهى وقت الموعد.`
            : `تم تحديد موعد ${serviceName} لـ ${customerName} ولم يتم تسجيل الحضور بعد.`,
        scheduledAt,
        detailPath: appointment.id ? `/dashboard/appointments/${appointment.id}` : null
    };
};

const mapCompletedPaymentDueAlert = (appointment) => {
    const dueAmount = getAppointmentDueAmount(appointment);
    const reference = appointment.bookingNumber || appointment.id;
    const customerName = getCustomerName(appointment.user);
    const serviceName = getServiceName(appointment.service);
    const isDepositRemainder = appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID;

    return {
        id: `appointment-completed-due-${appointment.id}`,
        kind: 'appointment',
        entityType: 'appointment',
        entityId: appointment.id,
        reference,
        severity: 'high',
        title: isDepositRemainder
            ? `Remainder due after completed booking ${reference}`
            : `Payment due after completed booking ${reference}`,
        title_ar: isDepositRemainder
            ? `المتبقي مستحق بعد اكتمال الحجز ${reference}`
            : `الدفع مستحق بعد اكتمال الحجز ${reference}`,
        message: isDepositRemainder
            ? `${customerName} still has ${dueAmount.toFixed(2)} SAR due for ${serviceName} after the service was completed.`
            : `${customerName} still has ${dueAmount.toFixed(2)} SAR due for ${serviceName} after the service was completed.`,
        message_ar: isDepositRemainder
            ? `لا يزال لدى ${customerName} مبلغ ${dueAmount.toFixed(2)} ر.س مستحق مقابل ${serviceName} بعد اكتمال الخدمة.`
            : `لا يزال لدى ${customerName} مبلغ ${dueAmount.toFixed(2)} ر.س مستحق مقابل ${serviceName} بعد اكتمال الخدمة.`,
        amountDue: dueAmount,
        paymentIntent: isDepositRemainder ? 'deposit_remainder_due' : 'payment_due_after_completion',
        scheduledAt: appointment.serviceCompletedAt || appointment.updatedAt || appointment.startTime,
        detailPath: appointment.id ? `/dashboard/appointments/${appointment.id}` : null
    };
};

const extractRescheduleAuditEntries = (notes) => {
    const text = `${notes || ''}`;
    if (!text.includes(RESCHEDULE_AUDIT_MARKER)) {
        return [];
    }

    const entries = [];
    const regex = /\[RESCHEDULE_AUDIT\]\s*(\{.*\})/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            if (parsed && typeof parsed === 'object') {
                entries.push(parsed);
            }
        } catch (_error) {
            // Ignore malformed entries and continue with valid ones.
        }
    }

    return entries;
};

const extractCancellationAuditEntries = (notes) => {
    const text = `${notes || ''}`;
    if (!text.includes(CANCELLATION_AUDIT_MARKER)) {
        return [];
    }

    const entries = [];
    const regex = /\[CANCELLATION_AUDIT\]\s*(\{.*\})/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            if (parsed && typeof parsed === 'object') {
                entries.push(parsed);
            }
        } catch (_error) {
            // Ignore malformed entries and continue.
        }
    }

    return entries;
};

const fetchRecentCustomerRescheduleAlerts = async (tenantId, limit = POS_ALERT_LIMIT) => {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - RESCHEDULE_ALERT_LOOKBACK_DAYS);

    const events = await db.AppointmentEvent.findAll({
        where: {
            tenantId,
            eventType: 'customer_rescheduled',
            occurredAt: { [Op.gte]: lookbackDate }
        },
        include: [
            {
                model: db.Appointment,
                as: 'appointment',
                required: false,
                include: [
                    {
                        model: db.Service,
                        as: 'service',
                        attributes: ['id', 'name_en', 'name_ar'],
                        required: false
                    },
                    {
                        model: db.PlatformUser,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                        required: false
                    }
                ]
            }
        ],
        order: [['occurredAt', 'DESC']],
        limit: Math.max(limit * 3, limit)
    });

    const alerts = events
        .map((event) => {
            const appointment = event.appointment;
            if (!appointment) return null;
            const payload = event.payload || {};
            const at = new Date(event.occurredAt || event.createdAt);
            const fromStart = payload.fromStartTime ? new Date(payload.fromStartTime) : null;
            const toStart = payload.toStartTime ? new Date(payload.toStartTime) : null;
            const customerName = getCustomerName(appointment.user);
            const serviceName = getServiceName(appointment.service);
            const reference = appointment.bookingNumber || appointment.id;

            return {
                id: `appointment-rescheduled-${appointment.id}-${at.getTime()}`,
                kind: 'appointment',
                entityType: 'appointment',
                entityId: appointment.id,
                reference,
                severity: 'medium',
                title: `Customer rescheduled booking ${reference}`,
                title_ar: `العميل أعاد جدولة الحجز ${reference}`,
                message: `${customerName} moved ${serviceName} from ${fromStart ? formatDateTimeLabel(fromStart) : '-'} to ${toStart ? formatDateTimeLabel(toStart) : '-'}.`,
                message_ar: `${customerName} قام بتغيير موعد ${serviceName} من ${fromStart ? formatDateTimeLabel(fromStart) : '-'} إلى ${toStart ? formatDateTimeLabel(toStart) : '-'}.`,
                scheduledAt: at.toISOString(),
                detailPath: appointment.id ? `/dashboard/appointments/${appointment.id}` : null
            };
        })
        .filter(Boolean)
        .slice(0, limit);

    return {
        alerts,
        summary: {
            customerRescheduledCount: alerts.length
        }
    };
};

const fetchRecentCustomerCancellationAlerts = async (tenantId, limit = POS_ALERT_LIMIT) => {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - RESCHEDULE_ALERT_LOOKBACK_DAYS);

    const events = await db.AppointmentEvent.findAll({
        where: {
            tenantId,
            eventType: 'customer_cancelled',
            occurredAt: { [Op.gte]: lookbackDate }
        },
        include: [
            {
                model: db.Appointment,
                as: 'appointment',
                required: false,
                include: [
                    {
                        model: db.Service,
                        as: 'service',
                        attributes: ['id', 'name_en', 'name_ar'],
                        required: false
                    },
                    {
                        model: db.PlatformUser,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                        required: false
                    }
                ]
            }
        ],
        order: [['occurredAt', 'DESC']],
        limit: Math.max(limit * 3, limit)
    });

    const alerts = events
        .map((event) => {
            const appointment = event.appointment;
            if (!appointment) return null;
            const payload = event.payload || {};
            const at = new Date(event.occurredAt || event.createdAt);
            const customerName = getCustomerName(appointment.user);
            const serviceName = getServiceName(appointment.service);
            const reference = appointment.bookingNumber || appointment.id;
            const reasonCode = `${payload.reasonCode || ''}`.trim();
            const reasonText = `${payload.reasonText || ''}`.trim();

            const reasonLabel = reasonText || reasonCode || 'Not specified';
            const reasonLabelAr = reasonText || reasonCode || 'غير محدد';

            return {
                id: `appointment-cancelled-${appointment.id}-${at.getTime()}`,
                kind: 'appointment',
                entityType: 'appointment',
                entityId: appointment.id,
                reference,
                severity: 'high',
                title: `Customer cancelled booking ${reference}`,
                title_ar: `العميل ألغى الحجز ${reference}`,
                message: `${customerName} cancelled ${serviceName}. Reason: ${reasonLabel}.`,
                message_ar: `${customerName} قام بإلغاء ${serviceName}. السبب: ${reasonLabelAr}.`,
                scheduledAt: at.toISOString(),
                detailPath: appointment.id ? `/dashboard/appointments/${appointment.id}` : null
            };
        })
        .filter(Boolean)
        .slice(0, limit);

    return {
        alerts,
        summary: {
            customerCancelledCount: alerts.length
        }
    };
};

const fetchCompletedPaymentDueAlerts = async (tenantId, limit = POS_ALERT_LIMIT) => {
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 7);

    const completedAppointments = await db.Appointment.findAll({
        where: {
            tenantId,
            status: 'completed',
            updatedAt: { [Op.gte]: recentCutoff },
            [Op.or]: [
                { paymentStatus: APPOINTMENT_PAYMENT_STATUS.PENDING },
                {
                    [Op.and]: [
                        { paymentStatus: APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID },
                        { remainderPaid: false },
                        { remainderAmount: { [Op.gt]: 0 } }
                    ]
                }
            ]
        },
        include: [
            {
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar'],
                required: false
            },
            {
                model: db.Staff,
                as: 'staff',
                attributes: ['id', 'name'],
                required: false
            },
            {
                model: db.PlatformUser,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            }
        ],
        order: [['updatedAt', 'DESC']],
        limit
    });

    const alerts = completedAppointments
        .map((appointment) => mapCompletedPaymentDueAlert(appointment))
        .filter(Boolean)
        .slice(0, limit);

    return {
        alerts,
        summary: {
            completedPaymentDueCount: alerts.length
        }
    };
};

const buildAppointmentSearchWhere = (tenantId, search) => {
    const where = {
        tenantId,
        status: { [Op.in]: ACTIVE_APPOINTMENT_STATUSES },
        [Op.or]: [
            { paymentStatus: APPOINTMENT_PAYMENT_STATUS.PENDING },
            {
                [Op.and]: [
                    { paymentStatus: APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID },
                    { remainderPaid: false },
                    { remainderAmount: { [Op.gt]: 0 } }
                ]
            }
        ]
    };

    if (search) {
        const searchConditions = [
                { bookingNumber: { [Op.iLike]: `%${search}%` } },
                { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
                { '$user.lastName$': { [Op.iLike]: `%${search}%` } },
                { '$user.phone$': { [Op.iLike]: `%${search}%` } },
                { '$user.email$': { [Op.iLike]: `%${search}%` } },
                { '$service.name_en$': { [Op.iLike]: `%${search}%` } },
                { '$service.name_ar$': { [Op.iLike]: `%${search}%` } }
        ];

        if (UUID_REGEX.test(search)) {
            searchConditions.unshift({ id: { [Op.eq]: search } });
        }

        where[Op.and] = [{
            [Op.or]: searchConditions
        }];
    }

    return where;
};

const fetchAppointmentAttentionAlerts = async (tenantId, limit = POS_ALERT_LIMIT) => {
    const now = new Date();
    const activeAppointments = await db.Appointment.findAll({
        where: {
            tenantId,
            status: { [Op.in]: ['pending', 'confirmed'] },
            startTime: { [Op.lte]: now }
        },
        include: [
            {
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar'],
                required: false
            },
            {
                model: db.Staff,
                as: 'staff',
                attributes: ['id', 'name'],
                required: false
            },
            {
                model: db.PlatformUser,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            }
        ],
        order: [['startTime', 'ASC']],
        limit
    });

    const settingsMap = await loadTenantNotificationSettingsMap([tenantId]);
    const tenantNotificationSettings = settingsMap.get(String(tenantId))?.notificationSettings
        || normalizeAppointmentNotificationSettings();

    const alerts = activeAppointments
        .map((appointment) => ({
            ...appointment.toJSON(),
            notificationSettings: tenantNotificationSettings
        }))
        .map((appointment) => mapAppointmentAttentionAlert(appointment, now))
        .filter(Boolean);

    return {
        alerts,
        summary: {
            appointmentAttentionCount: alerts.length,
            overdueAppointmentCount: alerts.filter((alert) => alert.severity === 'high').length,
            checkInDueCount: alerts.filter((alert) => alert.severity !== 'high').length
        }
    };
};

const buildOrderSearchWhere = (tenantId, search) => {
    const where = {
        tenantId,
        paymentStatus: 'pending',
        paymentMethod: { [Op.in]: ['pay_on_visit', 'cash_on_delivery'] },
        status: { [Op.notIn]: ['cancelled', 'refunded'] }
    };

    if (search) {
        where[Op.or] = [
            { orderNumber: { [Op.iLike]: `%${search}%` } },
            { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
            { '$user.lastName$': { [Op.iLike]: `%${search}%` } },
            { '$user.phone$': { [Op.iLike]: `%${search}%` } },
            { '$user.email$': { [Op.iLike]: `%${search}%` } }
        ];
    }

    return where;
};

const fetchQueueData = async (tenantId, search = '', limit = POS_QUEUE_LIMIT) => {
    const [appointments, orders] = await Promise.all([
        db.Appointment.findAll({
            where: buildAppointmentSearchWhere(tenantId, search),
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar']
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                }
            ],
            order: [['startTime', 'ASC']],
            limit
        }),
        db.Order.findAll({
            where: buildOrderSearchWhere(tenantId, search),
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                },
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar'],
                            required: false
                        }
                    ],
                    required: false
                }
            ],
            order: [['createdAt', 'ASC']],
            limit
        })
    ]);

    const queue = [
        ...appointments.map(mapAppointmentQueueItem),
        ...orders.map(mapOrderQueueItem)
    ]
        .filter((item) => item.dueAmount > 0)
        .sort((left, right) => toTimestamp(left.scheduledAt) - toTimestamp(right.scheduledAt))
        .slice(0, limit);

    const totalDueAmount = queue.reduce((sum, item) => sum + item.dueAmount, 0);
    const appointmentDueCount = queue.filter((item) => item.entityType === 'appointment').length;
    const orderDueCount = queue.filter((item) => item.entityType === 'order').length;

    return {
        queue,
        summary: {
            totalDueCount: queue.length,
            appointmentDueCount,
            orderDueCount,
            totalDueAmount: parseFloat(totalDueAmount.toFixed(2)),
            checkedInDueCount: queue.filter((item) => item.entityType === 'appointment' && item.status === 'checked_in').length
        }
    };
};

const fetchClosingSummaryData = async (tenantId, selectedDate) => {
    const dateRange = parseDateRange(selectedDate, selectedDate);
    const entityScope = await fetchTenantPaymentEntityScope(tenantId);

    const transactions = await db.PaymentTransaction.findAll({
        where: buildTenantScopedTransactionWhere(entityScope, { processedAt: dateRange }),
        include: getTransactionIncludes(),
        order: [['processedAt', 'DESC']],
        subQuery: false
    });

    const totalsByMethod = {};
    const totalsBySource = {
        appointments: 0,
        orders: 0,
        refunds: 0
    };

    let grossCollected = 0;
    let refundsTotal = 0;

    transactions.forEach((transaction) => {
        const amount = parseFloat(transaction.amount || 0);
        const method = transaction.paymentMethod || 'cash';

        if (!totalsByMethod[method]) {
            totalsByMethod[method] = {
                paymentMethod: method,
                paymentMethodLabel: formatPaymentMethodLabel(method),
                collected: 0,
                refunded: 0,
                transactionCount: 0
            };
        }

        totalsByMethod[method].transactionCount += 1;

        if (transaction.status === 'refunded' || transaction.type === 'refund') {
            refundsTotal += amount;
            totalsByMethod[method].refunded += amount;
            totalsBySource.refunds += amount;
            return;
        }

        if (transaction.status === 'completed') {
            grossCollected += amount;
            totalsByMethod[method].collected += amount;

            if (transaction.appointment) {
                totalsBySource.appointments += amount;
            } else if (transaction.order) {
                totalsBySource.orders += amount;
            }
        }
    });

    const cashierBreakdownMap = new Map();
    transactions.forEach((transaction) => {
        if (transaction.status !== 'completed') return;

        const processorName = transaction.processor?.name || 'Tenant Dashboard';
        const existing = cashierBreakdownMap.get(processorName) || {
            processorName,
            transactionCount: 0,
            collected: 0
        };

        existing.transactionCount += 1;
        existing.collected += parseFloat(transaction.amount || 0);
        cashierBreakdownMap.set(processorName, existing);
    });

    return {
        summary: {
            date: selectedDate,
            grossCollected: parseFloat(grossCollected.toFixed(2)),
            refundsTotal: parseFloat(refundsTotal.toFixed(2)),
            netCollected: parseFloat((grossCollected - refundsTotal).toFixed(2)),
            transactionCount: transactions.length,
            totalsByMethod: Object.values(totalsByMethod).map((entry) => ({
                ...entry,
                collected: parseFloat(entry.collected.toFixed(2)),
                refunded: parseFloat(entry.refunded.toFixed(2))
            })),
            totalsBySource: {
                appointments: parseFloat(totalsBySource.appointments.toFixed(2)),
                orders: parseFloat(totalsBySource.orders.toFixed(2)),
                refunds: parseFloat(totalsBySource.refunds.toFixed(2))
            },
            cashierBreakdown: Array.from(cashierBreakdownMap.values()).map((entry) => ({
                ...entry,
                collected: parseFloat(entry.collected.toFixed(2))
            }))
        },
        transactions
    };
};

const renderTransactionReceiptPdf = (res, transaction) => {
    const mappedTransaction = mapPaymentTransaction(transaction);
    const appointment = transaction.appointment;
    const order = transaction.order;
    const filename = `receipt-${mappedTransaction.transactionRef || mappedTransaction.reference || transaction.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    if (fs.existsSync(cairoFontPath)) {
        doc.registerFont('Cairo', cairoFontPath);
        doc.font('Cairo');
    }

    doc.pipe(res);

    doc.rect(0, 0, 595.28, 120).fill('#7C3AED');
    if (fs.existsSync(logoFallbackPath)) {
        try {
            doc.image(logoFallbackPath, 40, 32, { fit: [92, 48] });
        } catch (error) {
            // Skip logo if the image cannot be decoded by PDFKit.
        }
    }

    doc.fillColor('#FFFFFF')
        .fontSize(20)
        .text('Refah Payment Receipt | سند قبض رفاه', 160, 42, {
            width: 360,
            align: 'right'
        });
    doc.fontSize(10).text(mappedTransaction.reference || '-', 160, 74, {
        width: 360,
        align: 'right'
    });

    doc.roundedRect(40, 150, 515, 230, 16).fillAndStroke('#FFFFFF', '#E2E8F0');
    doc.fillColor('#7C3AED').fontSize(12).text('Transaction Details | تفاصيل العملية', 56, 170, {
        width: 483,
        align: 'right'
    });

    const rows = [
        ['Customer | العميل', mappedTransaction.customerName],
        ['Item | البند', mappedTransaction.title],
        ['Reference | المرجع', mappedTransaction.reference],
        ['Payment Method | طريقة الدفع', mappedTransaction.paymentMethodLabel],
        ['Transaction Ref | رقم العملية', mappedTransaction.transactionRef || '-'],
        ['Processed At | وقت التحصيل', formatDateTimeLabel(mappedTransaction.processedAt)],
        ['Cashier | الكاشير', mappedTransaction.processorName || 'Tenant Dashboard'],
        ['Status | الحالة', mappedTransaction.status]
    ];

    let y = 198;
    rows.forEach(([label, value]) => {
        doc.fillColor('#64748B').fontSize(9).text(label, 56, y, { width: 170, align: 'left' });
        doc.fillColor('#0F172A').fontSize(10).text(`${value || '-'}`, 220, y - 1, { width: 320, align: 'right' });
        y += 20;
    });

    doc.roundedRect(40, 410, 515, 104, 16).fill('#F8FAFC').stroke('#E2E8F0');
    doc.fillColor('#EC4899').fontSize(12).text('Paid Amount | المبلغ المحصل', 56, 432, {
        width: 483,
        align: 'right'
    });
    doc.fillColor('#0F172A').fontSize(28).text(formatMoney(mappedTransaction.amount), 56, 458, {
        width: 483,
        align: 'right'
    });

    if (mappedTransaction.notes) {
        doc.roundedRect(40, 540, 515, 84, 16).fillAndStroke('#FFFFFF', '#E2E8F0');
        doc.fillColor('#7C3AED').fontSize(11).text('Notes | ملاحظات', 56, 558, {
            width: 483,
            align: 'right'
        });
        doc.fillColor('#334155').fontSize(10).text(mappedTransaction.notes, 56, 580, {
            width: 483,
            align: 'right'
        });
    }

    const footerText = appointment
        ? 'تم تحصيل هذه الدفعة لحجز خدمة عبر منصة رفاه | This payment was collected for a service booking via Refah.'
        : order
            ? 'تم تحصيل هذه الدفعة لطلب منتجات عبر منصة رفاه | This payment was collected for a product order via Refah.'
            : 'شكراً لاستخدام رفاه | Thank you for using Refah.';

    doc.fillColor('#64748B').fontSize(9).text(footerText, 40, 790, {
        width: 515,
        align: 'center'
    });

    doc.end();
};

const renderClosingSummaryCsv = (res, selectedDate, summary, transactions) => {
    const lines = [
        [
            'Date',
            'Transaction Ref',
            'Entity Type',
            'Reference',
            'Customer',
            'Item',
            'Type',
            'Method',
            'Status',
            'Amount',
            'Processed At',
            'Cashier'
        ].map(escapeCsvField).join(',')
    ];

    transactions.forEach((transaction) => {
        const mapped = mapPaymentTransaction(transaction);
        lines.push([
            selectedDate,
            mapped.transactionRef || '',
            mapped.entityType,
            mapped.reference,
            mapped.customerName,
            mapped.title,
            mapped.type,
            mapped.paymentMethodLabel,
            mapped.status,
            mapped.amount,
            formatDateTimeLabel(mapped.processedAt),
            mapped.processorName || 'Tenant Dashboard'
        ].map(escapeCsvField).join(','));
    });

    lines.push('');
    lines.push(['Summary', 'Value'].map(escapeCsvField).join(','));
    lines.push(['Gross Collected', summary.grossCollected].map(escapeCsvField).join(','));
    lines.push(['Refunds Total', summary.refundsTotal].map(escapeCsvField).join(','));
    lines.push(['Net Collected', summary.netCollected].map(escapeCsvField).join(','));
    lines.push(['Transactions', summary.transactionCount].map(escapeCsvField).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pos-closing-${selectedDate}.csv"`);
    res.send(`\uFEFF${lines.join('\n')}`);
};

exports.getCollectionQueue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const search = `${req.query.search || ''}`.trim();
        const limit = Math.min(parseInt(req.query.limit || POS_QUEUE_LIMIT, 10), POS_QUEUE_LIMIT);
        const { queue, summary } = await fetchQueueData(tenantId, search, limit);

        res.json({
            success: true,
            queue,
            summary
        });
    } catch (error) {
        console.error('Get POS collection queue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load POS collection queue',
            error: error.message
        });
    }
};

exports.getOperationalAlerts = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const readerId = getOperationalAlertReaderId(req);
        const limit = Math.min(parseInt(req.query.limit || POS_ALERT_LIMIT, 10), POS_ALERT_LIMIT);
        const [queueResult, appointmentResult, reviewResult, rescheduleResult, cancellationResult] = await Promise.all([
            fetchQueueData(tenantId, '', POS_QUEUE_LIMIT),
            fetchAppointmentAttentionAlerts(tenantId, limit),
            fetchReviewAttentionAlerts(tenantId, limit),
            fetchRecentCustomerRescheduleAlerts(tenantId, limit),
            fetchRecentCustomerCancellationAlerts(tenantId, limit)
        ]);
        const completedDueResult = await fetchCompletedPaymentDueAlerts(tenantId, limit);
        const alerts = [
            ...queueResult.queue.map(mapPosAlertFromQueueItem).map((alert) => ({
                ...alert,
                kind: 'pos'
            })),
            ...appointmentResult.alerts,
            ...reviewResult.alerts,
            ...rescheduleResult.alerts,
            ...cancellationResult.alerts,
            ...completedDueResult.alerts
        ]
            .sort((left, right) => {
                const priorityDiff = getOperationalAlertPriority(right) - getOperationalAlertPriority(left);
                if (priorityDiff !== 0) return priorityDiff;
                return toTimestamp(right.scheduledAt) - toTimestamp(left.scheduledAt);
            })
            .slice(0, limit);

        const { readKeys, readAllAt } = await getOperationalAlertsReadState(tenantId, readerId, alerts);
        const alertsWithReadState = alerts.map((alert) => {
            const alertKey = `${alert.id || ''}`;
            const alertTimestamp = toTimestamp(alert.scheduledAt);
            const isReadByKey = readKeys.has(alertKey);
            const isReadByReadAll = !!(readAllAt && alertTimestamp > 0 && alertTimestamp <= readAllAt.getTime());
            return {
                ...alert,
                alertKey,
                isRead: isReadByKey || isReadByReadAll
            };
        });
        const unreadCount = alertsWithReadState.filter((alert) => !alert.isRead).length;

        const summary = {
            ...queueResult.summary,
            ...appointmentResult.summary,
            ...reviewResult.summary,
            ...rescheduleResult.summary,
            ...cancellationResult.summary,
            ...completedDueResult.summary
        };

        res.json({
            success: true,
            alerts: alertsWithReadState,
            summary,
            unreadCount
        });
    } catch (error) {
        console.error('Get POS operational alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load POS alerts',
            error: error.message
        });
    }
};

exports.markOperationalAlertRead = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const readerId = getOperationalAlertReaderId(req);
        const alertKey = `${req.params.alertKey || ''}`.trim();

        if (!alertKey) {
            return res.status(400).json({ success: false, message: 'alertKey is required' });
        }

        await db.TenantOperationalAlertRead.upsert({
            tenantId,
            readerId,
            alertKey,
            readAt: new Date()
        });

        return res.json({ success: true, message: 'Alert marked as read' });
    } catch (error) {
        console.error('Mark operational alert read error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark alert as read', error: error.message });
    }
};

exports.markAllOperationalAlertsRead = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const readerId = getOperationalAlertReaderId(req);

        await db.TenantOperationalAlertRead.upsert({
            tenantId,
            readerId,
            alertKey: OPERATIONAL_ALERT_READ_ALL_KEY,
            readAt: new Date()
        });

        return res.json({ success: true, message: 'All operational alerts marked as read' });
    } catch (error) {
        console.error('Mark all operational alerts read error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark all alerts as read', error: error.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const {
            search = '',
            startDate,
            endDate,
            page = 1,
            limit = 25
        } = req.query;

        const safeLimit = Math.min(parseInt(limit, 10) || 25, POS_TRANSACTION_LIMIT);
        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (safePage - 1) * safeLimit;
        const dateRange = parseDateRange(startDate, endDate);
        const entityScope = await fetchTenantPaymentEntityScope(tenantId);

        const { rows, count } = await db.PaymentTransaction.findAndCountAll({
            where: buildTenantScopedTransactionWhere(entityScope, {
                search,
                processedAt: dateRange
            }),
            include: getTransactionIncludes(),
            order: [['processedAt', 'DESC']],
            distinct: true,
            subQuery: false,
            limit: safeLimit,
            offset
        });

        res.json({
            success: true,
            transactions: rows.map(mapPaymentTransaction),
            pagination: {
                total: count,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(count / safeLimit)
            }
        });
    } catch (error) {
        console.error('Get POS transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load POS transaction ledger',
            error: error.message
        });
    }
};

exports.getClosingSummary = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
        const { summary } = await fetchClosingSummaryData(tenantId, selectedDate);

        res.json({
            success: true,
            summary
        });
    } catch (error) {
        console.error('Get POS closing summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load POS closing summary',
            error: error.message
        });
    }
};

exports.downloadTransactionReceiptPdf = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const entityScope = await fetchTenantPaymentEntityScope(tenantId);
        const transaction = await db.PaymentTransaction.findOne({
            where: buildTenantScopedTransactionWhere(entityScope, { id: req.params.id }),
            include: getTransactionIncludes({ includeTenantOnlyFields: false }),
            subQuery: false
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Payment transaction not found'
            });
        }

        renderTransactionReceiptPdf(res, transaction);
    } catch (error) {
        console.error('Download POS transaction receipt error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate POS receipt',
            error: error.message
        });
    }
};

exports.exportClosingSummaryCsv = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
        const { summary, transactions } = await fetchClosingSummaryData(tenantId, selectedDate);

        renderClosingSummaryCsv(res, selectedDate, summary, transactions);
    } catch (error) {
        console.error('Export POS closing summary CSV error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export POS closing summary',
            error: error.message
        });
    }
};
