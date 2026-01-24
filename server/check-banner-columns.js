/**
 * Script to check if page banner columns exist in the database
 * Run this to verify the migration was applied
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        schema: 'public',
        logging: false
    }
);

async function checkColumns() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established.');

        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'public_page_data'
            AND column_name IN ('pageBanner_services', 'pageBanner_products', 'pageBanner_about', 'pageBanner_contact')
            ORDER BY column_name;
        `);

        console.log('\n📊 Page Banner Columns Status:');
        console.log('================================');
        
        const expectedColumns = [
            'pageBanner_services',
            'pageBanner_products', 
            'pageBanner_about',
            'pageBanner_contact'
        ];

        expectedColumns.forEach(col => {
            const found = results.find(r => r.column_name === col);
            if (found) {
                console.log(`✅ ${col} - EXISTS (${found.data_type})`);
            } else {
                console.log(`❌ ${col} - MISSING`);
            }
        });

        if (results.length < expectedColumns.length) {
            console.log('\n⚠️  WARNING: Some columns are missing!');
            console.log('Please run the migration: MIGRATE_PAGE_BANNERS.sql');
        } else {
            console.log('\n✅ All page banner columns exist!');
        }

        await sequelize.close();
    } catch (error) {
        console.error('❌ Error checking columns:', error.message);
        process.exit(1);
    }
}

checkColumns();

