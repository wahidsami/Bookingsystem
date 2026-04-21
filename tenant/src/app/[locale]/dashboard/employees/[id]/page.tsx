"use client";

import { useState, useEffect, useMemo } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import { useAppDialog } from "@/components/AppDialogProvider";
import { EmployeeEditorFrame, type EmployeeEditorSection } from "@/components/EmployeeEditorFrame";
import { EmployeeWeeklyScheduleEditor } from "@/components/EmployeeWeeklyScheduleEditor";
import { EMPLOYEE_GENDERS, EMPLOYEE_POSITIONS, getDashboardRoleKeyForEmployeePosition } from "@/lib/employeePositions";
import { EMPLOYEE_LANGUAGE_OPTIONS } from "@/lib/employeeProfile";
import {
  DASHBOARD_PERMISSION_KEYS,
  SECTION_PERMISSION_LABELS,
  ROLE_OPTIONS,
  normalizeDashboardPermissions
} from "@/lib/dashboardAccess";

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
  gender?: string;
  position?: string;
  bio?: string;
  experience?: string;
  skills: string[];
  spokenLanguages?: string[];
  photo?: string;
  salary: number;
  commissionRate: number;
  serviceCommissionEnabled?: boolean;
  productCommissionEnabled?: boolean;
  scheduleVisibilityWeeks?: number;
  dashboardPermissions?: Record<string, boolean>;
  // workingHours removed - use Schedules section instead
  isActive: boolean;
  app_enabled?: boolean;
}

type ScheduleSummary = {
  activeDays: number;
  recurringShifts: number;
  oneTimeShifts: number;
};

export default function EditEmployeePage() {
    const dialog = useAppDialog();
  const t = useTranslations("Employees");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<'basic' | 'bio' | 'finance' | 'schedule' | 'access'>('basic');
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
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [tenantTaxRate, setTenantTaxRate] = useState(15);
  const [savedEmail, setSavedEmail] = useState("");
  const isServiceProvider = `${formData.position || ''}`.trim() === 'service_provider';
  const [dashboardAccountId, setDashboardAccountId] = useState<string | null>(null);
  const [dashboardAccountEmail, setDashboardAccountEmail] = useState("");
  const [dashboardPermissions, setDashboardPermissions] = useState<Record<string, boolean>>(
    normalizeDashboardPermissions({}, 'custom')
  );
  const [dashboardInviteLoading, setDashboardInviteLoading] = useState(false);
  const [dashboardResetLoading, setDashboardResetLoading] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary>({
    activeDays: 0,
    recurringShifts: 0,
    oneTimeShifts: 0
  });
  const dashboardRoleKey = getDashboardRoleKeyForEmployeePosition(formData.position) || 'custom';
  const dashboardRoleLabel = ROLE_OPTIONS.find((role) => role.value === dashboardRoleKey)
    ? (locale === 'ar'
      ? ROLE_OPTIONS.find((role) => role.value === dashboardRoleKey)?.labelAr
      : ROLE_OPTIONS.find((role) => role.value === dashboardRoleKey)?.labelEn)
    : dashboardRoleKey;
  const salaryValue = Number(formData.salary || 0);
  const vatAmount = useMemo(() => {
    if (!salaryValue || Number.isNaN(salaryValue)) {
      return 0;
    }
    return salaryValue * (tenantTaxRate / 100);
  }, [salaryValue, tenantTaxRate]);

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
    view_clients: false,
    view_booking_notes: false
  });
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const sectionProgress = useMemo(() => {
    const basicFields = [
      formData.name.trim(),
      formData.email.trim(),
      formData.phone.trim(),
      formData.nationality.trim(),
      formData.gender.trim(),
      formData.position.trim()
    ];
    const bioFields = [
      formData.bio.trim(),
      formData.experience.trim(),
      formData.skills.length > 0,
      Array.isArray(formData.spokenLanguages) && formData.spokenLanguages.length > 0,
      Boolean(photoPreview || existingPhoto)
    ];
    const financeFields = [salaryValue > 0];
    const scheduleFields = [formData.scheduleVisibilityWeeks.trim(), scheduleStartDate.trim(), scheduleEndDate.trim()];
    const hasScheduleRows = scheduleSummary.activeDays > 0 || scheduleSummary.recurringShifts > 0 || scheduleSummary.oneTimeShifts > 0;
    const scheduleFilled = hasScheduleRows ? scheduleFields.filter(Boolean).length : 0;
    const accessFields = isServiceProvider
      ? [appEnabled || Boolean(savedEmail)]
      : [Object.values(dashboardPermissions).some(Boolean)];

    return {
      basic: { filled: basicFields.filter(Boolean).length, total: basicFields.length },
      bio: { filled: bioFields.filter(Boolean).length, total: bioFields.length },
      finance: { filled: financeFields.filter(Boolean).length, total: financeFields.length },
      schedule: {
        filled: scheduleFilled,
        total: scheduleFields.length,
        label: hasScheduleRows ? `${scheduleFilled}/${scheduleFields.length}` : (locale === 'ar' ? 'اختياري' : 'Optional')
      },
      access: { filled: accessFields.filter(Boolean).length, total: accessFields.length }
    };
  }, [
    appEnabled,
    dashboardPermissions,
    existingPhoto,
    formData.bio,
    formData.email,
    formData.experience,
    formData.gender,
    formData.name,
    formData.nationality,
    formData.phone,
    formData.position,
    formData.scheduleVisibilityWeeks,
    formData.skills.length,
    formData.spokenLanguages.length,
    isServiceProvider,
    photoPreview,
    savedEmail,
    salaryValue,
    scheduleStartDate,
    scheduleEndDate,
    scheduleSummary.activeDays,
    scheduleSummary.oneTimeShifts,
    scheduleSummary.recurringShifts
  ]); 

  const editorSections: EmployeeEditorSection[] = [
    {
      id: 'basic',
      label: locale === 'ar' ? 'المعلومات الأساسية' : 'Basic information',
      progressLabel: `${sectionProgress.basic.filled}/${sectionProgress.basic.total}`,
      progressPercent: Math.round((sectionProgress.basic.filled / sectionProgress.basic.total) * 100)
    },
    {
      id: 'bio',
      label: locale === 'ar' ? 'السيرة الذاتية' : 'Biography',
      progressLabel: `${sectionProgress.bio.filled}/${sectionProgress.bio.total}`,
      progressPercent: Math.round((sectionProgress.bio.filled / sectionProgress.bio.total) * 100)
    },
    {
      id: 'finance',
      label: locale === 'ar' ? 'المالية' : 'Finance',
      progressLabel: `${sectionProgress.finance.filled}/${sectionProgress.finance.total}`,
      progressPercent: Math.round((sectionProgress.finance.filled / sectionProgress.finance.total) * 100)
    },
    {
      id: 'schedule',
      label: locale === 'ar' ? 'الجدول' : 'Schedule',
      progressLabel: sectionProgress.schedule.label,
      progressPercent: Math.round((sectionProgress.schedule.filled / sectionProgress.schedule.total) * 100)
    },
    {
      id: 'access',
      label: locale === 'ar' ? 'الصلاحيات' : 'Access',
      progressLabel: `${sectionProgress.access.filled}/${sectionProgress.access.total}`,
      progressPercent: Math.round((sectionProgress.access.filled / sectionProgress.access.total) * 100)
    }
  ];

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId as typeof activeSection);
  };

  useEffect(() => {
    if (id) {
      loadEmployee();
    }
  }, [id]);

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

  const loadEmployee = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await tenantApi.getEmployee(id as string);

      if (response.success && response.employee) {
        const emp = response.employee;
        const employeePosition = `${emp.position || ''}`.trim();
        const isEmployeeServiceProvider = employeePosition === 'service_provider';
        const dashboardRoleKey = getDashboardRoleKeyForEmployeePosition(employeePosition) || 'custom';
        setFormData({
          name: emp.name || "",
          email: emp.email || "",
          phone: emp.phone || "",
          nationality: emp.nationality || "",
          gender: emp.gender || "",
          position: emp.position || "",
          bio: emp.bio || "",
          experience: emp.experience || "",
          skills: emp.skills || [],
          spokenLanguages: Array.isArray(emp.spokenLanguages) ? emp.spokenLanguages : [],
          salary: emp.salary?.toString() || "",
          commissionRate: emp.commissionRate?.toString() || "",
          serviceCommissionEnabled: emp.serviceCommissionEnabled ?? false,
          productCommissionEnabled: emp.productCommissionEnabled ?? false,
          scheduleVisibilityWeeks: `${emp.scheduleVisibilityWeeks || 1}`,
          isActive: emp.isActive !== undefined ? emp.isActive : true
          // Note: workingHours removed - use Schedules section to manage employee schedules
        });

        setAppEnabled(emp.app_enabled || false);
        setSavedEmail(emp.email || "");
        setDashboardAccountId(null);
        setDashboardAccountEmail(emp.email || "");
        setDashboardPermissions(
          normalizeDashboardPermissions(emp.dashboardPermissions || {}, dashboardRoleKey)
        );

        if (emp.photo) {
          setExistingPhoto(getImageUrl(emp.photo));
          setPhotoPreview(getImageUrl(emp.photo));
        }

        if (!isEmployeeServiceProvider && emp.email) {
          try {
            const dashboardAccountsResponse = await tenantApi.getDashboardAccounts();
            const dashboardAccounts = Array.isArray(dashboardAccountsResponse.accounts)
              ? dashboardAccountsResponse.accounts
              : [];
            const account = dashboardAccounts.find((item: any) => {
              const accountEmail = `${item.email || ''}`.trim().toLowerCase();
              return accountEmail && accountEmail === `${emp.email || ''}`.trim().toLowerCase();
            });

            if (account) {
              setDashboardAccountId(account.id || null);
              setDashboardAccountEmail(account.email || emp.email || "");
              setDashboardPermissions(normalizeDashboardPermissions(account.permissions || {}, account.roleKey || dashboardRoleKey));
            }
          } catch (dashboardErr) {
            console.error("Failed to load dashboard account:", dashboardErr);
          }
        }

        // Load Permissions
        try {
          const permRes = await tenantApi.getEmployeePermissions(id as string);
          if (permRes.success && permRes.permissions) {
            setPermissions({
              view_earnings: permRes.permissions.view_earnings || false,
              view_reviews: permRes.permissions.view_reviews !== undefined ? permRes.permissions.view_reviews : true,
              reply_reviews: permRes.permissions.reply_reviews || false,
              view_clients: permRes.permissions.view_clients || false,
              view_booking_notes: permRes.permissions.view_booking_notes || false
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

  const handleToggleAppAccess = async () => {
    if (!savedEmail) {
      setError(
        locale === 'ar'
          ? 'احفظ بريد الموظف الإلكتروني أولاً قبل تفعيل وصول التطبيق.'
          : 'Save the employee with an email address before enabling app access.'
      );
      return;
    }
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
    if (!savedEmail) {
      setError(
        locale === 'ar'
          ? 'احفظ بريد الموظف الإلكتروني أولاً ثم أرسل الدعوة.'
          : 'Save the employee with an email address before sending the invite.'
      );
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
    if (!(await dialog.confirm(locale === 'ar' ? 'هل أنت متأكد من إعادة تعيين كلمة المرور لهذا الموظف؟' : 'Are you sure you want to reset password for this employee?'))) return;
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

  const handleDashboardPermissionChange = (key: string, checked: boolean) => {
    const nextPermissions = {
      ...dashboardPermissions,
      [key]: checked
    };

    setDashboardPermissions(nextPermissions);
  };

  const resolveDashboardAccountId = async () => {
    if (dashboardAccountId) {
      return dashboardAccountId;
    }

    const lookupEmail = `${dashboardAccountEmail || savedEmail || formData.email || ''}`.trim().toLowerCase();
    if (!lookupEmail) {
      return null;
    }

    try {
      const dashboardAccountsResponse = await tenantApi.getDashboardAccounts();
      const dashboardAccounts = Array.isArray(dashboardAccountsResponse.accounts)
        ? dashboardAccountsResponse.accounts
        : [];
      const account = dashboardAccounts.find((item: any) => {
        const accountEmail = `${item.email || ''}`.trim().toLowerCase();
        return accountEmail && accountEmail === lookupEmail;
      });

      if (account?.id) {
        setDashboardAccountId(account.id);
        setDashboardAccountEmail(account.email || lookupEmail);
        setDashboardPermissions(
          normalizeDashboardPermissions(account.permissions || {}, account.roleKey || dashboardRoleKey)
        );
        return account.id as string;
      }
    } catch (resolveErr) {
      console.error("Failed to resolve dashboard account:", resolveErr);
    }

    return null;
  };

  const formatDashboardAccountIssue = (rawMessage?: string | null) => {
    const message = `${rawMessage || ''}`.toLowerCase();
    const isTenantCollision = message.includes('tenant account') || message.includes('already used by a tenant');

    if (isTenantCollision) {
      return locale === 'ar'
        ? 'هذا البريد مستخدم بالفعل لحساب المركز. استخدم بريداً إلكترونياً مختلفاً لإنشاء حساب لوحة التحكم.'
        : 'This email is already used by the tenant owner account. Use a different email to create the dashboard account.';
    }

    return rawMessage || (locale === 'ar'
      ? 'تعذر إنشاء حساب لوحة التحكم.'
      : 'Failed to create the dashboard account.');
  };

  const ensureDashboardAccount = async (): Promise<{ accountId: string | null; errorMessage: string | null }> => {
    const existingAccountId = await resolveDashboardAccountId();
    if (existingAccountId) {
      return { accountId: existingAccountId, errorMessage: null };
    }

    const lookupEmail = `${dashboardAccountEmail || savedEmail || formData.email || ''}`.trim().toLowerCase();
    if (!lookupEmail) {
      return {
        accountId: null,
        errorMessage: locale === 'ar'
          ? 'يرجى إضافة بريد إلكتروني للموظف أولاً.'
          : 'Please add an employee email first.'
      };
    }

    try {
      const response = await tenantApi.createDashboardAccount({
        displayName: `${formData.name || lookupEmail}`.trim(),
        email: lookupEmail,
        roleKey: dashboardRoleKey,
        permissions: dashboardPermissions,
        isActive: true
      });

      const account = response?.account;
      if (response?.success && account?.id) {
        setDashboardAccountId(account.id);
        setDashboardAccountEmail(account.email || lookupEmail);
        setDashboardPermissions(
          normalizeDashboardPermissions(account.permissions || dashboardPermissions, account.roleKey || dashboardRoleKey)
        );
        return { accountId: account.id as string, errorMessage: null };
      }
    } catch (createErr) {
      console.error("Failed to create dashboard account on demand:", createErr);
      return {
        accountId: null,
        errorMessage: formatDashboardAccountIssue(
          createErr instanceof Error ? createErr.message : null
        )
      };
    }

    return {
      accountId: null,
      errorMessage: formatDashboardAccountIssue()
    };
  };

  const handleDashboardInvite = async () => {
    const { accountId: targetAccountId, errorMessage } = await ensureDashboardAccount();
    if (!targetAccountId) {
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر تنفيذ الدعوة' : 'Invite unavailable',
        message: locale === 'ar'
          ? `لم نتمكن من إنشاء أو العثور على حساب لوحة التحكم المرتبط بهذا العضو.${errorMessage ? `\n\n${errorMessage}` : ''}`
          : `We could not create or find the linked dashboard account for this team member.${errorMessage ? `\n\n${errorMessage}` : ''}`,
        tone: 'danger'
      });
      return;
    }

    setDashboardInviteLoading(true);
    try {
      const response = await tenantApi.sendDashboardAccountInvite(targetAccountId);
      if (!response?.success) {
        throw new Error(response?.message || (locale === 'ar' ? 'تعذر إرسال الدعوة' : 'Failed to send invitation'));
      }
      await dialog.alert({
        title: locale === 'ar' ? 'تم إرسال الدعوة' : 'Invitation sent',
        message: locale === 'ar'
          ? 'تم إرسال دعوة حساب لوحة التحكم بنجاح.'
          : 'The dashboard account invitation was sent successfully.',
        tone: 'success'
      });
    } catch (err: any) {
      console.error("Failed to send dashboard invite:", err);
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر إرسال الدعوة' : 'Failed to send invitation',
        message: err.message || (locale === 'ar'
          ? 'حدث خطأ أثناء إرسال الدعوة.'
          : 'An error occurred while sending the invitation.'),
        tone: 'danger'
      });
    } finally {
      setDashboardInviteLoading(false);
    }
  };

  const handleDashboardResetPassword = async () => {
    const { accountId: targetAccountId, errorMessage } = await ensureDashboardAccount();
    if (!targetAccountId) {
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر إعادة التعيين' : 'Reset unavailable',
        message: locale === 'ar'
          ? `لم نتمكن من إنشاء أو العثور على حساب لوحة التحكم المرتبط بهذا العضو.${errorMessage ? `\n\n${errorMessage}` : ''}`
          : `We could not create or find the linked dashboard account for this team member.${errorMessage ? `\n\n${errorMessage}` : ''}`,
        tone: 'danger'
      });
      return;
    }

    if (!(await dialog.confirm(locale === 'ar'
      ? 'هل تريد إعادة تعيين كلمة مرور حساب لوحة التحكم لهذا العضو؟'
      : 'Reset this team member dashboard account password?'))) {
      return;
    }

    setDashboardResetLoading(true);
    try {
      const response = await tenantApi.resetDashboardAccountPassword(targetAccountId);
      if (!response?.success) {
        throw new Error(response?.message || (locale === 'ar' ? 'تعذر إعادة تعيين كلمة المرور' : 'Failed to reset password'));
      }
      await dialog.alert({
        title: locale === 'ar' ? 'تمت إعادة التعيين' : 'Password reset',
        message: locale === 'ar'
          ? `تمت إعادة تعيين كلمة المرور بنجاح.${response?.temporaryPassword ? `\n\nكلمة المرور المؤقتة: ${response.temporaryPassword}` : ''}`
          : `The password was reset successfully.${response?.temporaryPassword ? `\n\nTemporary password: ${response.temporaryPassword}` : ''}`,
        tone: 'success'
      });
    } catch (err: any) {
      console.error("Failed to reset dashboard password:", err);
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر إعادة التعيين' : 'Reset failed',
        message: err.message || (locale === 'ar'
          ? 'حدث خطأ أثناء إعادة تعيين كلمة المرور.'
          : 'An error occurred while resetting the password.'),
        tone: 'danger'
      });
    } finally {
      setDashboardResetLoading(false);
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
      if (!isServiceProvider) {
        submitData.append("dashboardPermissions", JSON.stringify(dashboardPermissions));
      }
      // Note: workingHours removed - use Schedules section to manage employee schedules

      // Append photo only if a new one is selected
      if (photoFile) {
        submitData.append("photo", photoFile);
      }

      const response = await tenantApi.updateEmployee(id as string, submitData);

      if (response.success) {
        setSavedEmail(formData.email.trim());
        router.push(`/${locale}/dashboard/employees`);
      } else {
        const message = response.message || t("updateError");
        setError(message);
        await dialog.alert({
          title: locale === 'ar' ? 'تعذر حفظ الموظف' : 'Could not save employee',
          message,
          tone: 'danger'
        });
      }
    } catch (err: any) {
      console.error("Failed to update employee:", err);
      const message = err.message || t("updateError");
      setError(message);
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر حفظ الموظف' : 'Could not save employee',
        message,
        tone: 'danger'
      });
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
      <EmployeeEditorFrame
        locale={locale}
        isRTL={isRTL}
        title={`${t("edit")} ${t("title")}`}
        subtitle={locale === 'ar' ? 'تعديل معلومات الموظف' : 'Edit employee information'}
        cancelHref={`/${locale}/dashboard/employees`}
        saveLabel={t("save")}
        loadingLabel={t("loading")}
        cancelLabel={t("cancel")}
        formId="employee-editor-form"
        loading={saving}
        error={error}
        sections={editorSections}
        activeSection={activeSection}
        onSectionSelect={scrollToSection}
      >
      <form id="employee-editor-form" onSubmit={handleSubmit} noValidate className="space-y-6">
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
                      const checked = formData.spokenLanguages?.includes(option.value) || false;
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
            <div id="employee-section-basic" className={`${activeSection === 'basic' ? 'card scroll-mt-6' : 'hidden'}`}>
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'المعلومات المالية' : 'Financial Information'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("salary")} (SAR) <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
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
                      checked={formData.serviceCommissionEnabled || false}
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
                      checked={formData.productCommissionEnabled || false}
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

              </div>

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
                  {`${sectionProgress.schedule.filled}/${sectionProgress.schedule.total}`}
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
                  employeeId={id as string}
                  employeeName={formData.name || undefined}
                  locale={locale}
                  isRTL={isRTL}
                  sharedStartDate={scheduleStartDate || null}
                  sharedEndDate={scheduleEndDate || null}
                  onSharedRangeChange={({ startDate, endDate }) => {
                    setScheduleStartDate(startDate || "");
                    setScheduleEndDate(endDate || "");
                  }}
                  onSummaryChange={setScheduleSummary}
                />
              </div>
            </section>

            {/* Active Status */}
            <div id="employee-section-bio" className={`${activeSection === 'bio' ? 'card scroll-mt-6' : 'hidden'}`}>
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

            {isServiceProvider ? (
              <>
                {/* App Access Management */}
            <div id="employee-section-finance" className={`${activeSection === 'finance' ? 'card scroll-mt-6' : 'hidden'}`}>
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
                        disabled={inviteLoading || !savedEmail}
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
                          disabled={resetLoading || !savedEmail}
                          className="w-full px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                          {resetLoading ? (
                            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            locale === 'ar' ? 'طلب إعادة تعيين كلمة المرور' : 'Request Password Reset'
                          )}
                        </button>
                      )}

                      {!savedEmail && (
                        <p className="text-xs text-red-500 mt-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          {locale === 'ar'
                            ? 'احفظ الموظف بعنوان بريد إلكتروني أولاً لتفعيل التطبيق أو إرسال الدعوة.'
                            : 'Save the employee with an email address first to enable app access or send invites.'}
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
                          <p className="text-sm text-gray-500">{locale === 'ar' ? 'السماح بمعرفة سجل العملاء ومؤشراتهم.' : 'Let this staff see repeat clients and customer context.'}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={permissions.view_clients} onChange={(e) => handlePermissionChange('view_clients', e.target.checked)} />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          <p className="font-medium text-gray-800">📝 {locale === 'ar' ? 'عرض ملاحظات الحجوزات' : 'View Booking Notes'}</p>
                          <p className="text-sm text-gray-500">{locale === 'ar' ? 'السماح للموظف برؤية الملاحظات التي يضيفها العميل مع الحجز.' : 'Let this staff see notes that customers add while booking.'}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={permissions.view_booking_notes} onChange={(e) => handlePermissionChange('view_booking_notes', e.target.checked)} />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
            <div id="employee-section-access" className={`${activeSection === 'access' ? 'card scroll-mt-6' : 'hidden'}`}>
                <div className="mb-4 flex items-center justify-between gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar' ? 'صلاحيات لوحة التحكم' : 'Dashboard Permissions'}
                    </h3>
                    <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar'
                        ? 'هذا العضو لا يستخدم تطبيق الموظفين. هنا نمنح صلاحيات الأقسام الخاصة بلوحة التحكم.'
                        : 'This role does not use the staff app. Use this section to manage dashboard section access.'}
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {dashboardRoleLabel}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    <div className="font-medium text-gray-900">{locale === 'ar' ? 'الحساب المرتبط' : 'Linked account'}</div>
                    <div className="mt-1 break-all text-gray-700">
                        {dashboardAccountEmail || savedEmail || formData.email || '-'}
                      </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {dashboardAccountId
                            ? (locale === 'ar' ? 'يمكنك الآن تعديل الصلاحيات أو إرسال الدعوة.' : 'You can edit permissions or resend the invite now.')
                          : (locale === 'ar'
                            ? 'إذا كان البريد المستخدم مرتبطاً بحساب المركز، ستحتاج إلى بريد مختلف لإنشاء حساب لوحة التحكم.'
                            : 'If this email is already used by the tenant account, you will need a different email to create the dashboard account.')}
                        </div>
                      </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleDashboardInvite}
                        disabled={dashboardInviteLoading}
                        className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {dashboardInviteLoading
                          ? (locale === 'ar' ? 'جارٍ الإرسال...' : 'Sending...')
                          : (locale === 'ar' ? 'إرسال دعوة' : 'Send invite')}
                    </button>
                      <button
                        type="button"
                        onClick={handleDashboardResetPassword}
                        disabled={dashboardResetLoading}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {dashboardResetLoading
                          ? (locale === 'ar' ? 'جارٍ التحديث...' : 'Updating...')
                          : (locale === 'ar' ? 'إعادة كلمة المرور' : 'Reset password')}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {locale === 'ar' ? 'صلاحيات الأقسام' : 'Section permissions'}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {locale === 'ar'
                            ? 'تُستخدم هذه الصلاحيات لحسابات لوحة التحكم فقط.'
                            : 'These permissions apply to dashboard accounts only.'}
                        </p>
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
                              onChange={(event) => handleDashboardPermissionChange(key, event.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
        </div>
        </div>

      </form>
      </EmployeeEditorFrame>
    </TenantLayout>
  );
}
