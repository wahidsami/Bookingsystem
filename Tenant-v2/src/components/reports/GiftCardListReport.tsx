import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CreditCard,
  FileText,
  Gift,
  RefreshCw,
  Sparkles,
  Clock,
  Users,
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
  createGiftCardListReportDefinition,
  type GiftCardListReportOptions,
  type GiftCardListTableRow,
} from '../../lib/bi/reports/giftCardList';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type GiftCardListPayload = {
  giftCards?: any[];
  giftCardSummary?: any;
  transactions?: any[];
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

function humanizeStatus(value: unknown): string {
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

function uniqueValues(rows: GiftCardListTableRow[], accessor: (row: GiftCardListTableRow) => string) {
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
  rows: GiftCardListTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: GiftCardListTableRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: GiftCardListTableRow, column: { accessor: any; format?: (value: unknown, row: GiftCardListTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof GiftCardListTableRow];
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

function buildGiftCardRows(report: GiftCardListPayload): GiftCardListTableRow[] {
  const giftCardRows = Array.isArray(report.giftCards) && report.giftCards.length
    ? report.giftCards
    : Array.isArray(report.transactions)
      ? report.transactions
      : [];

  return giftCardRows.map((row: any) => ({
    id: String(row?.id || row?.giftCardCode || row?.saleNumber || row?.sourceTransaction?.id || '-'),
    giftCardCode: formatText(row?.giftCardCode || row?.code || row?.sourceTransaction?.giftCardCode || 'Unavailable'),
    saleNumber: formatText(row?.saleNumber || row?.sourceTransaction?.id || 'Unavailable'),
    purchasedBy: formatText(row?.purchasedBy || row?.sourceTransaction?.metadata?.createdByLabel || row?.sourceTransaction?.metadata?.paymentCollectedByLabel || 'Unavailable'),
    redeemedBy: formatText(row?.redeemedBy || 'Unavailable'),
    customer: formatText(row?.customer || 'Unavailable'),
    status: humanizeStatus(row?.status),
    issueDate: row?.issueDate || row?.createdAt || row?.sourceTransaction?.createdAt || null,
    expiryDate: row?.expiryDate || row?.expiresAt || row?.sourceTransaction?.expiresAt || null,
    originalAmount: row?.originalAmount === null || row?.originalAmount === undefined ? null : Number(row.originalAmount),
    redeemedAmount: row?.redeemedAmount === null || row?.redeemedAmount === undefined ? null : Number(row.redeemedAmount),
    remainingBalance: row?.remainingBalance === null || row?.remainingBalance === undefined ? null : Number(row.remainingBalance),
    invoiceNumber: formatText(row?.invoiceNumber || row?.sourceTransaction?.metadata?.invoiceNumber || 'Unavailable'),
    location: formatText(row?.location || 'Unavailable'),
    employee: formatText(row?.employee || row?.purchasedBy || 'Unavailable'),
    paymentMethod: formatText(row?.paymentMethod || 'Unavailable'),
    sourceTransaction: row?.sourceTransaction || row,
    redemptions: Array.isArray(row?.redemptions) ? row.redemptions : [],
    latestRedemption: row?.latestRedemption || null,
  }));
}

function buildGiftCardBackendGaps(rows: GiftCardListTableRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.invoiceNumber === 'Unavailable')) gaps.add('Invoice Number');
  if (rows.some((row) => row.originalAmount == null)) gaps.add('Original Amount');
  if (rows.some((row) => row.redeemedAmount == null)) gaps.add('Redeemed Amount');
  if (rows.some((row) => row.remainingBalance == null)) gaps.add('Remaining Balance');
  return Array.from(gaps);
}

export default function GiftCardListReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'gift-card-list';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GiftCardListPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'issueDate', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    status: '',
    customer: '',
    employee: '',
    location: '',
    giftCardCode: '',
  });
  const [drawerRow, setDrawerRow] = useState<GiftCardListTableRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        const query = new URLSearchParams({
          startDate: range.from,
          endDate: range.to,
          limit: '1000',
        }).toString();
        const response = await tenantApiAdapter.get(`/tenant/gift-cards/reports/transactions${query ? `?${query}` : ''}`);
        const payload = (response?.data || response || {}) as GiftCardListPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load gift card list report.');
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

  const rows = useMemo(() => buildGiftCardRows(report), [report]);

  const definitionOptions = useMemo(() => {
    const statuses = dedupeOptions([
      { label: isRtl ? 'جميع الحالات' : 'All Statuses', value: '' },
      ...uniqueValues(rows, (row) => row.status).map((option) => ({ label: humanizeStatus(option.value), value: option.value })),
    ]);
    const customers = dedupeOptions([
      { label: isRtl ? 'جميع العملاء' : 'All Customers', value: '' },
      ...uniqueValues(rows, (row) => row.customer),
    ]);
    const employees = dedupeOptions([
      { label: isRtl ? 'جميع الموظفين' : 'All Employees', value: '' },
      ...uniqueValues(rows, (row) => row.employee),
    ]);
    const locations = dedupeOptions([
      { label: isRtl ? 'كل المواقع' : 'All Locations', value: '' },
      ...uniqueValues(rows, (row) => row.location),
    ]);
    const giftCardCodes = dedupeOptions([
      { label: isRtl ? 'جميع الرموز' : 'All Gift Card Codes', value: '' },
      ...uniqueValues(rows, (row) => row.giftCardCode),
    ]);

    const options: GiftCardListReportOptions = {
      statuses,
      customers,
      employees,
      locations,
      giftCardCodes,
    };

    return options;
  }, [isRtl, rows]);

  const reportDefinition = useMemo(
    () => createGiftCardListReportDefinition(definitionOptions),
    [definitionOptions]
  );
  useEffect(() => {
    setPageSize(reportDefinition.defaultPageSize || 10);
  }, [reportDefinition.defaultPageSize]);

  const columns = reportDefinition.columns || [];

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedStatus = normalizeText(filterValues.status);
    const selectedCustomer = normalizeText(filterValues.customer);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedLocation = normalizeText(filterValues.location);
    const selectedGiftCardCode = normalizeText(filterValues.giftCardCode);

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.giftCardCode,
          row.saleNumber,
          row.purchasedBy,
          row.redeemedBy,
          row.customer,
          row.status,
          row.invoiceNumber,
          row.location,
          row.employee,
          row.paymentMethod,
          row.issueDate,
          row.expiryDate,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedStatus && normalizeText(row.status) !== selectedStatus) return false;
      if (selectedCustomer && normalizeText(row.customer) !== selectedCustomer) return false;
      if (selectedEmployee && normalizeText(row.employee) !== selectedEmployee) return false;
      if (selectedLocation && normalizeText(row.location) !== selectedLocation) return false;
      if (selectedGiftCardCode && normalizeText(row.giftCardCode) !== selectedGiftCardCode) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const summary = report.giftCardSummary || {};
  const kpiItems = [
    { id: 'gift-cards', label: 'Gift Cards', value: Number(summary.totalGiftCards ?? rows.length ?? 0).toLocaleString(), note: isRtl ? 'إجمالي البطاقات' : 'Total cards', icon: <Gift size={18} /> },
    { id: 'original-amount', label: 'Original Amount', value: formatMoney(summary.totalOriginalAmount, lang), note: isRtl ? 'القيمة الأصلية' : 'Original amount', icon: <CreditCard size={18} /> },
    { id: 'redeemed-amount', label: 'Redeemed Amount', value: formatMoney(summary.totalRedeemedAmount, lang), note: isRtl ? 'المبلغ المسترد' : 'Redeemed amount', icon: <RefreshCw size={18} /> },
    { id: 'remaining-balance', label: 'Remaining Balance', value: formatMoney(summary.totalRemainingBalance, lang), note: isRtl ? 'الرصيد المتبقي' : 'Remaining balance', icon: <Wallet size={18} /> },
    { id: 'issued', label: 'Issued', value: Number(summary.issuedCount ?? rows.filter((row) => normalizeText(row.status).includes('issued') || normalizeText(row.status).includes('purchased')).length ?? 0).toLocaleString(), note: isRtl ? 'بطاقات صادرة' : 'Issued cards', icon: <Sparkles size={18} /> },
    { id: 'redeemed', label: 'Redeemed', value: Number(summary.redeemedCount ?? rows.filter((row) => normalizeText(row.status).includes('redeemed')).length ?? 0).toLocaleString(), note: isRtl ? 'بطاقات مستردة' : 'Redeemed cards', icon: <Users size={18} /> },
    { id: 'partial', label: 'Partially Redeemed', value: Number(summary.partiallyRedeemedCount ?? rows.filter((row) => normalizeText(row.status).includes('partially')).length ?? 0).toLocaleString(), note: isRtl ? 'استرداد جزئي' : 'Partially redeemed', icon: <Clock size={18} /> },
    { id: 'expired', label: 'Expired', value: Number(summary.expiredCount ?? rows.filter((row) => normalizeText(row.status).includes('expired')).length ?? 0).toLocaleString(), note: isRtl ? 'منتهية الصلاحية' : 'Expired cards', icon: <AlertTriangle size={18} /> },
  ];

  const backendGaps = useMemo(() => buildGiftCardBackendGaps(rows), [rows]);

  const tableColumns = useMemo(() => columns.map((column) => {
    if (['originalAmount', 'redeemedAmount', 'remainingBalance'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (['issueDate', 'expiryDate'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatDate(value, lang) };
    }
    return column;
  }), [columns, lang]);

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, tableColumns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

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
                status: '',
                customer: '',
                employee: '',
                location: '',
                giftCardCode: '',
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      table={
        <SectionBlock title="Gift Card Table" description="Canonical gift card ledger rows from the production tenant ledger." icon={<Gift size={18} />}>
          <BIDataTable<GiftCardListTableRow>
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
            emptyState={error ? error : 'No gift cards found for the selected criteria.'}
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
      <BIDetailsDrawer<GiftCardListTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.giftCardCode || String(reportDefinition.title)}
        subtitle={drawerRow?.customer || undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Gift Card Code" value={row.giftCardCode} />
                  <Field label="Status" value={row.status} />
                  <Field label="Issue Date" value={formatDate(row.issueDate, lang)} />
                  <Field label="Expiry Date" value={formatDate(row.expiryDate, lang)} />
                  <Field label="Original Amount" value={formatMoney(row.originalAmount, lang)} />
                  <Field label="Remaining Balance" value={formatMoney(row.remainingBalance, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Purchase</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Sale Number" value={row.saleNumber} />
                  <Field label="Purchased By" value={row.purchasedBy} />
                  <Field label="Payment Method" value={row.paymentMethod} />
                  <Field label="Location" value={row.location} />
                  <Field label="Employee" value={row.employee} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Redemption</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Redeemed By" value={row.redeemedBy} />
                  <Field label="Redeemed Amount" value={formatMoney(row.redeemedAmount, lang)} />
                  <Field label="Redemptions Count" value={String(row.redemptions?.length || 0)} />
                  <Field label="Latest Redemption" value={formatDate(row.latestRedemption?.redeemedAt || row.latestRedemption?.createdAt, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Customer" value={row.customer} />
                  <Field label="Purchased For" value={row.customer} />
                  <Field label="Redeemed For" value={row.customer} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Invoice</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Invoice Number" value={row.invoiceNumber} />
                  <Field label="Source Transaction" value={row.sourceTransaction?.id || 'Unavailable'} />
                  <Field label="Payment Method" value={row.paymentMethod} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Issued At" value={formatDate(row.issueDate, lang)} />
                  <Field label="Latest Redemption At" value={formatDate(row.latestRedemption?.redeemedAt || row.latestRedemption?.createdAt, lang)} />
                  <Field label="Last Updated" value={formatDate(row.sourceTransaction?.updatedAt || row.sourceTransaction?.createdAt, lang)} />
                  <Field label="Backend Updated" value={formatDate(row.sourceTransaction?.updatedAt || row.sourceTransaction?.createdAt, lang)} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row.sourceTransaction || row, null, 2)}</pre>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}
