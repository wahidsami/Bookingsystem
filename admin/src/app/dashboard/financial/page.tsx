'use client';

import { FormEvent, useEffect, useState } from 'react';
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

type CommissionByPackageItem = {
  plan: string;
  tenant_count: number;
  total_transactions: number;
  total_revenue: number;
  your_earnings: number;
  tenant_earnings: number;
};

type RevenueByType = Record<
  string,
  { count: number; amount: number; platformFee: number; tenantRevenue: number }
>;

type InvoiceRow = {
  id: string;
  billNumber: string;
  type: string;
  status: 'DRAFT' | 'UNPAID' | 'FAILED' | 'PAID' | 'EXPIRED' | 'VOID';
  amount: number;
  totalAmount?: number;
  dueDate?: string | null;
  paidAt?: string | null;
  invoiceIssuedAt?: string | null;
  packageName?: string;
  packageNameAr?: string;
  billingCycle?: string;
  buyer?: {
    name?: string;
    nameAr?: string;
    nameEn?: string;
    email?: string;
  };
  tenant?: {
    id?: string;
    name?: string;
    name_ar?: string;
    name_en?: string;
    email?: string;
  };
};

type InvoicePagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const formatMoney = (amount: number) =>
  `SAR ${(Number(amount) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`;

const formatInvoiceDate = (value?: string | null) => {
  if (!value) return '-';
  return format(new Date(value), 'dd MMM yyyy');
};

const formatBillType = (value?: string) => {
  if (!value) return '-';

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatBillingCycle = (value?: string) => {
  if (value === 'monthly') return 'Monthly';
  if (value === 'sixMonth') return '6 Months';
  if (value === 'annual') return 'Annual';
  return value || '-';
};

const INVOICE_STATUS_META: Record<InvoiceRow['status'], { label: string; badgeClass: string }> = {
  DRAFT: { label: 'Draft', badgeClass: 'bg-slate-700 text-slate-200' },
  UNPAID: { label: 'Unpaid', badgeClass: 'bg-amber-900/40 text-amber-300' },
  FAILED: { label: 'Failed', badgeClass: 'bg-rose-900/40 text-rose-300' },
  PAID: { label: 'Paid', badgeClass: 'bg-green-900/40 text-green-300' },
  EXPIRED: { label: 'Expired', badgeClass: 'bg-gray-700 text-gray-300' },
  VOID: { label: 'Void', badgeClass: 'bg-zinc-700 text-zinc-300' }
};

export default function FinancialOverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [commissionBreakdown, setCommissionBreakdown] = useState<CommissionByPackageItem[]>([]);
  const [revenueByType, setRevenueByType] = useState<RevenueByType | null>(null);
  const [billsSummary, setBillsSummary] = useState<Record<string, { count: number; totalAmount: number }> | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<Record<string, { count: number; totalAmount: number }> | null>(null);
  const [invoicePagination, setInvoicePagination] = useState<InvoicePagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceStatus, setInvoiceStatus] = useState('ALL');
  const [invoiceType, setInvoiceType] = useState('ALL');
  const [invoiceSearchDraft, setInvoiceSearchDraft] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('30');

  useEffect(() => {
    fetchData();
  }, [period]);

  useEffect(() => {
    fetchInvoices();
  }, [period, invoicePage, invoiceStatus, invoiceType, invoiceSearch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotice(null);

      const startDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd'T'00:00:00'Z'");
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");

      const [summaryRes, monthlyRes, commissionRes, revenueByTypeRes, billsRes] = await Promise.allSettled([
        adminApi.getPlatformFinancialSummary(startDate, endDate),
        adminApi.getMonthlyComparison(12),
        adminApi.getCommissionByPackage(startDate, endDate),
        adminApi.getRevenueByType(startDate, endDate),
        adminApi.getBillsSummary(),
      ]);
      const failedSections: string[] = [];

      if (summaryRes.status === 'fulfilled' && summaryRes.value.success) {
        setSummary(summaryRes.value.data);
      } else {
        setSummary(null);
        failedSections.push('summary');
      }

      if (monthlyRes.status === 'fulfilled' && monthlyRes.value.success) {
        setMonthly(monthlyRes.value.data || []);
      } else {
        setMonthly([]);
        failedSections.push('monthly comparison');
      }

      if (commissionRes.status === 'fulfilled' && commissionRes.value.success) {
        setCommissionBreakdown(commissionRes.value.data || []);
      } else {
        setCommissionBreakdown([]);
        failedSections.push('commission breakdown');
      }

      if (revenueByTypeRes.status === 'fulfilled' && revenueByTypeRes.value.success) {
        setRevenueByType(revenueByTypeRes.value.data || null);
      } else {
        setRevenueByType(null);
        failedSections.push('revenue by type');
      }

      if (billsRes.status === 'fulfilled' && billsRes.value.success) {
        setBillsSummary(billsRes.value.data || null);
      } else {
        setBillsSummary(null);
        failedSections.push('bills summary');
      }

      if (failedSections.length === 5) {
        setError('Failed to fetch financial dashboard data');
      } else if (failedSections.length > 0) {
        setNotice(`Some financial sections failed to load: ${failedSections.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setInvoiceLoading(true);
      setInvoiceError(null);

      const startDate = format(subDays(new Date(), parseInt(period)), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const response = await adminApi.getFinancialInvoices({
        page: invoicePage,
        limit: 10,
        status: invoiceStatus,
        type: invoiceType,
        search: invoiceSearch.trim(),
        startDate,
        endDate
      });

      if (response.success) {
        setInvoices(response.bills || []);
        setInvoiceSummary(response.summary || null);
        setInvoicePagination(response.pagination || {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1
        });
      }
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Failed to load invoices');
      console.error('Invoice list error:', err);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleInvoiceSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInvoicePage(1);
    setInvoiceSearch(invoiceSearchDraft);
  };

  const handleInvoiceStatusChange = (value: string) => {
    setInvoiceStatus(value);
    setInvoicePage(1);
  };

  const handleInvoiceTypeChange = (value: string) => {
    setInvoiceType(value);
    setInvoicePage(1);
  };

  const downloadPdf = async (billId: string, kind: 'invoice' | 'receipt') => {
    try {
      const file = kind === 'invoice'
        ? await adminApi.downloadBillInvoicePdf(billId)
        : await adminApi.downloadBillReceiptPdf(billId);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to download ${kind} PDF`);
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

  // Calculate chart height based on data (safe numbers)
  const maxRevenue = Math.max(
    ...(monthly.map((m) => Number(m.total_revenue) || 0)),
    Number(summary?.total_revenue) || 0,
    1
  );

  // Safe numeric values (API may return null for some fields)
  const rev = Number(summary?.total_revenue) || 0;
  const yourEarnings = Number(summary?.your_earnings) || 0;
  const tenantEarnings = Number(summary?.tenant_earnings) || 0;
  const totalTx = Number(summary?.total_transactions) || 0;

  const typeLabels: Record<string, string> = {
    booking: 'Bookings',
    product_purchase: 'Products',
    subscription: 'Subscriptions',
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      )}

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
              SAR {rev.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400">from all customers</p>
          </div>

          <div className="rounded-lg border border-green-600 bg-green-900 p-6">
            <p className="text-sm font-medium text-green-200">Your Commission</p>
            <p className="mt-2 text-2xl font-bold text-green-400">
              SAR {yourEarnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-300">
              {rev > 0
                ? ((yourEarnings / rev) * 100).toFixed(1)
                : '0'}
              % of total
            </p>
          </div>

          <div className="rounded-lg border border-blue-600 bg-blue-900 p-6">
            <p className="text-sm font-medium text-blue-200">Tenant Revenue</p>
            <p className="mt-2 text-2xl font-bold text-blue-400">
              SAR {tenantEarnings.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-blue-300">
              {rev > 0
                ? ((tenantEarnings / rev) * 100).toFixed(1)
                : '0'}
              % of total
            </p>
          </div>

          <div className="rounded-lg border border-purple-600 bg-purple-900 p-6">
            <p className="text-sm font-medium text-purple-200">Transactions</p>
            <p className="mt-2 text-2xl font-bold text-purple-400">
              {totalTx.toLocaleString()}
            </p>
            <p className="text-xs text-purple-300">
              avg: SAR{' '}
              {totalTx > 0
                ? (rev / totalTx).toLocaleString('en-SA', {
                    maximumFractionDigits: 0,
                  })
                : '0'}
            </p>
          </div>
        </div>
      )}

      {/* Bills summary */}
      {billsSummary && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Bills Summary</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-amber-600/50 bg-amber-900/20 p-4">
              <p className="text-sm font-medium text-amber-200">Unpaid</p>
              <p className="mt-1 text-xl font-bold text-amber-400">{billsSummary.UNPAID?.count ?? 0} bills</p>
              <p className="text-xs text-amber-300">SAR {(billsSummary.UNPAID?.totalAmount ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border border-green-600/50 bg-green-900/20 p-4">
              <p className="text-sm font-medium text-green-200">Paid</p>
              <p className="mt-1 text-xl font-bold text-green-400">{billsSummary.PAID?.count ?? 0} bills</p>
              <p className="text-xs text-green-300">SAR {(billsSummary.PAID?.totalAmount ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border border-gray-600 bg-gray-800 p-4">
              <p className="text-sm font-medium text-gray-300">Expired</p>
              <p className="mt-1 text-xl font-bold text-gray-400">{billsSummary.EXPIRED?.count ?? 0} bills</p>
              <p className="text-xs text-gray-400">SAR {(billsSummary.EXPIRED?.totalAmount ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border border-rose-600/50 bg-rose-900/20 p-4">
              <p className="text-sm font-medium text-rose-200">Failed</p>
              <p className="mt-1 text-xl font-bold text-rose-400">{billsSummary.FAILED?.count ?? 0} bills</p>
              <p className="text-xs text-rose-300">SAR {(billsSummary.FAILED?.totalAmount ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800/60 p-4">
              <p className="text-sm font-medium text-slate-200">Draft / Void</p>
              <p className="mt-1 text-xl font-bold text-slate-300">
                {(billsSummary.DRAFT?.count ?? 0) + (billsSummary.VOID?.count ?? 0)} bills
              </p>
              <p className="text-xs text-slate-400">
                {formatMoney((billsSummary.DRAFT?.totalAmount ?? 0) + (billsSummary.VOID?.totalAmount ?? 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription invoices */}
      <div className="card p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Subscription Invoices</h2>
            <p className="text-sm text-dark-300">
              Search tenant invoices, track payment status, and download invoice or receipt PDFs.
            </p>
          </div>

          <form
            onSubmit={handleInvoiceSearchSubmit}
            className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center"
          >
            <input
              type="text"
              value={invoiceSearchDraft}
              onChange={(event) => setInvoiceSearchDraft(event.target.value)}
              placeholder="Search invoice, tenant, email, payment ref"
              className="w-full rounded-lg border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-white placeholder:text-dark-400 focus:border-primary-500 focus:outline-none lg:w-80"
            />
            <select
              value={invoiceStatus}
              onChange={(event) => handleInvoiceStatusChange(event.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white"
            >
              <option value="ALL" className="bg-dark-900">All Statuses</option>
              <option value="DRAFT" className="bg-dark-900">Draft</option>
              <option value="UNPAID" className="bg-dark-900">Unpaid</option>
              <option value="FAILED" className="bg-dark-900">Failed</option>
              <option value="PAID" className="bg-dark-900">Paid</option>
              <option value="EXPIRED" className="bg-dark-900">Expired</option>
              <option value="VOID" className="bg-dark-900">Void</option>
            </select>
            <select
              value={invoiceType}
              onChange={(event) => handleInvoiceTypeChange(event.target.value)}
              className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white"
            >
              <option value="ALL" className="bg-dark-900">All Types</option>
              <option value="initial" className="bg-dark-900">Initial</option>
              <option value="renewal" className="bg-dark-900">Renewal</option>
              <option value="upgrade" className="bg-dark-900">Upgrade</option>
              <option value="subscription" className="bg-dark-900">Subscription</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              Search
            </button>
          </form>
        </div>

        {invoiceSummary && (
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            {(['DRAFT', 'UNPAID', 'FAILED', 'PAID', 'EXPIRED', 'VOID'] as const).map((statusKey) => (
              <div
                key={statusKey}
                className="rounded-xl border border-dark-700 bg-dark-900/40 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-dark-400">{statusKey}</p>
                <p className="mt-2 text-xl font-bold text-white">
                  {invoiceSummary[statusKey]?.count ?? 0} invoices
                </p>
                <p className="text-sm text-dark-300">
                  {formatMoney(invoiceSummary[statusKey]?.totalAmount ?? 0)}
                </p>
              </div>
            ))}
          </div>
        )}

        {invoiceError && (
          <div className="mb-4 rounded-lg border border-red-600/50 bg-red-900/20 p-3 text-sm text-red-200">
            {invoiceError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Tenant</th>
                <th>Package</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Due / Paid</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoiceLoading ? (
                <tr>
                  <td colSpan={8} className="text-center text-dark-300">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-dark-300">
                    No invoices match the current filters.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const tenantName = invoice.buyer?.name
                    || invoice.buyer?.nameEn
                    || invoice.buyer?.nameAr
                    || invoice.tenant?.name_en
                    || invoice.tenant?.name_ar
                    || invoice.tenant?.name
                    || '-';
                  const tenantEmail = invoice.buyer?.email || invoice.tenant?.email || '-';

                  return (
                    <tr key={invoice.id}>
                      <td>
                        <div className="font-semibold text-white">{invoice.billNumber}</div>
                        <div className="text-xs text-dark-400">{formatBillType(invoice.type)}</div>
                      </td>
                      <td>
                        <div className="text-sm text-white">{tenantName}</div>
                        <div className="text-xs text-dark-400">{tenantEmail}</div>
                      </td>
                      <td>
                        <div className="text-sm text-white">
                          {invoice.packageName || invoice.packageNameAr || '-'}
                        </div>
                        <div className="text-xs text-dark-400">
                          {formatBillingCycle(invoice.billingCycle)}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_META[invoice.status]?.badgeClass || 'bg-slate-700 text-slate-200'}`}
                        >
                          {INVOICE_STATUS_META[invoice.status]?.label || invoice.status}
                        </span>
                      </td>
                      <td className="text-sm text-dark-200">
                        {formatInvoiceDate(invoice.invoiceIssuedAt)}
                      </td>
                      <td className="text-sm text-dark-200">
                        {invoice.status === 'PAID'
                          ? formatInvoiceDate(invoice.paidAt)
                          : formatInvoiceDate(invoice.dueDate)}
                      </td>
                      <td className="text-right text-sm font-semibold text-white">
                        {formatMoney(invoice.totalAmount ?? invoice.amount)}
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => downloadPdf(invoice.id, 'invoice')}
                            className="rounded-lg border border-dark-600 px-3 py-1 text-xs text-dark-100 transition hover:border-primary-500 hover:text-primary-300"
                          >
                            Invoice PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPdf(invoice.id, 'receipt')}
                            className="rounded-lg border border-dark-600 px-3 py-1 text-xs text-dark-100 transition hover:border-green-500 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={invoice.status !== 'PAID'}
                          >
                            Receipt PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-dark-700 pt-4 text-sm text-dark-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing page {invoicePagination.page} of {invoicePagination.totalPages} · {invoicePagination.total} invoices
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInvoicePage((page) => Math.max(page - 1, 1))}
              disabled={invoicePagination.page <= 1 || invoiceLoading}
              className="rounded-lg border border-dark-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setInvoicePage((page) => Math.min(page + 1, invoicePagination.totalPages))}
              disabled={invoicePagination.page >= invoicePagination.totalPages || invoiceLoading}
              className="rounded-lg border border-dark-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Revenue by type */}
      {revenueByType && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Revenue by Type</h2>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Platform Fee</th>
                  <th className="text-right">Tenant Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(['booking', 'product_purchase', 'subscription'] as const).map((key) => {
                  const row = revenueByType[key];
                  if (!row) return null;
                  return (
                    <tr key={key}>
                      <td>{typeLabels[key] || key}</td>
                      <td className="text-right">{row.count}</td>
                      <td className="text-right">
                        SAR {(row.amount || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right text-green-400">
                        SAR {(row.platformFee || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right">
                        SAR {(row.tenantRevenue || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                  const mRev = Number(month.total_revenue) || 0;
                  const mYour = Number(month.your_earnings) || 0;
                  const mTenant = Number(month.tenant_earnings) || 0;
                  const totalHeight = Math.max(maxRevenue > 0 ? (mRev / maxRevenue) * 100 : 0, 2);
                  const yourHeight = Math.max(maxRevenue > 0 ? (mYour / maxRevenue) * 100 : 0, 2);
                  const tenantHeight = Math.max(maxRevenue > 0 ? (mTenant / maxRevenue) * 100 : 0, 2);

                  return (
                    <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-1 min-w-max">
                      <div className="w-8 rounded-t bg-gradient-to-b from-orange-400 to-orange-500" style={{ height: `${tenantHeight}%`, minHeight: '4px' }} title={`Tenant: SAR ${mTenant.toLocaleString('en-SA', { maximumFractionDigits: 0 })}`}></div>
                      <div className="w-8 bg-gradient-to-b from-green-400 to-green-500" style={{ height: `${yourHeight}%`, minHeight: '4px' }} title={`Commission: SAR ${mYour.toLocaleString('en-SA', { maximumFractionDigits: 0 })}`}></div>
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
                  {monthly.map((month, idx) => {
                    const mRev = Number(month.total_revenue) || 0;
                    const mYour = Number(month.your_earnings) || 0;
                    const mTenant = Number(month.tenant_earnings) || 0;
                    const mPct = month.your_percentage != null ? Number(month.your_percentage) : 0;
                    const mCount = month.transaction_count != null ? Number(month.transaction_count) : 0;
                    return (
                      <tr key={idx}>
                        <td>
                          {format(new Date(month.month), 'MMMM yyyy')}
                        </td>
                        <td className="text-right">
                          SAR {mRev.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right font-semibold text-green-400">
                          SAR {mYour.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right">
                          SAR {mTenant.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right">{mCount}</td>
                        <td className="text-right font-semibold text-blue-400">{mPct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Commission by Package */}
      {commissionBreakdown.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-6 text-lg font-semibold text-white">Commission by Subscription Package</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pie Chart */}
            <div className="flex flex-col items-center justify-center">
              <div style={{ width: '200px', height: '200px' }} className="relative flex items-center justify-center">
                <svg width="200" height="200" className="transform -rotate-90">
                  {commissionBreakdown.map((item, idx) => {
                    const total = commissionBreakdown.reduce((sum, p) => sum + (Number(p.your_earnings) || 0), 0);
                    const itemEarnings = Number(item.your_earnings) || 0;
                    const percentage = total > 0 ? (itemEarnings / total) * 100 : 0;
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
                      const prevEarnings = Number(commissionBreakdown[i].your_earnings) || 0;
                      cumulativeOffset += total > 0 ? (prevEarnings / total) * circumference : 0;
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
                      .reduce((sum, p) => sum + (Number(p.your_earnings) || 0), 0)
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
                  const total = commissionBreakdown.reduce((sum, p) => sum + (Number(p.your_earnings) || 0), 0);
                  const itemEarnings = Number(item.your_earnings) || 0;
                  const percentage = total > 0 ? ((itemEarnings / total) * 100).toFixed(1) : '0';

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
                    <th>Package</th>
                    <th className="text-right">Tenants</th>
                    <th className="text-right">Transactions</th>
                    <th className="text-right">Your Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionBreakdown.map((item, idx) => {
                    const itemEarnings = Number(item.your_earnings) || 0;
                    const tenantCount = item.tenant_count != null ? Number(item.tenant_count) : 0;
                    const txCount = item.total_transactions != null ? Number(item.total_transactions) : 0;
                    return (
                      <tr key={idx}>
                        <td>{item.plan}</td>
                        <td className="text-right">{tenantCount}</td>
                        <td className="text-right">{txCount}</td>
                        <td className="text-right font-semibold text-green-400">
                          SAR {itemEarnings.toLocaleString('en-SA', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

