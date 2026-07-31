'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
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
