import React, { useMemo } from 'react';
import { type StagedService } from './AppointmentServicesStep';
import { to12HourTime, to24HourTime } from '../../lib/employeeHelpers';

interface AppointmentServiceConfigurationProps {
  isRtl: boolean;
  draftConfig: Partial<StagedService>;
  setDraftConfig: React.Dispatch<React.SetStateAction<Partial<StagedService>>>;
  validStylists: any[];
  onSave: () => void;
  onCancel: () => void;
}

export default function AppointmentServiceConfiguration({
  isRtl,
  draftConfig,
  setDraftConfig,
  validStylists,
  onSave,
  onCancel
}: AppointmentServiceConfigurationProps) {
  const offsetBaseMinutes = 9 * 60;
  const formatOffsetToClockValue = (offsetMinutes?: number | null) => {
    const safeOffset = Math.max(0, Math.round(Number(offsetMinutes || 0)));
    const absoluteMinutes = offsetBaseMinutes + safeOffset;
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const convertClockToOffset = (value: string) => {
    const normalized = to24HourTime(value);
    const match = normalized.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return Number(draftConfig.startTime || 0);
    }

    const absoluteMinutes = (Number(match[1]) * 60) + Number(match[2]);
    return Math.max(0, absoluteMinutes - offsetBaseMinutes);
  };

  const timeOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    for (let absoluteMinutes = offsetBaseMinutes; absoluteMinutes < (24 * 60); absoluteMinutes += 15) {
      const hours = Math.floor(absoluteMinutes / 60);
      const minutes = absoluteMinutes % 60;
      const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      options.push({
        value,
        label: to12HourTime(value)
      });
    }
    return options;
  }, []);

  return (
    <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Team Member */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isRtl ? 'أخصائية التجميل' : 'Team member'}
            </span>
            <select
              value={draftConfig.staffId || ''}
              onChange={(e) => setDraftConfig(c => ({ ...c, staffId: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
            >
              <option value="" disabled>{isRtl ? 'اختر الأخصائية' : 'Select team member'}</option>
              {validStylists.map((stylist) => (
                <option key={stylist.id} value={stylist.id}>
                  {isRtl ? stylist.nameAr : stylist.nameEn}
                </option>
              ))}
            </select>
          </label>

          {/* Discount Setup */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {isRtl ? 'نوع الخصم' : 'Discount'}
              </span>
              <select
                value={draftConfig.discountType || 'none'}
                onChange={(e) => setDraftConfig(c => ({ ...c, discountType: e.target.value as any, discountValue: e.target.value === 'none' ? 0 : c.discountValue }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
              >
                <option value="none">{isRtl ? 'بدون خصم' : 'None'}</option>
                <option value="flat">{isRtl ? 'قيمة ثابتة' : 'Fixed'}</option>
                <option value="percent">{isRtl ? 'نسبة مئوية' : 'Percent'}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {isRtl ? 'القيمة' : 'Value'}
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                disabled={draftConfig.discountType === 'none'}
                value={draftConfig.discountValue || 0}
                onChange={(e) => setDraftConfig(c => ({ ...c, discountValue: Number(e.target.value) || 0 }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-mono font-semibold text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
              />
            </label>
          </div>

          {/* Start Time */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isRtl ? 'وقت البدء' : 'Start Time'}
            </span>
            <select
              value={formatOffsetToClockValue(draftConfig.startTime)}
              onChange={(e) => setDraftConfig((c) => ({ ...c, startTime: convertClockToOffset(e.target.value) }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* Duration */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isRtl ? 'المدة (دقائق)' : 'Duration (min)'}
            </span>
            <input
              type="number"
              step={5}
              min={5}
              value={draftConfig.duration || 60}
              onChange={(e) => setDraftConfig(c => ({ ...c, duration: Math.max(5, Number(e.target.value) || 0) }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-mono font-semibold text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {isRtl ? 'حفظ التغييرات' : 'Save configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
