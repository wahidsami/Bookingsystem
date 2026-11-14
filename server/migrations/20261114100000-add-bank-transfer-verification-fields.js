'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payment_transactions', 'verification_status', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'verified'
    });

    await queryInterface.addColumn('payment_transactions', 'verified_by', {
      type: Sequelize.UUID,
      allowNull: true
    });

    await queryInterface.addColumn('payment_transactions', 'verified_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('payment_transactions', 'rejection_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('payment_transactions', 'proof_attachment_url', {
      type: Sequelize.STRING(1024),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('payment_transactions', 'verification_status');
    await queryInterface.removeColumn('payment_transactions', 'verified_by');
    await queryInterface.removeColumn('payment_transactions', 'verified_at');
    await queryInterface.removeColumn('payment_transactions', 'rejection_reason');
    await queryInterface.removeColumn('payment_transactions', 'proof_attachment_url');
  }
};
