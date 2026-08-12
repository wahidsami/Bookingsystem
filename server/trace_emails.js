const path = require('path');
const { Sequelize } = require('sequelize');
const db = require('./src/models');
const tenantRegistrationController = require('./src/controllers/tenantRegistrationController');
const adminTenantsController = require('./src/controllers/adminTenantsController');
const emailService = require('./src/utils/emailService');

// Mocking emailService
const originalSendWelcomeEmail = emailService.sendWelcomeEmail;
const originalSendApprovalEmail = emailService.sendApprovalEmail;
const originalSendEmail = emailService.sendEmail;

let emailTrace = [];

emailService.sendWelcomeEmail = async (...args) => {
    emailTrace.push({ event: 'sendWelcomeEmail', args });
    return { success: true };
};

emailService.sendApprovalEmail = async (...args) => {
    emailTrace.push({ event: 'sendApprovalEmail', args });
    return { success: true };
};

emailService.sendEmail = async (...args) => {
    emailTrace.push({ event: 'sendEmail', args });
    return { success: true };
};

async function runTrace() {
    console.log('--- STARTING RUNTIME TRACE ---');
    await db.sequelize.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS region VARCHAR(255);');
    await db.sequelize.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "nationalAddressDocument" VARCHAR(255);');
    
    // 1. Setup Mock Request for Registration
    const reqRegister = {
        body: {
            name_en: 'Test Tenant Email Trace',
            name_ar: 'تست تينانت',
            businessType: ['salon'],
            email: 'trace_test_' + Date.now() + '@example.com',
            mobile: '+966500000001',
            password: 'Password123!',
            ownerNameEn: 'Test Owner',
            ownerNameAr: 'تست أونر',
            ownerPhone: '+966500000001',
            ownerEmail: 'owner@example.com',
            ownerNationalId: '1000000000',
            crNumber: '1234567890',
            taxNumber: '300000000000003',
            contactPersonNameAr: 'تست كونتاكت',
            contactPersonNameEn: 'Test Contact',
            contactPersonEmail: 'contact@example.com',
            contactPersonMobile: '+966500000001',
            contactPersonPosition: 'Manager',
            selectedPackageId: 1, // Basic package
            selectedBillingPeriod: 'monthly',
            acceptedServiceAgreement: true
        },
        files: {
            logo: [{ path: 'uploads/tenants/misc/logo.png' }],
            crDocument: [{ path: 'uploads/tenants/documents/cr.png' }],
            taxDocument: [{ path: 'uploads/tenants/documents/tax.png' }],
            nationalAddressDocument: [{ path: 'uploads/tenants/documents/na.png' }]
        },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'trace-script' }
    };

    const resRegister = {
        status: function(s) { this.statusCode = s; return this; },
        json: function(data) { this.data = data; return this; }
    };

    console.log('[Trace] Calling tenantRegistrationController.register()...');
    
    // Make sure we have a package id 1 in db, or fetch one
    const pkg = await db.SubscriptionPackage.findOne({ where: { isActive: true } });
    if (!pkg) {
        console.log('No active package found. Exiting.');
        return;
    }
    reqRegister.body.selectedPackageId = pkg.id;

    await tenantRegistrationController.register(reqRegister, resRegister);

    console.log('[Trace] Registration Response Status:', resRegister.statusCode);
    if (resRegister.statusCode !== 201) {
        console.log('Registration failed:', resRegister.data);
        return;
    }
    
    const tenantId = resRegister.data.tenant.id;
    console.log(`[Trace] Tenant Created with ID: ${tenantId}`);

    // Allow async background email promises to resolve
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[Trace] Emails triggered after registration:', emailTrace.length);
    emailTrace.forEach(t => console.log(`  -> ${t.event}`));

    // Reset trace
    emailTrace = [];

    // 2. Setup Mock Request for Approval
    const reqApprove = {
        params: { id: tenantId },
        body: {
            notes: 'Approved via trace script'
        },
        adminId: '00000000-0000-0000-0000-000000000001',
        adminName: 'Trace Admin',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'trace-script' }
    };

    const resApprove = {
        status: function(s) { this.statusCode = s; return this; },
        json: function(data) { this.data = data; return this; }
    };

    console.log('[Trace] Calling adminTenantsController.approveTenant()...');
    
    await adminTenantsController.approveTenant(reqApprove, resApprove);

    console.log('[Trace] Approval Response Status:', resApprove.statusCode);
    if (resApprove.statusCode !== 200) {
        console.log('Approval failed:', resApprove.data);
    }

    // Allow async background email promises to resolve
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[Trace] Emails triggered after approval:', emailTrace.length);
    emailTrace.forEach(t => console.log(`  -> ${t.event}`));

    console.log('--- END RUNTIME TRACE ---');
    
    // Cleanup
    await db.Tenant.destroy({ where: { id: tenantId }, force: true });
}

runTrace().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
