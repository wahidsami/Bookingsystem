process.env.NODE_ENV = 'development';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';
process.env.POSTGRES_DB = 'rifah_clean';

const db = require('./src/models');
const jwt = require('jsonwebtoken');

async function testRollback() {
    try {
        console.log('Connecting to DB to get a tenant...');
        const tenant = await db.Tenant.findOne({ where: { status: 'active' } });
        if (!tenant) throw new Error('No active tenant found');

        const tenantAccount = await db.TenantDashboardAccount.findOne({ where: { tenantId: tenant.id } });
        if (!tenantAccount) throw new Error('No tenant account found');

        const packageObj = await db.TenantGiftCardPackage.findOne({ where: { tenantId: tenant.id } });
        if (!packageObj) {
            console.log('Creating a dummy package...');
            await db.TenantGiftCardPackage.create({
                tenantId: tenant.id,
                title: 'Test Package',
                priceAmount: 100,
                walletCreditAmount: 100,
                isActive: true
            });
        }
        const activePackage = await db.TenantGiftCardPackage.findOne({ where: { tenantId: tenant.id } });

        console.log('Authenticating as tenant...');
        const token = jwt.sign({
            id: tenant.id,
            type: 'tenant_account',
            accountId: tenantAccount.id,
            role: tenantAccount.role
        }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

        console.log('Calling API to purchase gift card (expecting failure due to FK violation)...');
        
        // Count records before
        const giftTxCountBefore = await db.TenantGiftCardTransaction.count();
        const paymentTxCountBefore = await db.PaymentTransaction.count();

        try {
            const response = await fetch('http://localhost:5000/api/v1/tenant/cart/gift-cards/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    packageId: activePackage.id,
                    customerName: 'Test External User',
                    customerEmail: 'external@test.com',
                    customerPhone: '+1234567890',
                    amount: activePackage.priceAmount,
                    paymentMethod: 'cash',
                    paymentAllocations: [{ paymentMethod: 'cash', amount: activePackage.priceAmount }]
                })
            });
            const data = await response.json();
            if (response.ok) {
                console.log('API returned success! (THIS IS BAD if we expect rollback)');
                console.log(data);
            } else {
                console.log(`API returned error as expected: ${response.status}`);
                console.log(data);
            }
        } catch (err) {
            console.log('API call failed:');
            console.log(err.message);
        }

        // Count records after
        const giftTxCountAfter = await db.TenantGiftCardTransaction.count();
        const paymentTxCountAfter = await db.PaymentTransaction.count();

        console.log('Gift Card TX diff:', giftTxCountAfter - giftTxCountBefore);
        console.log('Payment TX diff:', paymentTxCountAfter - paymentTxCountBefore);
        
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testRollback();
