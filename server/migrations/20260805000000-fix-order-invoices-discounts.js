'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Describe table to dynamically detect column naming convention (camelCase vs snake_case)
    const columns = await queryInterface.describeTable('customer_invoices');
    
    // 2. Identify correct identifiers
    const discountColumn = columns.discountAmount ? '"discountAmount"' : 'discount_amount';
    const entityColumn = columns.entityType ? '"entityType"' : 'entity_type';
    
    // 3. Build single deterministic SQL statement
    const sql = `
      UPDATE customer_invoices
      SET ${discountColumn} = 0
      WHERE ${entityColumn} = 'order' 
      AND ${discountColumn} > 0
      RETURNING id;
    `;
    
    // 4. Execute SQL (no try/catch so any failure natively bubbles up and aborts migration)
    const [results] = await queryInterface.sequelize.query(sql);
    
    // 5. Report exactly how many rows were updated
    console.log(`Updated ${results.length} customer_invoices rows.`);
  },

  down: async (queryInterface, Sequelize) => {
    // This is a data cleanup migration; historical discounts cannot be reliably reversed.
  }
};
