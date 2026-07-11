import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { BI_DATE_PRESET_OPTIONS, buildExportFileName, downloadCsv, serializeRowsToCsv } from '../../lib/bi';
import type {
  BIColumnPreferenceState,
  BIExportFormat,
  BIDatePresetValue,
  BIReportColumnDefinition,
  BISavedViewSnapshot,
  BIDateRange,
} from '../../lib/bi';
import {
  CalendarDays,
  Download,
  Eye,
  EyeOff,
  Filter,
  Printer,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';

interface BIReportToolbarProps<TRow> {
  reportTitle: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
  rows?: TRow[];
  columns?: BIReportColumnDefinition<TRow>[];
  onExport?: (format: BIExportFormat) => void;
  availableExports?: BIExportFormat[];
  onPrint?: () => void;
  datePreset: BIDatePresetValue;
  onDatePresetChange: (preset: BIDatePresetValue) => void;
  customDateRange: BIDateRange;
  onCustomDateRangeChange: (next: BIDateRange) => void;
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
  savedViews?: BISavedViewSnapshot[];
  onSaveView?: (name: string) => void;
  onLoadSavedView?: (view: BISavedViewSnapshot) => void;
  onDeleteSavedView?: (id: string) => void;
  columnState?: BIColumnPreferenceState;
  onToggleColumn?: (columnId: string) => void;
  onMoveColumn?: (columnId: string, direction: 'up' | 'down') => void;
  onResetColumns?: () => void;
  summary?: ReactNode;
}

export function BIReportToolbar<TRow>({
  reportTitle,
  searchValue,
  onSearchChange,
  onRefresh,
  rows = [],
  columns = [],
  onExport,
  availableExports = ['csv', 'excel', 'pdf', 'print'],
  onPrint,
  datePreset,
  onDatePresetChange,
  customDateRange,
  onCustomDateRangeChange,
  filtersOpen = false,
  onToggleFilters,
  savedViews = [],
  onSaveView,
  onLoadSavedView,
  onDeleteSavedView,
  columnState,
  onToggleColumn,
  onMoveColumn,
  onResetColumns,
  summary,
}: BIReportToolbarProps<TRow>) {
  const [savedViewName, setSavedViewName] = useState('');
  const [openPanel, setOpenPanel] = useState<'saved' | 'columns' | null>(null);

  const visibleColumns = useMemo(() => {
    const hidden = columnState?.hidden || [];
    const order = columnState?.order || [];
    return [...columns]
      .sort((left, right) => {
        const leftIndex = order.indexOf(left.id);
        const rightIndex = order.indexOf(right.id);
        const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return normalizedLeft - normalizedRight;
      })
      .filter((column) => !hidden.includes(column.id));
  }, [columnState?.hidden, columnState?.order, columns]);

  const triggerExport = (format: BIExportFormat) => {
    if (onExport) {
      onExport(format);
      return;
    }

    if (format === 'csv' && rows.length && visibleColumns.length) {
      const csv = serializeRowsToCsv(rows, visibleColumns);
      downloadCsv(buildExportFileName(reportTitle, 'csv'), csv);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            className="h-11 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-500"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={datePreset}
            onChange={(event) => onDatePresetChange(event.target.value as BIDatePresetValue)}
            className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
          >
            {BI_DATE_PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={customDateRange.from}
            onChange={(event) => onCustomDateRangeChange({ ...customDateRange, from: event.target.value })}
            className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
            title="From"
          />
          <input
            type="date"
            value={customDateRange.to}
            onChange={(event) => onCustomDateRangeChange({ ...customDateRange, to: event.target.value })}
            className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
            title="To"
          />

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            type="button"
            onClick={onToggleFilters}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
              filtersOpen
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter size={16} />
            Filters
          </button>

          {availableExports.includes('csv') ? (
            <button
              type="button"
              onClick={() => triggerExport('csv')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download size={16} />
              CSV
            </button>
          ) : null}

          {availableExports.includes('excel') ? (
            <button
              type="button"
              onClick={() => triggerExport('excel')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download size={16} />
              Excel
            </button>
          ) : null}

          {availableExports.includes('pdf') ? (
            <button
              type="button"
              onClick={() => triggerExport('pdf')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download size={16} />
              PDF
            </button>
          ) : null}

          {availableExports.includes('print') ? (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Printer size={16} />
              Print
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setOpenPanel((prev) => (prev === 'saved' ? null : 'saved'))}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
              openPanel === 'saved'
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Save size={16} />
            Saved Views
          </button>

          <button
            type="button"
            onClick={() => setOpenPanel((prev) => (prev === 'columns' ? null : 'columns'))}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
              openPanel === 'columns'
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={16} />
            Columns
          </button>
        </div>
      </div>

      {summary ? <div>{summary}</div> : null}

      {openPanel === 'saved' ? (
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              placeholder="Saved view name"
              className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => {
                if (!savedViewName.trim() || !onSaveView) return;
                onSaveView(savedViewName.trim());
                setSavedViewName('');
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Save size={16} />
              Save current view
            </button>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {savedViews.length ? savedViews.map((view) => (
              <div key={view.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{view.name}</div>
                    <div className="text-xs text-slate-500">{new Date(view.createdAt).toLocaleString()}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteSavedView?.(view.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    title="Delete saved view"
                  >
                    <X size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadSavedView?.(view)}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"
                >
                  Load view
                </button>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No saved views yet.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {openPanel === 'columns' ? (
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Column preferences</div>
              <div className="text-xs text-slate-500">Show, hide, and reorder columns. Preferences persist locally.</div>
            </div>
            <button
              type="button"
              onClick={onResetColumns}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {columns.map((column) => {
              const hidden = columnState?.hidden.includes(column.id);
              return (
                <div key={column.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{column.header}</div>
                      <div className="text-xs text-slate-500">{column.id}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleColumn?.(column.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                      title={hidden ? 'Show column' : 'Hide column'}
                    >
                      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveColumn?.(column.id, 'up')}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ArrowUp size={14} />
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveColumn?.(column.id, 'down')}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ArrowDown size={14} />
                      Down
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
