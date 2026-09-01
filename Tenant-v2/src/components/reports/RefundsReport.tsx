import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CreditCard,
  RefreshCw,
  Users,
  FileText,
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
import { createRefundsReportDefinition, type RefundsReportOptions, type RefundsTableRow } from '../../lib/bi/reports/refundsReportDef';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type RefundsPayload = {
  data?: any[];
  totals?: any;
};

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return `${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;
}

function formatNumber(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : '-';
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

function uniqueValues(rows: RefundsTableRow[], accessor: (row: RefundsTableRow) => string) {
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
  rows: RefundsTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: RefundsTableRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: RefundsTableRow, column: { accessor: any; format?: (value: unknown, row: RefundsTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : (row as any)[column.accessor];
    const formatted = column.format ? column.format(rawValue, row) : rawValue;
    if (formatted === null || formatted === undefined || formatted === '') return '-';
    if (typeof formatted === 'number') return formatNumber(formatted);
    return `${formatted}`;
  };

  const html = `
    <!DOCTYPE html>
    <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
    <head>
      <title>${title}</title>
      <style>
        body { font-family: system-ui, sans-serif; color: #171717; padding: 2rem; margin: 0; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #000; }
        p { color: #525252; margin-bottom: 2rem; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
        th { text-align: ${lang === 'ar' ? 'right' : 'left'}; border-bottom: 2px solid #e5e5e5; padding: 0.75rem; color: #525252; font-size: 0.875rem; }
        td { border-bottom: 1px solid #e5e5e5; padding: 0.75rem; font-size: 0.875rem; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>${description}</p>
      <table>
        <thead>
          <tr>${columns.map((col) => `<th>${col.header}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${columns.map((col) => `<td>${renderValue(row, col)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <div style="font-size: 0.75rem; color: #737373; text-align: center;">Generated on ${new Date().toLocaleString()}</div>
    </body>
    </html>
  `;
  return html;
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
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value === null || value === undefined || value === '' ? '-' : value}</span>
    </div>
  );
}

export default function RefundsReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'refunds-report';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RefundsPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'date', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    paymentMethod: '',
    refundMode: '',
  });
  const [drawerRow, setDrawerRow] = useState<RefundsTableRow | null>(null);

  useBIReportRefreshSignal(() => setRefreshTick((tick) => tick + 1));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = resolveBIDateRange(datePreset, customDateRange);
        // Using existing endpoint: /api/tenant/reports/refunds
        const response = await tenantApiAdapter.getRefundsReport(
          range.from,
          range.to
        );
        const payload = (response?.data || response || {}) as RefundsPayload;
        // if API returns { success, data, totals } then report is response
        if (!cancelled) {
          setReport(response);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load refunds report.');
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

  const rows = useMemo(() => {
    const dataRows = Array.isArray(report?.data) ? report.data : [];
    return dataRows.map((item: any) => ({
      id: item.id || '-',
      date: item.date || item.createdAt || '',
      customer: item.customer || '-',
      reference: item.reference || item.invoiceNumber || '-',
      paymentMethod: item.paymentMethod || '-',
      paymentMethodLabel: item.paymentMethodLabel || item.paymentMethod || '-',
      reason: item.refundReason || item.notes || '-',
      employee: item.employee || '-',
      refundMode: item.refundMode || '-',
      status: item.status || '-',
      amount: item.amount != null ? Number(item.amount) : null,
      sourceRow: item,
    }));
  }, [report]);

  const reportDefinition = useMemo(() => {
    const paymentMethodOptions = dedupeOptions([
      { label: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods', value: '' },
      ...uniqueValues(rows, (row) => row.paymentMethodLabel),
    ]);
    const refundModeOptions = dedupeOptions([
      { label: isRtl ? 'جميع الحالات' : 'All Modes', value: '' },
      ...uniqueValues(rows, (row) => row.refundMode),
    ]);

    const options: RefundsReportOptions = {
      paymentMethods: paymentMethodOptions,
      refundModes: refundModeOptions,
    };

    return createRefundsReportDefinition(options);
  }, [isRtl, rows]);

  useEffect(() => {
    setPageSize(reportDefinition.defaultPageSize || 10);
  }, [reportDefinition.defaultPageSize]);

  const columns = reportDefinition.columns || [];
  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, columns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedPaymentMethod = normalizeText(filterValues.paymentMethod);
    const selectedRefundMode = normalizeText(filterValues.refundMode);

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.customer,
          row.reference,
          row.reason,
          row.employee,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedPaymentMethod && normalizeText(row.paymentMethodLabel) !== selectedPaymentMethod) return false;
      if (selectedRefundMode && normalizeText(row.refundMode) !== selectedRefundMode) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aVal = (a as any)[sort.columnId];
      const bVal = (b as any)[sort.columnId];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined || aVal === 'Unavailable') return 1;
      if (bVal === null || bVal === undefined || bVal === 'Unavailable') return -1;

      if (sort.columnId === 'date') {
        const d1 = new Date(aVal).getTime();
        const d2 = new Date(bVal).getTime();
        return sort.direction === 'asc' ? d1 - d2 : d2 - d1;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sort.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredRows, sort]);

  const totalPages = Math.max(Math.ceil(sortedRows.length / pageSize), 1);
  const paginatedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const totals = report.totals || {};
  const totalAmount = Number(totals.totalRefunds ?? rows.reduce((sum, row) => sum + Number(row?.amount || 0), 0));
  const totalRows = rows.length;

  const kpiItems = [
    { id: 'refund-rows', label: 'Total Refunds', value: totalRows.toLocaleString(), note: isRtl ? 'الصفوف المفصلة' : 'Refund transactions', icon: <RefreshCw size={18} /> },
    { id: 'amount', label: 'Refund Amount', value: formatMoney(totalAmount, lang), note: isRtl ? 'المبلغ المسترد' : 'Total refunded amount', icon: <CreditCard size={18} /> },
    { id: 'customers', label: 'Customers', value: new Set(rows.map(r => r.customer).filter(c => c && c !== '-')).size.toLocaleString(), note: isRtl ? 'عملاء' : 'Unique customers', icon: <Users size={18} /> },
  ];

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    const baseColumns = visibleColumns.map((col) => {
      let formatFn: undefined | ((val: unknown, row: any) => string) = undefined;
      if (col.id === 'amount') formatFn = (val) => Number(val || 0).toFixed(2);
      else if (col.id === 'date') formatFn = (val) => val ? new Date(String(val)).toLocaleString('en-GB') : '';
      return {
        header: col.header as string,
        accessor: col.accessor as any,
        format: formatFn,
      };
    });

    if (format === 'csv' || format === 'excel') {
      const csvContent = serializeRowsToCsv(sortedRows, baseColumns);
      downloadCsv(csvContent, buildExportFileName('Refunds', format));
    } else if (format === 'print' || format === 'pdf') {
      const html = buildPrintHtml({
        title: 'Refunds Report',
        description: 'Detailed report of all processed refunds.',
        rows: sortedRows,
        columns: baseColumns,
        lang,
      });
      if (format === 'print') {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.setTimeout(() => {
            win.print();
            win.close();
          }, 250);
        }
      } else {
        downloadTextFile(html, `Refunds_Report_${new Date().toISOString().split('T')[0]}.html`, 'text/html');
      }
    }
  };

  return (
    <BIReportShell
      title={reportDefinition.title}
      description={reportDefinition.description}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar<RefundsTableRow>
            reportTitle={String(reportDefinition.title)}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={() => setRefreshTick((tick) => tick + 1)}
            rows={filteredRows}
            columns={columns}
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
              setSearch(view.query.search || '');
              setDatePreset(view.query.datePreset || 'last_30_days');
              setCustomDateRange(view.query.customDateRange || { from: '', to: '' });
              setFilterValues(view.query.filters || { paymentMethod: '', refundMode: '' });
              setPage(view.query.page || 1);
              setSort(view.query.sort || { columnId: 'date', direction: 'desc' });
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
                paymentMethod: '',
                refundMode: '',
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      table={
        <SectionBlock title="Refunds Log" description="Detailed operational audit trail of refunds." icon={<FileText size={18} />}>
          <BIDataTable<RefundsTableRow>
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
            emptyState={error ? error : 'No refunds found for the selected criteria.'}
          />
        </SectionBlock>
      }
      pagination={
        <BIPagination
          page={page}
          totalPages={totalPages}
          totalItems={filteredRows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      }
    >
      {drawerRow && (
        <BIDetailsDrawer<RefundsTableRow>
          title="Refund Details"
          open={!!drawerRow}
          onClose={() => setDrawerRow(null)}
          row={drawerRow}
          renderContent={(row) => (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Transaction</div>
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-neutral-50 p-4 border border-neutral-100">
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Date</div>
                  <div className="font-mono text-sm font-semibold">{formatDate(drawerRow.date, lang)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Reference</div>
                  <div className="font-mono text-sm font-semibold">{drawerRow.reference}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Payment Method</div>
                  <div className="font-semibold text-sm">{drawerRow.paymentMethodLabel}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Status</div>
                  <div className="font-semibold text-sm text-rose-600">{drawerRow.status}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Customer & Operator</div>
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-neutral-50 p-4 border border-neutral-100">
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Customer</div>
                  <div className="font-semibold text-sm">{drawerRow.customer}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Operator</div>
                  <div className="font-semibold text-sm">{drawerRow.employee}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Refund Summary</div>
              <div className="rounded-xl bg-rose-50 p-4 border border-rose-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-rose-900">Total Refund</span>
                  <span className="font-mono text-xl font-bold text-rose-600">
                    -{formatMoney(drawerRow.amount, lang)}
                  </span>
                </div>
                <div className="pt-3 border-t border-rose-200">
                  <div className="text-[11px] text-rose-700 mb-1">Reason</div>
                  <div className="text-sm text-rose-900 font-medium">{drawerRow.reason || 'None provided'}</div>
                </div>
              </div>
            </div>
          </div>
        )} />
      )}
    </BIReportShell>
  );
}
