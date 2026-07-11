import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

interface BIPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  totalItems?: number;
  className?: string;
  pageSizeOptions?: number[];
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

export function BIPagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  className = '',
  pageSizeOptions = [10, 25, 50, 100],
}: BIPaginationProps) {
  const currentPage = clampPage(page, totalPages);
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;
  const totalRows = typeof totalItems === 'number' ? totalItems : 0;
  const fromRow = totalRows ? (currentPage - 1) * (pageSize || 0) + 1 : 0;
  const toRow = totalRows ? Math.min(currentPage * (pageSize || totalRows), totalRows) : 0;

  const navigate = (nextPage: number) => {
    onPageChange(clampPage(nextPage, totalPages));
  };

  return (
    <div className={`rounded-[1rem] border border-slate-200 bg-white px-4 py-3 shadow-sm ${className}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <div className="font-semibold text-slate-700">
            {totalRows.toLocaleString()} row{totalRows === 1 ? '' : 's'}
          </div>
          {pageSize ? (
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
                className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="rounded-full bg-slate-50 px-3 py-1.5 font-semibold text-slate-700">
            {totalRows ? `${fromRow.toLocaleString()}–${toRow.toLocaleString()} of ${totalRows.toLocaleString()}` : 'No rows to display'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={!canPrev}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronsLeft size={16} />
            First
          </button>
          <button
            type="button"
            onClick={() => navigate(currentPage - 1)}
            disabled={!canPrev}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <div className="min-w-24 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-semibold text-slate-700">
            {currentPage.toLocaleString()} / {Math.max(totalPages, 1).toLocaleString()}
          </div>
          <button
            type="button"
            onClick={() => navigate(currentPage + 1)}
            disabled={!canNext}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => navigate(totalPages)}
            disabled={!canNext}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Last
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
