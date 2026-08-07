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
}

export default function EmployeeProfileEditor({
  initialData,
  isRtl,
  onSave,
  onCancel,
  formMode = 'add',
  initialStaffAppPermissions = DEFAULT_STAFF_APP_PERMISSIONS,
  onAIAssist
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
    <div className="bg-white rounded-3xl border border-neutral-200/60 shadow-md overflow-hidden animate-fade-in" id="roster-guided-form-editor">
      
      {/* Header Panel */}
      <div className="bg-zinc-950 text-white p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer border border-neutral-800"
          >
            <ArrowLeft size={16} className={isRtl ? 'transform rotate-180' : ''} />
          </button>
          <div>
            <span className="text-[9px] uppercase tracking-widest text-amber-400 font-black block">
              {isRtl ? 'بوابة تعيين وتهيئة الكادر' : 'REFAH TEAM ROSTER CREATOR'}
            </span>
            <h2 className="text-base font-black">
              {formMode === 'add' 
                ? (isRtl ? 'تعيين وتهيئة عضو فريق جديد' : 'Onboard & Setup New Team Member')
                : (isRtl ? `تحديث الملف المهني: ${formData.nameAr || formData.nameEn}` : `Configure Profile: ${formData.nameEn || formData.nameAr}`)}
            </h2>
          </div>
        </div>

        {/* AI Assist button */}
        {onAIAssist && (
          <button
            type="button"
            onClick={onAIAssist}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-white/10"
          >
            <Sparkles size={13} className="text-amber-300" />
            <span>{isRtl ? 'توليد النبذة بالذكاء الاصطناعي' : 'AI Context Generator'}</span>
          </button>
        )}
      </div>

      {/* Form Content layout with Guided Section Navigator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        
        {/* Left guided Section Navigator Sidebar */}
        <div className="lg:col-span-3 bg-slate-50/50 border-r border-slate-150 p-4 space-y-1">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1.5 pb-2 block">
            {isRtl ? 'خطوات التهيئة المعيارية' : 'Standard Onboarding Steps'}
          </span>

          {[
            { id: 'basic', labelEn: '1. Basic Identity', labelAr: '١. الهوية والاتصال', icon: User },
            { id: 'bio', labelEn: '2. Bio & Specialties', labelAr: '٢. النبذة والخبرات', icon: Sparkles },
            { id: 'finance', labelEn: '3. Finance Rules', labelAr: '٣. قواعد المستحقات والرواتب', icon: DollarSign },
            { id: 'schedule', labelEn: '4. Shift Matrix', labelAr: '٤. جدول العمل والشيفت', icon: Calendar },
            { id: 'access', labelEn: '5. Access Paths & Security', labelAr: '٥. الأمن والوصول اللحظي', icon: Shield }
          ].map(sec => {
            const isActive = activeFormSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveFormSection(sec.id as any)}
                className={`w-full text-start px-3.5 py-3 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-zinc-950 text-white shadow-sm' 
                    : 'text-neutral-500 hover:bg-slate-100 hover:text-neutral-800'
                }`}
              >
                <sec.icon size={13} className={isActive ? 'text-amber-400' : 'text-neutral-400'} />
                <span>{isRtl ? sec.labelAr : sec.labelEn}</span>
              </button>
            );
          })}

          <div className="pt-6 px-1 text-[10px] text-neutral-400 space-y-1">
            <p className="font-extrabold text-amber-600 uppercase">🛡️ {isRtl ? 'مستودع آمن بالكامل' : 'SECURE VAULT WORKSPACE'}</p>
            <p className="leading-relaxed font-medium">All personal records and dashboard permission tokens are protected with certified 256-bit encryption before saving.</p>
          </div>
        </div>

        {/* Right Main form edit body */}
        <form onSubmit={handleSubmit} className="lg:col-span-9 p-6 bg-white space-y-6 flex flex-col justify-between">
          
          <div className="space-y-6">
            {activeFormSection === 'basic' && <BasicIdentitySection formData={formData} setFormData={setFormData} isRtl={isRtl} />}
            {activeFormSection === 'bio' && (
              <BioSpecialtiesSection 
                formData={formData} 
                setFormData={setFormData} 
                isRtl={isRtl} 
                employeePhotoFile={employeePhotoFile} 
                applyEmployeePhotoFile={setEmployeePhotoFile} 
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
              />
            )}
          </div>

          {/* Step Navigation Actions footer panel */}
          <div className="pt-6 border-t border-slate-100 flex flex-col gap-3 mt-6 lg:flex-row lg:items-center lg:justify-between">
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-neutral-600 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                {isRtl ? 'تراجع والعودة للقائمة' : 'Back to Directory'}
              </button>

              {canGoBack && (
                <button
                  type="button"
                  onClick={() => setActiveFormSection(steps[activeStepIndex - 1])}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition-all"
                >
                  {isRtl ? 'الخطوة السابقة' : 'Previous Step'}
                </button>
              )}

              {canGoNext && (
                <button
                  type="button"
                  onClick={() => setActiveFormSection(steps[activeStepIndex + 1])}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white rounded-xl text-xs font-black cursor-pointer transition-all"
                >
                  {isRtl ? 'الخطوة التالية' : 'Next Step'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePersist}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition-all"
              >
                {isRtl ? 'حفظ مسودة' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={handlePersist}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{isRtl ? 'حفظ الموظف' : 'Save Employee'}</span>
              </button>
            </div>

          </div>

        </form>

      </div>

    </div>
  );
}
