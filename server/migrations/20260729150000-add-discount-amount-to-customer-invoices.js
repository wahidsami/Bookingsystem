'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('customer_invoices', 'discountAmount', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('customer_invoices', 'discountAmount');
    }
};
