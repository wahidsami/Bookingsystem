import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, User } from 'lucide-react';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import EmployeeProfileEditor from './EmployeeProfileEditor';
import { TeamMemberData, StaffAppPermissionKey, DEFAULT_STAFF_APP_PERMISSIONS } from '../../types/employee';
import { 
  mapApiEmployeeToTeamMember, 
  fetchEmployeeSchedule, 
  validateWeeklySchedule, 
  isScheduleEqual, 
  persistEmployeeSchedule 
} from '../../lib/employeeHelpers';

interface TeamMemberProfileDrawerProps {
  key?: React.Key;
  staffId: string;
  onClose: () => void;
  isRtl: boolean;
  onRefreshBoard?: () => void;
  onToast?: (en: string, ar: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function TeamMemberProfileDrawer({ staffId, onClose, isRtl, onRefreshBoard, onToast }: TeamMemberProfileDrawerProps) {
  const [employeeData, setEmployeeData] = useState<TeamMemberData | null>(null);
  const [permissions, setPermissions] = useState<Record<StaffAppPermissionKey, boolean>>(DEFAULT_STAFF_APP_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [internalToast, setInternalToast] = useState<{ en: string; ar: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const requestIdRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  const notify = (en: string, ar: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    if (onToastRef.current) {
      onToastRef.current(en, ar, type);
    }
    setInternalToast({ en, ar, type });
  };

  useEffect(() => {
    let mounted = true;
    const currentRequestId = ++requestIdRef.current;

    const fetchEmployee = async () => {
      try {
        setIsLoading(true);
        // We fetch all employees to find the specific one, because the API doesn't have getEmployee(id)
        const response = await tenantApiAdapter.getEmployees();
        const employeesList = Array.isArray(response?.employees)
          ? response.employees
          : Array.isArray(response?.data?.employees)
            ? response.data.employees
            : [];
            
        const found = employeesList.find((e: any) => e.id === staffId);
        
        if (!mounted || currentRequestId !== requestIdRef.current) return;

        if (!found) {
          notify(
            'Employee not found',
            'لم يتم العثور على بيانات الموظف',
            'error'
          );
          onCloseRef.current();
          return;
        }

        // Fetch schedule and permissions
        const [scheduleRes, permRes] = await Promise.all([
          fetchEmployeeSchedule(staffId, found),
          tenantApiAdapter.getEmployeePermissions(staffId).catch(() => null)
        ]);

        if (!mounted || currentRequestId !== requestIdRef.current) return;

        const mapped = mapApiEmployeeToTeamMember(found, scheduleRes.schedule, scheduleRes.scheduleMeta);
        setEmployeeData(mapped);

        if (permRes?.permissions) {
          setPermissions((prev) => ({ ...prev, ...permRes.permissions }));
        }
      } catch (err) {
        if (!mounted || currentRequestId !== requestIdRef.current) return;
        console.error(err);
        notify(
          'Failed to load employee details',
          'فشل تحميل بيانات الموظف',
          'error'
        );
        onCloseRef.current();
      } finally {
        if (mounted && currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchEmployee();
    return () => {
      mounted = false;
    };
  }, [staffId]);

  const handleSave = async (data: TeamMemberData, file?: File | null, appPermissions?: Record<StaffAppPermissionKey, boolean>) => {
    // 1. Validate employee identity requirements
    const primaryName = isRtl
      ? data.nameAr?.trim() || data.nameEn?.trim()
      : data.nameEn?.trim() || data.nameAr?.trim();

    if (!primaryName) {
      notify(
        'Full Name is required',
        'الاسم بالكامل مطلوب',
        'error'
      );
      return;
    }

    if (!data.phone?.trim()) {
      notify(
        'Phone number is required',
        'رقم الهاتف مطلوب',
        'error'
      );
      return;
    }

    // 2. Detect schedule changes and validate before any network operations
    const scheduleChanged =
      !employeeData ||
      !isScheduleEqual(employeeData.schedule, data.schedule) ||
      employeeData.scheduleStartDate !== data.scheduleStartDate ||
      employeeData.scheduleEndDate !== data.scheduleEndDate ||
      Boolean(employeeData.scheduleContinues) !== Boolean(data.scheduleContinues);

    if (scheduleChanged) {
      const scheduleValidation = validateWeeklySchedule(data.schedule);
      if (!scheduleValidation.isValid) {
        notify(
          scheduleValidation.errorEn || 'Invalid working schedule',
          scheduleValidation.errorAr || 'تأكد من صحة أوقات الشيفتات المحددة',
          'error'
        );
        return;
      }
    }

    setIsSaving(true);

    try {
      // 3. Prepare serialized demographic and configuration payload
      const primaryBio = isRtl
        ? data.bioAr?.trim() || data.bioEn?.trim()
        : data.bioEn?.trim() || data.bioAr?.trim();

      const primaryExperience = isRtl
        ? data.experienceAr?.trim() || data.experienceEn?.trim()
        : data.experienceEn?.trim() || data.experienceAr?.trim();

      const primaryNationality = isRtl
        ? data.nationalityAr?.trim() || data.nationalityEn?.trim()
        : data.nationalityEn?.trim() || data.nationalityAr?.trim();

      const payload: Record<string, any> = {
        name: primaryName,
        email: data.email?.trim() || '',
        phone: data.phone?.trim() || '',
        position: data.position,
        isActive: data.status === 'active',
        bio: primaryBio || '',
        experience: primaryExperience || '',
        gender: data.gender || 'female',
        nationality: primaryNationality || '',
        salary: data.baseSalary || 0,
        commissionRate: data.commissionRatePct || 0,
        serviceCommissionEnabled: Boolean(data.serviceCommissionEnabled),
        productCommissionEnabled: Boolean(data.productCommissionEnabled),
        scheduleVisibilityWeeks: data.scheduleVisibilityWeeks || 1,
        skills: data.specialtiesEn || [],
        spokenLanguages: data.languagesEn || [],
        roleAr: data.roleAr || '',
        roleEn: data.roleEn || '',
        joinedDate: data.joinedDate || ''
      };

      if (file) {
        const formData = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (Array.isArray(v)) {
            v.forEach(val => formData.append(`${k}[]`, val));
          } else {
            formData.append(k, String(v));
          }
        });
        formData.append('profileImage', file);
        await tenantApiAdapter.updateEmployee(staffId, formData);
      } else {
        await tenantApiAdapter.updateEmployee(staffId, payload);
      }

      // 4. Persist schedule if changed
      let scheduleSaveError = false;
      if (scheduleChanged) {
        try {
          await persistEmployeeSchedule(
            staffId,
            data.schedule,
            data.scheduleStartDate || data.joinedDate || new Date().toISOString().split('T')[0],
            data.scheduleEndDate || '',
            Boolean(data.scheduleContinues)
          );
        } catch (sErr) {
          console.error('Failed to persist employee schedule in drawer:', sErr);
          scheduleSaveError = true;
        }
      }

      // 5. Update permissions if provided
      if (appPermissions) {
        await tenantApiAdapter.updateEmployeePermissions(staffId, appPermissions).catch(e => console.warn('Failed to update permissions', e));
      }

      // 6. Handle partial failure vs complete success
      if (scheduleSaveError) {
        notify(
          'Employee profile updated, but weekly schedule could not be saved',
          'تم تحديث الملف المهني ولكن تعذر حفظ جدول العمل والشيفتات',
          'warning'
        );
        if (onRefreshBoard) {
          onRefreshBoard();
        }
        return;
      }

      notify(
        'Employee details and schedule updated successfully',
        'تم تحديث بيانات الموظف وجدول العمل بنجاح',
        'success'
      );
      
      if (onRefreshBoard) {
        onRefreshBoard();
      }
      
      // Close after saving
      onClose();
    } catch (err) {
      console.error('Failed to save employee profile in drawer:', err);
      notify(
        'Failed to save employee details',
        'فشل حفظ بيانات الموظف',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80]"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: isRtl ? '-100%' : '100%' }}
        animate={{ x: 0 }}
        exit={{ x: isRtl ? '-100%' : '100%' }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed top-0 bottom-0 ${isRtl ? 'left-0' : 'right-0'} w-full md:w-[85vw] max-w-[1200px] bg-white shadow-2xl z-[90] flex flex-col border-l border-slate-200`}
      >
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-neutral-200/80 bg-white sticky top-0 z-[100]">
          <div className="flex items-center gap-3 min-w-0">
            {employeeData?.avatar && (
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 shrink-0 shadow-xs">
                <img src={employeeData.avatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-black text-neutral-900 truncate">
                  {employeeData 
                    ? (isRtl ? employeeData.nameAr || employeeData.nameEn : employeeData.nameEn || employeeData.nameAr) 
                    : (isRtl ? 'ملف الموظف' : 'Team Member Profile')}
                </h2>
                {employeeData && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-[#1D035F] border border-purple-200/80">
                    {isRtl ? employeeData.roleAr : employeeData.roleEn}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 font-medium">
                {isRtl ? 'إدارة وتحديث بيانات ملف الموظف والشيفتات' : 'Manage employee profile, schedule, and permissions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-500 hover:text-neutral-900 cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        {internalToast && (
          <div
            className={`p-3 mx-4 md:mx-6 mt-3 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in ${
              internalToast.type === 'error'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : internalToast.type === 'warning'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            <span>{isRtl ? internalToast.ar : internalToast.en}</span>
            <button type="button" onClick={() => setInternalToast(null)} className="text-neutral-400 hover:text-neutral-700">
              <X size={14} />
            </button>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto bg-neutral-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 py-20">
              <Loader2 className="animate-spin text-[#6537C0]" size={36} />
              <p className="text-xs font-bold text-neutral-500">{isRtl ? 'جاري التحميل...' : 'Loading...'}</p>
            </div>
          ) : employeeData ? (
            <EmployeeProfileEditor
              initialData={employeeData}
              isRtl={isRtl}
              formMode="edit"
              onSave={handleSave}
              onCancel={onClose}
              initialStaffAppPermissions={permissions}
              isDrawerContext={true}
            />
          ) : (
            <div className="text-center text-slate-500 py-10">
              <User size={48} className="mx-auto mb-4 text-slate-300" />
              <p>{isRtl ? 'لم يتم العثور على الموظف' : 'Employee not found.'}</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
