import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TeamMemberData } from '../../types/employee';

// Utility functions extracted from TeamsWorkspace
function to24HourTime(value: string) {
  const raw = `${value || ''}`.trim();
  if (!raw) return '';

  const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = amPmMatch[2];
    const period = amPmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  const timeMatch = raw.match(/^(\d{2}):(\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`;
  }

  return raw.length >= 5 ? raw.slice(0, 5) : raw;
}

function parseScheduleRange(hours: string) {
  const raw = `${hours || ''}`.trim();
  if (!raw || /^day off$/i.test(raw)) {
    return { startTime: '', endTime: '', isOff: true };
  }

  const [startRaw, ...rest] = raw.replace(/[?"?"]/g, '-').split('-').map((part) => part.trim()).filter(Boolean);
  const endRaw = rest.join(' - ');

  return {
    startTime: to24HourTime(startRaw || ''),
    endTime: to24HourTime(endRaw || ''),
    isOff: false
  };
}

function to12HourTime(value: string) {
  const raw = `${value || ''}`.trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function formatScheduleRange(startTime: string, endTime: string) {
  const start = to12HourTime(startTime);
  const end = to12HourTime(endTime);
  if (!start || !end) {
    return 'Day Off';
  }
  return `${start} - ${end}`;
}

function parseTimeForInput(value: string) {
  return to24HourTime(value);
}

interface ShiftMatrixSectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
}

export default function ShiftMatrixSection({ formData, setFormData, isRtl }: ShiftMatrixSectionProps) {

  const handleScheduleDayToggle = (dayIndex: number) => {
    setFormData((prev) => {
      const cloned = [...prev.schedule];
      const target = { ...cloned[dayIndex] };

      if (target.status === 'working') {
        target.status = 'off';
        target.hours = 'Day Off';
        target.slots = [];
        target.subShifts = [];
      } else {
        target.status = 'working';
        target.hours = formatScheduleRange('09:00', '18:00');
        target.subShifts = [];
      }

      cloned[dayIndex] = target;
      return { ...prev, schedule: cloned };
    });
  };

  const handleScheduleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setFormData((prev) => {
      const cloned = [...prev.schedule];
      const target = { ...cloned[dayIndex] };
      const currentParsed = parseScheduleRange(target.hours);
      
      const newStartTime = field === 'startTime' ? value : currentParsed.startTime;
      const newEndTime = field === 'endTime' ? value : currentParsed.endTime;
      
      target.hours = formatScheduleRange(newStartTime, newEndTime);
      cloned[dayIndex] = target;
      return { ...prev, schedule: cloned };
    });
  };

  const handleAddSubShift = (dayIndex: number) => {
    setFormData((prev) => {
      const cloned = [...prev.schedule];
      const target = { ...cloned[dayIndex] };
      
      if (!target.subShifts) {
        target.subShifts = [];
      }

      target.subShifts.push({
        id: `shift_${Date.now()}`,
        label: 'Evening Shift',
        startTime: '16:00',
        endTime: '20:00'
      });

      cloned[dayIndex] = target;
      return { ...prev, schedule: cloned };
    });
  };

  const handleRemoveSubShift = (dayIndex: number, subShiftId: string) => {
    setFormData((prev) => {
      const cloned = [...prev.schedule];
      const target = { ...cloned[dayIndex] };
      
      if (target.subShifts) {
        target.subShifts = target.subShifts.filter((sub) => sub.id !== subShiftId);
      }

      cloned[dayIndex] = target;
      return { ...prev, schedule: cloned };
    });
  };

  const handleSubShiftChange = (dayIndex: number, subShiftId: string, field: 'label' | 'startTime' | 'endTime', value: string) => {
    setFormData((prev) => {
      const cloned = [...prev.schedule];
      const target = { ...cloned[dayIndex] };
      
      if (target.subShifts) {
        const subShiftIndex = target.subShifts.findIndex((sub) => sub.id === subShiftId);
        if (subShiftIndex >= 0) {
          const subShiftCloned = { ...target.subShifts[subShiftIndex] };
          if (field === 'startTime' || field === 'endTime') {
            subShiftCloned[field] = formatScheduleRange(
              field === 'startTime' ? value : parseTimeForInput(subShiftCloned.startTime),
              field === 'endTime' ? value : parseTimeForInput(subShiftCloned.endTime)
            ).split(' - ')[field === 'startTime' ? 0 : 1] || value; 
            // In TeamsWorkspace.tsx it might have just set the value directly or formatted it.
            // Let's just set the value directly since `parseTimeForInput` handles parsing, and `to12HourTime` could be used.
            // Actually, in the original code:
            // The handler inside TeamsWorkspace usually sets `subShift[field] = to12HourTime(value)`.
            subShiftCloned[field] = to12HourTime(value);
          } else {
            subShiftCloned[field] = value;
          }
          target.subShifts[subShiftIndex] = subShiftCloned;
        }
      }

      cloned[dayIndex] = target;
      return { ...prev, schedule: cloned };
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border-b border-neutral-100 pb-2 flex justify-between items-start gap-4">
        <div>
          <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{isRtl ? 'إعداد وجدولة شيفتات العمل الأسبوعية' : 'Weekly Shifts & Roster Scheduler'}</h4>
          <p className="text-[11px] text-neutral-400 font-medium">Assign weekly operational shifts, date ranges, and define visibility parameters for the Staff App schedules.</p>
        </div>
        
        {/* Draft Shift status indicator */}
        <button
          type="button"
          onClick={() => setFormData(p => ({ ...p, scheduleDraft: !p.scheduleDraft }))}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black cursor-pointer transition-all border flex items-center gap-1.5 ${
            formData.scheduleDraft
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${formData.scheduleDraft ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {formData.scheduleDraft 
            ? (isRtl ? 'وضع المسودة (مخفي)' : 'Draft Mode (Hidden)') 
            : (isRtl ? 'منشور (نشط للعملاء)' : 'Published (Live to Clients)')}
        </button>
      </div>

      {/* Date-Range and Visibility Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        
        {/* Visibility select */}
        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'مدى رؤية جدول العمل (بالأسابيع)' : 'Staff App Visibility Range'}</label>
          <select
            value={formData.scheduleVisibilityWeeks}
            onChange={e => setFormData(p => ({ ...p, scheduleVisibilityWeeks: parseInt(e.target.value) || 2 }))}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800"
          >
            <option value="1">{isRtl ? 'أسبوع واحد مقبل' : '1 Week Ahead'}</option>
            <option value="2">{isRtl ? 'أسبوعين (موصى به)' : '2 Weeks Ahead (Recommended)'}</option>
            <option value="3">{isRtl ? '٣ أسابيع متتالية' : '3 Weeks Ahead'}</option>
            <option value="4">{isRtl ? 'شهر كامل (٤ أسابيع)' : '4 Weeks Ahead (Full Month)'}</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'تاريخ بدء تفعيل الجدول' : 'Schedule Start Date'}</label>
          <input
            type="date"
            value={formData.scheduleStartDate || ''}
            onChange={e => setFormData(p => ({ ...p, scheduleStartDate: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-neutral-800"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'تاريخ انتهاء الجدول' : 'Schedule End Date'}</label>
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, scheduleContinues: !p.scheduleContinues, scheduleEndDate: !p.scheduleContinues ? '' : p.scheduleEndDate }))}
              className={`text-[9px] font-black underline cursor-pointer ${formData.scheduleContinues ? 'text-indigo-600' : 'text-neutral-400'}`}
            >
              {isRtl ? 'بلا تاريخ نهاية' : 'Set Continuous'}
            </button>
          </div>
          {formData.scheduleContinues ? (
            <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] text-indigo-700 font-black text-center">
              {isRtl ? 'جدول مستمر مفتوح النهاية ♾️' : 'Continuous / Open-Ended ♾️'}
            </div>
          ) : (
            <input
              type="date"
              value={formData.scheduleEndDate || ''}
              onChange={e => setFormData(p => ({ ...p, scheduleEndDate: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-neutral-800"
            />
          )}
        </div>

      </div>

      {/* Weekly Schedule Planner */}
      <div className="space-y-3">
        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'ساعات العمل اليومية وتعيين الإجازات' : 'Configure Weekly Daily Hours'}</label>
        <div className="space-y-2">
          {formData.schedule.map((day, idx) => (
            <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleScheduleDayToggle(idx)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                      day.status === 'working' 
                        ? 'bg-zinc-950 text-white' 
                        : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}
                  >
                    {isRtl ? day.dayAr : day.dayEn}
                  </button>
                  <span className="text-[10px] text-neutral-400 font-bold">
                    {day.status === 'working' ? (isRtl ? 'يوم عمل نشط' : 'Active Working Day') : (isRtl ? 'يوم إجازة رسمي' : 'Weekly Day Off')}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                  <input
                    type="time"
                    step={900}
                    disabled={day.status !== 'working'}
                    value={parseScheduleRange(day.hours).startTime}
                    onChange={e => handleScheduleTimeChange(idx, 'startTime', e.target.value)}
                    className={`flex-1 text-center font-bold text-xs font-mono p-2 rounded-xl border transition-all ${
                      day.status === 'working'
                        ? 'bg-white border-slate-200 text-neutral-800 focus:ring-1 focus:ring-zinc-900'
                        : 'bg-neutral-100 border-neutral-100 text-neutral-400 cursor-not-allowed'
                    }`}
                  />
                  <span className="text-neutral-300 font-black text-[10px]">→</span>
                  <input
                    type="time"
                    step={900}
                    disabled={day.status !== 'working'}
                    value={parseScheduleRange(day.hours).endTime}
                    onChange={e => handleScheduleTimeChange(idx, 'endTime', e.target.value)}
                    className={`flex-1 text-center font-bold text-xs font-mono p-2 rounded-xl border transition-all ${
                      day.status === 'working'
                        ? 'bg-white border-slate-200 text-neutral-800 focus:ring-1 focus:ring-zinc-900'
                        : 'bg-neutral-100 border-neutral-100 text-neutral-400 cursor-not-allowed'
                    }`}
                  />
                  {day.status === 'working' && (
                    <button
                      type="button"
                      onClick={() => handleAddSubShift(idx)}
                      className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-black rounded-xl cursor-pointer transition-all whitespace-nowrap flex items-center gap-1"
                    >
                      <Plus size={11} />
                      <span>{isRtl ? 'شيفت فرعي' : '+ Sub Shift'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Shifts Container */}
              {day.status === 'working' && day.subShifts && day.subShifts.length > 0 && (
                <div className="pl-6 border-l-2 border-indigo-100 space-y-2 mt-2 animate-fade-in">
                  <p className="text-[10px] text-indigo-700 font-black tracking-wider uppercase mb-1">{isRtl ? 'الشيفتات والكتل الإضافية المقررة لهذا اليوم:' : 'Scheduled Daily Sub Shifts:'}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {day.subShifts.map((sub) => (
                      <div key={sub.id} className="bg-white p-2.5 rounded-xl border border-indigo-100/70 flex items-center gap-2">
                        <select
                          value={sub.label}
                          onChange={e => handleSubShiftChange(idx, sub.id, 'label', e.target.value)}
                          className="bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-black text-neutral-800"
                        >
                          <option value="Morning Shift">{isRtl ? 'شيفت صباحي' : 'Morning Shift'}</option>
                          <option value="Evening Shift">{isRtl ? 'شيفت مسائي' : 'Evening Shift'}</option>
                          <option value="Overtime Shift">{isRtl ? 'شيفت إضافي' : 'Overtime Shift'}</option>
                          <option value="Restock & Prep">{isRtl ? 'تجهيز وتحضير' : 'Restock & Prep'}</option>
                        </select>
                        <input
                          type="time"
                          step={900}
                          value={parseTimeForInput(sub.startTime)}
                          onChange={e => handleSubShiftChange(idx, sub.id, 'startTime', e.target.value)}
                          className="w-16 text-center bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-bold font-mono"
                        />
                        <span className="text-[10px] text-neutral-400 font-black font-mono">→</span>
                        <input
                          type="time"
                          step={900}
                          value={parseTimeForInput(sub.endTime)}
                          onChange={e => handleSubShiftChange(idx, sub.id, 'endTime', e.target.value)}
                          className="w-16 text-center bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-bold font-mono"
                        />
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
          ))}
        </div>
      </div>

    </div>
  );
}
