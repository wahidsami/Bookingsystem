'use strict';

const { QueryTypes } = require('sequelize');

function normalizeFieldName(field) {
  if (typeof field === 'string') {
    return field;
  }

  if (!field || typeof field !== 'object') {
    return String(field);
  }

  return field.attribute || field.attributeName || field.name || field.field || String(field);
}

function normalizeFields(fields) {
  return Array.isArray(fields) ? fields.map(normalizeFieldName) : [normalizeFieldName(fields)];
}

async function ensureIdempotentIndexing(queryInterface) {
  if (queryInterface.__idempotentIndexingPatched) {
    return;
  }

  const originalAddIndex = queryInterface.addIndex.bind(queryInterface);

  queryInterface.addIndex = async (tableName, fields, options = {}, ...rest) => {
    const indexName = options?.name;

    if (indexName) {
      const existing = await queryInterface.sequelize.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = :indexName
          ) AS "exists"
        `,
        {
          replacements: { indexName },
          type: QueryTypes.SELECT
        }
      );

      if (existing?.[0]?.exists) {
        return;
      }
    }

    return originalAddIndex(tableName, fields, options, ...rest);
  };

  queryInterface.__idempotentIndexingPatched = true;
}

module.exports = {
  ensureIdempotentIndexing,
  normalizeFieldName,
  normalizeFields
};

