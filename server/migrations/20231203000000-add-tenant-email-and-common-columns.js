'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;
    if (sequelize.getDialect() !== 'postgres') return;

    await sequelize.query(`
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);
  },

  async down() {}
};
