import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar, Clock, Plus, Trash2, Check, AlertCircle, Save, Info, Sparkles
} from 'lucide-react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import { getTenantBusinessHours } from '../lib/tenantWorkingHours';

interface SubShift {
  id: string;
  label: 'Morning Shift' | 'Evening Shift' | 'Overtime Shift' | 'Restock & Prep';
  startTime: string;
  endTime: string;
}

interface DailySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayEn: string;
  dayAr: string;
  status: 'working' | 'off';
  startTime: string;
  endTime: string;
  subShifts: SubShift[];
}

interface EmployeeWeeklyScheduleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  isRtl: boolean;
  staffId: string;
  staffName: string;
  addLocalToast: (msgAr: string, msgEn: string, type?: 'success' | 'info' | 'warning') => void;
  onSave?: (updatedShifts: DailySchedule[]) => void;
  onBoardChanged?: () => Promise<void> | void;
}

const DEFAULT_WEEKLY_DAYS: Omit<DailySchedule, 'subShifts'>[] = [
  { dayOfWeek: 0, dayEn: 'Sunday', dayAr: 'الأحد', status: 'off', startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 1, dayEn: 'Monday', dayAr: 'الاثنين', status: 'working', startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 2, dayEn: 'Tuesday', dayAr: 'الثلاثاء', status: 'working', startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 3, dayEn: 'Wednesday', dayAr: 'الأربعاء', status: 'working', startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 4, dayEn: 'Thursday', dayAr: 'Thursday', status: 'working', startTime: '09:00', endTime: '21:00' },
  { dayOfWeek: 5, dayEn: 'Friday', dayAr: 'الجمعة', status: 'off', startTime: '13:00', endTime: '21:00' },
  { dayOfWeek: 6, dayEn: 'Saturday', dayAr: 'السبت', status: 'working', startTime: '10:00', endTime: '18:00' },
];

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function to24HourTime(value: string) {
  const match = `${value || ''}`.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    const raw = `${value || ''}`.trim();
    return raw.length >= 5 ? raw.slice(0, 5) : raw;
  }

  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function createDefaultWeeklyDays(settings?: Record<string, any> | null, tenant?: Record<string, any> | null): Omit<DailySchedule, 'subShifts'>[] {
  const businessHours = getTenantBusinessHours(settings, tenant);
  return DEFAULT_WEEKLY_DAYS.map((day, index) => {
    const canonical = businessHours[WEEKDAY_KEYS[index]];
    const isWorking = canonical?.isOpen ?? day.status === 'working';
    return {
      ...day,
      status: isWorking ? 'working' : 'off',
      startTime: canonical?.open || day.startTime,
      endTime: canonical?.close || day.endTime
    };
  });
}

export default function EmployeeWeeklyScheduleEditor({
  isOpen,
  onClose,
  isRtl,
  staffId,
  staffName,
  addLocalToast,
  onSave,
  onBoardChanged
}: EmployeeWeeklyScheduleEditorProps) {
  const { tenant, tenantSettings } = useTenantAuth();
  const defaultWeeklyDays = useMemo(() => createDefaultWeeklyDays(tenantSettings, tenant), [tenantSettings, tenant]);
  const [scheduleType, setScheduleType] = useState<'recurring' | 'onetime'>('recurring');
  const [schedule, setSchedule] = useState<DailySchedule[]>([]);
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('');
  const [isContinuous, setIsContinuous] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load shifts for this staff member
  useEffect(() => {
    if (!isOpen) return;

    const loadLiveSchedule = async () => {
      try {
        const response = await tenantApiAdapter.getEmployeeShifts(staffId);
        const shifts = Array.isArray(response?.shifts)
          ? response.shifts
          : Array.isArray(response?.data?.shifts)
            ? response.data.shifts
            : [];

        if (shifts.length === 0) {
          setSchedule(defaultWeeklyDays.map((day) => ({ ...day, subShifts: [] })));
          return;
        }

        const initialSchedule: DailySchedule[] = defaultWeeklyDays.map((day) => {
          const dayShifts = shifts
            .filter((shift: any) => shift.dayOfWeek === day.dayOfWeek && shift.isActive !== false)
            .sort((a: any, b: any) => `${a.startTime || ''}`.localeCompare(`${b.startTime || ''}`));

          if (dayShifts.length === 0) {
            return {
              ...day,
              status: 'off',
              subShifts: []
            };
          }

          const [primary, ...rest] = dayShifts;
          return {
            ...day,
            status: 'working',
            startTime: to24HourTime(primary.startTime || day.startTime),
            endTime: to24HourTime(primary.endTime || day.endTime),
            subShifts: rest.map((shift: any, index: number) => ({
              id: shift.id || `sub-${day.dayOfWeek}-${index}`,
              label: (shift.label as SubShift['label']) || 'Morning Shift',
              startTime: to24HourTime(shift.startTime || day.startTime),
              endTime: to24HourTime(shift.endTime || day.endTime)
            }))
          };
        });

        setSchedule(initialSchedule);
      } catch (err) {
        console.warn('Failed to load live weekly schedule, using defaults:', err);
        setSchedule(defaultWeeklyDays.map((day) => ({ ...day, subShifts: [] })));
      }
    };

    void loadLiveSchedule();
  }, [isOpen, staffId, defaultWeeklyDays]);

  const handleToggleDay = (idx: number) => {
    setSchedule(prev => prev.map((day, dIdx) => {
      if (dIdx === idx) {
        return {
          ...day,
          status: day.status === 'working' ? 'off' : 'working'
        };
      }
      return day;
    }));
  };

  const handleTimeChange = (idx: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedule(prev => prev.map((day, dIdx) => {
      if (dIdx === idx) {
        return {
          ...day,
          [field]: value
        };
      }
      return day;
    }));
  };

  const handleAddSubShift = (idx: number) => {
    setSchedule(prev => prev.map((day, dIdx) => {
      if (dIdx === idx) {
        const newSub: SubShift = {
          id: `sub-${Date.now()}-${Math.random()}`,
          label: 'Morning Shift',
          startTime: '09:00',
          endTime: '13:00'
        };
        return {
          ...day,
          subShifts: [...day.subShifts, newSub]
        };
      }
      return day;
    }));
  };

  const handleUpdateSubShift = (dayIdx: number, subId: string, field: keyof SubShift, value: string) => {
    setSchedule(prev => prev.map((day, dIdx) => {
      if (dIdx === dayIdx) {
        return {
          ...day,
          subShifts: day.subShifts.map(sub => {
            if (sub.id === subId) {
              return { ...sub, [field]: value };
            }
            return sub;
          })
        };
      }
      return day;
    }));
  };

  const handleRemoveSubShift = (dayIdx: number, subId: string) => {
    setSchedule(prev => prev.map((day, dIdx) => {
      if (dIdx === dayIdx) {
        return {
          ...day,
          subShifts: day.subShifts.filter(sub => sub.id !== subId)
        };
      }
      return day;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const existingResponse = await tenantApiAdapter.getEmployeeShifts(staffId);
      const existingShifts = Array.isArray(existingResponse?.shifts)
        ? existingResponse.shifts
        : Array.isArray(existingResponse?.data?.shifts)
          ? existingResponse.data.shifts
          : [];

      await Promise.allSettled(existingShifts.map((shift: any) => tenantApiAdapter.deleteEmployeeShift(staffId, shift.id)));

      const saveTasks: Promise<any>[] = [];
      schedule.forEach((day) => {
        if (day.status !== 'working') return;

        const baseShift = {
          dayOfWeek: day.dayOfWeek,
          specificDate: null,
          startTime: to24HourTime(day.startTime),
          endTime: to24HourTime(day.endTime),
          isRecurring: scheduleType === 'recurring',
          startDate: scheduleType === 'recurring' ? (startDate || null) : null,
          endDate: scheduleType === 'recurring' ? (endDate || null) : null,
          label: `${staffName} Shift`
        };

        saveTasks.push(tenantApiAdapter.createEmployeeShift(staffId, {
          ...baseShift,
          specificDate: scheduleType === 'onetime' ? (startDate || null) : null
        }));

        day.subShifts.forEach((subShift) => {
          saveTasks.push(tenantApiAdapter.createEmployeeShift(staffId, {
            dayOfWeek: day.dayOfWeek,
            specificDate: null,
            startTime: to24HourTime(subShift.startTime),
            endTime: to24HourTime(subShift.endTime),
            isRecurring: scheduleType === 'recurring',
            startDate: scheduleType === 'recurring' ? (startDate || null) : null,
            endDate: scheduleType === 'recurring' ? (endDate || null) : null,
            label: subShift.label
          }));
        });
      });

      await Promise.all(saveTasks);
      setIsSaving(false);
      addLocalToast(
        `تم تحديث وحفظ شيفتات عمل ${staffName} بنجاح ومزامنة الجدول!`,
        `Successfully updated weekly shift schedules for ${staffName} and synchronized the board!`,
        'success'
      );
      if (onSave) {
        onSave(schedule);
      }
      if (onBoardChanged) {
        await onBoardChanged();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save weekly shifts', err);
      setIsSaving(false);
      addLocalToast(
        `تعذر حفظ جدول عمل ${staffName}`,
        `Failed to save weekly schedule for ${staffName}`,
        'warning'
      );
    }
  };

  // Summaries
  const activeDaysCount = schedule.filter(d => d.status === 'working').length;
  const recurringShiftsCount = schedule.filter(d => d.status === 'working').length;
  const totalSubShiftsCount = schedule.reduce((acc, d) => acc + (d.status === 'working' ? d.subShifts.length : 0), 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]"
        >
          {/* Header */}
          <div className="bg-zinc-950 text-white p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider block">
                  {isRtl ? 'إعدادات جداول الموظفين' : 'ROSTER RETAIL CONTROLLER'}
                </span>
                <h3 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                  <span>{isRtl ? `جدول عمل الموظفة: ${staffName}` : `Schedule Editor: ${staffName}`}</span>
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30 font-bold">
                    ID: {staffId}
                  </span>
                </h3>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-start">
            {/* Top Config Panel (Date range and type selectors) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              
              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-neutral-500 font-extrabold block">
                  {isRtl ? 'نوع وجدولة الوردية' : 'Schedule Policy Type'}
                </label>
                <div className="flex bg-slate-200 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setScheduleType('recurring')}
                    className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      scheduleType === 'recurring' 
                        ? 'bg-white text-zinc-950 shadow-xs' 
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {isRtl ? 'شيفت مكرر دوري' : 'Recurring Roster'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('onetime')}
                    className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      scheduleType === 'onetime' 
                        ? 'bg-white text-zinc-950 shadow-xs' 
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {isRtl ? 'شيفت لمرة واحدة' : 'One-Time Only'}
                  </button>
                </div>
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-neutral-500 font-extrabold block">
                  {isRtl ? 'تاريخ بداية السريان' : 'Policy Effective Start'}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-neutral-800 focus:ring-1 focus:ring-zinc-950 outline-none"
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-neutral-500 font-extrabold block">
                    {isRtl ? 'تاريخ نهاية الصلاحية' : 'Policy Effective End'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsContinuous(!isContinuous);
                      if (!isContinuous) setEndDate('');
                    }}
                    className={`text-[9px] font-bold underline cursor-pointer ${isContinuous ? 'text-indigo-600' : 'text-neutral-400'}`}
                  >
                    {isRtl ? 'مستمر بلا نهاية' : 'Set Continuous'}
                  </button>
                </div>
                {isContinuous ? (
                  <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] text-indigo-700 font-black text-center">
                    {isRtl ? 'وردية مستمرة مفتوحة النهاية ♾️' : 'Continuous / Open-Ended ♾️'}
                  </div>
                ) : (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold font-mono text-neutral-800 focus:ring-1 focus:ring-zinc-950 outline-none"
                  />
                )}
              </div>

            </div>

            {/* Shift Count Summary Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <span className="text-[10px] text-emerald-700 font-black block uppercase">{isRtl ? 'أيام العمل النشطة' : 'Active Work Days'}</span>
                  <span className="text-xs font-mono font-black text-slate-800">{activeDaysCount} {isRtl ? 'أيام' : 'days'}</span>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <div>
                  <span className="text-[10px] text-amber-700 font-black block uppercase">{isRtl ? 'الورديات الدورية' : 'Recurring Shifts'}</span>
                  <span className="text-xs font-mono font-black text-slate-800">{recurringShiftsCount} {isRtl ? 'شيفتات' : 'shifts'}</span>
                </div>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-2xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <div>
                  <span className="text-[10px] text-indigo-700 font-black block uppercase">{isRtl ? 'الشيفتات الفرعية' : 'Sub-Shifts Total'}</span>
                  <span className="text-xs font-mono font-black text-slate-800">{totalSubShiftsCount} {isRtl ? 'كتلة' : 'sub-shifts'}</span>
                </div>
              </div>

              {scheduleType === 'onetime' && (
                <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-2xl flex items-center gap-3 col-span-2 sm:col-span-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <div>
                    <span className="text-[10px] text-purple-700 font-black block uppercase">{isRtl ? 'شيفت استثنائي' : 'One-Time Shifts'}</span>
                    <span className="text-xs font-mono font-black text-slate-800">1 {isRtl ? 'نشط' : 'active'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Weekly schedule Editor Grid */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-[11px] text-neutral-400 font-black uppercase tracking-wider block">
                  {isRtl ? 'إعداد جدول الأيام والساعات التفصيلي' : 'Configuring Weekly Working Days & Split Shifts'}
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded font-black">
                  Refah System v1.1
                </span>
              </div>

              <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                {schedule.map((day, idx) => {
                  const isWorking = day.status === 'working';
                  return (
                    <div 
                      key={day.dayOfWeek} 
                      className={`p-4 rounded-2xl border transition-all ${
                        isWorking 
                          ? 'bg-slate-50/75 border-slate-200 shadow-3xs' 
                          : 'bg-neutral-50/60 border-neutral-200 text-neutral-400'
                      }`}
                    >
                      {/* Day Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleDay(idx)}
                            className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                              isWorking 
                                ? 'bg-zinc-950 text-white' 
                                : 'bg-white border border-slate-250 text-slate-400'
                            }`}
                          >
                            {isRtl ? day.dayAr.substring(0, 3) : day.dayEn.substring(0, 3)}
                          </button>
                          <div>
                            <span className="text-xs font-black block text-neutral-800">
                              {isRtl ? day.dayAr : day.dayEn}
                            </span>
                            <span className="text-[9px] text-neutral-400 font-bold block">
                              {isWorking 
                                ? (isRtl ? 'يوم عمل مجدول' : 'Active Working Day') 
                                : (isRtl ? 'إجازة أسبوعية رسمية' : 'Weekly Roster Day Off')}
                            </span>
                          </div>
                        </div>

                        {/* Timing controls */}
                        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                          <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl flex-1">
                            <Clock size={12} className="text-neutral-400 shrink-0 ml-1" />
                            <input
                              type="time"
                              step={900}
                              disabled={!isWorking}
                              value={day.startTime}
                              onChange={(e) => handleTimeChange(idx, 'startTime', e.target.value)}
                              className="w-full text-center font-mono text-xs font-black bg-transparent border-none outline-none disabled:text-neutral-300"
                            />
                            <span className="text-neutral-300 font-bold">→</span>
                            <input
                              type="time"
                              step={900}
                              disabled={!isWorking}
                              value={day.endTime}
                              onChange={(e) => handleTimeChange(idx, 'endTime', e.target.value)}
                              className="w-full text-center font-mono text-xs font-black bg-transparent border-none outline-none disabled:text-neutral-300"
                            />
                          </div>

                          {isWorking && (
                            <button
                              type="button"
                              onClick={() => handleAddSubShift(idx)}
                              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1"
                            >
                              <Plus size={12} />
                              <span>{isRtl ? 'كتلة إضافية' : '+ Sub-Shift'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Sub-Shifts split block rows */}
                      {isWorking && day.subShifts.length > 0 && (
                        <div className="mt-3 pl-6 border-l-2 border-indigo-100 space-y-2 animate-fadeIn text-xs">
                          <p className="text-[9px] text-indigo-700 font-black tracking-widest uppercase mb-1">
                            {isRtl ? 'الشيفتات والكتل الإضافية المقررة لهذا اليوم:' : 'Daily Nested Split Shifts / Breaks:'}
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {day.subShifts.map((sub) => (
                              <div key={sub.id} className="bg-white p-2.5 rounded-xl border border-indigo-100/70 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <select
                                    value={sub.label}
                                    onChange={(e) => handleUpdateSubShift(idx, sub.id, 'label', e.target.value)}
                                    className="bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-black text-neutral-800"
                                  >
                                    <option value="Morning Shift">{isRtl ? 'شيفت صباحي' : 'Morning Shift'}</option>
                                    <option value="Evening Shift">{isRtl ? 'شيفت مسائي' : 'Evening Shift'}</option>
                                    <option value="Overtime Shift">{isRtl ? 'شيفت إضافي' : 'Overtime Shift'}</option>
                                    <option value="Restock & Prep">{isRtl ? 'تجهيز وتحضير' : 'Restock & Prep'}</option>
                                  </select>
                                  
                                  <div className="flex items-center gap-1 min-w-0 shrink-0">
                                    <input
                                      type="time"
                                      step={900}
                                      value={sub.startTime}
                                      onChange={(e) => handleUpdateSubShift(idx, sub.id, 'startTime', e.target.value)}
                                      className="w-16 text-center bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-bold font-mono"
                                    />
                                    <span className="text-neutral-300 font-mono text-[9px]">→</span>
                                    <input
                                      type="time"
                                      step={900}
                                      value={sub.endTime}
                                      onChange={(e) => handleUpdateSubShift(idx, sub.id, 'endTime', e.target.value)}
                                      className="w-16 text-center bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-bold font-mono"
                                    />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveSubShift(idx, sub.id)}
                                  className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 p-4 border-t border-slate-150 flex justify-between items-center shrink-0">
            <div className="text-[10px] text-neutral-400 font-bold hidden sm:block flex-1 text-start">
              <span className="flex items-center gap-1">
                <Info size={11} className="text-indigo-500 shrink-0" />
                {isRtl 
                  ? 'يتم دمج وتطبيق الشيفتات فوراً على سجل المواعيد الفعلي وحساب السعة.'
                  : 'Modifications automatically refresh client-side calendar availability slots.'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                {isRtl ? 'إلغاء وتراجع' : 'Discard / Cancel'}
              </button>
              
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-black bg-zinc-950 text-white rounded-xl hover:bg-zinc-850 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isRtl ? 'جاري المزامنة...' : 'Synchronizing...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>{isRtl ? 'حفظ وتأكيد الوردية' : 'Save Weekly Schedule'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
