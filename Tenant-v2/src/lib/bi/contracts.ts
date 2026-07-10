import type { ReactNode } from 'react';
import type {
  BIDatePresetValue,
  BIDateRange,
  BIExportFormat,
  BIOption,
} from './types';

export type BIReportCategory =
  | 'operations'
  | 'financial'
  | 'customers'
  | 'employees'
  | 'products'
  | 'services'
  | 'appointments'
  | 'gift-cards'
  | 'marketing'
  | 'executive'
  | 'analytics'
  | 'custom';

export interface BIReportMetadata {
  id: string;
  title: string;
  description: string;
  category: BIReportCategory;
  endpoint: string;
  exportFilename: string;
  defaultDateRange: BIDatePresetValue | BIDateRange;
}

export interface BIBackendFieldReference {
  field: string;
  path?: string;
  label?: string;
  required?: boolean;
}

export interface BIComparisonContract {
  enabled: boolean;
  backendField?: string;
  mode?: 'absolute' | 'percentage' | 'delta';
  compareTo?: 'previous-period' | 'previous-day' | 'previous-week' | 'previous-month' | 'custom';
}

export interface BITrendContract {
  enabled: boolean;
  backendField?: string;
  granularity?: 'day' | 'week' | 'month';
  seriesKey?: string;
}

export interface BIValueFormatterContract {
  kind: 'currency' | 'number' | 'percent' | 'text' | 'date' | 'datetime' | 'duration' | 'boolean' | 'custom';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  dateStyle?: 'short' | 'medium' | 'long';
  timeStyle?: 'short' | 'medium' | 'long';
  customLabel?: string;
}

export interface BIKpiContract {
  id: string;
  label: string;
  backendField: string;
  formatter: BIValueFormatterContract;
  comparison: BIComparisonContract;
  trend: BITrendContract;
  source?: BIBackendFieldReference;
  notes?: string;
}

export type BIFilterKind =
  | 'date'
  | 'custom-date'
  | 'employee'
  | 'customer'
  | 'service'
  | 'product'
  | 'category'
  | 'location'
  | 'payment-method'
  | 'status'
  | 'boolean'
  | 'amount-range'
  | 'text-search'
  | 'multi-select'
  | 'single-select';

export interface BIFilterOption extends BIOption {}

export interface BIBaseFilterContract {
  id: string;
  label: string;
  kind: BIFilterKind;
  backendField: string;
  required?: boolean;
  description?: string;
  source?: BIBackendFieldReference;
}

export interface BIDateFilterContract extends BIBaseFilterContract {
  kind: 'date';
  defaultValue?: BIDatePresetValue;
  presets?: BIDatePresetValue[];
}

export interface BICustomDateFilterContract extends BIBaseFilterContract {
  kind: 'custom-date';
  defaultValue?: BIDateRange;
}

export interface BISingleSelectFilterContract extends BIBaseFilterContract {
  kind: 'single-select' | 'employee' | 'customer' | 'service' | 'product' | 'category' | 'location' | 'payment-method' | 'status';
  options: BIFilterOption[];
  searchable?: boolean;
}

export interface BIMultiSelectFilterContract extends BIBaseFilterContract {
  kind: 'multi-select';
  options: BIFilterOption[];
  searchable?: boolean;
}

export interface BITextSearchFilterContract extends BIBaseFilterContract {
  kind: 'text-search';
  placeholder?: string;
}

export interface BIBooleanFilterContract extends BIBaseFilterContract {
  kind: 'boolean';
  trueLabel?: string;
  falseLabel?: string;
}

export interface BIAmountRangeFilterContract extends BIBaseFilterContract {
  kind: 'amount-range';
  currency?: string;
  minimumField?: string;
  maximumField?: string;
}

export type BIReportFilterContract =
  | BIDateFilterContract
  | BICustomDateFilterContract
  | BISingleSelectFilterContract
  | BIMultiSelectFilterContract
  | BITextSearchFilterContract
  | BIBooleanFilterContract
  | BIAmountRangeFilterContract;

export interface BIReportColumnContract {
  id: string;
  header: string;
  backendField: string;
  sortable?: boolean;
  visible?: boolean;
  exportable?: boolean;
  alignment?: 'left' | 'center' | 'right';
  formatter?: BIValueFormatterContract;
  source?: BIBackendFieldReference;
}

export interface BIDrawerFieldContract {
  id: string;
  label: string;
  backendField: string;
  formatter?: BIValueFormatterContract;
  required?: boolean;
  source?: BIBackendFieldReference;
}

export interface BIDetailsDrawerContract {
  id: string;
  title: string;
  fields: BIDrawerFieldContract[];
  renderMode?: 'field-list' | 'custom';
  notes?: string;
}

export type BIChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'column'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'table'
  | 'heatmap'
  | 'custom';

export interface BIChartAxisContract {
  label: string;
  backendField: string;
  formatter?: BIValueFormatterContract;
  source?: BIBackendFieldReference;
}

export interface BIChartDatasetContract {
  id: string;
  label: string;
  backendField: string;
  color?: string;
  formatter?: BIValueFormatterContract;
  source?: BIBackendFieldReference;
}

export interface BIChartContract {
  id: string;
  title: string;
  type: BIChartType;
  dataset: BIChartDatasetContract[];
  xAxis?: BIChartAxisContract;
  yAxis?: BIChartAxisContract;
  backendFields: string[];
  notes?: string;
}

export interface BIExportContract {
  formats: BIExportFormat[];
  filename: string;
  backendDriven: true;
  source?: BIBackendFieldReference;
}

export interface BIFormulaOriginContract {
  backendField?: string;
  sourceEndpoint?: string;
  model?: string;
  query?: string;
  note?: string;
}

export interface BIFormulaMissingValueContract {
  backendField: string;
  reason: string;
  requiredFallback: 'backend-only';
}

export interface BIFormulaContract {
  key: string;
  label: string;
  origin: BIFormulaOriginContract;
  backendOwned: true;
  displayOnly: boolean;
  missingValue?: BIFormulaMissingValueContract;
  description?: string;
}

export interface BIReportContract<TRow = unknown> {
  metadata: BIReportMetadata;
  kpis: BIKpiContract[];
  filters: BIReportFilterContract[];
  table: {
    columns: BIReportColumnContract[];
    sorting?: {
      backendField: string;
      direction: 'asc' | 'desc';
    };
  };
  detailsDrawer: BIDetailsDrawerContract;
  charts: BIChartContract[];
  exports: BIExportContract;
  formulas: BIFormulaContract[];
  backendResponseShape?: TRow;
  notes?: string;
}

export interface BIContractRegistry {
  reports: BIReportContract[];
  generatedAt?: string;
}

export function defineBIReportContract<TRow>(contract: BIReportContract<TRow>): BIReportContract<TRow> {
  return contract;
}

export function defineBIContractRegistry(registry: BIContractRegistry): BIContractRegistry {
  return registry;
}

