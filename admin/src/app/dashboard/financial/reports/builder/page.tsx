'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { adminApi } from '@/lib/api';

type PreviewResponse = {
  config: any;
  rows: any[];
  summary: Record<string, number>;
  totals: { rows: number; recordCount: number };
  chart: { labels: string[]; series: number[]; comparisonSeries?: number[]; metric?: string };
  kpis: Array<{ key: string; label: string; value: number }>;
  comparison?: {
    label: string;
    summary: Record<string, number>;
    totals: { rows: number; recordCount: number };
    chart: { labels: string[]; series: number[]; metric?: string };
  } | null;
};

const outputTypes = [
  { key: 'table', label: 'Table' },
  { key: 'chart', label: 'Chart' },
  { key: 'kpi_cards', label: 'KPI Cards' }
];

const chartTypes = [
  { key: 'bar', label: 'Bar' },
  { key: 'line', label: 'Line' },
  { key: 'area', label: 'Area' }
];

const formatMoney = (value: number) =>
  `SAR ${(Number(value) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`;

function createCsv(rows: Record<string, any>[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: any) => {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'string' ? value : String(value);
    if (raw.includes('"')) return `"${raw.replace(/"/g, '""')}"`;
    if (raw.includes(',') || raw.includes('\n')) return `"${raw}"`;
    return raw;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))
  ].join('\n');
}

function Sparkline({ values, stroke = '#38bdf8' }: { values: number[]; stroke?: string }) {
  if (!values.length) return <div className="h-16 rounded-xl bg-white/5" />;
  const width = 220;
  const height = 72;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <polyline fill="none" stroke={stroke} strokeWidth="2.5" points={points} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ComparisonSparkline({
  currentValues,
  comparisonValues,
}: {
  currentValues: number[];
  comparisonValues: number[];
}) {
  if (!currentValues.length && !comparisonValues.length) {
    return <div className="h-16 rounded-xl bg-white/5" />;
  }

  const width = 220;
  const height = 72;
  const allValues = [...currentValues, ...comparisonValues];
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;

  const toPoints = (values: number[]) => values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={toPoints(currentValues)} strokeLinejoin="round" strokeLinecap="round" />
      <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" points={toPoints(comparisonValues)} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" />
    </svg>
  );
}

export default function CustomReportBuilderPage() {
  const [options, setOptions] = useState<any>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [title, setTitle] = useState('Custom Report');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState<string[]>(['employee']);
  const [metrics, setMetrics] = useState<string[]>(['revenue']);
  const [grouping, setGrouping] = useState('month');
  const [outputType, setOutputType] = useState('table');
  const [chartType, setChartType] = useState('bar');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCadence, setScheduleCadence] = useState('daily');
  const [scheduleTimeOfDay, setScheduleTimeOfDay] = useState('09:00');
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('1');
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState('1');
  const [scheduleRecipients, setScheduleRecipients] = useState('');
  const [scheduleDeliveryChannels, setScheduleDeliveryChannels] = useState<string[]>(['email', 'dashboard_inbox']);
  const [scheduleExportFormats, setScheduleExportFormats] = useState<string[]>(['pdf', 'excel']);
  const [customIntervalMinutes, setCustomIntervalMinutes] = useState('1440');
  const [comparisonMode, setComparisonMode] = useState('off');
  const [compareStartDate, setCompareStartDate] = useState('');
  const [compareEndDate, setCompareEndDate] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ type: 'dimension' | 'metric'; key: string } | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReportHistory, setSelectedReportHistory] = useState<any[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    setTablePage(1);
  }, [preview?.totals?.rows, preview?.comparison?.totals?.rows, outputType, grouping, dimensions.join(','), metrics.join(',')]);

  const loadBootstrap = async () => {
    try {
      setLoading(true);
      const [optionsRes, reportsRes] = await Promise.all([
        adminApi.getReportBuilderOptions(),
        adminApi.getSavedCustomReports()
      ]);

      if (optionsRes.success) setOptions(optionsRes.data);
      if (reportsRes.success) setSavedReports(reportsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report builder');
    } finally {
      setLoading(false);
    }
  };

  const selectedScheduleConfig = useMemo(() => ({
    enabled: scheduleEnabled,
    cadence: scheduleCadence,
    timeOfDay: scheduleTimeOfDay,
    dayOfWeek: Number(scheduleDayOfWeek),
    dayOfMonth: Number(scheduleDayOfMonth),
    recipients: scheduleRecipients.split(',').map((item) => item.trim()).filter(Boolean),
    deliveryChannels: scheduleDeliveryChannels,
    exportFormats: scheduleExportFormats,
    customIntervalMinutes: Number(customIntervalMinutes)
  }), [scheduleEnabled, scheduleCadence, scheduleTimeOfDay, scheduleDayOfWeek, scheduleDayOfMonth, scheduleRecipients, scheduleDeliveryChannels, scheduleExportFormats, customIntervalMinutes]);

  const builderPayload = useMemo(() => ({
    title,
    description,
    dimensions,
    metrics,
    grouping,
    outputType,
    chartType,
    filters,
    scheduleConfig: selectedScheduleConfig,
    comparisonMode,
    compareStartDate: compareStartDate || null,
    compareEndDate: compareEndDate || null
  }), [title, description, dimensions, metrics, grouping, outputType, chartType, filters, selectedScheduleConfig, comparisonMode, compareStartDate, compareEndDate]);

  const applyPreview = async () => {
    try {
      setPreviewLoading(true);
      setError(null);
      const response = await adminApi.previewCustomReport(builderPayload);
      if (response.success) setPreview(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview report');
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveReport = async () => {
    try {
      setSaveLoading(true);
      setError(null);
      const payload = {
        ...builderPayload,
        reportType: 'custom',
        scheduleConfig: selectedScheduleConfig
      };
      const response = selectedReportId
        ? await adminApi.updateSavedCustomReport(selectedReportId, payload)
        : await adminApi.createSavedCustomReport(payload);

      if (response.success) {
        await loadBootstrap();
        setSelectedReportId(response.data.id);
        await loadSavedReportHistory(response.data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaveLoading(false);
    }
  };

  const runSavedReport = async (report: any) => {
    try {
      setPreviewLoading(true);
      const response = await adminApi.runSavedCustomReport(report.id);
      if (response.success) {
        setPreview(response.data.preview || null);
        setSelectedReportId(report.id);
        await loadSavedReportHistory(report.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run saved report');
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadSavedReport = async (reportId: string) => {
    try {
      setPreviewLoading(true);
      setError(null);
      const response = await adminApi.getSavedCustomReport(reportId);
      if (response.success) {
        const report = response.data;
        setSelectedReportId(report.id);
        setTitle(report.title || 'Custom Report');
        setDescription(report.description || '');
        setDimensions(Array.isArray(report.dimensions) ? report.dimensions : []);
        setMetrics(Array.isArray(report.metrics) ? report.metrics : []);
        setGrouping(report.grouping || 'month');
        setOutputType(report.outputType || 'table');
        setChartType(report.chartType || 'bar');
        setFilters(report.filters || {});
        const schedule = report.scheduleConfig || {};
        setScheduleEnabled(Boolean(schedule.enabled));
        setScheduleCadence(schedule.cadence || 'daily');
        setScheduleTimeOfDay(schedule.timeOfDay || '09:00');
        setScheduleDayOfWeek(`${schedule.dayOfWeek ?? 1}`);
        setScheduleDayOfMonth(`${schedule.dayOfMonth ?? 1}`);
        setScheduleRecipients(Array.isArray(schedule.recipients) ? schedule.recipients.join(', ') : '');
        setScheduleDeliveryChannels(Array.isArray(schedule.deliveryChannels) && schedule.deliveryChannels.length ? schedule.deliveryChannels : ['email', 'dashboard_inbox']);
        setScheduleExportFormats(Array.isArray(schedule.exportFormats) && schedule.exportFormats.length ? schedule.exportFormats : ['pdf', 'excel']);
        setCustomIntervalMinutes(`${schedule.customIntervalMinutes ?? 1440}`);
        setComparisonMode(report.reportConfig?.comparisonMode || 'off');
        setCompareStartDate(report.reportConfig?.compareStartDate || '');
        setCompareEndDate(report.reportConfig?.compareEndDate || '');
        await loadSavedReportHistory(report.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved report');
    } finally {
      setPreviewLoading(false);
    }
  };

  const deliverSavedReport = async (report: any) => {
    try {
      setPreviewLoading(true);
      const response = await adminApi.deliverSavedCustomReport(report.id);
      if (response.success) {
        setPreview(response.data.preview || null);
        setSelectedReportId(report.id);
        await loadSavedReportHistory(report.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deliver report');
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadSavedReportHistory = async (reportId: string) => {
    try {
      const response = await adminApi.getSavedCustomReportHistory(reportId);
      if (response.success) {
        setSelectedReportHistory(response.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report history');
    }
  };

  const exportCsv = () => {
    if (!preview?.rows?.length) return;
    const csv = createCsv(preview.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title || 'report'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const dimensionOptions = options?.dimensions || [];
  const metricOptions = options?.metrics || [];
  const groupingOptions = options?.groupings || [];
  const paginatedRows = useMemo(() => {
    if (!preview?.rows?.length) return [];
    const start = (tablePage - 1) * rowsPerPage;
    return preview.rows.slice(start, start + rowsPerPage);
  }, [preview?.rows, tablePage]);
  const totalPages = Math.max(Math.ceil((preview?.rows?.length || 0) / rowsPerPage), 1);
  const activeReport = savedReports.find((report) => report.id === selectedReportId) || null;

  if (loading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-white/5" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 shadow-2xl shadow-sky-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300/70">Custom Reports</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Drag-and-Drop Builder</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              Compose live reports using existing analytics data, then save, export, or schedule them without leaving the financial section.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={applyPreview} className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200">
              {previewLoading ? 'Previewing...' : 'Preview'}
            </button>
            <button type="button" onClick={saveReport} disabled={saveLoading} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 disabled:opacity-60">
              {saveLoading ? 'Saving...' : selectedReportId ? 'Update Report' : 'Save Report'}
            </button>
            {activeReport ? (
              <button type="button" onClick={() => deliverSavedReport(activeReport)} className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200">
                Deliver Now
              </button>
            ) : null}
            <button type="button" onClick={exportCsv} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80">
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr_300px]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Reports</h2>
            <div className="mt-3 space-y-2">
              {savedReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => loadSavedReport(report.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${selectedReportId === report.id ? 'border-sky-400/30 bg-sky-500/10 text-sky-100' : 'border-white/10 bg-black/20 text-white/80 hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{report.title}</span>
                    {report.isFavorite ? <span className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Fav</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-white/45">{report.description || 'No description'}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
                    <span>{report.dimensions?.length || 0} dims</span>
                    <span>{report.metrics?.length || 0} metrics</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Available Dimensions</h2>
            <div className="mt-3 space-y-2">
              {dimensionOptions.map((option: any) => (
                <button
                  key={option.key}
                  type="button"
                  draggable
                  onDragStart={() => setDragState({ type: 'dimension', key: option.key })}
                  onClick={() => setDimensions((current) => current.includes(option.key) ? current : [...current, option.key])}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white/80 transition hover:border-sky-400/30 hover:bg-sky-500/10"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Available Metrics</h2>
            <div className="mt-3 space-y-2">
              {metricOptions.map((option: any) => (
                <button
                  key={option.key}
                  type="button"
                  draggable
                  onDragStart={() => setDragState({ type: 'metric', key: option.key })}
                  onClick={() => setMetrics((current) => current.includes(option.key) ? current : [...current, option.key])}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white/80 transition hover:border-emerald-400/30 hover:bg-emerald-500/10"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/45">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/45">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragState?.type === 'dimension') {
                  setDimensions((current) => current.includes(dragState.key) ? current : [...current, dragState.key]);
                }
                setDragState(null);
              }}
              className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Selected Dimensions</h2>
                <span className="text-xs text-white/35">Drag items here to add</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {dimensions.length === 0 ? <p className="text-sm text-white/40">Drop dimensions here</p> : dimensions.map((dimension, index) => (
                  <div
                    key={dimension}
                    draggable
                    onDragStart={() => setDragState({ type: 'dimension', key: dimension })}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  >
                    <span>{dimension}</span>
                    <button type="button" onClick={() => {
                      const next = [...dimensions];
                      if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      setDimensions(next);
                    }} className="text-xs text-white/45">↑</button>
                    <button type="button" onClick={() => {
                      const next = [...dimensions];
                      if (index < next.length - 1) [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      setDimensions(next);
                    }} className="text-xs text-white/45">↓</button>
                    <button type="button" onClick={() => setDimensions((current) => current.filter((item) => item !== dimension))} className="text-xs text-rose-300">x</button>
                  </div>
                ))}
              </div>
            </div>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragState?.type === 'metric') {
                  setMetrics((current) => current.includes(dragState.key) ? current : [...current, dragState.key]);
                }
                setDragState(null);
              }}
              className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Selected Metrics</h2>
                <span className="text-xs text-white/35">Drag items here to add</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {metrics.length === 0 ? <p className="text-sm text-white/40">Drop metrics here</p> : metrics.map((metric, index) => (
                  <div
                    key={metric}
                    draggable
                    onDragStart={() => setDragState({ type: 'metric', key: metric })}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  >
                    <span>{metric}</span>
                    <button type="button" onClick={() => {
                      const next = [...metrics];
                      if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      setMetrics(next);
                    }} className="text-xs text-white/45">↑</button>
                    <button type="button" onClick={() => {
                      const next = [...metrics];
                      if (index < next.length - 1) [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      setMetrics(next);
                    }} className="text-xs text-white/45">↓</button>
                    <button type="button" onClick={() => setMetrics((current) => current.filter((item) => item !== metric))} className="text-xs text-rose-300">x</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/45">Grouping</label>
              <select value={grouping} onChange={(e) => setGrouping(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
                {groupingOptions.map((option: any) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/45">Output</label>
              <select value={outputType} onChange={(e) => setOutputType(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
                {outputTypes.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/45">Chart Type</label>
              <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
                {chartTypes.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/45">Date Range</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="date" value={filters.startDate || ''} onChange={(e) => setFilters((current) => ({ ...current, startDate: e.target.value }))} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" />
                <input type="date" value={filters.endDate || ''} onChange={(e) => setFilters((current) => ({ ...current, endDate: e.target.value }))} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/45">Comparison</label>
              <select value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
                <option value="off">Off</option>
                <option value="current_previous">Current vs Previous Period</option>
                <option value="month_over_month">Month over Month</option>
                <option value="year_over_year">Year over Year</option>
                <option value="custom_vs_custom">Custom vs Custom</option>
              </select>
              {comparisonMode === 'custom_vs_custom' ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input type="date" value={compareStartDate} onChange={(e) => setCompareStartDate(e.target.value)} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" />
                  <input type="date" value={compareEndDate} onChange={(e) => setCompareEndDate(e.target.value)} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" />
                </div>
              ) : (
                <p className="mt-2 text-xs text-white/45">Charts will overlay a comparison series when previewed.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <select value={filters.employeeId || ''} onChange={(e) => setFilters((current) => ({ ...current, employeeId: e.target.value }))} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
              <option value="">All employees</option>
              {(options?.employees || []).map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <select value={filters.customerId || ''} onChange={(e) => setFilters((current) => ({ ...current, customerId: e.target.value }))} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
              <option value="">All customers</option>
              {(options?.customers || []).map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <select value={filters.serviceId || ''} onChange={(e) => setFilters((current) => ({ ...current, serviceId: e.target.value }))} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
              <option value="">All services</option>
              {(options?.services || []).map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <select value={filters.status || ''} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Preview</h2>
                <p className="text-sm text-white/55">
                  Live data only. {preview?.totals?.recordCount || 0} source records across {preview?.totals?.rows || 0} groups.
                </p>
              </div>
              <button type="button" onClick={applyPreview} className="rounded-xl border border-white/10 bg-dark-900 px-4 py-2 text-sm text-white">
                Refresh Preview
              </button>
            </div>

            {preview ? (
              <div className="mt-4 space-y-4">
                {outputType === 'kpi_cards' && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {preview.kpis.map((kpi) => (
                      <div key={kpi.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/45">{kpi.label}</p>
                        <p className="mt-2 text-2xl font-bold text-white">
                          {kpi.key === 'bookings' || kpi.key === 'quantity_sold'
                            ? Number(kpi.value || 0).toLocaleString('en-SA')
                            : formatMoney(kpi.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {outputType === 'chart' && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-white/55">Chart metric: {preview.chart.metric || metrics[0]}</p>
                      <div className="flex items-center gap-2 text-xs text-white/55">
                        <span>{chartType}</span>
                        {preview.comparison ? <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-amber-200">{preview.comparison.label}</span> : null}
                      </div>
                    </div>
                    <ComparisonSparkline
                      currentValues={preview.chart.series || []}
                      comparisonValues={preview.chart.comparisonSeries || preview.comparison?.chart?.series || []}
                    />
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
                      {preview.chart.labels.map((label, index) => (
                        <span key={`${label}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{label}</span>
                      ))}
                    </div>
                    {preview.comparison ? (
                      <p className="mt-3 text-xs text-white/45">
                        Current series overlays the selected comparison mode. Previous values are shown as the dashed line.
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        {dimensions.map((dimension) => (
                          <th key={dimension} className="px-4 py-3 text-white/55">{dimension}</th>
                        ))}
                        <th className="px-4 py-3 text-white/55">{grouping}</th>
                        {metrics.map((metric) => (
                          <th key={metric} className="px-4 py-3 text-right text-white/55">{metric}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, index) => (
                        <tr key={index} className="border-b border-white/5">
                          {dimensions.map((dimension) => (
                            <td key={dimension} className="px-4 py-3 text-white">{row[dimension] || 'N/A'}</td>
                          ))}
                          <td className="px-4 py-3 text-white">{row.grouping || 'N/A'}</td>
                          {metrics.map((metric) => (
                            <td key={metric} className="px-4 py-3 text-right text-white">
                              {metric === 'revenue' || metric === 'discounts' || metric === 'refunds' || metric === 'commissions'
                                ? formatMoney(row[metric] || 0)
                                : Number(row[metric] || 0).toLocaleString('en-SA')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-white/55">
                  <span>
                    Showing {Math.min((tablePage - 1) * rowsPerPage + 1, preview.rows.length)}-{Math.min(tablePage * rowsPerPage, preview.rows.length)} of {preview.rows.length} rows
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setTablePage((current) => Math.max(current - 1, 1))} disabled={tablePage === 1} className="rounded-lg border border-white/10 bg-dark-900 px-3 py-1 disabled:opacity-40">Prev</button>
                    <span className="text-xs text-white/40">Page {tablePage} of {totalPages}</span>
                    <button type="button" onClick={() => setTablePage((current) => Math.min(current + 1, totalPages))} disabled={tablePage >= totalPages} className="rounded-lg border border-white/10 bg-dark-900 px-3 py-1 disabled:opacity-40">Next</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
                Preview a live report to see grouped results.
              </div>
            )}
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Schedule</h2>
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
                Enable schedule
              </label>
              <select value={scheduleCadence} onChange={(e) => setScheduleCadence(e.target.value)} className="w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
              {scheduleCadence === 'custom' ? (
                <input
                  type="number"
                  min="1"
                  value={customIntervalMinutes}
                  onChange={(e) => setCustomIntervalMinutes(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white"
                  placeholder="Interval minutes"
                />
              ) : null}
              <input type="time" value={scheduleTimeOfDay} onChange={(e) => setScheduleTimeOfDay(e.target.value)} className="w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" max="6" value={scheduleDayOfWeek} onChange={(e) => setScheduleDayOfWeek(e.target.value)} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" placeholder="Day of week" />
                <input type="number" min="1" max="28" value={scheduleDayOfMonth} onChange={(e) => setScheduleDayOfMonth(e.target.value)} className="rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white" placeholder="Day of month" />
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Delivery Channels</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { key: 'email', label: 'Email' },
                    { key: 'dashboard_inbox', label: 'Dashboard Inbox' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setScheduleDeliveryChannels((current) => current.includes(item.key) ? current.filter((channel) => channel !== item.key) : [...current, item.key])}
                      className={`rounded-full border px-3 py-1 text-xs transition ${scheduleDeliveryChannels.includes(item.key) ? 'border-sky-400/30 bg-sky-500/10 text-sky-100' : 'border-white/10 bg-white/5 text-white/70'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Export Formats</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { key: 'pdf', label: 'PDF' },
                    { key: 'excel', label: 'Excel' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setScheduleExportFormats((current) => current.includes(item.key) ? current.filter((format) => format !== item.key) : [...current, item.key])}
                      className={`rounded-full border px-3 py-1 text-xs transition ${scheduleExportFormats.includes(item.key) ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={scheduleRecipients}
                onChange={(e) => setScheduleRecipients(e.target.value)}
                placeholder="Recipients (comma separated emails)"
                className="h-24 w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Saved Reports</h2>
            <div className="mt-3 space-y-2">
              {savedReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{report.title}</p>
                      <p className="text-xs text-white/45">{report.lastRunAt ? `Last run ${format(new Date(report.lastRunAt), 'dd MMM, HH:mm')}` : 'Never run'}</p>
                      <p className="text-xs text-white/45">
                        {report.scheduleConfig?.enabled
                          ? `${report.scheduleConfig.cadence || 'daily'} · ${(report.scheduleConfig.deliveryChannels || []).join(', ') || 'email'}`
                          : 'Scheduling disabled'}
                      </p>
                    </div>
                    <button type="button" onClick={() => runSavedReport(report)} className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                      Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Run History</h2>
              <span className="text-xs text-white/35">{selectedReportHistory.length} entries</span>
            </div>
            <div className="mt-3 space-y-2">
              {selectedReportHistory.length ? selectedReportHistory.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {entry.runType === 'scheduled'
                        ? 'Scheduled run'
                        : entry.runType === 'manual_delivery'
                          ? 'Delivered manually'
                          : 'Manual run'}
                    </p>
                    <span className="text-[11px] text-white/35">{format(new Date(entry.ranAt), 'dd MMM, HH:mm')}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {entry.rows} groups, {entry.recordCount} records
                    {entry.comparison ? `, ${entry.comparison}` : ''}
                    {entry.delivery?.deliverySummary?.channels?.length ? `, ${entry.delivery.deliverySummary.channels.join(' + ')}` : ''}
                  </p>
                </div>
              )) : (
                <p className="text-sm text-white/45">No run history yet for the selected report.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
