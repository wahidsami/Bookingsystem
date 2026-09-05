'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Running migration to add maxPackages to subscription package limits...');
    
    // Get all subscription packages
    const packages = await queryInterface.sequelize.query(
      `SELECT id, limits FROM "SubscriptionPackages" WHERE limits IS NOT NULL`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Update each package's limits JSONB to include maxPackages = -1 if missing
    for (const pkg of packages) {
      let limits = pkg.limits;
      if (typeof limits === 'string') {
        try {
          limits = JSON.parse(limits);
        } catch (e) {
          limits = {};
        }
      }
      
      if (limits && typeof limits === 'object') {
        if (limits.maxPackages === undefined) {
          limits.maxPackages = -1; // -1 means unlimited
          
          await queryInterface.sequelize.query(
            `UPDATE "SubscriptionPackages" SET limits = :limits WHERE id = :id`,
            {
              replacements: { 
                limits: JSON.stringify(limits), 
                id: pkg.id 
              }
            }
          );
        }
      }
    }
    
    // Do the same for TenantSubscriptions (if they have customized overrides inside package JSON)
    const subscriptions = await queryInterface.sequelize.query(
      `SELECT id, package FROM "TenantSubscriptions" WHERE package IS NOT NULL`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const sub of subscriptions) {
      let pkg = sub.package;
      if (typeof pkg === 'string') {
        try {
          pkg = JSON.parse(pkg);
        } catch (e) {
          pkg = {};
        }
      }
      
      if (pkg && pkg.limits && typeof pkg.limits === 'object') {
        if (pkg.limits.maxPackages === undefined) {
          pkg.limits.maxPackages = -1;
          
          await queryInterface.sequelize.query(
            `UPDATE "TenantSubscriptions" SET package = :package WHERE id = :id`,
            {
              replacements: { 
                package: JSON.stringify(pkg), 
                id: sub.id 
              }
            }
          );
        }
      }
    }
    
    console.log('Successfully updated maxPackages limit in SubscriptionPackages and TenantSubscriptions.');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert maxPackages from subscription package limits
    const packages = await queryInterface.sequelize.query(
      `SELECT id, limits FROM "SubscriptionPackages" WHERE limits IS NOT NULL`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const pkg of packages) {
      let limits = pkg.limits;
      if (typeof limits === 'string') {
        try {
          limits = JSON.parse(limits);
        } catch (e) {
          limits = {};
        }
      }
      
      if (limits && typeof limits === 'object') {
        if (limits.maxPackages !== undefined) {
          delete limits.maxPackages;
          
          await queryInterface.sequelize.query(
            `UPDATE "SubscriptionPackages" SET limits = :limits WHERE id = :id`,
            {
              replacements: { 
                limits: JSON.stringify(limits), 
                id: pkg.id 
              }
            }
          );
        }
      }
    }

    const subscriptions = await queryInterface.sequelize.query(
      `SELECT id, package FROM "TenantSubscriptions" WHERE package IS NOT NULL`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const sub of subscriptions) {
      let pkg = sub.package;
      if (typeof pkg === 'string') {
        try {
          pkg = JSON.parse(pkg);
        } catch (e) {
          pkg = {};
        }
      }
      
      if (pkg && pkg.limits && typeof pkg.limits === 'object') {
        if (pkg.limits.maxPackages !== undefined) {
          delete pkg.limits.maxPackages;
          
          await queryInterface.sequelize.query(
            `UPDATE "TenantSubscriptions" SET package = :package WHERE id = :id`,
            {
              replacements: { 
                package: JSON.stringify(pkg), 
                id: sub.id 
              }
            }
          );
        }
      }
    }
  }
};
