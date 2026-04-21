"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { tenantApi } from "@/lib/api";
import { getEmployeePositionLabel, isServiceProviderPosition } from "@/lib/employeePositions";
import {
  DASHBOARD_PERMISSION_KEYS,
  ROLE_OPTIONS,
  SECTION_PERMISSION_LABELS,
  normalizeDashboardPermissions
} from "@/lib/dashboardAccess";
import { useTenantAuth } from "@/contexts/TenantAuthContext";

type DashboardAccount = {
  id: string;
  displayName: string;
  email: string;
  roleKey: string;
  permissions: Record<string, boolean>;
  isActive: boolean;
  passwordResetRequired?: boolean;
  lastLoginAt?: string | null;
};

type TeamEmployee = {
  id: string;
  name: string;
  email?: string | null;
  position?: string | null;
  isActive?: boolean;
};

const initialForm = {
  displayName: "",
  email: "",
  roleKey: "manager",
  permissions: normalizeDashboardPermissions({}, "manager"),
  isActive: true
};

export function TeamAccessSection() {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { sessionType, permissions } = useTenantAuth();
  const canManageAccounts = sessionType === "tenant_owner" || permissions?.manage_accounts === true;

  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);

  const canTogglePermission = (key: string) => key !== "view_dashboard";

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const [accountsResponse, employeesResponse] = await Promise.all([
        tenantApi.getDashboardAccounts(),
        tenantApi.getEmployees().catch(() => ({ employees: [] }))
      ]);
      setAccounts(Array.isArray(accountsResponse.accounts) ? accountsResponse.accounts : []);
      setEmployees(Array.isArray(employeesResponse.employees) ? employeesResponse.employees : []);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تحميل الحسابات" : "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageAccounts) {
      loadAccounts();
    }
  }, [canManageAccounts]);

  const roleOptions = useMemo(() => ROLE_OPTIONS, []);
  const employeeByEmail = useMemo(() => {
    const map = new Map<string, TeamEmployee>();
    employees.forEach((employee) => {
      if (employee.email) {
        map.set(employee.email.trim().toLowerCase(), employee);
      }
    });
    return map;
  }, [employees]);
  const visibleAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const linkedEmployee = account.email ? employeeByEmail.get(account.email.trim().toLowerCase()) : null;
      return !linkedEmployee || !isServiceProviderPosition(linkedEmployee.position);
    });
  }, [accounts, employeeByEmail]);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm);
    setGeneratedSecret(null);
  };

  const applyRolePreset = (roleKey: string) => {
    setForm((current) => ({
      ...current,
      roleKey,
      permissions: normalizeDashboardPermissions(
        {},
        roleKey as any
      )
    }));
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      setGeneratedSecret(null);

      const payload = {
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        roleKey: form.roleKey,
        permissions: form.permissions,
        isActive: form.isActive
      };

      const response = editingId
        ? await tenantApi.updateDashboardAccount(editingId, payload)
        : await tenantApi.createDashboardAccount(payload);

      if (!response?.success) {
        throw new Error(response?.message || (locale === "ar" ? "تعذر حفظ الحساب" : "Failed to save account"));
      }

      await loadAccounts();
      resetForm();
      if (response.temporaryPassword) {
        setGeneratedSecret(response.temporaryPassword);
      }
      setSuccess(response.message || (locale === "ar" ? "تم الحفظ" : "Saved successfully"));
      window.setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر حفظ الحساب" : "Failed to save account"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (account: DashboardAccount) => {
    setEditingId(account.id);
    setGeneratedSecret(null);
    setForm({
      displayName: account.displayName || "",
      email: account.email || "",
      roleKey: account.roleKey || "custom",
      permissions: normalizeDashboardPermissions(account.permissions || {}, account.roleKey as any),
      isActive: account.isActive
    });
  };

  const handleResetPassword = async (accountId: string) => {
    try {
      setSaving(true);
      const response = await tenantApi.resetDashboardAccountPassword(accountId);
      if (response?.temporaryPassword) {
        setGeneratedSecret(response.temporaryPassword);
      }
      await loadAccounts();
      setSuccess(response.message || (locale === "ar" ? "تمت إعادة تعيين كلمة المرور" : "Password reset"));
      window.setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر إعادة التعيين" : "Failed to reset password"));
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async (accountId: string) => {
    try {
      setInviteLoadingId(accountId);
      const response = await tenantApi.sendDashboardAccountInvite(accountId);
      if (response?.temporaryPassword) {
        setGeneratedSecret(response.temporaryPassword);
      }
      await loadAccounts();
      setSuccess(response.message || (locale === "ar" ? "تم إرسال الدعوة" : "Invitation sent"));
      window.setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر إرسال الدعوة" : "Failed to send invitation"));
    } finally {
      setInviteLoadingId(null);
    }
  };

  const handleToggleActive = async (account: DashboardAccount) => {
    try {
      setSaving(true);
      await tenantApi.updateDashboardAccount(account.id, { isActive: !account.isActive });
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تحديث الحالة" : "Failed to update status"));
    } finally {
      setSaving(false);
    }
  };

  if (!canManageAccounts) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
        {locale === "ar"
          ? "لا تملك صلاحية إدارة حسابات الفريق."
          : "You do not have permission to manage team accounts."}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {locale === "ar" ? "الفريق والصلاحيات" : "Team & Access"}
            </h3>
            <p className="text-sm text-gray-500">
              {locale === "ar"
                ? "أنشئ حسابات للمحاسب والاستقبال والتسويق وغيرهم، وحدد الأقسام التي يمكنهم الوصول إليها."
                : "Create login accounts for your team and choose which dashboard sections each person can access."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              loadAccounts();
            }}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {locale === "ar" ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}
      {generatedSecret && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">{locale === "ar" ? "كلمة المرور المؤقتة" : "Temporary password"}</div>
          <div className="mt-1 break-all font-mono text-base">{generatedSecret}</div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-base font-semibold text-gray-900">
                {locale === "ar" ? "الحسابات الحالية" : "Current accounts"}
              </h4>
              <p className="text-xs text-gray-500">
                {locale === "ar"
                  ? `${visibleAccounts.length} حساب`
                  : `${visibleAccounts.length} account(s)`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : visibleAccounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              {locale === "ar"
                ? "لا توجد حسابات فريق حالياً."
                : "No team dashboard accounts yet."}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                {locale === "ar"
                  ? "مقدمو الخدمة تُدار حساباتهم من صفحة الموظف، وتظهر هنا حسابات الفريق الأخرى فقط."
                  : "Service providers are managed from the employee page, while other team accounts appear here."}
              </div>
              {visibleAccounts.map((account) => {
                const linkedEmployee = account.email ? employeeByEmail.get(account.email.trim().toLowerCase()) : null;

                return (
                <div key={account.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-base font-semibold text-gray-900">{account.displayName}</h5>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${account.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                          {account.isActive
                            ? (locale === "ar" ? "نشط" : "Active")
                            : (locale === "ar" ? "غير نشط" : "Disabled")}
                        </span>
                        {account.passwordResetRequired && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                            {locale === "ar" ? "يحتاج تغيير كلمة المرور" : "Password reset required"}
                          </span>
                        )}
                        {linkedEmployee?.position && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
                            {getEmployeePositionLabel(linkedEmployee.position, locale as 'ar' | 'en')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{account.email}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {locale === "ar" ? "الدور" : "Role"}: {ROLE_OPTIONS.find((item) => item.value === account.roleKey)?.[isRTL ? 'labelAr' : 'labelEn'] || account.roleKey}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(account)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {locale === "ar" ? "تعديل" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(account.id)}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        {locale === "ar" ? "إعادة كلمة المرور" : "Reset password"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendInvite(account.id)}
                        disabled={inviteLoadingId === account.id}
                        className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {inviteLoadingId === account.id
                          ? (locale === "ar" ? "جارٍ الإرسال..." : "Sending...")
                          : (locale === "ar" ? "إرسال دعوة" : "Send invite")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(account)}
                        className={`rounded-xl px-3 py-2 text-xs font-medium ${
                          account.isActive
                            ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {account.isActive
                          ? (locale === "ar" ? "تعطيل" : "Disable")
                          : (locale === "ar" ? "تفعيل" : "Enable")}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h4 className="text-base font-semibold text-gray-900">
              {editingId
                ? (locale === "ar" ? "تعديل الحساب" : "Edit account")
                : (locale === "ar" ? "إنشاء حساب جديد" : "Create new account")}
            </h4>
            <p className="text-xs text-gray-500">
              {locale === "ar"
                ? "اختر الدور أو خصص الصلاحيات حسب الأقسام."
                : "Pick a role or fine-tune section access below."}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{locale === "ar" ? "الاسم" : "Display name"}</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{locale === "ar" ? "البريد الإلكتروني" : "Email"}</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{locale === "ar" ? "الدور" : "Role"}</label>
              <select
                value={form.roleKey}
                onChange={(event) => applyRolePreset(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-primary"
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {isRTL ? role.labelAr : role.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900">
                    {locale === "ar" ? "صلاحيات الأقسام" : "Section permissions"}
                  </h5>
                  <p className="text-xs text-gray-500">
                    {locale === "ar" ? "الحسابات المخصصة تبدأ من هنا." : "Custom access starts here."}
                  </p>
                </div>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                {locale === "ar"
                  ? "يتم استخدام هذا القسم للحسابات الإدارية فقط، أما مقدمو الخدمة فتُدار صلاحياتهم من صفحة الموظف."
                  : "This section is for admin/team dashboard accounts only. Service providers are managed from the employee page."}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {DASHBOARD_PERMISSION_KEYS.filter((key) => canTogglePermission(key)).map((key) => {
                  const checked = form.permissions[key] === true;
                  const label = SECTION_PERMISSION_LABELS[key];

                  return (
                    <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                      <span className="text-sm font-medium text-gray-700">
                        {isRTL ? label.ar : label.en}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          permissions: {
                            ...current.permissions,
                            [key]: event.target.checked
                          }
                        }))}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>{locale === "ar" ? "الحساب مفعل" : "Account enabled"}</span>
              </label>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {locale === "ar" ? "إلغاء" : "Clear"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving
                ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                : editingId
                  ? (locale === "ar" ? "حفظ التغييرات" : "Save changes")
                  : (locale === "ar" ? "إنشاء الحساب" : "Create account")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
