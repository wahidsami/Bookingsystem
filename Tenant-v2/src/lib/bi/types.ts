import type { ReactNode } from 'react';

export type BIExportFormat = 'excel' | 'csv' | 'pdf' | 'print';

export type BIDatePresetValue =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_week'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'custom';

export type BIFilterType =
  | 'date-preset'
  | 'date-range'
  | 'multi-select'
  | 'dropdown'
  | 'search'
  | 'status'
  | 'amount-range'
  | 'boolean'
  | 'employee'
  | 'customer'
  | 'category'
  | 'payment-method'
  | 'location';

export interface BIOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface BIDateRange {
  from: string;
  to: string;
}

interface BIFilterBase {
  id: string;
  label: string;
  type: BIFilterType;
  helperText?: string;
  defaultValue?: unknown;
  disabled?: boolean;
}

export interface BIDatePresetFilterDefinition extends BIFilterBase {
  type: 'date-preset';
  presets?: BIDatePresetValue[];
}

export interface BIDateRangeFilterDefinition extends BIFilterBase {
  type: 'date-range';
  allowOpenEnded?: boolean;
}

export interface BIMultiSelectFilterDefinition extends BIFilterBase {
  type: 'multi-select';
  options: BIOption[];
  searchable?: boolean;
}

export interface BIDropdownFilterDefinition extends BIFilterBase {
  type: 'dropdown' | 'status' | 'employee' | 'customer' | 'category' | 'payment-method' | 'location';
  options: BIOption[];
}

export interface BISearchFilterDefinition extends BIFilterBase {
  type: 'search';
  placeholder?: string;
}

export interface BIAmountRangeFilterDefinition extends BIFilterBase {
  type: 'amount-range';
  currency?: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}

export interface BIBooleanFilterDefinition extends BIFilterBase {
  type: 'boolean';
  trueLabel?: string;
  falseLabel?: string;
}

export type BIReportFilterDefinition =
  | BIDatePresetFilterDefinition
  | BIDateRangeFilterDefinition
  | BIMultiSelectFilterDefinition
  | BIDropdownFilterDefinition
  | BISearchFilterDefinition
  | BIAmountRangeFilterDefinition
  | BIBooleanFilterDefinition;

export interface BIReportColumnDefinition<TRow = Record<string, unknown>> {
  id: string;
  header: ReactNode;
  accessor: keyof TRow | ((row: TRow) => ReactNode);
  hiddenByDefault?: boolean;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown, row: TRow) => ReactNode;
}

export interface BIReportKpiDefinition {
  id: string;
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  delta?: ReactNode;
  tone?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
}

export interface BIReportChartDefinition {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  render: ReactNode | ((context: BIReportRenderContext) => ReactNode);
}

export interface BIReportDrawerDefinition<TRow = Record<string, unknown>> {
  title?: (row: TRow) => ReactNode;
  subtitle?: (row: TRow) => ReactNode;
  render: (row: TRow, context: BIReportRenderContext) => ReactNode;
}

export interface BIReportExportDefinition {
  enabled?: Partial<Record<BIExportFormat, boolean>>;
}

export interface BIReportDefinition<TRow = Record<string, unknown>> {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  endpoint?: string;
  businessRules?: string[];
  filters?: BIReportFilterDefinition[];
  columns?: BIReportColumnDefinition<TRow>[];
  kpis?: BIReportKpiDefinition[];
  charts?: BIReportChartDefinition[];
  drawer?: BIReportDrawerDefinition<TRow>;
  exports?: BIReportExportDefinition;
  defaultSort?: {
    columnId: string;
    direction: 'asc' | 'desc';
  };
  defaultPageSize?: number;
  footer?: ReactNode;
}

export interface BIReportSortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface BIReportRenderContext {
  reportId: string;
  refresh: () => void;
  exportReport: (format: BIExportFormat) => void;
}

export interface BIReportFilterValues {
  [key: string]: unknown;
}

export interface BIReportQueryState {
  search: string;
  datePreset: BIDatePresetValue;
  customDateRange: BIDateRange;
  filters: BIReportFilterValues;
  page: number;
  pageSize: number;
  sort: BIReportSortState;
}

export interface BIColumnPreferenceState {
  order: string[];
  hidden: string[];
}

export interface BISavedViewSnapshot {
  id: string;
  name: string;
  createdAt: string;
  query: BIReportQueryState;
}

