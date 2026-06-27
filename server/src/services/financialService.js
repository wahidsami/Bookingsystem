const { sequelize } = require('../models');
const { createBillStatusSummarySeed } = require('../utils/billStatus');

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildDateClause = (column, startDate, endDate) => `
  ${startDate ? `AND ${column} >= :startDate` : ''}
  ${endDate ? `AND ${column} <= :endDate` : ''}
`;

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value) => (value ? new Date(value) : null);

const startOfUtcDay = (date) => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate()
));

const endOfUtcDay = (date) => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate(),
  23,
  59,
  59,
  999
));

const addUtcDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addUtcMonths = (date, months) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const addUtcYears = (date, years) => {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
};

const formatUtcDateKey = (date) => date.toISOString().slice(0, 10);

const getPeriodLengthDays = (startDate, endDate) => {
  const start = startOfUtcDay(parseDate(startDate));
  const end = startOfUtcDay(parseDate(endDate));
  return Math.max(Math.round((end - start) / DAY_MS), 0) + 1;
};

const buildComparisonWindow = (startDate, endDate, mode = 'current_previous', compareStartDate, compareEndDate) => {
  const currentStart = startOfUtcDay(parseDate(startDate));
  const currentEnd = endOfUtcDay(parseDate(endDate));
  const currentDays = getPeriodLengthDays(startDate, endDate);

  let previousStart;
  let previousEnd;

  if (compareStartDate && compareEndDate) {
    previousStart = startOfUtcDay(parseDate(compareStartDate));
    previousEnd = endOfUtcDay(parseDate(compareEndDate));
  } else if (mode === 'year_over_year') {
    previousStart = startOfUtcDay(addUtcYears(currentStart, -1));
    previousEnd = endOfUtcDay(addUtcYears(currentEnd, -1));
  } else if (mode === 'month_over_month') {
    previousStart = startOfUtcDay(addUtcMonths(currentStart, -1));
    previousEnd = endOfUtcDay(addUtcMonths(currentEnd, -1));
  } else {
    const priorEnd = endOfUtcDay(addUtcDays(currentStart, -1));
    previousEnd = priorEnd;
    previousStart = startOfUtcDay(addUtcDays(priorEnd, -(currentDays - 1)));
  }

  return {
    mode,
    current: {
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
    },
    previous: {
      startDate: previousStart.toISOString(),
      endDate: previousEnd.toISOString(),
    },
  };
};

const buildTrendDelta = (currentValue, previousValue) => {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);
  const absolute = current - previous;
  const percentage = previous !== 0 ? Number(((absolute / Math.abs(previous)) * 100).toFixed(1)) : (current !== 0 ? 100 : 0);

  return {
    current,
    previous,
    absolute: Number(absolute.toFixed(2)),
    percentage,
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
  };
};

const buildSeriesRows = (startDate, endDate, rows = []) => {
  const start = startOfUtcDay(parseDate(startDate));
  const end = startOfUtcDay(parseDate(endDate));
  const totalDays = Math.max(Math.round((end - start) / DAY_MS), 0) + 1;
  const map = new Map();

  for (const row of rows || []) {
    const key = formatUtcDateKey(new Date(row.day));
    map.set(key, {
      total_revenue: toNumber(row.total_revenue),
      your_earnings: toNumber(row.your_earnings),
      tenant_earnings: toNumber(row.tenant_earnings),
      total_transactions: toNumber(row.total_transactions),
      failed_transactions: toNumber(row.failed_transactions),
    });
  }

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addUtcDays(start, index);
    const key = formatUtcDateKey(date);
    const value = map.get(key) || {
      total_revenue: 0,
      your_earnings: 0,
      tenant_earnings: 0,
      total_transactions: 0,
      failed_transactions: 0,
    };

    return {
      date: key,
      ...value,
    };
  });
};

const aggregateSeriesTotals = (rows = []) => rows.reduce((acc, row) => ({
  total_revenue: acc.total_revenue + toNumber(row.total_revenue),
  your_earnings: acc.your_earnings + toNumber(row.your_earnings),
  tenant_earnings: acc.tenant_earnings + toNumber(row.tenant_earnings),
  total_transactions: acc.total_transactions + toNumber(row.total_transactions),
  failed_transactions: acc.failed_transactions + toNumber(row.failed_transactions),
}), {
  total_revenue: 0,
  your_earnings: 0,
  tenant_earnings: 0,
  total_transactions: 0,
  failed_transactions: 0,
});

const buildPercentChange = (currentValue, previousValue) => {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);
  const delta = current - previous;
  const percentage = previous === 0 ? (current === 0 ? 0 : 100) : (delta / Math.abs(previous)) * 100;

  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    delta: Number(delta.toFixed(2)),
    percentage: Number(percentage.toFixed(1)),
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
  };
};

const buildInsightSeverity = (changePercent, base = 'warning') => {
  const absolute = Math.abs(changePercent);

  if (absolute >= 25) return 'critical';
  if (absolute >= 15) return base === 'critical' ? 'critical' : 'high';
  if (absolute >= 8) return 'warning';
  return 'info';
};

const buildInsightTone = (direction) => (direction === 'up' ? 'positive' : direction === 'down' ? 'negative' : 'neutral');

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

class FinancialService {
  static async getPlatformSummary(startDate, endDate) {
    try {
      const transactionQuery = `
        SELECT
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST(amount as NUMERIC))
              ELSE ABS(CAST(amount as NUMERIC))
            END
          ), 2) as total_revenue,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("platformFee" as NUMERIC))
              ELSE ABS(CAST("platformFee" as NUMERIC))
            END
          ), 2) as your_earnings,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("tenantRevenue" as NUMERIC))
              ELSE ABS(CAST("tenantRevenue" as NUMERIC))
            END
          ), 2) as tenant_earnings,
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions
        FROM transactions
        WHERE status IN ('completed', 'refunded')
          AND type IN ('booking', 'product_purchase', 'refund')
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

  static async getComparisonAnalytics(startDate, endDate, options = {}) {
    try {
      const window = buildComparisonWindow(
        startDate,
        endDate,
        options.mode,
        options.compareStartDate,
        options.compareEndDate
      );

      const [currentSummary, previousSummary, currentSeriesRows, previousSeriesRows] = await Promise.all([
        FinancialService.getPlatformSummary(window.current.startDate, window.current.endDate),
        FinancialService.getPlatformSummary(window.previous.startDate, window.previous.endDate),
        FinancialService.getDailyFinancialSeries(window.current.startDate, window.current.endDate),
        FinancialService.getDailyFinancialSeries(window.previous.startDate, window.previous.endDate),
      ]);

      const currentSeries = buildSeriesRows(window.current.startDate, window.current.endDate, currentSeriesRows);
      const previousSeries = buildSeriesRows(window.previous.startDate, window.previous.endDate, previousSeriesRows);
      const currentTotals = aggregateSeriesTotals(currentSeries);
      const previousTotals = aggregateSeriesTotals(previousSeries);

      return {
        mode: window.mode,
        currentPeriod: window.current,
        previousPeriod: window.previous,
        summary: {
          current: currentSummary,
          previous: previousSummary,
          delta: {
            total_revenue: buildTrendDelta(currentSummary.total_revenue, previousSummary.total_revenue),
            your_earnings: buildTrendDelta(currentSummary.your_earnings, previousSummary.your_earnings),
            tenant_earnings: buildTrendDelta(currentSummary.tenant_earnings, previousSummary.tenant_earnings),
            total_transactions: buildTrendDelta(currentSummary.total_transactions, previousSummary.total_transactions),
            failed_transactions: buildTrendDelta(currentSummary.failed_transactions, previousSummary.failed_transactions),
            avg_commission: buildTrendDelta(currentSummary.avg_commission, previousSummary.avg_commission),
          }
        },
        timeline: currentSeries.map((row, index) => ({
          date: row.date,
          current: row,
          previous: previousSeries[index] || {
            date: previousSeries[index]?.date || null,
            total_revenue: 0,
            your_earnings: 0,
            tenant_earnings: 0,
            total_transactions: 0,
            failed_transactions: 0,
          }
        })),
        totals: {
          current: currentTotals,
          previous: previousTotals,
        }
      };
    } catch (error) {
      console.error('Error in getComparisonAnalytics:', error);
      return {
        mode: options.mode || 'current_previous',
        currentPeriod: { startDate, endDate },
        previousPeriod: { startDate, endDate },
        summary: {
          current: await FinancialService.getPlatformSummary(startDate, endDate),
          previous: await FinancialService.getPlatformSummary(startDate, endDate),
          delta: {
            total_revenue: buildTrendDelta(0, 0),
            your_earnings: buildTrendDelta(0, 0),
            tenant_earnings: buildTrendDelta(0, 0),
            total_transactions: buildTrendDelta(0, 0),
            failed_transactions: buildTrendDelta(0, 0),
            avg_commission: buildTrendDelta(0, 0),
          }
        },
        timeline: [],
        totals: {
          current: {
            total_revenue: 0,
            your_earnings: 0,
            tenant_earnings: 0,
            total_transactions: 0,
            failed_transactions: 0,
          },
          previous: {
            total_revenue: 0,
            your_earnings: 0,
            tenant_earnings: 0,
            total_transactions: 0,
            failed_transactions: 0,
          }
        }
      };
    }
  }

  static async getAppointmentOperationalMetrics(startDate, endDate) {
    try {
      const query = `
        WITH prior_customers AS (
          SELECT DISTINCT "platformUserId"
          FROM appointments
          WHERE "startTime" < :startDate
            AND "platformUserId" IS NOT NULL
        )
        SELECT
          COUNT(*) as total_appointments,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_appointments,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_appointments,
          COUNT(*) FILTER (WHERE status = 'no_show') as no_show_appointments,
          COUNT(DISTINCT "platformUserId") as unique_customers,
          COUNT(DISTINCT CASE WHEN prior_customers."platformUserId" IS NOT NULL THEN a."platformUserId" END) as returning_customers,
          COUNT(DISTINCT "staffId") as active_staff
        FROM appointments a
        LEFT JOIN prior_customers ON prior_customers."platformUserId" = a."platformUserId"
        WHERE a."startTime" >= :startDate
          AND a."startTime" <= :endDate
      `;

      const rows = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      const row = rows[0] || {};
      const totalAppointments = toNumber(row.total_appointments);
      const completedAppointments = toNumber(row.completed_appointments);
      const cancelledAppointments = toNumber(row.cancelled_appointments);
      const noShowAppointments = toNumber(row.no_show_appointments);
      const uniqueCustomers = toNumber(row.unique_customers);
      const returningCustomers = toNumber(row.returning_customers);
      const activeStaff = toNumber(row.active_staff);
      const totalDays = getPeriodLengthDays(startDate, endDate);

      return {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        uniqueCustomers,
        returningCustomers,
        activeStaff,
        completionRate: totalAppointments > 0 ? Number(((completedAppointments / totalAppointments) * 100).toFixed(1)) : 0,
        cancellationRate: totalAppointments > 0 ? Number(((cancelledAppointments / totalAppointments) * 100).toFixed(1)) : 0,
        noShowRate: totalAppointments > 0 ? Number(((noShowAppointments / totalAppointments) * 100).toFixed(1)) : 0,
        retentionRate: uniqueCustomers > 0 ? Number(((returningCustomers / uniqueCustomers) * 100).toFixed(1)) : 0,
        occupancyRate: activeStaff > 0 && totalDays > 0
          ? Number(((completedAppointments / (activeStaff * totalDays)) * 100).toFixed(1))
          : 0,
      };
    } catch (error) {
      console.error('Error in getAppointmentOperationalMetrics:', error);
      return {
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        noShowAppointments: 0,
        uniqueCustomers: 0,
        returningCustomers: 0,
        activeStaff: 0,
        completionRate: 0,
        cancellationRate: 0,
        noShowRate: 0,
        retentionRate: 0,
        occupancyRate: 0,
      };
    }
  }

  static async getProductSalesMetrics(startDate, endDate) {
    try {
      const query = `
        SELECT
          COUNT(DISTINCT o.id) as total_orders,
          COUNT(DISTINCT oi.id) as total_items,
          ROUND(COALESCE(SUM(CAST(o."totalAmount" as NUMERIC)), 0), 2) as total_revenue,
          COUNT(*) FILTER (WHERE o.status = 'cancelled') as cancelled_orders,
          COUNT(*) FILTER (WHERE o.status IN ('completed', 'delivered')) as completed_orders
        FROM orders o
        LEFT JOIN order_items oi ON oi."orderId" = o.id
        WHERE o."createdAt" >= :startDate
          AND o."createdAt" <= :endDate
      `;

      const rows = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      const row = rows[0] || {};
      const totalOrders = toNumber(row.total_orders);
      const totalItems = toNumber(row.total_items);
      const totalRevenue = toNumber(row.total_revenue);
      const cancelledOrders = toNumber(row.cancelled_orders);
      const completedOrders = toNumber(row.completed_orders);

      return {
        totalOrders,
        totalItems,
        totalRevenue,
        cancelledOrders,
        completedOrders,
        avgOrderValue: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
        completionRate: totalOrders > 0 ? Number(((completedOrders / totalOrders) * 100).toFixed(1)) : 0,
        cancellationRate: totalOrders > 0 ? Number(((cancelledOrders / totalOrders) * 100).toFixed(1)) : 0,
      };
    } catch (error) {
      console.error('Error in getProductSalesMetrics:', error);
      return {
        totalOrders: 0,
        totalItems: 0,
        totalRevenue: 0,
        cancelledOrders: 0,
        completedOrders: 0,
        avgOrderValue: 0,
        completionRate: 0,
        cancellationRate: 0,
      };
    }
  }

  static async getStaffPerformanceMetrics(startDate, endDate) {
    try {
      const query = `
        SELECT
          s.id,
          s.name,
          s."tenantId",
          COUNT(a.id) as total_appointments,
          COUNT(*) FILTER (WHERE a.status = 'completed') as completed_appointments,
          COUNT(*) FILTER (WHERE a.status = 'cancelled') as cancelled_appointments,
          COUNT(*) FILTER (WHERE a.status = 'no_show') as no_show_appointments,
          ROUND(COALESCE(SUM(CAST(a.price as NUMERIC)), 0), 2) as revenue,
          ROUND(COALESCE(SUM(CAST(a."employeeCommission" as NUMERIC)), 0), 2) as commission_earned,
          ROUND(AVG(EXTRACT(EPOCH FROM (a."endTime" - a."startTime")))/60.0, 2) as avg_duration_minutes
        FROM staff s
        LEFT JOIN appointments a
          ON a."staffId" = s.id
          AND a."startTime" >= :startDate
          AND a."startTime" <= :endDate
        WHERE s."isActive" = true
        GROUP BY s.id, s.name, s."tenantId"
        ORDER BY total_appointments DESC, commission_earned DESC
      `;

      const rows = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      });

      return (rows || []).map((row) => {
        const totalAppointments = toNumber(row.total_appointments);
        const completedAppointments = toNumber(row.completed_appointments);
        const cancelledAppointments = toNumber(row.cancelled_appointments);
        const noShowAppointments = toNumber(row.no_show_appointments);

        return {
          id: row.id,
          name: row.name,
          tenantId: row.tenantId,
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          noShowAppointments,
          revenue: toNumber(row.revenue),
          commissionEarned: toNumber(row.commission_earned),
          avgDurationMinutes: toNumber(row.avg_duration_minutes),
          completionRate: totalAppointments > 0 ? Number(((completedAppointments / totalAppointments) * 100).toFixed(1)) : 0,
          cancellationRate: totalAppointments > 0 ? Number(((cancelledAppointments / totalAppointments) * 100).toFixed(1)) : 0,
          noShowRate: totalAppointments > 0 ? Number(((noShowAppointments / totalAppointments) * 100).toFixed(1)) : 0,
        };
      });
    } catch (error) {
      console.error('Error in getStaffPerformanceMetrics:', error);
      return [];
    }
  }

  static async getOperationalInsights(startDate, endDate) {
    try {
      const window = buildComparisonWindow(startDate, endDate, 'current_previous');
      const [currentRevenue, previousRevenue, currentAppointments, previousAppointments, currentProductSales, previousProductSales, staffPerformance] = await Promise.all([
        FinancialService.getPlatformSummary(window.current.startDate, window.current.endDate),
        FinancialService.getPlatformSummary(window.previous.startDate, window.previous.endDate),
        FinancialService.getAppointmentOperationalMetrics(window.current.startDate, window.current.endDate),
        FinancialService.getAppointmentOperationalMetrics(window.previous.startDate, window.previous.endDate),
        FinancialService.getProductSalesMetrics(window.current.startDate, window.current.endDate),
        FinancialService.getProductSalesMetrics(window.previous.startDate, window.previous.endDate),
        FinancialService.getStaffPerformanceMetrics(window.current.startDate, window.current.endDate),
      ]);

      const alerts = [];
      const revenueChange = buildPercentChange(currentRevenue.total_revenue, previousRevenue.total_revenue);
      const retentionChange = buildPercentChange(currentAppointments.retentionRate, previousAppointments.retentionRate);
      const noShowChange = buildPercentChange(currentAppointments.noShowRate, previousAppointments.noShowRate);
      const cancellationChange = buildPercentChange(currentAppointments.cancellationRate, previousAppointments.cancellationRate);
      const completionChange = buildPercentChange(currentAppointments.completionRate, previousAppointments.completionRate);
      const occupancyChange = buildPercentChange(currentAppointments.occupancyRate, previousAppointments.occupancyRate);
      const productChange = buildPercentChange(currentProductSales.totalRevenue, previousProductSales.totalRevenue);
      const productCountChange = buildPercentChange(currentProductSales.totalOrders, previousProductSales.totalOrders);

      const pushAlert = (alert) => {
        alerts.push({
          ...alert,
          change: Number.isFinite(alert.change?.percentage) ? alert.change : buildPercentChange(alert.currentValue, alert.previousValue),
        });
      };

      if (revenueChange.percentage < -8) {
        pushAlert({
          key: 'revenue_decline',
          category: 'revenue',
          title: 'Revenue decline',
          severity: buildInsightSeverity(revenueChange.percentage, 'critical'),
          tone: buildInsightTone(revenueChange.direction),
          explanation: `Revenue dropped ${Math.abs(revenueChange.percentage).toFixed(1)}% versus the previous period.`,
          suggestedAction: 'Launch a retention campaign and review the booking funnel for drop-off points.',
          currentValue: currentRevenue.total_revenue,
          previousValue: previousRevenue.total_revenue,
          change: revenueChange,
          entity: 'transactions',
          filters: { startDate: window.current.startDate, endDate: window.current.endDate },
        });
      }

      if (retentionChange.percentage < -5 || currentAppointments.retentionRate < 35) {
        pushAlert({
          key: 'retention_decline',
          category: 'customers',
          title: 'Retention decline',
          severity: buildInsightSeverity(retentionChange.percentage, 'warning'),
          tone: buildInsightTone(retentionChange.direction),
          explanation: `Retention is at ${currentAppointments.retentionRate.toFixed(1)}%, compared with ${previousAppointments.retentionRate.toFixed(1)}% in the previous period.`,
          suggestedAction: 'Send follow-up offers to returning customers and re-engage recent first-time visitors.',
          currentValue: currentAppointments.retentionRate,
          previousValue: previousAppointments.retentionRate,
          change: retentionChange,
          entity: 'customers',
          filters: { startDate: window.current.startDate, endDate: window.current.endDate },
        });
      }

      if (currentAppointments.noShowRate >= 12 || noShowChange.percentage > 20) {
        const noShowSeverity = currentAppointments.noShowRate >= 20
          ? 'critical'
          : currentAppointments.noShowRate >= 12
            ? 'high'
            : 'warning';
        pushAlert({
          key: 'high_no_show',
          category: 'appointments',
          title: 'High no-show rate',
          severity: noShowSeverity,
          tone: buildInsightTone('down'),
          explanation: `No-show rate is ${currentAppointments.noShowRate.toFixed(1)}% for the selected period.`,
          suggestedAction: 'Tighten reminders, require confirmations, and trigger early follow-ups for at-risk bookings.',
          currentValue: currentAppointments.noShowRate,
          previousValue: previousAppointments.noShowRate,
          change: noShowChange,
          entity: 'appointments',
          filters: { status: 'no_show', startDate: window.current.startDate, endDate: window.current.endDate },
        });
      }

      if (currentAppointments.cancellationRate >= 10 || cancellationChange.percentage > 15) {
        const cancellationSeverity = currentAppointments.cancellationRate >= 18
          ? 'critical'
          : currentAppointments.cancellationRate >= 10
            ? 'high'
            : 'warning';
        pushAlert({
          key: 'high_cancellations',
          category: 'appointments',
          title: 'High cancellations',
          severity: cancellationSeverity,
          tone: buildInsightTone('down'),
          explanation: `Cancellations reached ${currentAppointments.cancellationRate.toFixed(1)}% of appointments.`,
          suggestedAction: 'Review cancellation reasons and move reminder windows earlier for busy services.',
          currentValue: currentAppointments.cancellationRate,
          previousValue: previousAppointments.cancellationRate,
          change: cancellationChange,
          entity: 'appointments',
          filters: { status: 'cancelled', startDate: window.current.startDate, endDate: window.current.endDate },
        });
      }

      if (currentAppointments.completionRate <= 70 || completionChange.percentage < -10) {
        const completionSeverity = currentAppointments.completionRate <= 50
          ? 'critical'
          : currentAppointments.completionRate <= 70
            ? 'high'
            : 'warning';
        pushAlert({
          key: 'low_completion_rate',
          category: 'appointments',
          title: 'Low completion rate',
          severity: completionSeverity,
          tone: buildInsightTone('down'),
          explanation: `Completion rate sits at ${currentAppointments.completionRate.toFixed(1)}%, below the previous ${previousAppointments.completionRate.toFixed(1)}%.`,
          suggestedAction: 'Audit service flow, staffing coverage, and customer reminder timing to recover completions.',
          currentValue: currentAppointments.completionRate,
          previousValue: previousAppointments.completionRate,
          change: completionChange,
          entity: 'appointments',
          filters: { status: 'completed', startDate: window.current.startDate, endDate: window.current.endDate },
        });
      }

      if (currentAppointments.occupancyRate <= 60 || occupancyChange.percentage < -12) {
        const occupancySeverity = currentAppointments.occupancyRate <= 35
          ? 'critical'
          : currentAppointments.occupancyRate <= 60
            ? 'high'
            : 'warning';
        pushAlert({
          key: 'low_occupancy',
          category: 'staffing',
          title: 'Low occupancy',
          severity: occupancySeverity,
          tone: buildInsightTone(occupancyChange.direction),
          explanation: `Appointments per active staff are lagging at ${currentAppointments.occupancyRate.toFixed(1)}% of the expected baseline.`,
          suggestedAction: 'Push high-demand slots, re-balance staff schedules, and review underbooked services.',
          currentValue: currentAppointments.occupancyRate,
          previousValue: previousAppointments.occupancyRate,
          change: occupancyChange,
          entity: 'appointments',
          filters: { startDate: window.current.startDate, endDate: window.current.endDate },
        });
      }

      if (currentProductSales.totalRevenue <= previousProductSales.totalRevenue * 0.85 || productChange.percentage < -15 || productCountChange.percentage < -15) {
        const productSeverity = currentProductSales.totalRevenue <= previousProductSales.totalRevenue * 0.7
          ? 'critical'
          : currentProductSales.totalRevenue <= previousProductSales.totalRevenue * 0.85
            ? 'high'
            : 'warning';
        pushAlert({
          key: 'low_product_sales',
          category: 'products',
          title: 'Low product sales',
          severity: productSeverity,
          tone: buildInsightTone('down'),
          explanation: `Product revenue is ${Math.abs(productChange.percentage).toFixed(1)}% below the previous period.`,
          suggestedAction: 'Feature best-selling items, bundle products with services, and refresh stock visibility.',
          currentValue: currentProductSales.totalRevenue,
          previousValue: previousProductSales.totalRevenue,
          change: productChange,
          entity: 'products',
          filters: { startDate: window.current.startDate, endDate: window.current.endDate },
        });
      }

      const staffAverageCompletion = staffPerformance.length > 0
        ? staffPerformance.reduce((sum, staff) => sum + toNumber(staff.completionRate), 0) / staffPerformance.length
        : 0;
      const underperformers = staffPerformance.filter((staff) =>
        staff.totalAppointments >= 5 && (
          staff.completionRate <= clampValue(staffAverageCompletion - 15, 40, 100) ||
          staff.noShowRate >= 20 ||
          staff.cancellationRate >= 20
        )
      ).slice(0, 5);

      if (underperformers.length > 0) {
        pushAlert({
          key: 'employee_underperformance',
          category: 'employees',
          title: 'Employee underperformance',
          severity: underperformers.length >= 3 ? 'high' : 'warning',
          tone: 'negative',
          explanation: `${underperformers.length} employee${underperformers.length > 1 ? 's are' : ' is'} operating below the team baseline.`,
          suggestedAction: 'Coach the underperforming staff members and review their booking schedules and service mix.',
          currentValue: underperformers.length,
          previousValue: 0,
          change: buildPercentChange(underperformers.length, 0),
          entity: 'employees',
          filters: { startDate: window.current.startDate, endDate: window.current.endDate },
          details: underperformers.map((staff) => ({
            id: staff.id,
            name: staff.name,
            completionRate: staff.completionRate,
            totalAppointments: staff.totalAppointments,
            noShowRate: staff.noShowRate,
            cancellationRate: staff.cancellationRate,
          })),
        });
      }

      return {
        window,
        summary: {
          totalAlerts: alerts.length,
          criticalAlerts: alerts.filter((alert) => alert.severity === 'critical').length,
          highAlerts: alerts.filter((alert) => alert.severity === 'high').length,
          warningAlerts: alerts.filter((alert) => alert.severity === 'warning').length,
          infoAlerts: alerts.filter((alert) => alert.severity === 'info').length,
        },
        alerts: alerts.sort((left, right) => {
          const weight = { critical: 4, high: 3, warning: 2, info: 1 };
          return (weight[right.severity] || 0) - (weight[left.severity] || 0);
        }),
        signals: {
          revenue: {
            current: currentRevenue.total_revenue,
            previous: previousRevenue.total_revenue,
            change: revenueChange,
          },
          appointments: {
            current: currentAppointments,
            previous: previousAppointments,
          },
          productSales: {
            current: currentProductSales,
            previous: previousProductSales,
          },
          staffPerformance,
        },
      };
    } catch (error) {
      console.error('Error in getOperationalInsights:', error);
      return {
        window: null,
        summary: { totalAlerts: 0, criticalAlerts: 0, highAlerts: 0, warningAlerts: 0, infoAlerts: 0 },
        alerts: [],
        signals: {},
      };
    }
  }

  static async getDailyFinancialSeries(startDate, endDate) {
    try {
      const transactionQuery = `
        SELECT
          DATE_TRUNC('day', "createdAt")::date as day,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST(amount as NUMERIC))
              ELSE ABS(CAST(amount as NUMERIC))
            END
          ), 2) as total_revenue,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("platformFee" as NUMERIC))
              ELSE ABS(CAST("platformFee" as NUMERIC))
            END
          ), 2) as your_earnings,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("tenantRevenue" as NUMERIC))
              ELSE ABS(CAST("tenantRevenue" as NUMERIC))
            END
          ), 2) as tenant_earnings,
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions
        FROM transactions
        WHERE status IN ('completed', 'refunded')
          AND type IN ('booking', 'product_purchase', 'refund')
          ${buildDateClause('"createdAt"', startDate, endDate)}
        GROUP BY DATE_TRUNC('day', "createdAt")
      `;

      const billQuery = `
        SELECT
          DATE_TRUNC('day', "paidAt")::date as day,
          ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
          COUNT(*) as total_transactions
        FROM bills
        WHERE status = 'PAID'
          AND "paidAt" IS NOT NULL
          ${buildDateClause('"paidAt"', startDate, endDate)}
        GROUP BY DATE_TRUNC('day', "paidAt")
      `;

      const [transactionRows, billRows] = await Promise.all([
        sequelize.query(transactionQuery, {
          replacements: { startDate, endDate },
          type: sequelize.QueryTypes.SELECT,
        }),
        sequelize.query(billQuery, {
          replacements: { startDate, endDate },
          type: sequelize.QueryTypes.SELECT,
        }),
      ]);

      const daily = new Map();

      for (const row of transactionRows || []) {
        const key = formatUtcDateKey(new Date(row.day));
        const current = daily.get(key) || {
          day: key,
          total_revenue: 0,
          your_earnings: 0,
          tenant_earnings: 0,
          total_transactions: 0,
          failed_transactions: 0,
        };

        current.total_revenue += toNumber(row.total_revenue);
        current.your_earnings += toNumber(row.your_earnings);
        current.tenant_earnings += toNumber(row.tenant_earnings);
        current.total_transactions += toNumber(row.total_transactions);
        current.failed_transactions += toNumber(row.failed_transactions);
        daily.set(key, current);
      }

      for (const row of billRows || []) {
        const key = formatUtcDateKey(new Date(row.day));
        const current = daily.get(key) || {
          day: key,
          total_revenue: 0,
          your_earnings: 0,
          tenant_earnings: 0,
          total_transactions: 0,
          failed_transactions: 0,
        };

        current.total_revenue += toNumber(row.total_revenue);
        current.your_earnings += toNumber(row.total_revenue);
        current.total_transactions += toNumber(row.total_transactions);
        daily.set(key, current);
      }

      return Array.from(daily.values())
        .sort((a, b) => new Date(a.day) - new Date(b.day));
    } catch (error) {
      console.error('Error in getDailyFinancialSeries:', error);
      return [];
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
          COUNT(CASE WHEN tr.type <> 'refund' THEN 1 END) as total_bookings,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr.amount as NUMERIC))
              ELSE ABS(CAST(tr.amount as NUMERIC))
            END
          ), 2) as gross_revenue,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."platformFee" as NUMERIC))
              ELSE ABS(CAST(tr."platformFee" as NUMERIC))
            END
          ), 2) as platform_commission,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."tenantRevenue" as NUMERIC))
              ELSE ABS(CAST(tr."tenantRevenue" as NUMERIC))
            END
          ), 2) as net_revenue,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."tenantRevenue" as NUMERIC))
              ELSE ABS(CAST(tr."tenantRevenue" as NUMERIC))
            END
          ) / NULLIF(COUNT(CASE WHEN tr.type <> 'refund' THEN 1 END), 0), 2) as avg_booking_value,
          COUNT(CASE WHEN tr.status = 'pending' THEN 1 END) as pending_transactions,
          COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed_transactions
        FROM transactions tr
        JOIN tenants t ON tr."tenantId" = t.id
        WHERE tr.status IN ('completed', 'refunded')
          AND tr.type IN ('booking', 'product_purchase', 'refund')
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
          COUNT(CASE WHEN tr.type <> 'refund' THEN 1 END) as bookings,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr.amount as NUMERIC))
              ELSE ABS(CAST(tr.amount as NUMERIC))
            END
          ), 2) as gross_revenue,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."platformFee" as NUMERIC))
              ELSE ABS(CAST(tr."platformFee" as NUMERIC))
            END
          ), 2) as your_commission,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."tenantRevenue" as NUMERIC))
              ELSE ABS(CAST(tr."tenantRevenue" as NUMERIC))
            END
          ), 2) as tenant_earned,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."tenantRevenue" as NUMERIC))
              ELSE ABS(CAST(tr."tenantRevenue" as NUMERIC))
            END
          ) / NULLIF(COUNT(CASE WHEN tr.type <> 'refund' THEN 1 END), 0), 2) as avg_per_booking,
          COUNT(DISTINCT DATE(tr."createdAt")) as active_days
        FROM transactions tr
        JOIN tenants t ON tr."tenantId" = t.id
        WHERE tr.status IN ('completed', 'refunded')
          AND tr.type IN ('booking', 'product_purchase', 'refund')
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
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST(amount as NUMERIC))
              ELSE ABS(CAST(amount as NUMERIC))
            END
          ), 2) as total_revenue,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("platformFee" as NUMERIC))
              ELSE ABS(CAST("platformFee" as NUMERIC))
            END
          ), 2) as your_earnings,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("tenantRevenue" as NUMERIC))
              ELSE ABS(CAST("tenantRevenue" as NUMERIC))
            END
          ), 2) as tenant_earnings,
          COUNT(*) as transaction_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
        FROM transactions
        WHERE status IN ('completed', 'refunded')
          AND type IN ('booking', 'product_purchase', 'refund')
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
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST(amount as NUMERIC))
              ELSE ABS(CAST(amount as NUMERIC))
            END
          ), 2) as amount,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("platformFee" as NUMERIC))
              ELSE ABS(CAST("platformFee" as NUMERIC))
            END
          ), 2) as platform_fee,
          ROUND(SUM(
            CASE
              WHEN type = 'refund' THEN -ABS(CAST("tenantRevenue" as NUMERIC))
              ELSE ABS(CAST("tenantRevenue" as NUMERIC))
            END
          ), 2) as tenant_revenue
        FROM transactions
        WHERE status IN ('completed', 'refunded')
          AND type IN ('booking', 'product_purchase', 'refund')
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
        refund: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
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
        refund: { count: 0, amount: 0, platformFee: 0, tenantRevenue: 0 },
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

      const result = createBillStatusSummarySeed();

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
      return createBillStatusSummarySeed();
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
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr.amount as NUMERIC))
              ELSE ABS(CAST(tr.amount as NUMERIC))
            END
          ), 2) as total_revenue,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."platformFee" as NUMERIC))
              ELSE ABS(CAST(tr."platformFee" as NUMERIC))
            END
          ), 2) as your_earnings,
          ROUND(SUM(
            CASE
              WHEN tr.type = 'refund' THEN -ABS(CAST(tr."tenantRevenue" as NUMERIC))
              ELSE ABS(CAST(tr."tenantRevenue" as NUMERIC))
            END
          ), 2) as tenant_earnings
        FROM transactions tr
        JOIN tenants t ON tr."tenantId" = t.id
        LEFT JOIN LATERAL (
          SELECT "packageId" FROM tenant_subscriptions
          WHERE "tenantId" = t.id
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) ts ON true
        LEFT JOIN subscription_packages sp ON sp.id = ts."packageId"
        WHERE tr.status IN ('completed', 'refunded')
          AND tr.type IN ('booking', 'product_purchase', 'refund')
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
          WHEN tr.type = 'refund' THEN 'refund'
          WHEN bs.id IS NOT NULL THEN 'booking'
          WHEN a.id IS NOT NULL THEN 'appointment'
          WHEN o.id IS NOT NULL THEN 'product'
          ELSE 'other'
        END as transaction_type,
        COALESCE(bs."bookingReference", s.name_en, o."orderNumber", 'N/A') as item_name,
        ROUND(CAST(tr.amount as NUMERIC), 2) as amount,
        ROUND(CAST(tr."platformFee" as NUMERIC), 2) as your_fee,
        ROUND(CAST(tr."tenantRevenue" as NUMERIC), 2) as tenant_revenue,
        tr.status as payment_status,
        COALESCE(tr.metadata->>'paymentMethod', 'N/A') as "paymentMethod"
      FROM transactions tr
      JOIN tenants t ON tr."tenantId" = t.id
      LEFT JOIN booking_sessions bs ON tr."bookingSessionId" = bs.id
      LEFT JOIN appointments a ON tr."appointmentId" = a.id
      LEFT JOIN services s ON a."serviceId" = s.id
      LEFT JOIN orders o ON tr.order_id = o.id
      WHERE tr."tenantId" = :tenantId
        AND tr.status IN ('completed', 'refunded')
        AND tr.type IN ('booking', 'product_purchase', 'refund')
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
