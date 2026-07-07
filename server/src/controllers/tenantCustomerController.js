/**
 * Tenant Customer Controller
 * Manages customers (platform users who have booked with this tenant)
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { buildPublicAssetUrl } = require('../utils/url');
const walletService = require('../services/walletService');
const TENANT_APPOINTMENT_AUDIT_LOGS_ENABLED = process.env.TENANT_APPOINTMENT_AUDIT_LOGS === '1';

function createRuntimeTraceLogger(req, res, label, details = {}) {
    const startedAt = Date.now();
    console.info(`[runtime-trace] ${label} request start`, {
        method: req.method,
        url: req.originalUrl,
        params: req.params,
        query: req.query,
        ...details
    });

    res.once('finish', () => {
        console.info(`[runtime-trace] ${label} request end`, {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt
        });
    });
}

function logRuntimeTraceException(label, error, details = {}) {
    console.error(`[runtime-trace] ${label} exception`, {
        message: error?.message || String(error),
        stack: error?.stack || null,
        ...details
    });
}

function logTenantAppointmentAudit(event, payload = {}) {
    if (!TENANT_APPOINTMENT_AUDIT_LOGS_ENABLED) {
        return;
    }

    try {
        console.info('[tenant-appointment-audit]', JSON.stringify({
            event,
            at: new Date().toISOString(),
            ...payload
        }));
    } catch (error) {
        console.info('[tenant-appointment-audit]', event, payload);
    }
}

function toSerializableValue(value, stack = new WeakSet()) {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value !== 'object') {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value.toJSON === 'function') {
        try {
            const jsonValue = value.toJSON();
            if (jsonValue !== value) {
                return toSerializableValue(jsonValue, stack);
            }
        } catch (error) {
            // Fall through to manual cloning below.
        }
    }

    if (stack.has(value)) {
        return null;
    }

    stack.add(value);

    if (Array.isArray(value)) {
        const clonedArray = value.map((item) => toSerializableValue(item, stack));
        stack.delete(value);
        return clonedArray;
    }

    const output = {};
    for (const [key, nestedValue] of Object.entries(value)) {
        if (typeof nestedValue === 'function') {
            continue;
        }

        if (key === 'parent' || key === 'sequelize') {
            continue;
        }

        output[key] = toSerializableValue(nestedValue, stack);
    }

    stack.delete(value);
    return output;
}

function parseDateValue(value, endOfDay = false) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        } else {
            date.setHours(0, 0, 0, 0);
        }
    }

    return date;
}

function getCustomerName(user) {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user?.email || user?.phone || 'Guest Customer';
}

function isWalkInPlaceholderCustomer(user) {
    const normalizedFirst = `${user?.firstName || ''}`.trim().toLowerCase();
    const normalizedLast = `${user?.lastName || ''}`.trim();
    return (normalizedFirst === 'customer' || normalizedFirst === 'عميل') && /^\d{3}$/.test(normalizedLast);
}

function formatPaymentMethodLabel(paymentMethod) {
    if (paymentMethod && typeof paymentMethod === 'object') {
        if (paymentMethod.cardBrand && paymentMethod.cardLast4) {
            return `${paymentMethod.cardBrand} ••••${paymentMethod.cardLast4}`;
        }

        if (paymentMethod.type) {
            return formatPaymentMethodLabel(paymentMethod.type);
        }
    }

    return ({
        online: 'Online',
        cash: 'Cash',
        card_pos: 'Card POS',
        wallet: 'Wallet',
        bank_transfer: 'Bank transfer',
        gift_card_code: 'Gift card code',
        split: 'Split payment',
        pay_on_visit: 'Pay on visit',
        cash_on_delivery: 'Cash on delivery'
    }[paymentMethod] || paymentMethod || 'Not set');
}

function formatTransactionTitle(record) {
    if (record.type === 'refund') {
        return 'Refund';
    }

    if (record.kind === 'booking_session') {
        return record.bookingSession?.bookingReference
            ? `Booking #${record.bookingSession.bookingReference}`
            : 'Booking payment';
    }

    if (record.source === 'transaction') {
        if (record.kind === 'appointment') {
            return record.appointment?.service
                ? `${record.appointment.service.name_en || record.appointment.service.name_ar || 'Service'}`
                : 'Service booking';
        }
        if (record.kind === 'order') {
            return record.order?.orderNumber ? `Order #${record.order.orderNumber}` : 'Product purchase';
        }
    }

    if (record.kind === 'appointment') {
        return record.appointment?.service
            ? `${record.appointment.service.name_en || record.appointment.service.name_ar || 'Service'}`
            : 'Service booking';
    }
    if (record.kind === 'order') {
        return record.order?.orderNumber ? `Order #${record.order.orderNumber}` : 'Product purchase';
    }

    return 'Transaction';
}

function formatTransactionSubtitle(record, locale = 'en') {
    if (record.kind === 'booking_session') {
        const serviceCount = Array.isArray(record.bookingSession?.appointments)
            ? record.bookingSession.appointments.length
            : 0;
        return serviceCount > 0
            ? (locale === 'ar'
                ? `${serviceCount} خدمة`
                : `${serviceCount} service${serviceCount === 1 ? '' : 's'}`)
            : record.bookingSession?.bookingReference || record.reference || '';
    }

    if (record.kind === 'appointment') {
        return record.appointment?.staff?.name || record.appointment?.bookingNumber || record.reference || '';
    }

    if (record.kind === 'order') {
        const firstItem = Array.isArray(record.order?.items) ? record.order.items[0] : null;
        if (!firstItem) return record.reference || '';
        return locale === 'ar'
            ? firstItem.product?.name_ar || firstItem.productNameAr || firstItem.productName || ''
            : firstItem.product?.name_en || firstItem.productName || firstItem.productNameAr || '';
    }

    return record.reference || '';
}

function formatWalletTransactionTitle(record, locale = 'en') {
    const direction = `${record.direction || ''}`.toLowerCase();
    const type = `${record.type || ''}`.toLowerCase();

    if (direction === 'debit') {
        if (type === 'service_payment_debit') {
            return locale === 'ar' ? 'دفع خدمة من المحفظة' : 'Service wallet payment';
        }
        if (type === 'product_payment_debit') {
            return locale === 'ar' ? 'دفع منتج من المحفظة' : 'Product wallet payment';
        }
        if (type === 'gift_sent_debit') {
            return locale === 'ar' ? 'إهداء من المحفظة' : 'Gift wallet transfer';
        }
        return locale === 'ar' ? 'خصم من المحفظة' : 'Wallet debit';
    }

    if (type === 'refund_credit') {
        return locale === 'ar' ? 'استرداد إلى المحفظة' : 'Wallet refund';
    }

    if (type === 'topup') {
        return locale === 'ar' ? 'شحن المحفظة' : 'Wallet top up';
    }

    if (type === 'gift_received_credit') {
        return locale === 'ar' ? 'رصيد هدية' : 'Gift wallet credit';
    }

    return locale === 'ar' ? 'حركة محفظة' : 'Wallet transaction';
}

function formatWalletTransactionSubtitle(record, locale = 'en') {
    const referenceType = `${record.referenceType || ''}`.toLowerCase();
    const referenceId = record.referenceId || record.id;

    if (referenceType === 'appointment') {
        return locale === 'ar'
            ? `مرتبطة بالموعد ${referenceId}`
            : `Linked to appointment ${referenceId}`;
    }

    if (referenceType === 'order') {
        return locale === 'ar'
            ? `مرتبطة بالطلب ${referenceId}`
            : `Linked to order ${referenceId}`;
    }

    if (referenceType === 'gift_card') {
        return locale === 'ar'
            ? `مرتبطة ببطاقة الهدية ${referenceId}`
            : `Linked to gift card ${referenceId}`;
    }

    return record.referenceType || record.referenceId || '';
}

function mapCustomerTransactionRecord(record, locale = 'en') {
  const appointment = record.appointment || null;
  const order = record.order || null;
  const bookingSession = record.bookingSession || null;
  const entityType = record.kind || (bookingSession ? 'booking_session' : appointment ? 'appointment' : 'order');
  const reference = record.reference
        || appointment?.bookingNumber
      || bookingSession?.bookingReference
      || order?.orderNumber
      || record.transactionRef
      || record.id;
  const processedAt = record.processedAt || record.createdAt || record.date;
  const metadataPaymentMethod = record.metadata?.paymentMethod || record.metadata?.paymentSummaryMethod || null;
  const paymentMethodValue = typeof record.paymentMethod === 'string'
      ? record.paymentMethod
      : (record.paymentMethod?.type || metadataPaymentMethod || appointment?.paymentMethod || order?.paymentMethod || 'cash');
  const normalizedAppointmentPayment = appointment
      ? normalizeAppointmentPaymentState(appointment, record.source || 'transaction')
      : null;

    return {
        id: record.id,
        source: record.source || 'transaction',
        entityType,
        entityId: record.entityId || bookingSession?.id || appointment?.id || order?.id || null,
        reference,
        title: formatTransactionTitle({ ...record, appointment, order, bookingSession }),
        subtitle: formatTransactionSubtitle({ ...record, appointment, order, bookingSession }, locale),
    amount: parseFloat(record.amount || 0),
    currency: record.currency || 'SAR',
    type: record.type || 'booking',
    status: record.status || 'completed',
    paymentMethod: paymentMethodValue,
    paymentMethodLabel: formatPaymentMethodLabel(record.paymentMethod || paymentMethodValue),
    normalizedPaymentStatus: normalizedAppointmentPayment?.normalizedPaymentStatus || null,
    appointmentOutstandingAmount: normalizedAppointmentPayment?.outstandingAmount ?? null,
    appointmentPaidAmount: normalizedAppointmentPayment?.paidAmount ?? null,
    paymentEvidenceSource: normalizedAppointmentPayment?.paymentEvidenceSource || (record.source || 'transaction'),
    transactionRef: record.transactionRef || null,
        notes: record.notes || null,
        processedAt,
        processorName: record.processor?.name || null,
        detailPath: bookingSession?.appointments?.[0]?.id
            ? `/dashboard/appointments/${bookingSession.appointments[0].id}`
            : appointment
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
}

function mapWalletLedgerRecord(record, locale = 'en') {
    return {
        id: record.id,
        source: 'wallet_ledger',
        entityType: 'wallet',
        entityId: record.referenceId || record.id,
        reference: record.referenceId || record.id,
        title: formatWalletTransactionTitle(record, locale),
        subtitle: formatWalletTransactionSubtitle(record, locale),
        amount: parseFloat(record.amount || 0),
        currency: record.currency || 'SAR',
        type: record.type || 'wallet',
        status: 'completed',
        paymentMethod: 'wallet',
        paymentMethodLabel: formatPaymentMethodLabel('wallet'),
        normalizedPaymentStatus: null,
        appointmentOutstandingAmount: null,
        appointmentPaidAmount: null,
        paymentEvidenceSource: 'wallet_ledger',
        transactionRef: record.referenceId || null,
        notes: record.metadata?.note || record.metadata?.notes || null,
        processedAt: record.createdAt,
        processorName: null,
        detailPath: record.referenceType === 'appointment' && record.referenceId
            ? `/dashboard/appointments/${record.referenceId}`
            : record.referenceType === 'order' && record.referenceId
                ? `/dashboard/orders/${record.referenceId}`
                : null,
        direction: record.direction || null,
        referenceType: record.referenceType || null,
        referenceId: record.referenceId || null,
        metadata: record.metadata || {}
    };
}

function calculateAppointmentOutstandingAmount(appointment) {
  const paymentStatus = appointment?.paymentStatus;
  if (paymentStatus === 'pending') {
    return Math.max(Number(appointment?.price || 0), 0);
  }

  if (paymentStatus === 'deposit_paid') {
    return Math.max(Number(appointment?.remainderAmount || 0), 0);
  }

  return 0;
}

function normalizeAppointmentPaymentState(appointment, evidenceSource = 'appointment') {
    const rawStatus = `${appointment?.paymentStatus || ''}`.trim().toLowerCase();
    const price = Number(appointment?.price || 0);
    const totalPaid = Number(appointment?.totalPaid || 0);
    const depositAmount = Number(appointment?.depositAmount || 0);
    const remainderAmount = Number(appointment?.remainderAmount || 0);
    const fallbackOutstanding = calculateAppointmentOutstandingAmount(appointment);
    const paidAmount = Number.isFinite(totalPaid) && totalPaid > 0
        ? totalPaid
        : (rawStatus === 'deposit_paid' ? Math.max(0, depositAmount) : 0);
    const outstandingAmount = Math.max(
        0,
        Number.isFinite(price) && price > 0
            ? price - paidAmount
            : fallbackOutstanding
    );

    let normalizedPaymentStatus = rawStatus || 'pending';
    if ((normalizedPaymentStatus === 'fully_paid' || normalizedPaymentStatus === 'paid') && outstandingAmount > 0.009) {
        normalizedPaymentStatus = 'deposit_paid';
    }
    if (normalizedPaymentStatus === 'deposit_paid' && outstandingAmount <= 0.009 && remainderAmount <= 0.009) {
        normalizedPaymentStatus = 'fully_paid';
    }

    return {
        normalizedPaymentStatus,
        paidAmount: Number.isFinite(paidAmount) ? parseFloat(paidAmount.toFixed(2)) : 0,
        outstandingAmount: parseFloat(outstandingAmount.toFixed(2)),
        paymentEvidenceSource: evidenceSource
    };
}

function normalizeBookingSessionStatusValue(status) {
    return `${status || ''}`.trim().toLowerCase();
}

function getBookingSessionAggregationKey(record = {}) {
    return `${record?.bookingSessionId
        || record?.bookingSession?.id
        || record?.bookingReference
        || record?.bookingSession?.bookingReference
        || record?.bookingNumber
        || record?.id
        || ''}`.trim();
}

function getAppointmentComparableTimestamp(appointment = {}) {
    const candidates = [
        appointment?.startTime,
        appointment?.date,
        appointment?.createdAt,
        appointment?.updatedAt,
        appointment?.endTime,
        appointment?.processedAt
    ];

    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        const parsed = new Date(candidate).getTime();
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return 0;
}

function getAppointmentLineDuration(appointment = {}) {
    return Number(
        appointment?.service?.duration
        || appointment?.serviceVariantDuration
        || appointment?.duration
        || 0
    );
}

function toPlainAppointmentAggregationRecord(appointment, overrides = {}) {
    if (!appointment) {
        return null;
    }

    const plain = typeof appointment.get === 'function'
        ? appointment.get({ plain: true })
        : (typeof appointment.toJSON === 'function'
            ? appointment.toJSON()
            : { ...appointment });

    const sanitized = {
        ...plain,
        ...overrides
    };

    delete sanitized.bookingSession;
    delete sanitized.bookingSessions;
    delete sanitized.appointments;

    if (sanitized.service && typeof sanitized.service === 'object') {
        sanitized.service = { ...sanitized.service };
    }

    if (sanitized.staff && typeof sanitized.staff === 'object') {
        sanitized.staff = { ...sanitized.staff };
    }

    if (sanitized.user && typeof sanitized.user === 'object') {
        sanitized.user = { ...sanitized.user };
    }

    return sanitized;
}

function buildAppointmentServiceLine(appointment, index, bookingSessionId, bookingReference) {
    const normalizedPayment = normalizeAppointmentPaymentState(appointment, 'appointment');
    const serviceNameEn = appointment?.service?.name_en || appointment?.serviceNameEn || appointment?.serviceName || appointment?.title || '';
    const serviceNameAr = appointment?.service?.name_ar || appointment?.serviceNameAr || appointment?.serviceName || appointment?.title || '';
    const staffName = appointment?.staff?.name || appointment?.employee?.name || appointment?.staffName || '';

    return {
        id: appointment?.id || `${bookingSessionId || bookingReference || 'appointment'}-${index}`,
        appointmentId: appointment?.id || null,
        bookingSessionId: bookingSessionId || appointment?.bookingSessionId || null,
        bookingReference: bookingReference || appointment?.bookingReference || null,
        bookingItemIndex: appointment?.bookingItemIndex ?? index,
        service: appointment?.service || null,
        staff: appointment?.staff || null,
        serviceNameEn,
        serviceNameAr,
        staffName,
        date: appointment?.startTime || appointment?.date || null,
        startTime: appointment?.startTime || null,
        endTime: appointment?.endTime || null,
        duration: getAppointmentLineDuration(appointment),
        price: parseFloat(appointment?.price || 0),
        status: normalizeBookingSessionStatusValue(appointment?.status),
        paymentStatus: normalizeBookingSessionStatusValue(appointment?.paymentStatus),
        normalizedPaymentStatus: normalizedPayment.normalizedPaymentStatus,
        paymentMethod: appointment?.paymentMethod || null,
        totalPaid: normalizedPayment.paidAmount,
        outstandingAmount: normalizedPayment.outstandingAmount,
        branch: appointment?.branch || appointment?.tenantBranch || null,
        notes: appointment?.notes || null
    };
}

function deriveBookingSessionStatus(appointments = [], bookingSession = null) {
    const bookingSessionStatus = normalizeBookingSessionStatusValue(bookingSession?.status);
    if (bookingSessionStatus) {
        return bookingSessionStatus;
    }

    const statuses = appointments
        .map((appointment) => normalizeBookingSessionStatusValue(appointment?.status))
        .filter(Boolean);

    if (statuses.length === 0) {
        return 'pending';
    }

    if (statuses.some((status) => ['cancelled', 'canceled'].includes(status))) {
        return 'cancelled';
    }

    if (statuses.some((status) => ['no_show', 'no-show', 'noshow'].includes(status))) {
        return 'no_show';
    }

    if (statuses.every((status) => ['completed', 'done', 'served'].includes(status))) {
        return 'completed';
    }

    if (statuses.some((status) => ['in_service', 'in service', 'serving'].includes(status))) {
        return 'in_service';
    }

    if (statuses.some((status) => ['checked_in', 'arrived'].includes(status))) {
        return 'checked_in';
    }

    if (statuses.some((status) => ['confirmed', 'booked', 'scheduled'].includes(status))) {
        return 'confirmed';
    }

    return statuses[0] || 'pending';
}

function deriveBookingSessionPaymentStatus(appointments = [], bookingSession = null) {
    const bookingSessionPaymentStatus = normalizeBookingSessionStatusValue(bookingSession?.paymentStatus);
    if (bookingSessionPaymentStatus) {
        return bookingSessionPaymentStatus;
    }

    const normalizedPayments = appointments.map((appointment) => normalizeAppointmentPaymentState(appointment, 'appointment'));
    const totalAmount = normalizedPayments.reduce((sum, item) => sum + Number(item.outstandingAmount || 0) + Number(item.paidAmount || 0), 0);
    const paidAmount = normalizedPayments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    const outstandingAmount = normalizedPayments.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0);
    const statuses = appointments.map((appointment) => normalizeBookingSessionStatusValue(appointment?.paymentStatus));

    if (statuses.some((status) => ['partially_refunded', 'refunded'].includes(status))) {
        return statuses.includes('partially_refunded') ? 'partially_refunded' : 'refunded';
    }

    if (totalAmount > 0 && outstandingAmount <= 0.009) {
        return 'fully_paid';
    }

    if (paidAmount > 0.009) {
        return 'deposit_paid';
    }

    return statuses.find(Boolean) || 'pending';
}

function aggregateAppointmentsByBookingSession(appointments = []) {
    const groups = new Map();

    [...appointments]
        .sort((a, b) => getAppointmentComparableTimestamp(b) - getAppointmentComparableTimestamp(a))
        .forEach((appointment) => {
            const groupingKey = getBookingSessionAggregationKey(appointment);
            if (!groupingKey) {
                return;
            }

            const bucket = groups.get(groupingKey) || [];
            bucket.push(appointment);
            groups.set(groupingKey, bucket);
        });

    return Array.from(groups.entries())
        .map(([groupingKey, group]) => {
            const orderedGroup = [...group].sort((a, b) => {
                const indexA = Number.isFinite(Number(a?.bookingItemIndex)) ? Number(a.bookingItemIndex) : Number.MAX_SAFE_INTEGER;
                const indexB = Number.isFinite(Number(b?.bookingItemIndex)) ? Number(b.bookingItemIndex) : Number.MAX_SAFE_INTEGER;
                if (indexA !== indexB) {
                    return indexA - indexB;
                }

                const timeDiff = getAppointmentComparableTimestamp(a) - getAppointmentComparableTimestamp(b);
                if (timeDiff !== 0) {
                    return timeDiff;
                }

                return `${a?.id || ''}`.localeCompare(`${b?.id || ''}`);
            });

            const plainGroup = orderedGroup
                .map((appointment, index) => toPlainAppointmentAggregationRecord(appointment, {
                    bookingItemIndex: appointment?.bookingItemIndex ?? index,
                    bookingSessionId: appointment?.bookingSessionId || null,
                    bookingReference: appointment?.bookingReference || appointment?.bookingNumber || null
                }))
                .filter(Boolean);
            const primary = plainGroup[0] || {};
            const sourceBookingSession = orderedGroup.find((appointment) => appointment?.bookingSession)?.bookingSession || null;
            const bookingSessionId = sourceBookingSession?.id || primary?.bookingSessionId || null;
            const bookingReference = sourceBookingSession?.bookingReference || primary?.bookingReference || primary?.bookingNumber || null;
            const serviceLines = plainGroup.map((appointment, index) => buildAppointmentServiceLine(appointment, index, bookingSessionId, bookingReference));
            const serviceNameEn = serviceLines
                .map((line) => line.serviceNameEn)
                .filter(Boolean)
                .join(' + ');
            const serviceNameAr = serviceLines
                .map((line) => line.serviceNameAr)
                .filter(Boolean)
                .join(' + ');
            const staffNames = [...new Set(serviceLines.map((line) => line.staffName).filter(Boolean))];
            const totalAmount = orderedGroup.reduce((sum, appointment) => sum + Number(appointment?.price || 0), 0);
            const paymentSummaries = plainGroup.map((appointment) => normalizeAppointmentPaymentState(appointment, 'appointment'));
            const totalPaid = paymentSummaries.reduce((sum, summary) => sum + Number(summary.paidAmount || 0), 0);
            const outstandingAmount = paymentSummaries.reduce((sum, summary) => sum + Number(summary.outstandingAmount || 0), 0);
            const normalizedPaymentStatus = deriveBookingSessionPaymentStatus(plainGroup, sourceBookingSession);
            const sessionStatus = deriveBookingSessionStatus(plainGroup, sourceBookingSession);
            const primaryService = primary?.service || serviceLines[0]?.service || null;
            const primaryStaff = primary?.staff || serviceLines[0]?.staff || null;
            const duration = plainGroup.reduce((sum, appointment) => sum + getAppointmentLineDuration(appointment), 0);
            const startTime = orderedGroup[0]?.startTime || primary?.startTime || null;
            const endTime = orderedGroup[orderedGroup.length - 1]?.endTime || primary?.endTime || null;
            const firstAppointment = plainGroup[0] || null;
            const detailPath = firstAppointment?.id ? `/dashboard/appointments/${firstAppointment.id}` : null;
            const bookingSessionAppointments = plainGroup.map((appointment, index) => ({
                ...appointment,
                bookingSessionId: bookingSessionId || appointment?.bookingSessionId || null,
                bookingReference: bookingReference || appointment?.bookingReference || null,
                bookingItemIndex: appointment?.bookingItemIndex ?? index
            }));

            return {
                ...primary,
                id: bookingSessionId || primary?.id || groupingKey,
                bookingSessionId: bookingSessionId || null,
                bookingReference: bookingReference || null,
                bookingNumber: bookingReference || primary?.bookingNumber || null,
                bookingItemIndex: primary?.bookingItemIndex ?? 0,
                service: primaryService,
                staff: primaryStaff,
                date: startTime,
                startTime,
                endTime,
                status: sessionStatus,
                paymentStatus: normalizedPaymentStatus,
                normalizedPaymentStatus,
                paymentMethod: sourceBookingSession?.paymentMethod || primary?.paymentMethod || null,
                price: parseFloat(totalAmount.toFixed(2)),
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                totalPaid: parseFloat(totalPaid.toFixed(2)),
                paidAmount: parseFloat(totalPaid.toFixed(2)),
                outstandingAmount: parseFloat(outstandingAmount.toFixed(2)),
                duration,
                serviceNameEn: serviceNameEn || primary?.serviceNameEn || primaryService?.name_en || primaryService?.name || '',
                serviceNameAr: serviceNameAr || primary?.serviceNameAr || primaryService?.name_ar || primaryService?.name || '',
                assignedStaffName: staffNames.join(' + ') || primaryStaff?.name || '',
                serviceLines,
                appointments: bookingSessionAppointments,
                bookingSession: {
                    id: bookingSessionId || null,
                    bookingReference: bookingReference || null,
                    status: sessionStatus,
                    paymentStatus: normalizedPaymentStatus,
                    paymentMethod: sourceBookingSession?.paymentMethod || primary?.paymentMethod || null,
                    totalAmount: parseFloat(totalAmount.toFixed(2)),
                    totalPaid: parseFloat(totalPaid.toFixed(2)),
                    outstandingAmount: parseFloat(outstandingAmount.toFixed(2)),
                    appointments: bookingSessionAppointments
                },
                details: {
                    service: primaryService,
                    services: serviceLines.map((line) => line.service).filter(Boolean),
                    staff: primaryStaff,
                    staffName: staffNames.join(' + ') || primaryStaff?.name || '',
                    startTime,
                    endTime,
                    duration,
                    branch: primary?.branch || primary?.tenantBranch || null,
                    bookingSessionId: bookingSessionId || null,
                    bookingReference: bookingReference || null,
                    bookingItemCount: orderedGroup.length,
                    notes: orderedGroup.map((appointment) => appointment?.notes).filter(Boolean).join(' | ') || primary?.notes || ''
                },
                detailPath,
                type: 'booking_session',
                kind: 'booking_session',
                sourceBookingSessionId: bookingSessionId || null,
                sourceBookingReference: bookingReference || null,
                sessionAppointmentCount: orderedGroup.length
            };
        })
        .sort((a, b) => getAppointmentComparableTimestamp(b) - getAppointmentComparableTimestamp(a));
}

/**
 * Get all customers who have booked with this tenant
 */
exports.getCustomers = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'lastVisit',
            sortOrder = 'DESC',
            loyaltyTier = '',
            minBookings = 0,
            minSpent = 0
        } = req.query;

        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
        const offset = (safePage - 1) * safeLimit;
        const customerType = req.query.customerType || ''; // 'service_only', 'product_only', 'both', 'walk_in', or ''

        // Find all platform users who have appointments OR orders with this tenant
        const whereClause = {};
        
        if (search) {
            whereClause[Op.or] = [
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const baseCustomers = await db.PlatformUser.findAll({
            where: whereClause,
            attributes: [
                'id', 'firstName', 'lastName', 'email', 'phone',
                'profileImage', 'gender', 'createdAt'
            ],
            order: [['createdAt', 'DESC']]
        });

        const customerIds = baseCustomers.map((customer) => customer.id);
        const [appointmentRows, orderRows] = customerIds.length > 0
            ? await Promise.all([
                db.Appointment.findAll({
                    where: {
                        platformUserId: { [Op.in]: customerIds }
                    },
                    include: [
                        {
                            model: db.Service,
                            as: 'service',
                            where: { tenantId },
                            required: true,
                            attributes: ['id', 'name_en', 'name_ar']
                        }
                    ],
                    attributes: ['id', 'platformUserId', 'startTime', 'endTime', 'bookingNumber', 'bookingSessionId', 'bookingReference', 'bookingItemIndex', 'status', 'price', 'paymentStatus', 'paymentMethod', 'depositAmount', 'remainderAmount', 'totalPaid'],
                    order: [['startTime', 'DESC']]
                }),
                db.Order.findAll({
                    where: {
                        platformUserId: { [Op.in]: customerIds },
                        tenantId
                    },
                    include: [
                        {
                            model: db.OrderItem,
                            as: 'items',
                            attributes: ['id', 'quantity', 'unitPrice', 'totalPrice']
                        }
                    ],
                    attributes: ['id', 'platformUserId', 'orderNumber', 'status', 'paymentStatus', 'totalAmount', 'createdAt'],
                    order: [['createdAt', 'DESC']]
                })
            ])
            : [[], []];

        const appointmentMap = new Map();
        appointmentRows.forEach((appointment) => {
            const appointmentData = typeof appointment.toJSON === 'function' ? appointment.toJSON() : { ...appointment };
            const customerId = appointmentData.platformUserId || null;
            if (!customerId) {
                return;
            }
            const bucket = appointmentMap.get(customerId) || [];
            bucket.push(appointmentData);
            appointmentMap.set(customerId, bucket);
        });

        const orderMap = new Map();
        orderRows.forEach((order) => {
            const orderData = typeof order.toJSON === 'function' ? order.toJSON() : { ...order };
            const customerId = orderData.platformUserId || null;
            if (!customerId) {
                return;
            }
            const bucket = orderMap.get(customerId) || [];
            bucket.push(orderData);
            orderMap.set(customerId, bucket);
        });

        let allCustomers = baseCustomers.map((customer) => ({
            ...(typeof customer.toJSON === 'function' ? customer.toJSON() : { ...customer }),
            appointments: appointmentMap.get(customer.id) || [],
            orders: orderMap.get(customer.id) || []
        }));

        // Filter by customer type
        if (customerType === 'service_only') {
            allCustomers = allCustomers.filter(c => c.appointments.length > 0 && (!c.orders || c.orders.length === 0));
        } else if (customerType === 'product_only') {
            allCustomers = allCustomers.filter(c => (!c.appointments || c.appointments.length === 0) && c.orders.length > 0);
        } else if (customerType === 'both') {
            allCustomers = allCustomers.filter(c => c.appointments.length > 0 && c.orders.length > 0);
        } else if (customerType === 'walk_in') {
            allCustomers = allCustomers.filter(c => isWalkInPlaceholderCustomer(c));
        }

        // Enrich with customer insights
        const insightCustomerIds = allCustomers.map((c) => c.id);
        const insights = insightCustomerIds.length > 0
            ? await db.CustomerInsight.findAll({
                where: {
                    platformUserId: { [Op.in]: insightCustomerIds },
                    tenantId
                }
            })
            : [];

        const insightsMap = {};
        insights.forEach(i => {
            insightsMap[i.platformUserId] = i;
        });

        // Calculate stats for each customer
        const enrichedCustomers = allCustomers.map(customer => {
            const appointments = customer.appointments || [];
            const bookingSessions = aggregateAppointmentsByBookingSession(appointments);
            const orders = customer.orders || [];
            const insight = insightsMap[customer.id];

            const appointmentDates = bookingSessions
                .map(a => a.date || a.startTime)
                .filter(Boolean)
                .sort((a, b) => new Date(a) - new Date(b));
            const orderDates = orders
                .map(o => o.createdAt)
                .filter(Boolean)
                .sort((a, b) => new Date(a) - new Date(b));

            // Calculate from appointments
            const completedAppointments = bookingSessions.filter(a => a.status === 'completed');
            const appointmentSpending = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || a.totalAmount || 0), 0);
            
            // Calculate from orders
            const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
            const orderSpending = completedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
            const totalProductsPurchased = orders.reduce((sum, o) => {
                const items = o.items || [];
                return sum + items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
            }, 0);

            // Combined totals
            const totalSpent = appointmentSpending + orderSpending;
            const firstAppointment = appointmentDates.length > 0 ? appointmentDates[0] : null;
            const firstOrder = orderDates.length > 0 ? orderDates[0] : null;
            
            // Determine last visit (most recent of appointment or order)
            const lastAppointment = appointmentDates.length > 0
                ? appointmentDates[appointmentDates.length - 1]
                : null;
            const lastOrder = orderDates.length > 0
                ? orderDates[orderDates.length - 1]
                : null;
            const lastVisit = lastAppointment && lastOrder
                ? (new Date(lastAppointment) > new Date(lastOrder) ? lastAppointment : lastOrder)
                : (lastAppointment || lastOrder);

            // Determine customer type
            let customerType = 'both';
            if (bookingSessions.length > 0 && orders.length === 0) {
                customerType = 'service_only';
            } else if (bookingSessions.length === 0 && orders.length > 0) {
                customerType = 'product_only';
            }

            // Format profile image URL
            const photoUrl = buildPublicAssetUrl(customer.profileImage);

            return {
                id: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone,
                photo: photoUrl,
                gender: customer.gender,
                joinedAt: customer.createdAt,
                // Tenant-specific stats
                totalBookings: insight?.totalBookings || bookingSessions.length,
                totalOrders: orders.length,
                totalProductsPurchased: totalProductsPurchased,
                totalSpent: insight?.totalSpent || totalSpent,
                lastVisit: insight?.lastVisit || lastVisit,
                firstVisit: insight?.firstVisit || (firstAppointment && firstOrder
                    ? (new Date(firstAppointment) < new Date(firstOrder) ? firstAppointment : firstOrder)
                    : (firstAppointment || firstOrder || null)),
                loyaltyTier: insight?.loyaltyTier || 'bronze',
                loyaltyPoints: insight?.tenantLoyaltyPoints || 0,
                noShowCount: insight?.noShowCount || bookingSessions.filter(a => a.status === 'no_show').length,
                cancellationCount: insight?.cancellationCount || bookingSessions.filter(a => a.status === 'cancelled').length,
                tags: insight?.tags || [],
                notes: insight?.notes || '',
                customerType: customerType
            };
        });

        // Apply post-filters
        let filteredCustomers = enrichedCustomers;
        
        if (loyaltyTier) {
            filteredCustomers = filteredCustomers.filter(c => c.loyaltyTier === loyaltyTier);
        }
        if (parseInt(minBookings) > 0) {
            filteredCustomers = filteredCustomers.filter(c => c.totalBookings >= parseInt(minBookings));
        }
        if (parseFloat(minSpent) > 0) {
            filteredCustomers = filteredCustomers.filter(c => c.totalSpent >= parseFloat(minSpent));
        }

        // Sort enriched data
        if (sortBy === 'totalSpent') {
            filteredCustomers.sort((a, b) => sortOrder === 'DESC' ? b.totalSpent - a.totalSpent : a.totalSpent - b.totalSpent);
        } else if (sortBy === 'totalBookings') {
            filteredCustomers.sort((a, b) => sortOrder === 'DESC' ? b.totalBookings - a.totalBookings : a.totalBookings - b.totalBookings);
        } else if (sortBy === 'lastVisit') {
            filteredCustomers.sort((a, b) => {
                const dateA = a.lastVisit ? new Date(a.lastVisit) : new Date(0);
                const dateB = b.lastVisit ? new Date(b.lastVisit) : new Date(0);
                return sortOrder === 'DESC' ? dateB - dateA : dateA - dateB;
            });
        } else if (sortBy === 'firstName') {
            filteredCustomers.sort((a, b) => {
                const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return sortOrder === 'DESC' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
            });
        }

        // Re-apply pagination after filtering
        const filteredTotal = filteredCustomers.length;
        const paginatedFiltered = filteredCustomers.slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            data: {
                customers: toSerializableValue(paginatedFiltered),
                pagination: {
                    total: filteredTotal,
                    page: safePage,
                    limit: safeLimit,
                    totalPages: Math.ceil(filteredTotal / safeLimit)
                }
            }
        });

    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customers',
            error: error.message
        });
    }
};

/**
 * Get single customer with full details
 */
exports.getCustomer = async (req, res) => {
    try {
        createRuntimeTraceLogger(req, res, 'GET /api/v1/tenant/customers/:id');
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const walletHistoryMode = `${req.query.walletHistory || ''}`.toLowerCase() === 'full' || req.query.includeWalletHistory === '1';

        // Get platform user
        const customer = await db.PlatformUser.findByPk(id, {
            attributes: [
                'id', 'firstName', 'lastName', 'email', 'phone',
                'profileImage', 'gender', 'dateOfBirth', 'preferredLanguage', 'walletBalance',
                'createdAt'
            ]
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get all appointments for this customer at this tenant
        const appointments = await db.Appointment.findAll({
            where: { platformUserId: id },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true,
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image']
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo']
                }
            ],
            attributes: ['id', 'startTime', 'endTime', 'bookingNumber', 'bookingSessionId', 'bookingReference', 'bookingItemIndex', 'status', 'price', 'paymentStatus', 'paymentMethod', 'depositAmount', 'remainderAmount', 'totalPaid', 'notes', 'serviceVariantName', 'serviceVariantDuration'],
            order: [['startTime', 'DESC']]
        });
        const bookingSessions = aggregateAppointmentsByBookingSession(appointments);

        // Get all orders for this customer at this tenant
        const orders = await db.Order.findAll({
            where: { 
                platformUserId: id,
                tenantId 
            },
            include: [
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'image', 'category']
                        }
                    ],
                    attributes: ['id', 'quantity', 'unitPrice', 'totalPrice', 'productName', 'productNameAr', 'productImage']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const [walletLedgerEntries, giftCardTransactions] = await Promise.all([
            db.WalletLedgerEntry.findAll({
                where: {
                    platformUserId: id,
                },
                order: [['createdAt', 'DESC']],
                ...(walletHistoryMode ? {} : { limit: 10 })
            }),
            db.GiftCardTransaction.findAll({
                where: {
                    [Op.or]: [
                        { senderPlatformUserId: id },
                        { recipientPlatformUserId: id }
                    ]
                },
                include: [
                {
                    model: db.GiftCardPackage,
                    as: 'package',
                    required: false,
                    attributes: ['id', 'title_en', 'title_ar', 'priceAmount', 'walletCreditAmount', 'bonusAmount']
                }
            ],
                order: [['createdAt', 'DESC']],
                ...(walletHistoryMode ? {} : { limit: 10 })
            })
        ]);

        const reviews = await db.Review.findAll({
            where: {
                tenantId,
                platformUserId: id,
                isVisible: true
            },
            include: [
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo'],
                    required: false
                },
                {
                    model: db.Appointment,
                    as: 'appointment',
                    attributes: ['id', 'status', 'startTime', 'serviceVariantName', 'serviceVariantDuration'],
                    required: false,
                    include: [
                        {
                            model: db.Service,
                            as: 'service',
                            attributes: ['id', 'name_en', 'name_ar', 'duration'],
                            required: false
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Get or create customer insight
        let insight = await db.CustomerInsight.findOne({
            where: { platformUserId: id, tenantId }
        });

        // Calculate stats from booking sessions
        const completedAppointments = bookingSessions.filter(a => a.status === 'completed');
        const appointmentSpending = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || a.totalAmount || 0), 0);
        const avgBookingValue = completedAppointments.length > 0 ? appointmentSpending / completedAppointments.length : 0;

        // Calculate stats from orders
        const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
        const orderSpending = completedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
        const totalProductsPurchased = orders.reduce((sum, o) => {
            const items = o.items || [];
            return sum + items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
        }, 0);

        // Combined totals
        const totalSpent = appointmentSpending + orderSpending;

        // Service frequency
        const serviceFrequency = {};
        bookingSessions.forEach(a => {
            const serviceEntries = Array.isArray(a.serviceLines) && a.serviceLines.length > 0
                ? a.serviceLines
                : [{ service: a.service }];
            serviceEntries.forEach((entry) => {
                const serviceName = entry?.service?.name_en || entry?.serviceNameEn || entry?.name_en || 'Unknown';
                serviceFrequency[serviceName] = (serviceFrequency[serviceName] || 0) + 1;
            });
        });

        // Staff preference
        const staffFrequency = {};
        bookingSessions.forEach(a => {
            const staffEntries = Array.isArray(a.serviceLines) && a.serviceLines.length > 0
                ? a.serviceLines
                : [{ staff: a.staff }];
            staffEntries.forEach((entry) => {
                if (entry?.staff?.name || entry?.staffName) {
                    const staffName = entry?.staff?.name || entry?.staffName;
                    staffFrequency[staffName] = (staffFrequency[staffName] || 0) + 1;
                }
            });
        });

        // Time preference analysis
        const timeSlots = { morning: 0, afternoon: 0, evening: 0 };
        bookingSessions.forEach(a => {
            const hour = new Date(a.startTime || a.date || 0).getHours();
            if (hour < 12) timeSlots.morning++;
            else if (hour < 17) timeSlots.afternoon++;
            else timeSlots.evening++;
        });

        // Product frequency analysis
        const productFrequency = {};
        orders.forEach(o => {
            const items = o.items || [];
            items.forEach(item => {
                const productName = item.productName || item.product?.name_en || 'Unknown';
                productFrequency[productName] = (productFrequency[productName] || 0) + (item.quantity || 0);
            });
        });

        // Delivery preference
        const deliveryTypes = { pickup: 0, delivery: 0 };
        orders.forEach(o => {
            if (o.deliveryType === 'pickup') deliveryTypes.pickup++;
            else if (o.deliveryType === 'delivery') deliveryTypes.delivery++;
        });

        // Determine last visit (most recent of appointment or order)
        const lastAppointment = bookingSessions.length > 0 ? bookingSessions[0].startTime || bookingSessions[0].date : null;
        const lastOrder = orders.length > 0 ? orders[0].createdAt : null;
        const lastVisit = lastAppointment && lastOrder
            ? (new Date(lastAppointment) > new Date(lastOrder) ? lastAppointment : lastOrder)
            : (lastAppointment || lastOrder);

        // Determine first visit
        const firstAppointment = bookingSessions.length > 0 
            ? bookingSessions[bookingSessions.length - 1].startTime || bookingSessions[bookingSessions.length - 1].date
            : null;
        const firstOrder = orders.length > 0
            ? orders[orders.length - 1].createdAt
            : null;
        const firstVisit = firstAppointment && firstOrder
            ? (new Date(firstAppointment) < new Date(firstOrder) ? firstAppointment : firstOrder)
            : (firstAppointment || firstOrder);

        // Determine customer type
        let customerType = 'both';
        if (bookingSessions.length > 0 && orders.length === 0) {
            customerType = 'service_only';
        } else if (bookingSessions.length === 0 && orders.length > 0) {
            customerType = 'product_only';
        }

        const customerJson = customer.toJSON();
        // Ensure profileImage is properly formatted
        customerJson.profileImage = buildPublicAssetUrl(customerJson.profileImage);
        const currentWalletBalance = parseFloat(customerJson.walletBalance || 0);

        const mappedWalletLedgerEntries = walletLedgerEntries.map((entry) => ({
            id: entry.id,
            type: entry.type,
            direction: entry.direction,
            amount: parseFloat(entry.amount || 0),
            currency: entry.currency || 'SAR',
            balanceBefore: parseFloat(entry.balanceBefore || 0),
            balanceAfter: parseFloat(entry.balanceAfter || 0),
            referenceType: entry.referenceType || null,
            referenceId: entry.referenceId || null,
            metadata: entry.metadata || {},
            createdAt: entry.createdAt
        }));

        const mappedGiftCardTransactions = giftCardTransactions.map((tx) => ({
            id: tx.id,
            packageId: tx.packageId,
            packageTitle: tx.package?.title_en || tx.package?.title_ar || 'Gift card',
            purchaseAmount: parseFloat(tx.purchaseAmount || 0),
            creditAmount: parseFloat(tx.creditAmount || 0),
            bonusAmount: parseFloat(tx.bonusAmount || 0),
            totalCreditAmount: parseFloat(tx.totalCreditAmount || 0),
            status: tx.status,
            deliveryChannel: tx.deliveryChannel,
            senderPlatformUserId: tx.senderPlatformUserId || null,
            recipientPlatformUserId: tx.recipientPlatformUserId || null,
            recipientEmail: tx.recipientEmail || null,
            recipientPhone: tx.recipientPhone || null,
            deliveryMode: tx.deliveryMode || null,
            createdAt: tx.createdAt,
            claimedAt: tx.claimedAt || null
        }));

        const customerData = {
            ...customerJson,
            walletBalance: currentWalletBalance,
            // Stats
            totalBookings: bookingSessions.length,
            totalOrders: orders.length,
            completedBookings: completedAppointments.length,
            totalProductsPurchased: totalProductsPurchased,
            totalSpent,
            averageBookingValue: avgBookingValue,
            // Dates
            firstVisit: firstVisit,
            lastVisit: lastVisit,
            // Behavior
            noShowCount: bookingSessions.filter(a => a.status === 'no_show').length,
            cancellationCount: bookingSessions.filter(a => a.status === 'cancelled').length,
            // Preferences
            favoriteServices: Object.entries(serviceFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count })),
            favoriteProducts: Object.entries(productFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count })),
            preferredStaff: Object.entries(staffFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, count]) => ({ name, count })),
            preferredTime: Object.entries(timeSlots)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning',
            preferredDeliveryType: Object.entries(deliveryTypes)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'pickup',
            // Loyalty
            loyaltyTier: insight?.loyaltyTier || 'bronze',
            loyaltyPoints: insight?.tenantLoyaltyPoints || 0,
            // Custom data
            tags: insight?.tags || [],
            notes: insight?.notes || '',
            customerType: customerType,
            walletSummary: {
                currentBalance: currentWalletBalance,
                walletLedgerCount: mappedWalletLedgerEntries.length,
                sentGiftCardCount: mappedGiftCardTransactions.filter((tx) => tx.senderPlatformUserId === id).length,
                receivedGiftCardCount: mappedGiftCardTransactions.filter((tx) => tx.recipientPlatformUserId === id).length
            },
            walletLedgerEntries: mappedWalletLedgerEntries,
            giftCardTransactions: mappedGiftCardTransactions,
            reviews: reviews.map((review) => ({
                id: review.id,
                rating: review.rating,
                comment: review.comment || '',
                text: review.comment || '',
                title: review.appointment?.service?.name_en || review.appointment?.service?.name_ar || review.appointment?.serviceName || review.appointment?.serviceVariantName || 'Review',
                serviceName: review.appointment?.service?.name_en || review.appointment?.service?.name_ar || review.appointment?.serviceName || review.appointment?.serviceVariantName || 'Review',
                staff: review.staff ? {
                    id: review.staff.id,
                    name: review.staff.name,
                    photo: review.staff.photo || null
                } : null,
                appointmentId: review.appointmentId || null,
                appointment: review.appointment ? {
                    id: review.appointment.id,
                    status: review.appointment.status,
                    startTime: review.appointment.startTime,
                    serviceName: review.appointment.serviceName || review.appointment.serviceVariantName || review.appointment?.service?.name_en || review.appointment?.service?.name_ar || null
                } : null,
                createdAt: review.createdAt,
                reviewedAt: review.createdAt
            })),
            // All appointments (complete history)
            allAppointments: bookingSessions.map((a) => ({
                ...a,
                service: a.service || null,
                staff: a.staff || null,
                date: a.date || a.startTime || null,
                endTime: a.endTime || null,
                status: a.status,
                price: a.price,
                paymentStatus: a.paymentStatus,
                paymentMethod: a.paymentMethod,
                notes: a.details?.notes || a.notes || null,
                bookingReference: a.bookingReference || null,
                bookingSessionId: a.bookingSessionId || null,
                serviceVariantName: a.serviceVariantName || null,
                serviceVariantDuration: a.serviceVariantDuration || null,
                depositAmount: a.depositAmount ?? null,
                remainderAmount: a.remainderAmount ?? null,
                totalPaid: a.totalPaid ?? null,
                serviceLines: a.serviceLines || [],
                appointments: a.appointments || [],
                details: a.details || {}
            })),
            // All orders (complete history)
            allOrders: orders.map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                items: o.items || [],
                status: o.status,
                paymentStatus: o.paymentStatus,
                totalAmount: o.totalAmount,
                deliveryType: o.deliveryType,
                shippingAddress: o.shippingAddress,
                trackingNumber: o.trackingNumber,
                date: o.createdAt,
                estimatedDeliveryDate: o.estimatedDeliveryDate
            })),
            // Recent activity (for backward compatibility)
            recentAppointments: bookingSessions.slice(0, 10).map((a) => ({
                ...a,
                service: a.service || null,
                staff: a.staff || null,
                date: a.date || a.startTime || null,
                endTime: a.endTime || null,
                status: a.status,
                price: a.price,
                paymentStatus: a.paymentStatus,
                paymentMethod: a.paymentMethod,
                bookingReference: a.bookingReference || null,
                bookingSessionId: a.bookingSessionId || null,
                serviceVariantName: a.serviceVariantName || null,
                serviceVariantDuration: a.serviceVariantDuration || null,
                depositAmount: a.depositAmount ?? null,
                remainderAmount: a.remainderAmount ?? null,
                totalPaid: a.totalPaid ?? null,
                serviceLines: a.serviceLines || [],
                appointments: a.appointments || [],
                details: a.details || {}
            })),
            recentOrders: orders.slice(0, 10).map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                items: o.items,
                status: o.status,
                paymentStatus: o.paymentStatus,
                totalAmount: o.totalAmount,
                deliveryType: o.deliveryType,
                date: o.createdAt
            }))
        };

        res.json({
            success: true,
            data: toSerializableValue(customerData)
        });

    } catch (error) {
        logRuntimeTraceException('GET /api/v1/tenant/customers/:id', error, {
            statusCode: 500
        });
        console.error('Get customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer details',
            error: error.message
        });
    }
};

/**
 * Update core customer profile fields (tenant-specific)
 */
exports.updateCustomerProfile = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const {
            firstName,
            lastName,
            email,
            phone,
            gender,
            dateOfBirth,
            preferredLanguage
        } = req.body || {};

        const customer = await db.PlatformUser.findByPk(id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const updates = {};
        if (typeof firstName === 'string') {
            const value = firstName.trim();
            if (value) updates.firstName = value;
        }
        if (typeof lastName === 'string') {
            const value = lastName.trim();
            if (value) updates.lastName = value;
        }
        if (typeof email === 'string') {
            const value = email.trim().toLowerCase();
            if (value) updates.email = value;
        }
        if (typeof phone === 'string') {
            const value = phone.trim();
            if (value) updates.phone = value;
        }
        if (gender !== undefined) {
            updates.gender = gender || null;
        }
        if (dateOfBirth !== undefined) {
            updates.dateOfBirth = dateOfBirth || null;
        }
        if (preferredLanguage !== undefined) {
            updates.preferredLanguage = preferredLanguage || 'en';
        }

        if (updates.email || updates.phone) {
            const conflictWhere = {
                id: { [Op.ne]: id }
            };
            if (updates.email) conflictWhere.email = updates.email;
            if (updates.phone) conflictWhere.phone = updates.phone;

            const conflict = await db.PlatformUser.findOne({ where: conflictWhere });
            if (conflict) {
                return res.status(409).json({
                    success: false,
                    message: 'Another customer already uses this email or phone number'
                });
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.json({
                success: true,
                message: 'No profile changes provided',
                data: {
                    id: customer.id
                }
            });
        }

        await customer.update(updates);

        logTenantAppointmentAudit('customer_profile_updated', {
            tenantId,
            customerId: customer.id,
            updates: Object.keys(updates)
        });

        const updatedCustomer = await db.PlatformUser.findByPk(id, {
            attributes: [
                'id', 'firstName', 'lastName', 'email', 'phone',
                'profileImage', 'gender', 'dateOfBirth', 'preferredLanguage',
                'createdAt'
            ]
        });

        res.json({
            success: true,
            message: 'Customer profile updated',
            data: updatedCustomer
        });
    } catch (error) {
        console.error('Update customer profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update customer profile',
            error: error.message
        });
    }
};

/**
 * Update customer notes and tags (tenant-specific)
 */
exports.updateCustomerNotes = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { notes, tags } = req.body;

        // Find or create customer insight
        let [insight, created] = await db.CustomerInsight.findOrCreate({
            where: { platformUserId: id, tenantId },
            defaults: {
                platformUserId: id,
                tenantId,
                notes: notes || '',
                tags: tags || []
            }
        });

        if (!created) {
            // Update existing
            if (notes !== undefined) insight.notes = notes;
            if (tags !== undefined) insight.tags = tags;
            await insight.save();
        }

        res.json({
            success: true,
            message: 'Customer notes updated',
            data: {
                notes: insight.notes,
                tags: insight.tags
            }
        });

    } catch (error) {
        console.error('Update customer notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update customer notes',
            error: error.message
        });
    }
};

/**
 * Get customer statistics summary for dashboard
 */
exports.getCustomerStats = async (req, res) => {
    try {
        const tenantId = req.tenant.id;

        // Get all appointments for this tenant
        const appointments = await db.Appointment.findAll({
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true,
                    attributes: []
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id']
                }
            ],
            attributes: ['platformUserId', 'bookingSessionId', 'bookingReference', 'status', 'price', 'startTime']
        });

        const uniqueBookingAppointments = [];
        const seenBookingKeys = new Set();
        appointments.forEach((appointment) => {
            const bookingKey = `${appointment.platformUserId || 'unknown'}:${appointment.bookingSessionId || appointment.bookingReference || appointment.id}`;
            if (seenBookingKeys.has(bookingKey)) {
                return;
            }
            seenBookingKeys.add(bookingKey);
            uniqueBookingAppointments.push(appointment);
        });

        // Unique customers
        const uniqueCustomerIds = [...new Set(uniqueBookingAppointments.map(a => a.platformUserId).filter(Boolean))];
        const totalCustomers = uniqueCustomerIds.length;

        // New customers this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const newCustomersThisMonth = uniqueBookingAppointments.filter(a => {
            return a.startTime >= startOfMonth && a.platformUserId;
        });
        const newCustomerIds = [...new Set(newCustomersThisMonth.map(a => a.platformUserId))];

        // Calculate returning customers
        const customerBookingCounts = {};
        uniqueBookingAppointments.forEach(a => {
            if (a.platformUserId) {
                customerBookingCounts[a.platformUserId] = (customerBookingCounts[a.platformUserId] || 0) + 1;
            }
        });
        const returningCustomers = Object.values(customerBookingCounts).filter(count => count > 1).length;

        // Top spenders
        const customerSpending = {};
        uniqueBookingAppointments.filter(a => a.status === 'completed').forEach(a => {
            if (a.platformUserId) {
                customerSpending[a.platformUserId] = (customerSpending[a.platformUserId] || 0) + parseFloat(a.price || 0);
            }
        });

        // Get loyalty tier distribution
        const insights = await db.CustomerInsight.findAll({
            where: { tenantId },
            attributes: ['loyaltyTier']
        });

        const tierDistribution = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
        insights.forEach(i => {
            tierDistribution[i.loyaltyTier] = (tierDistribution[i.loyaltyTier] || 0) + 1;
        });

        res.json({
            success: true,
            data: {
                totalCustomers,
                newCustomersThisMonth: newCustomerIds.length,
                returningCustomers,
                returningRate: totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100).toFixed(1) : 0,
                averageBookingsPerCustomer: totalCustomers > 0 ? (uniqueBookingAppointments.length / totalCustomers).toFixed(1) : 0,
                loyaltyTierDistribution: tierDistribution
            }
        });

    } catch (error) {
        console.error('Get customer stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer statistics',
            error: error.message
        });
    }
};

/**
 * Get unified customer history (appointments + orders)
 */
exports.getCustomerHistory = async (req, res) => {
    try {
        createRuntimeTraceLogger(req, res, 'GET /api/v1/tenant/customers/:id/history');
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { type, startDate, endDate, limit = 50 } = req.query;

        // Get appointments
        const appointmentWhere = { platformUserId: id };
        const appointmentStart = parseDateValue(startDate, false);
        const appointmentEnd = parseDateValue(endDate, true);
        if (appointmentStart) appointmentWhere.startTime = { [Op.gte]: appointmentStart };
        if (appointmentEnd) appointmentWhere.startTime = { ...appointmentWhere.startTime, [Op.lte]: appointmentEnd };

        const appointments = await db.Appointment.findAll({
            where: appointmentWhere,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true,
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image']
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo']
                }
            ],
            attributes: ['id', 'startTime', 'endTime', 'bookingNumber', 'bookingSessionId', 'bookingReference', 'bookingItemIndex', 'status', 'price', 'paymentStatus', 'paymentMethod', 'depositAmount', 'remainderAmount', 'totalPaid', 'notes', 'serviceVariantName', 'serviceVariantDuration'],
            order: [['startTime', 'DESC']],
            limit: type === 'order' ? 0 : parseInt(limit)
        });
        const bookingSessions = aggregateAppointmentsByBookingSession(appointments);

        // Get orders
        const orderWhere = { 
            platformUserId: id,
            tenantId 
        };
        const orderStart = parseDateValue(startDate, false);
        const orderEnd = parseDateValue(endDate, true);
        if (orderStart) orderWhere.createdAt = { [Op.gte]: orderStart };
        if (orderEnd) orderWhere.createdAt = { ...orderWhere.createdAt, [Op.lte]: orderEnd };

        const orders = await db.Order.findAll({
            where: orderWhere,
            include: [
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'image', 'category']
                        }
                    ],
                    attributes: ['id', 'quantity', 'unitPrice', 'totalPrice', 'productName', 'productNameAr', 'productImage']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: type === 'appointment' ? 0 : parseInt(limit)
        });

        const walletTransactions = await db.WalletLedgerEntry.findAll({
            where: {
                platformUserId: id
            },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        // Combine and sort by date
        const history = [];

        bookingSessions.forEach((session) => {
            history.push({
                type: 'booking_session',
                kind: 'booking_session',
                id: session.id,
                bookingSessionId: session.bookingSessionId || null,
                bookingReference: session.bookingReference || null,
                date: session.date || session.startTime,
                status: session.status,
                paymentStatus: session.paymentStatus,
                normalizedPaymentStatus: session.normalizedPaymentStatus,
                paidAmount: session.paidAmount,
                outstandingAmount: session.outstandingAmount,
                paymentEvidenceSource: 'appointment',
                amount: parseFloat(session.price || session.totalAmount || 0),
                title: session.serviceNameEn || session.serviceNameAr || session.service?.name_en || session.service?.name_ar || 'Booking session',
                subtitle: session.assignedStaffName || session.staff?.name || '',
                serviceNameEn: session.serviceNameEn || session.service?.name_en || '',
                serviceNameAr: session.serviceNameAr || session.service?.name_ar || '',
                assignedStaffName: session.assignedStaffName || session.staff?.name || '',
                serviceLines: session.serviceLines || [],
                appointments: session.appointments || [],
                details: {
                    service: session.service || null,
                    services: session.details?.services || session.serviceLines?.map((line) => line.service).filter(Boolean) || [],
                    staff: session.staff || null,
                    staffName: session.assignedStaffName || session.staff?.name || '',
                    duration: session.duration,
                    startTime: session.startTime,
                    endTime: session.endTime,
                    branch: session.details?.branch || null,
                    bookingSessionId: session.bookingSessionId || null,
                    bookingReference: session.bookingReference || null,
                    bookingItemCount: session.sessionAppointmentCount || session.appointments?.length || 0,
                    notes: session.details?.notes || session.notes || ''
                }
            });
        });

        orders.forEach(order => {
            const items = order.items || [];
            history.push({
                type: 'order',
                id: order.id,
                date: order.createdAt,
                status: order.status,
                paymentStatus: order.paymentStatus,
                amount: parseFloat(order.totalAmount || 0),
                details: {
                    orderNumber: order.orderNumber,
                    items: items.map(item => ({
                        product: item.product || { name_en: item.productName, name_ar: item.productNameAr },
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice
                    })),
                    deliveryType: order.deliveryType,
                    shippingAddress: order.shippingAddress,
                    trackingNumber: order.trackingNumber
                }
            });
        });

        walletTransactions.forEach((entry) => {
            history.push({
                type: 'wallet',
                id: entry.id,
                date: entry.createdAt,
                status: entry.direction === 'credit' ? 'completed' : 'completed',
                paymentStatus: entry.direction === 'credit' ? 'credited' : 'debited',
                amount: parseFloat(entry.amount || 0),
                details: {
                    direction: entry.direction,
                    referenceType: entry.referenceType || null,
                    referenceId: entry.referenceId || null,
                    metadata: entry.metadata || {}
                }
            });
        });

        // Sort by date (most recent first)
        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Calculate summary
        const completedAppointments = bookingSessions.filter(a => a.status === 'completed');
        const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
        const appointmentSpending = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || a.totalAmount || 0), 0);
        const orderSpending = completedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);

        res.json({
            success: true,
            data: {
                history: toSerializableValue(history.slice(0, parseInt(limit))),
                walletTransactions: toSerializableValue(walletTransactions.map((entry) => ({
                    id: entry.id,
                    source: 'wallet_ledger',
                    type: entry.type,
                    direction: entry.direction,
                    amount: parseFloat(entry.amount || 0),
                    currency: entry.currency || 'SAR',
                    balanceBefore: parseFloat(entry.balanceBefore || 0),
                    balanceAfter: parseFloat(entry.balanceAfter || 0),
                    referenceType: entry.referenceType || null,
                    referenceId: entry.referenceId || null,
                    metadata: entry.metadata || {},
                    createdAt: entry.createdAt
                }))),
                summary: {
                    totalInteractions: history.length,
                    totalAppointments: bookingSessions.length,
                    totalOrders: orders.length,
                    totalWalletTransactions: walletTransactions.length,
                    totalSpent: appointmentSpending + orderSpending,
                    appointmentSpending: appointmentSpending,
                    orderSpending: orderSpending,
                    firstInteraction: history.length > 0 ? history[history.length - 1].date : null,
                    lastInteraction: history.length > 0 ? history[0].date : null
                }
            }
        });

    } catch (error) {
        logRuntimeTraceException('GET /api/v1/tenant/customers/:id/history', error, {
            statusCode: 500
        });
        console.error('Get customer history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer history',
            error: error.message
        });
    }
};

/**
 * Top up a customer's wallet from the tenant workspace.
 */
exports.topUpCustomerWallet = async (req, res) => {
    const transaction = await db.sequelize.transaction();

    try {
        const tenantId = req.tenant?.id || req.tenantId;
        const actorUserId = req.userId || req.user?.id || null;
        const { id } = req.params;
        const amount = parseFloat(req.body?.amount);
        const appointmentId = req.body?.appointmentId || null;
        const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

        if (!id) {
            await transaction.rollback().catch(() => undefined);
            return res.status(400).json({
                success: false,
                message: 'Customer id is required'
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            await transaction.rollback().catch(() => undefined);
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }

        const customer = await db.PlatformUser.findByPk(id, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'walletBalance']
        });

        if (!customer) {
            await transaction.rollback().catch(() => undefined);
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const walletResult = await walletService.creditWallet({
            platformUserId: id,
            amount,
            type: 'topup',
            referenceType: 'tenant_customer_wallet_topup',
            referenceId: appointmentId || null,
            metadata: {
                source: 'tenant_appointment_drawer',
                tenantId: tenantId || null,
                actorUserId,
                appointmentId,
                note: note || null
            },
            transaction
        });

        const [walletTransaction, refreshedCustomer] = await Promise.all([
            db.Transaction.create({
                platformUserId: id,
                tenantId: tenantId || null,
                appointmentId: appointmentId || null,
                amount,
                currency: 'SAR',
                type: 'wallet_topup',
                status: 'completed',
                metadata: {
                    source: 'tenant_customer_wallet_topup',
                    actorUserId,
                    appointmentId,
                    note: note || null,
                    walletLedgerEntryId: walletResult.ledgerEntry.id
                }
            }, { transaction }),
            db.PlatformUser.findByPk(id, {
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'walletBalance'],
                transaction
            })
        ]);

        await transaction.commit();

        logTenantAppointmentAudit('customer_wallet_topup', {
            tenantId,
            actorUserId,
            customerId: id,
            appointmentId,
            amount
        });

        res.json({
            success: true,
            message: 'Customer wallet topped up',
            transaction: walletTransaction,
            walletLedgerEntry: walletResult.ledgerEntry,
            walletBalance: Number(refreshedCustomer?.walletBalance ?? walletResult.balanceAfter ?? 0),
            customer: refreshedCustomer
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback().catch(() => undefined);
        }
        console.error('Top up customer wallet error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to top up customer wallet'
        });
    }
};

/**
 * Get customer financial transactions (online + at-center ledger)
 */
exports.getCustomerTransactions = async (req, res) => {
    try {
        createRuntimeTraceLogger(req, res, 'GET /api/v1/tenant/customers/:id/transactions');
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { startDate, endDate, limit = 50 } = req.query;
        const localeSource = `${req.query.locale || req.headers['x-locale'] || req.headers['accept-language'] || 'en'}`.toLowerCase();
        const locale = localeSource.startsWith('ar') ? 'ar' : 'en';
        const safeLimit = Math.max(parseInt(limit, 10) || 50, 1);
        const requestId = `cust_tx_${Date.now()}_${id}`;

        const appointmentStart = parseDateValue(startDate, false);
        const appointmentEnd = parseDateValue(endDate, true);

        const appointmentWhere = { platformUserId: id };
        if (appointmentStart || appointmentEnd) {
            appointmentWhere.startTime = {};
            if (appointmentStart) appointmentWhere.startTime[Op.gte] = appointmentStart;
            if (appointmentEnd) appointmentWhere.startTime[Op.lte] = appointmentEnd;
        }

        const orderWhere = { platformUserId: id, tenantId };
        if (appointmentStart || appointmentEnd) {
            orderWhere.createdAt = {};
            if (appointmentStart) orderWhere.createdAt[Op.gte] = appointmentStart;
            if (appointmentEnd) orderWhere.createdAt[Op.lte] = appointmentEnd;
        }

        const [appointments, orders] = await Promise.all([
            db.Appointment.findAll({
                where: appointmentWhere,
                include: [
                    {
                        model: db.Service,
                        as: 'service',
                        where: { tenantId },
                        required: true,
                        attributes: ['id', 'name_en', 'name_ar', 'duration']
                    },
                    {
                        model: db.Staff,
                        as: 'staff',
                        attributes: ['id', 'name', 'photo']
                    }
                ],
                attributes: ['id', 'bookingNumber', 'bookingSessionId', 'bookingReference', 'bookingItemIndex', 'paymentMethod', 'startTime', 'endTime', 'price', 'status', 'paymentStatus', 'depositAmount', 'remainderAmount', 'totalPaid', 'notes'],
                order: [['startTime', 'DESC']]
            }),
            db.Order.findAll({
                where: orderWhere,
                include: [
                    {
                        model: db.OrderItem,
                        as: 'items',
                        include: [
                            {
                                model: db.Product,
                                as: 'product',
                                attributes: ['id', 'name_en', 'name_ar', 'image', 'category']
                            }
                        ],
                        attributes: ['id', 'quantity', 'unitPrice', 'totalPrice', 'productName', 'productNameAr', 'productImage']
                    }
                ],
                attributes: ['id', 'orderNumber', 'paymentMethod', 'paymentStatus', 'status', 'totalAmount', 'createdAt', 'deliveryType', 'shippingAddress', 'trackingNumber', 'estimatedDeliveryDate'],
                order: [['createdAt', 'DESC']]
            })
        ]);
        logTenantAppointmentAudit('customer_transactions_source_counts', {
            requestId,
            tenantId,
            customerId: id,
            appointmentsCount: appointments.length,
            ordersCount: orders.length,
            startDate: startDate || null,
            endDate: endDate || null
        });

        const bookingSessions = aggregateAppointmentsByBookingSession(appointments);
        const bookingReferenceValues = [...new Set(bookingSessions.map((session) => session.bookingReference).filter(Boolean))];
        const bookingSessionReferenceMatches = bookingReferenceValues.length > 0
            ? await db.BookingSession.findAll({
                where: {
                    tenantId,
                    platformUserId: id,
                    bookingReference: { [Op.in]: bookingReferenceValues }
                },
                attributes: ['id', 'bookingReference']
            })
            : [];

        const [gatewayTransactions, ledgerTransactions] = await Promise.all([
            db.Transaction.findAll({
                where: {
                    platformUserId: id,
                    tenantId,
                    ...(appointmentStart || appointmentEnd ? {
                        createdAt: {
                            ...(appointmentStart ? { [Op.gte]: appointmentStart } : {}),
                            ...(appointmentEnd ? { [Op.lte]: appointmentEnd } : {})
                        }
                    } : {})
                },
                include: [
                    {
                        model: db.Appointment,
                        as: 'appointment',
                        attributes: ['id', 'bookingNumber', 'startTime', 'endTime', 'paymentStatus', 'status', 'paymentMethod', 'price', 'depositAmount', 'remainderAmount', 'totalPaid'],
                        required: false,
                        include: [
                            {
                                model: db.Service,
                                as: 'service',
                                attributes: ['id', 'name_en', 'name_ar', 'duration'],
                                required: false
                            },
                            {
                                model: db.Staff,
                                as: 'staff',
                                attributes: ['id', 'name', 'photo'],
                                required: false
                            }
                        ]
                    },
                    {
                        model: db.BookingSession,
                        as: 'bookingSession',
                        attributes: ['id', 'bookingReference', 'status', 'paymentMethod', 'itemCount', 'totalAmount', 'createdAt'],
                        required: false,
                        include: [
                            {
                                model: db.Appointment,
                                as: 'appointments',
                                attributes: ['id', 'bookingNumber', 'startTime', 'paymentStatus', 'status', 'paymentMethod', 'price'],
                                required: false,
                                include: [
                                    {
                                        model: db.Service,
                                        as: 'service',
                                        attributes: ['id', 'name_en', 'name_ar', 'duration'],
                                        required: false
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        model: db.Order,
                        as: 'order',
                        attributes: ['id', 'orderNumber', 'paymentStatus', 'status', 'paymentMethod', 'totalAmount', 'createdAt', 'deliveryType', 'shippingAddress', 'trackingNumber', 'estimatedDeliveryDate'],
                        required: false,
                        include: [
                            {
                                model: db.OrderItem,
                                as: 'items',
                                include: [
                                    {
                                        model: db.Product,
                                        as: 'product',
                                        attributes: ['id', 'name_en', 'name_ar', 'image', 'category'],
                                        required: false
                                    }
                                ],
                                required: false
                            }
                        ]
                    },
                    {
                        model: db.PaymentMethod,
                        as: 'paymentMethod',
                        attributes: ['id', 'type', 'cardBrand', 'cardLast4'],
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']]
            }),
            []
        ]);
        const walletLedgerTransactions = await db.WalletLedgerEntry.findAll({
            where: {
                platformUserId: id,
                ...(appointmentStart || appointmentEnd ? {
                    createdAt: {
                        ...(appointmentStart ? { [Op.gte]: appointmentStart } : {}),
                        ...(appointmentEnd ? { [Op.lte]: appointmentEnd } : {})
                    }
                } : {})
            },
            order: [['createdAt', 'DESC']]
        });
        logTenantAppointmentAudit('customer_transactions_payment_records_loaded', {
            requestId,
            tenantId,
            customerId: id,
            gatewayTransactionsCount: gatewayTransactions.length,
            ledgerTransactionsCount: ledgerTransactions.length,
            walletLedgerTransactionsCount: walletLedgerTransactions.length
        });

        const transactions = [];
        const transactionGroups = new Map();
        const seenRecords = new Set();
        const appointmentSessionKeyMap = new Map();
        const appointmentByIdMap = new Map(appointments.map((appointment) => [appointment.id, appointment]));
        const bookingSessionAggregateMap = new Map(bookingSessions.map((session) => [getBookingSessionAggregationKey(session), session]));
        const bookingSessionTransactionKeys = new Set();

        bookingSessions.forEach((session) => {
            const sessionKey = getBookingSessionAggregationKey(session);
            (session.appointments || []).forEach((appointment) => {
                if (appointment?.id && sessionKey) {
                    appointmentSessionKeyMap.set(appointment.id, sessionKey);
                }
            });
        });

        const resolveTransactionAggregationKey = (record) => {
            const bookingSessionId = record.bookingSession?.id
                || record.bookingSessionId
                || record.appointment?.bookingSessionId
                || null;
            const bookingReference = record.bookingSession?.bookingReference
                || record.bookingReference
                || record.appointment?.bookingReference
                || null;

            if (bookingSessionId) {
                return `booking_session:${bookingSessionId}`;
            }

            if (bookingReference) {
                return `booking_reference:${bookingReference}`;
            }

            if (record.appointment?.id) {
                const mappedSessionKey = appointmentSessionKeyMap.get(record.appointment.id);
                if (mappedSessionKey) {
                    return `booking_session:${mappedSessionKey}`;
                }
                return `appointment:${record.appointment.id}`;
            }

            if (record.order?.id) {
                return `order:${record.order.id}`;
            }

            const referenceType = `${record.referenceType || ''}`.toLowerCase();
            if (referenceType === 'appointment' && record.referenceId) {
                const mappedSessionKey = appointmentSessionKeyMap.get(record.referenceId);
                if (mappedSessionKey) {
                    return `booking_session:${mappedSessionKey}`;
                }
                return `appointment:${record.referenceId}`;
            }

            if (referenceType === 'order' && record.referenceId) {
                return `order:${record.referenceId}`;
            }

            if (referenceType === 'booking_session' && record.referenceId) {
                return `booking_session:${record.referenceId}`;
            }

            if (record.referenceType && record.referenceId) {
                return `${record.referenceType}:${record.referenceId}`;
            }

            return `${record.source || 'transaction'}:${record.id}`;
        };

        const registerTransactionRecord = (record, sourcePriority = 0) => {
            if (!record) {
                return;
            }

            const groupingKey = resolveTransactionAggregationKey(record);
            const fingerprint = `${groupingKey}:${record.type || ''}:${record.amount || 0}:${record.status || ''}:${record.paymentMethod || ''}:${record.transactionRef || ''}:${record.processedAt || ''}`;
            if (seenRecords.has(fingerprint)) {
                return;
            }

            seenRecords.add(fingerprint);
            const existingGroup = transactionGroups.get(groupingKey);
            const wrappedRecord = {
                ...record,
                groupingKey,
                sourcePriority
            };

            if (!existingGroup) {
                transactionGroups.set(groupingKey, {
                    primary: wrappedRecord,
                    relatedRecords: [wrappedRecord],
                    sourcePriority
                });
            } else {
                existingGroup.relatedRecords.push(wrappedRecord);
                if (
                    sourcePriority > existingGroup.sourcePriority
                    || (
                        sourcePriority === existingGroup.sourcePriority
                        && getAppointmentComparableTimestamp(wrappedRecord) > getAppointmentComparableTimestamp(existingGroup.primary)
                    )
                ) {
                    existingGroup.primary = wrappedRecord;
                    existingGroup.sourcePriority = sourcePriority;
                }
            }

            if (groupingKey.startsWith('booking_session:') || groupingKey.startsWith('booking_reference:')) {
                bookingSessionTransactionKeys.add(groupingKey);
                if (wrappedRecord.bookingSession?.id) {
                    bookingSessionTransactionKeys.add(`booking_session:${wrappedRecord.bookingSession.id}`);
                }
                if (wrappedRecord.bookingSession?.bookingReference) {
                    bookingSessionTransactionKeys.add(`booking_reference:${wrappedRecord.bookingSession.bookingReference}`);
                }
            }
        };

        gatewayTransactions.forEach((transaction) => {
            const entityType = transaction.bookingSession ? 'booking_session' : (transaction.appointment ? 'appointment' : 'order');
            const entityId = transaction.bookingSession?.id || transaction.appointment?.id || transaction.order?.id || transaction.id;
            const key = `gateway:${entityType}:${entityId}:${transaction.type}:${transaction.amount}:${transaction.status}`;

            if (seenRecords.has(key)) {
                return;
            }

            seenRecords.add(key);
            registerTransactionRecord(mapCustomerTransactionRecord({
                id: transaction.id,
                source: 'transaction',
                kind: entityType,
                entityId,
                appointment: transaction.appointment,
                bookingSession: transaction.bookingSession,
                order: transaction.order,
                reference: transaction.appointment?.bookingNumber || transaction.bookingSession?.bookingReference || transaction.order?.orderNumber || transaction.transactionRef || transaction.id,
                amount: transaction.amount,
                currency: transaction.currency,
                type: transaction.type,
                status: transaction.status,
                paymentMethod: transaction.paymentMethod || transaction.appointment?.paymentMethod || transaction.order?.paymentMethod || null,
                transactionRef: transaction.stripePaymentIntentId || transaction.stripeChargeId || transaction.transactionRef || null,
                notes: transaction.failureReason || transaction.notes || null,
                processedAt: transaction.createdAt,
                processor: transaction.paymentMethod?.user || null,
                detailPath: transaction.bookingSession?.appointments?.[0]?.id
                    ? `/dashboard/appointments/${transaction.bookingSession.appointments[0].id}`
                    : transaction.appointment
                    ? `/dashboard/appointments/${transaction.appointment.id}`
                    : transaction.order?.id
                        ? `/dashboard/orders/${transaction.order.id}`
                        : null
            }, locale), 3);
        });

        ledgerTransactions.forEach((transaction) => {
            const entityType = transaction.bookingSession ? 'booking_session' : (transaction.appointment ? 'appointment' : 'order');
            const entityId = transaction.bookingSession?.id || transaction.appointment?.id || transaction.order?.id || transaction.id;
            const key = `ledger:${entityType}:${entityId}:${transaction.type}:${transaction.amount}:${transaction.status}`;

            if (seenRecords.has(key)) {
                return;
            }

            seenRecords.add(key);
            registerTransactionRecord(mapCustomerTransactionRecord({
                id: transaction.id,
                source: 'ledger',
                kind: entityType,
                entityId,
                appointment: transaction.appointment,
                bookingSession: transaction.bookingSession,
                order: transaction.order,
                reference: transaction.appointment?.bookingNumber || transaction.bookingSession?.bookingReference || transaction.order?.orderNumber || transaction.transactionRef || transaction.id,
                amount: transaction.amount,
                currency: transaction.currency,
                type: transaction.type,
                status: transaction.status,
                paymentMethod: transaction.paymentMethod || transaction.appointment?.paymentMethod || transaction.order?.paymentMethod || null,
                transactionRef: transaction.transactionRef || null,
                notes: transaction.notes || null,
                processedAt: transaction.processedAt,
                processor: transaction.processor,
                detailPath: transaction.bookingSession?.appointments?.[0]?.id
                    ? `/dashboard/appointments/${transaction.bookingSession.appointments[0].id}`
                    : transaction.appointment
                    ? `/dashboard/appointments/${transaction.appointment.id}`
                    : transaction.order?.id
                        ? `/dashboard/orders/${transaction.order.id}`
                        : null
            }, locale), 2);
        });

        walletLedgerTransactions.forEach((transaction) => {
            const key = `wallet:${transaction.referenceType || 'wallet'}:${transaction.referenceId || transaction.id}:${transaction.type}:${transaction.amount}:${transaction.direction}`;

            if (seenRecords.has(key)) {
                return;
            }

            seenRecords.add(key);
            const mappedWalletRecord = mapWalletLedgerRecord(transaction, locale);
            const relatedAppointment = `${transaction.referenceType || ''}`.toLowerCase() === 'appointment' && transaction.referenceId
                ? appointmentByIdMap.get(transaction.referenceId) || null
                : null;
            const relatedSessionKey = relatedAppointment ? appointmentSessionKeyMap.get(relatedAppointment.id) : null;
            const relatedSession = relatedSessionKey ? bookingSessionAggregateMap.get(relatedSessionKey) || null : null;

            registerTransactionRecord({
                ...mappedWalletRecord,
                appointment: relatedAppointment || mappedWalletRecord.appointment || null,
                bookingSession: relatedSession ? {
                    ...relatedSession.bookingSession,
                    appointments: relatedSession.appointments || []
                } : mappedWalletRecord.bookingSession || null
            }, 1);
        });

        bookingSessions.forEach((session) => {
            const sessionKey = getBookingSessionAggregationKey(session);
            const hasDirectTransaction = bookingSessionTransactionKeys.has(`booking_session:${session.bookingSessionId || session.id}`)
                || bookingSessionTransactionKeys.has(`booking_reference:${session.bookingReference || ''}`);
            const normalizedPaymentStatus = `${session.paymentStatus || ''}`.toLowerCase();
            const isPaidSession = ['deposit_paid', 'fully_paid', 'paid', 'refunded', 'partially_refunded'].includes(normalizedPaymentStatus);

            if (hasDirectTransaction || !isPaidSession) {
                return;
            }

            const paidAmount = Number(
                session.totalPaid ??
                session.paidAmount ??
                (normalizedPaymentStatus === 'deposit_paid' ? session.details?.paidAmount : null) ??
                session.price ??
                session.totalAmount ??
                0
            );

            if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
                return;
            }

            const syntheticStatus = normalizedPaymentStatus === 'refunded' || normalizedPaymentStatus === 'partially_refunded'
                ? normalizedPaymentStatus
                : 'completed';
            const syntheticType = normalizedPaymentStatus === 'refunded' || normalizedPaymentStatus === 'partially_refunded'
                ? 'refund'
                : 'payment';

            registerTransactionRecord(mapCustomerTransactionRecord({
                id: `appointment-derived-${session.id || sessionKey}`,
                source: 'appointment',
                kind: 'booking_session',
                entityId: session.id || sessionKey,
                appointment: session.appointments?.[0] || null,
                bookingSession: session.bookingSession || {
                    id: session.bookingSessionId || session.id || null,
                    bookingReference: session.bookingReference || null,
                    appointments: session.appointments || []
                },
                reference: session.bookingReference || session.bookingNumber || session.id || sessionKey,
                amount: paidAmount,
                currency: 'SAR',
                type: syntheticType,
                status: syntheticStatus,
                paymentMethod: session.paymentMethod || session.appointments?.[0]?.paymentMethod || null,
                transactionRef: session.bookingReference || session.bookingNumber || null,
                notes: locale === 'ar'
                    ? 'مستخرج من حالة الدفع الخاصة بالحجز'
                    : 'Derived from booking session payment status',
                processedAt: session.endTime || session.startTime || session.date,
                processor: null,
                detailPath: session.detailPath || (session.appointments?.[0]?.id ? `/dashboard/appointments/${session.appointments[0].id}` : null)
            }, locale), 0);
        });

        transactionGroups.forEach((group, groupingKey) => {
            const primary = group.primary || {};
            const relatedRecords = group.relatedRecords || [];
            const bookingSession = primary.bookingSession || relatedRecords.find((record) => record.bookingSession)?.bookingSession || null;
            const bookingSessionAppointments = Array.isArray(bookingSession?.appointments)
                ? bookingSession.appointments
                : [];
            const serviceLines = bookingSessionAppointments.length > 0
                ? bookingSessionAppointments.map((appointment, index) => buildAppointmentServiceLine(appointment, index, bookingSession?.id || primary.bookingSessionId || null, bookingSession?.bookingReference || primary.bookingReference || null))
                : [];
            const invoiceLines = serviceLines.map((line) => ({
                ...line,
                lineType: 'service',
                subtotal: Number(line.price || 0)
            }));
            const paymentLines = relatedRecords.map((record) => ({
                id: record.id,
                source: record.source,
                type: record.type,
                status: record.status,
                amount: record.amount,
                currency: record.currency,
                paymentMethod: record.paymentMethod,
                paymentMethodLabel: record.paymentMethodLabel,
                processedAt: record.processedAt,
                transactionRef: record.transactionRef,
                notes: record.notes
            }));

            transactions.push({
                ...primary,
                groupingKey,
                bookingSessionId: bookingSession?.id || primary.bookingSessionId || null,
                bookingReference: bookingSession?.bookingReference || primary.bookingReference || null,
                bookingSession: bookingSession
                    ? {
                        ...bookingSession,
                        appointments: bookingSessionAppointments
                    }
                    : primary.bookingSession || null,
                appointments: bookingSessionAppointments,
                serviceLines,
                invoiceLines,
                paymentLines,
                relatedRecords,
                relatedRecordCount: relatedRecords.length,
                paymentMethodLabel: relatedRecords.find((record) => record.paymentMethodLabel)?.paymentMethodLabel || primary.paymentMethodLabel,
                detailPath: primary.detailPath
                    || (bookingSessionAppointments[0]?.id ? `/dashboard/appointments/${bookingSessionAppointments[0].id}` : null)
                    || primary.detailPath
            });
        });

        transactions.sort((a, b) => new Date(b.processedAt || b.date || 0).getTime() - new Date(a.processedAt || a.date || 0).getTime());

        const pagedTransactions = transactions.slice(0, safeLimit);
        const completedTotal = pagedTransactions
            .filter((item) => item.status === 'completed' || item.status === 'paid')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const refundedTotal = pagedTransactions
            .filter((item) => item.status === 'refunded' || item.type === 'refund')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const appointmentStatusCounts = bookingSessions.reduce((acc, appointment) => {
            const key = `${appointment.paymentStatus || 'unknown'}`.toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        logTenantAppointmentAudit('customer_transactions_composed', {
            requestId,
            tenantId,
            customerId: id,
            totalComposedTransactions: transactions.length,
            returnedTransactions: pagedTransactions.length,
            appointmentStatusCounts,
            completedTotal: parseFloat(completedTotal.toFixed(2)),
            refundedTotal: parseFloat(refundedTotal.toFixed(2))
        });

        res.json({
            success: true,
            data: {
                transactions: toSerializableValue(pagedTransactions),
                summary: {
                    totalTransactions: transactions.length,
                    completedTotal: parseFloat(completedTotal.toFixed(2)),
                    refundedTotal: parseFloat(refundedTotal.toFixed(2)),
                    netTotal: parseFloat((completedTotal - refundedTotal).toFixed(2)),
                    appointmentCount: pagedTransactions.filter((item) => ['appointment', 'booking_session'].includes(item.entityType)).length,
                    orderCount: pagedTransactions.filter((item) => item.entityType === 'order').length,
                    walletCount: pagedTransactions.filter((item) => item.entityType === 'wallet').length
                }
            }
        });
    } catch (error) {
        logRuntimeTraceException('GET /api/v1/tenant/customers/:id/transactions', error, {
            statusCode: 500
        });
        console.error('Get customer transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer transactions',
            error: error.message
        });
    }
};

/**
 * Export customers to CSV
 */
exports.exportCustomers = async (req, res) => {
    try {
        const tenantId = req.tenant.id;

        // Get all customers with their data
        const customers = await db.PlatformUser.findAll({
            include: [
                {
                    model: db.Appointment,
                    as: 'appointments',
                    required: true,
                    include: [
                        {
                            model: db.Service,
                            as: 'service',
                            where: { tenantId },
                            required: true,
                            attributes: ['id']
                        }
                    ],
                    attributes: ['id', 'status', 'price', 'startTime']
                }
            ],
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'gender', 'createdAt']
        });

        // Get insights
        const customerIds = customers.map(c => c.id);
        const insights = await db.CustomerInsight.findAll({
            where: {
                platformUserId: { [Op.in]: customerIds },
                tenantId
            }
        });

        const insightsMap = {};
        insights.forEach(i => {
            insightsMap[i.platformUserId] = i;
        });

        // Build CSV
        const csvRows = [
            ['Name', 'Email', 'Phone', 'Gender', 'Total Bookings', 'Total Spent', 'Loyalty Tier', 'First Visit', 'Last Visit', 'Tags'].join(',')
        ];

        customers.forEach(customer => {
            const insight = insightsMap[customer.id];
            const appointments = customer.appointments || [];
            const completedAppointments = appointments.filter(a => a.status === 'completed');
            const totalSpent = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);

            csvRows.push([
                `"${customer.firstName} ${customer.lastName}"`,
                customer.email,
                customer.phone,
                customer.gender || '',
                appointments.length,
                totalSpent.toFixed(2),
                insight?.loyaltyTier || 'bronze',
                appointments.length > 0 ? new Date(appointments[appointments.length - 1].startTime).toISOString().split('T')[0] : '',
                appointments.length > 0 ? new Date(appointments[0].startTime).toISOString().split('T')[0] : '',
                `"${(insight?.tags || []).join(', ')}"`
            ].join(','));
        });

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
        res.send(csv);

    } catch (error) {
        console.error('Export customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export customers',
            error: error.message
        });
    }
};

