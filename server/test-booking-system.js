/**
 * Booking System Diagnostic Test
 * Tests all booking-related functionality
 */

require('dotenv').config();
const db = require('./src/models');
const bookingService = require('./src/services/bookingService');
const availabilityService = require('./src/services/availabilityService');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60));
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

async function testDatabaseConnection() {
    logSection('1. DATABASE CONNECTION TEST');
    try {
        await db.sequelize.authenticate();
        logSuccess('Database connection established');
        return true;
    } catch (error) {
        logError(`Database connection failed: ${error.message}`);
        return false;
    }
}

async function testDatabaseTables() {
    logSection('2. DATABASE TABLES CHECK');
    const requiredTables = [
        'appointments',
        'services',
        'staff',
        'platform_users',
        'tenants',
        'tenant_settings',
        'staff_shifts',
        'staff_breaks',
        'staff_time_off',
        'staff_schedule_overrides'
    ];

    try {
        const [results] = await db.sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (${requiredTables.map(t => `'${t}'`).join(', ')})
            ORDER BY table_name
        `);

        const existingTables = results.map(r => r.table_name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));

        log(`Found ${existingTables.length}/${requiredTables.length} required tables`);
        
        existingTables.forEach(table => {
            logSuccess(`Table exists: ${table}`);
        });

        if (missingTables.length > 0) {
            missingTables.forEach(table => {
                logError(`Table missing: ${table}`);
            });
            return false;
        }

        return true;
    } catch (error) {
        logError(`Error checking tables: ${error.message}`);
        return false;
    }
}

async function testModels() {
    logSection('3. SEQUELIZE MODELS CHECK');
    const requiredModels = [
        'Appointment',
        'Service',
        'Staff',
        'PlatformUser',
        'Tenant',
        'TenantSettings',
        'StaffShift',
        'StaffBreak',
        'StaffTimeOff',
        'StaffScheduleOverride'
    ];

    let allFound = true;
    requiredModels.forEach(modelName => {
        if (db[modelName]) {
            logSuccess(`Model found: ${modelName}`);
        } else {
            logError(`Model missing: ${modelName}`);
            allFound = false;
        }
    });

    return allFound;
}

async function testSampleData() {
    logSection('4. SAMPLE DATA CHECK');
    try {
        // Check for tenants
        const tenantCount = await db.Tenant.count();
        log(`Tenants in database: ${tenantCount}`);
        if (tenantCount === 0) {
            logWarning('No tenants found - booking tests will be limited');
        } else {
            const sampleTenant = await db.Tenant.findOne({ where: { status: 'approved' } });
            if (sampleTenant) {
                logSuccess(`Sample tenant found: ${sampleTenant.name} (${sampleTenant.id})`);
                
                // Check for services
                const serviceCount = await db.Service.count({ where: { tenantId: sampleTenant.id, isActive: true } });
                log(`Active services for tenant: ${serviceCount}`);
                
                // Check for staff
                const staffCount = await db.Staff.count({ where: { tenantId: sampleTenant.id, isActive: true } });
                log(`Active staff for tenant: ${staffCount}`);
                
                // Check for platform users
                const userCount = await db.PlatformUser.count();
                log(`Platform users: ${userCount}`);
                
                return {
                    tenant: sampleTenant,
                    hasServices: serviceCount > 0,
                    hasStaff: staffCount > 0,
                    hasUsers: userCount > 0
                };
            }
        }
        return null;
    } catch (error) {
        logError(`Error checking sample data: ${error.message}`);
        return null;
    }
}

async function testBookingService() {
    logSection('5. BOOKING SERVICE CHECK');
    try {
        // Check if bookingService has required methods
        const requiredMethods = ['createBooking', 'getBookingDetails'];
        let allMethodsExist = true;

        requiredMethods.forEach(method => {
            if (typeof bookingService[method] === 'function') {
                logSuccess(`Method exists: ${method}`);
            } else {
                logError(`Method missing: ${method}`);
                allMethodsExist = false;
            }
        });

        return allMethodsExist;
    } catch (error) {
        logError(`Error checking booking service: ${error.message}`);
        return false;
    }
}

async function testAvailabilityService() {
    logSection('6. AVAILABILITY SERVICE CHECK');
    try {
        // Check if availabilityService has required methods
        const requiredMethods = ['getAvailableSlots'];
        let allMethodsExist = true;

        requiredMethods.forEach(method => {
            if (typeof availabilityService[method] === 'function') {
                logSuccess(`Method exists: ${method}`);
            } else {
                logError(`Method missing: ${method}`);
                allMethodsExist = false;
            }
        });

        return allMethodsExist;
    } catch (error) {
        logError(`Error checking availability service: ${error.message}`);
        return false;
    }
}

async function testAvailabilityWithSampleData(sampleData) {
    logSection('7. AVAILABILITY SERVICE FUNCTIONALITY TEST');
    
    if (!sampleData || !sampleData.tenant || !sampleData.hasServices) {
        logWarning('Skipping availability test - no sample data available');
        return false;
    }

    try {
        const tenant = sampleData.tenant;
        const service = await db.Service.findOne({
            where: { tenantId: tenant.id, isActive: true }
        });

        if (!service) {
            logWarning('No active service found for availability test');
            return false;
        }

        log(`Testing availability for service: ${service.name_en || service.name} (${service.id})`);
        
        // Test availability for today
        const today = new Date().toISOString().split('T')[0];
        const result = await availabilityService.getAvailableSlots(tenant.id, {
            serviceId: service.id,
            staffId: null, // Any staff
            date: today
        });

        logSuccess(`Availability service returned ${result.slots.length} slots`);
        log(`Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
        
        return true;
    } catch (error) {
        logError(`Availability test failed: ${error.message}`);
        console.error(error.stack);
        return false;
    }
}

async function testRoutes() {
    logSection('8. API ROUTES CHECK');
    try {
        const fs = require('fs');
        const path = require('path');
        
        const routeFiles = [
            'server/src/routes/bookingRoutes.js',
            'server/src/routes/publicRoutes.js',
            'server/src/routes/userRoutes.js'
        ];

        let allRoutesExist = true;
        routeFiles.forEach(routeFile => {
            const fullPath = path.join(__dirname, routeFile.replace('server/', ''));
            if (fs.existsSync(fullPath)) {
                logSuccess(`Route file exists: ${routeFile}`);
            } else {
                logError(`Route file missing: ${routeFile}`);
                allRoutesExist = false;
            }
        });

        return allRoutesExist;
    } catch (error) {
        logError(`Error checking routes: ${error.message}`);
        return false;
    }
}

async function testControllers() {
    logSection('9. CONTROLLERS CHECK');
    try {
        const fs = require('fs');
        const path = require('path');
        
        const controllerFiles = [
            'server/src/controllers/bookingController.js',
            'server/src/controllers/publicTenantController.js'
        ];

        let allControllersExist = true;
        controllerFiles.forEach(controllerFile => {
            const fullPath = path.join(__dirname, controllerFile.replace('server/', ''));
            if (fs.existsSync(fullPath)) {
                logSuccess(`Controller file exists: ${controllerFile}`);
            } else {
                logError(`Controller file missing: ${controllerFile}`);
                allControllersExist = false;
            }
        });

        return allControllersExist;
    } catch (error) {
        logError(`Error checking controllers: ${error.message}`);
        return false;
    }
}

async function runDiagnostics() {
    log('\n' + '🔍 BOOKING SYSTEM DIAGNOSTIC TEST'.padStart(40), 'blue');
    log('Starting comprehensive booking system check...\n', 'blue');

    const results = {
        databaseConnection: false,
        databaseTables: false,
        models: false,
        sampleData: null,
        bookingService: false,
        availabilityService: false,
        availabilityTest: false,
        routes: false,
        controllers: false
    };

    // Run all tests
    results.databaseConnection = await testDatabaseConnection();
    if (!results.databaseConnection) {
        logError('Cannot continue - database connection failed');
        await db.sequelize.close();
        return results;
    }

    results.databaseTables = await testDatabaseTables();
    results.models = await testModels();
    results.sampleData = await testSampleData();
    results.bookingService = await testBookingService();
    results.availabilityService = testAvailabilityService();
    results.availabilityTest = await testAvailabilityWithSampleData(results.sampleData);
    results.routes = await testRoutes();
    results.controllers = await testControllers();

    // Summary
    logSection('DIAGNOSTIC SUMMARY');
    
    const totalTests = Object.keys(results).filter(k => k !== 'sampleData').length;
    const passedTests = Object.values(results).filter(v => v === true).length;
    
    log(`Tests passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'yellow');
    
    if (passedTests === totalTests) {
        logSuccess('All diagnostic tests passed! Booking system is ready.');
    } else {
        logWarning('Some tests failed. Please review the errors above.');
    }

    await db.sequelize.close();
    return results;
}

// Run diagnostics
if (require.main === module) {
    runDiagnostics()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runDiagnostics };

