const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

/**
 * Email Service Utility - Resend
 * Handles sending emails using Resend API
 */

let resendClient = null;

const getResendClient = () => {
    if (resendClient) return resendClient;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('[Email] RESEND_API_KEY not found in environment variables');
        return null;
    }
    resendClient = new Resend(apiKey);
    return resendClient;
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

        const client = getResendClient();
        if (!client) {
            throw new Error('Resend not initialized - missing RESEND_API_KEY');
        }

        const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL;
        if (!fromEmail) {
            throw new Error('Resend from address not set - set RESEND_FROM_EMAIL or FROM_EMAIL (e.g. Rifah <onboarding@yourdomain.com>)');
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

        // Resend supports inline images via contentId; keep cid:logo in HTML
        htmlContent = htmlContent.replace(/src="RifahNewLogoWhite\.png"/g, 'src="cid:logo"');

        const logoPath = path.join(__dirname, '../templates/emails', 'RifahNewLogoWhite.png');
        const attachments = [];

        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            attachments.push({
                filename: 'logo.png',
                content: logoBuffer.toString('base64'),
                contentId: 'logo'
            });
        }

        const payload = {
            from: fromEmail.includes('<') ? fromEmail : `Rifah Platform <${fromEmail}>`,
            to: Array.isArray(to) ? to : [to],
            subject,
            html: htmlContent
        };

        if (attachments.length > 0) {
            payload.attachments = attachments;
        }

        const { data: result, error } = await client.emails.send(payload);

        if (error) {
            console.error('[Email] Resend API error:', error);
            return {
                success: false,
                error: error.message || JSON.stringify(error)
            };
        }

        console.log(`[Email] Sent successfully to ${to}`, result?.id ? `(id: ${result.id})` : '');
        return {
            success: true,
            messageId: result?.id
        };

    } catch (error) {
        console.error('[Email] Failed to send email:', error.message);
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
 * Send approval email (includes dashboard/login link; optional payment link via data.paymentUrl)
 */
const sendApprovalEmail = async (tenantData) => {
    const loginUrl = process.env.TENANT_DASHBOARD_URL || 'http://localhost:3003/ar/login';
    const paymentUrl = process.env.TENANT_PAYMENT_LINK_URL || loginUrl; // use same as login if not set
    return sendEmail({
        to: tenantData.email,
        subject: 'Congratulations! Your Rifah Account is Approved ✨',
        template: 'approved',
        data: {
            tenantName: tenantData.name_en || tenantData.name,
            tenantNameAr: tenantData.name_ar || tenantData.nameAr,
            email: tenantData.email,
            loginUrl,
            paymentUrl
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
