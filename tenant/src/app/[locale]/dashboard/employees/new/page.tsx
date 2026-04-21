"use client";

import { useEffect, useMemo, useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { EMPLOYEE_GENDERS, EMPLOYEE_POSITIONS } from "@/lib/employeePositions";
import { EMPLOYEE_LANGUAGE_OPTIONS } from "@/lib/employeeProfile";

const NATIONALITIES = [
  "Saudi", "Egyptian", "Filipino", "Indian", "Pakistani", 
  "Bangladeshi", "Syrian", "Jordanian", "Lebanese", "Yemeni",
  "Sudanese", "Tunisian", "Moroccan", "Other"
];

export default function NewEmployeePage() {
  const t = useTranslations("Employees");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tenantTaxRate, setTenantTaxRate] = useState(15);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    gender: "",
    position: "",
    bio: "",
    experience: "",
    skills: [] as string[],
    spokenLanguages: [] as string[],
    salary: "",
    commissionRate: "",
    serviceCommissionEnabled: false,
    productCommissionEnabled: false,
    scheduleVisibilityWeeks: "1",
    isActive: true
  });
  const [newSkill, setNewSkill] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await tenantApi.getSettings();
        const taxRate = Number(response?.data?.settings?.taxRate ?? response?.data?.settings?.tax_rate ?? 15);
        if (!Number.isNaN(taxRate)) {
          setTenantTaxRate(taxRate);
        }
      } catch (settingsErr) {
        console.warn("Failed to load tenant settings for finance preview:", settingsErr);
      }
    };

    loadSettings();
  }, []);

  const salaryValue = Number(formData.salary || 0);
  const vatAmount = useMemo(() => {
    if (!salaryValue || Number.isNaN(salaryValue)) {
      return 0;
    }
    return salaryValue * (tenantTaxRate / 100);
  }, [salaryValue, tenantTaxRate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "isActive") {
      setFormData(prev => ({ ...prev, isActive: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const toggleLanguage = (languageValue: string) => {
    setFormData((prev) => {
      const exists = prev.spokenLanguages.includes(languageValue);
      return {
        ...prev,
        spokenLanguages: exists
          ? prev.spokenLanguages.filter((item) => item !== languageValue)
          : [...prev.spokenLanguages, languageValue]
      };
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const submitData = new FormData();
      
      // Append all form fields
      submitData.append("name", formData.name);
      if (formData.email) submitData.append("email", formData.email);
      if (formData.phone) submitData.append("phone", formData.phone);
      if (formData.nationality) submitData.append("nationality", formData.nationality);
      submitData.append("gender", formData.gender);
      if (formData.position) submitData.append("position", formData.position);
      if (formData.bio) submitData.append("bio", formData.bio);
      if (formData.experience) submitData.append("experience", formData.experience);
      submitData.append("skills", JSON.stringify(formData.skills));
      submitData.append("spokenLanguages", JSON.stringify(formData.spokenLanguages));
      submitData.append("salary", formData.salary);
      submitData.append("commissionRate", formData.commissionRate || "0");
      submitData.append("serviceCommissionEnabled", String(formData.serviceCommissionEnabled));
      submitData.append("productCommissionEnabled", String(formData.productCommissionEnabled));
      submitData.append("scheduleVisibilityWeeks", formData.scheduleVisibilityWeeks || "1");
      submitData.append("isActive", formData.isActive.toString());
      // Note: workingHours removed - use Schedules section to manage employee schedules
      
      // Append photo if selected
      if (photoFile) {
        submitData.append("photo", photoFile);
      }

      const response = await tenantApi.createEmployee(submitData);
      
      if (response.success) {
        router.push(`/${locale}/dashboard/employees`);
      } else {
        setError(response.message || t("createError"));
      }
    } catch (err: any) {
      console.error("Failed to create employee:", err);
      // Show more detailed error message
      const errorMessage = err.message || err.response?.data?.message || t("createError");
      setError(errorMessage);
      
      // Log full error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error("Full error details:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("addEmployee")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'أضف موظفاً جديداً إلى فريقك' : 'Add a new employee to your team'}
            </p>
          </div>
          <Link href={`/${locale}/dashboard/employees`} className="btn btn-secondary">
            {t("cancel")}
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("name")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("email")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("phone")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("nationality")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <select
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="">{t("selectNationality")}</option>
                    {NATIONALITIES.map(nat => (
                      <option key={nat} value={nat}>{nat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الجنس' : 'Gender'} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {EMPLOYEE_GENDERS.map((option) => (
                      <option key={option.value || 'gender-placeholder'} value={option.value}>
                        {option.label[locale as 'ar' | 'en'] || option.label.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الوظيفة / المسمى الوظيفي' : 'Position / Job Title'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {EMPLOYEE_POSITIONS.map((option) => (
                      <option key={option.value || 'placeholder'} value={option.value}>
                        {option.label[locale as 'ar' | 'en'] || option.label.en}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar'
                      ? 'يحدد هذا المسمى ما إذا كان العضو سيستخدم تطبيق الموظف أم حساب لوحة التحكم.'
                      : 'This title decides whether the team member uses the staff app or a dashboard account.'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("bio")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("experience")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="text"
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    placeholder={locale === 'ar' ? 'مثال: 5 سنوات' : 'e.g., 5 years'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("skills")}
              </h3>
              
              <div className="space-y-4">
                <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    placeholder={locale === 'ar' ? 'أضف مهارة...' : 'Add a skill...'}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    {t("addSkill")}
                  </button>
                </div>

                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-2"
                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="text-primary hover:text-primary/70"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'اللغات المتحدثة' : 'Spoken languages'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {EMPLOYEE_LANGUAGE_OPTIONS.map((option) => {
                      const checked = formData.spokenLanguages.includes(option.value);
                      return (
                        <label key={option.value} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <span className="text-sm font-medium text-gray-700">
                            {option.label[locale as 'ar' | 'en'] || option.label.en}
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLanguage(option.value)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Note: Working Hours removed - use Schedules section to manage employee schedules */}
          </div>

          {/* Right Column - Photo & Financial */}
          <div className="space-y-6">
            {/* Photo Upload */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("photo")}
              </h3>
              
              <div className="space-y-4">
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-6xl">📷</span>
                  </div>
                )}
                
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <span className="btn btn-secondary w-full text-center cursor-pointer">
                    {photoPreview ? t("changePhoto") : t("uploadPhoto")}
                  </span>
                </label>
              </div>
            </div>

            {/* Financial Information */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'المعلومات المالية' : 'Financial Information'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("salary")} (SAR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("commission")} (%) <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="number"
                    name="commissionRate"
                    value={formData.commissionRate}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'عمولة الخدمات' : 'Service commission'}
                      </h4>
                      <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'تحديد ما إذا كان هذا الموظف يظهر في خدمات العمولات.' : 'Controls whether this employee is included in service commission flows.'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.serviceCommissionEnabled}
                      onChange={(e) => setFormData((prev) => ({ ...prev, serviceCommissionEnabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'عمولة المنتجات' : 'Product commission'}
                      </h4>
                      <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'تحديد ما إذا كان هذا الموظف يظهر في منتجات العمولات.' : 'Controls whether this employee is included in product commission flows.'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.productCommissionEnabled}
                      onChange={(e) => setFormData((prev) => ({ ...prev, productCommissionEnabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="rounded-lg bg-white p-3 text-sm text-gray-600">
                    <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span>{locale === 'ar' ? 'الراتب قبل الضريبة' : 'Salary before VAT'}</span>
                      <span className="font-semibold text-gray-900"><Currency amount={salaryValue || 0} locale={locale === 'ar' ? 'ar-SA' : 'en-US'} /></span>
                    </div>
                    <div className="mt-2 flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span>{locale === 'ar' ? 'قيمة الضريبة التقديرية' : 'Estimated VAT'}</span>
                      <span className="font-semibold text-gray-900"><Currency amount={vatAmount || 0} locale={locale === 'ar' ? 'ar-SA' : 'en-US'} /></span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span className="font-medium text-gray-700">{locale === 'ar' ? 'الإجمالي التقريبي' : 'Estimated total'}</span>
                      <span className="font-semibold text-gray-900"><Currency amount={(salaryValue || 0) + (vatAmount || 0)} locale={locale === 'ar' ? 'ar-SA' : 'en-US'} /></span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar'
                        ? `تم احتساب الضريبة على معدل ${tenantTaxRate}% من إعدادات المركز الحالية.`
                        : `VAT is estimated using the current tenant tax rate of ${tenantTaxRate}%.`}
                    </p>
                  </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'إتاحة الجدول للموظف' : 'Schedule Visibility'}
                  </label>
                  <select
                    name="scheduleVisibilityWeeks"
                    value={formData.scheduleVisibilityWeeks}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="1">{locale === 'ar' ? 'أسبوع واحد' : '1 Week'}</option>
                    <option value="2">{locale === 'ar' ? 'أسبوعان' : '2 Weeks'}</option>
                    <option value="3">{locale === 'ar' ? '3 أسابيع' : '3 Weeks'}</option>
                    <option value="4">{locale === 'ar' ? '4 أسابيع' : '4 Weeks'}</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar'
                      ? 'يحدد عدد الأسابيع المستقبلية التي يستطيع الموظف رؤيتها في تطبيق RifahStaff.'
                      : 'Controls how many future weeks this employee can view in the RifahStaff app.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Status */}
            <div className="card">
              <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <label className="font-medium text-gray-700">{t("isActive")}</label>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Form Actions */}
        <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link href={`/${locale}/dashboard/employees`} className="btn btn-secondary">
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? t("loading") : t("save")}
          </button>
        </div>
      </form>
    </TenantLayout>
  );
}

