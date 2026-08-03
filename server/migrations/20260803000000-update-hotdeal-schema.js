'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add new columns
    await queryInterface.addColumn('hot_deals', 'title', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('hot_deals', 'subtitle', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // 2. Coalesce data
    // Prioritize Arabic title if it exists, otherwise English
    await queryInterface.sequelize.query(`
      UPDATE hot_deals
      SET 
        title = COALESCE(title_ar, title_en, 'Untitled'),
        subtitle = COALESCE(description_ar, description_en)
    `);

    // 3. Make title non-null
    await queryInterface.changeColumn('hot_deals', 'title', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // 4. Drop old columns
    await queryInterface.removeColumn('hot_deals', 'title_en');
    await queryInterface.removeColumn('hot_deals', 'title_ar');
    await queryInterface.removeColumn('hot_deals', 'description_en');
    await queryInterface.removeColumn('hot_deals', 'description_ar');
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Add back old columns
    await queryInterface.addColumn('hot_deals', 'title_en', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('hot_deals', 'title_ar', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('hot_deals', 'description_en', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('hot_deals', 'description_ar', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // 2. Restore data (best effort)
    await queryInterface.sequelize.query(`
      UPDATE hot_deals
      SET 
        title_ar = title,
        title_en = title,
        description_ar = subtitle,
        description_en = subtitle
    `);

    // 3. Drop new columns
    await queryInterface.removeColumn('hot_deals', 'title');
    await queryInterface.removeColumn('hot_deals', 'subtitle');
  }
};
