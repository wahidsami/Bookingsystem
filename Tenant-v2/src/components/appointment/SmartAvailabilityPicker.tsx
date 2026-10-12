import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Users,
  Check,
  Loader2,
  AlertCircle,
  CalendarDays,
  X
} from 'lucide-react';
import type {
  SmartSlot,
  DayAvailabilitySummary,
  NextAvailableAlternative
} from '../../services/smartAvailabilityService';

export interface SmartAvailabilityPickerProps {
  isRtl: boolean;
  smartAvailabilityDate: Date;
  onDateChange: (date: Date) => void;
  currentStartTime: number;
  formatMinutesToTime: (mins: number) => string;
  isCheckingAllProfessionals: boolean;
  onToggleCheckAllProfessionals: () => void;
  loading: boolean;
  summary: DayAvailabilitySummary | null;
  nextAlternative: NextAvailableAlternative | null;
  isSearchingNextDate: boolean;
  onSelectSlot: (slot: SmartSlot) => void;
  onJumpToNextDate: (alt: NextAvailableAlternative) => void;
  onClose: () => void;
}

export const SmartAvailabilityPicker: React.FC<SmartAvailabilityPickerProps> = ({
  isRtl,
  smartAvailabilityDate,
  onDateChange,
  currentStartTime,
  formatMinutesToTime,
  isCheckingAllProfessionals,
  onToggleCheckAllProfessionals,
  loading,
  summary,
  nextAlternative,
  isSearchingNextDate,
  onSelectSlot,
  onJumpToNextDate,
  onClose
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');

  const dateInputString = `${smartAvailabilityDate.getFullYear()}-${String(smartAvailabilityDate.getMonth() + 1).padStart(2, '0')}-${String(smartAvailabilityDate.getDate()).padStart(2, '0')}`;

  const handlePrevDay = () => {
    const prev = new Date(smartAvailabilityDate);
    prev.setDate(prev.getDate() - 1);
    onDateChange(prev);
  };

  const handleNextDay = () => {
    const next = new Date(smartAvailabilityDate);
    next.setDate(next.getDate() + 1);
    onDateChange(next);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split('-').map(Number);
    if (year && month && day) {
      onDateChange(new Date(year, month - 1, day, 12, 0, 0));
    }
  };

  // Determine active slots based on period filter
  const displayedSlots: SmartSlot[] = React.useMemo(() => {
    if (!summary?.slots) return [];
    if (selectedPeriod === 'all') return summary.slots;
    return summary.slotsByPeriod[selectedPeriod] || [];
  }, [summary, selectedPeriod]);

  const dateDisplay = smartAvailabilityDate.toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="rounded-2xl border border-purple-200 bg-white p-3.5 shadow-sm space-y-3 animate-fadeIn text-xs">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-[#6537C0]/10 text-[#6537C0] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h5 className="font-black text-slate-900 text-xs">
              {isRtl ? 'الأوقات المتاحة للحجز الذكي' : 'Smart Available Times'}
            </h5>
            <p className="text-[10px] text-slate-500 font-medium">
              {isRtl ? 'فحص فوري عبر جدول الصالون والمختصين' : 'Real-time schedule and team availability'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          title={isRtl ? 'إغلاق' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Date Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title={isRtl ? 'اليوم السابق' : 'Previous Day'}
          >
            {isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          <div className="relative flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#6537C0] shrink-0" />
            <span className="font-bold text-slate-800 text-xs min-w-[90px] text-center">
              {dateDisplay}
            </span>
            <input
              type="date"
              value={dateInputString}
              onChange={handleDateInputChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title={isRtl ? 'اختر تاريخاً' : 'Select date'}
            />
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title={isRtl ? 'اليوم التالي' : 'Next Day'}
          >
            {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleToday}
          className="text-[10px] font-black uppercase tracking-wider text-[#6537C0] hover:bg-purple-50 px-2 py-1 rounded-md border border-purple-200 bg-white transition cursor-pointer"
        >
          {isRtl ? 'اليوم' : 'Today'}
        </button>
      </div>

      {/* Professionals Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={onToggleCheckAllProfessionals}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
            isCheckingAllProfessionals
              ? 'bg-[#1D035F] text-white border-[#1D035F] shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isRtl ? 'فحص جميع المختصين' : 'Check all professionals'}</span>
          {isCheckingAllProfessionals && <Check className="w-3 h-3 text-emerald-400" />}
        </button>

        {summary && summary.eligibleStaff && summary.eligibleStaff.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5 no-scrollbar">
            {summary.eligibleStaff.slice(0, 4).map((st) => (
              <span
                key={st.id}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                  st.available
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                }`}
                title={st.available ? (isRtl ? 'متاح' : 'Available') : (isRtl ? 'غير متاح' : 'Unavailable')}
              >
                {isRtl ? st.nameAr : st.nameEn}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Period Filter Pills */}
      {summary && summary.availableCount > 0 && (
        <div className="flex items-center gap-1 border-t border-slate-100 pt-2">
          {(['all', 'morning', 'afternoon', 'evening'] as const).map((period) => {
            const count = period === 'all'
              ? summary.availableCount
              : (summary.slotsByPeriod[period]?.length || 0);

            if (count === 0 && period !== 'all') return null;

            const labelsEn: Record<string, string> = {
              all: 'All',
              morning: 'Morning',
              afternoon: 'Afternoon',
              evening: 'Evening'
            };
            const labelsAr: Record<string, string> = {
              all: 'الكل',
              morning: 'الصباح',
              afternoon: 'بعد الظهر',
              evening: 'المساء'
            };

            const active = selectedPeriod === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  active
                    ? 'bg-purple-100 text-[#6537C0] border border-purple-200'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span>{isRtl ? labelsAr[period] : labelsEn[period]}</span>
                <span className="font-mono text-[9px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Slots Body */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-[#6537C0]" />
          <span className="text-[11px] font-medium">
            {isRtl ? 'جارٍ فحص التوافر المباشر...' : 'Checking real-time availability...'}
          </span>
        </div>
      ) : summary && summary.availableCount > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
            {displayedSlots.map((slot) => {
              const slotMins = slot.boardMinutes ?? slot.timeMinutes;
              const isSelected = slotMins === currentStartTime;

              return (
                <button
                  key={`${slot.startTime}-${slot.staffId || 'any'}`}
                  type="button"
                  onClick={() => onSelectSlot(slot)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#6537C0] text-white border-[#6537C0] shadow-xs scale-102 ring-2 ring-purple-400/20'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                  }`}
                >
                  <span className="leading-tight">{slot.clockLabel}</span>
                  {slot.staffName && (
                    <span className={`text-[8px] font-sans truncate max-w-[70px] ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                      {slot.staffName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 text-center font-medium">
            {isRtl
              ? `إجمالي ${summary.availableCount} موعداً متاحاً في ${dateDisplay}`
              : `${summary.availableCount} valid slots available on ${dateDisplay}`}
          </p>
        </div>
      ) : (
        /* Empty State / No Availability */
        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-center space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h6 className="font-bold text-amber-900 text-xs">
              {isRtl ? 'لا توجد أوقات مناسبة في هذا اليوم' : 'No available slots on this date'}
            </h6>
            <p className="text-[11px] text-amber-700/90 max-w-xs mx-auto">
              {isRtl
                ? 'الجدول محجوز بالكامل أو أن المختصين غير متاحين لكامل مدة الخدمات المحددة.'
                : 'The schedule is full or team members are unavailable for the complete service duration.'}
            </p>

            {!isCheckingAllProfessionals && (
              <button
                type="button"
                onClick={onToggleCheckAllProfessionals}
                className="mt-1 text-[11px] font-bold text-[#6537C0] hover:underline cursor-pointer"
              >
                {isRtl ? '⚡ فحص التوافر مع جميع المختصين' : '⚡ Check with all qualified professionals'}
              </button>
            )}
          </div>

          {/* Next Available Date Offer (Phase 3 Requirement 2) */}
          {isSearchingNextDate ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6537C0]" />
              <span className="text-[11px] font-medium">
                {isRtl ? 'جارٍ البحث عن أقرب موعد متاح...' : 'Finding next available date...'}
              </span>
            </div>
          ) : nextAlternative && nextAlternative.found ? (
            <div className="rounded-xl border-2 border-dashed border-[#6537C0]/30 bg-purple-50/40 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#6537C0] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                    {isRtl ? 'أقرب تاريخ متاح' : 'Next Available Date'}
                  </p>
                  <p className="text-xs font-bold text-slate-900 truncate">
                    <span>{isRtl ? nextAlternative.displayDateAr : nextAlternative.displayDateEn}</span>
                    {nextAlternative.earliestSlot && (
                      <span className="font-mono text-[#6537C0] ms-1">
                        @{nextAlternative.earliestSlot.clockLabel}
                      </span>
                    )}
                  </p>
                  {nextAlternative.daysAhead !== null && nextAlternative.daysAhead > 0 && (
                    <p className="text-[10px] text-slate-500">
                      {isRtl ? `(بعد ${nextAlternative.daysAhead} يومًا)` : `(in ${nextAlternative.daysAhead} days)`}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onJumpToNextDate(nextAlternative)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#6537C0] hover:bg-[#532ab0] text-white text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>{isRtl ? 'الانتقال لهذا التاريخ 🗓️' : 'Jump to this date 🗓️'}</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
