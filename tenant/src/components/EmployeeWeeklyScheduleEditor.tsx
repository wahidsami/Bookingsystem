"use client";

import React, { useEffect, useMemo, useState } from "react";
import { tenantApi } from "@/lib/api";
import { useAppDialog } from "@/components/AppDialogProvider";
import { CalendarIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

type ShiftRecord = {
  id: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  startDate: string | null;
  endDate: string | null;
  label: string | null;
  isActive: boolean;
};

interface EmployeeWeeklyScheduleEditorProps {
  employeeId?: string | null;
  employeeName?: string;
  locale: string;
  isRTL: boolean;
  draftMode?: boolean;
  draftShifts?: ShiftRecord[];
  onDraftShiftsChange?: (shifts: ShiftRecord[]) => void;
}

const WEEK_DAYS = [
  { value: 6, labelEn: "Saturday", labelAr: "السبت" },
  { value: 0, labelEn: "Sunday", labelAr: "الأحد" },
  { value: 1, labelEn: "Monday", labelAr: "الإثنين" },
  { value: 2, labelEn: "Tuesday", labelAr: "الثلاثاء" },
  { value: 3, labelEn: "Wednesday", labelAr: "الأربعاء" },
  { value: 4, labelEn: "Thursday", labelAr: "الخميس" },
  { value: 5, labelEn: "Friday", labelAr: "الجمعة" }
];

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

function normalizeShift(shift: Partial<ShiftRecord>): ShiftRecord {
  return {
    id: `${shift.id || crypto.randomUUID()}`,
    dayOfWeek: shift.dayOfWeek ?? null,
    specificDate: shift.specificDate ?? null,
    startTime: shift.startTime || DEFAULT_START,
    endTime: shift.endTime || DEFAULT_END,
    isRecurring: shift.isRecurring !== false,
    startDate: shift.startDate ?? null,
    endDate: shift.endDate ?? null,
    label: shift.label ?? null,
    isActive: shift.isActive !== false
  };
}

function buildShiftPayload(shift: ShiftRecord) {
  return {
    isRecurring: true,
    dayOfWeek: shift.dayOfWeek,
    specificDate: null,
    startTime: shift.startTime,
    endTime: shift.endTime,
    startDate: shift.startDate || null,
    endDate: shift.endDate || null,
    label: shift.label?.trim() || null,
    isActive: shift.isActive
  };
}

export function EmployeeWeeklyScheduleEditor({
  employeeId,
  employeeName,
  locale,
  isRTL,
  draftMode = false,
  draftShifts,
  onDraftShiftsChange
}: EmployeeWeeklyScheduleEditorProps) {
  const dialog = useAppDialog();
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const isDraftMode = draftMode && !employeeId;

  const setShiftsAndMirror = (updater: React.SetStateAction<ShiftRecord[]>) => {
    setShifts((current) => {
      const next = typeof updater === "function"
        ? (updater as (value: ShiftRecord[]) => ShiftRecord[])(current)
        : updater;
      if (isDraftMode && onDraftShiftsChange) {
        onDraftShiftsChange(next.map((shift) => normalizeShift(shift)));
      }
      return next;
    });
  };

  useEffect(() => {
    if (isDraftMode) {
      setLoading(false);
      setShifts((draftShifts || []).map((shift) => normalizeShift(shift)));
      return;
    }

    if (!employeeId) {
      setShifts([]);
      return;
    }

    const loadShifts = async () => {
      setLoading(true);
      try {
        const response = await tenantApi.getEmployeeShifts(employeeId);
        const list = Array.isArray(response?.shifts)
          ? response.shifts
          : Array.isArray(response?.data?.shifts)
            ? response.data.shifts
            : [];
        setShifts(list.map((item: ShiftRecord) => normalizeShift(item)));
      } catch (err) {
        console.warn("Failed to load employee shifts:", err);
        setShifts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadShifts();
  }, [draftShifts, employeeId, isDraftMode]);

  const groupedShifts = useMemo(() => {
    const groups = new Map<number, ShiftRecord[]>();
    WEEK_DAYS.forEach(({ value }) => {
      groups.set(value, []);
    });

    shifts.forEach((shift) => {
      if (shift.isRecurring === false || shift.dayOfWeek === null) return;
      const day = shift.dayOfWeek;
      if (!groups.has(day)) {
        groups.set(day, []);
      }
      groups.get(day)!.push(shift);
    });

    WEEK_DAYS.forEach(({ value }) => {
      const items = groups.get(value) || [];
      items.sort((a, b) => a.startTime.localeCompare(b.startTime));
      groups.set(value, items);
    });

    return groups;
  }, [shifts]);

  const activeDays = WEEK_DAYS.filter(({ value }) =>
    (groupedShifts.get(value) || []).some((shift) => shift.isActive !== false)
  ).length;

  const totalRecurringShifts = shifts.filter((shift) => shift.isRecurring !== false && shift.dayOfWeek !== null).length;

  const updateLocalShift = (shiftId: string, updater: (current: ShiftRecord) => ShiftRecord) => {
    setShiftsAndMirror((current) => current.map((shift) => (shift.id === shiftId ? updater(shift) : shift)));
  };

  const persistShift = async (shiftId: string) => {
    if (isDraftMode) {
      return;
    }

    if (!employeeId) return;

    const currentShift = shifts.find((shift) => shift.id === shiftId);
    if (!currentShift) return;

    setSavingKey(shiftId);
    try {
      const response = await tenantApi.updateEmployeeShift(employeeId, shiftId, buildShiftPayload(currentShift));
      const updatedShift = normalizeShift(response?.shift || response?.data?.shift || currentShift);
      setShiftsAndMirror((current) => current.map((shift) => (shift.id === shiftId ? updatedShift : shift)));
    } catch (err: any) {
      console.error("Failed to update employee shift:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر حفظ الوردية" : "Failed to save shift",
        message: err?.message || (locale === "ar" ? "تعذر حفظ التغييرات." : "We could not save the shift changes."),
        tone: "danger"
      });
    } finally {
      setSavingKey(null);
    }
  };

  const createShiftForDay = async (dayOfWeek: number) => {
    if (isDraftMode) {
      const tempShift = normalizeShift({
        id: `temp-${dayOfWeek}-${Date.now()}`,
        dayOfWeek,
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        isRecurring: true,
        isActive: true
      });

      setShiftsAndMirror((current) => [...current, tempShift]);
      return;
    }

    if (!employeeId) return;

    const tempId = `temp-${dayOfWeek}-${Date.now()}`;
    const tempShift = normalizeShift({
      id: tempId,
      dayOfWeek,
      startTime: DEFAULT_START,
      endTime: DEFAULT_END,
      isRecurring: true,
      isActive: true
    });

    setSavingKey(tempId);
    try {
      const response = await tenantApi.createEmployeeShift(employeeId, {
        dayOfWeek,
        specificDate: null,
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        isRecurring: true,
        startDate: null,
        endDate: null,
        label: undefined
      });

      const createdShift = normalizeShift(response?.shift || response?.data?.shift || tempShift);
      setShiftsAndMirror((current) => [...current, createdShift]);
    } catch (err: any) {
      console.error("Failed to create employee shift:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر إضافة الوردية" : "Failed to add shift",
        message: err?.message || (locale === "ar" ? "تعذر إنشاء الوردية الجديدة." : "We could not create a new shift."),
        tone: "danger"
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleDay = async (dayOfWeek: number, enabled: boolean) => {
    const dayShifts = groupedShifts.get(dayOfWeek) || [];

    if (isDraftMode) {
      if (!enabled) {
        if (dayShifts.length === 0) {
          return;
        }

        setShiftsAndMirror((current) =>
          current.map((shift) =>
            shift.dayOfWeek === dayOfWeek ? { ...shift, isActive: false } : shift
          )
        );
        return;
      }

      if (dayShifts.length === 0) {
        await createShiftForDay(dayOfWeek);
        return;
      }

      setShiftsAndMirror((current) =>
        current.map((shift) =>
          shift.dayOfWeek === dayOfWeek ? { ...shift, isActive: true } : shift
        )
      );
      return;
    }

    if (!employeeId) return;

    if (!enabled) {
      if (dayShifts.length === 0) {
        return;
      }

      setSavingKey(`day-${dayOfWeek}`);
      try {
        await Promise.all(
          dayShifts.map((shift) =>
            tenantApi.updateEmployeeShift(employeeId, shift.id, {
              ...buildShiftPayload(shift),
              isActive: false
            })
          )
        );
        setShiftsAndMirror((current) =>
          current.map((shift) =>
            shift.dayOfWeek === dayOfWeek ? { ...shift, isActive: false } : shift
          )
        );
      } catch (err: any) {
        console.error("Failed to disable day:", err);
        await dialog.alert({
          title: locale === "ar" ? "تعذر تحديث اليوم" : "Failed to update day",
          message: err?.message || (locale === "ar" ? "تعذر إيقاف هذا اليوم." : "We could not disable this day."),
          tone: "danger"
        });
      } finally {
        setSavingKey(null);
      }
      return;
    }

    if (dayShifts.length === 0) {
      await createShiftForDay(dayOfWeek);
      return;
    }

    setSavingKey(`day-${dayOfWeek}`);
    try {
      await Promise.all(
        dayShifts
          .filter((shift) => shift.isActive === false)
          .map((shift) =>
            tenantApi.updateEmployeeShift(employeeId, shift.id, {
              ...buildShiftPayload(shift),
              isActive: true
            })
          )
      );
      setShiftsAndMirror((current) =>
        current.map((shift) =>
          shift.dayOfWeek === dayOfWeek ? { ...shift, isActive: true } : shift
        )
      );
    } catch (err: any) {
      console.error("Failed to enable day:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر تحديث اليوم" : "Failed to update day",
        message: err?.message || (locale === "ar" ? "تعذر تفعيل هذا اليوم." : "We could not enable this day."),
        tone: "danger"
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (isDraftMode) {
      setShiftsAndMirror((current) => current.filter((shift) => shift.id !== shiftId));
      return;
    }

    if (!employeeId) return;
    if (!(await dialog.confirm(locale === "ar" ? "هل تريد حذف هذه الوردية؟" : "Delete this shift?"))) return;

    setSavingKey(shiftId);
    try {
      const response = await tenantApi.deleteEmployeeShift(employeeId, shiftId);
      if (response?.success !== false) {
        setShifts((current) => current.filter((shift) => shift.id !== shiftId));
      }
    } catch (err: any) {
      console.error("Failed to delete shift:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر حذف الوردية" : "Failed to delete shift",
        message: err?.message || (locale === "ar" ? "تعذر حذف الوردية." : "We could not delete the shift."),
        tone: "danger"
      });
    } finally {
      setSavingKey(null);
    }
  };

  const oneTimeShiftCount = shifts.filter((shift) => shift.isRecurring === false || shift.specificDate).length;

  if (!employeeId && !isDraftMode) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6">
        <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h4 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === "ar" ? "الجدول الأسبوعي" : "Weekly schedule"}
            </h4>
            <p className="mt-1 text-sm text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === "ar"
                ? "احفظ الموظف أولاً حتى نتمكن من إدارة الورديات الأسبوعية من داخل هذه الصفحة."
                : "Save the employee first so we can manage weekly shifts directly in this section."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm">
        <div className={`flex flex-col gap-4 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'} lg:items-center lg:justify-between`}>
          <div className="min-w-0">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === "ar" ? "الجدول الأسبوعي" : "Weekly schedule"}
                </h4>
                <p className="text-sm text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {employeeName
                    ? (locale === "ar"
                      ? `إدارة ورديات ${employeeName} الأسبوعية من داخل الملف مباشرة.`
                      : `Manage ${employeeName}'s recurring weekly shifts directly from the employee profile.`)
                    : (locale === "ar"
                      ? "إدارة الورديات الأسبوعية من داخل الملف مباشرة."
                      : "Manage recurring weekly shifts directly from this profile.")}
                </p>
              </div>
            </div>
          </div>

          <div className={`flex flex-wrap items-center gap-3 ${isRTL ? 'lg:justify-start' : 'lg:justify-end'}`}>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{activeDays}</span>
              <span className="mx-1">{locale === "ar" ? "أيام نشطة من" : "active days of"}</span>
              <span className="font-semibold text-gray-900">7</span>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{totalRecurringShifts}</span>
              <span className="mx-1">{locale === "ar" ? "ورديات دورية" : "recurring shifts"}</span>
            </div>
            {oneTimeShiftCount > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                <span className="font-semibold">{oneTimeShiftCount}</span>
                <span className="mx-1">{locale === "ar" ? "ورديات لمرة واحدة" : "one-time shifts"}</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            {locale === "ar" ? "جارٍ تحميل الورديات..." : "Loading shifts..."}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr] gap-0 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 lg:grid-cols-[220px,1.2fr,1.2fr,1fr,72px]">
          <div>{locale === "ar" ? "اليوم" : "Day"}</div>
          <div>{locale === "ar" ? "الحالة" : "Status"}</div>
          <div>{locale === "ar" ? "من / إلى" : "From / To"}</div>
          <div>{locale === "ar" ? "النطاق" : "Date range"}</div>
          <div className={isRTL ? "text-left lg:text-right" : "text-right"}>{locale === "ar" ? "إجراءات" : "Actions"}</div>
        </div>

        <div className="divide-y divide-gray-100">
          {WEEK_DAYS.map((day) => {
            const dayShifts = groupedShifts.get(day.value) || [];
            const enabled = dayShifts.some((shift) => shift.isActive !== false);

            return (
              <div key={day.value} className="p-4 lg:p-5">
                <div className={`grid gap-4 ${isRTL ? 'lg:grid-cols-[1.2fr,1fr,1fr,1.1fr,auto]' : 'lg:grid-cols-[220px,1.2fr,1.2fr,1fr,72px]'}`}>
                  <div className="flex items-start gap-3">
                    <label className={`mt-1 inline-flex items-center ${isRTL ? 'flex-row-reverse gap-2' : 'gap-2'}`}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(event) => void handleToggleDay(day.value, event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        disabled={Boolean(savingKey)}
                      />
                    </label>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {locale === "ar" ? day.labelAr : day.labelEn}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dayShifts.length
                          ? (locale === "ar" ? `${dayShifts.length} وردية` : `${dayShifts.length} shift${dayShifts.length === 1 ? "" : "s"}`)
                          : (locale === "ar" ? "غير عامل" : "Not working")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {enabled
                        ? (locale === "ar" ? "نشط" : "Active")
                        : (locale === "ar" ? "غير عامل" : "Not working")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {enabled && dayShifts.length > 0 ? (
                      dayShifts.map((shift) => (
                        <div key={shift.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className={`grid gap-3 ${isRTL ? 'lg:grid-cols-[1fr,1fr,1fr,1fr,auto]' : 'lg:grid-cols-[1fr,1fr,1fr,1fr,auto]'}`}>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                {locale === "ar" ? "من" : "From"}
                              </label>
                              <input
                                type="time"
                                value={shift.startTime}
                                onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, startTime: event.target.value }))}
                                onBlur={() => void persistShift(shift.id)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                disabled={Boolean(savingKey)}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                {locale === "ar" ? "إلى" : "To"}
                              </label>
                              <input
                                type="time"
                                value={shift.endTime}
                                onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, endTime: event.target.value }))}
                                onBlur={() => void persistShift(shift.id)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                disabled={Boolean(savingKey)}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                {locale === "ar" ? "من تاريخ" : "Start date"}
                              </label>
                              <input
                                type="date"
                                value={shift.startDate || ""}
                                onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, startDate: event.target.value || null }))}
                                onBlur={() => void persistShift(shift.id)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                disabled={Boolean(savingKey)}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                {locale === "ar" ? "إلى تاريخ" : "End date"}
                              </label>
                              <input
                                type="date"
                                value={shift.endDate || ""}
                                onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, endDate: event.target.value || null }))}
                                onBlur={() => void persistShift(shift.id)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                disabled={Boolean(savingKey)}
                              />
                            </div>
                            <div className={`flex items-end ${isRTL ? 'justify-start' : 'justify-end'}`}>
                              <button
                                type="button"
                                onClick={() => void handleDeleteShift(shift.id)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                                disabled={Boolean(savingKey)}
                                aria-label={locale === "ar" ? "حذف الوردية" : "Delete shift"}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr,1fr]">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                {locale === "ar" ? "وصف الوردية" : "Shift label"}
                              </label>
                              <input
                                type="text"
                                value={shift.label || ""}
                                onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, label: event.target.value }))}
                                onBlur={() => void persistShift(shift.id)}
                                placeholder={locale === "ar" ? "مثال: وردية صباحية" : "e.g. Morning shift"}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                disabled={Boolean(savingKey)}
                                style={{ textAlign: isRTL ? 'right' : 'left' }}
                              />
                            </div>
                            <div className="flex items-center justify-start lg:justify-end">
                              {savingKey === shift.id ? (
                                <span className="text-xs font-semibold text-primary">
                                  {locale === "ar" ? "جارٍ الحفظ..." : "Saving..."}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  {locale === "ar" ? "يحفظ تلقائياً عند الخروج من الحقول" : "Auto-saves when you leave a field"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
                        {locale === "ar" ? "غير عامل" : "Not working"}
                      </div>
                    )}
                  </div>

                  <div className={`flex items-start ${isRTL ? 'justify-start' : 'justify-end'}`}>
                    <button
                      type="button"
                      onClick={() => void createShiftForDay(day.value)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
                      disabled={Boolean(savingKey)}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {locale === "ar" ? "إضافة وردية" : "Add shift"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {oneTimeShiftCount > 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {locale === "ar"
            ? "هناك ورديات لمرة واحدة موجودة بالفعل. سيستمر عرضها وإدارتها من صفحة الجداول الحالية."
            : "One-time shifts already exist. They remain available in the standalone schedules page for now."}
        </div>
      ) : null}
    </div>
  );
}
