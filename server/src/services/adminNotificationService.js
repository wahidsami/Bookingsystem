const db = require('../models');

const NOTIFICATION_TYPES = {
    TENANT_REGISTERED: 'tenant_registered',
    TENANT_APPROVED_INVOICE_CREATED: 'tenant_approved_invoice_created',
    TENANT_APPROVED_FREE_ACTIVE: 'tenant_approved_free_active',
    TENANT_BILL_PAID: 'tenant_bill_paid',
    TENANT_BILL_EXPIRED: 'tenant_bill_expired',
    TENANT_SUBSCRIPTION_UPGRADED: 'tenant_subscription_upgraded',
    TENANT_SUBSCRIPTION_RENEWED: 'tenant_subscription_renewed'
};

const SEVERITY_BY_TYPE = {
    [NOTIFICATION_TYPES.TENANT_REGISTERED]: 'info',
    [NOTIFICATION_TYPES.TENANT_APPROVED_INVOICE_CREATED]: 'warning',
    [NOTIFICATION_TYPES.TENANT_APPROVED_FREE_ACTIVE]: 'success',
    [NOTIFICATION_TYPES.TENANT_BILL_PAID]: 'success',
    [NOTIFICATION_TYPES.TENANT_BILL_EXPIRED]: 'danger',
    [NOTIFICATION_TYPES.TENANT_SUBSCRIPTION_UPGRADED]: 'info',
    [NOTIFICATION_TYPES.TENANT_SUBSCRIPTION_RENEWED]: 'info'
};

const getTenantName = (tenant = {}) =>
    tenant.name_en || tenant.name_ar || tenant.name || tenant.businessName || 'Tenant';

const createAdminNotification = async ({
    type,
    entityType = 'tenant',
    entityId = null,
    actionUrl = null,
    dedupeKey,
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    metadata = {},
    transaction = null
}) => {
    if (!type || !dedupeKey || !titleAr || !titleEn || !messageAr || !messageEn) {
        return null;
    }

    try {
        const [notification] = await db.AdminNotification.findOrCreate({
            where: { dedupeKey },
            defaults: {
                type,
                severity: SEVERITY_BY_TYPE[type] || 'info',
                titleAr,
                titleEn,
                messageAr,
                messageEn,
                entityType,
                entityId,
                actionUrl,
                metadata,
                isRead: false
            },
            transaction
        });

        return notification;
    } catch (error) {
        console.error('[AdminNotification] Failed to create notification:', {
            type,
            entityType,
            entityId,
            dedupeKey,
            error: error.message
        });
        return null;
    }
};

const notifyTenantRegistered = (tenant, transaction = null) => {
    if (!tenant?.id) return null;

    return createAdminNotification({
        type: NOTIFICATION_TYPES.TENANT_REGISTERED,
        entityType: 'tenant',
        entityId: tenant.id,
        actionUrl: `/dashboard/clients/${tenant.id}`,
        dedupeKey: `tenant_registered:${tenant.id}`,
        titleAr: 'تسجيل مركز جديد',
        titleEn: 'New tenant registration',
        messageAr: `تم تسجيل مركز جديد: ${getTenantName(tenant)} وينتظر المراجعة.`,
        messageEn: `A new tenant registered: ${getTenantName(tenant)} is awaiting review.`,
        metadata: {
            tenantId: tenant.id,
            tenantName: getTenantName(tenant),
            status: tenant.status
        },
        transaction
    });
};

const notifyTenantApprovedInvoiceCreated = ({ tenant, bill, packageName, billingCycle }, transaction = null) => {
    if (!tenant?.id || !bill?.id) return null;

    return createAdminNotification({
        type: NOTIFICATION_TYPES.TENANT_APPROVED_INVOICE_CREATED,
        entityType: 'tenant',
        entityId: tenant.id,
        actionUrl: `/dashboard/clients/${tenant.id}`,
        dedupeKey: `tenant_approved_invoice_created:${bill.id}`,
        titleAr: 'تم إصدار فاتورة اشتراك',
        titleEn: 'Subscription invoice issued',
        messageAr: `تم اعتماد ${getTenantName(tenant)} وإصدار الفاتورة ${bill.billNumber} لباقة ${packageName || '—'} (${billingCycle || '—'}).`,
        messageEn: `${getTenantName(tenant)} was approved and invoice ${bill.billNumber} was issued for ${packageName || '—'} (${billingCycle || '—'}).`,
        metadata: {
            tenantId: tenant.id,
            billId: bill.id,
            billNumber: bill.billNumber,
            packageName,
            billingCycle,
            status: bill.status
        },
        transaction
    });
};

const notifyTenantApprovedFreeActive = ({ tenant, packageName, billingCycle }, transaction = null) => {
    if (!tenant?.id) return null;

    return createAdminNotification({
        type: NOTIFICATION_TYPES.TENANT_APPROVED_FREE_ACTIVE,
        entityType: 'tenant',
        entityId: tenant.id,
        actionUrl: `/dashboard/clients/${tenant.id}`,
        dedupeKey: `tenant_approved_free_active:${tenant.id}`,
        titleAr: 'تم تفعيل مركز بباقة مجانية',
        titleEn: 'Free tenant activated',
        messageAr: `تم اعتماد وتفعيل ${getTenantName(tenant)} مباشرة على باقة ${packageName || 'مجانية'} (${billingCycle || '—'}).`,
        messageEn: `${getTenantName(tenant)} was approved and activated on ${packageName || 'a free package'} (${billingCycle || '—'}).`,
        metadata: {
            tenantId: tenant.id,
            packageName,
            billingCycle,
            status: 'active'
        },
        transaction
    });
};

const notifyTenantBillPaid = ({ tenant, bill, packageName, billingCycle }, transaction = null) => {
    const tenantId = tenant?.id || bill?.tenantId;
    if (!tenantId || !bill?.id) return null;

    return createAdminNotification({
        type: NOTIFICATION_TYPES.TENANT_BILL_PAID,
        entityType: 'tenant',
        entityId: tenantId,
        actionUrl: `/dashboard/clients/${tenantId}`,
        dedupeKey: `tenant_bill_paid:${bill.id}`,
        titleAr: 'تم سداد فاتورة اشتراك',
        titleEn: 'Tenant invoice paid',
        messageAr: `تم استلام دفعة من ${getTenantName(tenant)} للفاتورة ${bill.billNumber} الخاصة بباقة ${packageName || '—'} (${billingCycle || '—'}).`,
        messageEn: `Payment received from ${getTenantName(tenant)} for invoice ${bill.billNumber} on ${packageName || '—'} (${billingCycle || '—'}).`,
        metadata: {
            tenantId,
            billId: bill.id,
            billNumber: bill.billNumber,
            packageName,
            billingCycle,
            status: 'PAID',
            paymentMethod: bill.paymentMethod,
            paymentReference: bill.paymentReference,
            paymentProvider: bill.paymentProvider
        },
        transaction
    });
};

const notifyTenantBillExpired = ({ tenant, bill }, transaction = null) => {
    const tenantId = tenant?.id || bill?.tenantId;
    if (!tenantId || !bill?.id) return null;

    return createAdminNotification({
        type: NOTIFICATION_TYPES.TENANT_BILL_EXPIRED,
        entityType: 'tenant',
        entityId: tenantId,
        actionUrl: `/dashboard/clients/${tenantId}`,
        dedupeKey: `tenant_bill_expired:${bill.id}`,
        titleAr: 'انتهت صلاحية فاتورة اشتراك',
        titleEn: 'Subscription invoice expired',
        messageAr: `انتهت صلاحية الفاتورة ${bill.billNumber} الخاصة بـ ${getTenantName(tenant)} ولم يتم السداد خلال المهلة.`,
        messageEn: `Invoice ${bill.billNumber} for ${getTenantName(tenant)} expired before payment was completed.`,
        metadata: {
            tenantId,
            billId: bill.id,
            billNumber: bill.billNumber,
            status: 'EXPIRED'
        },
        transaction
    });
};

const notifyTenantSubscriptionChangeRequested = ({ tenant, bill, packageName, billingCycle }, transaction = null) => {
    if (!tenant?.id || !bill?.id) return null;

    return createAdminNotification({
        type: bill.type === 'renewal'
            ? NOTIFICATION_TYPES.TENANT_SUBSCRIPTION_RENEWED
            : NOTIFICATION_TYPES.TENANT_SUBSCRIPTION_UPGRADED,
        entityType: 'tenant',
        entityId: tenant.id,
        actionUrl: `/dashboard/clients/${tenant.id}`,
        dedupeKey: `tenant_subscription_change_requested:${bill.id}`,
        titleAr: bill.type === 'renewal' ? 'طلب تجديد اشتراك' : 'طلب ترقية اشتراك',
        titleEn: bill.type === 'renewal' ? 'Subscription renewal requested' : 'Subscription upgrade requested',
        messageAr: `${getTenantName(tenant)} أنشأ فاتورة ${bill.billNumber} لباقة ${packageName || '—'} (${billingCycle || '—'}) بانتظار السداد.`,
        messageEn: `${getTenantName(tenant)} created invoice ${bill.billNumber} for ${packageName || '—'} (${billingCycle || '—'}) and payment is pending.`,
        metadata: {
            tenantId: tenant.id,
            billId: bill.id,
            billNumber: bill.billNumber,
            billType: bill.type,
            packageName,
            billingCycle,
            status: bill.status
        },
        transaction
    });
};

module.exports = {
    NOTIFICATION_TYPES,
    createAdminNotification,
    notifyTenantRegistered,
    notifyTenantApprovedInvoiceCreated,
    notifyTenantApprovedFreeActive,
    notifyTenantBillPaid,
    notifyTenantBillExpired,
    notifyTenantSubscriptionChangeRequested
};
