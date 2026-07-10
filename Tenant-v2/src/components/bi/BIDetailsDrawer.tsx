import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BIDetailsDrawerProps<TRow> {
  open: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  row: TRow | null;
  onClose: () => void;
  renderContent: (row: TRow) => ReactNode;
  actions?: ReactNode;
}

export function BIDetailsDrawer<TRow>({
  open,
  title,
  subtitle,
  row,
  onClose,
  renderContent,
  actions,
}: BIDetailsDrawerProps<TRow>) {
  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-[140]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[42rem] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-xl font-black tracking-tight text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{renderContent(row)}</div>
      </div>
    </div>
  );
}

