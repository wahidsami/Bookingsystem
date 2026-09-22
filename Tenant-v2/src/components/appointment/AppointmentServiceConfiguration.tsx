import React, { useState, useEffect, useRef, useMemo } from 'react';
import { type StagedService } from './AppointmentServicesStep';
import { to12HourTime, to24HourTime } from '../../lib/employeeHelpers';
import { useEarlyAvailabilityValidation } from '../../hooks/useEarlyAvailabilityValidation';
import { useTimeSlotAvailability, type TimeSlotOption } from '../../hooks/useTimeSlotAvailability';
import { AlertCircle, CheckCircle2, Loader2, ChevronDown, Clock } from 'lucide-react';

interface AppointmentServiceConfigurationProps {
  tenantId: string;
  tenantTimezone: string;
  selectedDate: string;
  serviceId: string;
  service?: any;
  variantId?: string;
  isRtl: boolean;
  boardStartHour?: number;
  slotMinutes?: number;
  draftConfig: Partial<StagedService>;
  setDraftConfig: React.Dispatch<React.SetStateAction<Partial<StagedService>>>;
  validStylists: any[];
  otherStagedServices?: any[];
  onSave: () => void;
  onCancel: () => void;
}

export default function AppointmentServiceConfiguration({
  tenantId,
  tenantTimezone,
  selectedDate,
  serviceId,
  service,
  variantId,
  isRtl,
  boardStartHour = 9,
  slotMinutes = 5,
  draftConfig,
  setDraftConfig,
  validStylists,
  otherStagedServices = [],
  onSave,
  onCancel
}: AppointmentServiceConfigurationProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const effectiveVariantId = draftConfig.variantId || variantId;

  const availableVariants = useMemo(() => {
    return Array.isArray(service?.variants) ? service.variants : [];
  }, [service?.variants]);

  const activeVariant = useMemo(() => {
    if (!effectiveVariantId) return null;
    return availableVariants.find((v: any) => v.id === effectiveVariantId) || null;
  }, [availableVariants, effectiveVariantId]);

  const handleVariantChange = (newVariantId: string) => {
    const selected = availableVariants.find((v: any) => v.id === newVariantId);
    if (!selected) return;
    const newDuration = Number(selected.duration || service?.duration || 30);
    const newPrice = Number(selected.finalPrice ?? selected.rawPrice ?? selected.price ?? service?.finalPrice ?? service?.price ?? 0);
    setDraftConfig(c => ({
      ...c,
      variantId: selected.id,
      duration: newDuration,
      basePrice: newPrice,
      finalPrice: newPrice
    }));
  };

  const validation = useEarlyAvailabilityValidation({
    tenantId,
    serviceId,
    variantId: effectiveVariantId,
    staffId: draftConfig.staffId,
    dateKey: selectedDate,
    tenantTimezone,
    boardStartHour,
    startTimeMinutes: Number(draftConfig.startTime || 0)
  });

  const { slots: timeSlotOptions, loading: availabilityLoading } = useTimeSlotAvailability({
    tenantId,
    tenantTimezone,
    dateKey: selectedDate,
    serviceId,
    variantId: effectiveVariantId,
    staffId: draftConfig.staffId,
    duration: Math.max(1, Number(draftConfig.duration || activeVariant?.duration || service?.duration || 60)),
    bufferBefore: Number(service?.bufferBefore || 0),
    bufferAfter: Number(service?.bufferAfter || 0),
    boardStartHour,
    slotMinutes,
    otherStagedServices,
    isRtl
  });

  const offsetBaseMinutes = boardStartHour * 60;
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

  const currentClockValue = formatOffsetToClockValue(draftConfig.startTime);
  const currentSlot = timeSlotOptions.find((s) => s.value === currentClockValue);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Scroll to current selected slot when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isDropdownOpen]);

  return (
    <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
      <div className="space-y-5">
        {/* Service Variant Selector / Information */}
        {availableVariants.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {isRtl ? 'البديل / الخيار المحدد' : 'Service Variant'}
              </span>
              {activeVariant && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
                  <span>{isRtl ? (activeVariant.name_ar || activeVariant.nameAr || activeVariant.name_en || activeVariant.nameEn) : (activeVariant.name_en || activeVariant.nameEn || activeVariant.name_ar || activeVariant.nameAr)}</span>
                  <span>•</span>
                  <span>{activeVariant.duration || service?.duration} {isRtl ? 'دقيقة' : 'min'}</span>
                  <span>•</span>
                  <span dir="ltr">{Number(activeVariant.finalPrice ?? activeVariant.rawPrice ?? activeVariant.price ?? 0).toFixed(2)} SAR</span>
                </span>
              )}
            </div>

            {availableVariants.length > 1 && (
              <select
                value={effectiveVariantId || ''}
                onChange={(e) => handleVariantChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
              >
                {availableVariants.map((v: any) => {
                  const vName = isRtl
                    ? (v.name_ar || v.nameAr || v.name_en || v.nameEn)
                    : (v.name_en || v.nameEn || v.name_ar || v.nameAr);
                  const vPrice = Number(v.finalPrice ?? v.rawPrice ?? v.price ?? 0);
                  const vDuration = Number(v.duration || service?.duration || 0);
                  return (
                    <option key={v.id} value={v.id}>
                      {vName} — {vDuration} {isRtl ? 'دقيقة' : 'min'} ({vPrice.toFixed(2)} SAR)
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Team Member */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isRtl ? 'الموظف المختص' : 'Team member'}
            </span>
            <select
              value={draftConfig.staffId || ''}
              onChange={(e) => setDraftConfig(c => ({ ...c, staffId: e.target.value, isExplicitStaff: Boolean(e.target.value) }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
            >
              <option value="">{isRtl ? 'أي موظف' : 'Any Professional'}</option>
              {validStylists.map((stylist) => (
                <option key={stylist.id} value={stylist.id}>
                  {isRtl ? stylist.nameAr : stylist.nameEn}
                </option>
              ))}
            </select>
          </label>


          {/* Validation Status */}
          {draftConfig.staffId && validation.status !== 'idle' && (
            <div className="col-span-full md:col-span-2 -mt-2 mb-1">
              {validation.status === 'loading' && (
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isRtl ? 'جاري التحقق من التوفر...' : 'Checking availability...'}
                </p>
              )}
              {validation.status === 'available' && (
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isRtl ? 'متاح في الوقت المحدد' : `Available at ${to12HourTime(formatOffsetToClockValue(draftConfig.startTime))}`}
                </p>
              )}
              {validation.status === 'needs_overtime' && validation.diagnostic && (
                <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-900 mt-1 mb-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
                    <div>
                      <span className="font-semibold text-indigo-800">
                        {isRtl ? 'تجاوز ساعات العمل' : 'Overtime candidate'}
                      </span>
                      <p className="opacity-90 mt-0.5">
                        {validation.diagnostic.reasonType === 'after_employee_duty' && (isRtl ? `الموعد سيتجاوز ساعات عمل الموظف — ينتهي دوامه الساعة ${validation.diagnostic.workingHoursEnd || ''}` : `Appointment exceeds employee duty — duty ends at ${validation.diagnostic.workingHoursEnd || ''}`)}
                        {validation.diagnostic.reasonType === 'after_tenant_close' && (isRtl ? `الموعد سيتجاوز ساعات عمل المركز — يغلق المركز الساعة ${validation.diagnostic.workingHoursEnd || ''}` : `Appointment exceeds center hours — closes at ${validation.diagnostic.workingHoursEnd || ''}`)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftConfig(c => ({ ...c, overtimeApproval: { approved: true } }))}
                    className="self-start rounded-md bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-indigo-700"
                  >
                    {isRtl ? 'الموافقة على العمل الإضافي' : 'Approve Overtime'}
                  </button>
                </div>
              )}
              {validation.status === 'unavailable' && validation.diagnostic && (() => {
                const diag = validation.diagnostic;
                const structuredMsg = isRtl
                  ? (diag.messageAr || diag.message)
                  : (diag.message || diag.messageAr);
                const guidance = isRtl
                  ? (diag.actionableGuidanceAr || diag.actionableGuidance)
                  : (diag.actionableGuidance || diag.actionableGuidanceAr);

                // Fallback title: ONLY say employee is unavailable if it's truly a staff reason
                const isStaffReason = [
                  'staff_break',
                  'time_off',
                  'existing_booking',
                  'no_employee_duty',
                  'before_employee_duty',
                  'after_employee_duty',
                  'staff_unavailable'
                ].includes(diag.reasonType || diag.conflictType || '');

                const fallbackTitle = isStaffReason
                  ? (isRtl ? 'الموظف غير متاح في هذا الوقت.' : 'Staff is unavailable at this time.')
                  : (isRtl ? 'الوقت المحدد غير متاح.' : 'Unavailable at this time.');

                return (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 mt-1 mb-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="space-y-1">
                      {structuredMsg ? (
                        <p className="font-semibold leading-snug text-amber-950">
                          {structuredMsg}
                        </p>
                      ) : (
                        <div>
                          <span className="font-semibold text-amber-900">
                            {fallbackTitle}
                          </span>
                          <span className="ml-1 opacity-90 block mt-0.5">
                            {diag.reasonType === 'staff_break' && (isRtl ? 'الموظف لديه استراحة في هذا الوقت' : 'Staff break')}
                            {diag.reasonType === 'time_off' && (isRtl ? 'الموظف غير متاح بسبب إجازة/وقت محجوز' : 'Time off')}
                            {diag.reasonType === 'existing_booking' && (isRtl ? 'الموظف لديه حجز آخر في هذا الوقت' : 'Existing booking')}
                            {diag.reasonType === 'before_tenant_open' && (isRtl ? 'الموعد يبدأ قبل ساعات عمل المركز' : 'Appointment starts before center hours')}
                            {diag.reasonType === 'after_tenant_close' && (isRtl ? 'الموعد سيتجاوز ساعات عمل المركز' : 'Appointment exceeds center hours')}
                            {diag.reasonType === 'tenant_closed' && (isRtl ? 'المركز مغلق في هذا اليوم' : 'Center is closed on this day')}
                            {diag.reasonType === 'no_employee_duty' && (isRtl ? 'الموظف ليس لديه دوام في هذا اليوم' : 'Employee has no duty on this day')}
                            {diag.reasonType === 'before_employee_duty' && (isRtl ? 'الموظف خارج ساعات عمله — يبدأ دوامه لاحقاً' : 'Outside employee duty hours')}
                            {diag.reasonType === 'after_employee_duty' && (isRtl ? 'الموعد سيتجاوز ساعات عمل الموظف' : 'Appointment exceeds employee duty')}
                            {diag.reasonType === 'outside_working_hours' && (isRtl ? 'خارج أوقات العمل' : 'Outside working hours')}
                            {diag.reasonType === 'blocked_time' && (isRtl ? 'وقت محجوز' : 'Blocked time')}
                            {diag.reasonType === 'resource_occupied' && (isRtl ? 'المورد المطلوب مشغول حالياً بموعد آخر' : 'Required resource is currently occupied')}
                            {diag.reasonType === 'resource_pool_exhausted' && (isRtl ? 'جميع الموارد من هذا النوع مشغولة' : 'All resources of this type are occupied')}
                            {diag.reasonType === 'resource_unconfigured' && (isRtl ? 'المورد المطلوب غير مهيأ في النظام' : 'Required resource is not configured')}
                            {diag.reasonType === 'insufficient_total_capacity' && (isRtl ? 'السعة الإجمالية للمورد غير كافية' : 'Insufficient resource capacity')}
                            {(!diag.reasonType || diag.reasonType === 'unavailable') && (isRtl ? 'غير متوفر' : 'Unavailable')}
                            {diag.startTime && diag.endTime && (
                              ` (${new Date(diag.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(diag.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`
                            )}
                          </span>
                        </div>
                      )}

                      {guidance && (
                        <p className="text-[10.5px] font-medium text-amber-800/90 pt-0.5">
                          {guidance}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

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
          <div className="block relative" ref={dropdownRef}>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isRtl ? 'وقت البدء' : 'Start Time'}
            </span>

            {/* Hidden native select for form compatibility / programmatic test drivers */}
            <select
              data-testid="start-time-native-select"
              value={currentClockValue}
              onChange={(e) => setDraftConfig((c) => ({ ...c, startTime: convertClockToOffset(e.target.value), timingMode: 'manual' }))}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              {timeSlotOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={!option.available}>
                  {option.label} {option.available ? '🟢' : `🔴 (${option.reason})`}
                </option>
              ))}
            </select>

            {/* Custom Dropdown Trigger */}
            <button
              type="button"
              data-testid="start-time-dropdown-trigger"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              className="w-full flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm transition hover:border-slate-400 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ${
                    currentSlot?.available !== false ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-rose-500 ring-2 ring-rose-100'
                  }`}
                />
                <span className="truncate">{to12HourTime(currentClockValue)}</span>
                {currentSlot && !currentSlot.available && (
                  <span className="text-[10px] font-medium text-rose-600 bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded-md">
                    {currentSlot.reason}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
            </button>

            {/* Dropdown Options Popover */}
            {isDropdownOpen && (
              <div
                ref={listRef}
                data-testid="start-time-dropdown-panel"
                className="absolute z-50 mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl max-h-64 overflow-y-auto"
              >
                <div className="px-2.5 py-1.5 mb-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{isRtl ? 'الأوقات المتاحة والمحجوزة' : 'Schedule intervals'}</span>
                  </span>
                  {availabilityLoading && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      {isRtl ? 'تحديث...' : 'Updating...'}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {timeSlotOptions.map((option) => {
                    const isSelected = option.value === currentClockValue;
                    const isAvailable = option.available;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        ref={isSelected ? selectedItemRef : undefined}
                        data-time={option.value}
                        data-available={isAvailable ? 'true' : 'false'}
                        disabled={!isAvailable}
                        onClick={() => {
                          if (isAvailable) {
                            setDraftConfig((c) => ({
                              ...c,
                              startTime: convertClockToOffset(option.value),
                              timingMode: 'manual'
                            }));
                            setIsDropdownOpen(false);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition text-left rtl:text-right ${
                          isSelected
                            ? 'bg-slate-100 font-bold ring-1 ring-slate-300 text-slate-900'
                            : ''
                        } ${
                          isAvailable
                            ? 'hover:bg-emerald-50/80 cursor-pointer text-slate-800'
                            : 'bg-rose-50/20 text-slate-400 cursor-not-allowed opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                              isAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span className={`${isAvailable ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                            {option.label}
                          </span>
                        </div>

                        <div>
                          {isAvailable ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                              {isRtl ? 'متاح' : 'Available'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-rose-700 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-full">
                              {option.reason}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
