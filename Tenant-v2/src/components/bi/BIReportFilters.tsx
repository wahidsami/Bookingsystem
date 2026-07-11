import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { BI_DATE_PRESET_OPTIONS } from '../../lib/bi';
import type { BIReportFilterDefinition, BIReportFilterValues } from '../../lib/bi';
import {
  dedupeBIOptions,
  getDefaultFilterValue,
  groupFiltersBySection,
  isToolbarLevelFilter,
} from './biFilterUtils';

interface BIReportFiltersProps {
  open: boolean;
  filters: BIReportFilterDefinition[];
  values: BIReportFilterValues;
  onApply: (next: BIReportFilterValues) => void;
  onReset: () => void;
  onClose: () => void;
}

function FilterField({
  filter,
  value,
  onChange,
}: {
  filter: BIReportFilterDefinition;
  value: unknown;
  onChange: (nextValue: unknown) => void;
}) {
  const helperText = filter.helperText ? <p className="text-xs leading-5 text-slate-500">{filter.helperText}</p> : null;

  if (filter.type === 'date-preset') {
    const presets = filter.presets && filter.presets.length
      ? Array.from(new Set(filter.presets))
      : BI_DATE_PRESET_OPTIONS.map((option) => option.value);
    return (
      <label className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
        <select
          value={typeof value === 'string' ? value : String(filter.defaultValue || 'last_30_days')}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
        >
          {presets.map((preset) => {
            const option = BI_DATE_PRESET_OPTIONS.find((item) => item.value === preset);
            return (
              <option key={preset} value={preset}>
                {option?.label || preset.replace(/_/g, ' ')}
              </option>
            );
          })}
        </select>
        {helperText}
      </label>
    );
  }

  if (filter.type === 'date-range') {
    const range = typeof value === 'object' && value ? value as { from?: string; to?: string } : {};
    return (
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={range.from || ''}
            onChange={(event) => onChange({ ...range, from: event.target.value })}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
          />
          <input
            type="date"
            value={range.to || ''}
            onChange={(event) => onChange({ ...range, to: event.target.value })}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
          />
        </div>
        {helperText}
      </div>
    );
  }

  if (filter.type === 'multi-select') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    const options = dedupeBIOptions(filter.options || []);
    return (
      <label className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
        <select
          multiple
          value={selected}
          onChange={(event) =>
            onChange(Array.from(event.target.selectedOptions).map((option) => (option as HTMLOptionElement).value))
          }
          className="min-h-40 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-500"
        >
          {options.map((option) => (
            <option key={`${filter.id}-${option.value}`} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {helperText}
      </label>
    );
  }

  if (filter.type === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-900">{filter.label}</div>
          {helperText}
        </div>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
      </label>
    );
  }

  if (filter.type === 'amount-range') {
    const range = typeof value === 'object' && value ? value as { min?: string; max?: string } : {};
    return (
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            value={range.min || ''}
            placeholder={filter.minPlaceholder || 'Min'}
            onChange={(event) => onChange({ ...range, min: event.target.value })}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
          />
          <input
            type="number"
            value={range.max || ''}
            placeholder={filter.maxPlaceholder || 'Max'}
            onChange={(event) => onChange({ ...range, max: event.target.value })}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
          />
        </div>
        {helperText}
      </div>
    );
  }

  const isSelectLike = filter.type === 'dropdown'
    || filter.type === 'status'
    || filter.type === 'employee'
    || filter.type === 'customer'
    || filter.type === 'category'
    || filter.type === 'payment-method'
    || filter.type === 'location';

  if (isSelectLike) {
    const options = dedupeBIOptions(filter.options || []);
    return (
      <label className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
        <select
          value={typeof value === 'string' ? value : String(filter.defaultValue || '')}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
        >
          <option value="">All</option>
          {options.map((option) => (
            <option key={`${filter.id}-${option.value}`} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {helperText}
      </label>
    );
  }

  return (
    <label className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={filter.type === 'search' ? filter.helperText || 'Search' : filter.helperText || ''}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-brand-500"
      />
      {helperText}
    </label>
  );
}

export function BIReportFilters({ open, filters, values, onApply, onReset, onClose }: BIReportFiltersProps) {
  const [draftValues, setDraftValues] = useState<BIReportFilterValues>(values);

  useEffect(() => {
    if (open) {
      setDraftValues(values);
    }
  }, [open, values]);

  const visibleFilters = useMemo(
    () => filters.filter((filter) => !filter.disabled && !isToolbarLevelFilter(filter)),
    [filters]
  );

  const groupedFilters = useMemo(() => groupFiltersBySection(visibleFilters), [visibleFilters]);

  const updateFilter = (id: string, nextValue: unknown) => {
    setDraftValues((current) => ({ ...current, [id]: nextValue }));
  };

  const resetFilters = () => {
    const nextValues = visibleFilters.reduce<BIReportFilterValues>((acc, filter) => {
      acc[filter.id] = getDefaultFilterValue(filter);
      return acc;
    }, {});
    setDraftValues(nextValues);
    onReset();
  };

  const applyFilters = () => {
    onApply(draftValues);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180]">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[34rem] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-500">Filters</div>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Report filters</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Toolbar search and date controls stay above the report. Use this drawer for all report-specific filters.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <X size={16} />
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {groupedFilters.length ? (
            <div className="space-y-4">
              {groupedFilters.map((section) => (
                <section key={section.section} className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">{section.section}</div>
                      <p className="mt-1 text-sm text-slate-500">Configure the filters that belong to this report section.</p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {section.filters.map((filter) => (
                      <div key={filter.id}>
                        <FilterField
                          filter={filter}
                          value={draftValues[filter.id]}
                          onChange={(nextValue) => updateFilter(filter.id, nextValue)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white p-6 text-sm leading-6 text-slate-500 shadow-sm">
              This report does not expose any additional drawer filters. Use the toolbar search and date controls above the report table.
            </section>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex items-center gap-2 rounded-full border border-brand-300 bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
