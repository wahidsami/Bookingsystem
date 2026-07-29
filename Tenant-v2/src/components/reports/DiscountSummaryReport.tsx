import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CreditCard, Filter, FileText, ShoppingBag, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import {
  BIActiveFilterSummary,
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
import { createDiscountSummaryReportDefinition, type DiscountSummaryReportOptions, type DiscountSummaryTableRow } from '../../lib/bi/reports/discountSummary';
import { buildSalesOverviewRows, type SalesOverviewPayload } from '../../lib/bi/reports/salesOverviewViewModel';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type DiscountSummaryPayload = SalesOverviewPayload;

type DiscountSummaryRow = DiscountSummaryTableRow & {
  paymentMethod: string;
  location: string;
  saleDateTime: string;
  appointmentReference: string;
  invoiceNumber: string;
  sourceRow?: any;
};

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return `${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;
}

function formatDate(value: unknown, lang: Language): string {
  if (!value) return 'Unavailable';
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

function formatPercent(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function formatText(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === '-') return 'Unavailable';
  return `${value}`;
}

function toOption(label: unknown, value: unknown): BIOption | null {
  const nextLabel = `${label ?? ''}`.trim();
  const nextValue = `${value ?? ''}`.trim();
  if (!nextLabel || !nextValue) return null;
  return { label: nextLabel, value: nextValue };
}

function dedupeOptions(options: BIOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const value = `${option.value ?? ''}`.trim();
    if (!value) return false;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function uniqueValues(rows: DiscountSummaryRow[], accessor: (row: DiscountSummaryRow) => string) {
  const seen = new Set<string>();
  const options: BIOption[] = [];
  rows.forEach((row) => {
    const value = `${accessor(row) || ''}`.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ label: value, value });
  });
  return options;
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
  rows: DiscountSummaryRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: DiscountSummaryRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: DiscountSummaryRow, column: { accessor: any; format?: (value: unknown, row: DiscountSummaryRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof DiscountSummaryRow];
    const formatted = column.format ? column.format(rawValue, row) : rawValue;
    if (formatted === null || formatted === undefined || formatted === '') return 'Unavailable';
    if (typeof formatted === 'number') return formatted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function Field({ label, value }: { label: string; value: ReactNode }) {
  const normalizedValue = value === null || value === undefined || value === '' || value === '-'
    ? 'Unavailable'
    : value;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{normalizedValue}</span>
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
              <span className="font-bold text-slate-500">{formatMoney(value, 'en')}</span>
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

function buildDiscountSummaryRows(report: DiscountSummaryPayload): DiscountSummaryRow[] {
  return buildSalesOverviewRows(report)
    .filter((row) => Number(row.discount || 0) > 0)
    .map((row: any) => {
      const source = row?.sourceRow || {};
      const saleDate = row?.saleDate || row?.saleDateTime || source?.date || source?.processedAt || source?.createdAt || '';
      const discountCategory = formatText(row?.channel || row?.entityType || source?.entityType || 'Unavailable');
      const discountType = formatText(source?.discountType || source?.discountPreset || source?.discountCategory || 'Unavailable');
      const item = formatText(row?.items || row?.service || row?.itemsSold || source?.service?.name_en || source?.service?.name_ar || 'Unavailable');
      const category = formatText(row?.category || source?.category || 'Unavailable');
      const customer = formatText(row?.customer || 'Unavailable');
      const teamMember = formatText(row?.employee || 'Unavailable');
      const grossSales = row?.grossSales == null ? null : Number(row.grossSales);
      const discountAmount = row?.discount == null ? null : Number(row.discount);
      const discountPercent = source?.discountPercent == null ? null : Number(source.discountPercent);
      const netSales = source?.invoiceTotalAmount == null
        ? (row?.netSales == null ? null : Number(row.netSales))
        : Number(source.invoiceTotalAmount);

      return {
        id: String(row?.id || row?.saleNumber || row?.invoiceNumber || row?.appointmentReference || item || '-'),
        saleDate: String(saleDate || ''),
        saleNumber: formatText(row?.saleNumber || 'Unavailable'),
        invoiceNumber: formatText(row?.invoiceNumber || 'Unavailable'),
        appointmentReference: formatText(row?.appointmentReference || 'Unavailable'),
        discountCategory,
        discountType,
        item,
        category,
        customer,
        teamMember,
        grossSales: grossSales === null || grossSales === undefined ? null : Number(grossSales),
        discountAmount: discountAmount === null || discountAmount === undefined ? null : Number(discountAmount),
        discountPercent: discountPercent === null || discountPercent === undefined ? null : Number(discountPercent),
        netSales: netSales === null || netSales === undefined ? null : Number(netSales),
        status: formatText(row?.status || 'Unavailable'),
        paymentMethod: formatText(row?.paymentMethod || 'Unavailable'),
        location: formatText(row?.location || 'Unavailable'),
        saleDateTime: String(saleDate || ''),
        sourceRow: source,
      };
    });
}

function buildDiscountSummaryBackendGaps(rows: DiscountSummaryRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.discountType === 'Unavailable')) gaps.add('Discount Type');
  if (rows.some((row) => row.discountPercent == null)) gaps.add('Discount %');
  if (rows.some((row) => row.netSales == null)) gaps.add('Net Sales');
  if (rows.some((row) => row.invoiceNumber === 'Unavailable')) gaps.add('Invoice Number');
  return Array.from(gaps);
}

export default function DiscountSummaryReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'discount-summary';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DiscountSummaryPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'discountAmount', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    discountCategory: '',
    discountType: '',
    customer: '',
    employee: '',
    location: '',
    service: '',
    product: '',
  });
  const [drawerRow, setDrawerRow] = useState<DiscountSummaryRow | null>(null);

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
          search,
          ...filterValues,
        });
        const payload = (response?.data || response || {}) as DiscountSummaryPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load discount summary report.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [customDateRange, datePreset, filterValues, refreshTick, search]);

  const rows = useMemo(() => buildDiscountSummaryRows(report), [report]);

  const definitionOptions = useMemo(() => {
    const discountCategories = dedupeOptions([
      { label: isRtl ? 'جميع الفئات' : 'All Discount Categories', value: '' },
      ...uniqueValues(rows, (row) => row.discountCategory),
    ]);
    const discountTypes = dedupeOptions([
      { label: isRtl ? 'جميع الأنواع' : 'All Discount Types', value: '' },
      ...uniqueValues(rows, (row) => row.discountType),
    ]);
    const customers = dedupeOptions([
      { label: isRtl ? 'جميع العملاء' : 'All Customers', value: '' },
      ...uniqueValues(rows, (row) => row.customer),
    ]);
    const employees = dedupeOptions([
      { label: isRtl ? 'جميع الموظفين' : 'All Team Members', value: '' },
      ...uniqueValues(rows, (row) => row.teamMember),
    ]);
    const locations = dedupeOptions([
      { label: isRtl ? 'كل المواقع' : 'All Locations', value: '' },
      ...uniqueValues(rows, (row) => row.location),
    ]);
    const services = dedupeOptions([
      { label: isRtl ? 'كل الخدمات' : 'All Services', value: '' },
      ...uniqueValues(rows, (row) => row.discountCategory === 'Appointment' ? row.item : ''),
    ]);
    const products = dedupeOptions([
      { label: isRtl ? 'كل المنتجات' : 'All Products', value: '' },
      ...uniqueValues(rows, (row) => row.discountCategory === 'Order' ? row.item : ''),
    ]);

    const options: DiscountSummaryReportOptions = {
      discountCategories,
      discountTypes,
      customers,
      employees,
      locations,
      services,
      products,
    };

    return options;
  }, [isRtl, rows]);

  const reportDefinition = useMemo(
    () => createDiscountSummaryReportDefinition(definitionOptions),
    [definitionOptions]
  );
  useEffect(() => {
    setPageSize(reportDefinition.defaultPageSize || 10);
  }, [reportDefinition.defaultPageSize]);

  const columns = reportDefinition.columns || [];
  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, columns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedDiscountCategory = normalizeText(filterValues.discountCategory);
    const selectedDiscountType = normalizeText(filterValues.discountType);
    const selectedCustomer = normalizeText(filterValues.customer);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedLocation = normalizeText(filterValues.location);
    const selectedService = normalizeText(filterValues.service);
    const selectedProduct = normalizeText(filterValues.product);

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.saleDate,
          row.saleNumber,
          row.invoiceNumber,
          row.appointmentReference,
          row.discountCategory,
          row.discountType,
          row.item,
          row.category,
        row.customer,
        row.teamMember,
        row.location,
        row.paymentMethod,
        row.status,
      ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedDiscountCategory && normalizeText(row.discountCategory) !== selectedDiscountCategory) return false;
      if (selectedDiscountType && normalizeText(row.discountType) !== selectedDiscountType) return false;
      if (selectedCustomer && normalizeText(row.customer) !== selectedCustomer) return false;
      if (selectedEmployee && normalizeText(row.teamMember) !== selectedEmployee) return false;
      if (selectedLocation && normalizeText(row.location) !== selectedLocation) return false;
      if (selectedService && !(row.discountCategory === 'Appointment' && normalizeText(row.item) === selectedService)) return false;
      if (selectedProduct && !(row.discountCategory === 'Order' && normalizeText(row.item) === selectedProduct)) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const overview = report.overview || {};
  const discountTotals = overview.discountTotals || {};
  const topDiscountedServices = Array.isArray(discountTotals.topDiscountedServices) ? discountTotals.topDiscountedServices : [];
  const topDiscountedOrders = Array.isArray(discountTotals.topDiscountedOrders) ? discountTotals.topDiscountedOrders : [];
  const topDiscountedItems = rows.slice().sort((left, right) => Number(right.discountAmount || 0) - Number(left.discountAmount || 0));

  const kpiItems = [
    { id: 'discount-total', label: 'Total Discounts', value: formatMoney(discountTotals.totalDiscountAmount, lang), note: isRtl ? 'الخصومات الكلية' : 'Total discount amount', icon: <Filter size={18} /> },
    { id: 'discount-bookings', label: 'Discounted Bookings', value: Number(discountTotals.discountedBookings || 0).toLocaleString(), note: isRtl ? 'حجوزات مخفضة' : 'Discounted bookings', icon: <Sparkles size={18} /> },
    { id: 'discount-orders', label: 'Discounted Orders', value: Number(discountTotals.discountedOrders || 0).toLocaleString(), note: isRtl ? 'طلبات مخفضة' : 'Discounted orders', icon: <ShoppingBag size={18} /> },
    { id: 'avg-discount', label: 'Average Discount', value: formatMoney(discountTotals.averageDiscountAmount, lang), note: isRtl ? 'متوسط الخصم' : 'Average discount amount', icon: <TrendingUp size={18} /> },
    { id: 'appointment-discount', label: 'Appointment Discount', value: formatMoney(discountTotals.appointmentDiscountAmount, lang), note: isRtl ? 'خصومات المواعيد' : 'Appointment discount amount', icon: <CreditCard size={18} /> },
    { id: 'order-discount', label: 'Order Discount', value: formatMoney(discountTotals.orderDiscountAmount, lang), note: isRtl ? 'خصومات الطلبات' : 'Order discount amount', icon: <Wallet size={18} /> },
    { id: 'top-service', label: 'Top Discounted Service', value: topDiscountedServices[0]?.name_en || topDiscountedServices[0]?.name_ar || '-', note: topDiscountedServices[0] ? formatMoney(topDiscountedServices[0].discountAmount, lang) : '-', icon: <Sparkles size={18} /> },
    { id: 'top-order', label: 'Top Discounted Order', value: topDiscountedOrders[0]?.orderNumber || '-', note: topDiscountedOrders[0] ? formatMoney(topDiscountedOrders[0].discountAmount, lang) : '-', icon: <ShoppingBag size={18} /> },
  ];

  const backendGaps = useMemo(() => buildDiscountSummaryBackendGaps(rows), [rows]);

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

  const tableColumns = useMemo(() => columns.map((column) => {
    if (['grossSales', 'discountAmount', 'netSales'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (column.id === 'discountPercent') {
      return { ...column, format: (value: unknown) => formatPercent(value) };
    }
    if (column.id === 'saleDate') {
      return { ...column, format: (value: unknown) => formatDate(value, lang) };
    }
    return column;
  }), [columns, lang]);

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
            onRefresh={() => setRefreshTick((tick) => tick + 1)}
            rows={filteredRows}
            columns={tableColumns}
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
                discountCategory: '',
                discountType: '',
                customer: '',
                employee: '',
                location: '',
                service: '',
                product: '',
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
          <SectionBlock title="Top Discounted Sales" description="Rows with the highest canonical discount amounts." icon={<Filter size={18} />}>
            <BIChartContainer>
              <MiniBarChart
                rows={topDiscountedItems}
                labelKey="item"
                valueKey="discountAmount"
                formatLabel={(row) => row.item}
              />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Top Discounted Services" description="Backend service discount totals." icon={<Sparkles size={18} />}>
            <BIChartContainer>
              <MiniBarChart
                rows={topDiscountedServices}
                labelKey="name_en"
                valueKey="discountAmount"
                formatLabel={(row) => row.name_en || row.name_ar || '-'}
              />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Top Discounted Orders" description="Backend order discount totals." icon={<ShoppingBag size={18} />}>
            <BIChartContainer>
              <MiniBarChart
                rows={topDiscountedOrders}
                labelKey="orderNumber"
                valueKey="discountAmount"
                formatLabel={(row) => row.orderNumber || row.id || '-'}
              />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Backend Gap" description="Row-level discount type and percentage are not exposed by the backend contract yet." icon={<AlertTriangle size={18} />}>
            <BIChartContainer>
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                The backend currently returns discount amounts and aggregate discount totals, but not a canonical row-level discount type or discount percent.
              </div>
            </BIChartContainer>
          </SectionBlock>
        </div>
      }
      table={
        <SectionBlock title="Discount Table" description="Canonical sales rows with non-zero discounts." icon={<FileText size={18} />}>
          <BIDataTable<DiscountSummaryRow>
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
            emptyState={error ? error : 'No discounted sales found for the selected criteria.'}
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
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
          totalItems={filteredRows.length}
        />
      }
      footer={reportDefinition.footer}
    >
      <BIDetailsDrawer<DiscountSummaryRow>
        open={Boolean(drawerRow)}
        title={drawerRow ? `${drawerRow.item} · ${drawerRow.discountAmount == null ? 'Unavailable' : formatMoney(drawerRow.discountAmount, lang)}` : String(reportDefinition.title)}
        subtitle={drawerRow ? drawerRow.discountCategory : undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Sale Number" value={row.saleNumber} />
                  <Field label="Sale Date" value={formatDate(row.saleDateTime, lang)} />
                  <Field label="Invoice Number" value={row.invoiceNumber} />
                  <Field label="Appointment Reference" value={row.appointmentReference} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Customer" value={row.customer} />
                  <Field label="Team Member" value={row.teamMember} />
                  <Field label="Location" value={row.location} />
                  <Field label="Payment Method" value={row.paymentMethod} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sale</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Discount Category" value={row.discountCategory} />
                  <Field label="Status" value={row.status} />
                  <Field label="Discount Type" value={row.discountType} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Discount Details</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Item" value={row.item} />
                  <Field label="Category" value={row.category} />
                  <Field label="Gross Sales" value={formatMoney(row.grossSales, lang)} />
                  <Field label="Discount Amount" value={formatMoney(row.discountAmount, lang)} />
                  <Field label="Discount %" value={formatPercent(row.discountPercent)} />
                  <Field label="Net Sales" value={formatMoney(row.netSales, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Related Services</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Service" value={row.discountCategory === 'Appointment' ? row.item : 'Unavailable'} />
                  <Field label="Service Category" value={row.discountCategory === 'Appointment' ? row.category : 'Unavailable'} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Related Products</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Product" value={row.discountCategory === 'Order' ? row.item : 'Unavailable'} />
                  <Field label="Product Category" value={row.discountCategory === 'Order' ? row.category : 'Unavailable'} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</div>
                <div className="mt-3 grid gap-2 text-sm xl:grid-cols-2">
                  <Field label="Sale Date" value={formatDate(row.saleDateTime, lang)} />
                  <Field label="Processed At" value={formatDate(row.sourceRow?.processedAt || row.saleDateTime, lang)} />
                  <Field label="Paid At" value={formatDate(row.sourceRow?.paidAt || row.saleDateTime, lang)} />
                  <Field label="Last Updated" value={formatDate(row.sourceRow?.updatedAt || row.saleDateTime, lang)} />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row.sourceRow || row, null, 2)}</pre>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}
