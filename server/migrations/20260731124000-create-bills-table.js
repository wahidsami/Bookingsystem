'use strict';

const { QueryTypes } = require('sequelize');
const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch (error) {
    return false;
  }
}

async function columnExists(queryInterface, tableName, columnName) {
  const definition = await queryInterface.describeTable(tableName).catch(() => null);
  return !!definition && Object.prototype.hasOwnProperty.call(definition, columnName);
}

async function constraintExists(queryInterface, tableName, constraintName) {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = :tableName
        AND constraint_name = :constraintName
      LIMIT 1
    `,
    {
      replacements: { tableName, constraintName },
      type: QueryTypes.SELECT
    }
  );

  return rows.length > 0;
}

async function hasForeignKeyOnColumn(queryInterface, tableName, columnName) {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.constraint_schema = kcu.constraint_schema
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name = :tableName
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = :columnName
      LIMIT 1
    `,
    {
      replacements: { tableName, columnName },
      type: QueryTypes.SELECT
    }
  );

  return rows.length > 0;
}

async function hasUniqueIndexOnSingleColumn(queryInterface, tableName, columnName) {
  const indexes = await queryInterface.showIndex(tableName).catch(() => []);

  return indexes.some(index =>
    Boolean(index.unique) &&
    Array.isArray(index.fields) &&
    index.fields.length === 1 &&
    (index.fields[0].attribute === columnName || index.fields[0].name === columnName)
  );
}

async function ensureColumn(queryInterface, Sequelize, tableName, columnName, definition) {
  if (await columnExists(queryInterface, tableName, columnName)) {
    return;
  }

  await queryInterface.addColumn(tableName, columnName, definition);
}

function billsTableDefinition(Sequelize) {
  return {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    tenantId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    tenantSubscriptionId: {
      type: Sequelize.UUID,
      allowNull: false
    },
    billNumber: {
      type: Sequelize.STRING(32),
      allowNull: false
    },
    amount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    },
    subtotalAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    },
    platformMarkupRate: {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true
    },
    platformMarkupAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    },
    vatRate: {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true
    },
    vatAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    },
    discountAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    },
    currency: {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'SAR'
    },
    dueDate: {
      type: Sequelize.DATEONLY,
      allowNull: false
    },
    status: {
      type: Sequelize.ENUM('DRAFT', 'UNPAID', 'FAILED', 'PAID', 'EXPIRED', 'VOID'),
      allowNull: false,
      defaultValue: 'UNPAID'
    },
    paymentToken: {
      type: Sequelize.STRING(64),
      allowNull: false
    },
    paymentTokenExpiresAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    paidAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    invoiceIssuedAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    invoiceTitle: {
      type: Sequelize.STRING(255),
      allowNull: true
    },
    invoiceTemplateMode: {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'bilingual_ar_en'
    },
    sellerSnapshot: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    buyerSnapshot: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    lineItemsSnapshot: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    },
    planSnapshot: {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    invoicePdfPath: {
      type: Sequelize.STRING,
      allowNull: true
    },
    receiptPdfPath: {
      type: Sequelize.STRING,
      allowNull: true
    },
    paymentProvider: {
      type: Sequelize.STRING(64),
      allowNull: true
    },
    paymentReference: {
      type: Sequelize.STRING(128),
      allowNull: true
    },
    paymentMethod: {
      type: Sequelize.STRING(64),
      allowNull: true
    },
    paymentCapturedAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    },
    paymentFailureReason: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    type: {
      type: Sequelize.ENUM('initial', 'renewal', 'upgrade'),
      allowNull: false,
      defaultValue: 'initial'
    },
    metadata: {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    }
  };
}

async function ensureNamedForeignKey(queryInterface, tableName, constraintName, columns, references, options = {}) {
  if (await constraintExists(queryInterface, tableName, constraintName)) {
    return;
  }

  if (columns.length === 1 && await hasForeignKeyOnColumn(queryInterface, tableName, columns[0])) {
    return;
  }

  await queryInterface.addConstraint(tableName, {
    fields: columns,
    type: 'foreign key',
    name: constraintName,
    references,
    onDelete: options.onDelete || 'NO ACTION',
    onUpdate: options.onUpdate || 'CASCADE'
  });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
    ensureIdempotentColumnChanges(queryInterface);

    const exists = await tableExists(queryInterface, 'bills');
    const columns = billsTableDefinition(Sequelize);

    if (!exists) {
      await queryInterface.createTable('bills', columns);
    } else {
      for (const [columnName, definition] of Object.entries(columns)) {
        await ensureColumn(queryInterface, Sequelize, 'bills', columnName, definition);
      }
    }

    await ensureNamedForeignKey(queryInterface, 'bills', 'fk_bills_tenant_id', ['tenantId'], {
      table: 'tenants',
      field: 'id'
    }, { onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    await ensureNamedForeignKey(queryInterface, 'bills', 'fk_bills_tenant_subscription_id', ['tenantSubscriptionId'], {
      table: 'tenant_subscriptions',
      field: 'id'
    }, { onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    await queryInterface.addIndex('bills', ['tenantId'], {
      name: 'idx_bills_tenant_id'
    });

    await queryInterface.addIndex('bills', ['tenantSubscriptionId'], {
      name: 'idx_bills_tenant_subscription_id'
    });

    await queryInterface.addIndex('bills', ['status'], {
      name: 'idx_bills_status'
    });

    if (!(await hasUniqueIndexOnSingleColumn(queryInterface, 'bills', 'billNumber'))) {
      await queryInterface.addIndex('bills', ['billNumber'], {
        unique: true,
        name: 'uidx_bills_bill_number'
      });
    }

    if (!(await hasUniqueIndexOnSingleColumn(queryInterface, 'bills', 'paymentToken'))) {
      await queryInterface.addIndex('bills', ['paymentToken'], {
        unique: true,
        name: 'uidx_bills_payment_token'
      });
    }

    await queryInterface.addIndex('bills', ['dueDate'], {
      name: 'idx_bills_due_date'
    });

    await queryInterface.addIndex('bills', ['invoiceIssuedAt'], {
      name: 'idx_bills_invoice_issued_at'
    });

    await queryInterface.addIndex('bills', ['paidAt'], {
      name: 'idx_bills_paid_at'
    });
  },

  async down() {}
};
