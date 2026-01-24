/**
 * Environment Variable Validation Middleware
 * Ensures all required environment variables are set at server startup
 */

const validateEnvironment = () => {
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

    // Warn if using default/weak secrets in production
    if (process.env.NODE_ENV === 'production') {
        const defaultSecrets = [
            'your-super-secret-jwt-key-change-in-production',
            'your-secret-key',
            'rifah-super-admin-secret-key-2024',
            'dev_password'
        ];

        if (defaultSecrets.includes(process.env.JWT_SECRET)) {
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

    console.log('✅ Environment variables validated');
};

module.exports = validateEnvironment;
