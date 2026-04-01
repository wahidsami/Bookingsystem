'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { format, subDays } from 'date-fns';

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

export default function GeneralReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchReport();
  }, [period]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const startDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd'T'00:00:00'Z'");
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");
      const res = await adminApi.getGeneralReport(startDate, endDate);
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
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <p className="text-sm text-dark-400">Total Revenue</p>
          <p className="text-xl font-bold text-white">SAR {rev.toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-green-600/50 bg-green-900/20 p-4">
          <p className="text-sm text-green-300">Your Commission</p>
          <p className="text-xl font-bold text-green-400">SAR {yourEarnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-blue-600/50 bg-blue-900/20 p-4">
          <p className="text-sm text-blue-300">Tenant Revenue</p>
          <p className="text-xl font-bold text-blue-400">SAR {tenantEarnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-dark-600 bg-dark-800 p-4">
          <p className="text-sm text-dark-400">Transactions</p>
          <p className="text-xl font-bold text-white">{totalTx}</p>
        </div>
      </div>

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
                    <tr key={key} className="border-b border-dark-700">
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
                  <tr key={idx} className="border-b border-dark-700">
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
                  <tr key={row.id} className="border-b border-dark-700">
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
                  <tr key={`${row.tenant}-${row.employee}`} className="border-b border-dark-700">
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
    </div>
  );
}
