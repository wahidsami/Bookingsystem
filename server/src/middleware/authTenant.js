/**
 * Authentication Middleware for Tenant Users (Salon/Spa Owners)
 * 
 * Verifies JWT tokens and attaches tenant data to request object
 */

const jwt = require('jsonwebtoken');
const db = require('../models');
const JWT_SECRET = process.env.JWT_SECRET;
const {
  getFeatureKeys,
  isFeatureEnabled,
  normalizePackageEntitlements
} = require('../utils/packageEntitlements');
const { normalizeDashboardPermissions } = require('../utils/tenantDashboardPermissions');

const isMissingTenantDashboardAccountTableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = error?.original?.code || error?.parent?.code;

  return (
    code === '42P01' ||
    message.includes('tenant_dashboard_accounts') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
};

/**
 * Authenticate Tenant User (Required Auth)
 * Protects routes that require tenant authentication
 */
const authenticateTenant = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if it's a tenant token or a tenant dashboard account token
    if (decoded.type !== 'tenant' && decoded.type !== 'tenant_account') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token type. Tenant access required.'
      });
    }

    // Fetch tenant from database
    const tenantId = decoded.id;
    const tenant = await db.Tenant.findByPk(tenantId, {
      attributes: { exclude: ['password'] }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Block access for terminal/invalid statuses (allow onboarding + payment_pending + active)
    const blockedStatuses = ['pending_approval', 'payment_pending', 'rejected', 'suspended', 'inactive', 'payment_failed', 'payment_expired'];
    if (blockedStatuses.includes(tenant.status)) {
      return res.status(403).json({
        success: false,
        message: `Account is ${tenant.status}. Please contact support.`
      });
    }

    let tenantAccount = null;
    let dashboardPermissions = null;

    if (decoded.type === 'tenant_account') {
      if (!decoded.accountId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid tenant dashboard account token'
        });
      }

      try {
        tenantAccount = await db.TenantDashboardAccount.findByPk(decoded.accountId);
      } catch (accountError) {
        if (!isMissingTenantDashboardAccountTableError(accountError)) {
          throw accountError;
        }
      }

      if (!tenantAccount || tenantAccount.tenantId !== tenant.id) {
        return res.status(401).json({
          success: false,
          message: 'Tenant dashboard account not found'
        });
      }

      if (!tenantAccount.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tenant dashboard account is disabled'
        });
      }

      dashboardPermissions = normalizeDashboardPermissions(tenantAccount.permissions || {}, tenantAccount.roleKey);
    }

    // Attach tenant data to request
    req.tenantId = tenant.id;
    req.tenant = tenant;
    req.tenantAccount = tenantAccount;
    req.tenantAccountId = tenantAccount?.id || null;
    req.dashboardPermissions = dashboardPermissions;
    req.userId = decoded.type === 'tenant_account' ? tenantAccount.id : decoded.id; // For backward compatibility
    
    next();
  } catch (error) {
    console.error('Tenant authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

/**
 * Optional Tenant Authentication
 * Routes work with or without authentication
 */
const optionalTenantAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without auth
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type === 'tenant' || decoded.type === 'tenant_account') {
      const tenant = await db.Tenant.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (tenant && (tenant.status === 'active' || tenant.status === 'approved' || tenant.status === 'more_info_required')) {
        req.tenantId = tenant.id;
        req.tenant = tenant;
        req.userId = decoded.type === 'tenant_account' ? decoded.accountId : decoded.id;

        if (decoded.type === 'tenant_account' && decoded.accountId) {
          try {
            const tenantAccount = await db.TenantDashboardAccount.findByPk(decoded.accountId);
            if (tenantAccount && tenantAccount.tenantId === tenant.id && tenantAccount.isActive) {
              req.tenantAccount = tenantAccount;
              req.tenantAccountId = tenantAccount.id;
              req.dashboardPermissions = normalizeDashboardPermissions(tenantAccount.permissions || {}, tenantAccount.roleKey);
            }
          } catch (accountError) {
            if (!isMissingTenantDashboardAccountTableError(accountError)) {
              throw accountError;
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without auth
    console.warn('Optional tenant auth warning:', error.message);
    next();
  }
};

/**
 * Check if tenant has specific permission/feature access
 * Can be used for subscription-based features
 */
const checkTenantFeature = (feature) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { Op } = require('sequelize');
      const tenantId = req.tenantId;
      const featureKeys = getFeatureKeys(feature);

      const settings = await db.TenantSettings.findOne({ where: { tenantId } });
      const tenantFeatures = normalizePackageEntitlements(settings?.features || {});
      if (featureKeys.some((key) => isFeatureEnabled(tenantFeatures[key]))) {
        return next();
      }

      const { getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');
      const subResult = await getActiveSubscriptionForTenant(tenantId, {
        statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE']
      });
      const packageFeatures = normalizePackageEntitlements(subResult?.package?.limits || {});
      if (featureKeys.some((key) => isFeatureEnabled(packageFeatures[key]))) {
        return next();
      }

      const tenantPlan = req.tenant.plan || '';
      const planBase = tenantPlan.split('_')[0];

      const planPackage = await db.SubscriptionPackage.findOne({
        where: {
          [Op.or]: [
            { slug: { [Op.iLike]: `%${planBase}%` } },
            { name: { [Op.iLike]: `%${planBase}%` } }
          ],
          isActive: true
        }
      });

      const fallbackPackageFeatures = normalizePackageEntitlements(planPackage?.limits || {});
      if (featureKeys.some((key) => isFeatureEnabled(fallbackPackageFeatures[key]))) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `This feature (${feature}) is not available in your current plan`,
        upgradeRequired: true
      });
    } catch (error) {
      console.error('Feature check error:', error);
      res.status(500).json({
        success: false,
        message: 'Feature access check failed'
      });
    }
  };
};

/**
 * Rate limiting for tenant API calls (basic implementation)
 * Can be enhanced with Redis for production
 */
const rateLimitTenant = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.tenantId) {
      return next();
    }

    const now = Date.now();
    const tenantKey = req.tenantId;
    
    if (!requests.has(tenantKey)) {
      requests.set(tenantKey, []);
    }

    const tenantRequests = requests.get(tenantKey);
    
    // Remove old requests outside the time window
    const recentRequests = tenantRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    recentRequests.push(now);
    requests.set(tenantKey, recentRequests);
    
    next();
  };
};

const requireTenantDashboardPermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.tenantAccount) {
      return next();
    }

    const permissions = req.dashboardPermissions || normalizeDashboardPermissions(req.tenantAccount.permissions || {}, req.tenantAccount.roleKey);
    if (permissions[permissionKey]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this section'
    });
  };
};

module.exports = {
  authenticateTenant,
  optionalTenantAuth,
  checkTenantFeature,
  rateLimitTenant,
  isFeatureEnabled,
  requireTenantDashboardPermission
};

