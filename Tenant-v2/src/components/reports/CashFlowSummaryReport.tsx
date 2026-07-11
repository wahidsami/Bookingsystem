import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  Sparkles,
  Wallet,
  Banknote,
  DollarSign,
} from 'lucide-react';
import {
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
import { createCashFlowSummaryReportDefinition, type CashFlowSummaryReportOptions, type CashFlowSummaryTableRow } from '../../lib/bi/reports/cashFlowSummary';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type CashFlowPayload = {
  overview?: any;
  ledger?: any;
};

type CashFlowSourceRow = {
  id: string;
  date: string;
  customer: string;
  location: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  amount: number;
  status: string;
  type: string;
  notes: string;
  transactionRef: string;
  reference: string;
  detailPath: string | null;
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

function uniqueValues<T>(rows: T[], accessor: (row: T) => string) {
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

function buildSourceRows(report: CashFlowPayload): CashFlowSourceRow[] {
  const revenueRows = Array.isArray(report.ledger?.revenueLedger?.rows) ? report.ledger.revenueLedger.rows : [];
  const paymentRows = Array.isArray(report.ledger?.paymentLedger?.rows) ? report.ledger.paymentLedger.rows : [];

  const revenueById = new Map<string, any>();
  const revenueByReference = new Map<string, any>();
  revenueRows.forEach((row: any) => {
    const idKey = `${row?.id || ''}`.trim();
    const referenceKey = `${row?.reference || ''}`.trim();
    if (idKey) revenueById.set(idKey, row);
    if (referenceKey) revenueByReference.set(referenceKey, row);
  });

  return paymentRows.map((paymentRow: any) => {
    const paymentKey = `${paymentRow?.id || ''}`.trim();
    const referenceKey = `${paymentRow?.reference || ''}`.trim();
    const revenueRow = revenueById.get(paymentKey) || revenueByReference.get(referenceKey) || null;

    return {
      id: paymentKey || referenceKey || `${paymentRow?.date || ''}`.trim() || '-',
      date: String(paymentRow?.date || revenueRow?.date || revenueRow?.processedAt || revenueRow?.createdAt || ''),
      customer: `${paymentRow?.customer || revenueRow?.customer || 'Unavailable'}`.trim() || 'Unavailable',
      location: `${revenueRow?.location || 'Unavailable'}`.trim() || 'Unavailable',
      paymentMethod: `${paymentRow?.paymentMethod || paymentRow?.method || ''}`.trim(),
      paymentMethodLabel: `${paymentRow?.method || paymentRow?.paymentMethod || ''}`.trim() || 'Unavailable',
      amount: Number(paymentRow?.amount ?? revenueRow?.revenue ?? revenueRow?.amountPaid ?? 0),
      status: `${paymentRow?.status || revenueRow?.paymentStatus || revenueRow?.status || 'Unavailable'}`.trim() || 'Unavailable',
      type: `${paymentRow?.type || revenueRow?.type || paymentRow?.transactionType || ''}`.trim() || 'Unavailable',
      notes: `${paymentRow?.notes || revenueRow?.notes || 'Unavailable'}`.trim() || 'Unavailable',
      transactionRef: `${paymentRow?.transactionRef || revenueRow?.transactionRef || paymentRow?.id || revenueRow?.id || 'Unavailable'}`.trim() || 'Unavailable',
      reference: `${paymentRow?.reference || revenueRow?.reference || 'Unavailable'}`.trim() || 'Unavailable',
      detailPath: paymentRow?.detailPath || revenueRow?.detailPath || null,
    };
  });
}

function normalizePaymentMethodGroup(method: unknown): 'cash' | 'card' | 'online' | 'wallet' | 'bank_transfer' | 'other' {
  const value = `${method ?? ''}`.trim().toLowerCase();
  if (['cash', 'pay_on_visit', 'cash_on_delivery'].includes(value)) return 'cash';
  if (['card_pos', 'card'].includes(value)) return 'card';
  if (value === 'online') return 'online';
  if (value === 'wallet') return 'wallet';
  if (value === 'bank_transfer') return 'bank_transfer';
  return 'other';
}

function groupLabel(date: Date, grouping: 'day' | 'week' | 'month') {
  if (grouping === 'month') {
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }

  if (grouping === 'week') {
    const day = date.getDay();
    const diff = (day + 6) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toISOString().split('T')[0]} → ${end.toISOString().split('T')[0]}`;
  }

  return date.toISOString().split('T')[0];
}

function groupStart(date: Date, grouping: 'day' | 'week' | 'month') {
  const start = new Date(date);
  if (grouping === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (grouping === 'week') {
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setHours(0, 0, 0, 0);
  return start;
}

function groupEnd(start: Date, grouping: 'day' | 'week' | 'month') {
  const end = new Date(start);
  if (grouping === 'month') {
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  if (grouping === 'week') {
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  end.setHours(23, 59, 59, 999);
  return end;
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
  rows: CashFlowSummaryTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: CashFlowSummaryTableRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: CashFlowSummaryTableRow, column: { accessor: any; format?: (value: unknown, row: CashFlowSummaryTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof CashFlowSummaryTableRow];
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

function buildCashFlowRows(report: CashFlowPayload, grouping: 'day' | 'week' | 'month'): CashFlowSummaryTableRow[] {
  const settlementRows = Array.isArray(report.ledger?.settlementLedger?.rows)
    ? report.ledger.settlementLedger.rows
    : [];
  const paymentRows = Array.isArray(report.ledger?.paymentLedger?.rows)
    ? report.ledger.paymentLedger.rows
    : [];

  const buckets = new Map<string, CashFlowSummaryTableRow>();

  settlementRows.forEach((row: any) => {
    const rawDate = new Date(String(row?.date || ''));
    if (Number.isNaN(rawDate.getTime())) {
      return;
    }

    const start = groupStart(rawDate, grouping);
    const end = groupEnd(start, grouping);
    const key = `${start.toISOString().split('T')[0]}:${grouping}`;
    const existing = buckets.get(key) || {
      id: key,
      period: groupLabel(rawDate, grouping),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      openingBalance: null,
      cashIn: 0,
      cashOut: 0,
      netMovement: 0,
      closingBalance: null,
      cashPayments: 0,
      cardPayments: 0,
      onlinePayments: 0,
      walletPayments: 0,
      bankTransferPayments: 0,
      transactionCount: 0,
      sourceRows: [],
    };

    existing.cashIn += Number(row?.grossRevenue || 0);
    existing.cashOut += Number(row?.refunds || 0);
    existing.netMovement += Number(row?.netCollected || 0);
    existing.cashPayments += Number(row?.cash || 0);
    existing.cardPayments += Number(row?.card || 0);
    existing.walletPayments += Number(row?.wallet || 0);
    existing.sourceRows = [...(existing.sourceRows || []), row];
    buckets.set(key, existing);
  });

  paymentRows.forEach((row: any) => {
    const rawDate = new Date(String(row?.date || row?.processedAt || row?.createdAt || ''));
    if (Number.isNaN(rawDate.getTime())) {
      return;
    }

    const start = groupStart(rawDate, grouping);
    const end = groupEnd(start, grouping);
    const key = `${start.toISOString().split('T')[0]}:${grouping}`;
    const existing = buckets.get(key) || {
      id: key,
      period: groupLabel(rawDate, grouping),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      openingBalance: null,
      cashIn: 0,
      cashOut: 0,
      netMovement: 0,
      closingBalance: null,
      cashPayments: 0,
      cardPayments: 0,
      onlinePayments: 0,
      walletPayments: 0,
      bankTransferPayments: 0,
      transactionCount: 0,
      sourceRows: [],
    };

    const amount = Math.abs(Number(row?.amount || 0));
    const method = normalizePaymentMethodGroup(row?.paymentMethod || row?.method);
    if (method === 'online') existing.onlinePayments += amount;
    if (method === 'bank_transfer') existing.bankTransferPayments += amount;
    existing.sourceRows = [...(existing.sourceRows || []), row];
    existing.transactionCount += 1;
    buckets.set(key, existing);
  });

  return Array.from(buckets.values())
    .sort((left, right) => right.periodStart.localeCompare(left.periodStart))
    .map((row) => ({
      ...row,
      cashIn: Number(row.cashIn.toFixed(2)),
      cashOut: Number(row.cashOut.toFixed(2)),
      netMovement: Number(row.netMovement.toFixed(2)),
      cashPayments: Number(row.cashPayments.toFixed(2)),
      cardPayments: Number(row.cardPayments.toFixed(2)),
      onlinePayments: Number(row.onlinePayments.toFixed(2)),
      walletPayments: Number(row.walletPayments.toFixed(2)),
      bankTransferPayments: Number(row.bankTransferPayments.toFixed(2)),
    }));
}

function buildOptions(sourceRows: CashFlowSourceRow[], isRtl: boolean): CashFlowSummaryReportOptions {
  const paymentMethods = dedupeOptions([
    { label: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods', value: '' },
    ...uniqueValues(sourceRows, (row) => `${row?.paymentMethodLabel || row?.paymentMethod || ''}`),
  ]);

  const locations = dedupeOptions([
    { label: isRtl ? 'كل المواقع' : 'All Locations', value: '' },
    ...uniqueValues(sourceRows, (row) => `${row?.location || ''}`),
  ]);

  const groupings = dedupeOptions([
    { label: isRtl ? 'اليوم' : 'Day', value: 'day' },
    { label: isRtl ? 'الأسبوع' : 'Week', value: 'week' },
    { label: isRtl ? 'الشهر' : 'Month', value: 'month' },
  ]);

  return { paymentMethods, locations, groupings };
}

function buildBackendGaps(rows: CashFlowSummaryTableRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.openingBalance == null)) gaps.add('Opening Balance');
  if (rows.some((row) => row.closingBalance == null)) gaps.add('Closing Balance');
  return Array.from(gaps);
}

function sortRows(rows: CashFlowSummaryTableRow[], sort: BIReportSortState) {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = left[sort.columnId as keyof CashFlowSummaryTableRow];
    const rightValue = right[sort.columnId as keyof CashFlowSummaryTableRow];

    if (sort.columnId === 'period') {
      return left.periodStart.localeCompare(right.periodStart) * direction;
    }

    const leftNumber = typeof leftValue === 'number' ? leftValue : Number(leftValue ?? 0);
    const rightNumber = typeof rightValue === 'number' ? rightValue : Number(rightValue ?? 0);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return (leftNumber - rightNumber) * direction;
    }

    return `${leftValue ?? ''}`.localeCompare(`${rightValue ?? ''}`) * direction;
  });
}

export default function CashFlowSummaryReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'cash-flow-summary';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CashFlowPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'period', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    grouping: 'day',
    paymentMethod: '',
    location: '',
  });
  const [drawerRow, setDrawerRow] = useState<CashFlowSummaryTableRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        const response = await tenantApiAdapter.getFinancialLedger({ startDate: range.from, endDate: range.to });
        const payload = (response?.data || response || {}) as CashFlowPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load cash flow summary report.');
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

  const rawRows = useMemo(() => {
    const grouping = `${filterValues.grouping || 'day'}` as 'day' | 'week' | 'month';
    return buildCashFlowRows(report, grouping);
  }, [filterValues.grouping, report]);

  const sourceRows = useMemo(() => buildSourceRows(report), [report]);
  const reportDefinition = useMemo(() => createCashFlowSummaryReportDefinition(buildOptions(sourceRows, isRtl)), [isRtl, sourceRows]);
  const columns = reportDefinition.columns || [];
  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, columns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedPaymentMethod = normalizeText(filterValues.paymentMethod);
    const selectedLocation = normalizeText(filterValues.location);

    return rawRows.filter((row) => {
      if (q) {
        const text = [
          row.period,
          row.periodStart,
          row.periodEnd,
          row.cashIn,
          row.cashOut,
          row.netMovement,
          row.cashPayments,
          row.cardPayments,
          row.onlinePayments,
          row.walletPayments,
          row.bankTransferPayments,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedPaymentMethod) {
        const matched = (row.sourceRows || []).some((sourceRow) => normalizeText(sourceRow?.paymentMethod) === selectedPaymentMethod);
        if (!matched) return false;
      }
      if (selectedLocation) {
        const matched = (row.sourceRows || []).some((sourceRow) => normalizeText(sourceRow?.location) === selectedLocation);
        if (!matched) return false;
      }

      return true;
    });
  }, [filterValues.grouping, filterValues.location, filterValues.paymentMethod, rawRows, search]);

  const sortedRows = useMemo(() => sortRows(filteredRows, sort), [filteredRows, sort]);
  const pageSize = reportDefinition.defaultPageSize || 10;
  const totalPages = Math.max(Math.ceil(sortedRows.length / pageSize), 1);
  const paginatedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const backendGaps = useMemo(() => buildBackendGaps(rawRows), [rawRows]);

  const kpiItems = [
    { id: 'periods', label: 'Periods', value: Number(rawRows.length || 0).toLocaleString(), note: isRtl ? 'إجمالي الفترات' : 'Grouped periods', icon: <CalendarDays size={18} /> },
    { id: 'cash-in', label: 'Cash In', value: formatMoney(rawRows.reduce((sum, row) => sum + Number(row.cashIn || 0), 0), lang), note: isRtl ? 'المتحصلات' : 'Total inflows', icon: <Banknote size={18} /> },
    { id: 'cash-out', label: 'Cash Out', value: formatMoney(rawRows.reduce((sum, row) => sum + Number(row.cashOut || 0), 0), lang), note: isRtl ? 'المدفوعات الخارجة' : 'Total outflows', icon: <Wallet size={18} /> },
    { id: 'net-movement', label: 'Net Movement', value: formatMoney(rawRows.reduce((sum, row) => sum + Number(row.netMovement || 0), 0), lang), note: isRtl ? 'الصافي' : 'Net movement', icon: <DollarSign size={18} /> },
  ];

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(String(reportDefinition.title), 'csv'), serializeRowsToCsv(sortedRows, visibleColumns));
      return;
    }

    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(String(reportDefinition.title), 'excel'),
        serializeRowsToCsv(sortedRows, visibleColumns),
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
      rows: sortedRows,
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
    if (column.id !== 'period') {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
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
            rows={sortedRows}
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
      table={
        <SectionBlock title="Cash Flow Table" description="Canonical financial movement rows built from the finance ledger." icon={<FileText size={18} />}>
          <BIDataTable<CashFlowSummaryTableRow>
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
            emptyState={error ? error : 'No cash flow rows found for the selected criteria.'}
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
          totalItems={sortedRows.length}
        />
      }
      footer={
        <div className="space-y-2">
          <p>{reportDefinition.footer}</p>
          <p>{isRtl ? 'لا يتم احتساب الأرصدة في الواجهة الأمامية.' : 'Balances are not calculated in the frontend.'}</p>
        </div>
      }
    >
      <BIDetailsDrawer<CashFlowSummaryTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.period || reportDefinition.title}
        subtitle={drawerRow ? `${drawerRow.transactionCount} transactions` : undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => {
          const timeline = row.sourceRows || [];
          const field = (label: string, value: ReactNode) => (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="text-right font-semibold text-slate-900">{value === null || value === undefined || value === '' ? 'Unavailable' : value}</span>
            </div>
          );

          return (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                  <div className="mt-3 space-y-2">
                    {field('Period', row.period)}
                    {field('Grouping', `${filterValues.grouping || 'day'}`.toUpperCase())}
                    {field('Transactions', row.transactionCount.toLocaleString())}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Opening Balance</div>
                  <div className="mt-3 space-y-2">
                    {field('Opening Balance', 'Unavailable')}
                    {field('Closing Balance', 'Unavailable')}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Inflows</div>
                  <div className="mt-3 space-y-2">
                    {field('Cash In', formatMoney(row.cashIn, lang))}
                    {field('Cash Payments', formatMoney(row.cashPayments, lang))}
                    {field('Card Payments', formatMoney(row.cardPayments, lang))}
                    {field('Online Payments', formatMoney(row.onlinePayments, lang))}
                    {field('Wallet Payments', formatMoney(row.walletPayments, lang))}
                    {field('Bank Transfer Payments', formatMoney(row.bankTransferPayments, lang))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Outflows</div>
                  <div className="mt-3 space-y-2">
                    {field('Cash Out', formatMoney(row.cashOut, lang))}
                    {field('Net Movement', formatMoney(row.netMovement, lang))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Payment Breakdown</div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {[
                      ['Cash', row.cashPayments],
                      ['Card', row.cardPayments],
                      ['Online', row.onlinePayments],
                      ['Wallet', row.walletPayments],
                      ['Bank Transfer', row.bankTransferPayments],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatMoney(value, lang)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Start</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatDate(row.periodStart, lang)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">End</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatDate(row.periodEnd, lang)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source Rows</div>
                      <div className="mt-1 font-semibold text-slate-900">{timeline.length.toLocaleString()}</div>
                    </div>
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
