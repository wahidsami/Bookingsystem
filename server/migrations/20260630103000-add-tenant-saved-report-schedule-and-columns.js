'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('./_index-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
        await queryInterface.addColumn('tenant_saved_reports', 'columns', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: []
        });

        await queryInterface.addColumn('tenant_saved_reports', 'scheduleConfig', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {}
        });

        await queryInterface.addColumn('tenant_saved_reports', 'lastRunAt', {
            type: Sequelize.DATE,
            allowNull: true
        });

        await queryInterface.addColumn('tenant_saved_reports', 'nextRunAt', {
            type: Sequelize.DATE,
            allowNull: true
        });

        await queryInterface.addColumn('tenant_saved_reports', 'lastRunResult', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {}
        });

        await queryInterface.addColumn('tenant_saved_reports', 'runHistory', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: []
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('tenant_saved_reports', 'runHistory');
        await queryInterface.removeColumn('tenant_saved_reports', 'lastRunResult');
        await queryInterface.removeColumn('tenant_saved_reports', 'nextRunAt');
        await queryInterface.removeColumn('tenant_saved_reports', 'lastRunAt');
        await queryInterface.removeColumn('tenant_saved_reports', 'scheduleConfig');
        await queryInterface.removeColumn('tenant_saved_reports', 'columns');
    }
};
