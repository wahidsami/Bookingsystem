'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('./_index-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.createTable('booking_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      bookingReference: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      platformUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platform_users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: {
        type: Sequelize.ENUM('draft', 'confirmed', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      itemCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      taxAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      platformFee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      paymentMethod: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('booking_sessions', ['tenantId', 'createdAt'], {
      name: 'idx_booking_sessions_tenant_created_at'
    });

    await queryInterface.addIndex('booking_sessions', ['platformUserId'], {
      name: 'idx_booking_sessions_platform_user'
    });

    await queryInterface.addIndex('booking_sessions', ['bookingReference'], {
      name: 'idx_booking_sessions_reference',
      unique: true
    });

    await queryInterface.addColumn('appointments', 'bookingSessionId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'booking_sessions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('appointments', 'bookingReference', {
      type: Sequelize.STRING(40),
      allowNull: true
    });

    await queryInterface.addColumn('appointments', 'bookingItemIndex', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addIndex('appointments', ['bookingSessionId'], {
      name: 'idx_appointments_booking_session_id'
    });

    await queryInterface.addIndex('appointments', ['bookingReference'], {
      name: 'idx_appointments_booking_reference'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('appointments', 'idx_appointments_booking_reference');
    await queryInterface.removeIndex('appointments', 'idx_appointments_booking_session_id');
    await queryInterface.removeColumn('appointments', 'bookingItemIndex');
    await queryInterface.removeColumn('appointments', 'bookingReference');
    await queryInterface.removeColumn('appointments', 'bookingSessionId');

    await queryInterface.removeIndex('booking_sessions', 'idx_booking_sessions_reference');
    await queryInterface.removeIndex('booking_sessions', 'idx_booking_sessions_platform_user');
    await queryInterface.removeIndex('booking_sessions', 'idx_booking_sessions_tenant_created_at');
    await queryInterface.dropTable('booking_sessions');
  }
};
