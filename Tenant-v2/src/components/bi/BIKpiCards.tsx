import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export interface BIKpiCardItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  delta?: ReactNode;
  tone?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
}

interface BIKpiCardsProps {
  items: BIKpiCardItem[];
}

export function BIKpiCards({ items }: BIKpiCardsProps) {
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {item.label}
              </div>
              <div className="mt-2 text-xl font-black tracking-tight text-slate-900">{item.value}</div>
            </div>
            {item.icon ? <div className="shrink-0 text-slate-500">{item.icon}</div> : null}
          </div>
          {item.delta || item.note ? (
            <div className="mt-3 flex items-center gap-2 text-sm">
              {item.delta ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                    item.tone === 'negative'
                      ? 'bg-rose-50 text-rose-700'
                      : item.tone === 'positive'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.tone === 'negative' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  {item.delta}
                </span>
              ) : null}
              {item.note ? <span className="text-slate-500">{item.note}</span> : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

