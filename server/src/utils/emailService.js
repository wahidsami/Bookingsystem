const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

/**
 * Email Service Utility - SendGrid
 * Handles sending emails using SendGrid API
 */

// Initialize SendGrid with API key
const initializeSendGrid = () => {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
        console.error('[Email] SENDGRID_API_KEY not found in environment variables');
        return false;
    }

    sgMail.setApiKey(apiKey);
    return true;
};

/**
 * Send email using template
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (welcome, approved, rejected)
 * @param {Object} options.data - Data to populate template
 * @returns {Promise} - Resolves when email is sent
 */
const sendEmail = async (options) => {
    try {
        const { to, subject, template, data } = options;

        // Initialize SendGrid
        if (!initializeSendGrid()) {
            throw new Error('SendGrid not initialized - missing API key');
        }

        // Load template
        const templatePath = path.join(__dirname, '../templates/emails', `${template}.html`);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Email template '${template}' not found at ${templatePath}`);
        }

        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Replace placeholders with actual data
        Object.keys(data).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            htmlContent = htmlContent.replace(placeholder, data[key] || '');
        });

        // Replace local logo path with CID for email embedding
        htmlContent = htmlContent.replace(/src="RifahNewLogoWhite\.png"/g, 'src="cid:logo"');

        // Load logo and convert to base64
        const logoPath = path.join(__dirname, '../templates/emails', 'RifahNewLogoWhite.png');
        let attachments = [];

        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            const logoBase64 = logoBuffer.toString('base64');

            attachments.push({
                content: logoBase64,
                filename: 'logo.png',
                type: 'image/png',
                disposition: 'inline',
                content_id: 'logo'
            });
        }

        // Email message object
        const msg = {
            to,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: 'Rifah Platform'
            },
            subject,
            html: htmlContent,
            attachments: attachments
        };

        // Send email
        const response = await sgMail.send(msg);

        console.log(`[Email] Sent successfully to ${to}`);
        console.log(`[Email] SendGrid Status Code: ${response[0].statusCode}`);

        return {
            success: true,
            statusCode: response[0].statusCode,
            messageId: response[0].headers['x-message-id']
        };

    } catch (error) {
        console.error(`[Email] Failed to send email:`, error.message);

        if (error.response) {
            console.error(`[Email] SendGrid Error Details:`, error.response.body);
        }

        // Don't throw error - just log it
        // We don't want email failures to crash the app
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send welcome email after registration
 */
const sendWelcomeEmail = async (tenantData) => {
    return sendEmail({
        to: tenantData.email,
        subject: 'Welcome to Rifah - Registration Received',
        template: 'welcome',
        data: {
            tenantName: tenantData.name_en || tenantData.name,
            tenantNameAr: tenantData.name_ar || tenantData.nameAr,
            email: tenantData.email
        }
    });
};

/**
 * Send approval email
 */
const sendApprovalEmail = async (tenantData) => {
    return sendEmail({
        to: tenantData.email,
        subject: 'Congratulations! Your Rifah Account is Approved ✨',
        template: 'approved',
        data: {
            tenantName: tenantData.name_en || tenantData.name,
            tenantNameAr: tenantData.name_ar || tenantData.nameAr,
            email: tenantData.email,
            loginUrl: process.env.TENANT_DASHBOARD_URL || 'http://localhost:3003/ar/login'
        }
    });
};

/**
 * Send rejection email
 */
const sendRejectionEmail = async (tenantData, reason) => {
    return sendEmail({
        to: tenantData.email,
        subject: 'Rifah Account Application Update',
        template: 'rejected',
        data: {
            tenantName: tenantData.name_en || tenantData.name,
            tenantNameAr: tenantData.name_ar || tenantData.nameAr,
            reason: reason || 'Please contact support for more information'
        }
    });
};

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendApprovalEmail,
    sendRejectionEmail
};
