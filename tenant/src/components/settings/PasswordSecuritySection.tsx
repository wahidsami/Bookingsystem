"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { tenantApi } from "@/lib/api";

export function PasswordSecuritySection() {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error(locale === "ar" ? "الرجاء تعبئة جميع الحقول" : "Please fill all fields");
      }

      if (newPassword.length < 8) {
        throw new Error(locale === "ar" ? "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" : "New password must be at least 8 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error(locale === "ar" ? "تأكيد كلمة المرور غير مطابق" : "Password confirmation does not match");
      }

      setSaving(true);
      const response = await tenantApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (!response?.success) {
        throw new Error(response?.message || (locale === "ar" ? "تعذر تغيير كلمة المرور" : "Failed to change password"));
      }

      resetForm();
      setSuccess(response.message || (locale === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully"));
    } catch (err: any) {
      setError(err?.message || (locale === "ar" ? "تعذر تغيير كلمة المرور" : "Failed to change password"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
          {locale === "ar" ? "أمان الحساب" : "Account Security"}
        </h2>
        <p className="mt-1 text-sm text-gray-500" style={{ textAlign: isRTL ? "right" : "left" }}>
          {locale === "ar"
            ? "يمكن لمدير لوحة التحكم تغيير كلمة المرور من هنا."
            : "Dashboard admins can update their password from here."}
        </p>
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

      <div className="grid grid-cols-1 gap-4 md:max-w-xl">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? "right" : "left" }}>
            {locale === "ar" ? "كلمة المرور الحالية" : "Current password"}
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? "right" : "left" }}>
            {locale === "ar" ? "كلمة المرور الجديدة" : "New password"}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? "right" : "left" }}>
            {locale === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm new password"}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving
            ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
            : (locale === "ar" ? "تحديث كلمة المرور" : "Update Password")}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={saving}
          className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {locale === "ar" ? "مسح" : "Clear"}
        </button>
      </div>
    </div>
  );
}
