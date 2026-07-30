'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('appointments', 'depositAmount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('appointments', 'depositPaid', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('appointments', 'remainderAmount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('appointments', 'remainderPaid', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('appointments', 'totalPaid', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addIndex('appointments', ['paymentStatus', 'depositPaid', 'remainderPaid'], {
      name: 'idx_appointments_payment_status'
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('appointments', 'idx_appointments_payment_status').catch(() => {});
    await queryInterface.removeColumn('appointments', 'totalPaid');
    await queryInterface.removeColumn('appointments', 'remainderPaid');
    await queryInterface.removeColumn('appointments', 'remainderAmount');
    await queryInterface.removeColumn('appointments', 'depositPaid');
    await queryInterface.removeColumn('appointments', 'depositAmount');
  }
};
