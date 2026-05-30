/**
 * Tenant Authentication Controller
 * Handles login, logout, token refresh for tenant users (salon/spa owners)
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../models');
const { normalizeDashboardPermissions } = require('../utils/tenantDashboardPermissions');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate access token
 */
const generateAccessToken = (tenantId) => {
  return jwt.sign(
    { id: tenantId, type: 'tenant' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate dashboard account access token
 */
const generateAccountAccessToken = (tenantId, accountId) => {
  return jwt.sign(
    { id: tenantId, accountId, type: 'tenant_account' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (tenantId) => {
  return jwt.sign(
    { id: tenantId, type: 'tenant', isRefresh: true },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
};

/**
 * Generate dashboard account refresh token
 */
const generateAccountRefreshToken = (tenantId, accountId) => {
  return jwt.sign(
    { id: tenantId, accountId, type: 'tenant_account', isRefresh: true },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
};

const sanitizeDashboardAccount = (account) => {
  if (!account) {
    return null;
  }

  const json = account.toJSON ? account.toJSON() : { ...account };
  delete json.password;
  return {
    ...json,
    permissions: normalizeDashboardPermissions(json.permissions || {}, json.roleKey)
  };
};

const blockedStatuses = ['pending_approval', 'payment_pending', 'rejected', 'suspended', 'inactive', 'payment_failed', 'payment_expired'];

const isMissingTenantDashboardAccountTableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = error?.original?.code || error?.parent?.code;

  return (
    code === '42P01' ||
    message.includes('tenant_dashboard_accounts') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
};

const findDashboardAccountByEmail = async (email) => {
  try {
    return await db.TenantDashboardAccount.findOne({
      where: {
        email
      }
    });
  } catch (error) {
    if (isMissingTenantDashboardAccountTableError(error)) {
      return null;
    }
    throw error;
  }
};

const findDashboardAccountById = async (accountId) => {
  try {
    return await db.TenantDashboardAccount.findByPk(accountId);
  } catch (error) {
    if (isMissingTenantDashboardAccountTableError(error)) {
      return null;
    }
    throw error;
  }
};

const getBlockedTenantMessage = (status) => {
  return status === 'rejected'
    ? 'Your account has been rejected. Please contact support.'
    : status === 'suspended'
      ? 'Your account has been suspended. Please contact support.'
      : status === 'pending_approval'
        ? 'Your tenant registration is still under review. Please wait for approval.'
        : status === 'payment_pending'
          ? 'Your tenant is approved, but access is not active until payment is completed.'
      : status === 'payment_expired'
        ? 'Payment window expired. Please contact support.'
        : `Account is ${status}. Please contact support.`;
};

const buildTenantResponse = (tenant) => {
  const tenantData = tenant.toJSON();
  delete tenantData.password;
  return tenantData;
};

/**
 * Tenant Login
 * POST /api/v1/auth/tenant/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const normalizedEmail = email.toLowerCase();

    // Try tenant owner login first
    const tenant = await db.Tenant.findOne({ where: { email: normalizedEmail } });

    if (tenant) {
      if (blockedStatuses.includes(tenant.status)) {
        return res.status(403).json({
          success: false,
          message: getBlockedTenantMessage(tenant.status),
          status: tenant.status
        });
      }

      const isPasswordValid = await bcrypt.compare(password, tenant.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      tenant.lastLogin = new Date();
      await tenant.save();

      const accessToken = generateAccessToken(tenant.id);
      const refreshToken = generateRefreshToken(tenant.id);

      return res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        sessionType: 'tenant_owner',
        tenant: buildTenantResponse(tenant),
        account: null,
        permissions: null
      });
    }

    const dashboardAccount = await findDashboardAccountByEmail(normalizedEmail);

    if (!dashboardAccount) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const accountTenant = await db.Tenant.findByPk(dashboardAccount.tenantId);
    if (!accountTenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    if (blockedStatuses.includes(accountTenant.status)) {
      return res.status(403).json({
        success: false,
        message: getBlockedTenantMessage(accountTenant.status),
        status: accountTenant.status
      });
    }

    if (!dashboardAccount.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This dashboard account is disabled'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, dashboardAccount.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    dashboardAccount.lastLoginAt = new Date();
    dashboardAccount.lastLoginIP = req.ip;
    await dashboardAccount.save();

    const accessToken = generateAccountAccessToken(accountTenant.id, dashboardAccount.id);
    const refreshToken = generateAccountRefreshToken(accountTenant.id, dashboardAccount.id);
    const accountData = sanitizeDashboardAccount(dashboardAccount);

    return res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      sessionType: 'tenant_account',
      tenant: buildTenantResponse(accountTenant),
      account: accountData,
      permissions: accountData.permissions
    });
  } catch (error) {
    console.error('Tenant login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

/**
 * Tenant Logout
 * POST /api/v1/auth/tenant/logout
 */
const logout = async (req, res) => {
  try {
    // In a production app, you might want to:
    // 1. Blacklist the token in Redis
    // 2. Clear refresh token from database
    // 3. Log the logout event

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Tenant logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};

/**
 * Refresh Access Token
 * POST /api/v1/auth/tenant/refresh-token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    if ((decoded.type !== 'tenant' && decoded.type !== 'tenant_account') || !decoded.isRefresh) {
      return res.status(403).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Check if tenant still exists and is active
    const tenant = await db.Tenant.findByPk(decoded.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const blockedStatuses = ['pending_approval', 'payment_pending', 'rejected', 'suspended', 'inactive', 'payment_failed', 'payment_expired'];
    if (blockedStatuses.includes(tenant.status)) {
      return res.status(403).json({
        success: false,
        message: getBlockedTenantMessage(tenant.status),
        status: tenant.status
      });
    }

    let newAccessToken;

    if (decoded.type === 'tenant_account') {
      if (!decoded.accountId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid tenant dashboard account token'
        });
      }

      const dashboardAccount = await findDashboardAccountById(decoded.accountId);
      if (!dashboardAccount || dashboardAccount.tenantId !== tenant.id || !dashboardAccount.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tenant dashboard account is no longer valid'
        });
      }

      newAccessToken = generateAccountAccessToken(tenant.id, dashboardAccount.id);
    } else {
      newAccessToken = generateAccessToken(tenant.id);
    }

    res.json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
};

/**
 * Get Current Tenant Profile
 * GET /api/v1/tenant/profile
 */
const getProfile = async (req, res) => {
  try {
    const tenant = await db.Tenant.findByPk(req.tenantId, {
      attributes: { exclude: ['password'] }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const account = req.tenantAccount ? sanitizeDashboardAccount(req.tenantAccount) : null;

    res.json({
      success: true,
      tenant,
      account,
      sessionType: account ? 'tenant_account' : 'tenant_owner',
      permissions: account?.permissions || null
    });
  } catch (error) {
    console.error('Get tenant profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

/**
 * Update Tenant Profile
 * PUT /api/v1/tenant/profile
 */
const updateProfile = async (req, res) => {
  try {
    const {
      businessName,
      businessType,
      contactPhone,
      address,
      city,
      country,
      postalCode,
      description,
      website,
      socialMedia
    } = req.body;

    const tenant = await db.Tenant.findByPk(req.tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Update fields
    if (businessName) tenant.businessName = businessName;
    if (businessType) tenant.businessType = businessType;
    if (contactPhone) tenant.contactPhone = contactPhone;
    if (address) tenant.address = address;
    if (city) tenant.city = city;
    if (country) tenant.country = country;
    if (postalCode) tenant.postalCode = postalCode;
    if (description) tenant.description = description;
    if (website) tenant.website = website;
    if (socialMedia) tenant.socialMedia = socialMedia;

    await tenant.save();

    // Remove password from response
    const tenantData = tenant.toJSON();
    delete tenantData.password;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      tenant: tenantData
    });
  } catch (error) {
    console.error('Update tenant profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

/**
 * Change Password
 * POST /api/v1/auth/tenant/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match'
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      });
    }

    if (req.tenantAccount) {
      const account = await findDashboardAccountById(req.tenantAccount.id);
      if (!account || account.tenantId !== req.tenantId) {
        return res.status(404).json({
          success: false,
          message: 'Tenant dashboard account not found'
        });
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, account.password);
      if (!isCurrentValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      account.password = await bcrypt.hash(newPassword, 10);
      account.passwordResetRequired = false;
      await account.save();

      return res.json({
        success: true,
        message: 'Password changed successfully'
      });
    }

    const tenant = await db.Tenant.findByPk(req.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, tenant.password);
    if (!isCurrentValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    tenant.password = await bcrypt.hash(newPassword, 10);
    await tenant.save();

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change tenant password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

module.exports = {
  login,
  logout,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword
};

