import { useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Minus, Rows3 } from 'lucide-react';
import type { BIReportColumnDefinition, BIReportSortState } from '../../lib/bi';

interface BIDataTableProps<TRow> {
  rows: TRow[];
  columns: BIReportColumnDefinition<TRow>[];
  rowKey?: (row: TRow, index: number) => string;
  loading?: boolean;
  emptyState?: ReactNode;
  sort?: BIReportSortState;
  onSortChange?: (next: BIReportSortState) => void;
  onRowClick?: (row: TRow) => void;
}

type RowDensity = 'comfortable' | 'dense';

type ResizingState = {
  columnId: string;
  startX: number;
  startWidth: number;
} | null;

function parseColumnWidth(value?: string | number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value.replace(/px$/i, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function LoadingSkeleton({ columns, density }: { columns: BIReportColumnDefinition<unknown>[]; density: RowDensity }) {
  const rowHeight = density === 'dense' ? 'py-2.5' : 'py-4';
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur">
            <tr className="border-b border-slate-200">
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-slate-100">
                {columns.map((column) => (
                  <td key={column.id} className={`px-4 ${rowHeight}`}>
                    <div
                      className={`h-3 animate-pulse rounded-full bg-slate-100 ${
                        column.align === 'right' ? 'ml-auto w-20' : column.align === 'center' ? 'mx-auto w-16' : 'w-32'
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyStateCard({ title, description, emptyState }: { title: string; description: string; emptyState?: ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Minus size={18} />
      </div>
      <div className="mt-4 text-lg font-black tracking-tight text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {emptyState ? <div className="mt-4 text-sm font-semibold text-slate-700">{emptyState}</div> : null}
    </div>
  );
}

export function BIDataTable<TRow>({
  rows,
  columns,
  rowKey,
  loading = false,
  emptyState,
  sort,
  onSortChange,
  onRowClick,
}: BIDataTableProps<TRow>) {
  const [density, setDensity] = useState<RowDensity>('comfortable');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<ResizingState>(null);

  useEffect(() => {
    setColumnWidths((current) => {
      const next = { ...current };
      columns.forEach((column) => {
        if (next[column.id] !== undefined) return;
        const parsedWidth = parseColumnWidth(column.width);
        if (parsedWidth) next[column.id] = parsedWidth;
      });
      return next;
    });
  }, [columns]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const active = resizeRef.current;
      if (!active) return;

      const delta = event.clientX - active.startX;
      const nextWidth = Math.max(active.startWidth + delta, 96);
      setColumnWidths((current) => ({ ...current, [active.columnId]: nextWidth }));
    };

    const handleUp = () => {
      resizeRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, []);

  const visibleColumns = useMemo(() => columns, [columns]);
  const rowDensityClass = density === 'dense' ? 'px-3 py-2.5 text-[13px]' : 'px-4 py-3.5 text-sm';
  const valueAlignmentClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'right') return 'text-right tabular-nums';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  const beginResize = (columnId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    const width = columnWidths[columnId] || parseColumnWidth(columns.find((column) => column.id === columnId)?.width) || 160;
    resizeRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: width,
    };
    event.preventDefault();
    event.stopPropagation();
  };

  const renderTable = (body: ReactNode) => (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">Table view</div>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700">
          <button
            type="button"
            onClick={() => setDensity('comfortable')}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition ${
              density === 'comfortable' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Rows3 size={14} />
            Comfortable
          </button>
          <button
            type="button"
            onClick={() => setDensity('dense')}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition ${
              density === 'dense' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Rows3 size={14} />
            Dense
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {body}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Table view</div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <ChevronsUpDown size={14} />
            Loading
          </div>
        </div>
        <div className="overflow-x-auto">
          <LoadingSkeleton columns={visibleColumns} density={density} />
        </div>
      </div>
    );
  }

  if (!rows.length) {
    const emptyTitle = typeof emptyState === 'string' ? emptyState : 'No records found';
    const emptyDescription = emptyTitle.toLowerCase().includes('match')
      ? 'Try adjusting your filters or search criteria.'
      : 'Try adjusting your filters, search terms, or date range.';
    return renderTable(
      <EmptyStateCard title={emptyTitle} description={emptyDescription} emptyState={typeof emptyState === 'string' ? undefined : emptyState} />
    );
  }

  return renderTable(
    <table className="min-w-full border-separate border-spacing-0">
      <colgroup>
        {visibleColumns.map((column) => (
          <col key={column.id} style={columnWidths[column.id] ? { width: `${columnWidths[column.id]}px` } : column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur">
        <tr>
          {visibleColumns.map((column) => {
            const active = sort?.columnId === column.id;
            const width = columnWidths[column.id] ? { width: `${columnWidths[column.id]}px` } : column.width ? { width: column.width } : undefined;
            return (
              <th
                key={column.id}
                scope="col"
                className={`group relative border-b border-slate-200 bg-slate-50/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${valueAlignmentClass(column.align)}`}
                style={width}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{column.header}</span>
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-full border px-2 py-1 transition ${
                        active ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-700'
                      }`}
                      onClick={() =>
                        onSortChange({
                          columnId: column.id,
                          direction: active && sort?.direction === 'asc' ? 'desc' : 'asc',
                        })
                      }
                      title={active ? `Sort ${sort?.direction === 'asc' ? 'descending' : 'ascending'}` : 'Sort column'}
                    >
                      {active ? sort?.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} /> : <ChevronsUpDown size={13} />}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Resize ${String(column.header)}`}
                  className="absolute right-0 top-0 h-full w-3 cursor-col-resize touch-none text-slate-300 opacity-0 transition group-hover:opacity-100"
                  onPointerDown={(event) => beginResize(column.id, event)}
                >
                  <span className="absolute inset-y-2 right-1 flex w-px justify-center bg-slate-200" />
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="bg-white">
        {rows.map((row, index) => {
          const key = rowKey ? rowKey(row, index) : String(index);
          return (
            <tr
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'group cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40' : 'border-b border-slate-100 transition hover:bg-slate-50'}
            >
              {visibleColumns.map((column) => {
                const value = typeof column.accessor === 'function'
                  ? column.accessor(row)
                  : (row as Record<string, unknown>)[column.accessor as string];
                const content = column.format ? column.format(value, row) : value;
                const width = columnWidths[column.id] ? { width: `${columnWidths[column.id]}px` } : column.width ? { width: column.width } : undefined;

                return (
                  <td
                    key={column.id}
                    className={`${rowDensityClass} ${valueAlignmentClass(column.align)} border-b border-slate-100 text-slate-700 last:border-r-0`}
                    style={width}
                  >
                    <div className="min-w-0 break-words">{content as ReactNode}</div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
