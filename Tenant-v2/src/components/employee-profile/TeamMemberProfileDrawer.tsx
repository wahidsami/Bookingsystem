import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, User } from 'lucide-react';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import EmployeeProfileEditor from './EmployeeProfileEditor';
import { TeamMemberData, StaffAppPermissionKey, DEFAULT_STAFF_APP_PERMISSIONS } from '../../types/employee';
import { mapApiEmployeeToTeamMember, fetchEmployeeSchedule } from '../../lib/employeeHelpers';

interface TeamMemberProfileDrawerProps {
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

  useEffect(() => {
    let mounted = true;
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
        
        if (!found) {
          onToast?.(
            isRtl ? 'الموظف غير موجود' : 'Employee not found',
            isRtl ? 'لم يتم العثور على بيانات الموظف' : 'Could not find employee details',
            'error'
          );
          onClose();
          return;
        }

        // Fetch schedule and permissions
        const [scheduleRes, permRes] = await Promise.all([
          fetchEmployeeSchedule(staffId, found),
          tenantApiAdapter.getEmployeePermissions(staffId).catch(() => null)
        ]);

        if (!mounted) return;

        const mapped = mapApiEmployeeToTeamMember(found, scheduleRes.schedule);
        setEmployeeData(mapped);

        if (permRes?.permissions) {
          setPermissions((prev) => ({ ...prev, ...permRes.permissions }));
        }
      } catch (err) {
        console.error(err);
        onToast?.(
          isRtl ? 'خطأ' : 'Error',
          isRtl ? 'فشل تحميل بيانات الموظف' : 'Failed to load employee details',
          'error'
        );
        onClose();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchEmployee();
    return () => { mounted = false; };
  }, [staffId, isRtl, onClose]);

  const handleSave = async (data: TeamMemberData, file?: File | null, appPermissions?: Record<StaffAppPermissionKey, boolean>) => {
    try {
      const payload: Record<string, any> = {
        name: data.nameEn, // assuming nameEn is primary
        email: data.email,
        phone: data.phone,
        position: data.position,
        isActive: data.status === 'active',
        bio: data.bioEn,
        gender: data.gender,
        nationality: data.nationalityEn,
        salary: data.baseSalary,
        commissionRate: data.commissionRatePct,
        serviceCommissionEnabled: data.serviceCommissionEnabled,
        productCommissionEnabled: data.productCommissionEnabled,
        scheduleVisibilityWeeks: data.scheduleVisibilityWeeks,
        skills: data.specialtiesEn,
        spokenLanguages: data.languagesEn
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

      if (appPermissions) {
        await tenantApiAdapter.updateEmployeePermissions(staffId, appPermissions).catch(e => console.warn('Failed to update permissions', e));
      }

      onToast?.(
        isRtl ? 'تم الحفظ' : 'Saved',
        isRtl ? 'تم تحديث بيانات الموظف بنجاح' : 'Employee details updated successfully'
      );
      
      if (onRefreshBoard) {
        onRefreshBoard();
      }
      
      // Close after saving
      onClose();
    } catch (err) {
      console.error(err);
      onToast?.(
        isRtl ? 'خطأ' : 'Error',
        isRtl ? 'فشل حفظ بيانات الموظف' : 'Failed to save employee details',
        'error'
      );
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
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 bg-white sticky top-0 z-[100]">
          <h2 className="text-lg md:text-xl font-bold text-slate-800">
            {isRtl ? 'ملف الموظف' : 'Team Member Profile'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <Loader2 className="animate-spin" size={40} />
              <p>{isRtl ? 'جاري التحميل...' : 'Loading...'}</p>
            </div>
          ) : employeeData ? (
            <EmployeeProfileEditor
              initialData={employeeData}
              isRtl={isRtl}
              formMode="edit"
              onSave={handleSave}
              onCancel={onClose}
              initialStaffAppPermissions={permissions}
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
