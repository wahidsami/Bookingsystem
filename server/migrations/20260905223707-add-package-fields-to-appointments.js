'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('appointments', 'packageSequenceOrder', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('appointments', 'packageSnapshot', {
        type: Sequelize.JSONB,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('appointments', 'packageItemSnapshot', {
        type: Sequelize.JSONB,
        allowNull: true
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('appointments', 'packageItemSnapshot', { transaction });
      await queryInterface.removeColumn('appointments', 'packageSnapshot', { transaction });
      await queryInterface.removeColumn('appointments', 'packageSequenceOrder', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
