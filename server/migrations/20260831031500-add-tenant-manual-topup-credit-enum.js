'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the enum value already exists to make it idempotent
    const [results] = await queryInterface.sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'enum_tenant_wallet_ledger_entries_type' AND enumlabel = 'tenant_manual_topup_credit';
    `);
    
    if (results.length === 0) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_tenant_wallet_ledger_entries_type" ADD VALUE 'tenant_manual_topup_credit';`
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    // PostgreSQL does not support dropping a value from an ENUM type.
    // Removing an enum value requires renaming the type, creating a new type,
    // and recreating the column. 
    console.log("PostgreSQL does not support dropping ENUM values. Down migration skipped.");
  }
};
