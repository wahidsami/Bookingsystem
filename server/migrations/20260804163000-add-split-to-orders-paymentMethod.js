'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the enum value already exists to make it idempotent
    const [results] = await queryInterface.sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'enum_orders_paymentMethod' AND enumlabel = 'split';
    `);

    if (results.length === 0) {
      // PostgreSQL requires ALTER TYPE ADD VALUE to be run outside a transaction block 
      // in some versions. We execute it as a raw query without attaching a transaction.
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_orders_paymentMethod" ADD VALUE 'split';`
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    // PostgreSQL does not support dropping a value from an ENUM type.
    // Removing an enum value requires renaming the type, creating a new type,
    // casting data, and dropping the old type, which is dangerous for production.
    console.log("PostgreSQL does not support dropping ENUM values. Down migration skipped.");
  }
};
