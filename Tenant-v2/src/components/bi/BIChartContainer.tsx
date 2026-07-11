import type { ReactNode } from 'react';

interface BIChartContainerProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function BIChartContainer({ title, description, children }: BIChartContainerProps) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
      {(title || description) ? (
        <header className="mb-4">
          {title ? <h2 className="text-lg font-bold text-slate-900">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </header>
      ) : null}
      <div className="min-h-[200px]">{children}</div>
    </section>
  );
}

