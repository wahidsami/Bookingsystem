'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { format, subDays } from 'date-fns';
import { AnalyticsDetailsDrawer, AnalyticsDrilldownEntity } from '@/components/AnalyticsDetailsDrawer';

type DrilldownConfig = {
  entity: AnalyticsDrilldownEntity;
  title: string;
  description?: string;
  defaultFilters?: Record<string, string>;
};

type TrendDelta = {
  percentage: number;
  direction: 'up' | 'down' | 'flat';
};

const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return value;
        })
        .join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const comparisonModes: Record<string, string> = {
  current_previous: 'Current vs Previous',
  month_over_month: 'Month over Month',
  year_over_year: 'Year over Year',
  custom_vs_custom: 'Custom vs Custom'
};

const trendPill = (delta?: TrendDelta) => {
  if (!delta) return 'No comparison';
  const prefix = delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '•';
  const sign = delta.percentage > 0 ? '+' : '';
  return `${prefix} ${sign}${delta.percentage.toFixed(1)}%`;
};

export default function GeneralReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [comparisonMode, setComparisonMode] = useState<'current_previous' | 'month_over_month' | 'year_over_year' | 'custom_vs_custom'>('current_previous');
  const [drilldown, setDrilldown] = useState<DrilldownConfig | null>(null);

  useEffect(() => {
    fetchReport();
  }, [period, comparisonMode]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const startDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd'T'00:00:00'Z'");
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");
      const res = await adminApi.getGeneralReport(startDate, endDate, { comparisonMode });
      if (res.success) setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data?.monthlyComparison?.length) {
      alert('No monthly data to export');
      return;
    }
    const rows = data.monthlyComparison.map((m: any) => ({
      Month: format(new Date(m.month), 'yyyy-MM'),
      TotalRevenue: m.total_revenue,
      YourEarnings: m.your_earnings,
      TenantEarnings: m.tenant_earnings,
      TransactionCount: m.transaction_count,
      YourPercentage: m.your_percentage,
    }));
    exportToCSV(rows, `general-report-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-lg bg-dark-700" />
        <div className="h-64 animate-pulse rounded-lg bg-dark-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-900/30 p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-dark-400">
        No data available.
      </div>
    );
  }

  const summary = data.summary || {};
  const rev = Number(summary.total_revenue) || 0;
  const yourEarnings = Number(summary.your_earnings) || 0;
  const tenantEarnings = Number(summary.tenant_earnings) || 0;
  const totalTx = Number(summary.total_transactions) || 0;
  const monthly = data.monthlyComparison || [];
  const commissionByPackage = data.commissionByPackage || [];
  const leaderboard = data.leaderboard || [];
  const topEmployees = data.topEmployees || [];
  const revenueByType = data.revenueByType || {};
  const comparison = data.comparison || null;
  const currentStartDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd'T'00:00:00'Z'");
  const currentEndDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");
  const openDrilldown = (config: DrilldownConfig) => setDrilldown(config);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">General Report</h1>
          <p className="text-dark-400">Aggregate financial overview</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="rounded border border-green-600 bg-green-900/50 px-4 py-2 text-sm font-medium text-green-300 hover:bg-green-900/70"
          >
            Export CSV
          </button>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded border border-dark-600 bg-dark-800 px-3 py-2 text-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <select
            value={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.value as typeof comparisonMode)}
            className="rounded border border-dark-600 bg-dark-800 px-3 py-2 text-white"
          >
            {Object.entries(comparisonModes).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <button
          type="button"
          onClick={() => openDrilldown({
            entity: 'transactions',
            title: 'Revenue Transactions',
            description: 'Transactions behind the total revenue summary.',
            defaultFilters: { startDate: currentStartDate, endDate: currentEndDate }
          })}
          className="rounded-lg border border-dark-600 bg-dark-800 p-4 text-left transition hover:border-primary-500 hover:bg-dark-750"
        >
          <p className="text-sm text-dark-400">Total Revenue</p>
          <p className="text-xl font-bold text-white">SAR {rev.toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
          <p className="mt-2 text-xs text-dark-400">{trendPill(comparison?.summary?.delta?.total_revenue)}</p>
        </button>
        <button
          type="button"
          onClick={() => openDrilldown({
            entity: 'transactions',
            title: 'Commission Transactions',
            description: 'Transactions that contributed to your commission.',
            defaultFilters: { startDate: currentStartDate, endDate: currentEndDate }
          })}
          className="rounded-lg border border-green-600/50 bg-green-900/20 p-4 text-left transition hover:border-green-400 hover:bg-green-900/30"
        >
          <p className="text-sm text-green-300">Your Commission</p>
          <p className="text-xl font-bold text-green-400">SAR {yourEarnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
          <p className="mt-2 text-xs text-green-300">{trendPill(comparison?.summary?.delta?.your_earnings)}</p>
        </button>
        <button
          type="button"
          onClick={() => openDrilldown({
            entity: 'transactions',
            title: 'Tenant Revenue Transactions',
            description: 'Transactions that contributed to tenant revenue.',
            defaultFilters: { startDate: currentStartDate, endDate: currentEndDate }
          })}
          className="rounded-lg border border-blue-600/50 bg-blue-900/20 p-4 text-left transition hover:border-blue-400 hover:bg-blue-900/30"
        >
          <p className="text-sm text-blue-300">Tenant Revenue</p>
          <p className="text-xl font-bold text-blue-400">SAR {tenantEarnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
          <p className="mt-2 text-xs text-blue-300">{trendPill(comparison?.summary?.delta?.tenant_earnings)}</p>
        </button>
        <button
          type="button"
          onClick={() => openDrilldown({
            entity: 'transactions',
            title: 'All Transactions',
            description: 'Full transaction ledger for the selected period.',
            defaultFilters: { startDate: currentStartDate, endDate: currentEndDate }
          })}
          className="rounded-lg border border-dark-600 bg-dark-800 p-4 text-left transition hover:border-dark-500 hover:bg-dark-750"
        >
          <p className="text-sm text-dark-400">Transactions</p>
          <p className="text-xl font-bold text-white">{totalTx}</p>
          <p className="mt-2 text-xs text-dark-400">{trendPill(comparison?.summary?.delta?.total_transactions)}</p>
        </button>
      </div>

      {comparison?.timeline?.length ? (
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Comparison Overlay</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-dark-400">
              {comparisonModes[comparison.mode] || comparison.mode}
            </span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox="0 0 640 220" className="h-56 w-full">
              {(() => {
                const current = comparison.timeline.map((point: any) => Number(point.current.total_revenue) || 0);
                const previous = comparison.timeline.map((point: any) => Number(point.previous.total_revenue) || 0);
                const max = Math.max(...current, ...previous, 1);
                const buildPoints = (values: number[]) => values
                  .map((value, index) => {
                    const x = values.length === 1 ? 320 : (index / (values.length - 1)) * 640;
                    const y = 200 - ((value / max) * 176);
                    return `${x},${y}`;
                  })
                  .join(' ');
                return (
                  <>
                    <polyline fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 6" points={buildPoints(previous)} />
                    <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={buildPoints(current)} />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      ) : null}

      {/* Revenue by type */}
      {revenueByType && Object.keys(revenueByType).length > 0 && (
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Revenue by Type</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-left">
                  <th className="py-2 text-dark-300">Type</th>
                  <th className="py-2 text-right text-dark-300">Count</th>
                  <th className="py-2 text-right text-dark-300">Amount</th>
                  <th className="py-2 text-right text-dark-300">Platform Fee</th>
                  <th className="py-2 text-right text-dark-300">Tenant Revenue</th>
                </tr>
              </thead>
              <tbody>
                {['booking', 'product_purchase', 'subscription'].map((key) => {
                  const row = revenueByType[key];
                  if (!row) return null;
                  const labels: Record<string, string> = { booking: 'Bookings', product_purchase: 'Products', subscription: 'Subscriptions' };
                  return (
                    <tr
                      key={key}
                      className="cursor-pointer border-b border-dark-700 transition hover:bg-dark-700/50"
                      onClick={() => openDrilldown({
                        entity: key === 'subscription' ? 'invoices' : 'transactions',
                        title: `${labels[key]} Drill-down`,
                        description: `Detailed records behind ${labels[key].toLowerCase()} revenue.`,
                        defaultFilters: key === 'subscription'
                          ? { status: 'PAID', startDate: currentStartDate, endDate: currentEndDate }
                          : { type: key, startDate: currentStartDate, endDate: currentEndDate }
                      })}
                    >
                      <td className="py-2 text-white">{labels[key]}</td>
                      <td className="py-2 text-right text-white">{row.count}</td>
                      <td className="py-2 text-right text-white">SAR {(row.amount || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 text-right text-green-400">SAR {(row.platformFee || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 text-right text-white">SAR {(row.tenantRevenue || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly */}
      {monthly.length > 0 && (
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Monthly Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-left">
                  <th className="py-2 text-dark-300">Month</th>
                  <th className="py-2 text-right text-dark-300">Total Revenue</th>
                  <th className="py-2 text-right text-dark-300">Your Commission</th>
                  <th className="py-2 text-right text-dark-300">Tenant Revenue</th>
                  <th className="py-2 text-right text-dark-300">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m: any, idx: number) => (
                  <tr
                    key={idx}
                    className="cursor-pointer border-b border-dark-700 transition hover:bg-dark-700/50"
                    onClick={() => {
                      const monthDate = new Date(m.month);
                      const monthStart = format(monthDate, "yyyy-MM-dd'T'00:00:00'Z'");
                      const monthEnd = format(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0), "yyyy-MM-dd'T'23:59:59'Z'");
                      openDrilldown({
                        entity: 'transactions',
                        title: `${format(monthDate, 'MMMM yyyy')} Transactions`,
                        description: 'Transactions within this month.',
                        defaultFilters: { startDate: monthStart, endDate: monthEnd }
                      });
                    }}
                  >
                    <td className="py-2 text-white">{format(new Date(m.month), 'MMMM yyyy')}</td>
                    <td className="py-2 text-right text-white">SAR {(Number(m.total_revenue) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right text-green-400">SAR {(Number(m.your_earnings) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right text-white">SAR {(Number(m.tenant_earnings) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right text-white">{m.transaction_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commission by package */}
      {commissionByPackage.length > 0 && (
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Commission by Package</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-left">
                  <th className="py-2 text-dark-300">Package</th>
                  <th className="py-2 text-right text-dark-300">Tenants</th>
                  <th className="py-2 text-right text-dark-300">Transactions</th>
                  <th className="py-2 text-right text-dark-300">Your Commission</th>
                </tr>
              </thead>
              <tbody>
                {commissionByPackage.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-dark-700">
                    <td className="py-2 text-white">{item.plan}</td>
                    <td className="py-2 text-right text-white">{item.tenant_count ?? 0}</td>
                    <td className="py-2 text-right text-white">{item.total_transactions ?? 0}</td>
                    <td className="py-2 text-right text-green-400">SAR {(Number(item.your_earnings) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top tenants */}
      {leaderboard.length > 0 && (
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Top Tenants</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-left">
                  <th className="py-2 text-dark-300">Rank</th>
                  <th className="py-2 text-dark-300">Tenant</th>
                  <th className="py-2 text-right text-dark-300">Gross Revenue</th>
                  <th className="py-2 text-right text-dark-300">Your Commission</th>
                  <th className="py-2 text-right text-dark-300">Tenant Earned</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row: any) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-dark-700 transition hover:bg-dark-700/50"
                    onClick={() => openDrilldown({
                      entity: 'transactions',
                      title: `${row.name} Transactions`,
                      description: `Transactions for tenant ${row.name}.`,
                      defaultFilters: { tenantId: row.id, startDate: currentStartDate, endDate: currentEndDate }
                    })}
                  >
                    <td className="py-2 text-white">{row.rank}</td>
                    <td className="py-2 text-white">{row.name}</td>
                    <td className="py-2 text-right text-white">SAR {(Number(row.gross_revenue) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right text-green-400">SAR {(Number(row.your_commission) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right text-white">SAR {(Number(row.tenant_earned) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top employees */}
      {topEmployees.length > 0 && (
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Top Employees</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-left">
                  <th className="py-2 text-dark-300">Rank</th>
                  <th className="py-2 text-dark-300">Tenant</th>
                  <th className="py-2 text-dark-300">Employee</th>
                  <th className="py-2 text-right text-dark-300">Appointments</th>
                  <th className="py-2 text-right text-dark-300">Commission Earned</th>
                </tr>
              </thead>
              <tbody>
                {topEmployees.map((row: any) => (
                  <tr
                    key={`${row.tenant}-${row.employee}`}
                    className="cursor-pointer border-b border-dark-700 transition hover:bg-dark-700/50"
                    onClick={() => openDrilldown({
                      entity: 'employees',
                      title: `${row.employee} Drill-down`,
                      description: `Employee activity for ${row.employee} at ${row.tenant}.`,
                      defaultFilters: { search: row.employee, startDate: currentStartDate, endDate: currentEndDate }
                    })}
                  >
                    <td className="py-2 text-white">{row.rank}</td>
                    <td className="py-2 text-white">{row.tenant}</td>
                    <td className="py-2 text-white">{row.employee}</td>
                    <td className="py-2 text-right text-white">{row.appointments ?? 0}</td>
                    <td className="py-2 text-right text-green-400">SAR {(Number(row.commission_earned) || 0).toLocaleString('en-SA', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnalyticsDetailsDrawer
        open={Boolean(drilldown)}
        entity={drilldown?.entity || null}
        title={drilldown?.title || ''}
        description={drilldown?.description}
        defaultFilters={drilldown?.defaultFilters}
        startDate={currentStartDate}
        endDate={currentEndDate}
        onClose={() => setDrilldown(null)}
      />
    </div>
  );
}
