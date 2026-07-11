import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { BI_DATE_PRESET_OPTIONS } from '../../lib/bi';
import type { BIDatePresetValue, BIDateRange, BIReportFilterDefinition, BIReportFilterValues } from '../../lib/bi';
import {
  getDefaultFilterValue,
  getFilterSummaryLabel,
  isEmptyFilterValue,
  removeValueFromMultiSelect,
} from './biFilterUtils';

interface BIActiveFilterSummaryProps {
  filters: BIReportFilterDefinition[];
  values: BIReportFilterValues;
  searchValue: string;
  onSearchChange: (value: string) => void;
  datePreset: BIDatePresetValue;
  onDatePresetChange: (value: BIDatePresetValue) => void;
  customDateRange: BIDateRange;
  onCustomDateRangeChange: (next: BIDateRange) => void;
  onFilterValuesChange: (next: BIReportFilterValues) => void;
}

interface FilterChip {
  key: string;
  label: ReactNode;
  onRemove: () => void;
}

export function BIActiveFilterSummary({
  filters,
  values,
  searchValue,
  onSearchChange,
  datePreset,
  onDatePresetChange,
  customDateRange,
  onCustomDateRangeChange,
  onFilterValuesChange,
}: BIActiveFilterSummaryProps) {
  const chips: FilterChip[] = [];

  const resolvedDateRange = `${customDateRange.from || ''}`.trim() || `${customDateRange.to || ''}`.trim();
  if (resolvedDateRange) {
    const from = `${customDateRange.from || ''}`.trim();
    const to = `${customDateRange.to || ''}`.trim();
    chips.push({
      key: 'date-range',
      label: (
        <>
          <span className="font-semibold">Date:</span> {from && to ? `${from} → ${to}` : from || to}
        </>
      ),
      onRemove: () => {
        onDatePresetChange('last_30_days');
        onCustomDateRangeChange({ from: '', to: '' });
      },
    });
  } else if (datePreset && datePreset !== 'last_30_days') {
    const presetLabel = BI_DATE_PRESET_OPTIONS.find((option) => option.value === datePreset)?.label || datePreset;
    chips.push({
      key: 'date-preset',
      label: (
        <>
          <span className="font-semibold">Date:</span> {presetLabel}
        </>
      ),
      onRemove: () => {
        onDatePresetChange('last_30_days');
        onCustomDateRangeChange({ from: '', to: '' });
      },
    });
  } else {
    chips.push({
      key: 'date-default',
      label: (
        <>
          <span className="font-semibold">Date:</span> Last 30 Days
        </>
      ),
      onRemove: () => {
        onDatePresetChange('last_30_days');
        onCustomDateRangeChange({ from: '', to: '' });
      },
    });
  }

  if (`${searchValue || ''}`.trim()) {
    chips.push({
      key: 'search',
      label: (
        <>
          <span className="font-semibold">Search:</span> {searchValue.trim()}
        </>
      ),
      onRemove: () => onSearchChange(''),
    });
  }

  filters.filter((filter) => !filter.disabled && !['search', 'date-preset', 'date-range'].includes(filter.type)).forEach((filter) => {
    const value = values[filter.id];
    if (isEmptyFilterValue(filter, value)) return;

    const summary = getFilterSummaryLabel(filter, value);
    if (summary === null) return;

    if (Array.isArray(summary)) {
      summary.forEach((entry) => {
        const itemValue = `${entry || ''}`.trim();
        if (!itemValue) return;
        chips.push({
          key: `${filter.id}-${itemValue}`,
          label: (
            <>
              <span className="font-semibold">{filter.label}:</span> {itemValue}
            </>
          ),
          onRemove: () => {
            const next = removeValueFromMultiSelect(value, itemValue);
            onFilterValuesChange({ ...values, [filter.id]: next });
          },
        });
      });
      return;
    }

    chips.push({
      key: filter.id,
      label: (
        <>
          <span className="font-semibold">{filter.label}:</span> {summary}
        </>
      ),
      onRemove: () => {
        onFilterValuesChange({
          ...values,
          [filter.id]: getDefaultFilterValue(filter),
        });
      },
    });
  });

  if (!chips.length) return null;

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active filters</div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <div
            key={chip.key}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <span className="max-w-[18rem] truncate">{chip.label}</span>
            <button
              type="button"
              onClick={chip.onRemove}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              title="Remove filter"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
