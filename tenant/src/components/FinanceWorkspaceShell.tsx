'use client';

import { ReactNode } from 'react';

export type FinanceSidebarItem = {
  id: string;
  label: string;
  description?: string;
  badge?: ReactNode;
};

export type FinanceSidebarGroup = {
  title: string;
  items: FinanceSidebarItem[];
};

type MetricTone = 'neutral' | 'green' | 'blue' | 'purple' | 'amber' | 'rose';

type FinanceWorkspaceShellProps = {
  title: string;
  subtitle?: string;
  locale: string;
  sidebarGroups: FinanceSidebarGroup[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  quickRanges?: Array<{
    id: string;
    label: string;
    onClick: () => void;
    active?: boolean;
  }>;
  actions?: ReactNode;
  toolbarExtras?: ReactNode;
  children: ReactNode;
};

const toneClasses: Record<MetricTone, string> = {
  neutral: 'border-gray-200 bg-white text-gray-900',
  green: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
  blue: 'border-sky-200 bg-sky-50/70 text-sky-900',
  purple: 'border-violet-200 bg-violet-50/70 text-violet-900',
  amber: 'border-amber-200 bg-amber-50/70 text-amber-900',
  rose: 'border-rose-200 bg-rose-50/70 text-rose-900'
};

export function FinanceWorkspaceShell({
  title,
  subtitle,
  locale,
  sidebarGroups,
  activeSection,
  onSectionChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  quickRanges,
  actions,
  toolbarExtras,
  children
}: FinanceWorkspaceShellProps) {
  const isRTL = locale === 'ar';

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-20 rounded-3xl border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
        <div className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {locale === 'ar' ? 'التقارير والتحليلات' : 'Reporting & analytics'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-3xl text-sm text-gray-600">{subtitle}</p> : null}
          </div>

          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {actions}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)] xl:overflow-y-auto rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-5">
            {sidebarGroups.map((group) => (
              <section key={group.title}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {group.title}
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const active = item.id === activeSection;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSectionChange(item.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-start transition-all ${
                          active
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div>
                            <div className={`font-semibold ${active ? 'text-primary-700' : 'text-gray-900'}`}>
                              {item.label}
                            </div>
                            {item.description ? (
                              <div className="mt-1 text-xs leading-5 text-gray-500">{item.description}</div>
                            ) : null}
                          </div>
                          {item.badge ? (
                            <div className="shrink-0 text-xs font-semibold text-gray-500">{item.badge}</div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="sticky top-24 z-10 rounded-3xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur">
            <div className={`flex flex-col gap-4 ${isRTL ? 'lg:[direction:rtl]' : ''}`}>
              <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'justify-end' : ''}`}>
                {quickRanges?.map((range) => (
                  <button
                    key={range.id}
                    type="button"
                    onClick={range.onClick}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      range.active
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 ${isRTL ? 'md:[direction:rtl]' : ''}`}>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {locale === 'ar' ? 'من تاريخ' : 'Start date'}
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => onStartDateChange(event.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {locale === 'ar' ? 'إلى تاريخ' : 'End date'}
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => onEndDateChange(event.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <div className="xl:col-span-2 flex items-end gap-2">
                  {toolbarExtras}
                </div>
              </div>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}

export function FinanceMetricCard({
  label,
  value,
  note,
  tone = 'neutral'
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: MetricTone;
}) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {note ? <div className="mt-2 text-xs font-medium text-gray-500">{note}</div> : null}
    </div>
  );
}

export function FinanceSectionCard({
  title,
  subtitle,
  action,
  children,
  className = ''
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FinanceEmptyState({
  title,
  description,
  icon = '—'
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        {icon}
      </div>
      <p className="text-base font-bold text-gray-900">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}
