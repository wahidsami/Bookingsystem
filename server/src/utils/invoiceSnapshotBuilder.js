const db = require('../models');
const { normalizePackageEntitlements } = require('./packageEntitlements');

const BILLING_CYCLE_MONTHS = {
    monthly: 1,
    sixMonth: 6,
    annual: 12
};

const BILLING_CYCLE_LABELS = {
    monthly: { ar: 'شهري', en: 'Monthly' },
    sixMonth: { ar: 'كل 6 أشهر', en: '6 months' },
    annual: { ar: 'سنوي', en: 'Annual' }
};

function serializePaymentAttempt(attempt) {
    if (!attempt) return null;

    return {
        id: attempt.id,
        billId: attempt.billId,
        source: attempt.source,
        status: attempt.status,
        paymentProvider: attempt.paymentProvider,
        paymentMethod: attempt.paymentMethod,
        paymentReference: attempt.paymentReference,
        checkoutSessionId: attempt.checkoutSessionId,
        gatewayStatus: attempt.gatewayStatus,
        requestedAmount: toNumber(attempt.requestedAmount, 0),
        capturedAmount: toNumber(attempt.capturedAmount, 0),
        failureReason: attempt.failureReason,
        idempotencyKey: attempt.idempotencyKey,
        processedAt: attempt.processedAt,
        performedByType: attempt.performedByType,
        performedById: attempt.performedById,
        performedByName: attempt.performedByName,
        notes: attempt.notes,
        gatewaySummary: attempt.gatewaySummary || {},
        createdAt: attempt.createdAt
    };
}

function toNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
    return Number.parseFloat(toNumber(value).toFixed(2));
}

function getAmountForBillingCycle(subscriptionPackage, billingCycle) {
    if (!subscriptionPackage) return 0;

    if (billingCycle === 'sixMonth') {
        return roundMoney(subscriptionPackage.sixMonthPrice);
    }

    if (billingCycle === 'annual') {
        return roundMoney(subscriptionPackage.annualPrice);
    }

    return roundMoney(subscriptionPackage.monthlyPrice);
}

function getCycleEndDate(startDate, billingCycle) {
    const periodEnd = new Date(startDate);
    periodEnd.setMonth(periodEnd.getMonth() + (BILLING_CYCLE_MONTHS[billingCycle] || 1));
    return periodEnd;
}

function joinAddressParts(parts) {
    return parts
        .map((part) => (part || '').toString().trim())
        .filter(Boolean)
        .join(', ');
}

function getTenantLanguage(tenant) {
    return tenant?.settings?.language === 'en' ? 'en' : 'ar';
}

function formatInvoiceTitle(type, locale) {
    const titles = {
        initial: {
            ar: 'فاتورة اشتراك رفاه',
            en: 'Refah Subscription Invoice'
        },
        renewal: {
            ar: 'فاتورة تجديد اشتراك رفاه',
            en: 'Refah Subscription Renewal Invoice'
        },
        upgrade: {
            ar: 'فاتورة ترقية باقة رفاه',
            en: 'Refah Package Upgrade Invoice'
        }
    };

    const titleSet = titles[type] || titles.initial;
    return locale === 'ar'
        ? `${titleSet.ar} | ${titleSet.en}`
        : `${titleSet.en} | ${titleSet.ar}`;
}

async function getInvoiceSellerSnapshot() {
    let settings = null;

    try {
        settings = await db.GlobalSettings.findOne({
            order: [['updatedAt', 'DESC']]
        });
    } catch (error) {
        settings = null;
    }

    return {
        sellerNameAr: settings?.invoiceSellerNameAr || 'رفاه',
        sellerNameEn: settings?.invoiceSellerNameEn || 'Refah',
        vatNumber: settings?.invoiceVatNumber || null,
        crNumber: settings?.invoiceCrNumber || null,
        addressAr: settings?.invoiceAddressAr || null,
        addressEn: settings?.invoiceAddressEn || null,
        city: settings?.invoiceCity || 'Riyadh',
        country: settings?.invoiceCountry || 'Saudi Arabia',
        email: settings?.invoiceEmail || null,
        phone: settings?.invoicePhone || null,
        logoPath: settings?.invoiceLogoPath || '/uploads/logo-white.png',
        footerNoteAr: settings?.invoiceFooterNoteAr || null,
        footerNoteEn: settings?.invoiceFooterNoteEn || null,
        taxRate: toNumber(settings?.taxRate, 15),
        invoicePrefix: settings?.invoicePrefix || 'INV'
    };
}

function buildBuyerSnapshot(tenant) {
    return {
        tenantId: tenant?.id || null,
        businessNameAr: tenant?.name_ar || tenant?.nameAr || tenant?.name || null,
        businessNameEn: tenant?.name_en || tenant?.name || tenant?.name_ar || null,
        email: tenant?.email || tenant?.contactPersonEmail || null,
        phone: tenant?.phone || tenant?.mobile || null,
        vatNumber: tenant?.taxNumber || null,
        crNumber: tenant?.crNumber || null,
        licenseNumber: tenant?.licenseNumber || null,
        addressAr: joinAddressParts([
            tenant?.buildingNumber,
            tenant?.street,
            tenant?.district,
            tenant?.city,
            tenant?.country,
            tenant?.postalCode
        ]) || tenant?.address || null,
        addressEn: joinAddressParts([
            tenant?.buildingNumber,
            tenant?.street,
            tenant?.district,
            tenant?.city,
            tenant?.country,
            tenant?.postalCode
        ]) || tenant?.address || null,
        city: tenant?.city || null,
        country: tenant?.country || 'Saudi Arabia',
        preferredLanguage: getTenantLanguage(tenant)
    };
}

function buildPlanSnapshot(subscriptionPackage, billingCycle) {
    return {
        packageId: subscriptionPackage?.id || null,
        packageName: subscriptionPackage?.name || null,
        packageNameAr: subscriptionPackage?.name_ar || null,
        packageSlug: subscriptionPackage?.slug || null,
        billingCycle,
        billingCycleLabel: BILLING_CYCLE_LABELS[billingCycle] || BILLING_CYCLE_LABELS.monthly,
        packageDescription: subscriptionPackage?.description || null,
        packageDescriptionAr: subscriptionPackage?.description_ar || null,
        platformCommissionRate: toNumber(subscriptionPackage?.platformCommission, 0),
        limits: normalizePackageEntitlements(subscriptionPackage?.limits || {})
    };
}

async function buildSubscriptionInvoiceSnapshot({
    tenant,
    subscriptionPackage,
    subscription,
    billingCycle,
    billType = 'initial',
    dueDate,
    issueDate = new Date(),
    totalAmount = null
}) {
    const selectedCycle = billingCycle || subscription?.billingCycle || 'monthly';
    const sellerSnapshot = await getInvoiceSellerSnapshot();
    const buyerSnapshot = buildBuyerSnapshot(tenant);
    const planSnapshot = buildPlanSnapshot(subscriptionPackage, selectedCycle);

    const finalTotalAmount = roundMoney(
        totalAmount !== null && totalAmount !== undefined
            ? totalAmount
            : getAmountForBillingCycle(subscriptionPackage, selectedCycle)
    );

    const vatRate = toNumber(sellerSnapshot.taxRate, 15);
    const platformMarkupRate = toNumber(subscriptionPackage?.platformCommission, 0);
    const taxableSubtotal = finalTotalAmount > 0
        ? roundMoney(finalTotalAmount / (1 + (vatRate / 100)))
        : 0;
    const basePackageAmount = taxableSubtotal > 0
        ? roundMoney(taxableSubtotal / (1 + (platformMarkupRate / 100)))
        : 0;
    const platformMarkupAmount = roundMoney(taxableSubtotal - basePackageAmount);
    const vatAmount = roundMoney(finalTotalAmount - taxableSubtotal);
    const periodStart = subscription?.currentPeriodStart
        ? new Date(subscription.currentPeriodStart)
        : new Date(issueDate);
    const periodEnd = subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : getCycleEndDate(periodStart, selectedCycle);
    const invoiceLocale = getTenantLanguage(tenant);

    return {
        amount: finalTotalAmount,
        subtotalAmount: taxableSubtotal,
        platformMarkupRate,
        platformMarkupAmount,
        vatRate,
        vatAmount,
        discountAmount: 0,
        totalAmount: finalTotalAmount,
        invoiceIssuedAt: issueDate,
        invoiceTitle: formatInvoiceTitle(billType, invoiceLocale),
        invoiceTemplateMode: 'bilingual_ar_en',
        sellerSnapshot: {
            sellerNameAr: sellerSnapshot.sellerNameAr,
            sellerNameEn: sellerSnapshot.sellerNameEn,
            vatNumber: sellerSnapshot.vatNumber,
            crNumber: sellerSnapshot.crNumber,
            addressAr: sellerSnapshot.addressAr,
            addressEn: sellerSnapshot.addressEn,
            city: sellerSnapshot.city,
            country: sellerSnapshot.country,
            email: sellerSnapshot.email,
            phone: sellerSnapshot.phone,
            logoPath: sellerSnapshot.logoPath,
            footerNoteAr: sellerSnapshot.footerNoteAr,
            footerNoteEn: sellerSnapshot.footerNoteEn
        },
        buyerSnapshot,
        lineItemsSnapshot: [{
            code: `SUBSCRIPTION_${(selectedCycle || 'monthly').toUpperCase()}`,
            descriptionAr: planSnapshot.packageNameAr || planSnapshot.packageName || 'باقة اشتراك رفاه',
            descriptionEn: planSnapshot.packageName || planSnapshot.packageNameAr || 'Refah subscription package',
            billingCycle: selectedCycle,
            billingCycleLabel: planSnapshot.billingCycleLabel,
            quantity: 1,
            unitBaseAmount: basePackageAmount,
            platformMarkupRate,
            platformMarkupAmount,
            subtotalAmount: taxableSubtotal,
            vatRate,
            vatAmount,
            totalAmount: finalTotalAmount,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            packageLimits: planSnapshot.limits
        }],
        planSnapshot: {
            ...planSnapshot,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString()
        },
        metadata: {
            invoiceLanguage: invoiceLocale,
            dueDate,
            issueDate: issueDate.toISOString(),
            sellerTaxRate: vatRate
        }
    };
}

function serializeBill(bill, options = {}) {
    if (!bill) return null;

    const includePaymentToken = options.includePaymentToken && bill.status === 'UNPAID';
    const includePaymentAttempts = Boolean(options.includePaymentAttempts);
    const tenant = bill.tenant || null;
    const subscription = bill.subscription || null;
    const packageRecord = subscription?.package || null;

    return {
        id: bill.id,
        tenantId: bill.tenantId,
        tenantSubscriptionId: bill.tenantSubscriptionId,
        billNumber: bill.billNumber,
        amount: toNumber(bill.amount, 0),
        subtotalAmount: toNumber(bill.subtotalAmount, toNumber(bill.amount, 0)),
        platformMarkupRate: toNumber(bill.platformMarkupRate, 0),
        platformMarkupAmount: toNumber(bill.platformMarkupAmount, 0),
        vatRate: toNumber(bill.vatRate, 0),
        vatAmount: toNumber(bill.vatAmount, 0),
        discountAmount: toNumber(bill.discountAmount, 0),
        totalAmount: toNumber(bill.totalAmount, toNumber(bill.amount, 0)),
        currency: bill.currency,
        dueDate: bill.dueDate,
        status: bill.status,
        paymentToken: includePaymentToken ? bill.paymentToken : undefined,
        paymentTokenExpiresAt: bill.paymentTokenExpiresAt,
        paidAt: bill.paidAt,
        invoiceIssuedAt: bill.invoiceIssuedAt || bill.createdAt,
        invoiceTitle: bill.invoiceTitle,
        invoiceTemplateMode: bill.invoiceTemplateMode || 'bilingual_ar_en',
        sellerSnapshot: bill.sellerSnapshot || {},
        buyerSnapshot: bill.buyerSnapshot || {},
        lineItemsSnapshot: bill.lineItemsSnapshot || [],
        planSnapshot: bill.planSnapshot || {},
        invoicePdfPath: bill.invoicePdfPath,
        receiptPdfPath: bill.receiptPdfPath,
        paymentProvider: bill.paymentProvider,
        paymentReference: bill.paymentReference,
        paymentMethod: bill.paymentMethod,
        paymentCapturedAmount: toNumber(bill.paymentCapturedAmount, toNumber(bill.amount, 0)),
        paymentFailureReason: bill.paymentFailureReason,
        type: bill.type,
        metadata: bill.metadata || {},
        paymentAttempts: includePaymentAttempts && Array.isArray(bill.paymentAttempts)
            ? bill.paymentAttempts.map(serializePaymentAttempt)
            : undefined,
        createdAt: bill.createdAt,
        updatedAt: bill.updatedAt,
        tenant: tenant
            ? {
                id: tenant.id,
                name: tenant.name,
                name_ar: tenant.name_ar || tenant.nameAr,
                name_en: tenant.name_en,
                email: tenant.email,
                phone: tenant.phone
            }
            : undefined,
        subscription: subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                billingCycle: subscription.billingCycle,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                nextBillingDate: subscription.nextBillingDate,
                package: packageRecord
                    ? {
                        id: packageRecord.id,
                        name: packageRecord.name,
                        name_ar: packageRecord.name_ar,
                        slug: packageRecord.slug,
                        platformCommission: toNumber(packageRecord.platformCommission, 0),
                        monthlyPrice: toNumber(packageRecord.monthlyPrice, 0),
                        sixMonthPrice: toNumber(packageRecord.sixMonthPrice, 0),
                        annualPrice: toNumber(packageRecord.annualPrice, 0),
                        limits: normalizePackageEntitlements(packageRecord.limits || {})
                    }
                    : undefined
            }
            : undefined
    };
}

module.exports = {
    buildSubscriptionInvoiceSnapshot,
    getAmountForBillingCycle,
    serializeBill,
    serializePaymentAttempt,
    toNumber
};
