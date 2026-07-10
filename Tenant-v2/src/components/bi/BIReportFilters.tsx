import { useMemo } from 'react';
import { BI_DATE_PRESET_OPTIONS } from '../../lib/bi';
import type { BIReportFilterDefinition, BIReportFilterValues } from '../../lib/bi';

interface BIReportFiltersProps {
  filters: BIReportFilterDefinition[];
  values: BIReportFilterValues;
  onChange: (next: BIReportFilterValues) => void;
}

export function BIReportFilters({ filters, values, onChange }: BIReportFiltersProps) {
  const visibleFilters = useMemo(() => filters.filter((filter) => !filter.disabled), [filters]);
  if (!visibleFilters.length) return null;

  const updateFilter = (id: string, nextValue: unknown) => {
    onChange({ ...values, [id]: nextValue });
  };

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleFilters.map((filter) => {
          const currentValue = values[filter.id];

          if (filter.type === 'date-preset') {
            const presets = filter.presets && filter.presets.length
              ? filter.presets
              : BI_DATE_PRESET_OPTIONS.map((option) => option.value);
            return (
              <label key={filter.id} className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {filter.label}
                </div>
                <select
                  value={typeof currentValue === 'string' ? currentValue : String(filter.defaultValue || 'last_30_days')}
                  onChange={(event) => updateFilter(filter.id, event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
                >
                  {presets.map((preset) => {
                    const option = BI_DATE_PRESET_OPTIONS.find((item) => item.value === preset);
                    return (
                      <option key={preset} value={preset}>
                        {option?.label || preset}
                      </option>
                    );
                  })}
                </select>
                {filter.helperText ? <p className="text-xs text-slate-500">{filter.helperText}</p> : null}
              </label>
            );
          }

          if (filter.type === 'date-range') {
            const range = typeof currentValue === 'object' && currentValue ? currentValue as { from?: string; to?: string } : {};
            return (
              <div key={filter.id} className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={range.from || ''}
                    onChange={(event) => updateFilter(filter.id, { ...range, from: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
                  />
                  <input
                    type="date"
                    value={range.to || ''}
                    onChange={(event) => updateFilter(filter.id, { ...range, to: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
                  />
                </div>
                {filter.helperText ? <p className="text-xs text-slate-500">{filter.helperText}</p> : null}
              </div>
            );
          }

          if (filter.type === 'multi-select') {
            const selected = Array.isArray(currentValue) ? currentValue.map(String) : [];
            const options = filter.options as { label: string; value: string; disabled?: boolean }[];
            return (
              <label key={filter.id} className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
                <select
                  multiple
                  value={selected}
                  onChange={(event) =>
                    updateFilter(
                      filter.id,
                      Array.from(event.target.selectedOptions as unknown as HTMLOptionElement[]).map((option) => option.value)
                    )
                  }
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (filter.type === 'boolean') {
            return (
              <label key={filter.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{filter.label}</div>
                  {filter.helperText ? <p className="text-xs text-slate-500">{filter.helperText}</p> : null}
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(currentValue)}
                  onChange={(event) => updateFilter(filter.id, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </label>
            );
          }

          if (filter.type === 'amount-range') {
            const range = typeof currentValue === 'object' && currentValue ? currentValue as { min?: string; max?: string } : {};
            return (
              <div key={filter.id} className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={range.min || ''}
                    placeholder={filter.minPlaceholder || 'Min'}
                    onChange={(event) => updateFilter(filter.id, { ...range, min: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
                  />
                  <input
                    type="number"
                    value={range.max || ''}
                    placeholder={filter.maxPlaceholder || 'Max'}
                    onChange={(event) => updateFilter(filter.id, { ...range, max: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
                  />
                </div>
                {filter.helperText ? <p className="text-xs text-slate-500">{filter.helperText}</p> : null}
              </div>
            );
          }

          const isSelectLike = filter.type === 'dropdown' || filter.type === 'status' || filter.type === 'employee' || filter.type === 'customer' || filter.type === 'category' || filter.type === 'payment-method' || filter.type === 'location';
          if (isSelectLike) {
            const options = ('options' in filter && Array.isArray(filter.options)) ? filter.options : [];
            return (
              <label key={filter.id} className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
                <select
                  value={typeof currentValue === 'string' ? currentValue : String(filter.defaultValue || '')}
                  onChange={(event) => updateFilter(filter.id, event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
                >
                  <option value="">All</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {filter.helperText ? <p className="text-xs text-slate-500">{filter.helperText}</p> : null}
              </label>
            );
          }

          return (
            <label key={filter.id} className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
              <input
                type="text"
                value={typeof currentValue === 'string' ? currentValue : ''}
                onChange={(event) => updateFilter(filter.id, event.target.value)}
                placeholder={filter.type === 'search' ? filter.helperText || 'Search' : filter.helperText || ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
              />
              {filter.helperText ? <p className="text-xs text-slate-500">{filter.helperText}</p> : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}
