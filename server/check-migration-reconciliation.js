#!/usr/bin/env node
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const SequelizeModule = require('sequelize');
const Sequelize = SequelizeModule.Sequelize || SequelizeModule;
const QueryTypes = SequelizeModule.QueryTypes || (Sequelize && Sequelize.QueryTypes);
const db = require('./src/models');

const MIGRATION_CUTOFF = '20260306000000-tenant-subscription-flow-status.js';
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function normalizeName(value) {
    return `${value || ''}`.toLowerCase();
}

function normalizeTypeText(value) {
    return normalizeName(value)
        .replace(/character varying/g, 'varchar')
        .replace(/timestamp with time zone/g, 'timestamptz')
        .replace(/timestamp without time zone/g, 'timestamp')
        .replace(/double precision/g, 'float8')
        .replace(/integer/g, 'int')
        .replace(/boolean/g, 'bool')
        .replace(/json binary/g, 'jsonb')
        .replace(/jsonb/g, 'jsonb');
}

function stringifyType(value) {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'function' && value.name) return value.name;
    if (typeof value?.toSql === 'function') return value.toSql();
    if (typeof value?.toString === 'function') return value.toString();
    if (value && typeof value === 'object') {
        if ('key' in value) return `${value.key}`;
        if ('type' in value) return stringifyType(value.type);
    }
    return `${value}`;
}

function isLikelyTypeMatch(actual, expected) {
    if (!expected) return true;
    const actualText = normalizeTypeText(actual);
    const expectedText = normalizeTypeText(expected);
    return actualText.includes(expectedText) || expectedText.includes(actualText);
}

function formatObjectList(items) {
    if (!items.length) return '-';
    return items.join(', ');
}

function collectColumns(definition) {
    return Object.entries(definition || {}).map(([name, column]) => ({
        name,
        definition: column
    }));
}

function makeColumnCheck(tableName, columnName, definition) {
    return {
        kind: 'column',
        tableName,
        columnName,
        definition
    };
}

function makeIndexCheck(tableName, indexName, fields = [], unique = false) {
    return {
        kind: 'index',
        tableName,
        indexName,
        fields: Array.isArray(fields) ? fields : [fields],
        unique: Boolean(unique)
    };
}

function makeForeignKeyCheck(tableName, columnName, definition) {
    if (!definition?.references?.model) {
        return null;
    }

    return {
        kind: 'foreignKey',
        tableName,
        columnName,
        referencedTable: definition.references.model,
        referencedColumn: definition.references.key || 'id',
        onDelete: definition.onDelete || null,
        onUpdate: definition.onUpdate || null
    };
}

function makeUniqueColumnCheck(tableName, columnName) {
    return {
        kind: 'uniqueColumn',
        tableName,
        columnName
    };
}

function makeTableChecks(tableName, definition) {
    const checks = [ { kind: 'table', tableName } ];
    for (const column of collectColumns(definition)) {
        checks.push(makeColumnCheck(tableName, column.name, column.definition));
        const fk = makeForeignKeyCheck(tableName, column.name, column.definition);
        if (fk) checks.push(fk);
        if (column.definition?.unique) {
            checks.push(makeUniqueColumnCheck(tableName, column.name));
        }
    }
    return checks;
}

function getManualSpecs(fileName) {
    switch (fileName) {
        case '20260407000000-add-void-bill-status.js':
            return [
                { kind: 'table', tableName: 'bills' },
                makeColumnCheck('bills', 'status', { type: 'ENUM / CHECK', allowNull: false }),
                { kind: 'constraint', tableName: 'bills', constraintName: 'bills_status_check' }
            ];
        case '20260407010000-repair-staff-permissions-schema.js':
            return [
                { kind: 'table', tableName: 'staff_permissions' },
                makeColumnCheck('staff_permissions', 'id', { type: 'UUID', allowNull: true }),
                makeColumnCheck('staff_permissions', 'staffId', { type: 'UUID', allowNull: true }),
                makeColumnCheck('staff_permissions', 'permissions', { type: 'JSONB', allowNull: false }),
                makeColumnCheck('staff_permissions', 'createdAt', { type: 'TIMESTAMPTZ', allowNull: false }),
                makeColumnCheck('staff_permissions', 'updatedAt', { type: 'TIMESTAMPTZ', allowNull: false })
            ];
        case '20260421000000-add-staff-position.js':
            return [
                { kind: 'table', tableName: 'staff' },
                makeColumnCheck('staff', 'position', { type: 'VARCHAR', allowNull: true })
            ];
        case '20260421030000-create-tenant-dashboard-accounts.js':
            return [
                { kind: 'table', tableName: 'tenant_dashboard_accounts' },
                makeColumnCheck('tenant_dashboard_accounts', 'id', { type: 'UUID', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'tenantId', { type: 'UUID', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'email', { type: 'VARCHAR', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'password', { type: 'VARCHAR', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'displayName', { type: 'VARCHAR', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'roleKey', { type: 'VARCHAR', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'permissions', { type: 'JSONB', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'isActive', { type: 'BOOLEAN', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'passwordResetRequired', { type: 'BOOLEAN', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'lastLoginAt', { type: 'TIMESTAMPTZ', allowNull: true }),
                makeColumnCheck('tenant_dashboard_accounts', 'lastLoginIP', { type: 'VARCHAR', allowNull: true }),
                makeColumnCheck('tenant_dashboard_accounts', 'createdAt', { type: 'TIMESTAMPTZ', allowNull: false }),
                makeColumnCheck('tenant_dashboard_accounts', 'updatedAt', { type: 'TIMESTAMPTZ', allowNull: false }),
                makeIndexCheck('tenant_dashboard_accounts', 'uq_tenant_dashboard_accounts_tenant_email', ['tenantId', 'email'], true),
                makeIndexCheck('tenant_dashboard_accounts', 'idx_tenant_dashboard_accounts_tenant', ['tenantId'], false),
                makeIndexCheck('tenant_dashboard_accounts', 'idx_tenant_dashboard_accounts_role', ['roleKey'], false)
            ];
        case '20260421050000-add-staff-dashboard-permissions.js':
            return [
                { kind: 'table', tableName: 'staff' },
                makeColumnCheck('staff', 'dashboardPermissions', { type: 'JSONB', allowNull: false })
            ];
        case '20260513170000-add-image-to-hot-deals.sql':
            return [
                { kind: 'table', tableName: 'hot_deals' },
                makeColumnCheck('hot_deals', 'image', { type: 'VARCHAR', allowNull: true })
            ];
        default:
            return [];
    }
}

function buildFakeQueryInterface(operations, captureSelectFn) {
    return {
        async createTable(tableName, definition, options = {}) {
            operations.push({ kind: 'createTable', tableName, definition, options });
        },
        async addColumn(tableName, columnName, definition, options = {}) {
            operations.push({ kind: 'addColumn', tableName, columnName, definition, options });
        },
        async addIndex(tableName, fields, options = {}) {
            operations.push({ kind: 'addIndex', tableName, fields, options });
        },
        async changeColumn(tableName, columnName, definition, options = {}) {
            operations.push({ kind: 'changeColumn', tableName, columnName, definition, options });
        },
        async removeIndex(tableName, indexNameOrFields, options = {}) {
            operations.push({ kind: 'removeIndex', tableName, indexNameOrFields, options });
        },
        async removeColumn(tableName, columnName, options = {}) {
            operations.push({ kind: 'removeColumn', tableName, columnName, options });
        },
        async dropTable(tableName, options = {}) {
            operations.push({ kind: 'dropTable', tableName, options });
        },
        async bulkInsert(tableName, rows, options = {}) {
            operations.push({ kind: 'bulkInsert', tableName, rowCount: Array.isArray(rows) ? rows.length : 0, options });
        },
        sequelize: {
            async query(sql, options = {}) {
                const text = Array.isArray(sql) ? sql.join(' ') : `${sql}`;
                operations.push({ kind: 'rawSql', sql: text.trim() });
                if (captureSelectFn && captureSelectFn(text)) {
                    return captureSelectFn(text);
                }
                return [[], null];
            }
        }
    };
}

async function loadSequelizeMeta() {
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    const metaTable = tables.find((name) => normalizeName(name) === 'sequelizemeta');
    if (!metaTable) {
        return { tableName: null, migrations: new Set() };
    }

    const rows = await db.sequelize.query(`SELECT name FROM "${metaTable}" ORDER BY name ASC`, {
        type: QueryTypes.SELECT,
        raw: true
    });
    return {
        tableName: metaTable,
        migrations: new Set(rows.map((row) => row.name))
    };
}

async function inspectTable(tableName) {
    const queryInterface = db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const exists = tables.some((table) => normalizeName(table) === normalizeName(tableName));
    if (!exists) {
        return { exists: false, columns: {}, indexes: [], foreignKeys: [] };
    }

    const [columns, indexes, foreignKeys] = await Promise.all([
        queryInterface.describeTable(tableName).catch(() => ({})),
        queryInterface.showIndex(tableName).catch(() => []),
        queryInterface.getForeignKeyReferencesForTable(tableName).catch(() => [])
    ]);

    return {
        exists: true,
        columns,
        indexes,
        foreignKeys
    };
}

async function inspectConstraint(tableName, constraintName) {
    const safeTable = `public.${tableName.replace(/"/g, '""')}`;
    const safeConstraint = `${constraintName}`.replace(/"/g, '""');
    const [rows] = await db.sequelize.query(`
        SELECT conname
        FROM pg_constraint
        WHERE conname = '${safeConstraint}'
          AND conrelid = '${safeTable}'::regclass
        LIMIT 1
    `, {
        type: QueryTypes.SELECT,
        raw: true
    }).catch(() => [[]]);

    return Array.isArray(rows) ? rows.length > 0 : false;
}

async function inspectExpectedObject(expected, schemaCache) {
    const tableInfo = async (tableName) => {
        if (!schemaCache.has(tableName)) {
            schemaCache.set(tableName, inspectTable(tableName));
        }
        return schemaCache.get(tableName);
    };

    if (expected.kind === 'table') {
        const info = await tableInfo(expected.tableName);
        return info.exists
            ? { found: [`table ${expected.tableName}`], missing: [], different: [] }
            : { found: [], missing: [`table ${expected.tableName}`], different: [] };
    }

    if (expected.kind === 'column') {
        const info = await tableInfo(expected.tableName);
        const label = `${expected.tableName}.${expected.columnName}`;
        if (!info.exists) {
            return { found: [], missing: [label], different: [] };
        }

        const actual = info.columns?.[expected.columnName];
        if (!actual) {
            return { found: [], missing: [label], different: [] };
        }

        const different = [];
        const expectedType = stringifyType(expected.definition?.type || expected.definition?.allowNull);
        const actualType = stringifyType(actual.type);
        if (expected.definition?.type && !isLikelyTypeMatch(actualType, expectedType)) {
            different.push(`${label} type expected ${expectedType} got ${actualType}`);
        }
        if (typeof expected.definition?.allowNull === 'boolean' && actual.allowNull !== expected.definition.allowNull) {
            different.push(`${label} allowNull expected ${expected.definition.allowNull} got ${actual.allowNull}`);
        }

        return {
            found: [label],
            missing: [],
            different
        };
    }

    if (expected.kind === 'index') {
        const info = await tableInfo(expected.tableName);
        const label = `index ${expected.indexName}`;
        if (!info.exists) {
            return { found: [], missing: [label], different: [] };
        }
        const actual = (info.indexes || []).find((idx) => normalizeName(idx.name) === normalizeName(expected.indexName));
        if (!actual) {
            return { found: [], missing: [label], different: [] };
        }

        const actualFields = (actual.fields || []).map((field) => field.attribute || field.name || field);
        const different = [];
        const expectedFields = expected.fields || [];
        if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
            different.push(`${label} fields expected [${expectedFields.join(', ')}] got [${actualFields.join(', ')}]`);
        }
        if (typeof expected.unique === 'boolean' && Boolean(actual.unique) !== expected.unique) {
            different.push(`${label} unique expected ${expected.unique} got ${Boolean(actual.unique)}`);
        }

        return { found: [label], missing: [], different };
    }

    if (expected.kind === 'foreignKey') {
        const info = await tableInfo(expected.tableName);
        const label = `fk ${expected.tableName}.${expected.columnName}`;
        if (!info.exists) {
            return { found: [], missing: [label], different: [] };
        }
        const actual = (info.foreignKeys || []).find((fk) => normalizeName(fk.columnName) === normalizeName(expected.columnName));
        if (!actual) {
            return { found: [], missing: [label], different: [] };
        }
        const different = [];
        if (expected.referencedTable && normalizeName(actual.referencedTable) !== normalizeName(expected.referencedTable)) {
            different.push(`${label} referencedTable expected ${expected.referencedTable} got ${actual.referencedTable}`);
        }
        if (expected.referencedColumn && normalizeName(actual.referencedColumn) !== normalizeName(expected.referencedColumn)) {
            different.push(`${label} referencedColumn expected ${expected.referencedColumn} got ${actual.referencedColumn}`);
        }
        return { found: [label], missing: [], different };
    }

    if (expected.kind === 'constraint') {
        const exists = await inspectConstraint(expected.tableName, expected.constraintName);
        const label = `constraint ${expected.constraintName}`;
        return exists ? { found: [label], missing: [], different: [] } : { found: [], missing: [label], different: [] };
    }

    if (expected.kind === 'uniqueColumn') {
        const info = await tableInfo(expected.tableName);
        const label = `unique ${expected.tableName}.${expected.columnName}`;
        if (!info.exists) {
            return { found: [], missing: [label], different: [] };
        }
        const uniqueIndex = (info.indexes || []).find((idx) => Boolean(idx.unique) && JSON.stringify((idx.fields || []).map((field) => field.attribute || field.name || field)) === JSON.stringify([expected.columnName]));
        return uniqueIndex ? { found: [label], missing: [], different: [] } : { found: [], missing: [label], different: [] };
    }

    if (expected.kind === 'rawSql') {
        return {
            found: [`sql ${expected.note || 'operation'}`],
            missing: [],
            different: []
        };
    }

    return { found: [], missing: [], different: [] };
}

async function inspectMigrationFile(fileName) {
    const filePath = path.join(MIGRATIONS_DIR, fileName);
    const ext = path.extname(fileName).toLowerCase();
    const operations = [];

    if (ext === '.js') {
        const migration = require(filePath);
        const fakeQuery = async (sql) => {
            const text = Array.isArray(sql) ? sql.join(' ') : `${sql}`;
            operations.push({ kind: 'rawSql', sql: text.trim() });

            if (/SELECT COUNT\(\*\)::int AS count FROM public\.support_categories/i.test(text)) {
                const rows = await db.sequelize.query(
                    'SELECT COUNT(*)::int AS count FROM public.support_categories;',
                    { type: QueryTypes.SELECT, raw: true }
                );
                return [rows, null];
            }

            return [[], null];
        };

        const fakeQueryInterface = buildFakeQueryInterface(operations, fakeQuery);

        if (typeof migration.up === 'function') {
            await migration.up(fakeQueryInterface, Sequelize);
        } else if (typeof migration === 'function') {
            await migration(fakeQueryInterface, Sequelize);
        }
    }

    if (ext === '.sql') {
        const sql = fs.readFileSync(filePath, 'utf8');
        operations.push({ kind: 'rawSql', sql: sql.trim(), sqlFile: true });
    }

    const manualSpecs = getManualSpecs(fileName);
    const specs = [...manualSpecs];

    for (const op of operations) {
        if (op.kind === 'createTable') {
            specs.push(...makeTableChecks(op.tableName, op.definition));
            continue;
        }
        if (op.kind === 'addColumn') {
            specs.push(makeColumnCheck(op.tableName, op.columnName, op.definition));
            const fk = makeForeignKeyCheck(op.tableName, op.columnName, op.definition);
            if (fk) specs.push(fk);
            continue;
        }
        if (op.kind === 'addIndex') {
            const fields = Array.isArray(op.fields) ? op.fields : [op.fields];
            specs.push(makeIndexCheck(op.tableName, op.options?.name || `${op.tableName}_${fields.join('_')}_idx`, fields, op.options?.unique));
            continue;
        }
        if (op.kind === 'changeColumn') {
            specs.push(makeColumnCheck(op.tableName, op.columnName, op.definition));
            continue;
        }
        if (op.kind === 'rawSql') {
            specs.push({ kind: 'rawSql', tableName: null, sql: op.sql, note: fileName });
        }
    }

    const schemaCache = new Map();
    const inspected = [];
    const found = [];
    const missing = [];
    const different = [];

    // de-duplicate by label
    const seen = new Set();
    for (const spec of specs) {
        const key = `${spec.kind}:${spec.tableName || ''}:${spec.columnName || spec.indexName || spec.constraintName || spec.note || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const result = await inspectExpectedObject(spec, schemaCache);
        inspected.push(spec);
        found.push(...result.found);
        missing.push(...result.missing);
        different.push(...result.different);
    }

    const allFound = missing.length === 0 && different.length === 0;
    const status = allFound ? 'Fully Applied' : (found.length > 0 ? 'Partially Applied' : 'Not Applied');

    return {
        fileName,
        status,
        found,
        missing,
        different,
        specs: inspected
    };
}

async function run() {
    const allFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return (ext === '.js' || ext === '.sql') && file > MIGRATION_CUTOFF;
        })
        .sort((a, b) => a.localeCompare(b));

    const meta = await loadSequelizeMeta().catch(() => ({ tableName: null, migrations: new Set() }));
    const report = [];

    console.log('🔎 Production migration reconciliation\n');
    console.log(`Cutoff: ${MIGRATION_CUTOFF}`);
    console.log(`SequelizeMeta table: ${meta.tableName || 'not found'}\n`);

    for (const fileName of allFiles) {
        try {
            const result = await inspectMigrationFile(fileName);
            const metaState = meta.migrations.has(fileName) ? 'present' : 'missing';
            report.push({ ...result, metaState });

            console.log(`Migration: ${fileName}`);
            console.log(`  SequelizeMeta: ${metaState}`);
            console.log(`  Status: ${result.status}`);
            console.log(`  Expected Objects: ${result.specs.length}`);
            console.log(`  Objects Found: ${formatObjectList(result.found)}`);
            console.log(`  Objects Missing: ${formatObjectList(result.missing)}`);
            console.log(`  Objects Different: ${formatObjectList(result.different)}`);
            console.log('');
        } catch (error) {
            console.log(`Migration: ${fileName}`);
            console.log(`  SequelizeMeta: ${meta.migrations.has(fileName) ? 'present' : 'missing'}`);
            console.log('  Status: Manual Review');
            console.log(`  Error: ${error.message}`);
            console.log('');
            report.push({
                fileName,
                status: 'Manual Review',
                metaState: meta.migrations.has(fileName) ? 'present' : 'missing',
                found: [],
                missing: [],
                different: [error.message],
                specs: []
            });
        }
    }

    const summary = report.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
    }, {});

    console.log('Summary');
    console.log('-------');
    Object.entries(summary).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
    });

    console.log('\nRecovery plan');
    console.log('--------------');
    console.log('- Fully Applied + SequelizeMeta missing: safe to reconcile metadata after confirming the schema matches.');
    console.log('- Partially Applied: stop replay, inspect missing/different objects, and make the migration idempotent before re-running.');
    console.log('- Not Applied: run the migration later in chronological order after reconciliation.');
    console.log('- SQL-only artifacts are reported separately and are not executed by sequelize-cli.');
}

run().catch((error) => {
    console.error('\nFatal reconciliation error:', error);
    process.exit(1);
});
