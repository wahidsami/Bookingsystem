/**
 * Tenant Authentication Controller
 * Handles login, logout, token refresh for tenant users (salon/spa owners)
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../models');
const { normalizeDashboardPermissions } = require('../utils/tenantDashboardPermissions');
const emailService = require('../utils/emailService');
const { getTenantDashboardResetUrl } = require('../utils/url');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const TENANT_PASSWORD_RESET_EXPIRES_IN = process.env.TENANT_PASSWORD_RESET_EXPIRES_IN || '60m';

const buildPasswordFingerprint = (passwordHash) => {
  if (!passwordHash) {
    return null;
  }

  return crypto
    .createHash('sha256')
    .update(`${passwordHash}:${JWT_SECRET}`)
    .digest('hex')
    .slice(0, 24);
};

const buildTenantResetToken = ({ tenantId, accountId = null, passwordFingerprint }) => {
  return jwt.sign(
    {
      type: 'tenant_password_reset',
      id: tenantId,
      accountId,
      pf: passwordFingerprint || null
    },
    JWT_SECRET,
    { expiresIn: TENANT_PASSWORD_RESET_EXPIRES_IN }
  );
};

/**
 * Generate access token
 */
const generateAccessToken = (tenantId, passwordFingerprint) => {
  return jwt.sign(
    { id: tenantId, type: 'tenant', pf: passwordFingerprint || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate dashboard account access token
 */
const generateAccountAccessToken = (tenantId, accountId, passwordFingerprint) => {
  return jwt.sign(
    { id: tenantId, accountId, type: 'tenant_account', pf: passwordFingerprint || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (tenantId, passwordFingerprint) => {
  return jwt.sign(
    { id: tenantId, type: 'tenant', isRefresh: true, pf: passwordFingerprint || null },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
};

/**
 * Generate dashboard account refresh token
 */
const generateAccountRefreshToken = (tenantId, accountId, passwordFingerprint) => {
  return jwt.sign(
    { id: tenantId, accountId, type: 'tenant_account', isRefresh: true, pf: passwordFingerprint || null },
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

      if (!tenant.password) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
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

      const passwordFingerprint = buildPasswordFingerprint(tenant.password);
      const accessToken = generateAccessToken(tenant.id, passwordFingerprint);
      const refreshToken = generateRefreshToken(tenant.id, passwordFingerprint);

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

    if (!dashboardAccount.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
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

    const passwordFingerprint = buildPasswordFingerprint(dashboardAccount.password);
    const accessToken = generateAccountAccessToken(accountTenant.id, dashboardAccount.id, passwordFingerprint);
    const refreshToken = generateAccountRefreshToken(accountTenant.id, dashboardAccount.id, passwordFingerprint);
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

      const tokenFingerprint = decoded.pf || null;
      const currentFingerprint = buildPasswordFingerprint(dashboardAccount.password);
      if (!tokenFingerprint || tokenFingerprint !== currentFingerprint) {
        return res.status(401).json({
          success: false,
          message: 'Session is no longer valid. Please login again.'
        });
      }

      newAccessToken = generateAccountAccessToken(tenant.id, dashboardAccount.id, currentFingerprint);
    } else {
      const tokenFingerprint = decoded.pf || null;
      const currentFingerprint = buildPasswordFingerprint(tenant.password);
      if (!tokenFingerprint || tokenFingerprint !== currentFingerprint) {
        return res.status(401).json({
          success: false,
          message: 'Session is no longer valid. Please login again.'
        });
      }

      newAccessToken = generateAccessToken(tenant.id, currentFingerprint);
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
 * Forgot Password
 * POST /api/v1/auth/tenant/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email, locale } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    let tenant = await db.Tenant.findOne({ where: { email: normalizedEmail } });
    let account = null;
    let displayName = '';

    if (!tenant) {
      account = await findDashboardAccountByEmail(normalizedEmail);
      if (account) {
        tenant = await db.Tenant.findByPk(account.tenantId);
        displayName = account.displayName || '';
      }
    } else {
      displayName = tenant.name_en || tenant.name || '';
    }

    if (tenant && (tenant.password || account?.password)) {
      const passwordFingerprint = buildPasswordFingerprint(account ? account.password : tenant.password);
      const resetToken = buildTenantResetToken({
        tenantId: tenant.id,
        accountId: account?.id || null,
        passwordFingerprint
      });
      const resetUrl = getTenantDashboardResetUrl(resetToken, locale === 'en' ? 'en' : 'ar');

      if (resetUrl) {
        await emailService.sendCustomerPasswordResetEmail({
          email: normalizedEmail,
          firstName: displayName || (locale === 'ar' ? 'مستخدم' : 'User'),
          resetUrl,
          expiresInMinutes: 60
        });
      }
    }

    return res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent'
    });
  } catch (error) {
    console.error('Tenant forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process forgot password',
      error: error.message
    });
  }
};

/**
 * Reset Password
 * POST /api/v1/auth/tenant/reset-password/:token
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body || {};

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirmation are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirmation do not match'
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (verifyError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    if (decoded?.type !== 'tenant_password_reset' || !decoded?.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    if (decoded.accountId) {
      const account = await findDashboardAccountById(decoded.accountId);
      if (!account || account.tenantId !== decoded.id) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      const currentFingerprint = buildPasswordFingerprint(account.password);
      if (!decoded.pf || decoded.pf !== currentFingerprint) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Model hook hashes password on update; keep raw value here.
      account.password = password;
      account.passwordResetRequired = false;
      await account.save();
    } else {
      const tenant = await db.Tenant.findByPk(decoded.id);
      if (!tenant) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      const currentFingerprint = buildPasswordFingerprint(tenant.password);
      if (!decoded.pf || decoded.pf !== currentFingerprint) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Model hook hashes password on update; keep raw value here.
      tenant.password = password;
      await tenant.save();
    }

    return res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Tenant reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
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

      // Model hook hashes password on update; keep raw value here.
      account.password = newPassword;
      account.passwordResetRequired = false;
      await account.save();

      const passwordFingerprint = buildPasswordFingerprint(account.password);
      const accessToken = generateAccountAccessToken(req.tenantId, account.id, passwordFingerprint);
      const refreshToken = generateAccountRefreshToken(req.tenantId, account.id, passwordFingerprint);

      return res.json({
        success: true,
        message: 'Password changed successfully',
        accessToken,
        refreshToken,
        forceLogoutOtherSessions: true
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

    // Model hook hashes password on update; keep raw value here.
    tenant.password = newPassword;
    await tenant.save();

    const passwordFingerprint = buildPasswordFingerprint(tenant.password);
    const accessToken = generateAccessToken(tenant.id, passwordFingerprint);
    const refreshToken = generateRefreshToken(tenant.id, passwordFingerprint);

    return res.json({
      success: true,
      message: 'Password changed successfully',
      accessToken,
      refreshToken,
      forceLogoutOtherSessions: true
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
  changePassword,
  forgotPassword,
  resetPassword
};

