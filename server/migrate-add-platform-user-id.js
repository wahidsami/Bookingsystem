/**
 * Migration Script: Add platformUserId to appointments table
 * Run this once to update the database schema
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

        // Check if column exists
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='appointments' 
            AND column_name='platformUserId';
        `);

        if (results.length > 0) {
            console.log('✅ Column platformUserId already exists. Skipping migration.');
            process.exit(0);
        }

        // Add platformUserId column
        console.log('📝 Adding platformUserId column to appointments table...');
        await sequelize.query(`
            ALTER TABLE "appointments" 
            ADD COLUMN IF NOT EXISTS "platformUserId" UUID;
        `);

        // Add foreign key constraint
        console.log('📝 Adding foreign key constraint...');
        await sequelize.query(`
            ALTER TABLE "appointments" 
            ADD CONSTRAINT "appointments_platformUserId_fkey" 
            FOREIGN KEY ("platformUserId") 
            REFERENCES "platform_users"("id") 
            ON DELETE SET NULL 
            ON UPDATE CASCADE;
        `);

        console.log('✅ Migration completed successfully!');
        console.log('✅ platformUserId column added to appointments table.');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        
        // If foreign key constraint already exists, that's okay
        if (error.message.includes('already exists')) {
            console.log('⚠️  Constraint already exists, continuing...');
        } else {
            process.exit(1);
        }
    } finally {
        await sequelize.close();
    }
}

migrate();

