'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Change product_image from VARCHAR(255) to TEXT
    await queryInterface.changeColumn('order_items', 'product_image', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Product image at time of order (snapshot)'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert product_image from TEXT to VARCHAR(255)
    // Note: If there are existing records with length > 255, reverting this might fail
    await queryInterface.changeColumn('order_items', 'product_image', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Product image at time of order (snapshot)'
    });
  }
};
