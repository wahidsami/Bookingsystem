const { sequelize } = require('../models');

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildDateClause = (column, startDate, endDate) => `
  ${startDate ? `AND ${column} >= :startDate` : ''}
  ${endDate ? `AND ${column} <= :endDate` : ''}
`;

class FinancialService {
  static async getPlatformSummary(startDate, endDate) {
    try {
      const transactionQuery = `
        SELECT
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
          ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as your_earnings,
          ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_earnings,
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions
        FROM transactions
        WHERE status = 'completed'
          AND type IN ('booking', 'product_purchase')
          ${buildDateClause('"createdAt"', startDate, endDate)}
      `;

      const billQuery = `
        SELECT
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
          COUNT(*) as total_transactions
        FROM bills
        WHERE status = 'PAID'
          ${buildDateClause('"paidAt"', startDate, endDate)}
      `;

      const [txRows, billRows] = await Promise.all([
        sequelize.query(transactionQuery, {
          replacements: { startDate, endDate },
          type: sequelize.QueryTypes.SELECT,
        }),
        sequelize.query(billQuery, {
          replacements: { startDate, endDate },
          type: sequelize.QueryTypes.SELECT,
        }),
      ]);

      const tx = txRows[0] || {};
      const bills = billRows[0] || {};
      const totalRevenue = toNumber(tx.total_revenue) + toNumber(bills.total_revenue);
      const yourEarnings = toNumber(tx.your_earnings) + toNumber(bills.total_revenue);
      const totalTransactions = toNumber(tx.total_transactions) + toNumber(bills.total_transactions);

      return {
        total_revenue: Number(totalRevenue.toFixed(2)),
        your_earnings: Number(yourEarnings.toFixed(2)),
        tenant_earnings: Number(toNumber(tx.tenant_earnings).toFixed(2)),
        total_transactions: totalTransactions,
        failed_transactions: toNumber(tx.failed_transactions),
        avg_commission: totalTransactions > 0 ? Number((yourEarnings / totalTransactions).toFixed(2)) : 0,
      };
    } catch (error) {
      console.error('Error in getPlatformSummary:', error);
      return {
        total_revenue: 0,
        your_earnings: 0,
        tenant_earnings: 0,
        total_transactions: 0,
        failed_transactions: 0,
        avg_commission: 0,
      };
    }
  }

  static async getTenantFinancials(tenantId, startDate, endDate) {
    try {
      const query = `
        SELECT
          t.id,
          t.name,
          t.plan,
          t.status as tenant_status,
          COUNT(*) as total_bookings,
          ROUND(SUM(CAST(tr.amount as NUMERIC)), 2) as gross_revenue,
          ROUND(SUM(CAST(tr."platformFee" as NUMERIC)), 2) as platform_commission,
          ROUND(SUM(CAST(tr."tenantRevenue" as NUMERIC)), 2) as net_revenue,
          ROUND(SUM(CAST(tr."tenantRevenue" as NUMERIC)) / NULLIF(COUNT(*), 0), 2) as avg_booking_value,
          COUNT(CASE WHEN tr.status = 'pending' THEN 1 END) as pending_transactions,
          COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed_transactions
        FROM transactions tr
        JOIN tenants t ON tr."tenantId" = t.id
        WHERE tr.status = 'completed'
          AND tr.type IN ('booking', 'product_purchase')
          ${tenantId ? 'AND t.id = :tenantId' : ''}
          ${buildDateClause('tr."createdAt"', startDate, endDate)}
        GROUP BY t.id, t.name, t.plan, t.status
        ORDER BY net_revenue DESC
      `;

      const result = await sequelize.query(query, {
        replacements: { tenantId, startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return tenantId ? result[0] : result || [];
    } catch (error) {
      console.error('Error in getTenantFinancials:', error);
      return tenantId ? null : [];
    }
  }

  static async getTenantLeaderboard(limit = 10, startDate, endDate) {
    try {
      const query = `
        SELECT
          ROW_NUMBER() OVER (ORDER BY tenant_earned DESC) as rank,
          t.id,
          t.name,
          t.plan,
          COUNT(*) as bookings,
          ROUND(SUM(CAST(tr.amount as NUMERIC)), 2) as gross_revenue,
          ROUND(SUM(CAST(tr."platformFee" as NUMERIC)), 2) as your_commission,
          ROUND(SUM(CAST(tr."tenantRevenue" as NUMERIC)), 2) as tenant_earned,
          ROUND(SUM(CAST(tr."tenantRevenue" as NUMERIC)) / NULLIF(COUNT(*), 0), 2) as avg_per_booking,
          COUNT(DISTINCT DATE(tr."createdAt")) as active_days
        FROM transactions tr
        JOIN tenants t ON tr."tenantId" = t.id
        WHERE tr.status = 'completed'
          AND tr.type IN ('booking', 'product_purchase')
          ${buildDateClause('tr."createdAt"', startDate, endDate)}
        GROUP BY t.id, t.name, t.plan
        ORDER BY tenant_earned DESC
        LIMIT :limit
      `;

      const result = await sequelize.query(query, {
        replacements: { limit, startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return result && Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error in getTenantLeaderboard:', error);
      return [];
    }
  }

  static async getTenantEmployeeMetrics(tenantId, startDate, endDate) {
    try {
      const query = `
        SELECT
          s.id,
          s.name,
          s."commissionRate",
          COUNT(*) as total_appointments,
          COUNT(DISTINCT DATE(a."startTime")) as days_worked,
          ROUND(SUM(EXTRACT(EPOCH FROM (a."endTime" - a."startTime")))/3600.0, 2) as hours_worked,
          ROUND(AVG(EXTRACT(EPOCH FROM (a."endTime" - a."startTime")))/60.0, 2) as avg_duration_minutes,
          ROUND(SUM(CAST(a."employeeCommission" as NUMERIC)), 2) as commission_earned,
          ROUND(SUM(CAST(a.price as NUMERIC)), 2) as total_value_handled
        FROM appointments a
        JOIN staff s ON a."staffId" = s.id
        WHERE a."tenantId" = :tenantId
          AND a.status = 'completed'
          ${buildDateClause('a."startTime"', startDate, endDate)}
        GROUP BY s.id, s.name, s."commissionRate"
        ORDER BY hours_worked DESC
      `;

      const result = await sequelize.query(query, {
        replacements: { tenantId, startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return result && Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error in getTenantEmployeeMetrics:', error);
      return [];
    }
  }

  static async getMonthlyComparison(limit = 12) {
    try {
      const transactionQuery = `
        SELECT
          DATE_TRUNC('month', "createdAt")::date as month,
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
          ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as your_earnings,
          ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_earnings,
          COUNT(*) as transaction_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
        FROM transactions
        WHERE status = 'completed'
          AND type IN ('booking', 'product_purchase')
        GROUP BY DATE_TRUNC('month', "createdAt")
      `;

      const billsQuery = `
        SELECT
          DATE_TRUNC('month', "paidAt")::date as month,
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
          COUNT(*) as transaction_count
        FROM bills
        WHERE status = 'PAID'
          AND "paidAt" IS NOT NULL
        GROUP BY DATE_TRUNC('month', "paidAt")
      `;

      const [txRows, billRows] = await Promise.all([
        sequelize.query(transactionQuery, {
          type: sequelize.QueryTypes.SELECT,
        }),
        sequelize.query(billsQuery, {
          type: sequelize.QueryTypes.SELECT,
        }),
      ]);

      const monthly = new Map();

      for (const row of txRows || []) {
        monthly.set(row.month, {
          month: row.month,
          total_revenue: toNumber(row.total_revenue),
          your_earnings: toNumber(row.your_earnings),
          tenant_earnings: toNumber(row.tenant_earnings),
          transaction_count: toNumber(row.transaction_count),
          failed_count: toNumber(row.failed_count),
        });
      }

      for (const row of billRows || []) {
        const current = monthly.get(row.month) || {
          month: row.month,
          total_revenue: 0,
          your_earnings: 0,
          tenant_earnings: 0,
          transaction_count: 0,
          failed_count: 0,
        };

        current.total_revenue += toNumber(row.total_revenue);
        current.your_earnings += toNumber(row.total_revenue);
        current.transaction_count += toNumber(row.transaction_count);
        monthly.set(row.month, current);
      }

      return Array.from(monthly.values())
        .sort((a, b) => new Date(b.month) - new Date(a.month))
        .slice(0, limit)
        .map((row) => ({
          ...row,
          total_revenue: Number(row.total_revenue.toFixed(2)),
          your_earnings: Number(row.your_earnings.toFixed(2)),
          tenant_earnings: Number(row.tenant_earnings.toFixed(2)),
          your_percentage: row.total_revenue > 0
            ? Number(((row.your_earnings / row.total_revenue) * 100).toFixed(1))
            : 0,
        }));
    } catch (error) {
      console.error('Error in getMonthlyComparison:', error);
      return [];
    }
  }

  static async getRevenueByType(startDate, endDate) {
    try {
      const transactionQuery = `
        SELECT
          type,
          COUNT(*) as count,
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as amount,
          ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as platform_fee,
          ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_revenue
        FROM transactions
        WHERE status = 'completed'
          AND type IN ('booking', 'product_purchase')
          ${buildDateClause('"createdAt"', startDate, endDate)}
        GROUP BY type
      `;

      const billQuery = `
        SELECT
          COUNT(*) as count,
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as amount
        FROM bills
        WHERE status = 'PAID'
          ${buildDateClause('"paidAt"', startDate, endDate)}
      `;

      const [txRows, billRows] = await Promise.all([
        sequelize.query(transactionQuery, {
          replacements: { startDate, endDate },
          type: sequelize.QueryTypes.SELECT,
        }),
        sequelize.query(billQuery, {
          replacements: { startDate, endDate },
          type: sequelize.QueryTypes.SELECT,
        }),
      ]);

      const result = {
        booking: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
        product_purchase: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
        subscription: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
      };

      for (const row of txRows || []) {
        if (!result[row.type]) continue;
        result[row.type] = {
          count: toNumber(row.count),
          amount: toNumber(row.amount),
          platformFee: toNumber(row.platform_fee),
          tenantRevenue: toNumber(row.tenant_revenue),
        };
      }

      const paidBills = billRows[0] || {};
      result.subscription = {
        count: toNumber(paidBills.count),
        amount: toNumber(paidBills.amount),
        platformFee: toNumber(paidBills.amount),
        tenantRevenue: 0,
      };

      return result;
    } catch (error) {
      console.error('Error in getRevenueByType:', error);
      return {
        booking: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
        product_purchase: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
        subscription: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
      };
    }
  }

  static async getBillsSummary(status = null) {
    try {
      const whereClause = status ? 'WHERE b.status = :status' : '';
      const query = `
        SELECT
          b.status,
          COUNT(*) as count,
          ROUND(SUM(CAST(b.amount as NUMERIC)), 2) as total_amount
        FROM bills b
        ${whereClause}
        GROUP BY b.status
      `;

      const rows = await sequelize.query(query, {
        replacements: status ? { status } : {},
        type: sequelize.QueryTypes.SELECT,
      });

      const result = {
        UNPAID: { count: 0, totalAmount: 0 },
        PAID: { count: 0, totalAmount: 0 },
        EXPIRED: { count: 0, totalAmount: 0 },
      };

      for (const row of rows || []) {
        if (!result[row.status]) continue;
        result[row.status] = {
          count: toNumber(row.count),
          totalAmount: toNumber(row.total_amount),
        };
      }

      return result;
    } catch (error) {
      console.error('Error in getBillsSummary:', error);
      return {
        UNPAID: { count: 0, totalAmount: 0 },
        PAID: { count: 0, totalAmount: 0 },
        EXPIRED: { count: 0, totalAmount: 0 },
      };
    }
  }

  static async getCommissionByPlan(startDate, endDate) {
    try {
      const query = `
        SELECT
          t.plan as plan,
          COUNT(DISTINCT t.id) as tenant_count,
          COUNT(*) as total_transactions,
          ROUND(SUM(CAST(tr.amount as NUMERIC)), 2) as total_revenue,
          ROUND(SUM(CAST(tr."platformFee" as NUMERIC)), 2) as your_earnings,
          ROUND(SUM(CAST(tr."tenantRevenue" as NUMERIC)), 2) as tenant_earnings,
          CASE
            WHEN t.plan = 'Starter' THEN 7.0
            WHEN t.plan = 'Professional' THEN 8.0
            WHEN t.plan = 'Enterprise' THEN 3.5
            ELSE 5.0
          END as commission_rate
        FROM transactions tr
        JOIN tenants t ON tr."tenantId" = t.id
        WHERE tr.status = 'completed'
          AND tr.type IN ('booking', 'product_purchase')
          ${buildDateClause('tr."createdAt"', startDate, endDate)}
        GROUP BY t.plan
        ORDER BY your_earnings DESC
      `;

      const result = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return result && Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching commission breakdown:', error);
      return [];
    }
  }

  static async getCommissionByPackage(startDate, endDate) {
    try {
      const query = `
        SELECT
          COALESCE(sp.name, 'Unknown') as plan,
          COUNT(DISTINCT t.id) as tenant_count,
          COUNT(tr.id) as total_transactions,
          ROUND(SUM(CAST(tr.amount as NUMERIC)), 2) as total_revenue,
          ROUND(SUM(CAST(tr."platformFee" as NUMERIC)), 2) as your_earnings,
          ROUND(SUM(CAST(tr."tenantRevenue" as NUMERIC)), 2) as tenant_earnings
        FROM transactions tr
        JOIN tenants t ON tr."tenantId" = t.id
        LEFT JOIN LATERAL (
          SELECT "packageId" FROM tenant_subscriptions
          WHERE "tenantId" = t.id
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) ts ON true
        LEFT JOIN subscription_packages sp ON sp.id = ts."packageId"
        WHERE tr.status = 'completed'
          AND tr.type IN ('booking', 'product_purchase')
          ${buildDateClause('tr."createdAt"', startDate, endDate)}
        GROUP BY sp.id, sp.name
        ORDER BY your_earnings DESC
      `;

      const result = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return result && Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error in getCommissionByPackage:', error);
      return [];
    }
  }

  static async getTransactionDetails(tenantId, limit = 50, offset = 0) {
    const query = `
      SELECT
        tr.id,
        tr."createdAt",
        t.name as tenant_name,
        CASE
          WHEN a.id IS NOT NULL THEN 'appointment'
          WHEN o.id IS NOT NULL THEN 'product'
          ELSE 'other'
        END as transaction_type,
        COALESCE(s.name_en, o."orderNumber", 'N/A') as item_name,
        ROUND(CAST(tr.amount as NUMERIC), 2) as amount,
        ROUND(CAST(tr."platformFee" as NUMERIC), 2) as your_fee,
        ROUND(CAST(tr."tenantRevenue" as NUMERIC), 2) as tenant_revenue,
        tr.status as payment_status,
        COALESCE(tr.metadata->>'paymentMethod', 'N/A') as "paymentMethod"
      FROM transactions tr
      JOIN tenants t ON tr."tenantId" = t.id
      LEFT JOIN appointments a ON tr."appointmentId" = a.id
      LEFT JOIN services s ON a."serviceId" = s.id
      LEFT JOIN orders o ON tr.order_id = o.id
      WHERE tr."tenantId" = :tenantId
        AND tr.status = 'completed'
        AND tr.type IN ('booking', 'product_purchase')
      ORDER BY tr."createdAt" DESC
      LIMIT :limit
      OFFSET :offset
    `;

    try {
      const result = await sequelize.query(query, {
        replacements: { tenantId, limit, offset },
        type: sequelize.QueryTypes.SELECT,
      });
      return result || [];
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      return [];
    }
  }

  static async getTopEmployees(limit = 20, startDate, endDate) {
    try {
      const query = `
        SELECT
          ROW_NUMBER() OVER (ORDER BY commission_earned DESC) as rank,
          t.name as tenant,
          s.name as employee,
          COUNT(*) as appointments,
          ROUND(SUM(EXTRACT(EPOCH FROM (a."endTime" - a."startTime")))/3600.0, 2) as hours_worked,
          ROUND(SUM(CAST(a."employeeCommission" as NUMERIC)), 2) as commission_earned,
          ROUND(SUM(CAST(a.price as NUMERIC)), 2) as total_value,
          ROUND(SUM(CAST(a."employeeCommission" as NUMERIC)) / NULLIF(COUNT(*), 0), 2) as avg_per_appointment
        FROM appointments a
        JOIN staff s ON a."staffId" = s.id
        JOIN tenants t ON a."tenantId" = t.id
        WHERE a.status = 'completed'
          ${buildDateClause('a."startTime"', startDate, endDate)}
        GROUP BY t.id, t.name, s.id, s.name
        ORDER BY commission_earned DESC
        LIMIT :limit
      `;

      const result = await sequelize.query(query, {
        replacements: { limit, startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return result && Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching top employees:', error);
      return [];
    }
  }
}

module.exports = FinancialService;
