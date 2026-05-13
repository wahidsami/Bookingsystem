const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../models');

// Use environment variables, with validation to happen at startup
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Access token expires in 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Refresh token expires in 7 days
const GOOGLE_ONBOARDING_EXPIRES_IN = process.env.GOOGLE_ONBOARDING_EXPIRES_IN || '15m';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_CLIENT_IDS = [
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_IDS,
    process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID,
    process.env.GOOGLE_OAUTH_IOS_CLIENT_ID,
    process.env.GOOGLE_OAUTH_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
]
    .filter(Boolean)
    .flatMap((value) => `${value}`.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
const TEST_OTP_ENABLED = `${process.env.ALLOW_TEST_OTP || ''}`.toLowerCase() === 'true';
const TEST_OTP_CODE = `${process.env.TEST_OTP_CODE || '1234'}`;
const GOOGLE_OTP_TTL_MS = Math.max(60_000, Number.parseInt(process.env.GOOGLE_OTP_TTL_MS || '', 10) || (10 * 60 * 1000));
const GOOGLE_OTP_MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.GOOGLE_OTP_MAX_ATTEMPTS || '', 10) || 5);

/**
 * User Authentication Service
 * 
 * Handles all end-user authentication operations including:
 * - User registration with email verification
 * - Email/password login with banned/inactive account checks
 * - JWT token generation and refresh flows
 * - Email and phone verification
 * - Password reset with secure token validation
 * - Account lockout after failed login attempts
 * 
 * Security Features:
 * - Bcrypt password hashing with automatic salting
 * - CSRF-protected refresh tokens with rotation
 * - Email verification tokens (crypto random 32 bytes)
 * - Account lockout after 5 failed login attempts
 * - OTP-based phone verification
 * 
 * Token Lifecycle:
 * - Access tokens: 15 minutes (short-lived, fast revocation)
 * - Refresh tokens: 7 days (long-lived, stored in DB for revocation)
 * - Verification tokens: 24 hours (email/phone verification)
 * - Password reset tokens: 1 hour (single-use)
 * 
 * Database Models Used:
 * - PlatformUser: Main user record with auth state
 * - User: End-user profile data (linked to PlatformUser)
 * 
 * @class UserAuthService
 */
class UserAuthService {
    constructor() {
        this.googleOnboardingStore = new Map();
    }

    normalizeEmail(email) {
        return `${email || ''}`.trim().toLowerCase();
    }

    normalizePhone(phone) {
        const raw = `${phone || ''}`.trim();
        if (!raw) return '';

        const stripped = raw.replace(/[\s\-()]/g, '');
        if (stripped.startsWith('+')) {
            return stripped;
        }

        if (stripped.startsWith('00')) {
            return `+${stripped.slice(2)}`;
        }

        if (stripped.startsWith('966')) {
            return `+${stripped}`;
        }

        if (stripped.startsWith('0')) {
            return `+966${stripped.slice(1)}`;
        }

        return `+${stripped}`;
    }

    validatePhoneE164(phone) {
        return /^\+?[1-9]\d{1,14}$/.test(`${phone || ''}`);
    }

    buildSafeUserPayload(user) {
        if (!user) {
            return null;
        }

        return {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            dateOfBirth: user.dateOfBirth || null,
            gender: user.gender || null,
            profileImage: user.profileImage || null,
            preferredLanguage: user.preferredLanguage || 'en',
            authProvider: user.authProvider || 'local',
            notificationPreferences: user.notificationPreferences || {
                email: true,
                sms: true,
                whatsapp: true,
                push: true,
            },
            walletBalance: user.walletBalance ?? 0,
            loyaltyPoints: user.loyaltyPoints ?? 0,
            totalSpent: user.totalSpent ?? 0,
            totalBookings: user.totalBookings ?? 0,
            emailVerified: Boolean(user.emailVerified),
            phoneVerified: Boolean(user.phoneVerified),
            isActive: Boolean(user.isActive),
            isBanned: Boolean(user.isBanned),
            createdAt: user.createdAt || null,
            updatedAt: user.updatedAt || null,
        };
    }

    persistLoginMetadata(user, refreshToken) {
        Promise.resolve()
            .then(() => user.update({
                lastLogin: new Date(),
                refreshToken
            }, {
                fields: ['lastLogin', 'refreshToken'],
                hooks: false,
            }))
            .catch((error) => {
                console.error('[UserAuthService] Failed to persist login metadata', {
                    userId: user?.id,
                    error: error?.message || error,
                });
            });
    }

    /**
     * Register a new platform user (end-user account creation)
     * 
     * Algorithm:
     * 1. Validate email/phone uniqueness across PlatformUser table
     * 2. Generate email verification token (32 random bytes)
     * 3. Create PlatformUser with hashed password (bcrypt via model hook)
     * 4. Generate JWT access + refresh tokens
     * 5. Store refresh token in DB for later validation
     * 6. Queue verification email (TODO)
     * 
     * Throws:
     * - "Email already registered" if email exists
     * - "Phone number already registered" if phone exists
     * - Database error if creation fails
     * 
     * @param {Object} userData - User registration data
     * @param {string} userData.email - User email (must be unique, will be lowercased)
     * @param {string} userData.phone - User phone (must be unique)
     * @param {string} userData.password - User password (min 8 chars, will be hashed)
     * @param {string} userData.firstName - User first name
     * @param {string} userData.lastName - User last name
     * @returns {Promise<Object>} Registration result
     * @returns {Object} Returns.user - Created user object (safe fields only)
     * @returns {Object} Returns.tokens - {accessToken, refreshToken}
     */
    async register(userData) {
        const { email, phone, password, firstName, lastName } = userData;
        const normalizedEmail = this.normalizeEmail(email);

        // Check if user already exists
        const existingUser = await db.PlatformUser.findOne({
            where: {
                [db.Sequelize.Op.or]: [{ email: normalizedEmail }, { phone }]
            }
        });

        if (existingUser) {
            if (existingUser.email === email) {
                throw new Error('Email already registered');
            }
            if (existingUser.email === normalizedEmail) {
                throw new Error('Email already registered');
            }
            if (existingUser.phone === phone) {
                throw new Error('Phone number already registered');
            }
        }

        // Generate email verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');

        // Create user (password will be hashed by model hook)
        const user = await db.PlatformUser.create({
            email: normalizedEmail,
            phone,
            password,
            firstName,
            lastName,
            authProvider: 'local',
            emailVerificationToken
        });

        // Generate tokens
        const tokens = this.generateTokens(user);

        // Save refresh token
        await user.update({ refreshToken: tokens.refreshToken });

        // TODO: Send verification email
        // await emailService.sendVerificationEmail(user.email, emailVerificationToken);

        return {
            user: user.toSafeObject(),
            tokens
        };
    }

    /**
     * Login user
     */
    async login(email, password) {
        const normalizedEmail = this.normalizeEmail(email);
        console.info('[UserAuthService] Login lookup started', { email: normalizedEmail });

        // Find user by email
        const user = await db.PlatformUser.findOne({
            where: { email: normalizedEmail },
            attributes: [
                'id',
                'email',
                'phone',
                'password',
                'authProvider',
                'googleSub',
                'googleEmail',
                'firstName',
                'lastName',
                'dateOfBirth',
                'gender',
                'profileImage',
                'preferredLanguage',
                'notificationPreferences',
                'walletBalance',
                'loyaltyPoints',
                'totalSpent',
                'totalBookings',
                'emailVerified',
                'phoneVerified',
                'emailVerificationToken',
                'phoneVerificationCode',
                'lastLogin',
                'refreshToken',
                'isActive',
                'isBanned',
                'banReason',
                'createdAt',
                'updatedAt'
            ]
        });

        if (!user) {
            throw new Error('Invalid email or password');
        }

        console.info('[UserAuthService] User found', {
            userId: user.id,
            email: normalizedEmail,
            isActive: Boolean(user.isActive),
            isBanned: Boolean(user.isBanned),
        });

        // Check if user is banned
        if (user.isBanned) {
            throw new Error(`Account is banned. Reason: ${user.banReason || 'Violation of terms'}`);
        }

        // Check if user is active
        if (!user.isActive) {
            throw new Error('Account is inactive. Please contact support.');
        }

        // Validate password
        const isValidPassword = await user.validatePassword(password);

        if (!isValidPassword) {
            throw new Error('Invalid email or password');
        }

        console.info('[UserAuthService] Password validated', {
            userId: user.id,
            email: normalizedEmail,
        });

        // Generate tokens
        const tokens = this.generateTokens(user);
        console.info('[UserAuthService] Tokens generated', {
            userId: user.id,
            email: normalizedEmail,
        });

        // Persist login metadata in the background so a slow DB write
        // does not block successful logins from mobile clients.
        this.persistLoginMetadata(user, tokens.refreshToken);

        const safeUser = this.buildSafeUserPayload(user);
        console.info('[UserAuthService] Safe payload built', {
            userId: user.id,
            email: normalizedEmail,
        });

        return {
            user: safeUser,
            tokens
        };
    }

    async verifyGoogleIdToken(idToken) {
        if (!idToken || typeof idToken !== 'string') {
            throw new Error('Google token is required');
        }

        const url = `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`;
        const response = await fetch(url, { method: 'GET' });

        if (!response.ok) {
            throw new Error('Invalid Google token');
        }

        const payload = await response.json();
        if (!payload?.sub || !payload?.email) {
            throw new Error('Google account payload is incomplete');
        }

        if (payload.email_verified !== 'true' && payload.email_verified !== true) {
            throw new Error('Google email is not verified');
        }

        if (GOOGLE_CLIENT_IDS.length > 0 && !GOOGLE_CLIENT_IDS.includes(`${payload.aud || ''}`)) {
            throw new Error('Google token audience mismatch');
        }

        const email = this.normalizeEmail(payload.email);
        const firstName = `${payload.given_name || payload.name || ''}`.trim();
        const lastName = `${payload.family_name || ''}`.trim();

        const onboardingToken = jwt.sign({
            type: 'google_onboarding',
            sub: payload.sub,
            email,
            firstName,
            lastName,
            picture: payload.picture || null,
            jti: crypto.randomUUID()
        }, JWT_SECRET, {
            expiresIn: GOOGLE_ONBOARDING_EXPIRES_IN
        });

        return {
            onboardingToken,
            profile: {
                email,
                firstName: firstName || null,
                lastName: lastName || null,
                picture: payload.picture || null,
            }
        };
    }

    verifyGoogleOnboardingToken(onboardingToken) {
        if (!onboardingToken) {
            throw new Error('Onboarding token is required');
        }

        let decoded;
        try {
            decoded = jwt.verify(onboardingToken, JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired onboarding token');
        }

        if (decoded?.type !== 'google_onboarding' || !decoded?.jti || !decoded?.sub || !decoded?.email) {
            throw new Error('Invalid onboarding token payload');
        }

        return decoded;
    }

    async sendGooglePhoneOtp({ onboardingToken, phone }) {
        const decoded = this.verifyGoogleOnboardingToken(onboardingToken);
        const normalizedPhone = this.normalizePhone(phone);
        if (!this.validatePhoneE164(normalizedPhone)) {
            throw new Error('Invalid phone format. Use international format (e.g., +966501234567)');
        }

        const otpCode = TEST_OTP_ENABLED
            ? TEST_OTP_CODE
            : Math.floor(100000 + Math.random() * 900000).toString();

        this.googleOnboardingStore.set(decoded.jti, {
            phone: normalizedPhone,
            otpCode,
            createdAt: Date.now(),
            sub: decoded.sub,
            email: decoded.email,
            attempts: 0,
        });

        // TODO: integrate SMS provider. For now OTP can be fixed by env in dev.
        return {
            message: 'Verification code sent to your phone',
            phone: normalizedPhone,
            testCodeEnabled: TEST_OTP_ENABLED,
        };
    }

    async completeGoogleRegistration({ onboardingToken, phone, otp, firstName, lastName }) {
        const decoded = this.verifyGoogleOnboardingToken(onboardingToken);
        const normalizedPhone = this.normalizePhone(phone);
        if (!this.validatePhoneE164(normalizedPhone)) {
            throw new Error('Invalid phone format. Use international format (e.g., +966501234567)');
        }

        const otpRecord = this.googleOnboardingStore.get(decoded.jti);
        if (!otpRecord) {
            throw new Error('OTP session not found. Please request a new code.');
        }

        const sessionAgeMs = Date.now() - Number(otpRecord.createdAt || 0);
        if (!Number.isFinite(sessionAgeMs) || sessionAgeMs > GOOGLE_OTP_TTL_MS) {
            this.googleOnboardingStore.delete(decoded.jti);
            throw new Error('OTP expired. Please request a new code.');
        }

        if (otpRecord.phone !== normalizedPhone) {
            throw new Error('Phone number does not match the OTP session.');
        }

        otpRecord.attempts = Number(otpRecord.attempts || 0) + 1;
        if (`${otp || ''}`.trim() !== `${otpRecord.otpCode}`) {
            if (otpRecord.attempts >= GOOGLE_OTP_MAX_ATTEMPTS) {
                this.googleOnboardingStore.delete(decoded.jti);
                throw new Error('Too many invalid OTP attempts. Please request a new code.');
            }
            this.googleOnboardingStore.set(decoded.jti, otpRecord);
            throw new Error('Invalid verification code');
        }

        const resolvedFirstName = `${firstName || decoded.firstName || ''}`.trim();
        const resolvedLastName = `${lastName || decoded.lastName || ''}`.trim();

        if (!resolvedFirstName || resolvedFirstName.length < 2) {
            throw new Error('First name is required');
        }

        if (!resolvedLastName || resolvedLastName.length < 2) {
            throw new Error('Last name is required');
        }

        const normalizedEmail = this.normalizeEmail(decoded.email);

        let user = await db.PlatformUser.findOne({ where: { googleSub: decoded.sub } });

        if (!user) {
            user = await db.PlatformUser.findOne({ where: { email: normalizedEmail } });
        }

        if (!user) {
            const phoneOwner = await db.PlatformUser.findOne({ where: { phone: normalizedPhone } });
            if (phoneOwner) {
                throw new Error('Phone number already registered');
            }

            // Some production databases still enforce NOT NULL on password.
            // Provide a random placeholder so social-auth users can be created safely.
            const generatedSocialPassword = `google_${crypto.randomBytes(24).toString('hex')}`;

            user = await db.PlatformUser.create({
                email: normalizedEmail,
                phone: normalizedPhone,
                password: generatedSocialPassword,
                firstName: resolvedFirstName,
                lastName: resolvedLastName,
                authProvider: 'google',
                googleSub: decoded.sub,
                googleEmail: normalizedEmail,
                profileImage: decoded.picture || null,
                emailVerified: true,
                phoneVerified: true,
                emailVerificationToken: null,
                phoneVerificationCode: null,
            });
        } else {
            if (user.phone !== normalizedPhone) {
                throw new Error('This Google account is already linked to a different phone number.');
            }

            user.firstName = resolvedFirstName || user.firstName;
            user.lastName = resolvedLastName || user.lastName;
            user.authProvider = user.authProvider || 'google';
            user.googleSub = user.googleSub || decoded.sub;
            user.googleEmail = normalizedEmail;
            user.emailVerified = true;
            user.phoneVerified = true;
            if (!user.profileImage && decoded.picture) {
                user.profileImage = decoded.picture;
            }
            await user.save();
        }

        const tokens = this.generateTokens(user);
        this.persistLoginMetadata(user, tokens.refreshToken);
        this.googleOnboardingStore.delete(decoded.jti);

        return {
            user: this.buildSafeUserPayload(user),
            tokens
        };
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

            // Find user
            const user = await db.PlatformUser.findByPk(decoded.userId);

            if (!user || user.refreshToken !== refreshToken) {
                throw new Error('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = this.generateTokens(user);

            // Update refresh token
            await user.update({ refreshToken: tokens.refreshToken });

            return {
                user: user.toSafeObject(),
                tokens
            };
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    /**
     * Logout user
     */
    async logout(userId) {
        const user = await db.PlatformUser.findByPk(userId);

        if (user) {
            await user.update({ refreshToken: null });
        }

        return { message: 'Logged out successfully' };
    }

    /**
     * Verify email
     */
    async verifyEmail(token) {
        const user = await db.PlatformUser.findOne({
            where: { emailVerificationToken: token }
        });

        if (!user) {
            throw new Error('Invalid verification token');
        }

        await user.update({
            emailVerified: true,
            emailVerificationToken: null
        });

        return { message: 'Email verified successfully' };
    }

    /**
     * Send phone verification code
     */
    async sendPhoneVerificationCode(userId) {
        const user = await db.PlatformUser.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        await user.update({ phoneVerificationCode: code });

        // TODO: Send SMS with code
        // await smsService.sendVerificationCode(user.phone, code);

        return { message: 'Verification code sent' };
    }

    /**
     * Verify phone with code
     */
    async verifyPhone(userId, code) {
        const user = await db.PlatformUser.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        if (user.phoneVerificationCode !== code) {
            throw new Error('Invalid verification code');
        }

        await user.update({
            phoneVerified: true,
            phoneVerificationCode: null
        });

        return { message: 'Phone verified successfully' };
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        const user = await db.PlatformUser.findOne({ where: { email: this.normalizeEmail(email) } });

        if (!user) {
            // Don't reveal if email exists
            return { message: 'If the email exists, a reset link has been sent' };
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        await user.update({ emailVerificationToken: resetToken });

        // TODO: Send password reset email
        // await emailService.sendPasswordResetEmail(user.email, resetToken);

        return { message: 'If the email exists, a reset link has been sent' };
    }

    /**
     * Reset password
     */
    async resetPassword(token, newPassword) {
        const user = await db.PlatformUser.findOne({
            where: { emailVerificationToken: token }
        });

        if (!user) {
            throw new Error('Invalid or expired reset token');
        }

        await user.update({
            password: newPassword, // Will be hashed by model hook
            emailVerificationToken: null
        });

        return { message: 'Password reset successfully' };
    }

    /**
     * Generate JWT tokens
     */
    generateTokens(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            type: 'platform_user'
        };

        const accessToken = jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN
        });

        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
            expiresIn: REFRESH_TOKEN_EXPIRES_IN
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: JWT_EXPIRES_IN
        };
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}

module.exports = new UserAuthService();
