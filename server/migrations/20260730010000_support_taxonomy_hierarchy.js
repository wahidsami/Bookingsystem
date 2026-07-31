'use strict';

const { ensureIdempotentIndexing } = require('./_index-utils');

const { randomUUID } = require('crypto');
const { SUPPORT_TAXONOMY_CATALOG } = require('../src/utils/supportTaxonomyCatalog');

function materializeTaxonomy(nodes, parentId = null, bucket = [], level = 0) {
    nodes.forEach((node, index) => {
        const id = randomUUID();
        const slug = `${node.key}`.toLowerCase();

        bucket.push({
            id,
            tenantId: null,
            parentId,
            slug,
            scope: 'global',
            name: node.name,
            nameAr: node.nameAr || null,
            description: node.description || null,
            descriptionAr: node.descriptionAr || null,
            icon: node.icon || null,
            color: node.color || null,
            featureKey: node.featureKey || node.key,
            featureRoute: node.featureRoute || null,
            sortOrder: Number.isFinite(node.sortOrder) ? node.sortOrder : index + 1,
            isActive: node.isActive !== false,
            metadata: JSON.stringify({
                ...(node.metadata || {}),
                level,
                seedSource: 'support_taxonomy_catalog'
            }),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        if (Array.isArray(node.children) && node.children.length > 0) {
            materializeTaxonomy(node.children, id, bucket, level + 1);
        }
    });

    return bucket;
}

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
        await queryInterface.addColumn('support_categories', 'parentId', {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'support_categories', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });

        await queryInterface.addColumn('support_categories', 'featureKey', {
            type: Sequelize.STRING(160),
            allowNull: true
        });

        await queryInterface.addColumn('support_categories', 'featureRoute', {
            type: Sequelize.STRING(255),
            allowNull: true
        });

        await queryInterface.addIndex('support_categories', ['parentId'], {
            name: 'idx_support_categories_parent'
        });
        await queryInterface.addIndex('support_categories', ['featureKey'], {
            name: 'idx_support_categories_feature_key'
        });
        await queryInterface.addIndex('support_categories', ['featureRoute'], {
            name: 'idx_support_categories_feature_route'
        });

        const [countRows] = await queryInterface.sequelize.query(
            'SELECT COUNT(*)::int AS count FROM public.support_categories;'
        );
        const count = Number(countRows?.[0]?.count || 0);

        if (count === 0) {
            const rows = materializeTaxonomy(SUPPORT_TAXONOMY_CATALOG);
            await queryInterface.bulkInsert('support_categories', rows);
            return;
        }

        await queryInterface.sequelize.query(`
            UPDATE public.support_categories
            SET "featureKey" = COALESCE("featureKey", "slug"),
                "parentId" = COALESCE("parentId", NULL),
                "updatedAt" = CURRENT_TIMESTAMP
        `);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('support_categories', 'idx_support_categories_feature_route');
        await queryInterface.removeIndex('support_categories', 'idx_support_categories_feature_key');
        await queryInterface.removeIndex('support_categories', 'idx_support_categories_parent');

        await queryInterface.removeColumn('support_categories', 'featureRoute');
        await queryInterface.removeColumn('support_categories', 'featureKey');
        await queryInterface.removeColumn('support_categories', 'parentId');
    }
};
