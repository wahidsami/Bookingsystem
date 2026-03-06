/**
 * Tenant subscription payment (fake gateway) – get session and submit payment
 * Used after admin approval: tenant pays within 48h to activate account.
 */
const db = require('../models');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Middleware: set req.tenant from Bearer (tenant with payment_pending) or query/body token
 */
async function subscriptionPaymentAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.type === 'tenant' && decoded.id) {
                const tenant = await db.Tenant.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
                if (tenant && tenant.status === 'payment_pending') {
                    req.tenant = tenant;
                    return next();
                }
            }
        }
        const linkToken = req.query.token || req.body?.token;
        if (linkToken) {
            const decoded = jwt.verify(linkToken, JWT_SECRET);
            if (decoded.action === 'subscription_payment' && decoded.tenantId) {
                const tenant = await db.Tenant.findByPk(decoded.tenantId, { attributes: { exclude: ['password'] } });
                if (tenant && tenant.status === 'payment_pending') {
                    req.tenant = tenant;
                    return next();
                }
            }
        }
        next();
    } catch {
        next();
    }
}

/**
 * Resolve tenant from auth or token (query.token for payment link)
 */
async function resolveTenant(req) {
    if (req.tenant) return req.tenant;
    const token = req.query.token || req.body?.token;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.action !== 'subscription_payment' || !decoded.tenantId) return null;
        const tenant = await db.Tenant.findByPk(decoded.tenantId);
        return tenant && tenant.status === 'payment_pending' ? tenant : null;
    } catch {
        return null;
    }
}

/**
 * GET /api/v1/tenant/subscription/payment
 * Get payment session (package, amount, paymentDueAt). Auth or token.
 */
async function getPaymentSession(req, res) {
    try {
        const tenant = await resolveTenant(req);
        if (!tenant) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired payment link. Please log in or use the link from your email.'
            });
        }
        if (tenant.status !== 'payment_pending') {
            return res.status(400).json({
                success: false,
                message: `Payment not pending (status: ${tenant.status})`
            });
        }
        const now = new Date();
        if (tenant.paymentDueAt && tenant.paymentDueAt < now) {
            return res.status(400).json({
                success: false,
                message: 'Payment window has expired.',
                code: 'PAYMENT_EXPIRED'
            });
        }
        const subscription = await db.TenantSubscription.findOne({
            where: { tenantId: tenant.id },
            include: [{ model: db.SubscriptionPackage, as: 'package' }]
        });
        if (!subscription) {
            return res.status(400).json({
                success: false,
                message: 'No subscription found. Please contact support.'
            });
        }
        const pkg = subscription.package;
        res.json({
            success: true,
            tenantId: tenant.id,
            packageName: pkg?.name_en || pkg?.name || 'Subscription',
            amount: parseFloat(subscription.amount) || 0,
            currency: subscription.currency || 'SAR',
            paymentDueAt: tenant.paymentDueAt
        });
    } catch (error) {
        console.error('getPaymentSession error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load payment session',
            error: error.message
        });
    }
}

/**
 * POST /api/v1/tenant/subscription/pay
 * Body: { success: true | false }. Auth or token.
 */
async function submitPayment(req, res) {
    try {
        const tenant = await resolveTenant(req);
        if (!tenant) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired payment link. Please log in or use the link from your email.'
            });
        }
        if (tenant.status !== 'payment_pending') {
            return res.status(400).json({
                success: false,
                message: `Payment not pending (status: ${tenant.status})`
            });
        }
        const now = new Date();
        if (tenant.paymentDueAt && tenant.paymentDueAt < now) {
            await tenant.update({ status: 'payment_expired' });
            const { sendPaymentExpiredEmail } = require('../utils/emailService');
            sendPaymentExpiredEmail(tenant).catch(err => console.error('[Payment] Expired email failed:', err.message));
            return res.status(400).json({
                success: false,
                message: 'Payment window has expired.',
                code: 'PAYMENT_EXPIRED'
            });
        }
        const success = req.body?.success === true;
        if (success) {
            await tenant.update({ status: 'payment_success' });
            const { activateTenantAfterPayment } = require('../utils/initializeTenantSubscription');
            await activateTenantAfterPayment(tenant.id);
            const { sendPaymentSuccessEmail } = require('../utils/emailService');
            sendPaymentSuccessEmail(tenant).catch(err => console.error('[Payment] Success email failed:', err.message));
            return res.json({
                success: true,
                message: 'Payment successful. Your account is now active.',
                status: 'active'
            });
        }
        await tenant.update({ status: 'payment_failed' });
        const { sendPaymentFailedEmail } = require('../utils/emailService');
        sendPaymentFailedEmail(tenant).catch(err => console.error('[Payment] Failed email failed:', err.message));
        return res.json({
            success: false,
            message: 'Payment failed. You can try again before the link expires.',
            status: 'payment_failed'
        });
    } catch (error) {
        console.error('submitPayment error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment processing failed',
            error: error.message
        });
    }
}

module.exports = {
    subscriptionPaymentAuth,
    getPaymentSession,
    submitPayment
};
