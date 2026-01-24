const db = require('./src/models');

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...\n');

        // Sync database models in correct order (dependencies first)
        console.log('🔄 Syncing database models...');

        // 1. Sync independent tables first
        await db.Tenant.sync({ force: false });
        await db.User.sync({ force: false });
        await db.Service.sync({ force: false });
        await db.Customer.sync({ force: false });
        await db.Staff.sync({ force: false });

        // 2. Sync dependent tables
        await db.StaffSchedule.sync({ force: false });

        // 3. Sync junction table for many-to-many
        await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "StaffServices" (
        "staffId" UUID REFERENCES "staff"("id") ON DELETE CASCADE,
        "serviceId" UUID REFERENCES "services"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        PRIMARY KEY ("staffId", "serviceId")
      );
    `);

        // 4. Finally sync Appointment (depends on Service, Staff, Customer)
        await db.Appointment.sync({ force: false });

        console.log('✅ Database models synced\n');

        // 1. Create sample services
        console.log('📋 Creating services...');
        const services = await db.Service.bulkCreate([
            {
                name_en: 'Haircut & Styling',
                name_ar: 'قص وتصفيف الشعر',
                description_en: 'Professional haircut with styling',
                description_ar: 'قص شعر احترافي مع التصفيف',
                category: 'hair',
                duration: 45,
                basePrice: 150.00,
                isActive: true
            },
            {
                name_en: 'Hair Coloring',
                name_ar: 'صبغ الشعر',
                description_en: 'Full hair coloring service',
                description_ar: 'خدمة صبغ الشعر الكاملة',
                category: 'hair',
                duration: 90,
                basePrice: 350.00,
                isActive: true
            },
            {
                name_en: 'Manicure & Pedicure',
                name_ar: 'مانيكير وباديكير',
                description_en: 'Complete nail care service',
                description_ar: 'خدمة العناية بالأظافر الكاملة',
                category: 'nails',
                duration: 60,
                basePrice: 120.00,
                isActive: true
            },
            {
                name_en: 'Facial Treatment',
                name_ar: 'علاج الوجه',
                description_en: 'Deep cleansing facial treatment',
                description_ar: 'علاج الوجه بالتنظيف العميق',
                category: 'facial',
                duration: 60,
                basePrice: 250.00,
                isActive: true
            }
        ]);
        console.log(`✅ Created ${services.length} services\n`);

        // 2. Create sample staff members
        console.log('👥 Creating staff members...');
        const staff = await db.Staff.bulkCreate([
            {
                name: 'Sarah Ahmed',
                email: 'sarah@rifah.sa',
                phone: '+966501234567',
                skills: ['haircut', 'styling', 'coloring'],
                rating: 4.9,
                totalBookings: 245,
                commission: 30.0,
                isActive: true
            },
            {
                name: 'Fatima Al-Rashid',
                email: 'fatima@rifah.sa',
                phone: '+966501234568',
                skills: ['nails', 'manicure', 'pedicure'],
                rating: 4.8,
                totalBookings: 198,
                commission: 25.0,
                isActive: true
            },
            {
                name: 'Layla Hassan',
                email: 'layla@rifah.sa',
                phone: '+966501234569',
                skills: ['facial', 'skincare', 'spa'],
                rating: 5.0,
                totalBookings: 312,
                commission: 35.0,
                isActive: true
            }
        ]);
        console.log(`✅ Created ${staff.length} staff members\n`);

        // 3. Create staff schedules
        console.log('📅 Creating staff schedules...');
        const schedules = [];
        for (const staffMember of staff) {
            for (let day = 1; day <= 6; day++) {
                schedules.push({
                    staffId: staffMember.id,
                    dayOfWeek: day,
                    startTime: '09:00:00',
                    endTime: '20:00:00',
                    isAvailable: true
                });
            }
        }
        await db.StaffSchedule.bulkCreate(schedules);
        console.log(`✅ Created ${schedules.length} schedule entries\n`);

        // 4. Link staff to services - Auto-seed: all staff can perform all services
        console.log('🔗 Linking staff to services...');
        for (const staffMember of staff) {
            // Each staff member can perform all services
            await staffMember.addServices(services);
        }
        const staffServiceCount = staff.length * services.length;
        console.log(`✅ Staff-Service relationships created (${staffServiceCount} assignments)\n`);

        // 5. Create sample customers (skip if they already exist)
        console.log('👤 Creating sample customers...');
        try {
            const customers = await db.Customer.bulkCreate([
                {
                    phone: '+966501111111',
                    name: 'Aisha Al-Saud',
                    email: 'aisha@example.com',
                    totalSpent: 1250.00,
                    loyaltyPoints: 125,
                    totalBookings: 8
                },
                {
                    phone: '+966502222222',
                    name: 'Maha Ibrahim',
                    email: 'maha@example.com',
                    totalSpent: 850.00,
                    loyaltyPoints: 85,
                    totalBookings: 5
                }
            ], { ignoreDuplicates: true });
            console.log(`✅ Created ${customers.length} customers\n`);
        } catch (err) {
            console.log('✅ Customers already exist, skipping creation\n');
        }

        console.log('🎉 Database seeding completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   - Services: ${services.length}`);
        console.log(`   - Staff: ${staff.length}`);
        console.log(`   - Schedules: ${schedules.length}`);
        console.log(`   - Staff-Service Assignments: ${staff.length * services.length}`);
        console.log('\n✨ You can now test the booking system!\n');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    }
}

// Run seeder
db.sequelize.authenticate()
    .then(() => {
        console.log('✅ Database connected\n');
        return seedDatabase();
    })
    .then(() => {
        console.log('👋 Seeding complete. Exiting...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
