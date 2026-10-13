import React, { useState } from 'react';
import { Clock, User, Calendar, AlertCircle, Check, X, Loader2 } from 'lucide-react';
import { AppointmentServiceItem } from './AppointmentServiceCard';

export interface StylistOption {
  id: string;
  nameEn: string;
  nameAr: string;
  avatar?: string;
}

export interface AppointmentServiceEditorProps {
  isRtl: boolean;
  item: AppointmentServiceItem;
  dateKey: string;
  stylists: StylistOption[];
  slotMinutes?: number;
  startHour?: number;
  totalHours?: number;
  formatMinutesToTime: (mins: number) => string;
  onSave: (updatedItem: {
    id: string;
    staffId: string;
    startTime: number;
    duration: number;
    date: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export const AppointmentServiceEditor: React.FC<AppointmentServiceEditorProps> = ({
  isRtl,
  item,
  dateKey,
  stylists,
  slotMinutes = 15,
  startHour = 9,
  totalHours = 12,
  formatMinutesToTime,
  onSave,
  onCancel,
}) => {
  const initialMinutes = typeof item.startTime === 'number' ? item.startTime : 0;
  const [selectedStaffId, setSelectedStaffId] = useState(item.staffId || (stylists[0]?.id ?? ''));
  const [selectedStartTime, setSelectedStartTime] = useState<number>(initialMinutes);
  const [selectedDuration, setSelectedDuration] = useState<number>(item.duration || 30);
  const [selectedDate, setSelectedDate] = useState<string>(dateKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const durationOptions = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedStaffId) {
      setValidationError(isRtl ? 'الرجاء اختيار خبيرة التجميل' : 'Please select an employee');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        id: item.id,
        staffId: selectedStaffId,
        startTime: selectedStartTime,
        duration: selectedDuration,
        date: selectedDate,
      });
    } catch (err: any) {
      console.error('Failed to save service edits', err);
      setValidationError(err?.message || (isRtl ? 'تعذر حفظ التعديلات بسبب تعارض' : 'Unable to save due to conflict'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FAF7FD] border-2 border-[#6537C0]/30 rounded-2xl p-4 shadow-md space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between pb-2 border-b border-[#E7DDFC]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-[#1D035F] text-white rounded-lg">
            <Clock size={14} />
          </span>
          <h4 className="text-xs font-black text-[#1D035F] uppercase tracking-wider font-sans">
            {isRtl ? 'تعديل الخدمة والخبيرة' : 'EDIT SERVICE & TIMING'}
          </h4>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-3">
        {/* Service Title & Read-Only Authoritative Price */}
        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E7DDFC]">
          <div className="min-w-0">
            <p className="text-xs font-black text-[#1D035F] truncate">
              {isRtl ? item.serviceNameAr || item.serviceNameEn : item.serviceNameEn || item.serviceNameAr}
            </p>
            {item.serviceVariantName && (
              <p className="text-[10px] font-bold text-[#6537C0] truncate">
                {isRtl ? item.serviceVariantDescription || item.serviceVariantName : item.serviceVariantName}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRtl ? 'السعر المعتمد (ثابت)' : 'Authoritative Price'}
            </span>
            <span className="font-mono font-black text-xs text-[#1D035F]">
              {item.price.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
            </span>
          </div>
        </div>

        {/* Staff Assignment Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            {isRtl ? 'خبيرة التجميل المخصصة' : 'Assigned Employee'}
          </label>
          <div className="relative">
            <select
              value={selectedStaffId}
              disabled={isSubmitting}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-white border border-[#E7DDFC] rounded-xl px-3 py-2 text-xs font-bold text-[#1D035F] outline-none focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/20 cursor-pointer"
            >
              {stylists.map((stylist) => (
                <option key={stylist.id} value={stylist.id}>
                  {isRtl ? stylist.nameAr : stylist.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Start Time & Duration Controls */}
        <div className="grid grid-cols-2 gap-2">
          {/* Start Time Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {isRtl ? 'وقت البدء' : 'Start Time'}
            </label>
            <select
              value={selectedStartTime}
              disabled={isSubmitting}
              onChange={(e) => setSelectedStartTime(parseInt(e.target.value, 10))}
              className="w-full bg-white border border-[#E7DDFC] rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-[#1D035F] outline-none focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/20 cursor-pointer"
            >
              {Array.from({ length: totalHours * (60 / slotMinutes) }).map((_, idx) => {
                const totalMins = idx * slotMinutes;
                return (
                  <option key={idx} value={totalMins}>
                    {formatMinutesToTime(totalMins)}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Duration Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {isRtl ? 'المدة' : 'Duration'}
            </label>
            <select
              value={selectedDuration}
              disabled={isSubmitting}
              onChange={(e) => setSelectedDuration(parseInt(e.target.value, 10))}
              className="w-full bg-white border border-[#E7DDFC] rounded-xl px-2.5 py-2 text-xs font-bold text-[#1D035F] outline-none focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/20 cursor-pointer"
            >
              {durationOptions.map((dur) => (
                <option key={dur} value={dur}>
                  {dur} {isRtl ? 'دقيقة' : 'mins'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            {isRtl ? 'تاريخ الموعد' : 'Date'}
          </label>
          <input
            type="date"
            value={selectedDate}
            disabled={isSubmitting}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-white border border-[#E7DDFC] rounded-xl px-3 py-2 text-xs font-bold text-[#1D035F] outline-none focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/20 cursor-pointer"
          />
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
            <p className="text-[11px] leading-snug">{validationError}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7DDFC]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6537C0] hover:bg-[#532ab0] text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>{isRtl ? 'جار التحقق والحفظ...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>{isRtl ? 'حفظ التعديلات' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
