'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { format, subDays } from 'date-fns';

const PAGE_SIZE = 25;

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

export default function DetailedReportPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchReport();
  }, [period, typeFilter, tenantId, page]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const startDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd'T'00:00:00'Z'");
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");
      const res = await adminApi.getDetailedReport({
        startDate,
        endDate,
        tenantId: tenantId || undefined,
        type: typeFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (res.success) setReport(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTenants = async () => {
      try {
        const res = await adminApi.getTenantFinancials(undefined, undefined, undefined);
        if (res.success && Array.isArray(res.data)) {
          setTenants(res.data.map((t: any) => ({ id: t.id, name: t.name })));
        }
      } catch {
        // ignore
      }
    };
    loadTenants();
  }, []);

  const handleExport = () => {
    if (!report?.transactions?.length) {
      alert('No transactions to export');
      return;
    }
    const rows = report.transactions.map((t: any) => ({
      Date: t.createdAt ? format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm') : '',
      Tenant: t.tenant_name,
      Type: t.transaction_type,
      Item: t.item_name,
      Amount: t.amount,
      PlatformFee: t.platform_fee,
      TenantRevenue: t.tenant_revenue,
      Status: t.payment_status,
    }));
    exportToCSV(rows, `detailed-report-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  if (error) {
    return (
      <div className="rounded-lg bg-red-900/30 p-4 text-red-300">
        {error}
      </div>
    );
  }

  const transactions = report?.transactions ?? [];
  const total = report?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const summary = report?.summary ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Detailed Report</h1>
          <p className="text-dark-400">Transaction ledger with filters</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={loading || transactions.length === 0}
            className="rounded border border-green-600 bg-green-900/50 px-4 py-2 text-sm font-medium text-green-300 hover:bg-green-900/70 disabled:opacity-50"
          >
            Export CSV
          </button>
          <select
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setPage(0); }}
            className="rounded border border-dark-600 bg-dark-800 px-3 py-2 text-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
            className="rounded border border-dark-600 bg-dark-800 px-3 py-2 text-white"
          >
            <option value="">All types</option>
            <option value="booking">Booking</option>
            <option value="product_purchase">Product</option>
            <option value="subscription">Subscription</option>
          </select>
          <select
            value={tenantId}
            onChange={(e) => { setTenantId(e.target.value); setPage(0); }}
            className="rounded border border-dark-600 bg-dark-800 px-3 py-2 text-white"
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary line */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-dark-600 bg-dark-800 p-4">
        <span className="text-dark-300">
          Total revenue: <strong className="text-white">SAR {(Number(summary.total_revenue) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</strong>
        </span>
        <span className="text-green-400">
          Your commission: <strong>SAR {(Number(summary.your_earnings) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</strong>
        </span>
        <span className="text-dark-300">
          Showing {transactions.length} of {total} transactions
        </span>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-dark-700" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-dark-600 bg-dark-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 text-left">
                  <th className="py-3 pl-4 text-dark-300">Date</th>
                  <th className="py-3 text-dark-300">Tenant</th>
                  <th className="py-3 text-dark-300">Type</th>
                  <th className="py-3 text-dark-300">Item</th>
                  <th className="py-3 text-right text-dark-300">Amount</th>
                  <th className="py-3 text-right text-dark-300">Platform Fee</th>
                  <th className="py-3 text-right text-dark-300">Tenant Revenue</th>
                  <th className="py-3 pr-4 text-dark-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-dark-500">
                      No transactions found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t: any) => (
                    <tr key={t.id} className="border-b border-dark-700">
                      <td className="py-2 pl-4 text-white">
                        {t.createdAt ? format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm') : '—'}
                      </td>
                      <td className="py-2 text-white">{t.tenant_name ?? '—'}</td>
                      <td className="py-2 text-white">{t.transaction_type ?? '—'}</td>
                      <td className="py-2 text-white">{t.item_name ?? '—'}</td>
                      <td className="py-2 text-right text-white">
                        SAR {(Number(t.amount) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-right text-green-400">
                        SAR {(Number(t.platform_fee) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-right text-white">
                        SAR {(Number(t.tenant_revenue) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-4 text-white">{t.payment_status ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-dark-400">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded border border-dark-600 bg-dark-800 px-3 py-1 text-white disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded border border-dark-600 bg-dark-800 px-3 py-1 text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
