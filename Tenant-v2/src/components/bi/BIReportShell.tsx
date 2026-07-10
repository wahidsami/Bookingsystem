import type { ReactNode } from 'react';

interface BIReportShellProps {
  title: ReactNode;
  description?: ReactNode;
  toolbar?: ReactNode;
  kpis?: ReactNode;
  charts?: ReactNode;
  table?: ReactNode;
  pagination?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function BIReportShell({
  title,
  description,
  toolbar,
  kpis,
  charts,
  table,
  pagination,
  footer,
  className = '',
}: BIReportShellProps) {
  return (
    <div className={`space-y-5 ${className}`.trim()}>
      <section className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {toolbar ? <div>{toolbar}</div> : null}
      </section>

      {kpis ? <section>{kpis}</section> : null}
      {charts ? <section>{charts}</section> : null}
      {table ? <section>{table}</section> : null}
      {pagination ? <section>{pagination}</section> : null}
      {footer ? <footer className="text-sm text-slate-500">{footer}</footer> : null}
    </div>
  );
}

