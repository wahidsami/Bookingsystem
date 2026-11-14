'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. gift_card_codes
        await queryInterface.addColumn('gift_card_codes', 'recipientName', {
            type: Sequelize.STRING(255),
            allowNull: true
        });
        await queryInterface.addColumn('gift_card_codes', 'voucherType', {
            type: Sequelize.STRING(32),
            allowNull: false,
            defaultValue: 'monetary'
        });
        await queryInterface.addColumn('gift_card_codes', 'serviceId', {
            type: Sequelize.UUID,
            allowNull: true
        });
        await queryInterface.addColumn('gift_card_codes', 'servicePackageId', {
            type: Sequelize.UUID,
            allowNull: true
        });
        await queryInterface.addColumn('gift_card_codes', 'giftMessage', {
            type: Sequelize.TEXT,
            allowNull: true
        });

        // 2. tenant_gift_card_transactions
        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_transactions
            ALTER COLUMN "packageId" DROP NOT NULL;
        `);

        await queryInterface.addColumn('tenant_gift_card_transactions', 'recipientName', {
            type: Sequelize.STRING(255),
            allowNull: true
        });
        await queryInterface.addColumn('tenant_gift_card_transactions', 'voucherType', {
            type: Sequelize.STRING(32),
            allowNull: false,
            defaultValue: 'monetary'
        });
        await queryInterface.addColumn('tenant_gift_card_transactions', 'serviceId', {
            type: Sequelize.UUID,
            allowNull: true
        });
        await queryInterface.addColumn('tenant_gift_card_transactions', 'servicePackageId', {
            type: Sequelize.UUID,
            allowNull: true
        });
        await queryInterface.addColumn('tenant_gift_card_transactions', 'giftMessage', {
            type: Sequelize.TEXT,
            allowNull: true
        });

        // 3. tenant_gift_card_packages
        await queryInterface.addColumn('tenant_gift_card_packages', 'voucherType', {
            type: Sequelize.STRING(32),
            allowNull: false,
            defaultValue: 'monetary'
        });
        await queryInterface.addColumn('tenant_gift_card_packages', 'serviceId', {
            type: Sequelize.UUID,
            allowNull: true
        });
        await queryInterface.addColumn('tenant_gift_card_packages', 'servicePackageId', {
            type: Sequelize.UUID,
            allowNull: true
        });
    },

    async down(queryInterface, Sequelize) {
        // Revert tenant_gift_card_packages
        await queryInterface.removeColumn('tenant_gift_card_packages', 'servicePackageId');
        await queryInterface.removeColumn('tenant_gift_card_packages', 'serviceId');
        await queryInterface.removeColumn('tenant_gift_card_packages', 'voucherType');

        // Revert tenant_gift_card_transactions
        await queryInterface.removeColumn('tenant_gift_card_transactions', 'giftMessage');
        await queryInterface.removeColumn('tenant_gift_card_transactions', 'servicePackageId');
        await queryInterface.removeColumn('tenant_gift_card_transactions', 'serviceId');
        await queryInterface.removeColumn('tenant_gift_card_transactions', 'voucherType');
        await queryInterface.removeColumn('tenant_gift_card_transactions', 'recipientName');

        // Revert gift_card_codes
        await queryInterface.removeColumn('gift_card_codes', 'giftMessage');
        await queryInterface.removeColumn('gift_card_codes', 'servicePackageId');
        await queryInterface.removeColumn('gift_card_codes', 'serviceId');
        await queryInterface.removeColumn('gift_card_codes', 'voucherType');
        await queryInterface.removeColumn('gift_card_codes', 'recipientName');
    }
};
