import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CreditCard, DollarSign, Filter, FileText, RefreshCw, Sparkles, TrendingUp, Wallet, Banknote, BadgeInfo } from 'lucide-react';
import {
  BIChartContainer,
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
import { createFinanceOverviewReportDefinition, type FinanceOverviewTableRow } from '../../lib/bi/reports/financeOverview';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type FinanceOverviewRow = FinanceOverviewTableRow & {
  paymentStatus?: string;
  paymentMethodLabel?: string;
  sourceRow?: any;
};

type FinanceOverviewPayload = {
  overview?: any;
  ledger?: any;
  dailyRevenue?: any;
  paymentMethods?: any;
};

interface FinanceOverviewReportProps {
  lang: Language;
}

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

function dedupeBIOptions(options: BIOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const nextValue = `${option.value ?? ''}`.trim();
    if (!nextValue) return false;
    if (seen.has(nextValue)) return false;
    seen.add(nextValue);
    return true;
  });
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
  if (!rows.length) {
    return <div className="flex h-56 items-center justify-center text-sm text-slate-500">No chart data.</div>;
  }

  const series = buildSeriesPoints(rows, valueKey, labelKey);

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient id="finance-line-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#finance-line-gradient)"
          stroke="#1d4ed8"
          strokeWidth="1.8"
          points={`0,100 ${series.points} 100,100`}
        />
        {series.points.split(' ').filter(Boolean).map((point, index) => {
          const [x, y] = point.split(',').map(Number);
          return <circle key={`${point}-${index}`} cx={x} cy={y} r="1.7" fill="#1d4ed8" />;
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
      {rows.slice(0, 6).map((row, index) => {
        const value = Number(row?.[valueKey] || 0);
        const width = `${Math.max((value / max) * 100, 4)}%`;
        return (
            <div key={`${row?.id || row?.[labelKey] || 'row'}-${index}`} className="space-y-1">
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
  );
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

function toOption(label: unknown, value: unknown): BIOption | null {
  const nextLabel = `${label ?? ''}`.trim();
  const nextValue = `${value ?? ''}`.trim();
  if (!nextLabel || !nextValue) return null;
  return { label: nextLabel, value: nextValue };
}

function buildFinanceRows(data: FinanceOverviewPayload): FinanceOverviewRow[] {
  const revenueRows = Array.isArray(data.ledger?.revenueLedger?.rows) ? data.ledger.revenueLedger.rows : [];
  return revenueRows.map((row: any) => ({
    id: String(row?.id || row?.reference || row?.entityId || row?.date || '-'),
    transactionId: String(row?.id || row?.reference || '-'),
    date: row?.date || row?.processedAt || row?.createdAt || '',
    reference: `${row?.reference || row?.entityId || '-'}`.trim() || '-',
    customer: `${row?.customer || '-'}`.trim() || '-',
    employee: `${row?.employee || '-'}`.trim() || '-',
    service: `${row?.service || row?.entityType || '-'}`.trim() || '-',
    paymentMethod: `${row?.paymentMethodLabel || row?.paymentMethod || '-'}`.trim() || '-',
    revenue: row?.revenue == null ? null : Number(row.revenue),
    tax: row?.tax == null ? null : Number(row.tax),
    discount: row?.discount == null ? null : Number(row.discount),
    status: `${row?.status || '-'}`.trim() || '-',
    source: `${row?.entityType || '-'}`.trim() || '-',
    entityType: `${row?.entityType || '-'}`.trim() || '-',
    entityId: row?.entityId || null,
    detailPath: row?.detailPath || null,
    notes: row?.status || null,
    paymentMethodLabel: row?.paymentMethodLabel || row?.paymentMethod || '-',
    sourceRow: row,
  }));
}

export default function FinanceOverviewReport({ lang }: FinanceOverviewReportProps) {
  const isRtl = lang === 'ar';
  const reportId = 'finance-overview';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FinanceOverviewPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'date', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    employee: '',
    paymentMethod: '',
    status: '',
    source: '',
    refundsOnly: false,
    amountRange: { min: '', max: '' },
  });
  const [drawerRow, setDrawerRow] = useState<FinanceOverviewRow | null>(null);

  const rows = useMemo(() => buildFinanceRows(report), [report]);

  const definitionOptions = useMemo(() => {
    const paymentMethods = dedupeBIOptions([
      { label: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods', value: '' },
      ...(report.paymentMethods?.rows || [])
        .map((item: any) => toOption(item.paymentMethodLabel || item.paymentMethod || '-', item.paymentMethod || '-'))
        .filter(Boolean) as BIOption[]
    ]);

    const statuses = dedupeBIOptions([
      { label: isRtl ? 'جميع الحالات' : 'All Statuses', value: '' },
      ...Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).map((value) => ({ label: String(value), value: String(value) }))
    ]);

    const sources = dedupeBIOptions([
      { label: isRtl ? 'جميع المصادر' : 'All Sources', value: '' },
      ...Array.from(new Set(rows.map((row) => row.source).filter(Boolean))).map((value) => ({ label: String(value), value: String(value) }))
    ]);

    const employees = dedupeBIOptions([
      { label: isRtl ? 'جميع الموظفين' : 'All Employees', value: '' },
      ...Array.from(new Set(rows.map((row) => row.employee).filter(Boolean))).map((value) => ({ label: String(value), value: String(value) }))
    ]);

    return { paymentMethods, statuses, sources, employees };
  }, [isRtl, report.paymentMethods?.rows, rows]);

  const reportDefinition = useMemo(
    () => createFinanceOverviewReportDefinition({
      paymentMethods: definitionOptions.paymentMethods,
      statuses: definitionOptions.statuses,
      sources: definitionOptions.sources,
      employees: definitionOptions.employees,
    }),
    [definitionOptions]
  );
  const reportTitle = String(reportDefinition.title || 'Finance Overview');
  const reportDescription = String(reportDefinition.description || '');
  useEffect(() => {
    setPageSize(reportDefinition.defaultPageSize || 8);
  }, [reportDefinition.defaultPageSize]);

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, reportDefinition.columns || []);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        const [overviewRes, ledgerRes, dailyRes, paymentMethodsRes] = await Promise.all([
          tenantApiAdapter.getFinancialOverview({ startDate: range.from, endDate: range.to }),
          tenantApiAdapter.getFinancialLedger({ startDate: range.from, endDate: range.to }),
          tenantApiAdapter.getDailyRevenue({ startDate: range.from, endDate: range.to }),
          tenantApiAdapter.getPaymentMethodsReport(range.from, range.to),
        ]);

        if (!cancelled) {
          setReport({
            overview: overviewRes?.overview || overviewRes?.data || overviewRes || {},
            ledger: ledgerRes || {},
            dailyRevenue: dailyRes?.dailyRevenue || dailyRes?.data || dailyRes || [],
    paymentMethods: {
              rows: paymentMethodsRes?.data || [],
              totals: paymentMethodsRes?.totals || null,
              trend: paymentMethodsRes?.trend || []
            },
          });
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load finance overview.');
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

  const overview = report.overview || {};
  const ledger = report.ledger || {};
  const dailyRevenue = report.dailyRevenue || [];
  const paymentMethodRows = report.paymentMethods?.rows || [];
  const settlementRows = ledger?.settlementLedger?.rows || [];
  const refundRows = ledger?.refundLedger?.rows || [];
  const paymentLedgerRows = ledger?.paymentLedger?.rows || [];
  const summaryNetCollected = ledger?.overview?.netCollected ?? overview?.netCollected ?? 0;
  const outstanding = overview?.pendingPayments ?? 0;

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedPaymentMethod = normalizeText(filterValues.paymentMethod);
    const selectedStatus = normalizeText(filterValues.status);
    const selectedSource = normalizeText(filterValues.source);
    const refundsOnly = Boolean(filterValues.refundsOnly);
    const amountRange = typeof filterValues.amountRange === 'object' && filterValues.amountRange
      ? filterValues.amountRange as { min?: string; max?: string }
      : {};
    const min = amountRange.min ? Number(amountRange.min) : null;
    const max = amountRange.max ? Number(amountRange.max) : null;

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.transactionId,
          row.reference,
          row.customer,
          row.employee,
          row.service,
          row.paymentMethod,
          row.status,
          row.source,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedEmployee && normalizeText(row.employee) !== selectedEmployee) return false;
      if (selectedPaymentMethod && normalizeText(row.paymentMethod) !== selectedPaymentMethod) return false;
      if (selectedStatus && normalizeText(row.status) !== selectedStatus) return false;
      if (selectedSource && normalizeText(row.source) !== selectedSource) return false;
      if (refundsOnly && !(Number(row.revenue || 0) < 0 || normalizeText(row.status).includes('refund'))) return false;
      if (min !== null && Number.isFinite(min) && !(Math.abs(Number(row.revenue || 0)) >= min)) return false;
      if (max !== null && Number.isFinite(max) && !(Math.abs(Number(row.revenue || 0)) <= max)) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const paymentTrendRows = useMemo(() => dailyRevenue, [dailyRevenue]);

  const backendGaps = useMemo(() => {
    const gaps = new Set<string>();
    if (rows.some((row) => !row.reference || row.reference === '-')) gaps.add('Invoice');
    return Array.from(gaps);
  }, [rows]);

  const exportRows = filteredRows;
  const reportGapMessage = backendGaps.length ? `Backend gaps: ${backendGaps.join(', ')}` : null;

  const kpiItems = [
    { id: 'gross-sales', label: 'Gross Sales', value: formatMoney(overview.totalRevenue, lang), note: isRtl ? 'الإيراد الخام' : 'Gross sales', icon: <TrendingUp size={18} /> },
    { id: 'net-sales', label: 'Net Sales', value: formatMoney(overview.netRevenue, lang), note: isRtl ? 'صافي الإيراد' : 'Net sales', icon: <DollarSign size={18} /> },
    { id: 'total-payments', label: 'Total Payments', value: Number(overview.totalTransactions || 0).toLocaleString(), note: isRtl ? 'عدد عمليات الدفع' : 'Payment transaction count', icon: <CreditCard size={18} /> },
    { id: 'outstanding', label: 'Outstanding', value: formatMoney(outstanding, lang), note: isRtl ? 'المبالغ المستحقة' : 'Pending payments', icon: <Wallet size={18} /> },
    { id: 'refunds', label: 'Refunds', value: formatMoney(overview.totalRefunds, lang), note: isRtl ? 'المرتجعات' : 'Refunds', icon: <RefreshCw size={18} /> },
    { id: 'taxes', label: 'Taxes', value: formatMoney(overview.totalTax, lang), note: isRtl ? 'الضرائب' : 'Taxes', icon: <FileText size={18} /> },
    { id: 'discounts', label: 'Discounts', value: formatMoney(overview.totalDiscountAmount, lang), note: isRtl ? 'الخصومات' : 'Discounts', icon: <Filter size={18} /> },
    { id: 'net-collected', label: 'Net Collected', value: formatMoney(summaryNetCollected, lang), note: isRtl ? 'المحصلة الصافية' : 'Net collected', icon: <Banknote size={18} /> },
  ];

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
    printWindow.document.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
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
          <h1>${reportTitle}</h1>
          <p>${reportDescription}</p>
          <table>
            <thead>
              <tr>${visibleColumns.map((column) => `<th>${column.header}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${exportRows.map((row) => `
                <tr>
                  ${visibleColumns.map((column) => {
                    const rawValue = typeof column.accessor === 'function'
                      ? column.accessor(row)
                      : row[column.accessor as keyof FinanceOverviewRow];
                    const text = typeof rawValue === 'number' ? formatMoney(rawValue, lang) : `${rawValue ?? '-'}`;
                    return `<td>${text}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
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
                employee: '',
                paymentMethod: '',
                status: '',
                source: '',
                refundsOnly: false,
                amountRange: { min: '', max: '' },
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
          <SectionBlock title="Finance Charts" description="Backend-driven finance trends and balances." icon={<Sparkles size={18} />}>
            <div className="grid gap-4 xl:grid-cols-2">
              <BIChartContainer>
                <MiniLineChart rows={paymentTrendRows} valueKey="revenue" labelKey="date" />
              </BIChartContainer>
              <BIChartContainer>
                <MiniBarChart rows={paymentMethodRows} labelKey="paymentMethodLabel" valueKey="revenue" />
              </BIChartContainer>
              <BIChartContainer>
                <MiniBarChart rows={settlementRows} labelKey="date" valueKey="netCollected" />
              </BIChartContainer>
              <BIChartContainer>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{isRtl ? 'المحصلة' : 'Collected'}</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{formatMoney(summaryNetCollected, lang)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{isRtl ? 'المستحق' : 'Outstanding'}</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{formatMoney(outstanding, lang)}</div>
                  </div>
                </div>
              </BIChartContainer>
            </div>
          </SectionBlock>
        </div>
      }
      table={
        <SectionBlock title="Finance Table" description="Canonical transaction rows sourced from the finance ledger." icon={<FileText size={18} />}>
          <BIDataTable<FinanceOverviewRow>
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
            emptyState={error ? error : 'No finance rows found for the selected criteria.'}
          />
          {reportGapMessage ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">{reportGapMessage}</p>
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
      footer={
        <div className="space-y-2">
          <p>{reportDefinition.footer}</p>
          <p>{isRtl ? 'جميع القيم المالية معروضة مباشرة من backend.' : 'Every financial value is rendered directly from the backend.'}</p>
        </div>
      }
    >
      <BIDetailsDrawer<FinanceOverviewRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.transactionId || reportTitle}
        subtitle={drawerRow?.customer || undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => {
          const matchingPayments = paymentLedgerRows.filter((entry: any) => `${entry.reference || ''}`.trim() === `${row.reference || ''}`.trim());
          const matchingRefunds = refundRows.filter((entry: any) => `${entry.reference || ''}`.trim() === `${row.reference || ''}`.trim());
          const timeline = [
            { label: 'Created', value: formatDate(row.date, lang) },
            { label: 'Status', value: row.status || '-' },
            { label: 'Source', value: row.source || '-' },
            { label: 'Reference', value: row.reference || '-' },
          ];

          const field = (label: string, value: ReactNode) => (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="text-right font-semibold text-slate-900">{value === null || value === undefined || value === '' ? '-' : value}</span>
            </div>
          );

          return (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Payment History</div>
                  <div className="mt-3 space-y-2">
                    {matchingPayments.length ? matchingPayments.map((item: any) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="font-semibold text-slate-900">{item.paymentMethodLabel || item.paymentMethod || '-'}</div>
                        <div className="mt-1 text-slate-500">{formatDate(item.date, lang)} | {formatMoney(item.amount, lang)} | {item.status || '-'}</div>
                      </div>
                    )) : <div className="text-sm text-slate-500">No payment history available.</div>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Transactions</div>
                  <div className="mt-3 space-y-2">
                    {field('Transaction ID', row.transactionId)}
                    {field('Reference', row.reference)}
                    {field('Customer', row.customer)}
                    {field('Employee', row.employee)}
                    {field('Service / Order', row.service)}
                    {field('Payment Method', row.paymentMethod)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Appointment Linkage</div>
                  <div className="mt-3 space-y-2">
                    {field('Entity Type', row.entityType)}
                    {field('Entity ID', row.entityId || '-')}
                    {field('Detail Path', row.detailPath || '-')}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Invoice</div>
                  <div className="mt-3 space-y-2">
                    {field('Invoice Number', '-')}
                    {field('Invoice Status', row.status)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Refund History</div>
                  <div className="mt-3 space-y-2">
                    {matchingRefunds.length ? matchingRefunds.map((item: any) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="font-semibold text-slate-900">{item.methodLabel || item.method || '-'}</div>
                        <div className="mt-1 text-slate-500">{formatDate(item.date, lang)} | {formatMoney(item.amount, lang)} | {item.refundMode || '-'}</div>
                      </div>
                    )) : <div className="text-sm text-slate-500">No refund history available.</div>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Discounts and Taxes</div>
                  <div className="mt-3 space-y-2">
                    {field('Discount', formatMoney(row.discount, lang))}
                    {field('Tax', formatMoney(row.tax, lang))}
                    {field('Revenue', formatMoney(row.revenue, lang))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Audit Timeline</div>
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
