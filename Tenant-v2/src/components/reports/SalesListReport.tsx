import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CreditCard,
  FileText,
  Filter,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  BIActiveFilterSummary,
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
import { useBIReportRefreshSignal } from '../../lib/bi/refreshSignals';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import { createSalesListReportDefinition, type SalesListReportOptions, type SalesListTableRow } from '../../lib/bi/reports/salesList';
import { buildSalesOverviewRows, type SalesOverviewPayload } from '../../lib/bi/reports/salesOverviewViewModel';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
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

function uniqueValues(rows: SalesListTableRow[], accessor: (row: SalesListTableRow) => string) {
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
  rows: SalesListTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: SalesListTableRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: SalesListTableRow, column: { accessor: any; format?: (value: unknown, row: SalesListTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof SalesListTableRow];
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
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
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

function buildSalesListRows(report: SalesOverviewPayload): SalesListTableRow[] {
  return buildSalesOverviewRows(report).map((row) => {
    const appointmentReference = formatText(row.appointmentReference || 'Unavailable');
    const location = formatText(row.location || 'Unavailable');
    const amountPaid = row.amountPaid ?? null;
    const remainingBalance = row.remainingBalance ?? null;

    return {
      ...row,
      status: formatText(row.status || 'Unavailable'),
      appointmentReference,
      location,
      amountPaid: amountPaid === null || amountPaid === undefined ? null : Number(amountPaid),
      remainingBalance: remainingBalance === null || remainingBalance === undefined ? null : Number(remainingBalance),
      itemsSold: formatText(row.itemsSold || 'Unavailable'),
    };
  });
}

function buildSalesListBackendGaps(rows: SalesListTableRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.invoiceNumber === 'Unavailable')) gaps.add('Invoice Number');
  if (rows.some((row) => row.location === 'Unavailable')) gaps.add('Location');
  if (rows.some((row) => row.amountPaid == null)) gaps.add('Amount Paid');
  if (rows.some((row) => row.remainingBalance == null)) gaps.add('Remaining Balance');
  return Array.from(gaps);
}

export default function SalesListReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'sales-list';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SalesOverviewPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'saleDate', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    customer: '',
    employee: '',
    paymentMethod: '',
    status: '',
    location: '',
    channel: '',
    grossSalesRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<SalesListTableRow | null>(null);

  useBIReportRefreshSignal(() => setRefreshTick((tick) => tick + 1));

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
        const payload = (response?.data || response || {}) as SalesOverviewPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sales list report.');
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

  const rows = useMemo(() => buildSalesListRows(report), [report]);
  const reportDefinition = useMemo(() => {
    const customerOptions = dedupeOptions([
      { label: isRtl ? 'جميع العملاء' : 'All Customers', value: '' },
      ...uniqueValues(rows, (row) => row.customer),
    ]);
    const employeeOptions = dedupeOptions([
      { label: isRtl ? 'جميع الموظفين' : 'All Employees', value: '' },
      ...uniqueValues(rows, (row) => row.employee),
    ]);
    const paymentMethodOptions = dedupeOptions([
      { label: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods', value: '' },
      ...uniqueValues(rows, (row) => row.paymentMethod),
    ]);
    const statusOptions = dedupeOptions([
      { label: isRtl ? 'جميع الحالات' : 'All Statuses', value: '' },
      ...uniqueValues(rows, (row) => row.status),
    ]);
    const locationOptions = dedupeOptions([
      { label: isRtl ? 'كل المواقع' : 'All Locations', value: '' },
      ...uniqueValues(rows, (row) => row.location),
    ]);
    const channelOptions = dedupeOptions([
      { label: isRtl ? 'كل القنوات' : 'All Channels', value: '' },
      ...uniqueValues(rows, (row) => row.channel),
    ]);

    const options: SalesListReportOptions = {
      customers: customerOptions,
      employees: employeeOptions,
      paymentMethods: paymentMethodOptions,
      statuses: statusOptions,
      locations: locationOptions,
      channels: channelOptions,
    };

    return createSalesListReportDefinition(options);
  }, [isRtl, rows]);

  useEffect(() => {
    setPageSize(reportDefinition.defaultPageSize || 10);
  }, [reportDefinition.defaultPageSize]);

  const columns = reportDefinition.columns || [];
  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, columns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedCustomer = normalizeText(filterValues.customer);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedPaymentMethod = normalizeText(filterValues.paymentMethod);
    const selectedStatus = normalizeText(filterValues.status);
    const selectedLocation = normalizeText(filterValues.location);
    const selectedChannel = normalizeText(filterValues.channel);
    const amountRange = typeof filterValues.grossSalesRange === 'object' && filterValues.grossSalesRange
      ? filterValues.grossSalesRange as { min?: string; max?: string }
      : {};
    const min = amountRange.min ? Number(amountRange.min) : null;
    const max = amountRange.max ? Number(amountRange.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.saleNumber,
          row.appointmentReference,
          row.invoiceNumber,
          row.customer,
          row.employee,
          row.location,
          row.channel,
          row.itemsSold,
          row.paymentMethod,
          row.status,
          row.notes,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedCustomer && normalizeText(row.customer) !== selectedCustomer) return false;
      if (selectedEmployee && normalizeText(row.employee) !== selectedEmployee) return false;
      if (selectedPaymentMethod && normalizeText(row.paymentMethod) !== selectedPaymentMethod) return false;
      if (selectedStatus && normalizeText(row.status) !== selectedStatus) return false;
      if (selectedLocation && normalizeText(row.location) !== selectedLocation) return false;
      if (selectedChannel && normalizeText(row.channel) !== selectedChannel) return false;

      const gross = Number(row.grossSales || 0);
      if (min !== null && Number.isFinite(min) && !(gross >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(gross <= max)) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const summaryTotals = report.summary?.totals || {};
  const summaryMetrics = report.summary?.metrics || {};

  const kpiItems = [
    { id: 'sales-count', label: 'Sales Count', value: Number(summaryMetrics.salesCount || rows.length || 0).toLocaleString(), note: isRtl ? 'إجمالي السطور' : 'Total rows', icon: <ShoppingBag size={18} /> },
    { id: 'gross-sales', label: 'Gross Sales', value: formatMoney(summaryTotals.revenue, lang), note: isRtl ? 'الإيراد الإجمالي' : 'Gross revenue', icon: <TrendingUp size={18} /> },
    { id: 'net-sales', label: 'Net Sales', value: formatMoney(summaryTotals.netRevenue, lang), note: isRtl ? 'الصافي بعد الخصومات' : 'Net revenue', icon: <Wallet size={18} /> },
    { id: 'discounts', label: 'Discounts', value: formatMoney(summaryTotals.discount, lang), note: isRtl ? 'إجمالي الخصومات' : 'Discount amount', icon: <Filter size={18} /> },
    { id: 'vat', label: 'VAT', value: formatMoney(summaryTotals.tax, lang), note: isRtl ? 'الضريبة' : 'VAT amount', icon: <FileText size={18} /> },
    { id: 'amount-paid', label: 'Amount Paid', value: formatMoney(summaryTotals.collectedAmount, lang), note: isRtl ? 'المبالغ المحصلة' : 'Collected amount', icon: <CreditCard size={18} /> },
    { id: 'remaining-balance', label: 'Remaining Balance', value: formatMoney(summaryTotals.outstandingAmount, lang), note: isRtl ? 'الرصيد المتبقي' : 'Outstanding balance', icon: <AlertTriangle size={18} /> },
    { id: 'invoice-coverage', label: 'Invoices Linked', value: rows.filter((row) => row.invoiceNumber !== 'Unavailable').length.toLocaleString(), note: isRtl ? 'سطور مرتبطة بفواتير' : 'Rows with invoices', icon: <Sparkles size={18} /> },
  ];

  const backendGaps = useMemo(() => buildSalesListBackendGaps(rows), [rows]);

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
    if (['grossSales', 'discount', 'vat', 'netSales', 'amountPaid', 'remainingBalance'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
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
                customer: '',
                employee: '',
                paymentMethod: '',
                status: '',
                location: '',
                channel: '',
                grossSalesRange: { min: '', max: '' },
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      table={
        <SectionBlock title="Sales Table" description="Canonical sales ledger rows from the production financial contract." icon={<FileText size={18} />}>
          <BIDataTable<SalesListTableRow>
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
            emptyState={error ? error : 'No sales found for the selected criteria.'}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.join(', ')} are not exposed by the current backend payload for every row yet.
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
      <BIDetailsDrawer<SalesListTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.saleNumber || String(reportDefinition.title)}
        subtitle={drawerRow?.customer || undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Sale Number" value={row.saleNumber} />
                  <Field label="Appointment Reference" value={row.appointmentReference} />
                  <Field label="Invoice Number" value={row.invoiceNumber} />
                  <Field label="Sale Date" value={formatDate(row.saleDate, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Customer" value={row.customer} />
                  <Field label="Employee" value={row.employee} />
                  <Field label="Location" value={row.location} />
                  <Field label="Channel" value={row.channel} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Items & Status</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Items Sold" value={row.itemsSold} />
                  <Field label="Status" value={row.status} />
                  <Field label="Payment Method" value={row.paymentMethod} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Financial</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Gross Sales" value={formatMoney(row.grossSales, lang)} />
                  <Field label="Discount" value={formatMoney(row.discount, lang)} />
                  <Field label="VAT" value={formatMoney(row.vat, lang)} />
                  <Field label="Net Sales" value={formatMoney(row.netSales, lang)} />
                  <Field label="Amount Paid" value={formatMoney(row.amountPaid, lang)} />
                  <Field label="Remaining Balance" value={formatMoney(row.remainingBalance, lang)} />
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
