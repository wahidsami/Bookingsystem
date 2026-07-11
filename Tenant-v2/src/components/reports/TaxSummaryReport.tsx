import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, FileText, Filter, ReceiptText, Sparkles, Tags, TrendingUp, Wallet } from 'lucide-react';
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
import { createTaxSummaryReportDefinition, type TaxSummaryReportOptions, type TaxSummaryTableRow } from '../../lib/bi/reports/taxSummary';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type TaxSummaryPayload = {
  overview?: any;
  revenueLedger?: any;
  paymentLedger?: any;
  refundLedger?: any;
  settlementLedger?: any;
  dateRange?: any;
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

function formatText(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === '-') return 'Unavailable';
  return `${value}`;
}

function formatRate(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === '-') return 'Unavailable';
  const number = Number(value);
  if (Number.isFinite(number)) return `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
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

function uniqueValues(rows: TaxSummaryTableRow[], accessor: (row: TaxSummaryTableRow) => string) {
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
  rows: TaxSummaryTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: TaxSummaryTableRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: TaxSummaryTableRow, column: { accessor: any; format?: (value: unknown, row: TaxSummaryTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof TaxSummaryTableRow];
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

function buildTaxSummaryRows(report: TaxSummaryPayload): TaxSummaryTableRow[] {
  const revenueRows = Array.isArray(report.revenueLedger?.rows) ? report.revenueLedger.rows : [];

  return revenueRows.flatMap((row: any) => {
    const invoiceItems = Array.isArray(row?.invoiceItems) && row.invoiceItems.length > 0 ? row.invoiceItems : [null];
    return invoiceItems.map((item: any, index: number) => {
      const rawItemType = `${item?.itemType || ''}`.trim().toLowerCase();
      const fallbackItemType = `${row?.entityType || ''}`.trim().toLowerCase() === 'appointment'
        ? 'service'
        : `${row?.entityType || ''}`.trim().toLowerCase() === 'order'
          ? 'product'
          : '';
      const itemType = rawItemType || fallbackItemType || 'Unavailable';
      const itemName = item?.itemNameEn
        || item?.itemNameAr
        || row?.service
        || row?.itemsSold
        || 'Unavailable';
      const grossSales = item?.gross === null || item?.gross === undefined
        ? (row?.invoiceSubtotalAmount === null || row?.invoiceSubtotalAmount === undefined ? null : Number(row.invoiceSubtotalAmount))
        : Number(item.gross);
      const taxAmount = item?.vat === null || item?.vat === undefined
        ? (row?.tax === null || row?.tax === undefined ? null : Number(row.tax))
        : Number(item.vat);
      const netSales = item?.net === null || item?.net === undefined
        ? (row?.invoiceTotalAmount === null || row?.invoiceTotalAmount === undefined ? null : Number(row.invoiceTotalAmount))
        : Number(item.net);
      const category = item?.category || item?.metadata?.category || row?.category || 'Unavailable';
      const taxType = item?.metadata?.taxType || item?.metadata?.vatType || row?.taxType || row?.vatType || 'Unavailable';
      const taxRate = item?.metadata?.taxRate || item?.metadata?.vatRate || row?.taxRate || row?.vatRate || 'Unavailable';

      return {
        id: `${row?.id || row?.reference || 'row'}:${item?.id || item?.itemRefId || index}`,
        dateTime: row?.date || row?.processedAt || row?.createdAt || '',
        saleNumber: formatText(row?.reference || row?.saleNumber || row?.id || 'Unavailable'),
        invoiceNumber: formatText(row?.invoiceNumber || 'Unavailable'),
        appointmentReference: formatText(row?.appointmentReference || row?.bookingReference || row?.bookingNumber || 'Unavailable'),
        taxType: formatText(taxType),
        taxRate: formatText(taxRate),
        item: formatText(itemName),
        category: formatText(category),
        customer: formatText(row?.customer || 'Unavailable'),
        teamMember: formatText(row?.employee || 'Unavailable'),
        grossSales: grossSales === null || grossSales === undefined ? null : Number(grossSales),
        taxAmount: taxAmount === null || taxAmount === undefined ? null : Number(taxAmount),
        netSales: netSales === null || netSales === undefined ? null : Number(netSales),
        paymentMethod: formatText(row?.paymentMethodLabel || row?.paymentMethod || 'Unavailable'),
        saleStatus: formatText(row?.saleStatus || 'Unavailable'),
        location: formatText(row?.location || 'Unavailable'),
        itemType: formatText(itemType),
        sourceRow: row,
        sourceItem: item,
      };
    });
  });
}

function buildTaxSummaryBackendGaps(rows: TaxSummaryTableRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.taxType === 'Unavailable')) gaps.add('Tax Type');
  if (rows.some((row) => row.taxRate === 'Unavailable')) gaps.add('Tax Rate');
  if (rows.some((row) => row.invoiceNumber === 'Unavailable')) gaps.add('Invoice Number');
  if (rows.some((row) => row.netSales == null)) gaps.add('Net Sales');
  return Array.from(gaps);
}

export default function TaxSummaryReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'tax-summary';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TaxSummaryPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'taxAmount', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    taxType: '',
    customer: '',
    employee: '',
    location: '',
    service: '',
    product: '',
  });
  const [drawerRow, setDrawerRow] = useState<TaxSummaryTableRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        const response = await tenantApiAdapter.getFinancialLedger({
          startDate: range.from,
          endDate: range.to,
        });
        const payload = (response?.data || response || {}) as TaxSummaryPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tax summary report.');
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

  const rows = useMemo(() => buildTaxSummaryRows(report), [report]);

  const definitionOptions = useMemo(() => {
    const taxTypes = dedupeOptions([
      { label: isRtl ? 'جميع أنواع الضريبة' : 'All Tax Types', value: '' },
      ...uniqueValues(rows, (row) => row.taxType),
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
      ...uniqueValues(rows, (row) => row.itemType === 'service' ? row.item : ''),
    ]);
    const products = dedupeOptions([
      { label: isRtl ? 'كل المنتجات' : 'All Products', value: '' },
      ...uniqueValues(rows, (row) => row.itemType === 'product' ? row.item : ''),
    ]);

    const options: TaxSummaryReportOptions = {
      taxTypes,
      customers,
      employees,
      locations,
      services,
      products,
    };

    return options;
  }, [isRtl, rows]);

  const reportDefinition = useMemo(
    () => createTaxSummaryReportDefinition(definitionOptions),
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
    const selectedTaxType = normalizeText(filterValues.taxType);
    const selectedCustomer = normalizeText(filterValues.customer);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedLocation = normalizeText(filterValues.location);
    const selectedService = normalizeText(filterValues.service);
    const selectedProduct = normalizeText(filterValues.product);

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.dateTime,
          row.saleNumber,
          row.invoiceNumber,
          row.appointmentReference,
          row.taxType,
          row.taxRate,
          row.item,
          row.category,
          row.customer,
          row.teamMember,
          row.location,
          row.paymentMethod,
          row.saleStatus,
          row.itemType,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedTaxType && normalizeText(row.taxType) !== selectedTaxType) return false;
      if (selectedCustomer && normalizeText(row.customer) !== selectedCustomer) return false;
      if (selectedEmployee && normalizeText(row.teamMember) !== selectedEmployee) return false;
      if (selectedLocation && normalizeText(row.location) !== selectedLocation) return false;
      if (selectedService && !(row.itemType === 'service' && normalizeText(row.item) === selectedService)) return false;
      if (selectedProduct && !(row.itemType === 'product' && normalizeText(row.item) === selectedProduct)) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const overview = report.overview || {};
  const revenueRows = Array.isArray(report.revenueLedger?.rows) ? report.revenueLedger.rows : [];
  const totalTax = Number((overview.totalTax ?? revenueRows.reduce((sum: number, row: any) => sum + Number(row?.tax || 0), 0)) || 0);
  const totalRevenue = Number((overview.totalRevenue ?? revenueRows.reduce((sum: number, row: any) => sum + Number(row?.invoiceSubtotalAmount || row?.revenue || 0), 0)) || 0);
  const totalNet = Number((overview.netCollected ?? revenueRows.reduce((sum: number, row: any) => sum + Number(row?.invoiceTotalAmount || 0), 0)) || 0);
  const totalInvoices = new Set(rows.map((row) => row.invoiceNumber).filter((value) => value && value !== 'Unavailable')).size;

  const kpiItems = [
    { id: 'total-tax', label: 'Total Tax', value: formatMoney(totalTax, lang), note: isRtl ? 'إجمالي الضريبة' : 'Total tax amount', icon: <FileText size={18} /> },
    { id: 'gross-sales', label: 'Gross Sales', value: formatMoney(totalRevenue, lang), note: isRtl ? 'إجمالي المبيعات' : 'Gross sales', icon: <TrendingUp size={18} /> },
    { id: 'net-sales', label: 'Net Sales', value: formatMoney(totalNet, lang), note: isRtl ? 'صافي المبيعات' : 'Net sales', icon: <Wallet size={18} /> },
    { id: 'invoice-count', label: 'Invoices Linked', value: totalInvoices.toLocaleString(), note: isRtl ? 'الفواتير المرتبطة' : 'Distinct invoices', icon: <ReceiptText size={18} /> },
    { id: 'tax-types', label: 'Tax Types', value: new Set(rows.map((row) => row.taxType).filter((value) => value && value !== 'Unavailable')).size.toLocaleString(), note: isRtl ? 'أنواع الضريبة' : 'Observed tax types', icon: <Tags size={18} /> },
    { id: 'tax-rates', label: 'Tax Rates', value: new Set(rows.map((row) => row.taxRate).filter((value) => value && value !== 'Unavailable')).size.toLocaleString(), note: isRtl ? 'معدلات الضريبة' : 'Observed tax rates', icon: <Sparkles size={18} /> },
    { id: 'service-tax', label: 'Taxed Services', value: rows.filter((row) => row.itemType === 'service').length.toLocaleString(), note: isRtl ? 'الخدمات الخاضعة' : 'Service rows', icon: <Filter size={18} /> },
    { id: 'product-tax', label: 'Taxed Products', value: rows.filter((row) => row.itemType === 'product').length.toLocaleString(), note: isRtl ? 'المنتجات الخاضعة' : 'Product rows', icon: <TrendingUp size={18} /> },
  ];

  const backendGaps = useMemo(() => buildTaxSummaryBackendGaps(rows), [rows]);

  const topTaxRows = rows.slice().sort((left, right) => Number(right.taxAmount || 0) - Number(left.taxAmount || 0));
  const topTaxedServices = rows.filter((row) => row.itemType === 'service').slice().sort((left, right) => Number(right.taxAmount || 0) - Number(left.taxAmount || 0));
  const topTaxedProducts = rows.filter((row) => row.itemType === 'product').slice().sort((left, right) => Number(right.taxAmount || 0) - Number(left.taxAmount || 0));

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
    if (['grossSales', 'taxAmount', 'netSales'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (column.id === 'taxRate') {
      return { ...column, format: (value: unknown) => formatRate(value) };
    }
    if (column.id === 'dateTime') {
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
                taxType: '',
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
          <SectionBlock title="Top Taxed Transactions" description="Rows with the highest canonical tax amounts." icon={<FileText size={18} />}>
            <BIChartContainer>
              <MiniBarChart
                rows={topTaxRows}
                labelKey="item"
                valueKey="taxAmount"
                formatLabel={(row) => row.item}
              />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Top Taxed Services" description="Backend service tax totals." icon={<Sparkles size={18} />}>
            <BIChartContainer>
              <MiniBarChart
                rows={topTaxedServices}
                labelKey="item"
                valueKey="taxAmount"
                formatLabel={(row) => row.item}
              />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Top Taxed Products" description="Backend product tax totals." icon={<TrendingUp size={18} />}>
            <BIChartContainer>
              <MiniBarChart
                rows={topTaxedProducts}
                labelKey="item"
                valueKey="taxAmount"
                formatLabel={(row) => row.item}
              />
            </BIChartContainer>
          </SectionBlock>
          <SectionBlock title="Backend Gap" description="Row-level tax type and tax rate are not exposed by the backend contract yet." icon={<AlertTriangle size={18} />}>
            <BIChartContainer>
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                The backend currently returns canonical tax amounts and invoice totals, but not a canonical row-level tax type or tax rate.
              </div>
            </BIChartContainer>
          </SectionBlock>
        </div>
      }
      table={
        <SectionBlock title="Tax Table" description="Canonical financial rows with non-zero tax amounts." icon={<FileText size={18} />}>
          <BIDataTable<TaxSummaryTableRow>
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
            emptyState={error ? error : 'No tax-bearing sales found for the selected criteria.'}
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
      <BIDetailsDrawer<TaxSummaryTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow ? `${drawerRow.item} · ${drawerRow.taxAmount == null ? 'Unavailable' : formatMoney(drawerRow.taxAmount, lang)}` : String(reportDefinition.title)}
        subtitle={drawerRow ? drawerRow.taxType : undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Sale Number" value={row.saleNumber} />
                  <Field label="Date / Time" value={formatDate(row.dateTime, lang)} />
                  <Field label="Tax Type" value={row.taxType} />
                  <Field label="Tax Rate" value={formatRate(row.taxRate)} />
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
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Invoice</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Invoice Number" value={row.invoiceNumber} />
                  <Field label="Sale Status" value={row.saleStatus} />
                  <Field label="Gross Sales" value={formatMoney(row.grossSales, lang)} />
                  <Field label="Tax Amount" value={formatMoney(row.taxAmount, lang)} />
                  <Field label="Net Sales" value={formatMoney(row.netSales, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Tax Details</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Item" value={row.item} />
                  <Field label="Category" value={row.category} />
                  <Field label="Item Type" value={row.itemType} />
                  <Field label="Payment Status" value={row.sourceRow?.paymentStatus || row.saleStatus} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Related Services</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Service" value={row.itemType === 'service' ? row.item : 'Unavailable'} />
                  <Field label="Service Category" value={row.itemType === 'service' ? row.category : 'Unavailable'} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Related Products</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Product" value={row.itemType === 'product' ? row.item : 'Unavailable'} />
                  <Field label="Product Category" value={row.itemType === 'product' ? row.category : 'Unavailable'} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</div>
                <div className="mt-3 grid gap-2 text-sm xl:grid-cols-2">
                  <Field label="Sale Date" value={formatDate(row.dateTime, lang)} />
                  <Field label="Processed At" value={formatDate(row.sourceRow?.processedAt || row.dateTime, lang)} />
                  <Field label="Paid At" value={formatDate(row.sourceRow?.paidAt || row.dateTime, lang)} />
                  <Field label="Last Updated" value={formatDate(row.sourceRow?.updatedAt || row.dateTime, lang)} />
                </div>
              </div>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}
