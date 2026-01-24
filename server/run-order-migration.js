/**
 * Direct Migration Runner for Order System
 * Creates orders and order_items tables
 * 
 * Usage: node run-order-migration.js
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

        // Check if tables already exist
        const [ordersExists] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'orders'
            );
        `);

        const [orderItemsExists] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'order_items'
            );
        `);

        if (ordersExists[0].exists) {
            console.log('⚠️  orders table already exists. Skipping...');
        } else {
            console.log('📦 Creating orders table...');
            await queryInterface.createTable('orders', {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true
                },
                order_number: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    unique: true,
                    comment: 'Unique order number (e.g., ORD-2026-001234)'
                },
                platform_user_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {
                        model: 'platform_users',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                tenant_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {
                        model: 'tenants',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                status: {
                    type: DataTypes.ENUM(
                        'pending',
                        'confirmed',
                        'processing',
                        'ready_for_pickup',
                        'shipped',
                        'delivered',
                        'completed',
                        'cancelled',
                        'refunded'
                    ),
                    defaultValue: 'pending',
                    comment: 'Current order status'
                },
                payment_method: {
                    type: DataTypes.ENUM('online', 'cash_on_delivery', 'pay_on_visit'),
                    allowNull: false,
                    comment: 'Payment method selected by customer'
                },
                payment_status: {
                    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded'),
                    defaultValue: 'pending',
                    comment: 'Payment status'
                },
                subtotal: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00,
                    comment: 'Sum of all items before tax'
                },
                tax_amount: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00,
                    comment: 'Total tax amount'
                },
                shipping_fee: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00,
                    comment: 'Delivery/shipping fee (if applicable)'
                },
                platform_fee: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00,
                    comment: 'Platform commission'
                },
                total_amount: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00,
                    comment: 'Final total amount (subtotal + tax + shipping - discounts)'
                },
                delivery_type: {
                    type: DataTypes.ENUM('pickup', 'delivery'),
                    allowNull: false,
                    defaultValue: 'pickup',
                    comment: 'Pickup at salon or delivery'
                },
                shipping_address: {
                    type: DataTypes.JSONB,
                    allowNull: true,
                    comment: 'Shipping address: {street, city, building, floor, apartment, phone, notes}'
                },
                pickup_date: {
                    type: DataTypes.DATE,
                    allowNull: true,
                    comment: 'When customer will pick up (for pay_on_visit)'
                },
                tracking_number: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    comment: 'Tracking number for shipped orders'
                },
                estimated_delivery_date: {
                    type: DataTypes.DATE,
                    allowNull: true,
                    comment: 'Estimated delivery date'
                },
                delivered_at: {
                    type: DataTypes.DATE,
                    allowNull: true,
                    comment: 'Actual delivery date'
                },
                notes: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    comment: 'Customer notes/instructions'
                },
                tenant_notes: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    comment: 'Internal notes for tenant'
                },
                cancelled_at: {
                    type: DataTypes.DATE,
                    allowNull: true,
                    comment: 'When order was cancelled'
                },
                cancellation_reason: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    comment: 'Reason for cancellation'
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

            // Create indexes for orders
            await queryInterface.addIndex('orders', ['platform_user_id'], {
                name: 'idx_orders_platform_user_id'
            });
            await queryInterface.addIndex('orders', ['tenant_id'], {
                name: 'idx_orders_tenant_id'
            });
            await queryInterface.addIndex('orders', ['order_number'], {
                unique: true,
                name: 'idx_orders_order_number_unique'
            });
            await queryInterface.addIndex('orders', ['status'], {
                name: 'idx_orders_status'
            });
            await queryInterface.addIndex('orders', ['payment_status'], {
                name: 'idx_orders_payment_status'
            });
            await queryInterface.addIndex('orders', ['created_at'], {
                name: 'idx_orders_created_at'
            });

            console.log('✅ orders table created successfully!');
        }

        if (orderItemsExists[0].exists) {
            console.log('⚠️  order_items table already exists. Skipping...');
        } else {
            console.log('📦 Creating order_items table...');
            await queryInterface.createTable('order_items', {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true
                },
                order_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {
                        model: 'orders',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                product_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {
                        model: 'products',
                        key: 'id'
                    }
                },
                product_name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    comment: 'Product name at time of order (snapshot)'
                },
                product_name_ar: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    comment: 'Product name in Arabic (snapshot)'
                },
                product_price: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    comment: 'Product price at time of order (snapshot)'
                },
                product_image: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    comment: 'Product image at time of order (snapshot)'
                },
                product_sku: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    comment: 'Product SKU at time of order (snapshot)'
                },
                quantity: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 1,
                    comment: 'Quantity ordered'
                },
                unit_price: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    comment: 'Price per unit at time of order'
                },
                total_price: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: false,
                    comment: 'Total price for this line item (quantity * unitPrice)'
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

            // Create indexes for order_items
            await queryInterface.addIndex('order_items', ['order_id'], {
                name: 'idx_order_items_order_id'
            });
            await queryInterface.addIndex('order_items', ['product_id'], {
                name: 'idx_order_items_product_id'
            });

            console.log('✅ order_items table created successfully!');
        }

        // Update transactions table to add order_id column if it doesn't exist
        console.log('📦 Checking transactions table for order_id column...');
        const [transactionColumns] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'transactions' 
            AND column_name = 'order_id';
        `);

        if (transactionColumns.length === 0) {
            console.log('📦 Adding order_id column to transactions table...');
            await queryInterface.addColumn('transactions', 'order_id', {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'orders',
                    key: 'id'
                }
            });
            await queryInterface.addIndex('transactions', ['order_id'], {
                name: 'idx_transactions_order_id'
            });
            console.log('✅ order_id column added to transactions table!');
        } else {
            console.log('⚠️  order_id column already exists in transactions table. Skipping...');
        }

        // Update transactions type enum to include 'product_purchase' if it doesn't exist
        console.log('📦 Checking transactions type enum...');
        try {
            await sequelize.query(`
                ALTER TYPE "enum_transactions_type" ADD VALUE IF NOT EXISTS 'product_purchase';
            `);
            console.log('✅ Transaction type enum updated!');
        } catch (err) {
            // If enum doesn't exist or value already exists, that's okay
            if (err.message.includes('already exists') || err.message.includes('does not exist')) {
                console.log('⚠️  Transaction type enum update skipped (already correct or enum doesn\'t exist yet)');
            } else {
                throw err;
            }
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('📋 Created/Updated:');
        console.log('   - orders table');
        console.log('   - order_items table');
        console.log('   - transactions.order_id column');
        console.log('   - transactions type enum (product_purchase)');

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
        console.log('\n🎉 All done! You can now use the order system.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error:', error);
        process.exit(1);
    });
