/**
 * Environment Variable Validation Middleware
 * Ensures all required environment variables are set at server startup
 */

const validateEnvironment = () => {
    const env = process.env.NODE_ENV || 'development';
    const requiredVars = [
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
        'DB_HOST',
        'DB_PORT',
        'PORT',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET'
    ];

    const missingVars = requiredVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        const errorMessage = `
❌ CRITICAL: Missing required environment variables:
${missingVars.map(v => `   - ${v}`).join('\n')}

Please add these to your .env file.
See .env.example for reference.
        `;
        console.error(errorMessage);
        process.exit(1);
    }

    const defaultSecrets = [
        'your-super-secret-jwt-key-change-in-production',
        'your-secret-key',
        'rifah-super-admin-secret-key-2024',
        'dev_password'
    ];

    const jwtSecret = process.env.JWT_SECRET || '';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';

    // Warn if using default/weak secrets in production
    if (env === 'production') {
        if (defaultSecrets.includes(jwtSecret)) {
            console.warn(`
⚠️  WARNING: Using default JWT_SECRET in production!
This is a SECURITY RISK. Please set a strong JWT_SECRET in .env.
            `);
        }

        if (process.env.POSTGRES_PASSWORD === 'dev_password') {
            console.warn(`
⚠️  WARNING: Using weak database password in production!
This is a SECURITY RISK. Please set a strong POSTGRES_PASSWORD in .env.
            `);
        }
    }

    if (jwtSecret.length < 32) {
        console.warn(`
⚠️  WARNING: JWT_SECRET is shorter than 32 characters.
Use a long random secret for production deployments.
        `);
    }

    if (jwtRefreshSecret.length < 32) {
        console.warn(`
⚠️  WARNING: JWT_REFRESH_SECRET is shorter than 32 characters.
Use a long random secret for production deployments.
        `);
    }

    if (jwtSecret === jwtRefreshSecret) {
        console.warn(`
⚠️  WARNING: JWT_SECRET and JWT_REFRESH_SECRET are identical.
Use separate secrets to reduce token compromise impact.
        `);
    }

    if (env === 'production') {
        if (!process.env.SERVER_PUBLIC_URL) {
            console.warn(`
⚠️  WARNING: SERVER_PUBLIC_URL is not set.
Public asset URLs may be returned as relative paths in production.
            `);
        }

        if (!process.env.TENANT_DASHBOARD_BASE_URL && !process.env.TENANT_DASHBOARD_URL) {
            console.warn(`
⚠️  WARNING: TENANT_DASHBOARD_BASE_URL is not set.
Approval and payment emails may not contain valid tenant dashboard links.
            `);
        }
    }

    console.log('✅ Environment variables validated');
};

module.exports = validateEnvironment;
