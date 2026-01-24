/**
 * Check and Create Shifts for Jasmin Spa Staff
 * 
 * This script:
 * 1. Finds Jasmin Spa tenant
 * 2. Lists all staff members
 * 3. Checks if they have shifts
 * 4. Creates shifts if missing (9:00-18:00, daily)
 */

const db = require('./src/models');

const TENANT_SLUG = 'jasmin-spa';
const SHIFT_START = '09:00';
const SHIFT_END = '18:00';

async function checkAndCreateShifts() {
    try {
        console.log('\n🔍 Checking shifts for Jasmin Spa staff...\n');

        // Find tenant
        const tenant = await db.Tenant.findOne({
            where: { slug: TENANT_SLUG }
        });

        if (!tenant) {
            console.error(`❌ Tenant not found with slug: ${TENANT_SLUG}`);
            process.exit(1);
        }

        console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})\n`);

        // Get all active staff
        const staff = await db.Staff.findAll({
            where: {
                tenantId: tenant.id,
                isActive: true
            },
            order: [['name', 'ASC']]
        });

        if (staff.length === 0) {
            console.log('⚠️  No active staff found for this tenant');
            process.exit(0);
        }

        console.log(`📋 Found ${staff.length} active staff member(s):\n`);

        for (const member of staff) {
            console.log(`👤 ${member.name} (${member.id})`);

            // Check existing shifts
            const existingShifts = await db.StaffShift.findAll({
                where: { staffId: member.id }
            });

            if (existingShifts.length > 0) {
                console.log(`   ✅ Already has ${existingShifts.length} shift(s):`);
                existingShifts.forEach(shift => {
                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][shift.dayOfWeek] || 'Date-specific';
                    console.log(`      - ${dayName}: ${shift.startTime} - ${shift.endTime} (${shift.isRecurring ? 'Recurring' : 'One-time'})`);
                });
            } else {
                console.log(`   ⚠️  No shifts found. Creating shifts...`);

                // Create shifts for all 7 days (0 = Sunday, 6 = Saturday)
                const createdShifts = [];
                for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
                    const shift = await db.StaffShift.create({
                        staffId: member.id,
                        dayOfWeek: dayOfWeek,
                        startTime: SHIFT_START,
                        endTime: SHIFT_END,
                        isRecurring: true,
                        isActive: true,
                        label: 'Daily Shift'
                    });
                    createdShifts.push(shift);
                }
                console.log(`   ✅ Created 7 daily shifts (${SHIFT_START} - ${SHIFT_END})`);
            }
            console.log('');
        }

        console.log('✅ Shift check complete!\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
checkAndCreateShifts();
