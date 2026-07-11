import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  ClipboardList,
  FileText,
  Filter,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  UserCheck,
  Wallet,
  BadgeInfo,
  Clock,
} from 'lucide-react';
import { BIActiveFilterSummary, BIChartContainer, BIDataTable, BIDetailsDrawer, BIKpiCards, BIReportFilters, BIReportShell, BIReportToolbar, BIPagination } from '../bi';
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
import SalesOverviewReport from './SalesOverviewReport';
import SalesListReport from './SalesListReport';
import SalesLogDetailsReport from './SalesLogDetailsReport';
import DiscountSummaryReport from './DiscountSummaryReport';
import TaxSummaryReport from './TaxSummaryReport';
import GiftCardListReport from './GiftCardListReport';
import {
  createCustomerOverviewReportDefinition,
  createEmployeePerformanceReportDefinition,
  createProductPerformanceReportDefinition,
  createServicePerformanceReportDefinition,
  type CustomerOverviewTableRow,
  type EmployeePerformanceTableRow,
  type ProductPerformanceTableRow,
  type ServicePerformanceTableRow,
} from '../../lib/bi/reports/operationsIntelligence';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportColumnDefinition, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type OperationsTab = 'sales-overview' | 'sales-list' | 'sales-log-details' | 'discount-summary' | 'tax-summary' | 'gift-card-list' | 'customer-overview' | 'employee-performance' | 'service-performance' | 'product-performance';

type OperationsFullReportPayload = {
  overview?: any;
  bookingTrends?: any[];
  customerAnalytics?: any;
  employeePerformance?: any[];
  servicePerformance?: any[];
  products?: any[];
};

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : 0;
  return `${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;
}

function formatNumber(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : '-';
}

function formatPercent(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
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

  return { points, labels: rows.map((row) => row?.[labelKey] || '-') };
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
  if (!rows.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">No chart data.</div>;
  }

  const series = buildSeriesPoints(rows, valueKey, labelKey);

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient id="ops-line-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#ops-line-gradient)"
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
          <div key={`${row?.id || row?.[labelKey] || 'row'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
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
  formatLabel,
}: {
  rows: any[];
  labelKey: string;
  valueKey: string;
  formatLabel?: (row: any) => string;
}) {
  if (!rows.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">No chart data.</div>;
  }

  const max = Math.max(...rows.map((row) => Number(row?.[valueKey] || 0)), 1);

  return (
    <div className="space-y-3">
      {rows.slice(0, 6).map((row, index) => {
        const value = Number(row?.[valueKey] || 0);
        const width = `${Math.max((value / max) * 100, 4)}%`;
        const label = formatLabel ? formatLabel(row) : `${row?.[labelKey] || '-'}`;
        return (
          <div key={`${row?.id || row?.[labelKey] || 'row'}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-slate-700">{label}</span>
              <span className="font-bold text-slate-500">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-slate-900" style={{ width }} />
            </div>
          </div>
        );
      })}
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon ? <span className="text-slate-500">{icon}</span> : null}
            <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
          </div>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
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
  rows: any[];
  columns: BIReportColumnDefinition<any>[];
  lang: Language;
}) {
  const renderValue = (row: any, column: BIReportColumnDefinition<any>) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof typeof row];
    const formatted = column.format ? column.format(rawValue, row) : rawValue;
    if (formatted === null || formatted === undefined || formatted === '') return '-';
    if (typeof formatted === 'number') return formatNumber(formatted);
    return `${formatted}`;
  };

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
          <thead>
            <tr>${columns.map((column) => `<th>${column.header}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${columns.map((column) => `<td>${renderValue(row, column)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function useOperationsReportData() {
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<OperationsFullReportPayload>({});
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        const response = await tenantApiAdapter.getFullReport(range.from, range.to, [
          'overview',
          'bookingTrends',
          'customerAnalytics',
          'employeePerformance',
          'servicePerformance',
          'products',
        ]);
        const payload = (response?.data || response || {}) as OperationsFullReportPayload;
        if (!cancelled) {
          setReport(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load operations intelligence report.');
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

  return {
    loading,
    error,
    report,
    refresh: () => setRefreshTick((tick) => tick + 1),
    datePreset,
    setDatePreset,
    customDateRange,
    setCustomDateRange,
  };
}

function formatYesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function CustomerOverviewReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'customer-overview';
  const { loading, error, report, refresh, datePreset, setDatePreset, customDateRange, setCustomDateRange } = useOperationsReportData();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'revenue', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    customerType: '',
    visitsRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<CustomerOverviewTableRow | null>(null);

  const overview = report.overview || {};
  const analytics = report.customerAnalytics || {};
  const bookingTrends = report.bookingTrends || [];

  const rows = useMemo<CustomerOverviewTableRow[]>(() => {
    const topCustomers = Array.isArray(analytics.topCustomers) ? analytics.topCustomers : [];
    const retentionRate = analytics.retentionRate == null ? null : Number(analytics.retentionRate);

    return topCustomers.map((customer: any) => {
      const visits = Number(customer?.bookings || 0);
      const customerType = visits > 1 ? 'Returning Customer' : 'New Customer';

      return {
        id: String(customer?.id || customer?.name || '-'),
        customer: String(customer?.name || customer?.customerName || '-'),
        visits,
        completedVisits: Number(customer?.completed || 0),
        revenue: Number(customer?.revenue || 0),
        firstVisit: customer?.firstVisit || '',
        lastVisit: customer?.lastVisit || '',
        customerType,
        retentionRate,
        lifetimeRevenue: null,
        notes: customerType,
      };
    });
  }, [analytics]);

  const definitionOptions = useMemo(() => {
    const customerTypes = [
      { label: isRtl ? 'جميع الأنواع' : 'All Types', value: '' },
      { label: isRtl ? 'عملاء جدد' : 'New Customers', value: 'New Customer' },
      { label: isRtl ? 'عملاء عائدون' : 'Returning Customers', value: 'Returning Customer' },
    ];

    return { customerTypes };
  }, [isRtl]);

  const reportDefinition = useMemo(
    () => createCustomerOverviewReportDefinition(definitionOptions),
    [definitionOptions]
  );

  const tableColumns = useMemo(() => reportDefinition.columns?.map((column) => {
    if (['revenue'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (['visits', 'completedVisits'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatNumber(value) };
    }
    if (['firstVisit', 'lastVisit'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatDate(value, lang) };
    }
    return column;
  }) || [], [lang, reportDefinition.columns]);

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, tableColumns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedType = normalizeText(filterValues.customerType);
    const range = typeof filterValues.visitsRange === 'object' && filterValues.visitsRange ? filterValues.visitsRange as { min?: string; max?: string } : {};
    const min = range.min ? Number(range.min) : null;
    const max = range.max ? Number(range.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [row.customer, row.customerType, row.notes].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (selectedType && normalizeText(row.customerType) !== selectedType) return false;
      if (min !== null && Number.isFinite(min) && !(Number(row.visits || 0) >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(Number(row.visits || 0) <= max)) return false;
      return true;
    });
  }, [filterValues, rows, search]);

  const pageSize = reportDefinition.defaultPageSize || 8;
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const revenueTrend = bookingTrends;
  const topCustomerRows = rows.slice().sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const totalVisits = Number(overview.totalBookings || bookingTrends.reduce((sum: number, row: any) => sum + Number(row?.bookings || 0), 0) || 0);
  const newCustomers = Number(analytics.newCustomers || 0);
  const returningCustomers = Number(analytics.returningCustomers || 0);
  const customerCount = Number(analytics.totalCustomers || rows.length || 0);
  const retentionRate = analytics.retentionRate == null ? null : Number(analytics.retentionRate);
  const topCustomer = rows[0] || null;

  const kpiItems = [
    { id: 'customers', label: 'Customers', value: customerCount.toLocaleString(), note: isRtl ? 'العملاء داخل النطاق' : 'Customers in range', icon: <Users size={18} /> },
    { id: 'new-customers', label: 'New Customers', value: newCustomers.toLocaleString(), note: isRtl ? 'أول زيارة' : 'First-time customers', icon: <Sparkles size={18} /> },
    { id: 'returning-customers', label: 'Returning Customers', value: returningCustomers.toLocaleString(), note: isRtl ? 'زيارات متكررة' : 'Repeat customers', icon: <RefreshCw size={18} /> },
    { id: 'visits', label: 'Customer Visits', value: totalVisits.toLocaleString(), note: isRtl ? 'إجمالي الزيارات' : 'Total visits', icon: <Clock size={18} /> },
    { id: 'retention', label: 'Retention Rate', value: formatPercent(retentionRate), note: isRtl ? 'نسبة الاحتفاظ' : 'Retention rate', icon: <BadgeInfo size={18} /> },
    { id: 'top-customer', label: 'Top Customer', value: topCustomer?.customer || '-', note: topCustomer ? formatMoney(topCustomer.revenue, lang) : '-', icon: <UserCheck size={18} /> },
    { id: 'lifetime-revenue', label: 'Customer Lifetime Revenue', value: '-', note: isRtl ? 'غير متاح من backend' : 'Not exposed by backend', icon: <Wallet size={18} /> },
  ];

  const backendGaps = [
    'Customer lifetime revenue',
  ];

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(String(reportDefinition.title), 'csv'), serializeRowsToCsv(filteredRows, visibleColumns));
      return;
    }
    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(String(reportDefinition.title), 'excel'),
        serializeRowsToCsv(filteredRows, visibleColumns),
        'application/vnd.ms-excel;charset=utf-8'
      );
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml({
      title: String(reportDefinition.title),
      description: String(reportDefinition.description || ''),
      rows: filteredRows,
      columns: visibleColumns,
      lang,
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      if (format !== 'print') {
        setTimeout(() => printWindow.close(), 250);
      }
    };
  };

  return (
    <BIReportShell
      title={reportDefinition.title}
      description={reportDefinition.description}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar
            reportTitle={String(reportDefinition.title)}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={refresh}
            rows={filteredRows}
            columns={tableColumns}
            onExport={handleExport}
            onPrint={() => handleExport('print')}
            availableExports={['csv', 'excel', 'pdf', 'print']}
            datePreset={datePreset}
            onDatePresetChange={(preset) => setDatePreset(preset)}
            customDateRange={customDateRange}
            onCustomDateRangeChange={(next) => setCustomDateRange(next)}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            savedViews={savedViews}
            onSaveView={(name) => saveView(name, { search, datePreset, customDateRange, filters: filterValues, page, pageSize, sort })}
            onLoadSavedView={(view) => {
              setSearch(view.query.search);
              setDatePreset(view.query.datePreset);
              setCustomDateRange(view.query.customDateRange);
              setFilterValues(view.query.filters);
              setPage(view.query.page);
              setSort(view.query.sort);
            }}
            onDeleteSavedView={deleteView}
            columnState={columnState}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
            summary={
              <BIActiveFilterSummary
                filters={reportDefinition.filters || []}
                values={filterValues}
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
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
                onFilterValuesChange={(next) => {
                  setFilterValues(next);
                  setPage(1);
                }}
              />
            }
          />

          <BIReportFilters
            open={filtersOpen}
            filters={reportDefinition.filters || []}
            values={filterValues}
            onApply={(next) => {
              setFilterValues(next);
              setPage(1);
            }}
            onReset={() => {
              setFilterValues({
                customerType: '',
                visitsRange: { min: '', max: '' },
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      charts={
        <div className="space-y-4">
          <SectionBlock title="Customer Growth" description="Canonical bookings trend from the backend." icon={<TrendingUp size={18} />}>
            <BIChartContainer>
              <MiniLineChart rows={revenueTrend} valueKey="bookings" labelKey="date" />
            </BIChartContainer>
          </SectionBlock>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionBlock title="New vs Returning Customers" description="Backend customer analytics split." icon={<Users size={18} />}>
              <BIChartContainer>
                <MiniBarChart
                  rows={[
                    { label: 'New Customers', value: newCustomers },
                    { label: 'Returning Customers', value: returningCustomers },
                  ]}
                  labelKey="label"
                  valueKey="value"
                />
              </BIChartContainer>
            </SectionBlock>

            <SectionBlock title="Top Customers" description="Customers ranked by backend revenue." icon={<UserCheck size={18} />}>
              <BIChartContainer>
                <MiniBarChart rows={topCustomerRows} labelKey="customer" valueKey="revenue" formatLabel={(row) => row.customer} />
              </BIChartContainer>
            </SectionBlock>
          </div>
        </div>
      }
      table={
        <SectionBlock title="Customer Sales Table" description="Top customers and visit metrics from the backend." icon={<FileText size={18} />}>
          <BIDataTable<CustomerOverviewTableRow>
            rows={paginatedRows}
            columns={visibleColumns}
            rowKey={(row) => row.id}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onRowClick={(row) => setDrawerRow(row)}
            emptyState={error ? error : 'No customer rows found for the selected criteria.'}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.join(', ')} are not exposed by the current backend contract, so the frontend leaves those fields blank instead of inventing values.
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
      footer={reportDefinition.footer}
    >
      <BIDetailsDrawer<CustomerOverviewTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.customer || String(reportDefinition.title)}
        subtitle={drawerRow ? `${drawerRow.visits ?? 0} visits` : undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Customer" value={row.customer} />
                  <Field label="Customer Type" value={row.customerType} />
                  <Field label="Retention Rate" value={row.retentionRate == null ? '-' : formatPercent(row.retentionRate)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Visits</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Visits" value={formatNumber(row.visits)} />
                  <Field label="Completed Visits" value={formatNumber(row.completedVisits)} />
                  <Field label="First Visit" value={formatDate(row.firstVisit, lang)} />
                  <Field label="Last Visit" value={formatDate(row.lastVisit, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Revenue</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Revenue" value={formatMoney(row.revenue, lang)} />
                  <Field label="Lifetime Revenue" value="-" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Notes</div>
                <div className="mt-3 text-sm text-slate-700">{row.notes || '-'}</div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row, null, 2)}</pre>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}

function EmployeePerformanceReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'employee-performance';
  const { loading, error, report, refresh, datePreset, setDatePreset, customDateRange, setCustomDateRange } = useOperationsReportData();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'revenue', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    revenueRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<EmployeePerformanceTableRow | null>(null);

  const overview = report.overview || {};
  const employees = Array.isArray(report.employeePerformance) ? report.employeePerformance : [];

  const rows = useMemo<EmployeePerformanceTableRow[]>(() => employees.map((employee: any) => {
    const completed = Number(employee?.completedBookings || 0);
    const total = Number(employee?.totalBookings || 0);
    return {
      id: String(employee?.id || employee?.name || '-'),
      employee: String(employee?.name || '-'),
      appointments: total,
      servicesPerformed: completed,
      revenue: Number(employee?.revenue || 0),
      averageTicket: employee?.avgBookingValue == null ? null : Number(employee.avgBookingValue),
      productivity: employee?.completionRate == null ? null : Number(employee.completionRate),
      commission: employee?.commission == null ? null : Number(employee.commission),
      completionRate: employee?.completionRate == null ? null : Number(employee.completionRate),
      noShows: null,
      cancellations: null,
      notes: 'Cancellation and no-show counts are not exposed per employee.',
    };
  }), [employees]);

  const reportDefinition = useMemo(
    () => createEmployeePerformanceReportDefinition({}),
    []
  );

  const tableColumns = useMemo(() => reportDefinition.columns?.map((column) => {
    if (['revenue', 'averageTicket', 'commission'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (['appointments', 'servicesPerformed'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatNumber(value) };
    }
    if (['productivity', 'completionRate'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatPercent(value) };
    }
    return column;
  }) || [], [lang, reportDefinition.columns]);

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, tableColumns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const range = typeof filterValues.revenueRange === 'object' && filterValues.revenueRange ? filterValues.revenueRange as { min?: string; max?: string } : {};
    const min = range.min ? Number(range.min) : null;
    const max = range.max ? Number(range.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [row.employee, row.notes].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (min !== null && Number.isFinite(min) && !(Number(row.revenue || 0) >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(Number(row.revenue || 0) <= max)) return false;
      return true;
    });
  }, [filterValues, rows, search]);

  const pageSize = reportDefinition.defaultPageSize || 8;
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const revenueByEmployee = rows.slice().sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const appointmentsByEmployee = rows.slice().sort((a, b) => Number(b.appointments || 0) - Number(a.appointments || 0));
  const productivityByEmployee = rows.slice().sort((a, b) => Number(b.productivity || 0) - Number(a.productivity || 0));
  const totalAppointments = Number(overview.totalBookings || rows.reduce((sum, row) => sum + Number(row.appointments || 0), 0) || 0);
  const totalCompleted = Number(overview.completedBookings || rows.reduce((sum, row) => sum + Number(row.servicesPerformed || 0), 0) || 0);
  const completionRate = overview.completionRate == null ? null : Number(overview.completionRate);
  const topEmployee = rows[0] || null;

  const kpiItems = [
    { id: 'revenue', label: 'Revenue', value: formatMoney(rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0), lang), note: isRtl ? 'إجمالي الإيراد' : 'Total revenue', icon: <TrendingUp size={18} /> },
    { id: 'appointments', label: 'Appointments', value: totalAppointments.toLocaleString(), note: isRtl ? 'إجمالي المواعيد' : 'Total appointments', icon: <Clock size={18} /> },
    { id: 'services', label: 'Services Performed', value: totalCompleted.toLocaleString(), note: isRtl ? 'المنجز فعلياً' : 'Completed bookings', icon: <Sparkles size={18} /> },
    { id: 'average-ticket', label: 'Average Ticket', value: formatMoney(overview.avgBookingValue ?? topEmployee?.averageTicket, lang), note: isRtl ? 'متوسط القيمة' : 'Average booking value', icon: <BadgeInfo size={18} /> },
    { id: 'productivity', label: 'Productivity', value: formatPercent(completionRate), note: isRtl ? 'معدل الإنجاز' : 'Completion rate', icon: <UserCheck size={18} /> },
    { id: 'cancellations', label: 'Cancellations / No-shows', value: '-', note: isRtl ? 'غير متاح لكل موظف' : 'Per-employee breakdown not exposed', icon: <RefreshCw size={18} /> },
  ];

  const backendGaps = [
    'Per-employee cancellation counts',
    'Per-employee no-show counts',
  ];

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(String(reportDefinition.title), 'csv'), serializeRowsToCsv(filteredRows, visibleColumns));
      return;
    }
    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(String(reportDefinition.title), 'excel'),
        serializeRowsToCsv(filteredRows, visibleColumns),
        'application/vnd.ms-excel;charset=utf-8'
      );
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml({
      title: String(reportDefinition.title),
      description: String(reportDefinition.description || ''),
      rows: filteredRows,
      columns: visibleColumns,
      lang,
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      if (format !== 'print') {
        setTimeout(() => printWindow.close(), 250);
      }
    };
  };

  return (
    <BIReportShell
      title={reportDefinition.title}
      description={reportDefinition.description}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar
            reportTitle={String(reportDefinition.title)}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={refresh}
            rows={filteredRows}
            columns={tableColumns}
            onExport={handleExport}
            onPrint={() => handleExport('print')}
            availableExports={['csv', 'excel', 'pdf', 'print']}
            datePreset={datePreset}
            onDatePresetChange={(preset) => setDatePreset(preset)}
            customDateRange={customDateRange}
            onCustomDateRangeChange={(next) => setCustomDateRange(next)}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            savedViews={savedViews}
            onSaveView={(name) => saveView(name, { search, datePreset, customDateRange, filters: filterValues, page, pageSize, sort })}
            onLoadSavedView={(view) => {
              setSearch(view.query.search);
              setDatePreset(view.query.datePreset);
              setCustomDateRange(view.query.customDateRange);
              setFilterValues(view.query.filters);
              setPage(view.query.page);
              setSort(view.query.sort);
            }}
            onDeleteSavedView={deleteView}
            columnState={columnState}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
            summary={
              <BIActiveFilterSummary
                filters={reportDefinition.filters || []}
                values={filterValues}
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
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
                onFilterValuesChange={(next) => {
                  setFilterValues(next);
                  setPage(1);
                }}
              />
            }
          />

          <BIReportFilters
            open={filtersOpen}
            filters={reportDefinition.filters || []}
            values={filterValues}
            onApply={(next) => {
              setFilterValues(next);
              setPage(1);
            }}
            onReset={() => {
              setFilterValues({
                revenueRange: { min: '', max: '' },
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      charts={
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionBlock title="Revenue by Employee" description="Backend revenue distribution." icon={<TrendingUp size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={revenueByEmployee} labelKey="employee" valueKey="revenue" formatLabel={(row) => row.employee} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Appointments by Employee" description="Backend appointment counts." icon={<Clock size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={appointmentsByEmployee} labelKey="employee" valueKey="appointments" formatLabel={(row) => row.employee} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Productivity" description="Completion rate by employee." icon={<UserCheck size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={productivityByEmployee} labelKey="employee" valueKey="productivity" formatLabel={(row) => row.employee} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Cancellation / No-show Statistics" description="Backend gap for per-employee status breakdowns." icon={<RefreshCw size={18} />}>
            <BIChartContainer>
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Per-employee cancellation and no-show counts are not exposed by the backend contract yet.
              </div>
            </BIChartContainer>
          </SectionBlock>
        </div>
      }
      table={
        <SectionBlock title="Performance Table" description="Backend employee performance rows." icon={<FileText size={18} />}>
          <BIDataTable<EmployeePerformanceTableRow>
            rows={paginatedRows}
            columns={visibleColumns}
            rowKey={(row) => row.id}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onRowClick={(row) => setDrawerRow(row)}
            emptyState={error ? error : 'No employee rows found for the selected criteria.'}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.join(', ')} are not exposed per employee in the current backend payload.
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
      footer={reportDefinition.footer}
    >
      <BIDetailsDrawer<EmployeePerformanceTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.employee || String(reportDefinition.title)}
        subtitle={drawerRow ? `${drawerRow.appointments ?? 0} appointments` : undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Employee" value={row.employee} />
                  <Field label="Appointments" value={formatNumber(row.appointments)} />
                  <Field label="Services Performed" value={formatNumber(row.servicesPerformed)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Performance</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Revenue" value={formatMoney(row.revenue, lang)} />
                  <Field label="Average Ticket" value={formatMoney(row.averageTicket, lang)} />
                  <Field label="Productivity" value={formatPercent(row.productivity)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Finance</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Commission" value={formatMoney(row.commission, lang)} />
                  <Field label="Completion Rate" value={formatPercent(row.completionRate)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Gap</div>
                <div className="mt-3 text-sm text-slate-700">
                  Cancellation and no-show counts are not exposed per employee yet.
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row, null, 2)}</pre>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}

function ServicePerformanceReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'service-performance';
  const { loading, error, report, refresh, datePreset, setDatePreset, customDateRange, setCustomDateRange } = useOperationsReportData();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'revenue', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    category: '',
    quantityRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<ServicePerformanceTableRow | null>(null);

  const services = Array.isArray(report.servicePerformance) ? report.servicePerformance : [];
  const overview = report.overview || {};

  const rows = useMemo<ServicePerformanceTableRow[]>(() => services.map((service: any) => ({
    id: String(service?.id || service?.name_en || service?.name_ar || '-'),
    service: String(service?.name_en || service?.name_ar || service?.name || '-'),
    category: String(service?.category || '-'),
    quantitySold: Number(service?.totalBookings || 0),
    revenue: Number(service?.revenue || 0),
    averagePrice: service?.avgRevenue == null ? null : Number(service.avgRevenue),
    completedBookings: Number(service?.completedBookings || 0),
    completionRate: service?.completionRate == null ? null : Number(service.completionRate),
    notes: 'Service trends are not exposed as a time series by the backend contract.',
  })), [services]);

  const definitionOptions = useMemo(() => {
    const categories = [
      { label: isRtl ? 'جميع التصنيفات' : 'All Categories', value: '' },
      ...Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).map((value) => ({ label: value, value })),
    ];
    return { categories };
  }, [isRtl, rows]);

  const reportDefinition = useMemo(
    () => createServicePerformanceReportDefinition(definitionOptions),
    [definitionOptions]
  );

  const tableColumns = useMemo(() => reportDefinition.columns?.map((column) => {
    if (['revenue', 'averagePrice'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (['quantitySold', 'completedBookings'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatNumber(value) };
    }
    if (['completionRate'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatPercent(value) };
    }
    return column;
  }) || [], [lang, reportDefinition.columns]);

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, tableColumns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedCategory = normalizeText(filterValues.category);
    const range = typeof filterValues.quantityRange === 'object' && filterValues.quantityRange ? filterValues.quantityRange as { min?: string; max?: string } : {};
    const min = range.min ? Number(range.min) : null;
    const max = range.max ? Number(range.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [row.service, row.category, row.notes].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (selectedCategory && normalizeText(row.category) !== selectedCategory) return false;
      if (min !== null && Number.isFinite(min) && !(Number(row.quantitySold || 0) >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(Number(row.quantitySold || 0) <= max)) return false;
      return true;
    });
  }, [filterValues, rows, search]);

  const pageSize = reportDefinition.defaultPageSize || 8;
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const revenueRows = rows.slice().sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const quantityRows = rows.slice().sort((a, b) => Number(b.quantitySold || 0) - Number(a.quantitySold || 0));
  const completionRows = rows.slice().sort((a, b) => Number(b.completionRate || 0) - Number(a.completionRate || 0));
  const totalServices = rows.reduce((sum, row) => sum + Number(row.quantitySold || 0), 0);
  const topService = rows[0] || null;
  const averagePrice = topService?.averagePrice;

  const kpiItems = [
    { id: 'revenue', label: 'Revenue', value: formatMoney(rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0), lang), note: isRtl ? 'إجمالي الإيراد' : 'Total revenue', icon: <TrendingUp size={18} /> },
    { id: 'quantity', label: 'Quantity Sold', value: totalServices.toLocaleString(), note: isRtl ? 'الطلبات المنفذة' : 'Sold quantity', icon: <Package size={18} /> },
    { id: 'avg-price', label: 'Average Price', value: averagePrice == null ? '-' : formatMoney(averagePrice, lang), note: isRtl ? 'متوسط السعر من backend' : 'Backend average price', icon: <BadgeInfo size={18} /> },
    { id: 'top-service', label: 'Top Service', value: topService?.service || '-', note: topService ? formatMoney(topService.revenue, lang) : '-', icon: <Sparkles size={18} /> },
    { id: 'completion-rate', label: 'Completion Rate', value: formatPercent(overview.completionRate), note: isRtl ? 'معدل الإكمال العام' : 'Overall completion rate', icon: <UserCheck size={18} /> },
    { id: 'service-trend', label: 'Service Trends', value: '-', note: isRtl ? 'غير متاح كسلسلة زمنية' : 'No backend time series', icon: <TrendingUp size={18} /> },
  ];

  const backendGaps = [
    'Service trend time series',
  ];

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(String(reportDefinition.title), 'csv'), serializeRowsToCsv(filteredRows, visibleColumns));
      return;
    }
    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(String(reportDefinition.title), 'excel'),
        serializeRowsToCsv(filteredRows, visibleColumns),
        'application/vnd.ms-excel;charset=utf-8'
      );
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml({
      title: String(reportDefinition.title),
      description: String(reportDefinition.description || ''),
      rows: filteredRows,
      columns: visibleColumns,
      lang,
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      if (format !== 'print') {
        setTimeout(() => printWindow.close(), 250);
      }
    };
  };

  return (
    <BIReportShell
      title={reportDefinition.title}
      description={reportDefinition.description}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar
            reportTitle={String(reportDefinition.title)}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={refresh}
            rows={filteredRows}
            columns={tableColumns}
            onExport={handleExport}
            onPrint={() => handleExport('print')}
            availableExports={['csv', 'excel', 'pdf', 'print']}
            datePreset={datePreset}
            onDatePresetChange={(preset) => setDatePreset(preset)}
            customDateRange={customDateRange}
            onCustomDateRangeChange={(next) => setCustomDateRange(next)}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            savedViews={savedViews}
            onSaveView={(name) => saveView(name, { search, datePreset, customDateRange, filters: filterValues, page, pageSize, sort })}
            onLoadSavedView={(view) => {
              setSearch(view.query.search);
              setDatePreset(view.query.datePreset);
              setCustomDateRange(view.query.customDateRange);
              setFilterValues(view.query.filters);
              setPage(view.query.page);
              setSort(view.query.sort);
            }}
            onDeleteSavedView={deleteView}
            columnState={columnState}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
            summary={
              <BIActiveFilterSummary
                filters={reportDefinition.filters || []}
                values={filterValues}
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
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
                onFilterValuesChange={(next) => {
                  setFilterValues(next);
                  setPage(1);
                }}
              />
            }
          />

          <BIReportFilters
            open={filtersOpen}
            filters={reportDefinition.filters || []}
            values={filterValues}
            onApply={(next) => {
              setFilterValues(next);
              setPage(1);
            }}
            onReset={() => {
              setFilterValues({
                category: '',
                quantityRange: { min: '', max: '' },
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      charts={
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionBlock title="Revenue by Service" description="Backend service revenue ranking." icon={<TrendingUp size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={revenueRows} labelKey="service" valueKey="revenue" formatLabel={(row) => row.service} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Quantity Sold" description="Backend booking counts per service." icon={<Package size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={quantityRows} labelKey="service" valueKey="quantitySold" formatLabel={(row) => row.service} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Completion Rate" description="Backend completion rates per service." icon={<UserCheck size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={completionRows} labelKey="service" valueKey="completionRate" formatLabel={(row) => row.service} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Service Trends" description="Time-series service trends are not exposed by the backend." icon={<TrendingUp size={18} />}>
            <BIChartContainer>
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                The backend provides service totals and completion metrics, but not a service-by-day trend series.
              </div>
            </BIChartContainer>
          </SectionBlock>
        </div>
      }
      table={
        <SectionBlock title="Service Table" description="Canonical service performance rows." icon={<FileText size={18} />}>
          <BIDataTable<ServicePerformanceTableRow>
            rows={paginatedRows}
            columns={visibleColumns}
            rowKey={(row) => row.id}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onRowClick={(row) => setDrawerRow(row)}
            emptyState={error ? error : 'No service rows found for the selected criteria.'}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.join(', ')} are not available in the current backend payload.
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
      footer={reportDefinition.footer}
    >
      <BIDetailsDrawer<ServicePerformanceTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.service || String(reportDefinition.title)}
        subtitle={drawerRow ? drawerRow.category : undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Service" value={row.service} />
                  <Field label="Category" value={row.category} />
                  <Field label="Quantity Sold" value={formatNumber(row.quantitySold)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Revenue</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Revenue" value={formatMoney(row.revenue, lang)} />
                  <Field label="Average Price" value={row.averagePrice == null ? '-' : formatMoney(row.averagePrice, lang)} />
                  <Field label="Completed Bookings" value={formatNumber(row.completedBookings)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Completion</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Completion Rate" value={formatPercent(row.completionRate)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Gap</div>
                <div className="mt-3 text-sm text-slate-700">
                  Service-by-day trend data is not exposed by the backend yet.
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row, null, 2)}</pre>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}

function ProductPerformanceReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'product-performance';
  const { loading, error, report, refresh, datePreset, setDatePreset, customDateRange, setCustomDateRange } = useOperationsReportData();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'revenue', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    category: '',
    revenueRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<ProductPerformanceTableRow | null>(null);

  const products = Array.isArray(report.products) ? report.products : [];

  const rows = useMemo<ProductPerformanceTableRow[]>(() => products.map((product: any) => ({
    id: String(product?.id || product?.name_en || product?.name_ar || '-'),
    product: String(product?.name_en || product?.name_ar || product?.name || '-'),
    category: String(product?.category || '-'),
    orders: Number(product?.totalOrders || 0),
    quantitySold: Number(product?.totalQuantity || 0),
    revenue: Number(product?.totalRevenue || 0),
    averagePrice: null,
    platformFees: Number(product?.totalPlatformFees || 0),
    tenantRevenue: Number(product?.totalTenantRevenue || 0),
    inventoryImpact: null,
    notes: 'Average sold price and inventory impact are not exposed by the backend contract.',
  })), [products]);

  const definitionOptions = useMemo(() => {
    const categories = [
      { label: isRtl ? 'جميع التصنيفات' : 'All Categories', value: '' },
      ...Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).map((value) => ({ label: value, value })),
    ];
    return { categories };
  }, [isRtl, rows]);

  const reportDefinition = useMemo(
    () => createProductPerformanceReportDefinition(definitionOptions),
    [definitionOptions]
  );

  const tableColumns = useMemo(() => reportDefinition.columns?.map((column) => {
    if (['revenue', 'averagePrice', 'platformFees', 'tenantRevenue'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (['orders', 'quantitySold'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatNumber(value) };
    }
    return column;
  }) || [], [lang, reportDefinition.columns]);

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, tableColumns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedCategory = normalizeText(filterValues.category);
    const range = typeof filterValues.revenueRange === 'object' && filterValues.revenueRange ? filterValues.revenueRange as { min?: string; max?: string } : {};
    const min = range.min ? Number(range.min) : null;
    const max = range.max ? Number(range.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [row.product, row.category, row.notes].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (selectedCategory && normalizeText(row.category) !== selectedCategory) return false;
      if (min !== null && Number.isFinite(min) && !(Number(row.revenue || 0) >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(Number(row.revenue || 0) <= max)) return false;
      return true;
    });
  }, [filterValues, rows, search]);

  const pageSize = reportDefinition.defaultPageSize || 8;
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const revenueRows = rows.slice().sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const quantityRows = rows.slice().sort((a, b) => Number(b.quantitySold || 0) - Number(a.quantitySold || 0));
  const tenantRevenueRows = rows.slice().sort((a, b) => Number(b.tenantRevenue || 0) - Number(a.tenantRevenue || 0));
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantitySold || 0), 0);
  const topProduct = rows[0] || null;

  const kpiItems = [
    { id: 'revenue', label: 'Product Revenue', value: formatMoney(totalRevenue, lang), note: isRtl ? 'إجمالي الإيراد' : 'Total revenue', icon: <TrendingUp size={18} /> },
    { id: 'quantity', label: 'Quantity Sold', value: totalQuantity.toLocaleString(), note: isRtl ? 'كمية الوحدات' : 'Units sold', icon: <Package size={18} /> },
    { id: 'orders', label: 'Orders', value: rows.reduce((sum, row) => sum + Number(row.orders || 0), 0).toLocaleString(), note: isRtl ? 'عدد الطلبات' : 'Order count', icon: <CreditCard size={18} /> },
    { id: 'tenant-revenue', label: 'Tenant Revenue', value: formatMoney(rows.reduce((sum, row) => sum + Number(row.tenantRevenue || 0), 0), lang), note: isRtl ? 'إيراد المنصة' : 'Tenant share', icon: <Wallet size={18} /> },
    { id: 'top-product', label: 'Top Product', value: topProduct?.product || '-', note: topProduct ? formatMoney(topProduct.revenue, lang) : '-', icon: <Sparkles size={18} /> },
    { id: 'inventory-impact', label: 'Inventory Impact', value: '-', note: isRtl ? 'غير متاح من backend' : 'Not exposed by backend', icon: <AlertTriangle size={18} /> },
  ];

  const backendGaps = [
    'Average price per sold unit',
    'Inventory impact',
    'Product trend time series',
  ];

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(String(reportDefinition.title), 'csv'), serializeRowsToCsv(filteredRows, visibleColumns));
      return;
    }
    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(String(reportDefinition.title), 'excel'),
        serializeRowsToCsv(filteredRows, visibleColumns),
        'application/vnd.ms-excel;charset=utf-8'
      );
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml({
      title: String(reportDefinition.title),
      description: String(reportDefinition.description || ''),
      rows: filteredRows,
      columns: visibleColumns,
      lang,
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      if (format !== 'print') {
        setTimeout(() => printWindow.close(), 250);
      }
    };
  };

  return (
    <BIReportShell
      title={reportDefinition.title}
      description={reportDefinition.description}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar
            reportTitle={String(reportDefinition.title)}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={refresh}
            rows={filteredRows}
            columns={tableColumns}
            onExport={handleExport}
            onPrint={() => handleExport('print')}
            availableExports={['csv', 'excel', 'pdf', 'print']}
            datePreset={datePreset}
            onDatePresetChange={(preset) => setDatePreset(preset)}
            customDateRange={customDateRange}
            onCustomDateRangeChange={(next) => setCustomDateRange(next)}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            savedViews={savedViews}
            onSaveView={(name) => saveView(name, { search, datePreset, customDateRange, filters: filterValues, page, pageSize, sort })}
            onLoadSavedView={(view) => {
              setSearch(view.query.search);
              setDatePreset(view.query.datePreset);
              setCustomDateRange(view.query.customDateRange);
              setFilterValues(view.query.filters);
              setPage(view.query.page);
              setSort(view.query.sort);
            }}
            onDeleteSavedView={deleteView}
            columnState={columnState}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
            summary={
              <BIActiveFilterSummary
                filters={reportDefinition.filters || []}
                values={filterValues}
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
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
                onFilterValuesChange={(next) => {
                  setFilterValues(next);
                  setPage(1);
                }}
              />
            }
          />

          <BIReportFilters
            open={filtersOpen}
            filters={reportDefinition.filters || []}
            values={filterValues}
            onApply={(next) => {
              setFilterValues(next);
              setPage(1);
            }}
            onReset={() => {
              setFilterValues({
                category: '',
                revenueRange: { min: '', max: '' },
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      charts={
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionBlock title="Revenue by Product" description="Backend revenue ranking." icon={<TrendingUp size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={revenueRows} labelKey="product" valueKey="revenue" formatLabel={(row) => row.product} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Quantity Sold" description="Backend quantity sold ranking." icon={<Package size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={quantityRows} labelKey="product" valueKey="quantitySold" formatLabel={(row) => row.product} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Tenant Revenue" description="Tenant share of product sales." icon={<Wallet size={18} />}>
            <BIChartContainer>
              <MiniBarChart rows={tenantRevenueRows} labelKey="product" valueKey="tenantRevenue" formatLabel={(row) => row.product} />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Inventory Impact" description="Inventory impact is not exposed by the backend." icon={<AlertTriangle size={18} />}>
            <BIChartContainer>
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                The backend does not currently expose inventory movements or stock impact for product sales.
              </div>
            </BIChartContainer>
          </SectionBlock>
        </div>
      }
      table={
        <SectionBlock title="Product Table" description="Canonical product performance rows." icon={<FileText size={18} />}>
          <BIDataTable<ProductPerformanceTableRow>
            rows={paginatedRows}
            columns={visibleColumns}
            rowKey={(row) => row.id}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onRowClick={(row) => setDrawerRow(row)}
            emptyState={error ? error : 'No product rows found for the selected criteria.'}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.join(', ')} are not exposed by the current backend payload.
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
      footer={reportDefinition.footer}
    >
      <BIDetailsDrawer<ProductPerformanceTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.product || String(reportDefinition.title)}
        subtitle={drawerRow ? drawerRow.category : undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Product" value={row.product} />
                  <Field label="Category" value={row.category} />
                  <Field label="Orders" value={formatNumber(row.orders)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sales</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Quantity Sold" value={formatNumber(row.quantitySold)} />
                  <Field label="Revenue" value={formatMoney(row.revenue, lang)} />
                  <Field label="Tenant Revenue" value={formatMoney(row.tenantRevenue, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Financial</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Platform Fees" value={formatMoney(row.platformFees, lang)} />
                  <Field label="Average Price" value="-" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Gap</div>
                <div className="mt-3 text-sm text-slate-700">
                  Inventory impact and average sold price are not exposed by the backend yet.
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row, null, 2)}</pre>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value === null || value === undefined || value === '' ? '-' : value}</span>
    </div>
  );
}

export default function OperationsIntelligenceReport({ lang }: { lang: Language }) {
  const [activeTab, setActiveTab] = useState<OperationsTab>('sales-overview');

  const tabs: Array<{ id: OperationsTab; labelEn: string; labelAr: string; icon: ReactNode }> = [
    { id: 'sales-overview', labelEn: 'Sales Overview', labelAr: 'نظرة عامة على المبيعات', icon: <TrendingUp size={16} /> },
    { id: 'sales-list', labelEn: 'Sales List', labelAr: 'قائمة المبيعات', icon: <FileText size={16} /> },
    { id: 'sales-log-details', labelEn: 'Sales Log Details', labelAr: 'تفاصيل سجل المبيعات', icon: <ClipboardList size={16} /> },
    { id: 'discount-summary', labelEn: 'Discount Summary', labelAr: 'ملخص الخصومات', icon: <Filter size={16} /> },
    { id: 'tax-summary', labelEn: 'Tax Summary', labelAr: 'ملخص الضرائب', icon: <Wallet size={16} /> },
    { id: 'gift-card-list', labelEn: 'Gift Card List', labelAr: 'قائمة بطاقات الهدايا', icon: <Sparkles size={16} /> },
    { id: 'customer-overview', labelEn: 'Customer Overview', labelAr: 'نظرة عامة على العملاء', icon: <Users size={16} /> },
    { id: 'employee-performance', labelEn: 'Employee Performance', labelAr: 'أداء الموظفين', icon: <UserCheck size={16} /> },
    { id: 'service-performance', labelEn: 'Service Performance', labelAr: 'أداء الخدمات', icon: <Sparkles size={16} /> },
    { id: 'product-performance', labelEn: 'Product Performance', labelAr: 'أداء المنتجات', icon: <Package size={16} /> },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {lang === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'sales-overview' ? <SalesOverviewReport lang={lang} /> : null}
      {activeTab === 'sales-list' ? <SalesListReport lang={lang} /> : null}
      {activeTab === 'sales-log-details' ? <SalesLogDetailsReport lang={lang} /> : null}
      {activeTab === 'discount-summary' ? <DiscountSummaryReport lang={lang} /> : null}
      {activeTab === 'tax-summary' ? <TaxSummaryReport lang={lang} /> : null}
      {activeTab === 'gift-card-list' ? <GiftCardListReport lang={lang} /> : null}
      {activeTab === 'customer-overview' ? <CustomerOverviewReport lang={lang} /> : null}
      {activeTab === 'employee-performance' ? <EmployeePerformanceReport lang={lang} /> : null}
      {activeTab === 'service-performance' ? <ServicePerformanceReport lang={lang} /> : null}
      {activeTab === 'product-performance' ? <ProductPerformanceReport lang={lang} /> : null}
    </div>
  );
}
