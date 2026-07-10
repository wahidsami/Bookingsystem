import type { ReactNode } from 'react';
import type { BIReportColumnDefinition, BIReportSortState } from '../../lib/bi';
import { ArrowDown, ArrowUp } from 'lucide-react';

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
  if (loading) {
    return (
      <div className="rounded-[1.25rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading data...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 shadow-sm">
        {emptyState || 'No rows available.'}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => {
                const active = sort?.columnId === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-inherit"
                        onClick={() =>
                          onSortChange({
                            columnId: column.id,
                            direction: active && sort?.direction === 'asc' ? 'desc' : 'asc',
                          })
                        }
                      >
                        <span>{column.header}</span>
                        {active ? sort?.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} /> : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => {
              const key = rowKey ? rowKey(row, index) : String(index);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer transition hover:bg-slate-50' : undefined}
                >
                  {columns.map((column) => {
                    const value = typeof column.accessor === 'function'
                      ? column.accessor(row)
                      : (row as Record<string, unknown>)[column.accessor as string];
                    const content = column.format ? column.format(value, row) : value;
                    return (
                      <td
                        key={column.id}
                        className={`px-4 py-3 text-sm text-slate-700 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                      >
                        {content as ReactNode}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

