import { BI_DATE_PRESET_OPTIONS } from '../../lib/bi';
import type {
  BIDatePresetValue,
  BIDateRange,
  BIOption,
  BIReportFilterDefinition,
  BIReportFilterValues,
} from '../../lib/bi';

export const BI_FILTER_SECTION_ORDER = [
  'General',
  'Date',
  'Customer',
  'Employee',
  'Location',
  'Payment',
  'Finance',
  'Products',
  'Services',
  'Gift Cards',
  'Advanced',
] as const;

export type BIFilterSection = (typeof BI_FILTER_SECTION_ORDER)[number];

export function dedupeBIOptions(options: BIOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const nextValue = `${option.value ?? ''}`.trim();
    if (!nextValue) return false;
    if (seen.has(nextValue)) return false;
    seen.add(nextValue);
    return true;
  });
}

function normalizeFilterText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

export function isToolbarLevelFilter(filter: BIReportFilterDefinition) {
  return filter.type === 'search';
}

export function inferFilterSection(filter: BIReportFilterDefinition): BIFilterSection {
  const text = normalizeFilterText(`${filter.id} ${filter.label} ${filter.helperText || ''}`);

  if (filter.type === 'date-preset' || filter.type === 'date-range') return 'Date';
  if (text.includes('customer') || filter.type === 'customer') return 'Customer';
  if (
    text.includes('employee')
    || text.includes('team')
    || text.includes('staff')
    || text.includes('member')
    || filter.type === 'employee'
  ) {
    return 'Employee';
  }
  if (text.includes('location') || text.includes('branch') || text.includes('store')) return 'Location';
  if (
    text.includes('payment')
    || text.includes('method')
    || text.includes('transaction')
    || text.includes('refund')
    || text.includes('deposit')
    || text.includes('wallet')
    || text.includes('cash')
    || text.includes('online')
    || filter.type === 'payment-method'
  ) {
    return 'Payment';
  }
  if (
    text.includes('finance')
    || text.includes('amount')
    || text.includes('vat')
    || text.includes('tax')
    || text.includes('discount')
    || text.includes('revenue')
    || text.includes('gross')
    || text.includes('net')
    || text.includes('balance')
    || text.includes('profit')
    || text.includes('cash flow')
    || text.includes('ledger')
  ) {
    return 'Finance';
  }
  if (text.includes('gift card') || text.includes('giftcard') || text.includes('voucher')) return 'Gift Cards';
  if (text.includes('product') || text.includes('inventory') || text.includes('stock')) return 'Products';
  if (text.includes('service') || text.includes('category')) return 'Services';
  return 'General';
}

export function groupFiltersBySection(filters: BIReportFilterDefinition[]) {
  const grouped = new Map<BIFilterSection, BIReportFilterDefinition[]>();
  filters.filter((filter) => !filter.disabled).forEach((filter) => {
    const section = inferFilterSection(filter);
    const current = grouped.get(section) || [];
    grouped.set(section, [...current, filter]);
  });

  return BI_FILTER_SECTION_ORDER
    .map((section) => ({
      section,
      filters: grouped.get(section) || [],
    }))
    .filter((entry) => entry.filters.length);
}

export function getDefaultFilterValue(filter: BIReportFilterDefinition) {
  if (filter.defaultValue !== undefined) return filter.defaultValue;

  switch (filter.type) {
    case 'date-preset':
      return 'last_30_days' satisfies BIDatePresetValue;
    case 'date-range':
      return { from: '', to: '' } satisfies BIDateRange;
    case 'multi-select':
      return [];
    case 'dropdown':
    case 'status':
    case 'employee':
    case 'customer':
    case 'category':
    case 'payment-method':
    case 'location':
    case 'search':
      return '';
    case 'amount-range':
      return { min: '', max: '' };
    case 'boolean':
      return false;
    default:
      return '';
  }
}

export function isEmptyFilterValue(filter: BIReportFilterDefinition, value: unknown) {
  switch (filter.type) {
    case 'multi-select':
      return !Array.isArray(value) || value.length === 0;
    case 'date-range':
      return !value || (!`${(value as { from?: string }).from || ''}`.trim() && !`${(value as { to?: string }).to || ''}`.trim());
    case 'amount-range':
      return !value || (!`${(value as { min?: string }).min || ''}`.trim() && !`${(value as { max?: string }).max || ''}`.trim());
    case 'boolean':
      return !Boolean(value);
    case 'date-preset':
      return !`${value ?? ''}`.trim();
    default:
      return !`${value ?? ''}`.trim();
  }
}

function findOptionLabel(options: BIOption[] | undefined, value: string) {
  return options?.find((option) => `${option.value ?? ''}` === value)?.label || value;
}

export function getFilterSummaryLabel(filter: BIReportFilterDefinition, value: unknown) {
  if (value === undefined || value === null) return null;

  switch (filter.type) {
    case 'date-preset': {
      const nextValue = `${value ?? ''}`.trim();
      if (!nextValue) return null;
      return BI_DATE_PRESET_OPTIONS.find((option) => option.value === nextValue)?.label || nextValue;
    }
    case 'date-range': {
      const range = typeof value === 'object' && value ? (value as { from?: string; to?: string }) : {};
      const from = `${range.from || ''}`.trim();
      const to = `${range.to || ''}`.trim();
      if (!from && !to) return null;
      if (from && to) return `${from} → ${to}`;
      return from || to;
    }
    case 'multi-select': {
      const selected = Array.isArray(value) ? value.map((entry) => `${entry ?? ''}`.trim()).filter(Boolean) : [];
      if (!selected.length) return null;
      return selected.map((item) => findOptionLabel(filter.options, item));
    }
    case 'dropdown':
    case 'status':
    case 'employee':
    case 'customer':
    case 'category':
    case 'payment-method':
    case 'location': {
      const nextValue = `${value ?? ''}`.trim();
      if (!nextValue) return null;
      return findOptionLabel(filter.options, nextValue);
    }
    case 'amount-range': {
      const range = typeof value === 'object' && value ? (value as { min?: string; max?: string }) : {};
      const min = `${range.min || ''}`.trim();
      const max = `${range.max || ''}`.trim();
      if (!min && !max) return null;
      if (min && max) return `${min} → ${max}`;
      return min || max;
    }
    case 'boolean':
      return Boolean(value) ? (filter.trueLabel || 'Yes') : null;
    case 'search': {
      const nextValue = `${value ?? ''}`.trim();
      return nextValue || null;
    }
    default: {
      const nextValue = `${value ?? ''}`.trim();
      return nextValue || null;
    }
  }
}

export function removeValueFromMultiSelect(value: unknown, item: string) {
  const selected = Array.isArray(value) ? value.map((entry) => `${entry ?? ''}`.trim()).filter(Boolean) : [];
  return selected.filter((entry) => entry !== item);
}

export function getMultiSelectValues(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => `${entry ?? ''}`.trim()).filter(Boolean) : [];
}
