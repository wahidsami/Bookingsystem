#!/usr/bin/env node
/**
 * Database Tables Verification Script
 * Checks if all required scheduling tables exist in the database
 */

const db = require('./src/models');

const requiredTables = [
    'staff_shifts',
    'staff_breaks',
    'staff_time_off',
    'staff_schedule_overrides'
];

async function checkDatabase() {
    try {
        console.log('🔍 Checking database tables...\n');

        // Connect to database
        await db.sequelize.authenticate();
        console.log('✅ Database connection: OK\n');

        // Get list of all tables
        const tables = await db.sequelize.queryInterface.showAllTables();
        
        console.log(`📋 Total tables in database: ${tables.length}\n`);
        console.log('📊 Scheduling Tables Status:');
        console.log('─'.repeat(50));

        const missingTables = [];
        const existingTables = [];

        for (const table of requiredTables) {
            if (tables.includes(table)) {
                console.log(`✅ ${table.padEnd(30)} - EXISTS`);
                existingTables.push(table);

                // Get table info
                const columns = await db.sequelize.queryInterface.describeTable(table);
                console.log(`   └─ Columns: ${Object.keys(columns).length}`);
            } else {
                console.log(`❌ ${table.padEnd(30)} - MISSING`);
                missingTables.push(table);
            }
        }

        console.log('─'.repeat(50));
        console.log(`\n📊 Summary: ${existingTables.length}/${requiredTables.length} tables found\n`);

        if (missingTables.length > 0) {
            console.log(`\n⚠️  Missing Tables (${missingTables.length}):`);
            missingTables.forEach(t => console.log(`   - ${t}`));
            
            console.log('\n🔧 To fix, run:');
            console.log('   cd server');
            console.log('   npx sequelize-cli db:migrate\n');
            
            process.exit(1);
        } else {
            console.log('✅ All scheduling tables exist!\n');
            
            // Show migration status
            const migrations = await db.sequelize.queryInterface.rawSelect(
                'sequelizemeta',
                {},
                ['name'],
                { raw: true }
            ).catch(() => []);
            
            console.log('📝 Recent migrations:');
            if (Array.isArray(migrations) && migrations.length > 0) {
                migrations.slice(-5).forEach(m => {
                    console.log(`   ✓ ${m.name}`);
                });
            }
            
            process.exit(0);
        }

    } catch (error) {
        if (error.message.includes('does not exist')) {
            console.error('❌ Database does not exist or not connected');
            console.error('   Make sure PostgreSQL is running and .env is configured\n');
        } else {
            console.error('❌ Error checking database:', error.message);
        }
        process.exit(1);
    }
}

// Run the check
checkDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
