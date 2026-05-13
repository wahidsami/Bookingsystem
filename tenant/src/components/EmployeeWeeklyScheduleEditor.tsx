"use client";

import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
  isDraft?: boolean;
};

interface EmployeeWeeklyScheduleEditorProps {
  employeeId?: string | null;
  employeeName?: string;
  locale: string;
  isRTL: boolean;
  draftMode?: boolean;
  draftShifts?: ShiftRecord[];
  onDraftShiftsChange?: (shifts: ShiftRecord[]) => void;
  sharedStartDate?: string | null;
  sharedEndDate?: string | null;
  onSharedRangeChange?: (range: { startDate: string | null; endDate: string | null }) => void;
  onSummaryChange?: (summary: {
    activeDays: number;
    recurringShifts: number;
    oneTimeShifts: number;
  }) => void;
}

export interface EmployeeWeeklyScheduleEditorHandle {
  flushDraftShifts: () => Promise<boolean>;
}

type ScheduleMode = "recurring" | "one-time";

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
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return value;
});

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
    isActive: shift.isActive !== false,
    isDraft: shift.isDraft === true
  };
}

function buildShiftPayload(shift: ShiftRecord, sharedStartDate: string | null, sharedEndDate: string | null) {
  return {
    isRecurring: shift.isRecurring !== false,
    dayOfWeek: shift.isRecurring !== false ? shift.dayOfWeek : null,
    specificDate: shift.isRecurring !== false ? null : (shift.specificDate || sharedStartDate || null),
    startTime: shift.startTime,
    endTime: shift.endTime,
    startDate: shift.isRecurring !== false ? (sharedStartDate || shift.startDate || null) : null,
    endDate: shift.isRecurring !== false ? (sharedEndDate || shift.endDate || null) : null,
    label: shift.label?.trim() || null,
    isActive: shift.isActive
  };
}

export const EmployeeWeeklyScheduleEditor = React.forwardRef<EmployeeWeeklyScheduleEditorHandle, EmployeeWeeklyScheduleEditorProps>(function EmployeeWeeklyScheduleEditor({
  employeeId,
  employeeName,
  locale,
  isRTL,
  draftMode = false,
  draftShifts,
  onDraftShiftsChange,
  sharedStartDate = null,
  sharedEndDate = null,
  onSharedRangeChange,
  onSummaryChange
}: EmployeeWeeklyScheduleEditorProps, ref) {
  const dialog = useAppDialog();
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("recurring");
  const isDraftMode = draftMode && !employeeId;
  const lastReportedRangeRef = useRef<string>("");

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

  useEffect(() => {
    if (isDraftMode || !employeeId || !onSharedRangeChange) {
      return;
    }

    const recurringShifts = shifts.filter((shift) => shift.isRecurring !== false && shift.dayOfWeek !== null);
    const firstRange = recurringShifts.find((shift) => shift.startDate || shift.endDate);
    const nextRange = {
      startDate: firstRange?.startDate || null,
      endDate: firstRange?.endDate || null
    };
    const signature = `${nextRange.startDate || ""}|${nextRange.endDate || ""}`;

    if (signature !== lastReportedRangeRef.current) {
      lastReportedRangeRef.current = signature;
      onSharedRangeChange(nextRange);
    }
  }, [employeeId, isDraftMode, onSharedRangeChange, shifts]);

  useEffect(() => {
    if (isDraftMode || !employeeId) {
      return;
    }

    const targetStart = sharedStartDate || null;
    const targetEnd = sharedEndDate || null;

    if (!targetStart && !targetEnd) {
      return;
    }

    const recurringShifts = shifts.filter((shift) => shift.isRecurring !== false && shift.dayOfWeek !== null);
    const needsSync = recurringShifts.some((shift) => (shift.startDate || null) !== targetStart || (shift.endDate || null) !== targetEnd);
    if (!needsSync) {
      return;
    }

    const syncRange = async () => {
      setSavingKey("schedule-range");
      try {
        const nextShifts = shifts.map((shift) =>
          shift.isRecurring !== false && shift.dayOfWeek !== null
            ? { ...shift, startDate: targetStart, endDate: targetEnd }
            : shift
        );
        setShiftsAndMirror(nextShifts);

        await Promise.allSettled(
          recurringShifts.map((shift) =>
            tenantApi.updateEmployeeShift(employeeId, shift.id, {
              ...buildShiftPayload({ ...shift, startDate: targetStart, endDate: targetEnd }, targetStart, targetEnd),
              isActive: shift.isActive
            })
          )
        );
      } catch (err) {
        console.warn("Failed to sync shared schedule range:", err);
      } finally {
        setSavingKey(null);
      }
    };

    void syncRange();
  }, [employeeId, isDraftMode, sharedEndDate, sharedStartDate, shifts]);

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
      const response = await tenantApi.updateEmployeeShift(
        employeeId,
        shiftId,
        buildShiftPayload(currentShift, sharedStartDate, sharedEndDate)
      );
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
    const isRecurringSchedule = scheduleMode === "recurring";
    const specificDate = !isRecurringSchedule ? (sharedStartDate || new Date().toISOString().slice(0, 10)) : null;

    if (isDraftMode) {
      const tempShift = normalizeShift({
        id: `temp-${dayOfWeek}-${Date.now()}`,
        dayOfWeek: isRecurringSchedule ? dayOfWeek : null,
        specificDate,
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        isRecurring: isRecurringSchedule,
        isActive: true
      });

      setShiftsAndMirror((current) => [...current, tempShift]);
      return;
    }

    if (!employeeId) return;

    const tempId = `temp-${dayOfWeek}-${Date.now()}`;
    const tempShift = normalizeShift({
      id: tempId,
      dayOfWeek: isRecurringSchedule ? dayOfWeek : null,
      specificDate,
      startTime: DEFAULT_START,
      endTime: DEFAULT_END,
      isRecurring: isRecurringSchedule,
      isActive: true
    });

    setSavingKey(tempId);
    try {
      const response = await tenantApi.createEmployeeShift(employeeId, {
        dayOfWeek: isRecurringSchedule ? dayOfWeek : null,
        specificDate,
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        isRecurring: isRecurringSchedule,
        startDate: isRecurringSchedule ? (sharedStartDate || null) : null,
        endDate: isRecurringSchedule ? (sharedEndDate || null) : null,
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
        current
          .filter((shift) => !(shift.dayOfWeek === dayOfWeek && shift.isDraft))
          .map((shift) => (shift.dayOfWeek === dayOfWeek ? { ...shift, isActive: false } : shift))
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
                ...buildShiftPayload(shift, sharedStartDate, sharedEndDate),
                isActive: false
              })
          )
        );
        setShiftsAndMirror((current) =>
          current
            .filter((shift) => !(shift.dayOfWeek === dayOfWeek && shift.isDraft))
            .map((shift) => (shift.dayOfWeek === dayOfWeek ? { ...shift, isActive: false } : shift))
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
              ...buildShiftPayload(shift, sharedStartDate, sharedEndDate),
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

  const createDraftSubShift = (dayOfWeek: number) => {
    const isRecurringSchedule = scheduleMode === "recurring";
    const specificDate = !isRecurringSchedule ? (sharedStartDate || new Date().toISOString().slice(0, 10)) : null;
    const draftShift = normalizeShift({
      id: `draft-${dayOfWeek}-${Date.now()}`,
      dayOfWeek: isRecurringSchedule ? dayOfWeek : null,
      specificDate,
      startTime: DEFAULT_START,
      endTime: DEFAULT_END,
      isRecurring: isRecurringSchedule,
      isActive: true,
      isDraft: true
    });

    setShiftsAndMirror((current) => [...current, draftShift]);
  };

  const saveShiftRow = async (shift: ShiftRecord) => {
    const isRecurringShift = shift.isRecurring !== false;
    const specificDate = !isRecurringShift
      ? (shift.specificDate || sharedStartDate || new Date().toISOString().slice(0, 10))
      : null;

    if (shift.isDraft) {
      if (isRecurringShift && !shift.dayOfWeek && shift.dayOfWeek !== 0) {
        return;
      }

      if (isDraftMode) {
        setShiftsAndMirror((current) =>
          current.map((item) => (item.id === shift.id ? { ...item, isDraft: false } : item))
        );
        return;
      }

      if (!employeeId) return;

      setSavingKey(shift.id);
      try {
        const response = await tenantApi.createEmployeeShift(employeeId, {
          dayOfWeek: isRecurringShift ? shift.dayOfWeek : null,
          specificDate,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isRecurring: isRecurringShift,
          startDate: isRecurringShift ? (sharedStartDate || null) : null,
          endDate: isRecurringShift ? (sharedEndDate || null) : null,
          label: shift.label?.trim() || undefined
        });

        const createdShift = normalizeShift(response?.shift || response?.data?.shift || { ...shift, isDraft: false });
        setShiftsAndMirror((current) =>
          current.map((item) => (item.id === shift.id ? { ...createdShift, isDraft: false } : item))
        );
      } catch (err: any) {
        console.error("Failed to save draft shift:", err);
        await dialog.alert({
          title: locale === "ar" ? "تعذر حفظ الوردية" : "Failed to save shift",
          message: err?.message || (locale === "ar" ? "تعذر حفظ الوردية الجديدة." : "We could not save the new shift."),
          tone: "danger"
        });
      } finally {
        setSavingKey(null);
      }
      return;
    }

    await persistShift(shift.id);
  };

  useImperativeHandle(ref, () => ({
    flushDraftShifts: async () => {
      if (isDraftMode || !employeeId) {
        return true;
      }

      setSavingKey("flush-drafts");
      try {
        const draftShifts = shifts.filter((shift) => shift.isDraft);
        const persistedShifts = shifts.filter((shift) => !shift.isDraft);

        const createdDraftResults = await Promise.all(
          draftShifts.map(async (shift) => {
            const isRecurringShift = shift.isRecurring !== false;
            const specificDate = !isRecurringShift
              ? (shift.specificDate || sharedStartDate || new Date().toISOString().slice(0, 10))
              : null;

            const response = await tenantApi.createEmployeeShift(employeeId, {
              dayOfWeek: isRecurringShift ? shift.dayOfWeek : null,
              specificDate,
              startTime: shift.startTime,
              endTime: shift.endTime,
              isRecurring: isRecurringShift,
              startDate: isRecurringShift ? (sharedStartDate || null) : null,
              endDate: isRecurringShift ? (sharedEndDate || null) : null,
              label: shift.label?.trim() || undefined
            });

            const createdShift = normalizeShift(response?.shift || response?.data?.shift || { ...shift, isDraft: false });
            return { oldId: shift.id, createdShift };
          })
        );

        // Persist all current non-draft shifts too, so parent "Save Team Member"
        // captures time changes even when a field was changed but never blurred.
        await Promise.all(
          persistedShifts.map(async (shift) => {
            await tenantApi.updateEmployeeShift(
              employeeId,
              shift.id,
              buildShiftPayload(shift, sharedStartDate, sharedEndDate)
            );
          })
        );

        setShiftsAndMirror((current) =>
          current.map((item) => {
            const match = createdDraftResults.find((result) => result.oldId === item.id);
            return match ? { ...match.createdShift, isDraft: false } : item;
          })
        );

        return true;
      } catch (err: any) {
        console.error("Failed to flush draft shifts:", err);
        await dialog.alert({
          title: locale === "ar" ? "تعذر حفظ الورديات" : "Failed to save shifts",
          message: err?.message || (locale === "ar" ? "تعذر حفظ بعض الورديات الجديدة." : "Some new shifts could not be saved."),
          tone: "danger"
        });
        return false;
      } finally {
        setSavingKey(null);
      }
    }
  }), [dialog, employeeId, isDraftMode, locale, sharedEndDate, sharedStartDate, shifts]);

  const oneTimeShiftCount = shifts.filter((shift) => shift.isRecurring === false || shift.specificDate).length;

  useEffect(() => {
    onSummaryChange?.({
      activeDays,
      recurringShifts: totalRecurringShifts,
      oneTimeShifts: oneTimeShiftCount
    });
  }, [activeDays, oneTimeShiftCount, onSummaryChange, totalRecurringShifts]);

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
            <label className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {locale === "ar" ? "نوع الجدول" : "Schedule type"}
              </span>
              <select
                value={scheduleMode}
                onChange={(event) => setScheduleMode(event.target.value as ScheduleMode)}
                className="mt-1 w-full bg-transparent text-sm font-medium text-gray-900 outline-none"
              >
                <option value="recurring">{locale === "ar" ? "دوري (أسبوعي)" : "Recurring (Weekly)"}</option>
                <option value="one-time">{locale === "ar" ? "لمرة واحدة" : "One-time"}</option>
              </select>
            </label>
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
        <div className="grid grid-cols-[1.3fr,1fr,1fr,0.9fr,0.9fr] gap-0 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          <div>{locale === "ar" ? "اليوم" : "Day"}</div>
          <div className="text-center">{locale === "ar" ? "من" : "From"}</div>
          <div className="text-center">{locale === "ar" ? "إلى" : "To"}</div>
          <div className="text-center">{locale === "ar" ? "إضافة فرعية" : "Add sub"}</div>
          <div className={isRTL ? "text-left" : "text-right"}>{locale === "ar" ? "إجراءات" : "Actions"}</div>
        </div>

        <div className="divide-y divide-gray-100">
          {WEEK_DAYS.map((day) => {
            const dayShifts = groupedShifts.get(day.value) || [];
            const visibleShifts = dayShifts.filter((shift) => shift.isDraft || shift.isActive !== false);
            const activeShifts = visibleShifts.filter((shift) => !shift.isDraft);
            const mainShift = activeShifts[0] || visibleShifts[0] || null;
            const nestedShifts = mainShift ? visibleShifts.filter((shift) => shift.id !== mainShift.id) : [];
            const enabled = visibleShifts.length > 0;
            const hasVisibleRows = enabled;

            return (
              <div key={day.value} className="p-4 lg:p-5">
                <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr,1fr,0.9fr,0.9fr]">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(event) => void handleToggleDay(day.value, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      disabled={Boolean(savingKey)}
                    />
                    <div>
                      <div className="font-semibold text-gray-900">
                        {locale === "ar" ? day.labelAr : day.labelEn}
                      </div>
                      <div className="text-xs text-gray-500">
                        {hasVisibleRows
                          ? (locale === "ar" ? `${dayShifts.length} وردية` : `${dayShifts.length} shift${dayShifts.length === 1 ? "" : "s"}`)
                          : (locale === "ar" ? "غير عامل" : "Not working")}
                      </div>
                    </div>
                  </div>

                  <div>
                    {hasVisibleRows && mainShift ? (
                      <select
                        value={mainShift.startTime}
                        onChange={(event) => updateLocalShift(mainShift.id, (current) => ({ ...current, startTime: event.target.value }))}
                        onBlur={() => void saveShiftRow(mainShift)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                        disabled={Boolean(savingKey)}
                      >
                        {TIME_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
                        {locale === "ar" ? "غير عامل" : "Not working"}
                      </div>
                    )}
                  </div>

                  <div>
                    {hasVisibleRows && mainShift ? (
                      <select
                        value={mainShift.endTime}
                        onChange={(event) => updateLocalShift(mainShift.id, (current) => ({ ...current, endTime: event.target.value }))}
                        onBlur={() => void saveShiftRow(mainShift)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                        disabled={Boolean(savingKey)}
                      >
                        {TIME_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
                        {locale === "ar" ? "غير عامل" : "Not working"}
                      </div>
                    )}
                  </div>

                  <div className={`flex items-start ${isRTL ? 'justify-start' : 'justify-center'}`}>
                    <button
                      type="button"
                      onClick={() => createDraftSubShift(day.value)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:border-primary hover:text-primary"
                      disabled={Boolean(savingKey) || !hasVisibleRows}
                      aria-label={locale === "ar" ? "إضافة وردية فرعية" : "Add sub shift"}
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className={`flex items-start ${isRTL ? 'justify-start' : 'justify-end'}`}>
                    {hasVisibleRows && mainShift ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteShift(mainShift.id)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                        disabled={Boolean(savingKey)}
                        aria-label={locale === "ar" ? "حذف الوردية" : "Delete shift"}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {nestedShifts.length > 0 ? (
                  <div className="mt-4 space-y-3 border-t border-dashed border-gray-200 pt-4">
                    {nestedShifts.map((shift) => (
                      <div key={shift.id} className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 lg:grid-cols-[1.1fr,1fr,1fr,0.8fr,0.8fr]">
                        <div className="flex items-center gap-3">
                          <div className="h-px w-10 bg-gray-300" />
                        <input
                          type="text"
                          value={shift.label || ""}
                          onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, label: event.target.value }))}
                          onBlur={() => !shift.isDraft && void saveShiftRow(shift)}
                          placeholder={locale === "ar" ? "عنوان الوردية" : "Shift title"}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                          disabled={Boolean(savingKey)}
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                        </div>

                        <select
                          value={shift.startTime}
                          onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, startTime: event.target.value }))}
                          onBlur={() => !shift.isDraft && void saveShiftRow(shift)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                          disabled={Boolean(savingKey)}
                        >
                          {TIME_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>

                        <select
                          value={shift.endTime}
                          onChange={(event) => updateLocalShift(shift.id, (current) => ({ ...current, endTime: event.target.value }))}
                          onBlur={() => !shift.isDraft && void saveShiftRow(shift)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                          disabled={Boolean(savingKey)}
                        >
                          {TIME_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>

                        <div className="flex items-center justify-center">
                          {shift.isDraft ? (
                            <button
                              type="button"
                              onClick={() => void saveShiftRow(shift)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                              disabled={Boolean(savingKey)}
                              aria-label={locale === "ar" ? "حفظ الوردية الفرعية" : "Save sub shift"}
                            >
                              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
                              </svg>
                            </button>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {locale === "ar" ? "محفوظ" : "Saved"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => void handleDeleteShift(shift.id)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                            disabled={Boolean(savingKey)}
                            aria-label={locale === "ar" ? "حذف الوردية الفرعية" : "Delete sub shift"}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
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
});
