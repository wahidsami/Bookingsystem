'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { adminApi } from '@/lib/api';
import { format, subDays } from 'date-fns';

type Summary = {
  total_revenue: number;
  your_earnings: number;
  tenant_earnings: number;
  total_transactions: number;
  failed_transactions: number;
  avg_commission: number;
};

type MonthlyData = {
  month: string;
  total_revenue: number;
  your_earnings: number;
  tenant_earnings: number;
  transaction_count: number;
  your_percentage: number;
};

type CommissionData = {
  plan: string;
  commission_rate: number;
  tenant_count: number;
  total_transactions: number;
  total_revenue: number;
  your_earnings: number;
  tenant_earnings: number;
};

export default function FinancialOverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [commissionBreakdown, setCommissionBreakdown] = useState<CommissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('30');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd'T'00:00:00'Z'");
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");

      const [summaryRes, monthlyRes, commissionRes] = await Promise.all([
        adminApi.getPlatformFinancialSummary(startDate, endDate),
        adminApi.getMonthlyComparison(12),
        adminApi.getCommissionBreakdown(startDate, endDate),
      ]);

      if (summaryRes.success) setSummary(summaryRes.data);
      if (monthlyRes.success) setMonthly(monthlyRes.data);
      if (commissionRes.success) setCommissionBreakdown(commissionRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-200" />
          ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  // Calculate chart height based on data
  const maxRevenue = Math.max(
    ...(monthly.map((m) => m.total_revenue) || [0]),
    summary?.total_revenue || 0
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financial Overview</h1>
            <p className="text-gray-600">Complete financial dashboard</p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded border border-dark-700 bg-dark-800 px-3 py-2 text-white hover:border-dark-600"
          >
            <option value="7" className="bg-dark-900 text-white">Last 7 days</option>
            <option value="30" className="bg-dark-900 text-white">Last 30 days</option>
            <option value="90" className="bg-dark-900 text-white">Last 90 days</option>
          <option value="365" className="bg-dark-900 text-white">Last year</option>
        </select>
      </div>

      {/* Key Metrics - 4 Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-600 bg-gray-800 p-6">
            <p className="text-sm font-medium text-gray-300">Total Revenue</p>
            <p className="mt-2 text-2xl font-bold text-white">
              SAR {summary.total_revenue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400">from all customers</p>
          </div>

          <div className="rounded-lg border border-green-600 bg-green-900 p-6">
            <p className="text-sm font-medium text-green-200">Your Commission</p>
            <p className="mt-2 text-2xl font-bold text-green-400">
              SAR {summary.your_earnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-300">
              {summary.total_revenue > 0
                ? ((summary.your_earnings / summary.total_revenue) * 100).toFixed(1)
                : '0'}
              % of total
            </p>
          </div>

          <div className="rounded-lg border border-blue-600 bg-blue-900 p-6">
            <p className="text-sm font-medium text-blue-200">Tenant Revenue</p>
            <p className="mt-2 text-2xl font-bold text-blue-400">
              SAR {summary.tenant_earnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-blue-300">
              {summary.total_revenue > 0
                ? ((summary.tenant_earnings / summary.total_revenue) * 100).toFixed(1)
                : '0'}
              % of total
            </p>
          </div>

          <div className="rounded-lg border border-purple-600 bg-purple-900 p-6">
            <p className="text-sm font-medium text-purple-200">Transactions</p>
            <p className="mt-2 text-2xl font-bold text-purple-400">
              {summary.total_transactions.toLocaleString()}
            </p>
            <p className="text-xs text-purple-300">
              avg: SAR{' '}
              {summary.total_transactions > 0
                ? (summary.total_revenue / summary.total_transactions).toLocaleString('en-SA', {
                    maximumFractionDigits: 0,
                  })
                : '0'}
            </p>
          </div>
        </div>
      )}

      {/* Monthly Revenue Trend Chart */}
      {monthly.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-6 text-lg font-semibold text-white">Monthly Revenue Trend</h2>
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span className="text-dark-300">Total Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-dark-300">Your Commission</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                <span className="text-dark-300">Tenant Revenue</span>
              </div>
            </div>

            {/* Chart */}
            <div className="flex items-end justify-between gap-2 overflow-x-auto" style={{ height: '300px', minWidth: '100%' }}>
              {monthly.length > 0 ? (
                monthly.map((month, idx) => {
                  const totalHeight = Math.max((month.total_revenue / maxRevenue) * 100, 2);
                  const yourHeight = Math.max((month.your_earnings / maxRevenue) * 100, 2);
                  const tenantHeight = Math.max((month.tenant_earnings / maxRevenue) * 100, 2);

                  return (
                    <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-1 min-w-max">
                      <div className="w-8 rounded-t bg-gradient-to-b from-orange-400 to-orange-500" style={{ height: `${tenantHeight}%`, minHeight: '4px' }} title={`Tenant: SAR ${month.tenant_earnings.toLocaleString('en-SA', { maximumFractionDigits: 0 })}`}></div>
                      <div className="w-8 bg-gradient-to-b from-green-400 to-green-500" style={{ height: `${yourHeight}%`, minHeight: '4px' }} title={`Commission: SAR ${month.your_earnings.toLocaleString('en-SA', { maximumFractionDigits: 0 })}`}></div>
                      <p className="mt-2 text-xs font-medium text-gray-600 whitespace-nowrap">
                        {format(new Date(month.month), 'MMM')}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="flex w-full items-center justify-center text-gray-500">
                  No data available for chart
                </div>
              )}
            </div>

            {/* Data Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Total Revenue</th>
                    <th className="text-right">Your Commission</th>
                    <th className="text-right">Tenant Revenue</th>
                    <th className="text-right">Transactions</th>
                    <th className="text-right">Your %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((month, idx) => (
                    <tr key={idx}>
                      <td>
                        {format(new Date(month.month), 'MMMM yyyy')}
                      </td>
                      <td className="text-right">
                        SAR {month.total_revenue.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right font-semibold text-green-400">
                        SAR {month.your_earnings.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right">
                        SAR {month.tenant_earnings.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right">{month.transaction_count}</td>
                      <td className="text-right font-semibold text-blue-400">{month.your_percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Commission Breakdown by Plan */}
      {commissionBreakdown.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-6 text-lg font-semibold text-white">Commission by Subscription Plan</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pie Chart */}
            <div className="flex flex-col items-center justify-center">
              <div style={{ width: '200px', height: '200px' }} className="relative flex items-center justify-center">
                <svg width="200" height="200" className="transform -rotate-90">
                  {commissionBreakdown.map((item, idx) => {
                    const total = commissionBreakdown.reduce((sum, p) => sum + p.your_earnings, 0);
                    const percentage = (item.your_earnings / total) * 100;
                    const circumference = 2 * Math.PI * 60;
                    const offset = circumference * ((100 - percentage) / 100);

                    const colors = [
                      '#3B82F6',
                      '#10B981',
                      '#F59E0B',
                      '#EF4444',
                      '#8B5CF6',
                      '#EC4899',
                    ];
                    const color = colors[idx % colors.length];

                    let cumulativeOffset = 0;
                    for (let i = 0; i < idx; i++) {
                      cumulativeOffset +=
                        (commissionBreakdown[i].your_earnings / total) * circumference;
                    }

                    return (
                      <circle
                        key={idx}
                        cx="100"
                        cy="100"
                        r="60"
                        fill="none"
                        stroke={color}
                        strokeWidth="30"
                        strokeDasharray={`${circumference * (percentage / 100)} ${circumference}`}
                        strokeDashoffset={-cumulativeOffset}
                      />
                    );
                  })}
                </svg>
                <div className="absolute text-center">
                  <p className="text-sm text-dark-300">Total Commission</p>
                  <p className="text-xl font-bold text-white">
                    SAR{' '}
                    {commissionBreakdown
                      .reduce((sum, p) => sum + p.your_earnings, 0)
                      .toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6 space-y-2">
                {commissionBreakdown.map((item, idx) => {
                  const colors = [
                    '#3B82F6',
                    '#10B981',
                    '#F59E0B',
                    '#EF4444',
                    '#8B5CF6',
                    '#EC4899',
                  ];
                  const color = colors[idx % colors.length];
                  const total = commissionBreakdown.reduce((sum, p) => sum + p.your_earnings, 0);
                  const percentage = ((item.your_earnings / total) * 100).toFixed(1);

                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }}></div>
                      <span className="capitalize text-dark-200">{item.plan}</span>
                      <span className="ml-auto font-semibold text-dark-200">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Tenants</th>
                    <th className="text-right">Your Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionBreakdown.map((item, idx) => (
                    <tr key={idx}>
                      <td className="capitalize">{item.plan}</td>
                      <td className="text-right">{item.commission_rate}%</td>
                      <td className="text-right">{item.tenant_count}</td>
                      <td className="text-right font-semibold text-green-400">
                        SAR {item.your_earnings.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

