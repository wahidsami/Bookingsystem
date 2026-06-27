'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { adminApi } from '@/lib/api';
import { humanizeValue } from '@/lib/display';

export type AnalyticsDrilldownEntity =
  | 'transactions'
  | 'appointments'
  | 'payments'
  | 'customers'
  | 'employees'
  | 'services'
  | 'products'
  | 'invoices'
  | 'bills';

export interface AnalyticsDetailsDrawerProps {
  open: boolean;
  entity: AnalyticsDrilldownEntity | null;
  title: string;
  description?: string;
  defaultFilters?: Record<string, string>;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}

type ColumnDef = {
  key: string;
  label: string;
  field: string;
  align?: 'left' | 'right';
  render?: (row: Record<string, any>) => ReactNode;
};

type FilterDef = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

type EntityMeta = {
  columns: ColumnDef[];
  filters: FilterDef[];
  summaryKeys?: Array<{ key: string; label: string; kind?: 'money' | 'count' | 'text' }>;
};

const money = (value: any) =>
  `SAR ${(Number(value) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`;

const formatDateTime = (value: any) => {
  if (!value) return '-';
  return format(new Date(value), 'dd MMM yyyy, HH:mm');
};

const formatDateOnly = (value: any) => {
  if (!value) return '-';
  return format(new Date(value), 'dd MMM yyyy');
};

const toCsvValue = (value: any) => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : String(value);
  if (raw.includes('"')) return `"${raw.replace(/"/g, '""')}"`;
  if (raw.includes(',') || raw.includes('\n')) return `"${raw}"`;
  return raw;
};

const ENTITY_META: Record<NonNullable<AnalyticsDetailsDrawerProps['entity']>, EntityMeta> = {
  transactions: {
    columns: [
      { key: 'occurredAt', label: 'Date', field: 'occurredAt', render: (row) => formatDateTime(row.occurredAt) },
      { key: 'tenantName', label: 'Tenant', field: 'tenantName' },
      { key: 'customerName', label: 'Customer', field: 'customerName' },
      { key: 'itemName', label: 'Item', field: 'itemName' },
      { key: 'itemType', label: 'Type', field: 'itemType' },
      { key: 'amount', label: 'Amount', field: 'amount', align: 'right', render: (row) => money(row.amount) },
      { key: 'platformFee', label: 'Platform Fee', field: 'platformFee', align: 'right', render: (row) => money(row.platformFee) },
      { key: 'tenantRevenue', label: 'Tenant Revenue', field: 'tenantRevenue', align: 'right', render: (row) => money(row.tenantRevenue) },
      { key: 'status', label: 'Status', field: 'status' },
      { key: 'paymentMethod', label: 'Payment Method', field: 'paymentMethod' }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search tenant, customer, item, reference' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
          { value: 'refunded', label: 'Refunded' }
        ]
      },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: '', label: 'All types' },
          { value: 'booking', label: 'Booking' },
          { value: 'product_purchase', label: 'Product Purchase' },
          { value: 'refund', label: 'Refund' },
          { value: 'wallet_topup', label: 'Wallet Top-up' },
          { value: 'loyalty_redemption', label: 'Loyalty Redemption' }
        ]
      }
    ],
    summaryKeys: [
      { key: 'totalAmount', label: 'Total Amount', kind: 'money' },
      { key: 'totalPlatformFee', label: 'Platform Fee', kind: 'money' },
      { key: 'totalTenantRevenue', label: 'Tenant Revenue', kind: 'money' }
    ]
  },
  appointments: {
    columns: [
      { key: 'occurredAt', label: 'Date', field: 'occurredAt', render: (row) => formatDateTime(row.occurredAt) },
      { key: 'tenantName', label: 'Tenant', field: 'tenantName' },
      { key: 'customerName', label: 'Customer', field: 'customerName' },
      { key: 'serviceName', label: 'Service', field: 'serviceName' },
      { key: 'employeeName', label: 'Employee', field: 'employeeName' },
      { key: 'bookingNumber', label: 'Booking #', field: 'bookingNumber' },
      { key: 'status', label: 'Status', field: 'status' },
      { key: 'paymentStatus', label: 'Payment', field: 'paymentStatus' },
      { key: 'amount', label: 'Amount', field: 'amount', align: 'right', render: (row) => money(row.amount) },
      { key: 'paymentMethod', label: 'Payment Method', field: 'paymentMethod' }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search booking number, customer, service, staff' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'checked_in', label: 'Checked In' },
          { value: 'in_service', label: 'In Service' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'no_show', label: 'No Show' }
        ]
      },
      {
        key: 'paymentStatus',
        label: 'Payment',
        type: 'select',
        options: [
          { value: '', label: 'All payment states' },
          { value: 'pending', label: 'Pending' },
          { value: 'deposit_paid', label: 'Deposit Paid' },
          { value: 'fully_paid', label: 'Fully Paid' },
          { value: 'refunded', label: 'Refunded' },
          { value: 'partially_refunded', label: 'Partially Refunded' }
        ]
      }
    ],
    summaryKeys: [{ key: 'totalAmount', label: 'Total Amount', kind: 'money' }]
  },
  payments: {
    columns: [
      { key: 'occurredAt', label: 'Date', field: 'occurredAt', render: (row) => formatDateTime(row.occurredAt) },
      { key: 'tenantName', label: 'Tenant', field: 'tenantName' },
      { key: 'customerName', label: 'Customer', field: 'customerName' },
      { key: 'reference', label: 'Reference', field: 'reference' },
      { key: 'type', label: 'Type', field: 'type' },
      { key: 'paymentMethod', label: 'Method', field: 'paymentMethod' },
      { key: 'status', label: 'Status', field: 'status' },
      { key: 'amount', label: 'Amount', field: 'amount', align: 'right', render: (row) => money(row.amount) },
      { key: 'processorName', label: 'Processed By', field: 'processorName' }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search reference, note, processor' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
          { value: 'refunded', label: 'Refunded' },
          { value: 'cancelled', label: 'Cancelled' }
        ]
      },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: '', label: 'All types' },
          { value: 'deposit', label: 'Deposit' },
          { value: 'remainder', label: 'Remainder' },
          { value: 'full', label: 'Full' },
          { value: 'refund', label: 'Refund' }
        ]
      },
      {
        key: 'paymentMethod',
        label: 'Method',
        type: 'select',
        options: [
          { value: '', label: 'All methods' },
          { value: 'online', label: 'Online' },
          { value: 'cash', label: 'Cash' },
          { value: 'card_pos', label: 'Card POS' },
          { value: 'wallet', label: 'Wallet' },
          { value: 'bank_transfer', label: 'Bank Transfer' },
          { value: 'gift_card_code', label: 'Gift Card Code' }
        ]
      }
    ],
    summaryKeys: [{ key: 'totalAmount', label: 'Total Amount', kind: 'money' }]
  },
  customers: {
    columns: [
      { key: 'name', label: 'Name', field: 'name' },
      { key: 'email', label: 'Email', field: 'email' },
      { key: 'phone', label: 'Phone', field: 'phone' },
      { key: 'totalBookings', label: 'Bookings', field: 'totalBookings', align: 'right' },
      { key: 'totalSpent', label: 'Total Spent', field: 'totalSpent', align: 'right', render: (row) => money(row.totalSpent) },
      { key: 'walletBalance', label: 'Wallet', field: 'walletBalance', align: 'right', render: (row) => money(row.walletBalance) },
      { key: 'loyaltyPoints', label: 'Loyalty', field: 'loyaltyPoints', align: 'right' },
      { key: 'joinedAt', label: 'Joined', field: 'joinedAt', render: (row) => formatDateOnly(row.joinedAt) }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search name, email or phone' }
    ],
    summaryKeys: [{ key: 'totalSpent', label: 'Total Spent', kind: 'money' }]
  },
  employees: {
    columns: [
      { key: 'tenantName', label: 'Tenant', field: 'tenantName' },
      { key: 'name', label: 'Name', field: 'name' },
      { key: 'position', label: 'Position', field: 'position' },
      { key: 'active', label: 'Status', field: 'active' },
      { key: 'rating', label: 'Rating', field: 'rating', align: 'right' },
      { key: 'appointmentsCount', label: 'Appointments', field: 'appointmentsCount', align: 'right' },
      { key: 'commissionEarned', label: 'Commission', field: 'commissionEarned', align: 'right', render: (row) => money(row.commissionEarned) },
      { key: 'totalValueHandled', label: 'Value Handled', field: 'totalValueHandled', align: 'right', render: (row) => money(row.totalValueHandled) }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search employee, phone, or position' },
      {
        key: 'active',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' }
        ]
      },
      { key: 'category', label: 'Position', type: 'text', placeholder: 'Filter by position' }
    ],
    summaryKeys: [{ key: 'commissionEarned', label: 'Commission', kind: 'money' }]
  },
  services: {
    columns: [
      { key: 'tenantName', label: 'Tenant', field: 'tenantName' },
      { key: 'serviceName', label: 'Service', field: 'serviceName' },
      { key: 'category', label: 'Category', field: 'category' },
      { key: 'price', label: 'Price', field: 'price', align: 'right', render: (row) => money(row.price) },
      { key: 'appointmentsCount', label: 'Appointments', field: 'appointmentsCount', align: 'right' },
      { key: 'employeesCount', label: 'Employees', field: 'employeesCount', align: 'right' },
      { key: 'revenue', label: 'Revenue', field: 'revenue', align: 'right', render: (row) => money(row.revenue) },
      { key: 'active', label: 'Status', field: 'active' }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search service name or category' },
      {
        key: 'active',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' }
        ]
      },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Filter by category' }
    ],
    summaryKeys: [{ key: 'revenue', label: 'Revenue', kind: 'money' }]
  },
  products: {
    columns: [
      { key: 'tenantName', label: 'Tenant', field: 'tenantName' },
      { key: 'productName', label: 'Product', field: 'productName' },
      { key: 'category', label: 'Category', field: 'category' },
      { key: 'sku', label: 'SKU', field: 'sku' },
      { key: 'price', label: 'Price', field: 'price', align: 'right', render: (row) => money(row.price) },
      { key: 'stock', label: 'Stock', field: 'stock', align: 'right' },
      { key: 'soldUnits', label: 'Sold Units', field: 'soldUnits', align: 'right' },
      { key: 'revenue', label: 'Revenue', field: 'revenue', align: 'right', render: (row) => money(row.revenue) },
      { key: 'active', label: 'Status', field: 'active' }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search product, SKU, brand' },
      {
        key: 'active',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'true', label: 'Available' },
          { value: 'false', label: 'Hidden' }
        ]
      },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Filter by category' }
    ],
    summaryKeys: [{ key: 'revenue', label: 'Revenue', kind: 'money' }]
  },
  invoices: {
    columns: [
      { key: 'billNumber', label: 'Invoice', field: 'billNumber' },
      { key: 'tenantName', label: 'Tenant', field: 'tenantName' },
      { key: 'customerName', label: 'Customer', field: 'customerName' },
      { key: 'type', label: 'Type', field: 'type' },
      { key: 'status', label: 'Status', field: 'status' },
      { key: 'amount', label: 'Amount', field: 'amount', align: 'right', render: (row) => money(row.amount) },
      { key: 'issuedAt', label: 'Issued', field: 'issuedAt', render: (row) => formatDateOnly(row.issuedAt) },
      { key: 'paidAt', label: 'Paid', field: 'paidAt', render: (row) => formatDateOnly(row.paidAt) },
      { key: 'dueDate', label: 'Due', field: 'dueDate', render: (row) => formatDateOnly(row.dueDate) },
      { key: 'packageName', label: 'Package', field: 'packageName' }
    ],
    filters: [
      { key: 'search', label: 'Search', type: 'text', placeholder: 'Search invoice, tenant, customer' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'DRAFT', label: 'Draft' },
          { value: 'UNPAID', label: 'Unpaid' },
          { value: 'FAILED', label: 'Failed' },
          { value: 'PAID', label: 'Paid' },
          { value: 'EXPIRED', label: 'Expired' },
          { value: 'VOID', label: 'Void' }
        ]
      },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: '', label: 'All types' },
          { value: 'initial', label: 'Initial' },
          { value: 'renewal', label: 'Renewal' },
          { value: 'upgrade', label: 'Upgrade' },
          { value: 'subscription', label: 'Subscription' }
        ]
      }
    ],
    summaryKeys: [{ key: 'totalAmount', label: 'Total Amount', kind: 'money' }]
  },
  bills: {
    columns: [],
    filters: [],
    summaryKeys: []
  }
};

function buildExportRows(entity: NonNullable<AnalyticsDetailsDrawerProps['entity']>, rows: any[]) {
  const columns = ENTITY_META[entity]?.columns || [];
  return rows.map((row) => {
    const result: Record<string, any> = {};
    for (const column of columns) {
      result[column.label] = column.render ? column.render(row) : row[column.field];
    }
    return result;
  });
}

function exportCsv(rows: any[], filename: string) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(','))
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AnalyticsDetailsDrawer({
  open,
  entity,
  title,
  description,
  defaultFilters,
  startDate,
  endDate,
  onClose
}: AnalyticsDetailsDrawerProps) {
  const meta = entity ? ENTITY_META[entity] : null;
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const resolvedDefaults = useMemo(() => ({
    ...(defaultFilters || {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {})
  }), [defaultFilters, startDate, endDate]);

  useEffect(() => {
    if (!open || !entity) return;

    const initialFilters = {
      search: '',
      status: '',
      type: '',
      paymentStatus: '',
      paymentMethod: '',
      category: '',
      active: '',
      tenantId: '',
      startDate: resolvedDefaults.startDate || '',
      endDate: resolvedDefaults.endDate || '',
      ...resolvedDefaults
    };

    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
    setLimit(25);
    setRows([]);
    setSummary(null);
    setError(null);
  }, [open, entity, resolvedDefaults]);

  useEffect(() => {
    const controller = new AbortController();

    const loadRows = async () => {
      if (!open || !entity) return;
      try {
        setLoading(true);
        setError(null);
        const response = await adminApi.getAnalyticsDrilldown({
          entity,
          page,
          limit,
          search: appliedFilters.search || undefined,
          tenantId: appliedFilters.tenantId || undefined,
          status: appliedFilters.status || undefined,
          type: appliedFilters.type || undefined,
          paymentStatus: appliedFilters.paymentStatus || undefined,
          paymentMethod: appliedFilters.paymentMethod || undefined,
          category: appliedFilters.category || undefined,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
          active: appliedFilters.active || undefined
        });

        if (controller.signal.aborted) return;

        if (response.success) {
          setRows(response.data.rows || []);
          setSummary(response.data.summary || null);
          setTotal(response.data.total || 0);
        } else {
          throw new Error('Failed to load drilldown data');
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load drilldown data');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadRows();
    return () => controller.abort();
  }, [open, entity, page, limit, appliedFilters]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      search: '',
      status: '',
      type: '',
      paymentStatus: '',
      paymentMethod: '',
      category: '',
      active: '',
      tenantId: '',
      startDate: resolvedDefaults.startDate || '',
      endDate: resolvedDefaults.endDate || ''
    };
    setDraftFilters(resetFilters);
    setAppliedFilters(resetFilters);
    setPage(1);
  };

  const handleExport = async () => {
    if (!entity || !meta) return;
    try {
      setExporting(true);
      const pageSize = 200;
      const maxPages = Math.max(Math.ceil(total / pageSize), 1);
      const allRows: any[] = [];

      for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
        const response = await adminApi.getAnalyticsDrilldown({
          entity,
          page: currentPage,
          limit: pageSize,
          search: appliedFilters.search || undefined,
          tenantId: appliedFilters.tenantId || undefined,
          status: appliedFilters.status || undefined,
          type: appliedFilters.type || undefined,
          paymentStatus: appliedFilters.paymentStatus || undefined,
          paymentMethod: appliedFilters.paymentMethod || undefined,
          category: appliedFilters.category || undefined,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
          active: appliedFilters.active || undefined
        });
        if (!response.success) break;
        allRows.push(...(response.data.rows || []));
        if ((response.data.rows || []).length < pageSize) break;
      }

      const exportRows = buildExportRows(entity, allRows);
      exportCsv(exportRows, `analytics-${entity}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  if (!open || !entity || !meta) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close analytics drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <aside className="relative ml-auto flex h-full w-full max-w-[min(1120px,100vw)] flex-col border-l border-dark-700 bg-dark-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-dark-700 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-dark-400">Analytics drill-down</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-dark-300">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-dark-700 px-3 py-2 text-sm text-dark-200 transition hover:border-dark-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="border-b border-dark-700 px-6 py-4">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-dark-700 bg-dark-800 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-dark-500">Records</p>
              <p className="mt-1 text-lg font-semibold text-white">{total.toLocaleString()}</p>
            </div>
            {meta.summaryKeys?.map((item) => {
              const value = summary?.[item.key];
              return (
                <div key={item.key} className="rounded-xl border border-dark-700 bg-dark-800 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-dark-500">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {item.kind === 'money'
                      ? money(value)
                      : item.kind === 'count'
                        ? Number(value || 0).toLocaleString()
                        : humanizeValue(value, '-')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-b border-dark-700 px-6 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {meta.filters.map((filter) => (
              <label key={filter.key} className="space-y-2 text-sm">
                <span className="block text-xs uppercase tracking-[0.18em] text-dark-400">{filter.label}</span>
                {filter.type === 'select' ? (
                  <select
                    value={draftFilters[filter.key] || ''}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
                    className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white"
                  >
                    {filter.options?.map((option) => (
                      <option key={option.value || 'all'} value={option.value} className="bg-dark-900">
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={filter.type === 'date' ? 'date' : 'text'}
                    value={draftFilters[filter.key] || ''}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
                    placeholder={filter.placeholder}
                    className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white placeholder:text-dark-500"
                  />
                )}
              </label>
            ))}

            <label className="space-y-2 text-sm">
              <span className="block text-xs uppercase tracking-[0.18em] text-dark-400">From</span>
              <input
                type="date"
                value={draftFilters.startDate || ''}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="block text-xs uppercase tracking-[0.18em] text-dark-400">To</span>
              <input
                type="date"
                value={draftFilters.endDate || ''}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-dark-700 px-4 py-2 text-sm text-dark-200 transition hover:border-dark-500 hover:text-white"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || rows.length === 0}
              className="rounded-lg border border-emerald-600/60 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-500 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <div className="ml-auto flex items-center gap-2 text-sm text-dark-400">
              <span>Rows per page</span>
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(parseInt(event.target.value, 10));
                  setPage(1);
                }}
                className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-dark-700">
            <table className="admin-table">
              <thead>
                <tr>
                  {meta.columns.map((column) => (
                    <th key={column.key} className={column.align === 'right' ? 'text-right' : undefined}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={meta.columns.length} className="py-10 text-center text-dark-400">
                      Loading analytics records...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={meta.columns.length} className="py-10 text-center text-dark-400">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      {meta.columns.map((column) => (
                        <td key={column.key} className={column.align === 'right' ? 'text-right' : undefined}>
                          {column.render ? column.render(row) : row[column.field] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-dark-700 px-6 py-4 text-sm text-dark-400">
          <div>
            Showing page {page} of {totalPages} · {total.toLocaleString()} records
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-dark-700 px-4 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-dark-700 px-4 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
