"use client";

import { useEffect, useMemo, useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { useAppDialog } from "@/components/AppDialogProvider";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { EmployeeWeeklyScheduleEditor } from "@/components/EmployeeWeeklyScheduleEditor";
import { EMPLOYEE_GENDERS, EMPLOYEE_POSITIONS, getDashboardRoleKeyForEmployeePosition } from "@/lib/employeePositions";
import { EMPLOYEE_LANGUAGE_OPTIONS } from "@/lib/employeeProfile";
import {
  DASHBOARD_PERMISSION_KEYS,
  ROLE_OPTIONS,
  SECTION_PERMISSION_LABELS,
  normalizeDashboardPermissions
} from "@/lib/dashboardAccess";

const NATIONALITIES = [
  "Saudi", "Egyptian", "Filipino", "Indian", "Pakistani", 
  "Bangladeshi", "Syrian", "Jordanian", "Lebanese", "Yemeni",
  "Sudanese", "Tunisian", "Moroccan", "Other"
];

type EmployeeScheduleDraftShift = {
  id: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  startDate: string | null;
  endDate: string | null;
  label: string | null;
  isActive: boolean;
  isDraft?: boolean;
};

type ScheduleSummary = {
  activeDays: number;
  recurringShifts: number;
  oneTimeShifts: number;
};

export default function NewEmployeePage() {
  const t = useTranslations("Employees");
  const params = useParams();
  const router = useRouter();
  const dialog = useAppDialog();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<'basic' | 'bio' | 'finance' | 'schedule' | 'access'>('basic');
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
  const [staffAppPassword, setStaffAppPassword] = useState("");
  const [dashboardPermissions, setDashboardPermissions] = useState<Record<string, boolean>>(
    normalizeDashboardPermissions({}, 'custom')
  );
  const [scheduleDraft, setScheduleDraft] = useState<EmployeeScheduleDraftShift[]>([]);
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary>({
    activeDays: 0,
    recurringShifts: 0,
    oneTimeShifts: 0
  });
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const dashboardRoleKey = getDashboardRoleKeyForEmployeePosition(formData.position) || 'custom';
  const isServiceProvider = formData.position === 'service_provider';

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

  const handleDashboardPermissionChange = (key: string, checked: boolean) => {
    setDashboardPermissions((prev) => ({
      ...prev,
      [key]: checked
    }));
  };

  const sectionProgress = useMemo(() => {
    const basicFields = [
      formData.name.trim(),
      formData.email.trim(),
      formData.phone.trim(),
      formData.nationality.trim(),
      formData.gender.trim(),
      formData.position.trim()
    ];
    const basicFilled = basicFields.filter(Boolean).length;

    const bioFields = [
      formData.bio.trim(),
      formData.experience.trim(),
      formData.skills.length > 0,
      formData.spokenLanguages.length > 0,
      Boolean(photoPreview || photoFile)
    ];
    const bioFilled = bioFields.filter(Boolean).length;

    const financeFields = [salaryValue > 0];
    const financeFilled = financeFields.filter(Boolean).length;

    const scheduleFields = [formData.scheduleVisibilityWeeks.trim(), scheduleStartDate.trim(), scheduleEndDate.trim()];
    const hasScheduleRows = scheduleSummary.activeDays > 0 || scheduleSummary.recurringShifts > 0 || scheduleSummary.oneTimeShifts > 0;
    const scheduleFilled = hasScheduleRows ? scheduleFields.filter(Boolean).length : 0;

    const accessFields = isServiceProvider
      ? [staffAppPassword.trim().length >= 8]
      : [Object.values(dashboardPermissions).some(Boolean)];
    const accessFilled = accessFields.filter(Boolean).length;

    return {
      basic: { filled: basicFilled, total: basicFields.length, label: `${basicFilled}/${basicFields.length}` },
      bio: { filled: bioFilled, total: bioFields.length, label: bioFilled > 0 ? `${bioFilled}/${bioFields.length}` : (locale === 'ar' ? 'اختياري' : 'Optional') },
      finance: { filled: financeFilled, total: financeFields.length, label: financeFilled > 0 ? `${financeFilled}/${financeFields.length}` : (locale === 'ar' ? 'اختياري' : 'Optional') },
      schedule: {
        filled: scheduleFilled,
        total: scheduleFields.length,
        label: hasScheduleRows ? `${scheduleFilled}/${scheduleFields.length}` : (locale === 'ar' ? 'اختياري' : 'Optional')
      },
      access: { filled: accessFilled, total: accessFields.length, label: accessFilled > 0 ? `${accessFilled}/${accessFields.length}` : (locale === 'ar' ? 'اختياري' : 'Optional') }
    };
  }, [dashboardPermissions, formData.bio, formData.email, formData.experience, formData.gender, formData.name, formData.nationality, formData.phone, formData.position, formData.scheduleVisibilityWeeks, formData.skills.length, formData.spokenLanguages.length, isServiceProvider, locale, photoFile, photoPreview, salaryValue, scheduleSummary.activeDays, scheduleSummary.oneTimeShifts, scheduleSummary.recurringShifts, scheduleStartDate, scheduleEndDate, staffAppPassword]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId as typeof activeSection);
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
      if (formData.salary !== "") {
        submitData.append("salary", formData.salary);
      }
      submitData.append("commissionRate", formData.commissionRate || "0");
      submitData.append("serviceCommissionEnabled", String(formData.serviceCommissionEnabled));
      submitData.append("productCommissionEnabled", String(formData.productCommissionEnabled));
      submitData.append("scheduleVisibilityWeeks", formData.scheduleVisibilityWeeks || "1");
      submitData.append("isActive", formData.isActive.toString());
      if (isServiceProvider && staffAppPassword.trim()) {
        submitData.append("staffAppPassword", staffAppPassword.trim());
      }
      if (!isServiceProvider) {
        submitData.append("dashboardPermissions", JSON.stringify(dashboardPermissions));
      }
      // Note: workingHours removed - use Schedules section to manage employee schedules
      
      // Append photo if selected
      if (photoFile) {
        submitData.append("photo", photoFile);
      }

      const response = await tenantApi.createEmployee(submitData);

      const createdEmployee = response?.employee || response?.data?.employee || response?.data || response;
      const createdEmployeeId = createdEmployee?.id || createdEmployee?.employee?.id || response?.employee?.id || response?.data?.id;

      if (createdEmployeeId && scheduleDraft.length > 0) {
        const scheduleResults = await Promise.allSettled(
          scheduleDraft
            .filter((shift) => shift.dayOfWeek !== null && shift.isDraft !== true)
            .map((shift) =>
              tenantApi.createEmployeeShift(createdEmployeeId, {
                dayOfWeek: shift.dayOfWeek,
                specificDate: null,
                startTime: shift.startTime,
                endTime: shift.endTime,
                isRecurring: true,
                startDate: scheduleStartDate || null,
                endDate: scheduleEndDate || null,
                label: shift.label || undefined
              })
            )
        );

        const failedShifts = scheduleResults.filter((result) => result.status === "rejected");
        if (failedShifts.length > 0) {
          await dialog.alert({
            title: locale === 'ar' ? 'تم حفظ الموظف مع تنبيه' : 'Employee saved with a warning',
            message: locale === 'ar'
              ? 'تم إنشاء الملف بنجاح، لكن بعض الورديات الأسبوعية لم تُحفظ. يمكنك تعديلها لاحقاً من صفحة الموظف.'
              : 'The employee was created, but some weekly shifts could not be saved. You can finish them later from the employee page.',
            tone: 'default'
          });
        }
      }
      
      if (response.success) {
        router.push(`/${locale}/dashboard/employees`);
      } else {
        const message = response.message || t("createError");
        setError(message);
        await dialog.alert({
          title: locale === 'ar' ? 'تعذر حفظ الموظف' : 'Could not save employee',
          message,
          tone: 'danger'
        });
      }
    } catch (err: any) {
      console.error("Failed to create employee:", err);
      // Show more detailed error message
      const errorMessage = err.message || err.response?.data?.message || t("createError");
      setError(errorMessage);
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر حفظ الموظف' : 'Could not save employee',
        message: errorMessage,
        tone: 'danger'
      });
      
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
      <div className="mb-6 animate-fade-in">
        <div className={`flex flex-col gap-4 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("addEmployee")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'أضف موظفاً جديداً إلى فريقك' : 'Add a new employee to your team'}
            </p>
          </div>

          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <Link href={`/${locale}/dashboard/employees`} className="btn btn-secondary">
              {t("cancel")}
            </Link>
            <button type="submit" form="employee-editor-form" disabled={loading} className="btn btn-primary">
              {loading ? t("loading") : t("save")}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <form id="employee-editor-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
          <aside className="sticky top-6 self-start rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                {locale === 'ar' ? 'أقسام التحرير' : 'Editor Sections'}
              </p>
            </div>
            <div className="space-y-2">
              {[
                { id: 'basic', label: locale === 'ar' ? 'المعلومات الأساسية' : 'Basic information', status: sectionProgress.basic.label },
                { id: 'bio', label: locale === 'ar' ? 'السيرة الذاتية' : 'Biography', status: sectionProgress.bio.label },
                { id: 'finance', label: locale === 'ar' ? 'المالية' : 'Finance', status: sectionProgress.finance.label },
                { id: 'schedule', label: locale === 'ar' ? 'الجدول' : 'Schedule', status: sectionProgress.schedule.label },
                { id: 'access', label: locale === 'ar' ? 'الصلاحيات' : 'Access', status: sectionProgress.access.label }
              ].map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-start transition-all ${
                      active
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs font-semibold text-gray-500">{item.status}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${
                            item.id === 'basic'
                              ? Math.round((sectionProgress.basic.filled / sectionProgress.basic.total) * 100)
                              : item.id === 'bio'
                                ? Math.round((sectionProgress.bio.filled / sectionProgress.bio.total) * 100)
                                : item.id === 'finance'
                                  ? Math.round((sectionProgress.finance.filled / sectionProgress.finance.total) * 100)
                                  : item.id === 'schedule'
                                    ? Math.round((sectionProgress.schedule.filled / sectionProgress.schedule.total) * 100)
                                    : Math.round((sectionProgress.access.filled / sectionProgress.access.total) * 100)
                          }%`
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
            <section id="employee-section-basic" className={`${activeSection === 'basic' ? 'card scroll-mt-6' : 'hidden'}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                  </h3>
                  <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الحقول الأساسية المطلوبة لإكمال الملف.' : 'Required fields to identify this team member.'}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {sectionProgress.basic.label}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("name")} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("email")} <span className="text-red-500">*</span>
                    </label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("phone")} <span className="text-red-500">*</span>
                    </label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("nationality")} <span className="text-red-500">*</span>
                    </label>
                    <select name="nationality" value={formData.nationality} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <option value="">{t("selectNationality")}</option>
                      {NATIONALITIES.map((nat) => (
                        <option key={nat} value={nat}>{nat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar' ? 'الجنس' : 'Gender'} <span className="text-red-500">*</span>
                    </label>
                    <select name="gender" value={formData.gender} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {EMPLOYEE_GENDERS.map((option) => (
                        <option key={option.value || 'gender-placeholder'} value={option.value}>
                          {option.label[locale as 'ar' | 'en'] || option.label.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الوظيفة / المسمى الوظيفي' : 'Position / Job Title'} <span className="text-red-500">*</span>
                  </label>
                  <select name="position" value={formData.position} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
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
              </div>
            </section>

            <section id="employee-section-bio" className={`${activeSection === 'bio' ? 'card scroll-mt-6' : 'hidden'}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'السيرة الذاتية' : 'Biography'}
                  </h3>
                  <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'أضف ملخصاً مهنياً ومهاراته ولغاته وصورته.' : 'Add a short bio, skills, spoken languages, and a profile image.'}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {sectionProgress.bio.label}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("bio")}
                  </label>
                  <textarea name="bio" value={formData.bio} onChange={handleChange} rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("experience")}
                  </label>
                  <input
                    type="text"
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    placeholder={locale === 'ar' ? 'مثال: 5 سنوات' : 'e.g., 5 years'}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("skills")}
                  </label>
                  <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                      placeholder={locale === 'ar' ? 'أضف مهارة...' : 'Add a skill...'}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                    <button type="button" onClick={handleAddSkill} className="rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90">
                      {t("addSkill")}
                    </button>
                  </div>

                  {formData.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {formData.skills.map((skill, idx) => (
                        <span key={idx} className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          {skill}
                          <button type="button" onClick={() => handleRemoveSkill(skill)} className="text-primary hover:text-primary/70">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'اللغات المتحدثة' : 'Spoken languages'}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("photo")}
                      </h4>
                      <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'صورة واضحة تساعد على التعرّف على الموظف.' : 'A clear profile image helps identify the team member.'}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {sectionProgress.bio.label}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {photoPreview ? (
                      <div className="relative">
                        <img src={photoPreview} alt="Preview" className="h-64 w-full rounded-lg object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoPreview(null);
                          }}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-64 w-full items-center justify-center rounded-lg bg-gray-100">
                        <span className="text-6xl">📷</span>
                      </div>
                    )}

                    <label className="block">
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                      <span className="btn btn-secondary w-full cursor-pointer text-center">
                        {photoPreview ? t("changePhoto") : t("uploadPhoto")}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section id="employee-section-finance" className={`${activeSection === 'finance' ? 'card scroll-mt-6' : 'hidden'}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'المالية' : 'Finance'}
                  </h3>
                  <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الراتب والضريبة تظهر هنا مع معاينة سريعة للقيمة النهائية.' : 'Salary and VAT preview live here.'}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {sectionProgress.finance.label}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("salary")} (SAR) <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
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
                      <span className="font-semibold text-gray-900">
                        <Currency amount={salaryValue || 0} locale={locale === 'ar' ? 'ar-SA' : 'en-US'} />
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span>{locale === 'ar' ? 'قيمة الضريبة التقديرية' : 'Estimated VAT'}</span>
                      <span className="font-semibold text-gray-900">
                        <Currency amount={vatAmount || 0} locale={locale === 'ar' ? 'ar-SA' : 'en-US'} />
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span className="font-medium text-gray-700">{locale === 'ar' ? 'الإجمالي التقريبي' : 'Estimated total'}</span>
                      <span className="font-semibold text-gray-900">
                        <Currency amount={(salaryValue || 0) + (vatAmount || 0)} locale={locale === 'ar' ? 'ar-SA' : 'en-US'} />
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar'
                        ? `تم احتساب الضريبة على معدل ${tenantTaxRate}% من إعدادات المركز الحالية.`
                        : `VAT is estimated using the current tenant tax rate of ${tenantTaxRate}%.`}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="employee-section-schedule" className={`${activeSection === 'schedule' ? 'card scroll-mt-6 space-y-4' : 'hidden'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الجدول' : 'Schedule'}
                  </h3>
                  <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar'
                      ? 'الجدول الأسبوعي الخاص بالموظف يُدار هنا مباشرة باستخدام نفس ورديات التطبيق.'
                      : 'The employee’s weekly schedule is managed here directly using the same shift records.'}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {sectionProgress.schedule.label}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[280px,minmax(0,1fr)]">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'إتاحة الجدول للموظف' : 'Schedule visibility'}
                  </label>
                  <select
                    name="scheduleVisibilityWeeks"
                    value={formData.scheduleVisibilityWeeks}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="1">{locale === 'ar' ? 'أسبوع واحد' : '1 Week'}</option>
                    <option value="2">{locale === 'ar' ? 'أسبوعان' : '2 Weeks'}</option>
                    <option value="3">{locale === 'ar' ? '3 أسابيع' : '3 Weeks'}</option>
                    <option value="4">{locale === 'ar' ? '4 أسابيع' : '4 Weeks'}</option>
                  </select>
                  <p className="mt-3 text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar'
                      ? 'يحدد عدد الأسابيع المستقبلية التي يستطيع الموظف رؤيتها في تطبيق RifahStaff.'
                      : 'Controls how many future weeks this employee can view in the RifahStaff app.'}
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'تاريخ بداية الجدول' : 'Schedule start date'}
                      </label>
                      <input
                        type="date"
                        value={scheduleStartDate}
                        onChange={(event) => setScheduleStartDate(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'تاريخ نهاية الجدول' : 'Schedule end date'}
                      </label>
                      <input
                        type="date"
                        value={scheduleEndDate}
                        onChange={(event) => setScheduleEndDate(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                  </div>
                </div>

                <EmployeeWeeklyScheduleEditor
                  employeeId={null}
                  employeeName={formData.name || undefined}
                  locale={locale}
                  isRTL={isRTL}
                  draftMode
                  draftShifts={scheduleDraft}
                  onDraftShiftsChange={setScheduleDraft}
                  sharedStartDate={scheduleStartDate || null}
                  sharedEndDate={scheduleEndDate || null}
                  onSummaryChange={setScheduleSummary}
                />
              </div>
            </section>

            <section id="employee-section-access" className={`${activeSection === 'access' ? 'card scroll-mt-6' : 'hidden'}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الصلاحيات' : 'Access'}
                  </h3>
                  <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {isServiceProvider
                      ? (locale === 'ar'
                        ? 'هذا العضو يستخدم تطبيق الموظفين. هنا نضبط وصول التطبيق وكلمة المرور الأولية.'
                        : 'This role uses the staff app. Configure mobile access and the initial password here.')
                      : (locale === 'ar'
                        ? 'هذا العضو لا يستخدم تطبيق الموظفين. هنا نمنح صلاحيات لوحة التحكم.'
                        : 'This role does not use the staff app. Use this section to manage dashboard access.')}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {sectionProgress.access.label}
                </span>
              </div>

              {isServiceProvider ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div>
                        <h4 className="font-medium text-gray-800">{locale === 'ar' ? 'تفعيل الوصول للتطبيق' : 'Enable Mobile App Access'}</h4>
                        <p className="text-sm text-gray-500">{locale === 'ar' ? 'سيتم إنشاء حساب تطبيق الموظف عند حفظ الملف.' : 'A staff app account will be created when the employee is saved.'}</p>
                      </div>
                      <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        {locale === 'ar' ? 'مفعل تلقائياً' : 'Auto-managed'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar' ? 'كلمة مرور أولية للتطبيق' : 'Initial app password'}
                    </label>
                    <input
                      type="password"
                      value={staffAppPassword}
                      onChange={(e) => setStaffAppPassword(e.target.value)}
                      placeholder={locale === 'ar' ? 'اتركه فارغاً لإنشاء كلمة مرور تلقائياً' : 'Leave blank to auto-generate'}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div>
                        <h4 className="font-medium text-gray-800">{locale === 'ar' ? 'دور لوحة التحكم' : 'Dashboard role'}</h4>
                        <p className="text-sm text-gray-500">
                          {locale === 'ar'
                            ? `سيتم إنشاء الحساب كـ ${ROLE_OPTIONS.find((role) => role.value === dashboardRoleKey)?.labelAr || dashboardRoleKey}.`
                            : `The dashboard account will use the ${ROLE_OPTIONS.find((role) => role.value === dashboardRoleKey)?.labelEn || dashboardRoleKey} preset.`}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                        {ROLE_OPTIONS.find((role) => role.value === dashboardRoleKey)?.labelEn || dashboardRoleKey}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {DASHBOARD_PERMISSION_KEYS.filter((key) => key !== 'view_dashboard').map((key) => {
                      const checked = dashboardPermissions[key] === true;
                      const label = SECTION_PERMISSION_LABELS[key];

                      return (
                        <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                          <span className="text-sm font-medium text-gray-700">
                            {isRTL ? label.ar : label.en}
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleDashboardPermissionChange(key, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <div className="card">
              <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <label className="font-medium text-gray-700">{t("isActive")}</label>
              </div>
            </div>
          </div>
        </div>
      </form>
    </TenantLayout>
  );
}

