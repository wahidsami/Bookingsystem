import React from 'react';
import { Calendar, User, Phone, Mail, Globe, Briefcase } from 'lucide-react';
import { TeamMemberData, EmployeePosition, EMPLOYEE_POSITION_OPTIONS } from '../../types/employee';

interface BasicIdentitySectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
}

export default function BasicIdentitySection({ formData, setFormData, isRtl }: BasicIdentitySectionProps) {
  // Use either nationality field as the single source of truth for the input
  const currentNationality = formData.nationalityAr || formData.nationalityEn || '';

  const handleNationalityChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      nationalityAr: val,
      nationalityEn: val
    }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-neutral-100 pb-3">
        <h4 className="text-sm font-black text-neutral-900 tracking-tight flex items-center gap-2">
          <User size={16} className="text-[#6537C0]" />
          <span>{isRtl ? 'المعلومات الشخصية وبيانات الاتصال' : 'Personal Identity & Contact Info'}</span>
        </h4>
        <p className="text-xs text-neutral-500 font-medium mt-0.5">
          {isRtl 
            ? 'تحديد البيانات الأساسية، قنوات الاتصال، والتصنيف الوظيفي المعتمد في المنشأة.' 
            : 'Define core demographic details, direct contact channels, and organizational role.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name (Arabic) */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold block">
            {isRtl ? 'الاسم بالكامل (بالعربية) *' : 'Full Name (Arabic) *'}
          </label>
          <input
            type="text"
            required
            autoFocus
            value={formData.nameAr}
            onChange={e => setFormData(p => ({ ...p, nameAr: e.target.value }))}
            placeholder={isRtl ? 'مثال: نادين الحربي' : 'e.g. Nadeen Al-Harbi'}
            className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
          />
        </div>

        {/* Name (English) */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold block">
            {isRtl ? 'الاسم بالكامل (بالإنجليزي) *' : 'Full Name (English) *'}
          </label>
          <input
            type="text"
            required
            value={formData.nameEn}
            onChange={e => setFormData(p => ({ ...p, nameEn: e.target.value }))}
            placeholder="e.g. Nadeen Al-Harbi"
            className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
          />
        </div>

        {/* Role Designation / Position Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
            <Briefcase size={12} className="text-[#6537C0]" />
            <span>{isRtl ? 'التصنيف الوظيفي (تحديد الصلاحيات والشيفتات) *' : 'Functional Position *'}</span>
          </label>
          <select
            value={formData.position}
            onChange={e => {
              const newPos = e.target.value as EmployeePosition;
              const opt = EMPLOYEE_POSITION_OPTIONS.find(o => o.value === newPos);
              setFormData(p => ({
                ...p,
                position: newPos,
                roleEn: opt?.en || p.roleEn,
                roleAr: opt?.ar || p.roleAr
              }));
            }}
            className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors cursor-pointer"
          >
            {EMPLOYEE_POSITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {isRtl ? `${opt.ar} (${opt.en})` : `${opt.en} (${opt.ar})`}
              </option>
            ))}
          </select>
        </div>

        {/* Gender Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold block">
            {isRtl ? 'الجنس *' : 'Gender *'}
          </label>
          <select
            value={formData.gender || 'female'}
            onChange={e => setFormData(p => ({ ...p, gender: e.target.value as 'female' | 'male' }))}
            className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors cursor-pointer"
          >
            <option value="female">{isRtl ? 'أنثى (Female)' : 'Female (أنثى)'}</option>
            <option value="male">{isRtl ? 'ذكر (Male)' : 'Male (ذكر)'}</option>
          </select>
        </div>

        {/* Contact Email */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
            <Mail size={12} className="text-neutral-400" />
            <span>{isRtl ? 'البريد الإلكتروني للاتصال' : 'Contact Email'}</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
            placeholder="name@example.com"
            className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
          />
        </div>

        {/* Personal Phone */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
            <Phone size={12} className="text-neutral-400" />
            <span>{isRtl ? 'رقم الجوال الشخصي' : 'Personal Phone'}</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
            placeholder="+966 5X XXX XXXX"
            className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors text-end font-mono"
            dir="ltr"
          />
        </div>

        {/* Single Persisted Nationality Field */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
            <Globe size={12} className="text-neutral-400" />
            <span>{isRtl ? 'الجنسية والوطن' : 'Nationality'}</span>
          </label>
          <input
            type="text"
            value={currentNationality}
            onChange={e => handleNationalityChange(e.target.value)}
            placeholder={isRtl ? 'مثال: سعودية' : 'e.g. Saudi'}
            className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
          />
        </div>

        {/* Read-Only Account Creation Date (Derived from createdAt / joinedDate) */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-500 font-extrabold flex items-center gap-1.5">
            <Calendar size={12} className="text-neutral-400" />
            <span>{isRtl ? 'تاريخ إنشاء الحساب (النظام)' : 'Account Created (System)'}</span>
          </label>
          <div className="w-full bg-neutral-100/70 border border-neutral-200/80 rounded-xl p-2.5 text-xs font-mono font-bold text-neutral-600 flex items-center justify-between">
            <span>{formData.joinedDate || new Date().toISOString().split('T')[0]}</span>
            <span className="text-[10px] bg-neutral-200/70 text-neutral-600 font-sans font-semibold px-2 py-0.5 rounded-md">
              {isRtl ? 'تلقائي' : 'Read-only'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
