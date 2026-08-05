'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Orders do not have discounts in this system natively.
    // All existing discounts on order-type customer invoices were incorrectly mathematically derived from VAT.
    // This script cleans up that dirty data by setting them to 0.
    
    // We try both snake_case and camelCase in case the DB maps them differently.
    // Since the model doesn't specify 'field', it's likely camelCase in Postgres.
    try {
        await queryInterface.sequelize.query(`
          UPDATE customer_invoices
          SET "discountAmount" = 0
          WHERE "entityType" = 'order' 
          AND "discountAmount" > 0;
        `);
        console.log('Fixed camelCase discountAmount in customer_invoices');
    } catch (e) {
        console.log('camelCase failed, trying snake_case...', e.message);
        try {
            await queryInterface.sequelize.query(`
              UPDATE customer_invoices
              SET discount_amount = 0
              WHERE entity_type = 'order' 
              AND discount_amount > 0;
            `);
            console.log('Fixed snake_case discount_amount in customer_invoices');
        } catch (e2) {
            console.error('Failed to update customer_invoices:', e2.message);
        }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // This is a data cleanup migration, cannot be reliably reversed.
  }
};
