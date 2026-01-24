/**
 * Fix staff_breaks table schema
 * Changes the 'type' column from ENUM to VARCHAR if needed
 */

const { Sequelize } = require('sequelize');
const config = require('./src/config/database.js').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: 'postgres',
    logging: console.log
});

async function fixTable() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');

        // Check if table exists
        const [results] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'staff_breaks'
            ) as exists
        `);

        if (!results[0].exists) {
            console.log('✅ Table staff_breaks does not exist - will be created on sync');
            process.exit(0);
        }

        console.log('📋 Table exists. Checking column type...');

        // Check current column type
        const [columnInfo] = await sequelize.query(`
            SELECT data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'staff_breaks'
            AND column_name = 'type'
        `);

        if (columnInfo.length === 0) {
            console.log('⚠️  Column "type" does not exist - will be created on sync');
            process.exit(0);
        }

        const currentType = columnInfo[0].data_type;
        const udtName = columnInfo[0].udt_name;

        console.log(`Current type: ${currentType} (${udtName})`);

        if (udtName && udtName.startsWith('enum_')) {
            console.log('🔄 Converting ENUM to VARCHAR...');
            
            // Drop the ENUM type constraint and convert to VARCHAR
            await sequelize.query(`
                ALTER TABLE staff_breaks 
                ALTER COLUMN type TYPE VARCHAR(50) 
                USING type::text;
            `);

            // Try to drop the ENUM type (may fail if used elsewhere, that's ok)
            try {
                await sequelize.query(`DROP TYPE IF EXISTS enum_staff_breaks_type CASCADE;`);
            } catch (err) {
                console.log('⚠️  Could not drop ENUM type (may be used elsewhere):', err.message);
            }

            console.log('✅ Column converted to VARCHAR');
        } else if (currentType === 'character varying' || currentType === 'varchar') {
            console.log('✅ Column is already VARCHAR - no changes needed');
        } else {
            console.log(`⚠️  Column is ${currentType} - converting to VARCHAR...`);
            await sequelize.query(`
                ALTER TABLE staff_breaks 
                ALTER COLUMN type TYPE VARCHAR(50);
            `);
            console.log('✅ Column converted to VARCHAR');
        }

        // Ensure column has default value
        await sequelize.query(`
            ALTER TABLE staff_breaks 
            ALTER COLUMN type SET DEFAULT 'lunch';
        `);

        // Ensure column is NOT NULL
        await sequelize.query(`
            ALTER TABLE staff_breaks 
            ALTER COLUMN type SET NOT NULL;
        `);

        console.log('✅ Table fixed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error fixing table:', error.message);
        console.error(error);
        process.exit(1);
    }
}

fixTable();

