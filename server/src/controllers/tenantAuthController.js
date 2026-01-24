/**
 * Tenant Authentication Controller
 * Handles login, logout, token refresh for tenant users (salon/spa owners)
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
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
 * Generate refresh token
 */
const generateRefreshToken = (tenantId) => {
  return jwt.sign(
    { id: tenantId, type: 'tenant', isRefresh: true },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
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

    // Find tenant by email
    const tenant = await db.Tenant.findOne({ where: { email: email.toLowerCase() } });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check account status
    if (tenant.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin approval.',
        status: 'pending'
      });
    }

    if (tenant.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact support.',
        status: 'rejected'
      });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.',
        status: 'suspended'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, tenant.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    tenant.lastLogin = new Date();
    await tenant.save();

    // Generate tokens
    const accessToken = generateAccessToken(tenant.id);
    const refreshToken = generateRefreshToken(tenant.id);

    // Remove password from response
    const tenantData = tenant.toJSON();
    delete tenantData.password;

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      tenant: tenantData
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
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== 'tenant' || !decoded.isRefresh) {
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

    if (tenant.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Account is ${tenant.status}`,
        status: tenant.status
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(tenant.id);

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

    res.json({
      success: true,
      tenant
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

module.exports = {
  login,
  logout,
  refreshToken,
  getProfile,
  updateProfile
};

