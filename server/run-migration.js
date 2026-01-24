/**
 * Direct Migration Runner
 * Runs the scheduling tables migration directly without Sequelize CLI
 * 
 * Usage: node run-migration.js
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const config = {
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'dev_password',
    database: process.env.POSTGRES_DB || 'rifah_shared',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5434,
    dialect: 'postgres',
    logging: console.log
};

async function runMigration() {
    const sequelize = new Sequelize(config.database, config.username, config.password, {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        logging: config.logging
    });

    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established.');

        const queryInterface = sequelize.getQueryInterface();

        console.log('📦 Creating staff_shifts table...');
        await queryInterface.createTable('staff_shifts', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            staff_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'staff',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            day_of_week: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            specific_date: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },
            start_time: {
                type: DataTypes.TIME,
                allowNull: false
            },
            end_time: {
                type: DataTypes.TIME,
                allowNull: false
            },
            is_recurring: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            start_date: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },
            end_date: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            label: {
                type: DataTypes.STRING,
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex('staff_shifts', ['staff_id', 'day_of_week'], {
            name: 'idx_staff_shifts_staff_day'
        });
        await queryInterface.addIndex('staff_shifts', ['staff_id', 'specific_date'], {
            name: 'idx_staff_shifts_staff_date'
        });
        await queryInterface.addIndex('staff_shifts', ['is_active'], {
            name: 'idx_staff_shifts_active'
        });

        console.log('📦 Creating staff_breaks table...');
        await queryInterface.createTable('staff_breaks', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            staff_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'staff',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            day_of_week: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            specific_date: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },
            start_time: {
                type: DataTypes.TIME,
                allowNull: false
            },
            end_time: {
                type: DataTypes.TIME,
                allowNull: false
            },
            type: {
                type: DataTypes.ENUM('lunch', 'prayer', 'cleaning', 'other'),
                defaultValue: 'lunch'
            },
            label: {
                type: DataTypes.STRING,
                allowNull: true
            },
            is_recurring: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            start_date: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },
            end_date: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex('staff_breaks', ['staff_id', 'day_of_week'], {
            name: 'idx_staff_breaks_staff_day'
        });
        await queryInterface.addIndex('staff_breaks', ['staff_id', 'specific_date'], {
            name: 'idx_staff_breaks_staff_date'
        });
        await queryInterface.addIndex('staff_breaks', ['is_active'], {
            name: 'idx_staff_breaks_active'
        });

        console.log('📦 Creating staff_time_off table...');
        await queryInterface.createTable('staff_time_off', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            staff_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'staff',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            start_date: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },
            end_date: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },
            type: {
                type: DataTypes.ENUM('vacation', 'sick', 'personal', 'training', 'other'),
                defaultValue: 'vacation'
            },
            reason: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            is_approved: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            approved_by: {
                type: DataTypes.UUID,
                allowNull: true
            },
            approved_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex('staff_time_off', ['staff_id', 'start_date', 'end_date'], {
            name: 'idx_staff_time_off_staff_dates'
        });
        await queryInterface.addIndex('staff_time_off', ['is_approved'], {
            name: 'idx_staff_time_off_approved'
        });

        console.log('📦 Creating staff_schedule_overrides table...');
        await queryInterface.createTable('staff_schedule_overrides', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            staff_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'staff',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },
            type: {
                type: DataTypes.ENUM('override', 'exception'),
                defaultValue: 'override'
            },
            start_time: {
                type: DataTypes.TIME,
                allowNull: true
            },
            end_time: {
                type: DataTypes.TIME,
                allowNull: true
            },
            is_available: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            reason: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex('staff_schedule_overrides', ['staff_id', 'date'], {
            unique: true,
            name: 'unique_staff_date_override'
        });
        await queryInterface.addIndex('staff_schedule_overrides', ['staff_id', 'date'], {
            name: 'idx_staff_overrides_staff_date'
        });
        await queryInterface.addIndex('staff_schedule_overrides', ['is_available'], {
            name: 'idx_staff_overrides_available'
        });

        console.log('✅ Migration completed successfully!');
        console.log('📋 Created tables:');
        console.log('   - staff_shifts');
        console.log('   - staff_breaks');
        console.log('   - staff_time_off');
        console.log('   - staff_schedule_overrides');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error:', error);
        process.exit(1);
    });

