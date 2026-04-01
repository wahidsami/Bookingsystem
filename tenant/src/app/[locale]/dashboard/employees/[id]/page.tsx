"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

const NATIONALITIES = [
  "Saudi", "Egyptian", "Filipino", "Indian", "Pakistani",
  "Bangladeshi", "Syrian", "Jordanian", "Lebanese", "Yemeni",
  "Sudanese", "Tunisian", "Moroccan", "Other"
];

interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  bio?: string;
  experience?: string;
  skills: string[];
  photo?: string;
  salary: number;
  commissionRate: number;
  // workingHours removed - use Schedules section instead
  isActive: boolean;
  app_enabled?: boolean;
}

export default function EditEmployeePage() {
  const t = useTranslations("Employees");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    bio: "",
    experience: "",
    skills: [] as string[],
    salary: "",
    commissionRate: "",
    isActive: true
  });
  const [newSkill, setNewSkill] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);

  // App Access State
  const [appEnabled, setAppEnabled] = useState(false);
  const [appAccessLoading, setAppAccessLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Permissions State
  const [permissions, setPermissions] = useState({
    view_earnings: false,
    view_reviews: true,
    reply_reviews: false,
    view_clients: false
  });
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadEmployee();
    }
  }, [id]);

  const loadEmployee = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await tenantApi.getEmployee(id as string);

      if (response.success && response.employee) {
        const emp = response.employee;
        setFormData({
          name: emp.name || "",
          email: emp.email || "",
          phone: emp.phone || "",
          nationality: emp.nationality || "",
          bio: emp.bio || "",
          experience: emp.experience || "",
          skills: emp.skills || [],
          salary: emp.salary?.toString() || "",
          commissionRate: emp.commissionRate?.toString() || "",
          isActive: emp.isActive !== undefined ? emp.isActive : true
          // Note: workingHours removed - use Schedules section to manage employee schedules
        });

        setAppEnabled(emp.app_enabled || false);

        if (emp.photo) {
          setExistingPhoto(getImageUrl(emp.photo));
          setPhotoPreview(getImageUrl(emp.photo));
        }

        // Load Permissions
        try {
          const permRes = await tenantApi.getEmployeePermissions(id as string);
          if (permRes.success && permRes.permissions) {
            setPermissions({
              view_earnings: permRes.permissions.view_earnings || false,
              view_reviews: permRes.permissions.view_reviews !== undefined ? permRes.permissions.view_reviews : true,
              reply_reviews: permRes.permissions.reply_reviews || false,
              view_clients: permRes.permissions.view_clients || false
            });
          }
        } catch (permErr) {
          console.error("Failed to load permissions:", permErr);
        }
      } else {
        setError(response.message || "Failed to load employee");
      }
    } catch (err: any) {
      console.error("Failed to load employee:", err);
      setError(err.message || "Failed to load employee");
    } finally {
      setLoading(false);
    }
  };

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

  const handleToggleAppAccess = async () => {
    setAppAccessLoading(true);
    try {
      const response = await tenantApi.updateEmployeeAppAccess(id as string, !appEnabled);
      if (response.success) {
        setAppEnabled(!appEnabled);
      } else {
        setError(response.message || "Failed to update app access");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update app access");
    } finally {
      setAppAccessLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!formData.email) {
      setError(locale === 'ar' ? 'الرجاء إضافة بريد إلكتروني للموظف لإرسال الدعوة' : 'Please add an email address for the employee to send an invite');
      return;
    }
    setInviteLoading(true);
    try {
      const response = await tenantApi.sendEmployeeAppInvite(id as string);
      if (response.success) {
        alert(locale === 'ar' ? "تم إرسال الدعوة وتفعيل وصول التطبيق بنجاح." : "Invite sent successfully. App access has been enabled for this staff member.");
        setAppEnabled(true);
      } else {
        setError(response.message || "Failed to send invite");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من إعادة تعيين كلمة المرور لهذا الموظف؟' : 'Are you sure you want to reset password for this employee?')) return;
    setResetLoading(true);
    try {
      const response = await tenantApi.resetEmployeePassword(id as string);
      if (response.success) {
        alert(locale === 'ar' ? "تم إرسال رابط إعادة تعيين كلمة المرور." : "Password reset link sent successfully.");
      } else {
        setError(response.message || "Failed to reset password");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  const handlePermissionChange = async (key: keyof typeof permissions, checked: boolean) => {
    // Optimistic UI update
    setPermissions(prev => ({ ...prev, [key]: checked }));
    setPermissionsLoading(true);
    try {
      await tenantApi.updateEmployeePermissions(id as string, { [key]: checked });
    } catch (err: any) {
      console.error("Failed to update permission:", err);
      setError(locale === 'ar' ? 'فشل تحديث الصلاحيات' : 'Failed to update permissions');
      // Revert optimism
      setPermissions(prev => ({ ...prev, [key]: !checked }));
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const submitData = new FormData();

      // Append all form fields
      submitData.append("name", formData.name);
      if (formData.email) submitData.append("email", formData.email);
      if (formData.phone) submitData.append("phone", formData.phone);
      if (formData.nationality) submitData.append("nationality", formData.nationality);
      if (formData.bio) submitData.append("bio", formData.bio);
      if (formData.experience) submitData.append("experience", formData.experience);
      submitData.append("skills", JSON.stringify(formData.skills));
      submitData.append("salary", formData.salary);
      submitData.append("commissionRate", formData.commissionRate || "0");
      submitData.append("isActive", formData.isActive.toString());
      // Note: workingHours removed - use Schedules section to manage employee schedules

      // Append photo only if a new one is selected
      if (photoFile) {
        submitData.append("photo", photoFile);
      }

      const response = await tenantApi.updateEmployee(id as string, submitData);

      if (response.success) {
        router.push(`/${locale}/dashboard/employees`);
      } else {
        setError(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update employee:", err);
      setError(err.message || t("updateError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("edit")} {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'تعديل معلومات الموظف' : 'Edit employee information'}
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

      {/* Form - Same as new page */}
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
                        setPhotoPreview(existingPhoto);
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
                    {photoPreview && photoPreview !== existingPhoto ? t("changePhoto") : t("uploadPhoto")}
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
                  className="w-4 h-4 text-primary focus:ring-primary rounded"
                />
                <label className="font-medium text-gray-700">{t("isActive")}</label>
              </div>
            </div>

            {/* App Access Management */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'وصول التطبيق' : 'App Access'}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <p className="font-medium text-gray-800">{locale === 'ar' ? 'تفعيل الوصول للتطبيق' : 'Enable Mobile App Access'}</p>
                    <p className="text-sm text-gray-500">{locale === 'ar' ? 'السماح للموظف باستخدام تطبيق RifahStaff' : 'Allow staff to use the RifahStaff mobile app'}</p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleToggleAppAccess}
                      disabled={appAccessLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${appEnabled ? 'bg-primary' : 'bg-gray-200'} ${appAccessLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${appEnabled ? (isRTL ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                <hr className="border-gray-100" />

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleSendInvite}
                    disabled={inviteLoading || !formData.email}
                    className="w-full px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    {inviteLoading ? (
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      locale === 'ar' ? 'إرسال دعوة التطبيق (بريد إلكتروني)' : 'Send App Invite (Email)'
                    )}
                  </button>

                  {appEnabled && (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading || !formData.email}
                      className="w-full px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                      {resetLoading ? (
                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        locale === 'ar' ? 'طلب إعادة تعيين كلمة المرور' : 'Request Password Reset'
                      )}
                    </button>
                  )}

                  {!formData.email && (
                    <p className="text-xs text-red-500 mt-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar' ? 'البريد الإلكتروني مطلوب لإرسال الدعوات.' : 'Email address is required to send invites.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="card lg:col-span-2">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex justify-between items-center" style={{ flexDirection: isRTL ? 'row-reverse' : 'row', textAlign: isRTL ? 'right' : 'left' }}>
                <span>{locale === 'ar' ? 'صلاحيات الموظف' : 'Staff Permissions'}</span>
                {permissionsLoading && <span className="text-sm font-normal text-primary animate-pulse">{locale === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="font-medium text-gray-800">💰 {locale === 'ar' ? 'عرض الأرباح' : 'View Earnings'}</p>
                      <p className="text-sm text-gray-500">{locale === 'ar' ? 'تمكين الموظف من رؤية راتبه والعمولات والإكراميات.' : 'Let this staff see their payroll, commission, and tips.'}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={permissions.view_earnings} onChange={(e) => handlePermissionChange('view_earnings', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="font-medium text-gray-800">⭐ {locale === 'ar' ? 'عرض التقييمات' : 'View Reviews'}</p>
                      <p className="text-sm text-gray-500">{locale === 'ar' ? 'السماح برؤية تقييمات العملاء لهذا الموظف.' : 'Let this staff see reviews left by customers.'}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={permissions.view_reviews} onChange={(e) => handlePermissionChange('view_reviews', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="font-medium text-gray-800">✍️ {locale === 'ar' ? 'الرد على التقييمات' : 'Reply to Reviews'}</p>
                      <p className="text-sm text-gray-500">{locale === 'ar' ? 'السماح للرد بشكل عام على تقييمات العملاء.' : 'Let this staff post public replies to reviews.'}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={permissions.reply_reviews} onChange={(e) => handlePermissionChange('reply_reviews', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="font-medium text-gray-800">👥 {locale === 'ar' ? 'عرض العملاء الدائمين' : 'View Clients'}</p>
                      <p className="text-sm text-gray-500">{locale === 'ar' ? 'السماح بمعرفة سجل العملاء.' : 'Let this staff see repeat clients and notes.'}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={permissions.view_clients} onChange={(e) => handlePermissionChange('view_clients', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
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
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? t("loading") : t("save")}
          </button>
        </div>
      </form>
    </TenantLayout>
  );
}

