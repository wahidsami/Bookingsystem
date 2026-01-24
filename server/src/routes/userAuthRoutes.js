const express = require('express');
const router = express.Router();
const userAuthController = require('../controllers/userAuthController');
const { authenticateUser } = require('../middleware/authUser');

/**
 * @route   POST /api/v1/auth/user/register
 * @desc    Register a new platform user
 * @access  Public
 */
router.post('/register', userAuthController.register);

/**
 * @route   POST /api/v1/auth/user/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', userAuthController.login);

/**
 * @route   POST /api/v1/auth/user/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', userAuthController.refreshToken);

/**
 * @route   POST /api/v1/auth/user/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateUser, userAuthController.logout);

/**
 * @route   GET /api/v1/auth/user/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify-email/:token', userAuthController.verifyEmail);

/**
 * @route   POST /api/v1/auth/user/send-phone-verification
 * @desc    Send phone verification code
 * @access  Private
 */
router.post('/send-phone-verification', authenticateUser, userAuthController.sendPhoneVerification);

/**
 * @route   POST /api/v1/auth/user/verify-phone
 * @desc    Verify phone with code
 * @access  Private
 */
router.post('/verify-phone', authenticateUser, userAuthController.verifyPhone);

/**
 * @route   POST /api/v1/auth/user/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', userAuthController.forgotPassword);

/**
 * @route   POST /api/v1/auth/user/reset-password/:token
 * @desc    Reset password
 * @access  Public
 */
router.post('/reset-password/:token', userAuthController.resetPassword);

/**
 * @route   POST /api/v1/auth/user/resend-verification
 * @desc    Resend verification email
 * @access  Private
 */
router.post('/resend-verification', authenticateUser, userAuthController.resendVerification);

module.exports = router;
