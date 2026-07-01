"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getImageUrl } from "@/lib/api";
import {
  buildServiceEmployeeAssignments,
  createDefaultServiceEmployeeAssignment,
  getSelectedServiceEmployeeIds,
  isServiceProviderEmployee,
  type ServiceEmployeeAssignment,
  type ServiceAssignmentEmployee
} from "@/components/serviceEmployeeAssignments";
import {
  CheckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

interface ServiceTeamSectionProps {
  locale: string;
  isRTL: boolean;
  employees: (ServiceAssignmentEmployee & {
    name: string;
    photo?: string | null;
    isActive?: boolean;
  })[];
  assignments: ServiceEmployeeAssignment[];
  onAssignmentsChange: (assignments: ServiceEmployeeAssignment[]) => void;
}

export function ServiceTeamSection({
  locale,
  isRTL,
  employees,
  assignments,
  onAssignmentsChange
}: ServiceTeamSectionProps) {
  const serviceProviders = useMemo(
    () => employees.filter((employee) => isServiceProviderEmployee(employee)),
    [employees]
  );

  const selectedCount = useMemo(
    () => getSelectedServiceEmployeeIds(assignments).length,
    [assignments]
  );

  const normalizedAssignments = useMemo(
    () => buildServiceEmployeeAssignments(serviceProviders, assignments),
    [assignments, serviceProviders]
  );

  const updateAssignment = (employeeId: string, patch: Partial<ServiceEmployeeAssignment>) => {
    const current = normalizedAssignments.find((assignment) => assignment.employeeId === employeeId) ?? createDefaultServiceEmployeeAssignment(employeeId);
    const nextAssignments = normalizedAssignments.map((assignment) =>
      assignment.employeeId === employeeId
        ? {
            ...current,
            ...assignment,
            ...patch,
            employeeId,
            isPrimary: assignment.isPrimary ?? current.isPrimary
          }
        : assignment
    );

    onAssignmentsChange(nextAssignments);
  };

  const toggleEmployee = (employeeId: string) => {
    const current = normalizedAssignments.find((assignment) => assignment.employeeId === employeeId) ?? createDefaultServiceEmployeeAssignment(employeeId);
    updateAssignment(employeeId, { isAssigned: !current.isAssigned });
  };

  if (serviceProviders.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-300 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur" id="service-team">
        <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
          <div className="rounded-full bg-cyan-400/10 p-3 text-cyan-200">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white">
              {locale === 'ar' ? 'الفريق' : 'Team'}
            </h4>
            <p className="mt-1 text-slate-300">
              {locale === 'ar'
                ? 'لا يوجد موظفون بخاصية مزود خدمة حتى الآن. أضف أعضاء فريق من صفحة الفرق أولاً.'
                : 'No service providers found yet. Add team members first, then assign them here.'}
            </p>
            <Link href={`/${locale}/dashboard/employees/new`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400">
              {locale === 'ar' ? 'إضافة عضو فريق' : 'Add team member'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur" id="service-team">
      <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
        <div>
          <h4 className="text-lg font-semibold text-white">
            {locale === 'ar' ? 'الفريق' : 'Team'}
          </h4>
          <p className="text-sm text-slate-300">
            {locale === 'ar'
              ? 'اختر مزودي الخدمة وحدد عمولاتهم إن وُجدت.'
              : 'Select service providers and configure commissions where needed.'}
          </p>
        </div>

        <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
          {selectedCount} {locale === 'ar' ? 'محدد' : 'selected'}
        </div>
      </div>

      <div className="hidden rounded-2xl bg-slate-950/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 md:grid md:grid-cols-[auto,minmax(0,1fr),180px,140px]">
        <span>{locale === 'ar' ? 'اختيار' : 'Select'}</span>
        <span>{locale === 'ar' ? 'عضو الفريق' : 'Team member'}</span>
        <span>{locale === 'ar' ? 'العمولة' : 'Commission'}</span>
        <span>{locale === 'ar' ? 'القيمة' : 'Value'}</span>
      </div>

      <div className="space-y-3">
        {normalizedAssignments.map((assignment) => {
          const employee = serviceProviders.find((item) => item.id === assignment.employeeId);
          if (!employee) {
            return null;
          }

          const initials = employee.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("");

          return (
            <div
              key={employee.id}
              className={`rounded-2xl border p-4 transition ${
                assignment.isAssigned ? 'border-cyan-300/30 bg-cyan-400/10' : 'border-white/10 bg-slate-950/40'
              }`}
            >
              <div className={`grid gap-3 md:grid-cols-[auto,minmax(0,1fr),180px,140px] md:items-center ${isRTL ? 'md:text-right' : 'md:text-left'}`}>
                <label className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                  <input
                    type="checkbox"
                    checked={assignment.isAssigned}
                    onChange={() => toggleEmployee(employee.id)}
                    className="h-4 w-4 rounded border-white/20 text-cyan-400 focus:ring-cyan-400"
                  />

                  <div className="flex items-center gap-3">
                    {employee.photo ? (
                      <img
                        src={getImageUrl(employee.photo)}
                        alt={employee.name}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-semibold text-cyan-200">
                        {initials || <CheckIcon className="h-4 w-4" />}
                      </div>
                    )}

                <div>
                  <p className="font-semibold text-white">{employee.name}</p>
                  <p className="text-xs text-slate-400">
                        {employee.isActive === false
                          ? (locale === 'ar' ? 'غير نشط' : 'Inactive')
                          : (locale === 'ar' ? 'مزود خدمة' : 'Service provider')}
                  </p>
                </div>
              </div>
                </label>

                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse md:justify-end' : 'flex-row'}`}>
                  <label className={`flex items-center gap-2 text-sm font-medium text-slate-200 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <input
                      type="checkbox"
                      checked={assignment.isAssigned && assignment.hasCommission}
                      onChange={(event) => updateAssignment(employee.id, { hasCommission: event.target.checked })}
                      className="h-4 w-4 rounded border-white/20 text-cyan-400 focus:ring-cyan-400"
                    />
                    <span>{locale === 'ar' ? 'له عمولة' : 'Has commission'}</span>
                  </label>
                </div>

                <div className="grid gap-3 md:col-span-2 md:grid-cols-[180px,minmax(0,1fr)]">
                  <select
                    value={assignment.commissionType}
                    onChange={(event) => updateAssignment(employee.id, { commissionType: event.target.value as "fixed" | "percentage" })}
                    disabled={!assignment.isAssigned || !assignment.hasCommission}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:bg-slate-800/60"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="fixed">{locale === 'ar' ? 'ثابت' : 'Fixed'}</option>
                    <option value="percentage">{locale === 'ar' ? 'نسبة مئوية' : 'Percentage'}</option>
                  </select>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={assignment.commissionValue}
                      onChange={(event) => updateAssignment(employee.id, { commissionValue: event.target.value })}
                      disabled={!assignment.isAssigned || !assignment.hasCommission}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:bg-slate-800/60"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                    <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 ${isRTL ? 'left-4' : 'right-4'}`}>
                      {assignment.commissionType === 'fixed' ? 'SAR' : '%'}
                    </span>
                  </div>
                </div>
              </div>

              {assignment.isAssigned && assignment.hasCommission ? (
                <p className={`mt-3 text-xs text-slate-400 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {locale === 'ar'
                    ? 'سيتم تطبيق هذه العمولة على السعر النهائي للخدمة.'
                    : 'This commission will be deducted from the service final price.'}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
