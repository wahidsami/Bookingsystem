const http = require('http');

/**
 * End-to-End Booking Flow Test
 * Tests the complete booking journey from service selection to confirmation
 */

const API_BASE = 'http://localhost:5000';

// Test data
let testServiceId = null;
let testStaffId = null;
let testCustomerId = null;
let testAppointmentId = null;

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = {
                        status: res.statusCode,
                        data: body ? JSON.parse(body) : null
                    };
                    resolve(response);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Test functions
async function test1_GetServices() {
    console.log('\n📋 Test 1: Get Services');
    console.log('─'.repeat(50));

    const response = await makeRequest('GET', '/api/v1/services');

    if (response.status === 200 && response.data.services.length > 0) {
        testServiceId = response.data.services[0].id;
        console.log(`✅ Found ${response.data.services.length} services`);
        console.log(`   Selected: ${response.data.services[0].name_en} (${testServiceId})`);
        return true;
    } else {
        console.log('❌ Failed to get services');
        return false;
    }
}

async function test2_GetStaffRecommendations() {
    console.log('\n👥 Test 2: Get Staff Recommendations');
    console.log('─'.repeat(50));

    const response = await makeRequest('GET', `/api/v1/bookings/recommendations?serviceId=${testServiceId}`);

    if (response.status === 200 && response.data.recommendations.length > 0) {
        const staff = response.data.recommendations[0];
        testStaffId = staff.id;
        console.log(`✅ Found ${response.data.recommendations.length} staff members`);
        console.log(`   Top recommendation: ${staff.name} (Rating: ${staff.rating})`);
        console.log(`   AI Score: ${staff.aiScore}`);
        console.log(`   Recommended: ${staff.recommended ? 'Yes' : 'No'}`);
        return true;
    } else {
        console.log('❌ Failed to get staff recommendations');
        return false;
    }
}

async function test3_SearchAvailability() {
    console.log('\n📅 Test 3: Search Available Time Slots');
    console.log('─'.repeat(50));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const response = await makeRequest('POST', '/api/v1/bookings/search', {
        serviceId: testServiceId,
        staffId: testStaffId,
        date: dateStr
    });

    if (response.status === 200) {
        console.log(`✅ Found ${response.data.totalSlots} available slots for ${dateStr}`);
        if (response.data.slots.length > 0) {
            const firstSlot = response.data.slots[0];
            console.log(`   First slot: ${new Date(firstSlot.startTime).toLocaleTimeString()}`);
            return true;
        } else {
            console.log('⚠️  No slots available (this is OK if staff is fully booked)');
            return true;
        }
    } else {
        console.log('❌ Failed to search availability');
        return false;
    }
}

async function test4_CreateBooking() {
    console.log('\n✨ Test 4: Create Booking');
    console.log('─'.repeat(50));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(15, 0, 0, 0);

    const response = await makeRequest('POST', '/api/v1/bookings/create', {
        serviceId: testServiceId,
        staffId: testStaffId,
        startTime: tomorrow.toISOString(),
        customerName: 'Test Customer',
        customerPhone: '+966500000000'
    });

    if (response.status === 201) {
        testAppointmentId = response.data.appointment.id;
        testCustomerId = response.data.appointment.customerId;
        console.log('✅ Booking created successfully!');
        console.log(`   Appointment ID: ${testAppointmentId}`);
        console.log(`   Customer: ${response.data.appointment.Customer.name}`);
        console.log(`   Service: ${response.data.appointment.Service.name_en}`);
        console.log(`   Staff: ${response.data.appointment.Staff.name}`);
        console.log(`   Time: ${new Date(response.data.appointment.startTime).toLocaleString()}`);
        console.log(`   Price: ${response.data.appointment.price} SAR`);
        return true;
    } else {
        console.log('❌ Failed to create booking');
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return false;
    }
}

async function test5_GetBooking() {
    console.log('\n🔍 Test 5: Get Booking Details');
    console.log('─'.repeat(50));

    const response = await makeRequest('GET', `/api/v1/bookings/${testAppointmentId}`);

    if (response.status === 200) {
        console.log('✅ Retrieved booking details');
        console.log(`   Status: ${response.data.appointment.status}`);
        console.log(`   Customer: ${response.data.appointment.Customer.name}`);
        return true;
    } else {
        console.log('❌ Failed to get booking');
        return false;
    }
}

async function test6_ListBookings() {
    console.log('\n📋 Test 6: List All Bookings');
    console.log('─'.repeat(50));

    const response = await makeRequest('GET', `/api/v1/bookings?customerId=${testCustomerId}`);

    if (response.status === 200) {
        console.log(`✅ Found ${response.data.count} bookings for customer`);
        return true;
    } else {
        console.log('❌ Failed to list bookings');
        return false;
    }
}

async function test7_CancelBooking() {
    console.log('\n❌ Test 7: Cancel Booking');
    console.log('─'.repeat(50));

    const response = await makeRequest('PATCH', `/api/v1/bookings/${testAppointmentId}/cancel`);

    if (response.status === 200) {
        console.log('✅ Booking cancelled successfully');
        console.log(`   New status: ${response.data.appointment.status}`);
        return true;
    } else {
        console.log('❌ Failed to cancel booking');
        return false;
    }
}

async function test8_ConflictDetection() {
    console.log('\n🚫 Test 8: Conflict Detection');
    console.log('─'.repeat(50));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    // Try to create two bookings at the same time
    const booking1 = await makeRequest('POST', '/api/v1/bookings/create', {
        serviceId: testServiceId,
        staffId: testStaffId,
        startTime: tomorrow.toISOString(),
        customerName: 'Conflict Test 1',
        customerPhone: '+966500000001'
    });

    const booking2 = await makeRequest('POST', '/api/v1/bookings/create', {
        serviceId: testServiceId,
        staffId: testStaffId,
        startTime: tomorrow.toISOString(),
        customerName: 'Conflict Test 2',
        customerPhone: '+966500000002'
    });

    if (booking1.status === 201 && booking2.status === 500) {
        console.log('✅ Conflict detection working correctly');
        console.log('   First booking: Created');
        console.log('   Second booking: Rejected (conflict)');

        // Clean up the first booking
        await makeRequest('PATCH', `/api/v1/bookings/${booking1.data.appointment.id}/cancel`);
        return true;
    } else {
        console.log('❌ Conflict detection failed');
        console.log(`   Booking 1 status: ${booking1.status}`);
        console.log(`   Booking 2 status: ${booking2.status}`);
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('\n🧪 RIFAH BOOKING SYSTEM - E2E TESTS');
    console.log('═'.repeat(50));
    console.log('Testing complete booking flow...\n');

    const tests = [
        test1_GetServices,
        test2_GetStaffRecommendations,
        test3_SearchAvailability,
        test4_CreateBooking,
        test5_GetBooking,
        test6_ListBookings,
        test7_CancelBooking,
        test8_ConflictDetection
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.log(`❌ Test failed with error: ${error.message}`);
            failed++;
        }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 TEST RESULTS');
    console.log('═'.repeat(50));
    console.log(`✅ Passed: ${passed}/${tests.length}`);
    console.log(`❌ Failed: ${failed}/${tests.length}`);
    console.log(`📈 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed! Phase 2 is complete!\n');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
    }

    process.exit(failed === 0 ? 0 : 1);
}

// Start tests
console.log('Waiting for server to be ready...');
setTimeout(runTests, 2000);
