/**
 * Script to create a test tenant directly in the production DB
 * Run this from the server directory: node create-test-tenant.js
 */
const db = require('./src/models');
const bcrypt = require('bcryptjs');

async function createTestTenant() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ Database connected');

        const password = 'TestTenant@2024';
        const hashedPassword = await bcrypt.hash(password, 12);

        // Check if already exists
        const existing = await db.Tenant.findOne({ where: { email: 'test@rifah.sa' } });
        if (existing) {
            console.log('⚠️  Tenant already exists, updating to approved...');
            await existing.update({ status: 'approved' });
            console.log('✅ Tenant status set to approved');
            console.log('\n🔑 Login credentials:');
            console.log('   Email:    test@rifah.sa');
            console.log('   Password: TestTenant@2024');
            process.exit(0);
        }

        // Create tenant
        const tenant = await db.Tenant.create({
            name: 'Rifah Test Salon',
            name_en: 'Rifah Test Salon',
            name_ar: 'صالون رفاه التجريبي',
            nameAr: 'صالون رفاه التجريبي',
            slug: 'rifah-test-salon',
            dbSchema: 'tenant_rifah_test_salon',
            businessType: 'salon',
            email: 'test@rifah.sa',
            password: hashedPassword,
            phone: '+966501234567',
            mobile: '+966501234567',
            status: 'approved',  // directly approved
            city: 'Riyadh',
            country: 'Saudi Arabia',
            contactPersonNameEn: 'Test Admin',
            contactPersonNameAr: 'مدير تجريبي',
            contactPersonEmail: 'test@rifah.sa',
            ownerNameEn: 'Test Owner',
            ownerNameAr: 'مالك تجريبي',
            settings: {
                currency: 'SAR',
                timezone: 'Asia/Riyadh',
                language: 'ar',
            }
        });

        console.log('✅ Test tenant created & approved successfully!');
        console.log('\n🔑 Login credentials for rtenant.unifinitylab.com:');
        console.log('   Email:    test@rifah.sa');
        console.log('   Password: TestTenant@2024');
        console.log(`   Tenant ID: ${tenant.id}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.sequelize.close();
        process.exit(0);
    }
}

createTestTenant();
