/**
 * Seed Script: Add 4 Salon Employees with Shifts and Service Assignments
 * 
 * This script:
 * 1. Creates 4 new female employees for the salon
 * 2. Assigns shifts from 14:00 to 22:00 (daily)
 * 3. Assigns all employees to all 3 services
 */

const db = require('./src/models');
const { Op } = require('sequelize');

// Configuration
const TENANT_SLUG = 'aleel-trading-1764421975123'; // Jasmin tenant
const SHIFT_START = '14:00';
const SHIFT_END = '22:00';

// Employee data
const EMPLOYEES = [
    {
        name: 'Noor Al-Mansouri',
        email: 'noor.almansouri@jasmin.sa',
        phone: '+966501234567',
        nationality: 'Saudi',
        bio: 'خبيرة تجميل متخصصة في العناية بالشعر والبشرة',
        experience: 5,
        skills: ['Hair Styling', 'Hair Coloring', 'Manicure', 'Facial Treatment'],
        rating: 4.8,
        salary: 5000,
        commissionRate: 20,
        isActive: true
    },
    {
        name: 'Maha Al-Otaibi',
        email: 'maha.otaibi@jasmin.sa',
        phone: '+966501234568',
        nationality: 'Saudi',
        bio: 'متخصصة في تصفيف الشعر والعناية بالأظافر',
        experience: 4,
        skills: ['Hair Styling', 'Nails Polishing', 'Manicure', 'Pedicure'],
        rating: 4.7,
        salary: 4500,
        commissionRate: 18,
        isActive: true
    },
    {
        name: 'Reem Al-Zahrani',
        email: 'reem.zahrani@jasmin.sa',
        phone: '+966501234569',
        nationality: 'Saudi',
        bio: 'خبيرة في صبغ الشعر والعلاجات التجميلية',
        experience: 6,
        skills: ['Hair Coloring', 'Facial Treatment', 'Hair Treatment'],
        rating: 4.9,
        salary: 5500,
        commissionRate: 22,
        isActive: true
    },
    {
        name: 'Huda Al-Shammari',
        email: 'huda.shammari@jasmin.sa',
        phone: '+966501234570',
        nationality: 'Saudi',
        bio: 'متخصصة في جميع خدمات التجميل',
        experience: 3,
        skills: ['Hair Styling', 'Nails Polishing', 'Hair Making', 'Hair Dressing'],
        rating: 4.6,
        salary: 4000,
        commissionRate: 15,
        isActive: true
    }
];

async function seedEmployees() {
    try {
        console.log('\n🚀 Starting employee seeding process...\n');

        // Find tenant
        console.log('📍 Finding tenant...');
        const tenant = await db.Tenant.findOne({
            where: { slug: TENANT_SLUG }
        });

        if (!tenant) {
            throw new Error(`Tenant not found: ${TENANT_SLUG}`);
        }
        console.log(`✅ Found tenant: ${tenant.name_en} (${tenant.slug})`);

        // Find services for this tenant
        console.log('\n📋 Finding services...');
        const services = await db.Service.findAll({
            where: { tenantId: tenant.id }
        });

        if (services.length === 0) {
            throw new Error(`No services found for tenant ${tenant.slug}`);
        }
        console.log(`✅ Found ${services.length} services:`);
        services.forEach(s => console.log(`   - ${s.name_en} (${s.name_ar})`));

        // Create employees
        console.log('\n👥 Creating employees...');
        const createdEmployees = [];

        for (const empData of EMPLOYEES) {
            // Check if employee already exists
            const existing = await db.Staff.findOne({
                where: {
                    tenantId: tenant.id,
                    email: empData.email
                }
            });

            if (existing) {
                console.log(`   ⚠️  Employee already exists: ${empData.name} (${empData.email})`);
                createdEmployees.push(existing);
                continue;
            }

            // Create employee
            const employee = await db.Staff.create({
                tenantId: tenant.id,
                ...empData
            });

            console.log(`   ✅ Created: ${employee.name} (${employee.email})`);
            createdEmployees.push(employee);
        }

        // Create shifts for all employees (Sunday to Saturday, 14:00-22:00)
        console.log('\n⏰ Creating shifts (14:00-22:00, daily)...');
        for (const employee of createdEmployees) {
            // Check if shifts already exist
            const existingShifts = await db.StaffShift.findAll({
                where: { staffId: employee.id }
            });

            if (existingShifts.length > 0) {
                console.log(`   ⚠️  Shifts already exist for ${employee.name}`);
                continue;
            }

            // Create shifts for all 7 days (0 = Sunday, 6 = Saturday)
            for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
                await db.StaffShift.create({
                    staffId: employee.id,
                    dayOfWeek: dayOfWeek,
                    startTime: SHIFT_START,
                    endTime: SHIFT_END,
                    isRecurring: true,
                    isActive: true,
                    label: 'Evening Shift'
                });
            }
            console.log(`   ✅ Created 7 daily shifts for ${employee.name}`);
        }

        // Assign employees to all services
        console.log('\n🔗 Assigning employees to services...');
        for (const employee of createdEmployees) {
            for (const service of services) {
                // Check if assignment already exists
                const existing = await db.ServiceEmployee.findOne({
                    where: {
                        staffId: employee.id,
                        serviceId: service.id
                    }
                });

                if (existing) {
                    console.log(`   ⚠️  ${employee.name} already assigned to ${service.name_en}`);
                    continue;
                }

                // Create assignment
                await db.ServiceEmployee.create({
                    staffId: employee.id,
                    serviceId: service.id,
                    commissionRate: employee.commissionRate,
                    isPrimary: false,
                    notes: null
                });

                console.log(`   ✅ Assigned ${employee.name} to ${service.name_en}`);
            }
        }

        // Summary
        console.log('\n═══════════════════════════════════════════════════════════════════');
        console.log('🎉 SEEDING COMPLETE!');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log(`\n📊 Summary:`);
        console.log(`   Tenant: ${tenant.name_en} (${tenant.slug})`);
        console.log(`   Employees created/verified: ${createdEmployees.length}`);
        console.log(`   Services: ${services.length}`);
        console.log(`   Shifts per employee: 7 (Sunday-Saturday)`);
        console.log(`   Shift hours: ${SHIFT_START} - ${SHIFT_END}`);
        console.log(`   Total service assignments: ${createdEmployees.length * services.length}`);
        console.log('\n✅ All employees are ready to accept bookings!\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the seeding
console.log('═══════════════════════════════════════════════════════════════════');
console.log('   🌟 Salon Employees Seeding Script 🌟');
console.log('═══════════════════════════════════════════════════════════════════');

seedEmployees();
