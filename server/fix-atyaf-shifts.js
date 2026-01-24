/**
 * Fix Atyaf Seha's Shifts - Add missing days
 */

const db = require('./src/models');

const STAFF_ID = '1aeca22d-ae05-496e-8498-8b1d62a7feb0'; // Atyaf Seha
const SHIFT_START = '09:00';
const SHIFT_END = '18:00';

async function fixShifts() {
    try {
        console.log('\n🔧 Fixing shifts for Atyaf Seha...\n');

        const staff = await db.Staff.findByPk(STAFF_ID);
        if (!staff) {
            console.error('❌ Staff not found');
            process.exit(1);
        }

        console.log(`✅ Found: ${staff.name}\n`);

        // Get existing shifts
        const existingShifts = await db.StaffShift.findAll({
            where: { staffId: STAFF_ID }
        });

        const existingDays = existingShifts.map(s => s.dayOfWeek);
        console.log(`📋 Existing shifts: ${existingDays.length} day(s)`);

        // Create missing days (0 = Sunday, 6 = Saturday)
        const allDays = [0, 1, 2, 3, 4, 5, 6];
        const missingDays = allDays.filter(day => !existingDays.includes(day));

        if (missingDays.length === 0) {
            console.log('✅ All shifts already exist!');
            process.exit(0);
        }

        console.log(`➕ Creating ${missingDays.length} missing shift(s)...\n`);

        for (const dayOfWeek of missingDays) {
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
            await db.StaffShift.create({
                staffId: STAFF_ID,
                dayOfWeek: dayOfWeek,
                startTime: SHIFT_START,
                endTime: SHIFT_END,
                isRecurring: true,
                isActive: true,
                label: 'Daily Shift'
            });
            console.log(`   ✅ Created: ${dayName} (${SHIFT_START} - ${SHIFT_END})`);
        }

        console.log('\n✅ All shifts created!\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixShifts();
