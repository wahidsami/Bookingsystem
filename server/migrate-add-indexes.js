/**
 * Migration Script: Add indexes for platformUserId
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.POSTGRES_DB || 'rifah_shared',
    process.env.POSTGRES_USER || 'postgres',
    process.env.POSTGRES_PASSWORD || 'dev_password',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5434,
        dialect: 'postgres',
        logging: console.log
    }
);

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established.');

        // Add index on platformUserId
        console.log('📝 Adding index on platformUserId...');
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_platform_user" 
            ON "appointments" ("platformUserId");
        `);

        // Add composite index on platformUserId and startTime
        console.log('📝 Adding composite index on platformUserId and startTime...');
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_platform_user_time" 
            ON "appointments" ("platformUserId", "startTime");
        `);

        console.log('✅ Indexes added successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        
        // If index already exists, that's okay
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('⚠️  Index already exists, that\'s fine.');
        } else {
            process.exit(1);
        }
    } finally {
        await sequelize.close();
    }
}

migrate();

