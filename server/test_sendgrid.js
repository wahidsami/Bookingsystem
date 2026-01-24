/**
 * Test SendGrid Email Sending
 * Quick script to verify SendGrid integration
 */

require('dotenv').config({ path: '../.env' });
const { sendWelcomeEmail } = require('./src/utils/emailService');

const testTenantData = {
    name_en: 'Luxury Salon & Spa',
    name_ar: 'صالون وسبا فاخر',
    email: 'wahidsami@gmail.com' // Test recipient
};

async function testSendGridEmail() {
    console.log('📧 Testing SendGrid email integration...\n');
    console.log('Sending welcome email to:', testTenantData.email);
    console.log('From:', process.env.SENDGRID_FROM_EMAIL);
    console.log('');

    try {
        const result = await sendWelcomeEmail(testTenantData);

        if (result.success) {
            console.log('✅ Email sent successfully!');
            console.log(`   Status Code: ${result.statusCode}`);
            console.log(`   Message ID: ${result.messageId}`);
            console.log('\n🎉 SendGrid integration is working perfectly!');
        } else {
            console.log('❌ Failed to send email');
            console.log(`   Error: ${result.error}`);
        }
    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
    }
}

testSendGridEmail();
