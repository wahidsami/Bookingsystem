import React from 'react';
import { Plus, Trash2, Calendar, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { TeamMemberData } from '../../types/employee';

// Utility functions
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

  const [startRaw, ...rest] = raw.replace(/[–—]/g, '-').split('-').map((part) => part.trim()).filter(Boolean);
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
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

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
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-neutral-100 pb-3 flex justify-between items-start gap-4">
        <div>
          <h4 className="text-sm font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <Calendar size={16} className="text-[#6537C0]" />
            <span>{isRtl ? 'إعداد وجدولة شيفتات العمل الأسبوعية' : 'Weekly Shifts & Roster Scheduler'}</span>
          </h4>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            {isRtl 
              ? 'تحديد ساعات العمل اليومية، الفترات الإضافية، وأيام الإجازة الرسمية للموظف.' 
              : 'Assign operational shifts, additional shift intervals, and weekly scheduled days off.'}
          </p>
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
          <span>
            {formData.scheduleDraft 
              ? (isRtl ? 'مسودة (غير معتمد)' : 'Draft Mode') 
              : (isRtl ? 'منشور (نشط للحجز)' : 'Published (Active)')}
          </span>
        </button>
      </div>

      {/* Date-Range and Visibility Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-neutral-50/60 p-4 rounded-2xl border border-neutral-200/80">
        
        {/* Visibility select */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
            <Clock size={12} className="text-[#6537C0]" />
            <span>{isRtl ? 'مدى رؤية الجدول بالتطبيق' : 'App Visibility Window'}</span>
          </label>
          <select
            value={formData.scheduleVisibilityWeeks}
            onChange={e => setFormData(p => ({ ...p, scheduleVisibilityWeeks: parseInt(e.target.value) || 2 }))}
            className="w-full bg-white border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
          >
            <option value="1">{isRtl ? 'أسبوع واحد مقبل' : '1 Week Ahead'}</option>
            <option value="2">{isRtl ? 'أسبوعين (موصى به)' : '2 Weeks Ahead (Recommended)'}</option>
            <option value="3">{isRtl ? '٣ أسابيع متتالية' : '3 Weeks Ahead'}</option>
            <option value="4">{isRtl ? 'شهر كامل (٤ أسابيع)' : '4 Weeks Ahead (Full Month)'}</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold block">
            {isRtl ? 'تاريخ بدء تفعيل الجدول' : 'Schedule Start Date'}
          </label>
          <input
            type="date"
            value={formData.scheduleStartDate || ''}
            onChange={e => setFormData(p => ({ ...p, scheduleStartDate: e.target.value }))}
            className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-900 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[11px] text-neutral-600 font-extrabold block">
              {isRtl ? 'تاريخ انتهاء الجدول' : 'Schedule End Date'}
            </label>
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, scheduleContinues: !p.scheduleContinues, scheduleEndDate: !p.scheduleContinues ? '' : p.scheduleEndDate }))}
              className={`text-[10px] font-bold cursor-pointer transition-colors ${formData.scheduleContinues ? 'text-[#6537C0] underline' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              {isRtl ? 'مستمر بلا نهاية' : 'Set Continuous'}
            </button>
          </div>
          {formData.scheduleContinues ? (
            <div className="p-2.5 bg-purple-50/70 border border-purple-200/80 rounded-xl text-[11px] text-[#1D035F] font-bold text-center">
              {isRtl ? 'جدول عمل مستمر ♾️' : 'Continuous Schedule ♾️'}
            </div>
          ) : (
            <input
              type="date"
              value={formData.scheduleEndDate || ''}
              onChange={e => setFormData(p => ({ ...p, scheduleEndDate: e.target.value }))}
              className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-900 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
            />
          )}
        </div>

      </div>

      {/* Weekly Schedule Planner */}
      <div className="space-y-3">
        <label className="text-[11px] text-neutral-600 font-extrabold block">
          {isRtl ? 'ساعات العمل اليومية وتعيين الإجازات الأسبوعية' : 'Daily Working Hours & Days Off'}
        </label>
        <div className="space-y-2.5">
          {formData.schedule.map((day, idx) => (
            <div key={idx} className="bg-neutral-50/60 p-3.5 rounded-2xl border border-neutral-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                {/* Day Badge & Status */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleScheduleDayToggle(idx)}
                    className={`min-w-[85px] px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all shadow-xs ${
                      day.status === 'working' 
                        ? 'bg-[#1D035F] hover:bg-[#2A0878] text-white' 
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isRtl ? day.dayAr : day.dayEn}
                  </button>
                  <span className={`text-[11px] font-bold ${day.status === 'working' ? 'text-neutral-700' : 'text-neutral-400'}`}>
                    {day.status === 'working' 
                      ? (isRtl ? 'يوم عمل نشط' : 'Working Day') 
                      : (isRtl ? 'يوم إجازة رسمي' : 'Day Off')}
                  </span>
                </div>
                
                {/* Shift Time Range with Direction-Aware Arrow */}
                <div className="flex flex-col gap-2 flex-1 sm:max-w-md">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <label className="space-y-1">
                      <span className="block text-[9px] font-extrabold uppercase tracking-wider text-neutral-500">
                        {isRtl ? 'من' : 'Start'}
                      </span>
                      <input
                        type="time"
                        step={900}
                        disabled={day.status !== 'working'}
                        value={parseScheduleRange(day.hours).startTime}
                        onChange={e => handleScheduleTimeChange(idx, 'startTime', e.target.value)}
                        className={`w-full text-center font-bold text-xs font-mono p-2 rounded-xl border transition-all [color-scheme:light] ${
                          day.status === 'working'
                            ? 'bg-white border-neutral-300 text-neutral-900 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                        }`}
                      />
                    </label>
                    <div className="flex items-center justify-center pt-4">
                      <ArrowIcon size={14} className="text-[#6537C0] shrink-0" />
                    </div>
                    <label className="space-y-1">
                      <span className="block text-[9px] font-extrabold uppercase tracking-wider text-neutral-500">
                        {isRtl ? 'إلى' : 'End'}
                      </span>
                      <input
                        type="time"
                        step={900}
                        disabled={day.status !== 'working'}
                        value={parseScheduleRange(day.hours).endTime}
                        onChange={e => handleScheduleTimeChange(idx, 'endTime', e.target.value)}
                        className={`w-full text-center font-bold text-xs font-mono p-2 rounded-xl border transition-all [color-scheme:light] ${
                          day.status === 'working'
                            ? 'bg-white border-neutral-300 text-neutral-900 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                        }`}
                      />
                    </label>
                  </div>
                  {day.status === 'working' && (
                    <button
                      type="button"
                      onClick={() => handleAddSubShift(idx)}
                      className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#1D035F] text-[10px] font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap flex items-center justify-center gap-1"
                    >
                      <Plus size={11} className="text-[#6537C0]" />
                      <span>{isRtl ? 'إضافة شيفت إضافي لهذا اليوم' : '+ Add Sub Shift'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Shifts Container with Correct RTL Start Border */}
              {day.status === 'working' && day.subShifts && day.subShifts.length > 0 && (
                <div className="border-s-2 border-purple-200 ps-4 space-y-2 mt-2 animate-fade-in">
                  <p className="text-[10px] text-[#6537C0] font-black tracking-wider uppercase">
                    {isRtl ? 'الشيفتات الإضافية المقررة لهذا اليوم:' : 'Scheduled Additional Sub Shifts:'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {day.subShifts.map((sub) => (
                      <div key={sub.id} className="bg-white p-2.5 rounded-xl border border-purple-100 flex flex-col gap-2 shadow-xs">
                        <select
                          value={sub.label}
                          onChange={e => handleSubShiftChange(idx, sub.id, 'label', e.target.value)}
                          className="bg-neutral-50 border border-neutral-200 rounded-lg p-1 text-[10px] font-bold text-neutral-800 focus:border-[#6537C0]"
                        >
                          <option value="Morning Shift">{isRtl ? 'شيفت صباحي' : 'Morning Shift'}</option>
                          <option value="Evening Shift">{isRtl ? 'شيفت مسائي' : 'Evening Shift'}</option>
                          <option value="Overtime Shift">{isRtl ? 'شيفت إضافي' : 'Overtime Shift'}</option>
                          <option value="Restock & Prep">{isRtl ? 'تجهيز وتحضير' : 'Restock & Prep'}</option>
                        </select>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                          <label className="space-y-0.5">
                            <span className="block text-[8px] font-extrabold uppercase tracking-wider text-neutral-400">
                              {isRtl ? 'من' : 'Start'}
                            </span>
                            <input
                              type="time"
                              step={900}
                              value={parseTimeForInput(sub.startTime)}
                              onChange={e => handleSubShiftChange(idx, sub.id, 'startTime', e.target.value)}
                              className="w-full text-center bg-neutral-50 border border-neutral-200 rounded-lg p-1 text-[10px] font-bold font-mono text-neutral-900 [color-scheme:light]"
                            />
                          </label>
                          <div className="flex items-center justify-center pt-3">
                            <ArrowIcon size={12} className="text-[#6537C0] shrink-0" />
                          </div>
                          <label className="space-y-0.5">
                            <span className="block text-[8px] font-extrabold uppercase tracking-wider text-neutral-400">
                              {isRtl ? 'إلى' : 'End'}
                            </span>
                            <input
                              type="time"
                              step={900}
                              value={parseTimeForInput(sub.endTime)}
                              onChange={e => handleSubShiftChange(idx, sub.id, 'endTime', e.target.value)}
                              className="w-full text-center bg-neutral-50 border border-neutral-200 rounded-lg p-1 text-[10px] font-bold font-mono text-neutral-900 [color-scheme:light]"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubShift(idx, sub.id)}
                          className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[9px] font-bold"
                        >
                          <Trash2 size={12} />
                          <span>{isRtl ? 'حذف الشيفت الفرعي' : 'Remove Sub Shift'}</span>
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
