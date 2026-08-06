import React from 'react';
import { TeamMemberData, EmployeePosition, EMPLOYEE_POSITION_OPTIONS } from '../../types/employee';

interface BasicIdentitySectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
}

export default function BasicIdentitySection({ formData, setFormData, isRtl }: BasicIdentitySectionProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border-b border-neutral-100 pb-2">
        <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
          {isRtl ? 'المعلومات والبيانات الشخصية والاتصال' : 'Personal Identity & Contact Info'}
        </h4>
        <p className="text-[11px] text-neutral-400 font-medium">Define basic demographic details, contact routing, and the organizational position.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'الاسم بالكامل (بالعربية) *' : 'Full Name (Arabic) *'}
          </label>
          <input
            type="text"
            required
            autoFocus
            value={formData.nameAr}
            onChange={e => setFormData(p => ({ ...p, nameAr: e.target.value }))}
            placeholder="مثال: نادين الحربي"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'الاسم بالكامل (بالإنجليزي) *' : 'Full Name (English) *'}
          </label>
          <input
            type="text"
            required
            value={formData.nameEn}
            onChange={e => setFormData(p => ({ ...p, nameEn: e.target.value }))}
            placeholder="e.g. Nadeen Al-Harbi"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'المسمى الوظيفي المعتمد (بالعربية)' : 'Designated Role (Arabic)'}
          </label>
          <input
            type="text"
            value={formData.roleAr}
            onChange={e => setFormData(p => ({ ...p, roleAr: e.target.value }))}
            placeholder="مثال: أخصائية تجميل أولى"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'المسمى الوظيفي المعتمد (بالإنجليزي)' : 'Designated Role (English)'}
          </label>
          <input
            type="text"
            value={formData.roleEn}
            onChange={e => setFormData(p => ({ ...p, roleEn: e.target.value }))}
            placeholder="e.g. Senior Aesthetician"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'البريد الإلكتروني للاتصال' : 'Contact Email'}
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'رقم الجوال الشخصي' : 'Personal Phone'}
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900 text-end font-mono"
            dir="ltr"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'التصنيف الوظيفي (تحديد الصلاحيات)' : 'Role Designation Position'}
          </label>
          <select
            value={formData.position}
            onChange={e => setFormData(p => ({ ...p, position: e.target.value as EmployeePosition }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
          >
            {EMPLOYEE_POSITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{isRtl ? opt.ar : opt.en}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'تاريخ التعيين والمباشرة' : 'Onboarding Date'}
          </label>
          <input
            type="date"
            value={formData.joinedDate}
            onChange={e => setFormData(p => ({ ...p, joinedDate: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </div>
    </div>
  );
}
