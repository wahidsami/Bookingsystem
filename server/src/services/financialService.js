const { sequelize } = require('../models');

/**
 * Financial Service - Handles all financial calculations and queries
 */

class FinancialService {
  /**
   * Get summary of platform earnings
   */
  static async getPlatformSummary(startDate, endDate) {
    try {
      const query = `
        SELECT 
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
          ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as your_earnings,
          ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_earnings,
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
          ROUND(AVG(CAST("platformFee" as NUMERIC)), 2) as avg_commission
        FROM transactions
        WHERE status = 'completed'
          ${startDate ? 'AND "createdAt" >= :startDate' : ''}
          ${endDate ? 'AND "createdAt" <= :endDate' : ''}
      `;

      const result = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return result[0] || {};
    } catch (error) {
      console.error('Error in getPlatformSummary:', error);
      return {};
    }
  }

  /**
   * Get tenant financial details with earnings
   */
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
          ${tenantId ? 'AND t.id = :tenantId' : ''}
          ${startDate ? 'AND tr."createdAt" >= :startDate' : ''}
          ${endDate ? 'AND tr."createdAt" <= :endDate' : ''}
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

  /**
   * Get all tenants leaderboard
   */
  static async getTenantLeaderboard(limit = 10, startDate, endDate) {
    try {
      const query = `
        SELECT 
          ROW_NUMBER() OVER (ORDER BY net_revenue DESC) as rank,
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
          ${startDate ? 'AND tr."createdAt" >= :startDate' : ''}
          ${endDate ? 'AND tr."createdAt" <= :endDate' : ''}
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

  /**
   * Get employee hours and earnings for a tenant
   */
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
          ${startDate ? 'AND a."startTime" >= :startDate' : ''}
          ${endDate ? 'AND a."startTime" <= :endDate' : ''}
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

  /**
   * Get monthly revenue comparison
   */
  static async getMonthlyComparison(limit = 12) {
    try {
      const query = `
        WITH monthly_data AS (
          SELECT 
            DATE_TRUNC('month', "createdAt")::date as month,
            ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
            ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as your_earnings,
            ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_earnings,
            COUNT(*) as transaction_count,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
          FROM transactions
          WHERE status = 'completed'
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY month DESC
          LIMIT :limit
        )
        SELECT 
          month,
          total_revenue,
          your_earnings,
          tenant_earnings,
          transaction_count,
          failed_count,
          ROUND((your_earnings / total_revenue * 100)::numeric, 1) as your_percentage
        FROM monthly_data
        ORDER BY month DESC
      `;

      const result = await sequelize.query(query, {
        replacements: { limit },
        type: sequelize.QueryTypes.SELECT,
      });

      return result && Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error in getMonthlyComparison:', error);
      return [];
    }
  }

  /**
   * Get commission breakdown by subscription plan
   */
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
          ${startDate ? 'AND tr."createdAt" >= :startDate' : ''}
          ${endDate ? 'AND tr."createdAt" <= :endDate' : ''}
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

  /**
   * Get transaction details for detailed view
   */
  static async getTransactionDetails(tenantId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        tr.id,
        tr."createdAt",
        t.name as tenant_name,
        CASE 
          WHEN a.id IS NOT NULL THEN 'appointment'
          WHEN p.id IS NOT NULL THEN 'product'
          ELSE 'other'
        END as transaction_type,
        COALESCE(s.name, p.name, 'N/A') as item_name,
        ROUND(CAST(tr.amount as NUMERIC), 2) as amount,
        ROUND(CAST(tr."platformFee" as NUMERIC), 2) as your_fee,
        ROUND(CAST(tr."tenantRevenue" as NUMERIC), 2) as tenant_revenue,
        tr.status as payment_status,
        tr."paymentMethod"
      FROM transactions tr
      JOIN tenants t ON tr."tenantId" = t.id
      LEFT JOIN appointments a ON tr."appointmentId" = a.id
      LEFT JOIN services s ON a."serviceId" = s.id
      LEFT JOIN products p ON tr."productId" = p.id
      WHERE tr."tenantId" = :tenantId
        AND tr.status = 'completed'
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

  /**
   * Get top performing employees across all tenants
   */
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
          ${startDate ? 'AND a."startTime" >= :startDate' : ''}
          ${endDate ? 'AND a."startTime" <= :endDate' : ''}
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
