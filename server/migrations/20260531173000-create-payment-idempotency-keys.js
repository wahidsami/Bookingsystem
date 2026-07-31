'use strict';

const { ensureIdempotentIndexing } = require('./_index-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
        await queryInterface.createTable('payment_idempotency_keys', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            platformUserId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'platform_users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            idempotencyKey: {
                type: Sequelize.STRING(191),
                allowNull: false
            },
            requestHash: {
                type: Sequelize.STRING(128),
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('processing', 'completed', 'failed'),
                allowNull: false,
                defaultValue: 'processing'
            },
            responsePayload: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            errorMessage: {
                type: Sequelize.STRING(500),
                allowNull: true
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex('payment_idempotency_keys', ['platformUserId'], {
            name: 'idx_payment_idempotency_user_id'
        });

        await queryInterface.addIndex('payment_idempotency_keys', ['platformUserId', 'idempotencyKey'], {
            unique: true,
            name: 'uidx_payment_idempotency_user_key'
        });

        await queryInterface.addIndex('payment_idempotency_keys', ['status', 'updatedAt'], {
            name: 'idx_payment_idempotency_status_updated_at'
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('payment_idempotency_keys', 'idx_payment_idempotency_status_updated_at');
        await queryInterface.removeIndex('payment_idempotency_keys', 'uidx_payment_idempotency_user_key');
        await queryInterface.removeIndex('payment_idempotency_keys', 'idx_payment_idempotency_user_id');
        await queryInterface.dropTable('payment_idempotency_keys');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payment_idempotency_keys_status";');
    }
};
