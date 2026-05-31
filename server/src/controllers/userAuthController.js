const userAuthService = require('../services/userAuthService');

const withTimeout = async (promise, timeoutMs, timeoutMessage = 'Request timed out') => {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            })
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
};

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
    const loginStartedAt = Date.now();
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        console.info('[UserAuth] Login attempt started', {
            email: `${email}`.trim().toLowerCase(),
            at: new Date(loginStartedAt).toISOString()
        });

        const result = await withTimeout(
            userAuthService.login(email, password),
            8000,
            'Login service timed out'
        );

        console.info('[UserAuth] Login attempt finished', {
            email: `${email}`.trim().toLowerCase(),
            durationMs: Date.now() - loginStartedAt
        });

        res.json({
            success: true,
            message: 'Login successful',
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            user: result.user
        });
    } catch (error) {
        const isTimeout = error.message === 'Login service timed out';
        console.error('[UserAuth] Login attempt failed', {
            email: `${req.body?.email || ''}`.trim().toLowerCase(),
            durationMs: Date.now() - loginStartedAt,
            error: error.message
        });

        res.status(isTimeout ? 503 : 401).json({
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

/**
 * Start Google onboarding (verify Google ID token and issue onboarding token)
 */
const googleStart = async (req, res) => {
    try {
        const { idToken } = req.body || {};
        const result = await userAuthService.verifyGoogleIdToken(idToken);

        res.json({
            success: true,
            message: result.requiresOnboarding === false ? 'Login successful' : 'Google account verified',
            requiresOnboarding: result.requiresOnboarding !== false,
            onboardingToken: result.onboardingToken,
            profile: result.profile,
            accessToken: result.tokens?.accessToken || null,
            refreshToken: result.tokens?.refreshToken || null,
            user: result.user || null,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Send phone OTP during Google onboarding
 */
const googleSendPhoneOtp = async (req, res) => {
    try {
        const { onboardingToken, phone } = req.body || {};
        if (!onboardingToken || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Onboarding token and phone are required'
            });
        }

        const result = await userAuthService.sendGooglePhoneOtp({ onboardingToken, phone });

        res.json({
            success: true,
            message: result.message,
            phone: result.phone,
            testCodeEnabled: result.testCodeEnabled
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Complete Google onboarding (phone OTP + names)
 */
const googleComplete = async (req, res) => {
    try {
        const { onboardingToken, phone, otp, firstName, lastName } = req.body || {};

        if (!onboardingToken || !phone || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Onboarding token, phone, and otp are required'
            });
        }

        const result = await userAuthService.completeGoogleRegistration({
            onboardingToken,
            phone,
            otp,
            firstName,
            lastName,
        });

        res.json({
            success: true,
            message: 'Login successful',
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
 * Open reset-password deep link with browser-safe fallback.
 * GET /api/v1/auth/user/reset-password/open?token=...
 */
const openResetPasswordLink = async (req, res) => {
    try {
        const token = `${req.query?.token || ''}`.trim();
        if (!token) {
            return res.status(400).send('Missing reset token');
        }

        const encodedToken = encodeURIComponent(token);
        const deepLink = `com.refah.mobile://reset-password?token=${encodedToken}`;
        const legacyDeepLink = `refah://reset-password?token=${encodedToken}`;

        // If a web URL is configured for customer app, use it as browser fallback.
        const customerAppUrl = `${process.env.CUSTOMER_APP_URL || ''}`.trim().replace(/\/+$/, '');
        const fallbackUrl = customerAppUrl
            ? `${customerAppUrl}/reset-password?token=${encodedToken}`
            : null;

        const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open Refah App</title>
    <style>
      body{font-family:Arial,sans-serif;background:#faf7ff;color:#1f1f33;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
      .card{max-width:420px;background:#fff;border:1px solid #e7def7;border-radius:16px;padding:24px;box-shadow:0 12px 30px rgba(76,29,149,.08)}
      h1{margin:0 0 8px;font-size:22px}
      p{margin:0 0 16px;line-height:1.5;color:#5b5b7b}
      a.btn{display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Open Refah App</h1>
      <p>Redirecting you to reset your password in the mobile app.</p>
      <a class="btn" href="${deepLink}">Open App</a>
    </div>
    <script>
      (function() {
        var deep = "${deepLink}";
        var legacy = "${legacyDeepLink}";
        var fallback = ${fallbackUrl ? `"${fallbackUrl}"` : "null"};
        var started = Date.now();
        window.location.href = deep;
        setTimeout(function(){ window.location.href = legacy; }, 250);
        setTimeout(function(){
          if (fallback && Date.now() - started < 2600) {
            window.location.href = fallback;
          }
        }, 1600);
      })();
    </script>
  </body>
</html>`;

        return res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (error) {
        return res.status(500).send('Unable to open reset link');
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
    resendVerification,
    googleStart,
    googleSendPhoneOtp,
    googleComplete,
    openResetPasswordLink
};
