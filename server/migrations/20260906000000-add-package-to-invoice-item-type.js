'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the enum value already exists to make it idempotent
    const [results] = await queryInterface.sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'enum_customer_invoice_items_itemType' AND enumlabel = 'package';
    `);
    
    if (results.length === 0) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_customer_invoice_items_itemType" ADD VALUE 'package';`
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    // PostgreSQL does not support dropping a value from an ENUM type safely in a simple query.
    console.log("PostgreSQL does not support dropping ENUM values. Down migration skipped.");
  }
};
