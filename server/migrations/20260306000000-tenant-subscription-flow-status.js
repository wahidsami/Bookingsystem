'use strict';

/**
 * Migration: Tenant subscription flow - new status enum and payment window
 * Maps: pending -> pending_approval, approved -> active
 * Adds: payment_due_at, more_info_message
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'tenants';

    // 1. Add new columns (camelCase to match Sequelize model)
    await queryInterface.addColumn(table, 'paymentDueAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn(table, 'moreInfoMessage', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // 2. Change status: PostgreSQL enum change via temp varchar
    await queryInterface.sequelize.query(`
      ALTER TABLE "${table}" ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
    `);
    await queryInterface.sequelize.query(`
      UPDATE "${table}" SET status = 'pending_approval' WHERE status = 'pending';
    `);
    await queryInterface.sequelize.query(`
      UPDATE "${table}" SET status = 'active' WHERE status = 'approved';
    `);

    // 3. Create new enum type and convert column back to enum
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_tenants_status_new AS ENUM (
        'registered', 'plan_selected', 'pending_approval', 'more_info_required',
        'payment_pending', 'payment_success', 'payment_failed', 'payment_expired',
        'active', 'rejected', 'suspended', 'inactive'
      );
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "${table}" ALTER COLUMN status TYPE enum_tenants_status_new
        USING status::text::enum_tenants_status_new;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "${table}" ALTER COLUMN status SET DEFAULT 'pending_approval';
    `);
    // Drop old type if it exists (Sequelize may have created enum_tenants_status)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_tenants_status CASCADE;
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_tenants_status_new RENAME TO enum_tenants_status;
    `);
  },

  async down(queryInterface, Sequelize) {
    const table = 'tenants';

    await queryInterface.removeColumn(table, 'paymentDueAt');
    await queryInterface.removeColumn(table, 'moreInfoMessage');

    await queryInterface.sequelize.query(`
      ALTER TABLE "${table}" ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
    `);
    await queryInterface.sequelize.query(`
      UPDATE "${table}" SET status = 'pending' WHERE status = 'pending_approval';
    `);
    await queryInterface.sequelize.query(`
      UPDATE "${table}" SET status = 'approved' WHERE status = 'active';
    `);
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_tenants_status CASCADE;
    `);
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_tenants_status AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'inactive');
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "${table}" ALTER COLUMN status TYPE enum_tenants_status USING status::text::enum_tenants_status;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "${table}" ALTER COLUMN status SET DEFAULT 'pending';
    `);
  }
};
