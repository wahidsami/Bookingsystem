import React, { useState, useRef } from 'react';
import { Upload, X, Sparkles, BookOpen, Clock, Award, Languages } from 'lucide-react';
import { TeamMemberData } from '../../types/employee';

interface BioSpecialtiesSectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
  employeePhotoFile: File | null;
  applyEmployeePhotoFile: (file: File | null) => void;
  onAIAssist?: () => void;
}

export default function BioSpecialtiesSection({
  formData,
  setFormData,
  isRtl,
  employeePhotoFile,
  applyEmployeePhotoFile,
  onAIAssist
}: BioSpecialtiesSectionProps) {
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newLangInput, setNewLangInput] = useState('');
  const employeePhotoInputRef = useRef<HTMLInputElement>(null);

  // Single biography source of truth
  const currentBio = formData.bioAr || formData.bioEn || '';
  const handleBioChange = (val: string) => {
    setFormData(p => ({
      ...p,
      bioAr: val,
      bioEn: val
    }));
  };

  // Single experience source of truth
  const currentExperience = formData.experienceAr || formData.experienceEn || '';
  const handleExperienceChange = (val: string) => {
    setFormData(p => ({
      ...p,
      experienceAr: val,
      experienceEn: val
    }));
  };

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
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-neutral-100 pb-3">
        <h4 className="text-sm font-black text-neutral-900 tracking-tight flex items-center gap-2">
          <BookOpen size={16} className="text-[#6537C0]" />
          <span>{isRtl ? 'النبذة المهنية وسيرة العمل والتخصصات' : 'Biography & Professional Expertise'}</span>
        </h4>
        <p className="text-xs text-neutral-500 font-medium mt-0.5">
          {isRtl 
            ? 'صياغة النبذة العامة للموظف، سنوات الخبرة، قائمة التخصصات، ولغات التواصل.' 
            : 'Compose public employee biography, verified experience, specialties catalog, and spoken languages.'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Consolidated Single Biography Input with Embedded AI Assist Button */}
        <div className="space-y-1.5 bg-neutral-50/50 p-4 rounded-2xl border border-neutral-200/80">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] text-neutral-700 font-extrabold flex items-center gap-1.5">
              <Award size={13} className="text-[#6537C0]" />
              <span>{isRtl ? 'النبذة المهنية والتعريفية' : 'Professional Biography'}</span>
            </label>
            {onAIAssist && (
              <button
                type="button"
                onClick={onAIAssist}
                className="px-3 py-1 bg-gradient-to-r from-[#6537C0] to-[#1D035F] hover:from-[#7646D8] hover:to-[#2A0878] text-white rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Sparkles size={11} className="text-[#E7DDFC]" />
                <span>{isRtl ? 'توليد النبذة بالذكاء الاصطناعي' : 'AI Bio Assist'}</span>
              </button>
            )}
          </div>
          <textarea
            value={currentBio}
            onChange={e => handleBioChange(e.target.value)}
            placeholder={isRtl 
              ? 'أخصائية عناية وتجميل بخبرة واسعة في تقديم خدمات العناية بالشعر والبشرة وفق أعلى المعايير...' 
              : 'Senior aesthetician and beauty specialist with extensive experience in luxury hair and skin treatments...'}
            className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs font-medium text-neutral-900 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] min-h-[90px] leading-relaxed transition-colors"
          />
          <p className="text-[10px] text-neutral-400 font-medium">
            {isRtl 
              ? 'تظهر هذه النبذة في ملف الموظف وتطبيق العملاء.' 
              : 'This bio is displayed on the public salon directory and booking flows.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Consolidated Single Experience Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
              <Clock size={12} className="text-[#6537C0]" />
              <span>{isRtl ? 'سنوات الخبرة المهنية' : 'Years of Experience'}</span>
            </label>
            <input
              type="text"
              value={currentExperience}
              onChange={e => handleExperienceChange(e.target.value)}
              placeholder={isRtl ? 'مثال: ٨ سنوات' : 'e.g. 8 Years'}
              className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
            />
          </div>

          {/* Spoken Languages Hub */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
              <Languages size={12} className="text-[#6537C0]" />
              <span>{isRtl ? 'لغات التواصل' : 'Spoken Languages'}</span>
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newLangInput}
                onChange={e => setNewLangInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLanguage())}
                placeholder={isRtl ? 'مثال: العربية، الإنجليزية' : 'e.g. Arabic, English'}
                className="flex-1 bg-neutral-50/60 border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
              />
              <button
                type="button"
                onClick={handleAddLanguage}
                className="px-3 bg-[#1D035F] hover:bg-[#2A0878] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formData.languagesEn.map((lg, i) => (
                <span key={i} className="bg-purple-50 text-[#1D035F] px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-purple-200/80">
                  <span>{lg}</span>
                  <button type="button" onClick={() => handleRemoveLanguage(i)} className="text-purple-400 hover:text-rose-500 transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Specialties and Services Tag Hub */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#6537C0]" />
            <span>{isRtl ? 'التخصصات والخدمات المتقنة' : 'Specialties & Key Skills'}</span>
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newSpecialty}
              onChange={e => setNewSpecialty(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialty())}
              placeholder={isRtl ? 'مثال: قص وتصفيف، صبغة بالياج، عناية أظافر' : 'e.g. Hair Coloring, Balayage, Nail Art'}
              className="flex-1 bg-neutral-50/60 border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
            />
            <button
              type="button"
              onClick={handleAddSpecialty}
              className="px-3 bg-[#1D035F] hover:bg-[#2A0878] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {formData.specialtiesEn.map((sp, i) => (
              <span key={i} className="bg-purple-50 text-[#1D035F] px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-purple-200/80">
                <span>{sp}</span>
                <button type="button" onClick={() => handleRemoveSpecialty(i)} className="text-purple-400 hover:text-rose-500 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Employee Avatar / Photo */}
        <div className="space-y-2 pt-2">
          <label className="text-[11px] text-neutral-600 font-extrabold block">
            {isRtl ? 'صورة الموظف / الملف الشخصي' : 'Employee Profile Photo'}
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
            className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-4 transition-colors hover:border-purple-300"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D035F] hover:bg-[#2A0878] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>{isRtl ? 'رفع صورة' : 'Upload photo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmployeePhotoFile(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-600 transition-colors cursor-pointer"
                  >
                    <X size={13} />
                    <span>{isRtl ? 'إزالة الصورة' : 'Remove'}</span>
                  </button>
                </div>
                <p className="text-[11px] font-medium text-neutral-400">
                  {isRtl
                    ? 'اسحب وأفلت صورة JPG أو PNG أو WEBP، أو اختر ملفاً من الجهاز.'
                    : 'Drag and drop JPG, PNG, or WEBP image, or browse from your device.'}
                </p>
                {employeePhotoFile ? (
                  <p className="text-[11px] font-bold text-emerald-600">✓ {employeePhotoFile.name}</p>
                ) : (
                  <p className="text-[11px] font-medium text-neutral-400">{isRtl ? 'لم يتم اختيار ملف جديد' : 'No new file chosen'}</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
