'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const {
  ROLE_OPTIONS,
  normalizeDashboardPermissions,
  getDashboardRoleLabel
} = require('../utils/tenantDashboardPermissions');
const { sendDashboardAccountInviteEmail } = require('../utils/emailService');
const { getTenantDashboardLoginUrl } = require('../utils/url');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const generateTemporaryPassword = () => {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `Rifah!${suffix}`;
};

const sanitizeAccount = (account) => {
  if (!account) return null;
  const json = account.toJSON ? account.toJSON() : { ...account };
  delete json.password;
  return {
    ...json,
    permissions: normalizeDashboardPermissions(json.permissions || {}, json.roleKey)
  };
};

const ensureEmailAvailability = async (email, tenantId, excludeAccountId = null) => {
  const tenantCollision = await db.Tenant.findOne({
    where: { email: { [Op.iLike]: email } }
  });

  if (tenantCollision) {
    throw new Error('This email is already used by a tenant account');
  }

  const existingAccount = await db.TenantDashboardAccount.findOne({
    where: {
      email: { [Op.iLike]: email },
      ...(excludeAccountId ? { id: { [Op.ne]: excludeAccountId } } : {})
    }
  });

  if (existingAccount) {
    throw new Error('This email is already used by another dashboard account');
  }

  const tenantScopedCollision = await db.TenantDashboardAccount.findOne({
    where: {
      tenantId,
      email: { [Op.iLike]: email },
      ...(excludeAccountId ? { id: { [Op.ne]: excludeAccountId } } : {})
    }
  });

  if (tenantScopedCollision) {
    throw new Error('This email is already used by this tenant');
  }
};

const isValidRoleKey = (roleKey) => ROLE_OPTIONS.some((option) => option.value === roleKey);

const writeActivityLog = async ({ req, tenantId, accountId, action, details, previousValue, newValue }) => {
  try {
    await db.ActivityLog.create({
      entityType: 'tenant',
      entityId: tenantId,
      action,
      performedByType: 'tenant_user',
      performedById: req.tenantAccount?.id || req.tenant?.id || tenantId,
      performedByName: req.tenantAccount?.displayName || req.tenant?.name || req.tenant?.name_en || 'Tenant user',
      details: {
        ...details,
        accountId
      },
      previousValue,
      newValue,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } catch (error) {
    console.warn('Failed to log dashboard account activity:', error.message);
  }
};

exports.listAccounts = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const accounts = await db.TenantDashboardAccount.findAll({
      where: { tenantId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      accounts: accounts.map(sanitizeAccount)
    });
  } catch (error) {
    console.error('List dashboard accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard accounts',
      error: error.message
    });
  }
};

exports.getRoleOptions = async (_req, res) => {
  res.json({
    success: true,
    roles: ROLE_OPTIONS
  });
};

exports.createAccount = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      displayName,
      email,
      password,
      roleKey = 'custom',
      permissions = {},
      isActive = true
    } = req.body;

    if (!displayName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Display name and email are required'
      });
    }

    if (!isValidRoleKey(roleKey)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role selected'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    await ensureEmailAvailability(normalizedEmail, tenantId);

    const temporaryPassword = password ? null : generateTemporaryPassword();
    const finalPassword = password || temporaryPassword;
    const normalizedPermissions = normalizeDashboardPermissions(permissions, roleKey);

    const account = await db.TenantDashboardAccount.create({
      tenantId,
      displayName: String(displayName).trim(),
      email: normalizedEmail,
      password: finalPassword,
      roleKey,
      permissions: normalizedPermissions,
      isActive: isActive === true || isActive === 'true',
      passwordResetRequired: !password
    });

    await writeActivityLog({
      req,
      tenantId,
      accountId: account.id,
      action: 'created',
      details: {
        event: 'dashboard_account_created',
        roleKey
      },
      newValue: sanitizeAccount(account)
    });

    res.status(201).json({
      success: true,
      message: 'Dashboard account created successfully',
      account: sanitizeAccount(account),
      temporaryPassword
    });
  } catch (error) {
    console.error('Create dashboard account error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create dashboard account'
    });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const account = await db.TenantDashboardAccount.findOne({
      where: { id, tenantId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard account not found'
      });
    }

    const previousValue = sanitizeAccount(account);
    const updates = {};

    if (req.body.displayName !== undefined) {
      updates.displayName = String(req.body.displayName).trim();
    }
    if (req.body.email !== undefined) {
      const normalizedEmail = normalizeEmail(req.body.email);
      await ensureEmailAvailability(normalizedEmail, tenantId, account.id);
      updates.email = normalizedEmail;
    }
    if (req.body.roleKey !== undefined) {
      if (!isValidRoleKey(req.body.roleKey)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role selected'
        });
      }
      updates.roleKey = req.body.roleKey;
      if (req.body.permissions === undefined) {
        updates.permissions = normalizeDashboardPermissions({}, req.body.roleKey);
      }
    }
    if (req.body.permissions !== undefined) {
      updates.permissions = normalizeDashboardPermissions(req.body.permissions, updates.roleKey || account.roleKey);
    }
    if (req.body.isActive !== undefined) {
      updates.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }

    await account.update(updates);

    await writeActivityLog({
      req,
      tenantId,
      accountId: account.id,
      action: 'updated',
      details: {
        event: 'dashboard_account_updated'
      },
      previousValue,
      newValue: sanitizeAccount(account)
    });

    res.json({
      success: true,
      message: 'Dashboard account updated successfully',
      account: sanitizeAccount(account)
    });
  } catch (error) {
    console.error('Update dashboard account error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update dashboard account'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const account = await db.TenantDashboardAccount.findOne({
      where: { id, tenantId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard account not found'
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    await account.update({
      password: temporaryPassword,
      passwordResetRequired: true,
      isActive: true
    });

    await writeActivityLog({
      req,
      tenantId,
      accountId: account.id,
      action: 'password_change',
      details: {
        event: 'dashboard_account_password_reset'
      }
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
      temporaryPassword
    });
  } catch (error) {
    console.error('Reset dashboard account password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset dashboard account password',
      error: error.message
    });
  }
};

exports.deactivateAccount = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const account = await db.TenantDashboardAccount.findOne({
      where: { id, tenantId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard account not found'
      });
    }

    await account.update({
      isActive: false
    });

    await writeActivityLog({
      req,
      tenantId,
      accountId: account.id,
      action: 'updated',
      details: {
        event: 'dashboard_account_deactivated'
      }
    });

    res.json({
      success: true,
      message: 'Dashboard account disabled successfully',
      account: sanitizeAccount(account)
    });
  } catch (error) {
    console.error('Deactivate dashboard account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable dashboard account',
      error: error.message
    });
  }
};

exports.sendInvite = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const account = await db.TenantDashboardAccount.findOne({
      where: { id, tenantId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard account not found'
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const nextPassword = temporaryPassword;
    await account.update({
      password: nextPassword,
      passwordResetRequired: true,
      isActive: true
    });

    const tenant = await db.Tenant.findByPk(tenantId, {
      attributes: ['name', 'name_en', 'name_ar', 'settings']
    });

    const locale = tenant?.settings?.language === 'en' ? 'en' : 'ar';
    const loginUrl = getTenantDashboardLoginUrl(locale);
    const emailResult = await sendDashboardAccountInviteEmail({
      email: account.email,
      displayName: account.displayName,
      tenantName: tenant?.name_ar || tenant?.name_en || tenant?.name || 'Rifah',
      temporaryPassword,
      loginUrl
    });

    await writeActivityLog({
      req,
      tenantId,
      accountId: account.id,
      action: 'updated',
      details: {
        event: 'dashboard_account_invite_sent',
        emailSent: emailResult.success
      }
    });

    res.json({
      success: true,
      message: emailResult.success
        ? 'Invitation email sent successfully'
        : 'Account updated, but invitation email could not be sent',
      temporaryPassword,
      emailSent: emailResult.success,
      emailError: emailResult.success ? null : emailResult.error,
      account: sanitizeAccount(account)
    });
  } catch (error) {
    console.error('Send dashboard account invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invitation email',
      error: error.message
    });
  }
};
