import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CreditCard,
  FileText,
  RefreshCw,
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
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import {
  createPaymentTransactionsReportDefinition,
  type PaymentTransactionsReportOptions,
  type PaymentTransactionsTableRow,
} from '../../lib/bi/reports/paymentTransactions';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type PaymentTransactionsPayload = {
  overview?: any;
  ledger?: any;
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

function humanizeLabel(value: unknown): string {
  const text = `${value ?? ''}`.trim();
  if (!text) return 'Unavailable';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function uniqueValues(rows: PaymentTransactionsTableRow[], accessor: (row: PaymentTransactionsTableRow) => string) {
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
}: {
  title: string;
  description: string;
  rows: PaymentTransactionsTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: PaymentTransactionsTableRow) => ReactNode }>;
}) {
  const renderValue = (row: PaymentTransactionsTableRow, column: { accessor: any; format?: (value: unknown, row: PaymentTransactionsTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof PaymentTransactionsTableRow];
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

function mapTransactionType(paymentRow: any, revenueRow: any) {
  const rawType = `${paymentRow?.type || ''}`.trim().toLowerCase();
  const paymentMethod = `${paymentRow?.method || ''}`.trim().toLowerCase();
  const rawStatus = `${paymentRow?.status || revenueRow?.paymentStatus || ''}`.trim().toLowerCase();

  if (rawType === 'refund' || rawStatus === 'refunded') return 'Refund';
  if (paymentMethod === 'wallet') return 'Wallet';
  if (rawType === 'deposit') return 'Deposit';
  if (rawType === 'full' || rawType === 'remainder') return 'Sale';
  return rawType ? humanizeLabel(rawType) : 'Adjustment';
}

function buildPaymentTransactionRows(report: PaymentTransactionsPayload): PaymentTransactionsTableRow[] {
  const paymentRows = Array.isArray(report.ledger?.paymentLedger?.rows) ? report.ledger.paymentLedger.rows : [];
  const revenueRows = Array.isArray(report.ledger?.revenueLedger?.rows) ? report.ledger.revenueLedger.rows : [];
  const revenueById = new Map<string, any>();
  revenueRows.forEach((row: any) => {
    const key = `${row?.id || ''}`.trim();
    if (key) revenueById.set(key, row);
  });

  const sourceRows = paymentRows.length ? paymentRows : revenueRows.map((row: any) => ({
    id: row?.id,
    reference: row?.reference,
    customer: row?.customer,
    method: row?.paymentMethod,
    amount: row?.amountPaid,
    status: row?.paymentStatus || row?.status,
    type: row?.paymentMethod === 'wallet' ? 'wallet' : 'adjustment',
    date: row?.date || row?.processedAt || row?.createdAt,
    notes: row?.notes,
    detailPath: row?.detailPath,
  }));

  return sourceRows.map((payment: any) => {
    const revenueRow = revenueById.get(`${payment?.id || ''}`.trim()) || revenueRows.find((candidate: any) => {
      const paymentReference = `${payment?.reference || ''}`.trim();
      const candidateReference = `${candidate?.reference || ''}`.trim();
      return candidate?.id === payment?.id || (paymentReference && candidateReference && paymentReference === candidateReference);
    }) || null;

    const paymentAmount = paymentRows.length
      ? (payment?.amount === null || payment?.amount === undefined ? null : Number(payment.amount))
      : null;

    const notes = payment?.notes
      || revenueRow?.notes
      || payment?.metadata?.notes
      || payment?.gatewayResponse?.notes
      || null;

    return {
      id: String(payment?.id || revenueRow?.id || payment?.reference || '-'),
      paymentDate: String(payment?.date || revenueRow?.date || revenueRow?.paidAt || ''),
      paymentNumber: formatText(payment?.transactionRef || payment?.id || revenueRow?.transactionRef || revenueRow?.id || 'Unavailable'),
      saleNumber: formatText(payment?.reference || revenueRow?.reference || revenueRow?.saleNumber || 'Unavailable'),
      appointmentReference: formatText(revenueRow?.appointmentReference || revenueRow?.reference || payment?.reference || 'Unavailable'),
      customer: formatText(payment?.customer || revenueRow?.customer || 'Unavailable'),
      teamMember: formatText(revenueRow?.employee || payment?.processor || 'Unavailable'),
      location: formatText(revenueRow?.location || 'Unavailable'),
      paymentMethod: formatText(payment?.method || revenueRow?.paymentMethod || 'Unavailable'),
      transactionType: mapTransactionType(payment, revenueRow),
      paymentStatus: formatText(revenueRow?.paymentStatus || payment?.status || 'Unavailable'),
      paymentAmount,
      invoiceNumber: formatText(revenueRow?.invoiceNumber || 'Unavailable'),
      notes: formatText(notes || 'Unavailable'),
      detailPath: payment?.detailPath || revenueRow?.detailPath || null,
      sourcePaymentRow: payment,
      sourceRevenueRow: revenueRow,
    };
  });
}

function buildBackendGaps(rows: PaymentTransactionsTableRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.invoiceNumber === 'Unavailable')) gaps.add('Invoice Number');
  if (rows.some((row) => row.notes === 'Unavailable')) gaps.add('Notes');
  if (rows.some((row) => row.teamMember === 'Unavailable')) gaps.add('Team Member');
  if (rows.some((row) => row.location === 'Unavailable')) gaps.add('Location');
  if (rows.some((row) => row.paymentAmount == null)) gaps.add('Payment Amount');
  return Array.from(gaps);
}

export default function PaymentTransactionsReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'payment-transactions';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PaymentTransactionsPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'paymentDate', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    customer: '',
    employee: '',
    location: '',
    paymentMethod: '',
    transactionType: '',
    paymentStatus: '',
    amountRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<PaymentTransactionsTableRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        const response = await tenantApiAdapter.getFinancialLedger({ startDate: range.from, endDate: range.to });
        const payload = (response?.data || response || {}) as PaymentTransactionsPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load payment transactions report.');
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

  const rows = useMemo(() => buildPaymentTransactionRows(report), [report]);

  const reportDefinition = useMemo(() => {
    const options: PaymentTransactionsReportOptions = {
      customers: dedupeOptions([
        { label: isRtl ? 'جميع العملاء' : 'All Customers', value: '' },
        ...uniqueValues(rows, (row) => row.customer),
      ]),
      employees: dedupeOptions([
        { label: isRtl ? 'جميع الموظفين' : 'All Team Members', value: '' },
        ...uniqueValues(rows, (row) => row.teamMember),
      ]),
      locations: dedupeOptions([
        { label: isRtl ? 'كل المواقع' : 'All Locations', value: '' },
        ...uniqueValues(rows, (row) => row.location),
      ]),
      paymentMethods: dedupeOptions([
        { label: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods', value: '' },
        ...uniqueValues(rows, (row) => row.paymentMethod),
      ]),
      transactionTypes: dedupeOptions([
        { label: isRtl ? 'جميع الأنواع' : 'All Transaction Types', value: '' },
        ...uniqueValues(rows, (row) => row.transactionType),
      ]),
      paymentStatuses: dedupeOptions([
        { label: isRtl ? 'جميع الحالات' : 'All Payment Statuses', value: '' },
        ...uniqueValues(rows, (row) => row.paymentStatus),
      ]),
    };

    return createPaymentTransactionsReportDefinition(options);
  }, [isRtl, rows]);

  const columns = reportDefinition.columns || [];
  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, columns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedCustomer = normalizeText(filterValues.customer);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedLocation = normalizeText(filterValues.location);
    const selectedPaymentMethod = normalizeText(filterValues.paymentMethod);
    const selectedTransactionType = normalizeText(filterValues.transactionType);
    const selectedPaymentStatus = normalizeText(filterValues.paymentStatus);
    const amountRange = typeof filterValues.amountRange === 'object' && filterValues.amountRange
      ? filterValues.amountRange as { min?: string; max?: string }
      : {};
    const min = amountRange.min ? Number(amountRange.min) : null;
    const max = amountRange.max ? Number(amountRange.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.paymentNumber,
          row.saleNumber,
          row.appointmentReference,
          row.customer,
          row.teamMember,
          row.location,
          row.paymentMethod,
          row.transactionType,
          row.paymentStatus,
          row.invoiceNumber,
          row.notes,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedCustomer && normalizeText(row.customer) !== selectedCustomer) return false;
      if (selectedEmployee && normalizeText(row.teamMember) !== selectedEmployee) return false;
      if (selectedLocation && normalizeText(row.location) !== selectedLocation) return false;
      if (selectedPaymentMethod && normalizeText(row.paymentMethod) !== selectedPaymentMethod) return false;
      if (selectedTransactionType && normalizeText(row.transactionType) !== selectedTransactionType) return false;
      if (selectedPaymentStatus && normalizeText(row.paymentStatus) !== selectedPaymentStatus) return false;

      const amount = Number(row.paymentAmount || 0);
      if (min !== null && Number.isFinite(min) && !(Math.abs(amount) >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(Math.abs(amount) <= max)) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const pageSize = reportDefinition.defaultPageSize || 10;
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const overview = report.ledger?.overview || {};
  const paymentTotals = report.ledger?.paymentLedger?.totals || {};

  const kpiItems = [
    { id: 'payment-count', label: 'Payment Count', value: Number(overview.totalTransactions || paymentTotals.totalRows || rows.length || 0).toLocaleString(), note: isRtl ? 'عدد السطور' : 'Transaction count', icon: <CreditCard size={18} /> },
    { id: 'gross-revenue', label: 'Gross Revenue', value: formatMoney(overview.totalRevenue, lang), note: isRtl ? 'الإيراد الخام' : 'Backend revenue total', icon: <TrendingUp size={18} /> },
    { id: 'refunds', label: 'Refunds', value: formatMoney(overview.totalRefunds, lang), note: isRtl ? 'المرتجعات' : 'Refund total', icon: <RefreshCw size={18} /> },
    { id: 'net-collected', label: 'Net Collected', value: formatMoney(overview.netCollected, lang), note: isRtl ? 'المحصلة الصافية' : 'Net collected', icon: <Wallet size={18} /> },
  ];

  const backendGaps = useMemo(() => buildBackendGaps(rows), [rows]);

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
    if (column.id === 'paymentAmount') {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (column.id === 'paymentDate') {
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
            onSaveView={(name) => saveView(name, {
              search,
              datePreset,
              customDateRange,
              filters: filterValues,
              page,
              pageSize,
              sort,
            })}
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
                location: '',
                paymentMethod: '',
                transactionType: '',
                paymentStatus: '',
                amountRange: { min: '', max: '' },
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      table={
        <SectionBlock title="Payment Transactions Table" description="Canonical payment transaction rows sourced from the finance ledger." icon={<FileText size={18} />}>
          <BIDataTable<PaymentTransactionsTableRow>
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
            emptyState={error ? error : 'No payment transactions found for the selected criteria.'}
          />
          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">Missing backend fields: {backendGaps.join(', ')}.</p>
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
          <p>{isRtl ? 'جميع القيم معروضة مباشرة من backend.' : 'All values are rendered directly from the backend.'}</p>
        </div>
      }
    >
      <BIDetailsDrawer<PaymentTransactionsTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.paymentNumber || reportDefinition.title}
        subtitle={drawerRow?.customer || undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => {
          const field = (label: string, value: ReactNode) => (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="text-right font-semibold text-slate-900">{value === null || value === undefined || value === '' ? 'Unavailable' : value}</span>
            </div>
          );

          const timeline = [
            { label: 'Payment Date', value: formatDate(row.paymentDate, lang) },
            { label: 'Payment Status', value: row.paymentStatus || 'Unavailable' },
            { label: 'Transaction Type', value: row.transactionType || 'Unavailable' },
            { label: 'Payment Number', value: row.paymentNumber || 'Unavailable' },
          ];

          return (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                  <div className="mt-3 space-y-2">
                    {field('Payment Number', row.paymentNumber)}
                    {field('Payment Date', formatDate(row.paymentDate, lang))}
                    {field('Transaction Type', row.transactionType)}
                    {field('Payment Status', row.paymentStatus)}
                    {field('Notes', row.notes)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Payment</div>
                  <div className="mt-3 space-y-2">
                    {field('Payment Method', row.paymentMethod)}
                    {field('Payment Amount', formatMoney(row.paymentAmount, lang))}
                    {field('Sale Number', row.saleNumber)}
                    {field('Location', row.location)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer</div>
                  <div className="mt-3 space-y-2">
                    {field('Customer', row.customer)}
                    {field('Team Member', row.teamMember)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Appointment</div>
                  <div className="mt-3 space-y-2">
                    {field('Appointment Reference', row.appointmentReference)}
                    {field('Sale Number', row.saleNumber)}
                    {field('Detail Path', row.detailPath || 'Unavailable')}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Invoice</div>
                  <div className="mt-3 space-y-2">
                    {field('Invoice Number', row.invoiceNumber)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {timeline.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                        <div className="mt-1 font-semibold text-slate-900">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      />
    </BIReportShell>
  );
}
