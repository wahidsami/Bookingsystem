const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');
const config = require('./config/config.json')['development'];

async function runAudit() {
    const sequelize = new Sequelize(config.database, config.username, config.password, {
        host: '127.0.0.1',
        port: 5432,
        dialect: config.dialect,
        logging: false
    });

    let output = '';
    const log = (msg) => { output += msg + '\n'; };

    try {
        await sequelize.authenticate();
        log('# DATABASE CONNECTION SUCCESS');

        // Part 2: DB Schema Audit
        log('\n# POSTGRES TABLES');
        const [tables] = await sequelize.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'");
        
        for (const t of tables) {
            log('\n## Table: ' + t.tablename);
            
            // Columns
            const [columns] = await sequelize.query(`
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = '${t.tablename}'
            `);
            for (const col of columns) {
                log(`- ${col.column_name}: ${col.data_type} (Nullable: ${col.is_nullable}, Default: ${col.column_default})`);
            }
            
            // Foreign keys
            const [fks] = await sequelize.query(`
                SELECT
                    tc.table_name, kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM
                    information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='${t.tablename}';
            `);
            if (fks.length > 0) {
                log('  Foreign Keys:');
                for (const fk of fks) {
                    log(`    - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
                }
            }
        }

        // Part 3: Sequelize Audit
        log('\n# SEQUELIZE MODELS');
        const models = require('./src/models');
        for (const modelName of Object.keys(models)) {
            if (modelName === 'sequelize' || modelName === 'Sequelize') continue;
            const model = models[modelName];
            log('\n## Model: ' + modelName);
            log('- tableName: ' + model.tableName);
            log('- primaryKeyAttributes: ' + (model.primaryKeyAttributes || []).join(', '));
            
            if (model.associations) {
                log('  Associations:');
                for (const assocName of Object.keys(model.associations)) {
                    const assoc = model.associations[assocName];
                    log(`    - ${assoc.associationType} ${assocName} -> ${assoc.target.name} (FK: ${assoc.foreignKey})`);
                }
            }
        }

    } catch (err) {
        log('ERROR: ' + err.stack);
    }

    fs.writeFileSync('audit_output.txt', output);
    console.log('Audit complete.');
    process.exit(0);
}

runAudit();


