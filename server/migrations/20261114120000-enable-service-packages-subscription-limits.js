'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE subscription_packages
      SET limits = jsonb_set(COALESCE(limits::jsonb, '{}'::jsonb), '{hasServicePackages}', 'true'::jsonb, true)
      WHERE (limits->>'maxPackages')::text != '0';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Only enterprise originally had hasServicePackages: true
    await queryInterface.sequelize.query(`
      UPDATE subscription_packages
      SET limits = limits::jsonb - 'hasServicePackages'
      WHERE name != 'Enterprise';
    `);
  }
};
