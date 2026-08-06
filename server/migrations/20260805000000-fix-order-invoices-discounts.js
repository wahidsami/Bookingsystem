'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Describe table to dynamically detect column naming convention (camelCase vs snake_case)
    const columns = await queryInterface.describeTable('customer_invoices');
    
    // 2. Validate columns exist before proceeding
    if (!columns.discountAmount && !columns.discount_amount) {
      throw new Error('customer_invoices is missing both discountAmount and discount_amount columns.');
    }
    
    if (!columns.entityType && !columns.entity_type) {
      throw new Error('customer_invoices is missing both entityType and entity_type columns.');
    }
    
    // 3. Identify correct identifiers
    const discountColumn = columns.discountAmount ? '"discountAmount"' : 'discount_amount';
    const entityColumn = columns.entityType ? '"entityType"' : 'entity_type';
    
    // 4. Log detected schema
    console.log('Detected schema:');
    console.log(`discountColumn = ${discountColumn}`);
    console.log(`entityColumn = ${entityColumn}`);
    
    // 5. Build single deterministic SQL statement
    const sql = `
      UPDATE customer_invoices
      SET ${discountColumn} = 0
      WHERE ${entityColumn} = 'order' 
      AND ${discountColumn} > 0
      RETURNING id;
    `;
    
    // 6. Execute SQL (no try/catch so any failure natively bubbles up and aborts migration)
    const [results] = await queryInterface.sequelize.query(sql);
    
    // 7. Report exactly how many rows were updated
    console.log(`Updated ${results.length} customer_invoices rows.`);
  },

  down: async (queryInterface, Sequelize) => {
    // This is a data cleanup migration; historical discounts cannot be reliably reversed.
  }
};
