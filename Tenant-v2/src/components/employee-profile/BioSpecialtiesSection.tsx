import React, { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { TeamMemberData } from '../../types/employee';

interface BioSpecialtiesSectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
  employeePhotoFile: File | null;
  applyEmployeePhotoFile: (file: File | null) => void;
}

export default function BioSpecialtiesSection({
  formData,
  setFormData,
  isRtl,
  employeePhotoFile,
  applyEmployeePhotoFile
}: BioSpecialtiesSectionProps) {
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newLangInput, setNewLangInput] = useState('');
  const employeePhotoInputRef = useRef<HTMLInputElement>(null);

  const handleAddSpecialty = () => {
    if (!newSpecialty.trim()) return;
    setFormData(p => ({
      ...p,
      specialtiesEn: [...p.specialtiesEn, newSpecialty.trim()],
      specialtiesAr: [...p.specialtiesAr, newSpecialty.trim()]
    }));
    setNewSpecialty('');
  };

  const handleRemoveSpecialty = (index: number) => {
    setFormData(p => ({
      ...p,
      specialtiesEn: p.specialtiesEn.filter((_, i) => i !== index),
      specialtiesAr: p.specialtiesAr.filter((_, i) => i !== index)
    }));
  };

  const handleAddLanguage = () => {
    if (!newLangInput.trim()) return;
    setFormData(p => ({
      ...p,
      languagesEn: [...p.languagesEn, newLangInput.trim()],
      languagesAr: [...p.languagesAr, newLangInput.trim()]
    }));
    setNewLangInput('');
  };

  const handleRemoveLanguage = (index: number) => {
    setFormData(p => ({
      ...p,
      languagesEn: p.languagesEn.filter((_, i) => i !== index),
      languagesAr: p.languagesAr.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border-b border-neutral-100 pb-2">
        <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
          {isRtl ? 'النبذة المهنية وسيرة العمل والتخصصات' : 'Biography & Expertises'}
        </h4>
        <p className="text-[11px] text-neutral-400 font-medium">Compose the public stylist biography, specialties catalog, and upload their workspace photo avatar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'النبذة المهنية باللغة العربية' : 'Arabic Bio'}
          </label>
          <textarea
            value={formData.bioAr}
            onChange={e => setFormData(p => ({ ...p, bioAr: e.target.value }))}
            placeholder="أخصائية تجميل وعناية وتلوين شعر محترفة..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white h-20"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'النبذة المهنية باللغة الإنجليزية' : 'English Bio'}
          </label>
          <textarea
            value={formData.bioEn}
            onChange={e => setFormData(p => ({ ...p, bioEn: e.target.value }))}
            placeholder="Professional master aesthetician and color specialist..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white h-20"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'مستويات الخبرة بالأعوام' : 'Experience Years'}
          </label>
          <input
            type="text"
            value={isRtl ? formData.experienceAr : formData.experienceEn}
            onChange={e => setFormData(p => isRtl ? ({ ...p, experienceAr: e.target.value }) : ({ ...p, experienceEn: e.target.value }))}
            placeholder={isRtl ? '٨ سنوات' : '8 Years'}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'التخصصات والخدمات المتقنة' : 'Specialties Tag Hub'}
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newSpecialty}
              onChange={e => setNewSpecialty(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialty())}
              placeholder={isRtl ? 'مثال: بالياج سويسري' : 'e.g. Swiss Balayage'}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold"
            />
            <button
              type="button"
              onClick={handleAddSpecialty}
              className="px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {formData.specialtiesEn.map((sp, i) => (
              <span key={i} className="bg-indigo-50 text-indigo-900 px-2 py-1 rounded text-[9px] font-black flex items-center gap-1.5 border border-indigo-100">
                <span>{sp}</span>
                <button type="button" onClick={() => handleRemoveSpecialty(i)} className="text-indigo-400 hover:text-rose-500">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'اللغات المتحدثة' : 'Spoken Languages Tag Hub'}
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newLangInput}
              onChange={e => setNewLangInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLanguage())}
              placeholder={isRtl ? 'مثال: الفرنسية' : 'e.g. French'}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold"
            />
            <button
              type="button"
              onClick={handleAddLanguage}
              className="px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {formData.languagesEn.map((lg, i) => (
              <span key={i} className="bg-slate-100 text-neutral-800 px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1.5 border border-slate-200">
                <span>{lg}</span>
                <button type="button" onClick={() => handleRemoveLanguage(i)} className="text-neutral-400 hover:text-rose-500">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'صورة الموظفة/الموظف' : 'Employee Photo'}
          </label>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file && file.type.startsWith('image/')) {
                applyEmployeePhotoFile(file);
              }
            }}
            className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <img src={formData.avatar} alt="Employee preview" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={employeePhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      applyEmployeePhotoFile(file);
                      event.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => employeePhotoInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-[11px] font-black text-white shadow-sm"
                  >
                    <Upload size={14} />
                    <span>{isRtl ? 'رفع صورة' : 'Upload image'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmployeePhotoFile(null)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black text-neutral-500 hover:bg-white"
                  >
                    <X size={14} />
                    <span>{isRtl ? 'إزالة الصورة' : 'Remove'}</span>
                  </button>
                </div>
                <p className="text-[10px] font-medium text-neutral-400">
                  {isRtl
                    ? 'اسحب وأفلت صورة JPG أو PNG أو WEBP، أو اختر ملفاً من الجهاز. سيتم حفظها في ملف الموظف.'
                    : 'Drag and drop a JPG, PNG, or WEBP image, or choose a file from your device. It will be saved to the employee profile.'}
                </p>
                {employeePhotoFile ? (
                  <p className="text-[10px] font-bold text-emerald-600">{employeePhotoFile.name}</p>
                ) : (
                  <p className="text-[10px] font-bold text-neutral-400">{isRtl ? 'لم يتم اختيار ملف بعد' : 'No file selected yet'}</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
