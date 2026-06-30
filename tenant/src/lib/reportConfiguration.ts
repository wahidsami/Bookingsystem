"use client";

import type { ReportDatePresetKey } from "@/components/ReportDatePresets";

export type ReportSortDirection = "asc" | "desc";

export type ReportSortConfig = {
  field: string;
  direction: ReportSortDirection;
};

export type ReportDatasetKey =
  | "overview"
  | "sales"
  | "financial"
  | "appointments"
  | "rebookings"
  | "employees"
  | "services"
  | "products"
  | "discounts"
  | "refunds"
  | "paymentMethods"
  | "customerSales";

export type ReportColumnConfig = {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean;
  description?: string;
};

export type ReportFilterValue = string | number | boolean | null | Array<string | number | boolean>;

export type ReportFilterMap = Record<string, ReportFilterValue>;

export type ReportScheduleCadence = "daily" | "weekly" | "monthly";

export type ReportScheduleDeliveryChannel = "email" | "dashboard_inbox";

export type ReportScheduleConfig = {
  enabled: boolean;
  cadence: ReportScheduleCadence;
  timeOfDay: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  deliveryChannels: ReportScheduleDeliveryChannel[];
  recipients: string[];
  exportFormats: string[];
};

export type ReportConfigurationState = {
  reportType: ReportDatasetKey | string;
  title: string;
  description?: string | null;
  datePreset: ReportDatePresetKey;
  startDate: string;
  endDate: string;
  filters: ReportFilterMap;
  columns: ReportColumnConfig[];
  grouping: string | null;
  sorting: ReportSortConfig;
  selectedMetrics: string[];
  sections: string[];
  reportConfig: Record<string, unknown>;
  scheduleConfig: ReportScheduleConfig;
  isFavorite: boolean;
};

export type ReportConfigurationInput = Partial<ReportConfigurationState> & {
  reportType?: ReportDatasetKey | string;
  title?: string;
  description?: string | null;
  datePreset?: ReportDatePresetKey;
  startDate?: string;
  endDate?: string;
  filters?: ReportFilterMap;
  columns?: ReportColumnConfig[];
  grouping?: string | null;
  sorting?: Partial<ReportSortConfig>;
  selectedMetrics?: string[];
  sections?: string[];
  reportConfig?: Record<string, unknown>;
  scheduleConfig?: Partial<ReportScheduleConfig>;
  isFavorite?: boolean;
};

export type SaveReportPayload = {
  reportType: string;
  title: string;
  description?: string | null;
  filters: ReportFilterMap;
  columns: ReportColumnConfig[];
  grouping: string | null;
  sorting: ReportSortConfig;
  selectedMetrics: string[];
  sections: string[];
  reportConfig: Record<string, unknown>;
  scheduleConfig: ReportScheduleConfig;
  isFavorite: boolean;
  duplicatedFromId?: string | null;
};

const DEFAULT_SORTING: ReportSortConfig = {
  field: "date",
  direction: "desc"
};

const DEFAULT_SCHEDULE: ReportScheduleConfig = {
  enabled: false,
  cadence: "daily",
  timeOfDay: "09:00",
  dayOfWeek: null,
  dayOfMonth: null,
  deliveryChannels: ["email", "dashboard_inbox"],
  recipients: [],
  exportFormats: ["csv"]
};

function cloneColumns(columns: ReportColumnConfig[] = []) {
  return columns.map((column) => ({ ...column }));
}

function cloneFilters(filters: ReportFilterMap = {}) {
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]));
}

function normalizeSorting(sorting?: Partial<ReportSortConfig>): ReportSortConfig {
  const field = `${sorting?.field || DEFAULT_SORTING.field}`.trim() || DEFAULT_SORTING.field;
  const direction = `${sorting?.direction || DEFAULT_SORTING.direction}`.trim().toLowerCase() === "asc" ? "asc" : "desc";
  return { field, direction };
}

export function normalizeScheduleConfig(scheduleConfig?: Partial<ReportScheduleConfig>): ReportScheduleConfig {
  const cadence = `${scheduleConfig?.cadence || DEFAULT_SCHEDULE.cadence}`.trim().toLowerCase();
  const safeCadence: ReportScheduleCadence = cadence === "weekly" || cadence === "monthly" ? cadence : "daily";
  const deliveryChannels = Array.isArray(scheduleConfig?.deliveryChannels) && scheduleConfig.deliveryChannels.length
    ? scheduleConfig.deliveryChannels.map((value) => `${value}`.trim().toLowerCase()).filter((value): value is ReportScheduleDeliveryChannel => value === "email" || value === "dashboard_inbox")
    : [...DEFAULT_SCHEDULE.deliveryChannels];
  const exportFormats = Array.isArray(scheduleConfig?.exportFormats) && scheduleConfig.exportFormats.length
    ? scheduleConfig.exportFormats.map((value) => `${value}`.trim()).filter(Boolean)
    : [...DEFAULT_SCHEDULE.exportFormats];

  return {
    enabled: Boolean(scheduleConfig?.enabled),
    cadence: safeCadence,
    timeOfDay: `${scheduleConfig?.timeOfDay || DEFAULT_SCHEDULE.timeOfDay}`.trim() || DEFAULT_SCHEDULE.timeOfDay,
    dayOfWeek: Number.isInteger(scheduleConfig?.dayOfWeek) ? scheduleConfig!.dayOfWeek! : null,
    dayOfMonth: Number.isInteger(scheduleConfig?.dayOfMonth) ? scheduleConfig!.dayOfMonth! : null,
    deliveryChannels,
    recipients: Array.isArray(scheduleConfig?.recipients) ? scheduleConfig.recipients.map((value) => `${value}`.trim()).filter(Boolean) : [],
    exportFormats
  };
}

export function normalizeReportConfiguration(input: ReportConfigurationInput = {}): ReportConfigurationState {
  const reportType = `${input.reportType || "custom"}`.trim() || "custom";
  const title = `${input.title || ""}`.trim();
  const description = typeof input.description === "string"
    ? input.description.trim() || null
    : input.description ?? null;
  const filters = cloneFilters(input.filters || {});
  const columns = cloneColumns(input.columns || []);
  const grouping = `${input.grouping || ""}`.trim() || null;
  const sorting = normalizeSorting(input.sorting);
  const selectedMetrics = Array.isArray(input.selectedMetrics) ? input.selectedMetrics.map((value) => `${value}`.trim()).filter(Boolean) : [];
  const sections = Array.isArray(input.sections) ? input.sections.map((value) => `${value}`.trim()).filter(Boolean) : [];
  const reportConfig = input.reportConfig && typeof input.reportConfig === "object" && !Array.isArray(input.reportConfig)
    ? { ...input.reportConfig }
    : {};
  const scheduleConfig = normalizeScheduleConfig(input.scheduleConfig);

  return {
    reportType,
    title,
    description,
    datePreset: input.datePreset || "custom",
    startDate: `${input.startDate || ""}`.trim(),
    endDate: `${input.endDate || ""}`.trim(),
    filters,
    columns,
    grouping,
    sorting,
    selectedMetrics,
    sections,
    reportConfig: {
      ...reportConfig,
      reportType,
      title,
      description,
      datePreset: input.datePreset || "custom",
      startDate: `${input.startDate || ""}`.trim(),
      endDate: `${input.endDate || ""}`.trim(),
      filters,
      columns,
      grouping,
      sorting,
      selectedMetrics,
      sections
    },
    scheduleConfig,
    isFavorite: Boolean(input.isFavorite)
  };
}

export function buildSaveReportPayload(input: ReportConfigurationInput & { duplicatedFromId?: string | null }): SaveReportPayload {
  const normalized = normalizeReportConfiguration(input);

  return {
    reportType: normalized.reportType,
    title: normalized.title || `${normalized.reportType} report`,
    description: normalized.description,
    filters: normalized.filters,
    columns: normalized.columns,
    grouping: normalized.grouping,
    sorting: normalized.sorting,
    selectedMetrics: normalized.selectedMetrics,
    sections: normalized.sections,
    reportConfig: normalized.reportConfig,
    scheduleConfig: normalized.scheduleConfig,
    isFavorite: normalized.isFavorite,
    duplicatedFromId: input.duplicatedFromId || null
  };
}

export function buildReportStorageKey(userKey: string | null | undefined, reportKey: string, kind: "favorite" | "columns" | "draft" = "draft") {
  if (!userKey) return null;
  return `rifah:reporting-v2:${kind}:${userKey}:${reportKey}`;
}

export function buildReportPresetTitle(reportLabel: string, startDate: string, endDate: string) {
  const title = `${reportLabel}`.trim() || "Report";
  return `${title} - ${startDate} → ${endDate}`;
}
