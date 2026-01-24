/**
 * Test Availability for Atyaf Seha on 2026-01-16
 */

const db = require('./src/models');
const availabilityService = require('./src/services/availabilityService');

const TENANT_ID = '2d89e0b5-721f-4409-9e28-1d7f589fde77'; // Jasmin Spa
const STAFF_ID = '1aeca22d-ae05-496e-8498-8b1d62a7feb0'; // Atyaf Seha
const DATE = '2026-01-16';

async function testAvailability() {
    try {
        console.log('\n🔍 Testing Availability...\n');
        console.log(`Tenant ID: ${TENANT_ID}`);
        console.log(`Staff ID: ${STAFF_ID}`);
        console.log(`Date: ${DATE}\n`);

        // Check staff
        const staff = await db.Staff.findByPk(STAFF_ID);
        if (!staff) {
            console.error('❌ Staff not found');
            return;
        }
        console.log(`✅ Staff found: ${staff.name}`);

        // Check shifts for this date
        const dateObj = new Date(DATE);
        const dayOfWeek = dateObj.getDay();
        console.log(`📅 Day of week: ${dayOfWeek} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]})\n`);

        // Check recurring shifts
        const recurringShifts = await db.StaffShift.findAll({
            where: {
                staffId: STAFF_ID,
                dayOfWeek,
                isRecurring: true,
                isActive: true
            }
        });

        console.log(`📋 Recurring shifts found: ${recurringShifts.length}`);
        recurringShifts.forEach(shift => {
            console.log(`   - ${shift.startTime} to ${shift.endTime} (dayOfWeek: ${shift.dayOfWeek})`);
        });

        // Check date-specific shifts
        const dateSpecificShifts = await db.StaffShift.findAll({
            where: {
                staffId: STAFF_ID,
                specificDate: DATE,
                isActive: true,
                isRecurring: false
            }
        });

        console.log(`\n📋 Date-specific shifts found: ${dateSpecificShifts.length}`);
        dateSpecificShifts.forEach(shift => {
            console.log(`   - ${shift.startTime} to ${shift.endTime} (date: ${shift.specificDate})`);
        });

        // Get a service for this staff
        const serviceEmployee = await db.ServiceEmployee.findOne({
            where: { staffId: STAFF_ID }
        });

        if (!serviceEmployee) {
            console.error('\n❌ No service assigned to this staff');
            return;
        }

        const serviceId = serviceEmployee.serviceId;
        console.log(`\n✅ Service found: ${serviceId}`);

        // Test availability
        console.log('\n🧪 Testing availability service...\n');
        const result = await availabilityService.getAvailableSlots(TENANT_ID, {
            serviceId,
            staffId: STAFF_ID,
            date: DATE
        });

        console.log(`✅ Available slots: ${result.slots.length}`);
        console.log(`   Available: ${result.metadata.availableSlots}`);
        console.log(`   Total: ${result.metadata.totalSlots}\n`);

        if (result.slots.length > 0) {
            console.log('📅 First 5 slots:');
            result.slots.slice(0, 5).forEach(slot => {
                const start = new Date(slot.startTime);
                const end = new Date(slot.endTime);
                console.log(`   - ${start.toLocaleTimeString()} to ${end.toLocaleTimeString()} (Available: ${slot.available})`);
            });
        } else {
            console.log('⚠️  No slots found!');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testAvailability();
