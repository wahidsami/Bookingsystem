'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { adminApi } from '@/lib/api';
import { AnalyticsDetailsDrawer, AnalyticsDrilldownEntity } from '@/components/AnalyticsDetailsDrawer';

type InsightAlert = {
  key: string;
  category: string;
  title: string;
  severity: 'critical' | 'high' | 'warning' | 'info';
  tone: 'positive' | 'negative' | 'neutral';
  explanation: string;
  suggestedAction: string;
  currentValue: number;
  previousValue: number;
  change: {
    current: number;
    previous: number;
    delta: number;
    percentage: number;
    direction: 'up' | 'down' | 'flat';
  };
  entity?: AnalyticsDrilldownEntity;
  filters?: Record<string, string>;
  details?: Array<Record<string, any>>;
};

type InsightsResponse = {
  window: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  };
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
  };
  alerts: InsightAlert[];
  signals: any;
};

type DrilldownConfig = {
  entity: AnalyticsDrilldownEntity;
  title: string;
  description?: string;
  defaultFilters?: Record<string, string>;
};

const severityClasses: Record<InsightAlert['severity'], string> = {
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
};

const severityCounts = ['critical', 'high', 'warning', 'info'] as const;

const formatMoney = (value: number) =>
  `SAR ${(Number(value) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`;

const formatPercent = (value: number) => `${(Number(value) || 0).toFixed(1)}%`;

export default function FinancialInsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [severityFilter, setSeverityFilter] = useState<'all' | InsightAlert['severity']>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [drilldown, setDrilldown] = useState<DrilldownConfig | null>(null);

  useEffect(() => {
    loadInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const startDate = format(subDays(new Date(), parseInt(period, 10)), "yyyy-MM-dd'T'00:00:00'Z'");
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");
      const response = await adminApi.getOperationalInsights(startDate, endDate);
      if (response.success) {
        setData(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operational insights');
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    data?.alerts.forEach((alert) => categories.add(alert.category));
    return Array.from(categories);
  }, [data]);

  const filteredAlerts = (data?.alerts || []).filter((alert) => {
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesCategory = categoryFilter === 'all' || alert.category === categoryFilter;
    const haystack = `${alert.title} ${alert.explanation} ${alert.suggestedAction} ${alert.category}`.toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.toLowerCase());
    return matchesSeverity && matchesCategory && matchesSearch;
  });

  const openDrilldown = (alert: InsightAlert) => {
    if (!alert.entity) return;

    setDrilldown({
      entity: alert.entity,
      title: alert.title,
      description: alert.explanation,
      defaultFilters: alert.filters,
    });
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-white/5" />;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>;
  }

  const summary = data?.summary || {
    totalAlerts: 0,
    criticalAlerts: 0,
    highAlerts: 0,
    warningAlerts: 0,
    infoAlerts: 0,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 shadow-2xl shadow-sky-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300/70">Operational Intelligence</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Insights & Alerts</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              Monitor revenue, retention, staffing, bookings, cancellations, and product sales from the existing analytics datasets.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
            >
              <option value="7" className="bg-slate-900">Last 7 days</option>
              <option value="30" className="bg-slate-900">Last 30 days</option>
              <option value="90" className="bg-slate-900">Last 90 days</option>
              <option value="365" className="bg-slate-900">Last year</option>
            </select>
            <button
              type="button"
              onClick={loadInsights}
              className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {severityCounts.map((key) => (
            <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">{key} alerts</p>
              <p className="mt-2 text-2xl font-bold text-white">{summary[`${key}Alerts` as keyof typeof summary] || 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search alert, explanation, or action"
          className="w-full rounded-xl border border-white/10 bg-dark-900 px-4 py-2 text-sm text-white placeholder:text-white/35 lg:max-w-md"
        />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
          className="rounded-xl border border-white/10 bg-dark-900 px-4 py-2 text-sm text-white"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-dark-900 px-4 py-2 text-sm text-white"
        >
          <option value="all">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <div className="text-sm text-white/55">
          Showing {filteredAlerts.length} of {data?.alerts.length || 0} alerts
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredAlerts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60 xl:col-span-2">
            No alerts match the current filters.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <article
              key={alert.key}
              className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/20 transition hover:border-white/20"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{alert.title}</h2>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${severityClasses[alert.severity]}`}>
                      {alert.severity}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                      {alert.category}
                    </span>
                  </div>
                  <p className="text-sm text-white/70">{alert.explanation}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Change</p>
                  <p className={`mt-1 text-lg font-semibold ${alert.change.direction === 'down' ? 'text-rose-300' : alert.change.direction === 'up' ? 'text-emerald-300' : 'text-white'}`}>
                    {alert.change.direction === 'up' ? '+' : alert.change.direction === 'down' ? '-' : ''}
                    {Math.abs(alert.change.percentage).toFixed(1)}%
                  </p>
                  <p className="text-xs text-white/45">
                    {alert.change.previous.toLocaleString('en-US')} → {alert.change.current.toLocaleString('en-US')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Suggested action</p>
                  <p className="mt-2 text-sm text-white/80">{alert.suggestedAction}</p>
                  {alert.details?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {alert.details.slice(0, 3).map((item) => (
                        <span key={`${alert.key}-${item.id || item.name}`} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                          {item.name || item.title || item.id}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  {alert.entity ? (
                    <button
                      type="button"
                      onClick={() => openDrilldown(alert)}
                      className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
                    >
                      Open details
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Revenue signal</p>
          <p className="mt-2 text-2xl font-bold text-white">{formatMoney(data?.signals?.revenue?.current?.total_revenue || 0)}</p>
          <p className="text-sm text-white/60">Previous: {formatMoney(data?.signals?.revenue?.previous?.total_revenue || 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Completion rate</p>
          <p className="mt-2 text-2xl font-bold text-white">{formatPercent(data?.signals?.appointments?.current?.completionRate || 0)}</p>
          <p className="text-sm text-white/60">No-show: {formatPercent(data?.signals?.appointments?.current?.noShowRate || 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Product sales</p>
          <p className="mt-2 text-2xl font-bold text-white">{formatMoney(data?.signals?.productSales?.current?.totalRevenue || 0)}</p>
          <p className="text-sm text-white/60">Orders: {data?.signals?.productSales?.current?.totalOrders || 0}</p>
        </div>
      </div>

      <AnalyticsDetailsDrawer
        open={Boolean(drilldown)}
        entity={drilldown?.entity || null}
        title={drilldown?.title || ''}
        description={drilldown?.description}
        defaultFilters={drilldown?.defaultFilters}
        startDate={data?.window.current.startDate}
        endDate={data?.window.current.endDate}
        onClose={() => setDrilldown(null)}
      />
    </div>
  );
}
