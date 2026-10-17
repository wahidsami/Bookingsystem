import React, { useState } from 'react';
import { ArrowLeft, Sparkles, User, DollarSign, Calendar, Shield, Check } from 'lucide-react';
import { TeamMemberData, StaffAppPermissionKey, DEFAULT_STAFF_APP_PERMISSIONS } from '../../types/employee';
import BasicIdentitySection from './BasicIdentitySection';
import BioSpecialtiesSection from './BioSpecialtiesSection';
import FinanceRulesSection from './FinanceRulesSection';
import ShiftMatrixSection from './ShiftMatrixSection';
import AccessSecuritySection from './AccessSecuritySection';

interface EmployeeProfileEditorProps {
  initialData: TeamMemberData;
  isRtl: boolean;
  onSave: (data: TeamMemberData, photo: File | null, staffAppPermissions: Record<StaffAppPermissionKey, boolean>) => void;
  onCancel: () => void;
  formMode?: 'add' | 'edit';
  initialStaffAppPermissions?: Record<StaffAppPermissionKey, boolean>;
  onAIAssist?: () => void;
  isDrawerContext?: boolean;
}

export default function EmployeeProfileEditor({
  initialData,
  isRtl,
  onSave,
  onCancel,
  formMode = 'add',
  initialStaffAppPermissions = DEFAULT_STAFF_APP_PERMISSIONS,
  onAIAssist,
  isDrawerContext = false
}: EmployeeProfileEditorProps) {
  const [formData, setFormData] = useState<TeamMemberData>(initialData);
  const [staffAppPermissions, setStaffAppPermissions] = useState<Record<StaffAppPermissionKey, boolean>>(initialStaffAppPermissions);
  const [employeePhotoFile, setEmployeePhotoFile] = useState<File | null>(null);
  
  // Guided form editor active section
  const [activeFormSection, setActiveFormSection] = useState<'basic' | 'bio' | 'finance' | 'schedule' | 'access'>('basic');
  const steps: Array<'basic' | 'bio' | 'finance' | 'schedule' | 'access'> = ['basic', 'bio', 'finance', 'schedule', 'access'];
  const activeStepIndex = steps.indexOf(activeFormSection);
  const canGoBack = activeStepIndex > 0;
  const canGoNext = activeStepIndex >= 0 && activeStepIndex < steps.length - 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, employeePhotoFile, staffAppPermissions);
  };

  const handlePersist = () => {
    onSave(formData, employeePhotoFile, staffAppPermissions);
  };

  return (
    <div className={`bg-white overflow-hidden animate-fade-in ${
      isDrawerContext ? 'border-none shadow-none rounded-none' : 'rounded-3xl border border-neutral-200/80 shadow-md'
    }`} id="roster-guided-form-editor">
      
      {/* Header Panel — Shown only in standalone page context, hidden in drawer to prevent duplicate headers */}
      {!isDrawerContext && (
        <div className="bg-gradient-to-r from-[#1D035F] to-[#6537C0] text-white p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer border border-white/15"
            >
              <ArrowLeft size={16} className={isRtl ? 'transform rotate-180' : ''} />
            </button>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#E7DDFC] font-black block">
                {isRtl ? 'بوابة تعيين وتهيئة الكادر' : 'BARSPA TEAM ROSTER CREATOR'}
              </span>
              <h2 className="text-base font-black">
                {formMode === 'add' 
                  ? (isRtl ? 'تعيين وتهيئة عضو فريق جديد' : 'Onboard & Setup New Team Member')
                  : (isRtl ? `تحديث الملف المهني: ${formData.nameAr || formData.nameEn}` : `Configure Profile: ${formData.nameEn || formData.nameAr}`)}
              </h2>
            </div>
          </div>

          {/* AI Assist button in header for standalone mode */}
          {onAIAssist && (
            <button
              type="button"
              onClick={onAIAssist}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-white/20"
            >
              <Sparkles size={13} className="text-[#E7DDFC]" />
              <span>{isRtl ? 'توليد النبذة بالذكاء الاصطناعي' : 'AI Context Generator'}</span>
            </button>
          )}
        </div>
      )}

      {/* Form Content layout with Guided Section Navigator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        
        {/* Step Navigator Sidebar */}
        <div className="lg:col-span-3 bg-neutral-50/70 border-r rtl:border-r-0 rtl:border-l border-neutral-200/80 p-4 space-y-1.5">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1.5 pb-2 block">
            {isRtl ? 'خطوات التهيئة المعيارية' : 'Configuration Steps'}
          </span>

          {[
            { id: 'basic', labelEn: '1. Basic Identity', labelAr: '١. الهوية والاتصال', icon: User },
            { id: 'bio', labelEn: '2. Bio & Specialties', labelAr: '٢. النبذة والخبرات', icon: Sparkles },
            { id: 'finance', labelEn: '3. Finance Rules', labelAr: '٣. قواعد المستحقات والرواتب', icon: DollarSign },
            { id: 'schedule', labelEn: '4. Shift Matrix', labelAr: '٤. جدول العمل والشيفتات', icon: Calendar },
            { id: 'access', labelEn: '5. Access & Security', labelAr: '٥. الأمن والوصول والصلاحيات', icon: Shield }
          ].map(sec => {
            const isActive = activeFormSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveFormSection(sec.id as any)}
                className={`w-full text-start px-3.5 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2.5 transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#1D035F] text-white shadow-xs' 
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <sec.icon size={14} className={isActive ? 'text-[#E7DDFC]' : 'text-neutral-400'} />
                <span>{isRtl ? sec.labelAr : sec.labelEn}</span>
              </button>
            );
          })}

          <div className="pt-6 px-1 text-[10px] text-neutral-400 space-y-1">
            <p className="font-extrabold text-[#6537C0] uppercase">🛡️ {isRtl ? 'حفظ آمن وموثق' : 'SECURE VAULT'}</p>
            <p className="leading-relaxed font-medium">
              {isRtl 
                ? 'تُحفظ كافة التغييرات وجداول الشيفتات مباشرة عبر خوادم بارسبا السحابية الآمنة.'
                : 'All changes and schedules are persisted securely via BARSPA cloud infrastructure.'}
            </p>
          </div>
        </div>

        {/* Main form edit body */}
        <form onSubmit={handleSubmit} className="lg:col-span-9 p-5 md:p-6 bg-white space-y-6 flex flex-col justify-between">
          
          <div className="space-y-6">
            {activeFormSection === 'basic' && <BasicIdentitySection formData={formData} setFormData={setFormData} isRtl={isRtl} />}
            {activeFormSection === 'bio' && (
              <BioSpecialtiesSection 
                formData={formData} 
                setFormData={setFormData} 
                isRtl={isRtl} 
                employeePhotoFile={employeePhotoFile} 
                applyEmployeePhotoFile={setEmployeePhotoFile} 
                onAIAssist={onAIAssist}
              />
            )}
            {activeFormSection === 'finance' && <FinanceRulesSection formData={formData} setFormData={setFormData} isRtl={isRtl} />}
            {activeFormSection === 'schedule' && <ShiftMatrixSection formData={formData} setFormData={setFormData} isRtl={isRtl} />}
            {activeFormSection === 'access' && (
              <AccessSecuritySection 
                formData={formData} 
                setFormData={setFormData} 
                isRtl={isRtl}
                staffAppPermissions={staffAppPermissions}
                setStaffAppPermissions={setStaffAppPermissions}
                formMode={formMode}
              />
            )}
          </div>

          {/* Step Navigation Actions footer panel */}
          <div className="pt-5 border-t border-neutral-200/80 flex flex-col gap-3 mt-6 sm:flex-row sm:items-center sm:justify-between">
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>

              {canGoBack && (
                <button
                  type="button"
                  onClick={() => setActiveFormSection(steps[activeStepIndex - 1])}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-extrabold cursor-pointer transition-all"
                >
                  {isRtl ? 'الخطوة السابقة' : 'Previous Step'}
                </button>
              )}

              {canGoNext && (
                <button
                  type="button"
                  onClick={() => setActiveFormSection(steps[activeStepIndex + 1])}
                  className="px-4 py-2 bg-[#1D035F] hover:bg-[#2A0878] text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-xs"
                >
                  {isRtl ? 'الخطوة التالية' : 'Next Step'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePersist}
                className="px-5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-extrabold cursor-pointer transition-all"
              >
                {isRtl ? 'حفظ كمسودة' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={handlePersist}
                className="px-5 py-2 bg-gradient-to-r from-[#6537C0] to-[#1D035F] hover:from-[#7646D8] hover:to-[#2A0878] text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{isRtl ? 'حفظ بيانات الموظف' : 'Save Employee'}</span>
              </button>
            </div>

          </div>

        </form>

      </div>

    </div>
  );
}
