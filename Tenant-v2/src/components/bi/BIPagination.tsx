import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BIPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  className?: string;
}

export function BIPagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  className = '',
}: BIPaginationProps) {
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={`flex flex-col gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      <div className="text-sm text-slate-500">
        {typeof totalItems === 'number' ? `${totalItems} item${totalItems === 1 ? '' : 's'}` : 'Pagination'}
        {typeof pageSize === 'number' ? ` · ${pageSize} per page` : ''}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Prev
        </button>
        <span className="min-w-20 text-center text-sm font-semibold text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

