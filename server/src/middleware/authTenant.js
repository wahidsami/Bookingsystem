/**
 * Authentication Middleware for Tenant Users (Salon/Spa Owners)
 * 
 * Verifies JWT tokens and attaches tenant data to request object
 */

const jwt = require('jsonwebtoken');
const db = require('../models');

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Check if it's a tenant token (not platform user or admin)
    if (decoded.type !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token type. Tenant access required.'
      });
    }

    // Fetch tenant from database
    const tenant = await db.Tenant.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Check if tenant account is active
    if (tenant.status === 'suspended' || tenant.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: `Account is ${tenant.status}. Please contact support.`
      });
    }

    // Attach tenant data to request
    req.tenantId = tenant.id;
    req.tenant = tenant;
    req.userId = decoded.id; // For backward compatibility
    
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    if (decoded.type === 'tenant') {
      const tenant = await db.Tenant.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (tenant && tenant.status === 'approved') {
        req.tenantId = tenant.id;
        req.tenant = tenant;
        req.userId = decoded.id;
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

      // Get tenant settings to check subscription/features
      const settings = await db.TenantSettings.findOne({
        where: { tenantId: req.tenantId }
      });

      // Check if tenant has access to the feature
      // This can be expanded based on subscription tiers
      const features = settings?.features || {};
      
      if (!features[feature]) {
        return res.status(403).json({
          success: false,
          message: `This feature (${feature}) is not available in your current plan`,
          upgradeRequired: true
        });
      }

      next();
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

module.exports = {
  authenticateTenant,
  optionalTenantAuth,
  checkTenantFeature,
  rateLimitTenant
};

