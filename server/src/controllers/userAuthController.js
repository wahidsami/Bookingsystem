const userAuthService = require('../services/userAuthService');

/**
 * Register a new user
 */
const register = async (req, res) => {
    try {
        const { email, phone, password, firstName, lastName } = req.body;

        // Validation
        if (!email || !phone || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Phone validation (E.164 format)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone format. Use international format (e.g., +966501234567)'
            });
        }

        // Password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        const result = await userAuthService.register({
            email,
            phone,
            password,
            firstName,
            lastName
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your email.',
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            user: result.user
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Login user
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const result = await userAuthService.login(email, password);

        res.json({
            success: true,
            message: 'Login successful',
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            user: result.user
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Refresh access token
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

        const result = await userAuthService.refreshToken(refreshToken);

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
    try {
        await userAuthService.logout(req.userId);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        await userAuthService.verifyEmail(token);

        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Send phone verification code
 */
const sendPhoneVerification = async (req, res) => {
    try {
        await userAuthService.sendPhoneVerificationCode(req.userId);

        res.json({
            success: true,
            message: 'Verification code sent to your phone'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Verify phone with code
 */
const verifyPhone = async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Verification code is required'
            });
        }

        await userAuthService.verifyPhone(req.userId, code);

        res.json({
            success: true,
            message: 'Phone verified successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Request password reset
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        await userAuthService.requestPasswordReset(email);

        res.json({
            success: true,
            message: 'If the email exists, a reset link has been sent'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        await userAuthService.resetPassword(token, password);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Resend verification email
 */
const resendVerification = async (req, res) => {
    try {
        // TODO: Implement resend verification
        res.json({
            success: true,
            message: 'Verification email sent'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    verifyEmail,
    sendPhoneVerification,
    verifyPhone,
    forgotPassword,
    resetPassword,
    resendVerification
};
