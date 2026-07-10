import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, FileText, Printer, RefreshCw, Sparkles, TrendingUp, Users, CreditCard, Package, BadgeInfo, AlertTriangle, Filter, Clock } from 'lucide-react';
import {
  BIChartContainer,
  BIDataTable,
  BIDetailsDrawer,
  BIKpiCards,
  BIReportFilters,
  BIReportShell,
  BIReportToolbar,
  BIPagination,
} from '../bi';
import {
  buildExportFileName,
  downloadCsv,
  downloadTextFile,
  resolveBIDateRange,
  serializeRowsToCsv,
  useBIColumnPreferences,
  useBISavedViews,
} from '../../lib/bi';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import { createSalesOverviewReportDefinition, type SalesOverviewTableRow } from '../../lib/bi/reports/salesOverview';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type SalesOverviewRow = SalesOverviewTableRow & {
  category?: string;
  refundMode?: string;
  sourceRow?: any;
};

interface SalesOverviewReportProps {
  lang: Language;
}

type SalesOverviewPayload = {
  summary?: any;
  sales?: any;
  customers?: any;
  employees?: any;
  services?: any;
  products?: any;
  payments?: any;
  finance?: any;
  performance?: any;
  executive?: any;
};

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : 0;
  return `${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;
}

function formatDate(value: unknown, lang: Language): string {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(lang === 'ar' ? 'ar-SA' : undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toOption(label: unknown, value: unknown): BIOption | null {
  const nextLabel = `${label ?? ''}`.trim();
  const nextValue = `${value ?? ''}`.trim();
  if (!nextLabel || !nextValue) return null;
  return { label: nextLabel, value: nextValue };
}

function buildSeriesPoints(rows: any[], valueKey: string, labelKey = 'date') {
  const values = rows.map((row) => Number(row?.[valueKey] || 0));
  const max = Math.max(...values, 1);
  const width = Math.max(rows.length - 1, 1);
  const points = rows.map((row, index) => {
    const x = (index / width) * 100;
    const y = 100 - ((Number(row?.[valueKey] || 0) / max) * 80 + 10);
    return `${x},${y}`;
  }).join(' ');

  return { points, max, values, labels: rows.map((row) => row?.[labelKey] || '-') };
}

function MiniLineChart({
  rows,
  valueKey,
  labelKey = 'date',
}: {
  rows: any[];
  valueKey: string;
  labelKey?: string;
}) {
  const series = buildSeriesPoints(rows, valueKey, labelKey);
  if (!rows.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">No chart data.</div>;
  }

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient id="sales-line-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#sales-line-gradient)"
          stroke="#0f172a"
          strokeWidth="1.8"
          points={`0,100 ${series.points} 100,100`}
        />
        {series.points.split(' ').filter(Boolean).map((point, index) => {
          const [x, y] = point.split(',').map(Number);
          return <circle key={`${point}-${index}`} cx={x} cy={y} r="1.7" fill="#0f172a" />;
        })}
        <line x1="0" y1="90" x2="100" y2="90" stroke="#e2e8f0" strokeWidth="0.7" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="0.7" />
      </svg>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.slice(-8).map((row, index) => (
          <div key={`${row?.[labelKey] || index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-semibold text-slate-500">{`${row?.[labelKey] || '-'}`}</div>
            <div className="mt-1 text-sm font-black text-slate-900">{Number(row?.[valueKey] || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBarChart({
  rows,
  labelKey,
  valueKey,
}: {
  rows: any[];
  labelKey: string;
  valueKey: string;
}) {
  if (!rows.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">No chart data.</div>;
  }

  const max = Math.max(...rows.map((row) => Number(row?.[valueKey] || 0)), 1);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.slice(0, 6).map((row, index) => {
          const value = Number(row?.[valueKey] || 0);
          const width = `${Math.max((value / max) * 100, 4)}%`;
          return (
            <div key={`${row?.[labelKey] || index}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-slate-700">{`${row?.[labelKey] || '-'}`}</span>
                <span className="font-bold text-slate-500">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-500">{icon}</span> : null}
          <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
        </div>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}

function SectionBlock({
  title,
  children,
  description,
  icon,
}: {
  title: string;
  children: ReactNode;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader title={title} description={description} icon={icon} />
      {children}
    </section>
  );
}

function buildDrawerPairs(row: SalesOverviewRow | null) {
  if (!row) return [];
  return [
    { label: 'Sale Number', value: row.saleNumber },
    { label: 'Invoice Number', value: row.invoiceNumber },
    { label: 'Sale Date', value: formatDate(row.saleDate, 'en') },
    { label: 'Customer', value: row.customer },
    { label: 'Employee', value: row.employee },
    { label: 'Channel', value: row.channel },
    { label: 'Items', value: row.items },
    { label: 'Gross Sales', value: row.grossSales == null ? '-' : formatMoney(row.grossSales, 'en') },
    { label: 'Discounts', value: row.discount == null ? '-' : formatMoney(row.discount, 'en') },
    { label: 'Taxes', value: row.vat == null ? '-' : formatMoney(row.vat, 'en') },
    { label: 'Refund', value: row.refund == null ? '-' : formatMoney(row.refund, 'en') },
    { label: 'Net Sales', value: row.netSales == null ? '-' : formatMoney(row.netSales, 'en') },
    { label: 'Payment Method', value: row.paymentMethod },
    { label: 'Payment Status', value: row.paymentStatus },
    { label: 'Sale Status', value: row.saleStatus },
    { label: 'Notes', value: row.notes || '-' },
  ];
}

function buildPrintHtml({
  title,
  description,
  rows,
  columns,
  lang,
}: {
  title: string;
  description: string;
  rows: SalesOverviewRow[];
  columns: any[];
  lang: Language;
}) {
  const thead = columns.map((column) => `<th>${column.header}</th>`).join('');
  const tbody = rows.map((row) => {
    const cells = columns.map((column) => {
      const rawValue = typeof column.accessor === 'function'
        ? column.accessor(row)
        : row[column.accessor as keyof SalesOverviewRow];
      const text = typeof rawValue === 'number'
        ? formatMoney(rawValue, lang)
        : `${rawValue ?? '-'}`;
      return `<td>${text}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 16px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <table>
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </body>
    </html>
  `;
}

export default function SalesOverviewReport({ lang }: SalesOverviewReportProps) {
  const isRtl = lang === 'ar';
  const reportId = 'sales-overview';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SalesOverviewPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'saleDate', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    employee: '',
    service: '',
    paymentMethod: '',
    category: '',
    status: '',
    refundOnly: false,
    grossSalesRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<SalesOverviewRow | null>(null);

  const definitionOptions = useMemo(() => {
    const employeeOptions = [
      { label: isRtl ? 'جميع الموظفين' : 'All Employees', value: '' },
      ...(report.employees?.performance || report.employees?.revenue || [])
        .map((item: any) => toOption(item.name || item.nameEn || item.nameAr || item.id, item.name || item.nameEn || item.nameAr || item.id))
        .filter(Boolean) as BIOption[]
    ];

    const serviceOptions = [
      { label: isRtl ? 'جميع الخدمات' : 'All Services', value: '' },
      ...(report.services?.performance || report.services?.revenue || [])
        .map((item: any) => toOption(item.name_en || item.nameEn || item.name || item.id, item.name_en || item.nameEn || item.name || item.id))
        .filter(Boolean) as BIOption[]
    ];

    const paymentMethodOptions = [
      { label: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods', value: '' },
      ...(report.payments?.methods?.rows || [])
        .map((item: any) => toOption(item.paymentMethodLabel || item.paymentMethod || item.id, item.paymentMethod || item.id))
        .filter(Boolean) as BIOption[]
    ];

    const categoryOptions = [
      { label: isRtl ? 'جميع التصنيفات' : 'All Categories', value: '' },
      ...(report.services?.performance || report.services?.revenue || [])
        .map((item: any) => toOption(item.category || item.categoryEn || item.categoryAr || '-', item.category || item.categoryEn || item.categoryAr || '-'))
        .filter(Boolean) as BIOption[]
    ];

    const statusOptions = [
      { label: isRtl ? 'جميع الحالات' : 'All Statuses', value: '' },
      ...Array.from(
        new Set(
          (buildSalesRows(report).map((row) => row.saleStatus).filter(Boolean) as string[])
            .map((item) => item.trim())
        )
      ).map((value) => ({ label: value, value }))
    ];

    return {
      employees: employeeOptions,
      services: serviceOptions,
      paymentMethods: paymentMethodOptions,
      categories: categoryOptions,
      statuses: statusOptions,
    };
  }, [isRtl, report]);

  const reportDefinition = useMemo(
    () =>
      createSalesOverviewReportDefinition({
        employees: definitionOptions.employees,
        services: definitionOptions.services,
        paymentMethods: definitionOptions.paymentMethods,
        categories: definitionOptions.categories,
        statuses: definitionOptions.statuses,
      }),
    [definitionOptions]
  );
  const reportTitle = String(reportDefinition.title || 'Sales Overview');
  const reportDescription = String(reportDefinition.description || '');

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, reportDefinition.columns || []);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  function buildSalesRows(data: SalesOverviewPayload): SalesOverviewRow[] {
    const revenueRows = Array.isArray(data.finance?.ledger?.revenueLedger?.rows)
      ? data.finance.ledger.revenueLedger.rows
      : [];
    const refundRows = Array.isArray(data.finance?.ledger?.refundLedger?.rows)
      ? data.finance.ledger.refundLedger.rows
      : [];
    const refundByReference = new Map<string, any>();
    refundRows.forEach((refund: any) => {
      const key = `${refund?.reference || refund?.id || ''}`.trim();
      if (key) refundByReference.set(key, refund);
    });

    const serviceCategoryLookup = new Map<string, string>();
    (data.services?.performance || data.services?.revenue || []).forEach((service: any) => {
      const serviceName = `${service?.name_en || service?.nameEn || service?.name || ''}`.trim().toLowerCase();
      const category = `${service?.category || service?.categoryEn || service?.categoryAr || '-'}`.trim() || '-';
      if (serviceName) serviceCategoryLookup.set(serviceName, category);
    });

    return revenueRows.map((row: any) => {
      const reference = `${row?.reference || row?.saleNumber || row?.id || '-'}`.trim();
      const refund = refundByReference.get(reference) || refundByReference.get(`${row?.id || ''}`.trim()) || null;
      const saleDate = row?.date || row?.processedAt || row?.createdAt || '';
      const items = `${row?.service || row?.entityLabel || row?.items || '-'}`.trim() || '-';
      const category = serviceCategoryLookup.get(items.toLowerCase()) || '-';
      const grossSales = row?.grossSales ?? row?.revenue ?? null;
      const discount = row?.discount ?? null;
      const vat = row?.tax ?? null;
      const refundAmount = refund?.amount ?? row?.refund ?? null;
      const netSales = row?.netSales ?? null;
      const paymentMethod = `${row?.paymentMethodLabel || row?.paymentMethod || '-'}`.trim() || '-';
      const saleStatus = `${row?.saleStatus || row?.status || '-'}`.trim() || '-';
      const paymentStatus = `${row?.paymentStatus || row?.status || saleStatus}`.trim() || '-';

      return {
        id: String(row?.id || reference),
        saleNumber: reference,
        invoiceNumber: `${row?.invoiceNumber || row?.reference || '-'}`.trim() || '-',
        saleDate,
        customer: `${row?.customer || '-'}`.trim() || '-',
        employee: `${row?.employee || '-'}`.trim() || '-',
        channel: `${row?.channel || row?.entityType || '-'}`.trim() || '-',
        items,
        grossSales: grossSales === null || grossSales === undefined ? null : Number(grossSales),
        discount: discount === null || discount === undefined ? null : Number(discount),
        vat: vat === null || vat === undefined ? null : Number(vat),
        refund: refundAmount === null || refundAmount === undefined ? null : Number(refundAmount),
        netSales: netSales === null || netSales === undefined ? null : Number(netSales),
        paymentMethod,
        paymentStatus,
        saleStatus,
        category,
        refundMode: refund?.refundMode || null,
        detailPath: row?.detailPath || refund?.detailPath || null,
        notes: row?.notes || refund?.reason || null,
        sourceRow: row,
      };
    });
  }

  const rows = useMemo(() => buildSalesRows(report), [report]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedService = normalizeText(filterValues.service);
    const selectedPaymentMethod = normalizeText(filterValues.paymentMethod);
    const selectedCategory = normalizeText(filterValues.category);
    const selectedStatus = normalizeText(filterValues.status);
    const refundOnly = Boolean(filterValues.refundOnly);
    const amountRange = typeof filterValues.grossSalesRange === 'object' && filterValues.grossSalesRange
      ? filterValues.grossSalesRange as { min?: string; max?: string }
      : {};
    const min = amountRange.min ? Number(amountRange.min) : null;
    const max = amountRange.max ? Number(amountRange.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.saleNumber,
          row.invoiceNumber,
          row.customer,
          row.employee,
          row.channel,
          row.items,
          row.paymentMethod,
          row.paymentStatus,
          row.saleStatus,
          row.notes,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedEmployee && normalizeText(row.employee) !== selectedEmployee) return false;
      if (selectedService && normalizeText(row.items) !== selectedService && !normalizeText(row.items).includes(selectedService)) return false;
      if (selectedPaymentMethod && normalizeText(row.paymentMethod) !== selectedPaymentMethod) return false;
      if (selectedCategory && normalizeText(row.category) !== selectedCategory) return false;
      if (selectedStatus && normalizeText(row.saleStatus) !== selectedStatus && normalizeText(row.paymentStatus) !== selectedStatus) return false;
      if (refundOnly && !(Number(row.refund || 0) > 0)) return false;

      const gross = row.grossSales;
      if (min !== null && Number.isFinite(min) && !(Number(gross ?? 0) >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(Number(gross ?? 0) <= max)) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const pageSize = reportDefinition.defaultPageSize || 8;
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        const response = await tenantApiAdapter.getSalesOverview({
          startDate: range.from,
          endDate: range.to,
          groupBy: 'day',
        });
        const payload = (response?.data || response || {}) as SalesOverviewPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sales overview.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [customDateRange, datePreset, refreshTick]);

  const summaryTotals = report.summary?.totals || {};
  const summaryMetrics = report.summary?.metrics || {};
  const salesTotals = report.sales?.totals || {};
  const financeOverview = report.finance?.overview || {};
  const paymentsRows = report.payments?.methods?.rows || [];
  const paymentTrends = report.performance?.paymentMethodTrends || [];
  const revenueTrend = report.sales?.trends?.dailyRevenue || [];
  const revenueByEmployee = report.employees?.performance || report.employees?.revenue || [];
  const revenueByService = report.services?.performance || report.services?.revenue || [];
  const revenueByCategory = report.performance?.revenueByCategory || [];
  const topEmployee = report.executive?.topEmployee || revenueByEmployee[0] || null;
  const topService = report.executive?.topService || revenueByService[0] || null;
  const topProduct = report.executive?.topProduct || report.products?.topProduct || null;
  const highestSale = report.executive?.highestSale || null;
  const bestPaymentMethod = paymentsRows[0] || null;
  const highestRevenueDay = revenueTrend.reduce((best: any, row: any) => {
    if (!best) return row;
    return Number(row?.revenue || 0) > Number(best?.revenue || 0) ? row : best;
  }, null);

  const kpiItems = [
    { id: 'revenue', label: 'Revenue', value: formatMoney(summaryTotals.revenue, lang), note: isRtl ? 'القيمة الإجمالية' : 'Gross revenue', icon: <TrendingUp size={18} /> },
    { id: 'gross-sales', label: 'Gross Sales', value: formatMoney(summaryTotals.revenue, lang), note: isRtl ? 'المبيعات قبل الخصومات' : 'Before discounts', icon: <BadgeInfo size={18} /> },
    { id: 'net-sales', label: 'Net Sales', value: formatMoney(summaryTotals.netRevenue, lang), note: isRtl ? 'بعد الخصومات' : 'After discounts', icon: <TrendingUp size={18} /> },
    { id: 'discounts', label: 'Discounts', value: formatMoney(summaryTotals.discount, lang), note: isRtl ? 'الخصومات المطبقة' : 'Applied discounts', icon: <Filter size={18} /> },
    { id: 'refunds', label: 'Refunds', value: formatMoney(report.finance?.refunds?.totals?.refundAmount || 0, lang), note: isRtl ? 'المرتجعات' : 'Refund amount', icon: <RefreshCw size={18} /> },
    { id: 'vat', label: 'VAT', value: formatMoney(summaryTotals.tax, lang), note: isRtl ? 'ضريبة القيمة المضافة' : 'Tax amount', icon: <FileText size={18} /> },
    { id: 'customers', label: 'Customers', value: Number(summaryMetrics.uniqueCustomers || report.customers?.analytics?.totalCustomers || 0).toLocaleString(), note: isRtl ? 'العملاء الفريدون' : 'Unique customers', icon: <Users size={18} /> },
    { id: 'appointments', label: 'Appointments', value: Number(summaryMetrics.appointments || 0).toLocaleString(), note: isRtl ? 'الحجوزات في المدة' : 'Appointments in range', icon: <Clock size={18} /> },
  ];

  const businessInsights = [
    { label: 'Top Employee', value: topEmployee?.name || topEmployee?.nameEn || '-' },
    { label: 'Top Service', value: topService?.name_en || topService?.nameEn || topService?.name || '-' },
    { label: 'Top Product', value: topProduct?.name_en || topProduct?.nameEn || topProduct?.name || '-' },
    { label: 'Best Payment Method', value: bestPaymentMethod?.paymentMethodLabel || bestPaymentMethod?.paymentMethod || '-' },
    { label: 'Highest Sale', value: highestSale ? formatMoney(highestSale.revenue || highestSale.amount || 0, lang) : '-' },
    { label: 'Average Ticket', value: formatMoney(salesTotals.averageTicket || summaryMetrics.averageTicket || 0, lang) },
    { label: 'Highest Revenue Day', value: highestRevenueDay ? `${formatDate(highestRevenueDay.date, lang)} · ${formatMoney(highestRevenueDay.revenue || 0, lang)}` : '-' },
  ];

  const backendGaps = useMemo(() => {
    const gaps = new Set<string>();
    if (rows.some((row) => row.invoiceNumber === '-' || row.invoiceNumber === row.saleNumber)) gaps.add('Invoice Number');
    if (rows.some((row) => row.channel === '-')) gaps.add('Channel');
    if (rows.some((row) => row.items === '-')) gaps.add('Items');
    if (rows.some((row) => row.grossSales == null)) gaps.add('Gross Sales');
    if (rows.some((row) => row.netSales == null)) gaps.add('Net Sales');
    if (rows.some((row) => row.refund == null)) gaps.add('Refund');
    if (rows.some((row) => row.vat == null)) gaps.add('VAT');
    return Array.from(gaps);
  }, [rows]);

  const applyQuery = (next: {
    search: string;
    datePreset: BIDatePresetValue;
    customDateRange: BIDateRange;
    filters: BIReportFilterValues;
    page: number;
    pageSize: number;
    sort: BIReportSortState;
  }) => {
    setSearch(next.search);
    setDatePreset(next.datePreset);
    setCustomDateRange(next.customDateRange);
    setFilterValues(next.filters);
    setPage(next.page);
    setSort(next.sort);
  };

  const saveCurrentView = (name: string) => {
    saveView(name, {
      search,
      datePreset,
      customDateRange,
      filters: filterValues,
      page,
      pageSize,
      sort,
    });
  };

  const exportRows = filteredRows;

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(reportTitle, 'csv'), serializeRowsToCsv(exportRows, visibleColumns));
      return;
    }

    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(reportTitle, 'excel'),
        serializeRowsToCsv(exportRows, visibleColumns),
        'application/vnd.ms-excel;charset=utf-8'
      );
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        title: reportTitle,
        description: reportDescription,
        rows: exportRows,
        columns: visibleColumns,
        lang,
      })
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      if (format !== 'print') {
        setTimeout(() => printWindow.close(), 250);
      }
    };
  };

  const filteredColumns = visibleColumns;

  return (
    <BIReportShell
      title={reportTitle}
      description={reportDescription}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar
            reportTitle={reportTitle}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={() => setRefreshTick((tick) => tick + 1)}
            rows={exportRows}
            columns={reportDefinition.columns}
            onExport={handleExport}
            onPrint={() => handleExport('print')}
            availableExports={['csv', 'excel', 'pdf', 'print']}
            datePreset={datePreset}
            onDatePresetChange={(preset) => {
              setDatePreset(preset);
              setPage(1);
            }}
            customDateRange={customDateRange}
            onCustomDateRangeChange={(next) => {
              setCustomDateRange(next);
              setPage(1);
            }}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            savedViews={savedViews}
            onSaveView={saveCurrentView}
            onLoadSavedView={(view) => applyQuery(view.query)}
            onDeleteSavedView={deleteView}
            columnState={columnState}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
          />

          {filtersOpen ? (
            <BIReportFilters
              filters={reportDefinition.filters || []}
              values={filterValues}
              onChange={(next) => {
                setFilterValues(next);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      charts={
        <div className="space-y-4">
          <SectionBlock
            title="Business Insights"
            description="Canonical backend values only. Missing values remain visible as gaps so the frontend never invents accounting logic."
            icon={<Sparkles size={18} />}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {businessInsights.map((item) => (
                <article key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{item.value}</div>
                </article>
              ))}
            </div>
          </SectionBlock>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionBlock title="Revenue Trend" description="Daily revenue from the backend." icon={<TrendingUp size={18} />}>
              <BIChartContainer>
                <MiniLineChart rows={revenueTrend} valueKey="revenue" labelKey="date" />
              </BIChartContainer>
            </SectionBlock>

            <SectionBlock title="Revenue by Employee" description="Backend performance series by staff." icon={<Users size={18} />}>
              <BIChartContainer>
                <MiniBarChart rows={revenueByEmployee} labelKey="name" valueKey="revenue" />
              </BIChartContainer>
            </SectionBlock>

            <SectionBlock title="Revenue by Service" description="Backend performance series by service." icon={<Sparkles size={18} />}>
              <BIChartContainer>
                <MiniBarChart rows={revenueByService} labelKey="name_en" valueKey="revenue" />
              </BIChartContainer>
            </SectionBlock>

            <SectionBlock title="Revenue by Payment Method" description="Canonical payment method split from the backend." icon={<CreditCard size={18} />}>
              <BIChartContainer>
                <MiniBarChart rows={paymentsRows} labelKey="paymentMethodLabel" valueKey="revenue" />
              </BIChartContainer>
            </SectionBlock>

            <SectionBlock title="Revenue by Category" description="Service category revenue from the backend." icon={<Package size={18} />}>
              <BIChartContainer>
                <MiniBarChart rows={revenueByCategory} labelKey="key" valueKey="revenue" />
              </BIChartContainer>
            </SectionBlock>
          </div>
        </div>
      }
      table={
        <SectionBlock
          title="Sales Table"
          description="Rows are driven by the BI contract. Missing backend fields are shown as placeholders and listed below."
          icon={<FileText size={18} />}
        >
          <BIDataTable<SalesOverviewRow>
            rows={paginatedRows}
            columns={filteredColumns}
            rowKey={(row) => row.id}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onRowClick={(row) => setDrawerRow(row)}
            emptyState={error ? error : 'No sales found for the selected criteria.'}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.join(', ')} are not exposed as fully populated sales-overview fields yet, so the frontend shows a placeholder instead of inventing values.
              </p>
            </div>
          ) : null}
        </SectionBlock>
      }
      pagination={
        <BIPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          totalItems={filteredRows.length}
        />
      }
      footer={
        <div className="space-y-2">
          <p>{reportDefinition.footer}</p>
          <p>{isRtl ? 'جميع القيم المالية معروضة مباشرة من backend.' : 'Every financial value is rendered directly from the backend.'}</p>
        </div>
      }
    >
      {null}
      <BIDetailsDrawer<SalesOverviewRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.saleNumber || reportTitle}
        subtitle={drawerRow?.customer || undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => {
          const pairs = buildDrawerPairs(row);
          return (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                {[
                  { title: 'General', fields: ['Sale Number', 'Invoice Number', 'Sale Date', 'Channel', 'Sale Status'] },
                  { title: 'Customer', fields: ['Customer'] },
                  { title: 'Appointment', fields: ['Employee'] },
                  { title: 'Services', fields: ['Items'] },
                  { title: 'Products', fields: ['Items'] },
                  { title: 'Discounts', fields: ['Discounts'] },
                  { title: 'Taxes', fields: ['Taxes', 'VAT'] },
                  { title: 'Payments', fields: ['Payment Method', 'Payment Status'] },
                  { title: 'Gift Cards', fields: ['Notes'] },
                  { title: 'Timeline', fields: ['Sale Date'] },
                  { title: 'Notes', fields: ['Notes'] },
                ].map((section) => (
                  <div key={section.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{section.title}</div>
                    <div className="mt-3 space-y-2">
                      {section.fields.map((label) => {
                        const pair = pairs.find((item) => item.label === label);
                        return (
                          <div key={label} className="flex items-start justify-between gap-4 text-sm">
                            <span className="text-slate-500">{label}</span>
                            <span className="text-right font-semibold text-slate-900">{pair?.value || '-'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
                <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row.sourceRow || row, null, 2)}</pre>
              </div>
            </div>
          );
        }}
      />
    </BIReportShell>
  );
}
