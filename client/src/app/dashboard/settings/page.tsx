"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

function SettingsContent() {
    const { user, refreshUser } = useAuth();
    const { t, locale, isRTL, setLocale } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [settings, setSettings] = useState({
        preferredLanguage: "en",
        notificationPreferences: {
            email: true,
            sms: true,
            whatsapp: true,
            push: true,
        },
    });

    useEffect(() => {
        if (user) {
            setSettings({
                preferredLanguage: user.preferredLanguage || "en",
                notificationPreferences: user.notificationPreferences || {
                    email: true,
                    sms: true,
                    whatsapp: true,
                    push: true,
                },
            });
        }
    }, [user]);

    const handleSave = async () => {
        setLoading(true);
        setMessage(null);

        try {
            const response = await api.put<{ success: boolean }>("/users/profile", {
                preferredLanguage: settings.preferredLanguage,
                notificationPreferences: settings.notificationPreferences,
            });

            if (response.success) {
                await refreshUser();
                setMessage({ type: "success", text: "Settings saved successfully" });
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to save settings" });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const currentPassword = formData.get("currentPassword") as string;
        const newPassword = formData.get("newPassword") as string;
        const confirmPassword = formData.get("confirmPassword") as string;

        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "New passwords do not match" });
            return;
        }

        if (newPassword.length < 8) {
            setMessage({ type: "error", text: "Password must be at least 8 characters long" });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await api.put<{ success: boolean }>("/users/password", {
                currentPassword,
                newPassword,
            });

            if (response.success) {
                setMessage({ type: "success", text: "Password changed successfully" });
                e.currentTarget.reset();
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to change password" });
        } finally {
            setLoading(false);
        }
    };

    const notificationLabels: Record<string, string> = {
        email: t("profile.emailNotifications"),
        sms: t("profile.smsNotifications"),
        whatsapp: t("profile.whatsappNotifications"),
        push: t("profile.pushNotifications"),
    };

    const handleLanguageChange = (newLang: string) => {
        setSettings({ ...settings, preferredLanguage: newLang });
        setLocale(newLang as 'en' | 'ar');
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {message && (
                    <div
                        className={`mb-6 p-4 rounded-lg ${
                            message.type === "success"
                                ? "bg-green-50 border border-green-200 text-green-700"
                                : "bg-red-50 border border-red-200 text-red-700"
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                {/* Language Settings */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.language")}</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t("profile.preferredLanguage")}</label>
                        <select
                            value={settings.preferredLanguage}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            <option value="en">{t("profile.english")}</option>
                            <option value="ar">{t("profile.arabic")}</option>
                        </select>
                    </div>
                    <div className="mt-4">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {locale === 'ar' ? 'حفظ إعدادات اللغة' : 'Save Language Settings'}
                        </button>
                    </div>
                </div>

                {/* Notification Preferences */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("profile.notificationPreferences")}</h3>
                    <div className="space-y-3">
                        {Object.entries(settings.notificationPreferences).map(([key, value]) => (
                            <label key={key} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{notificationLabels[key]}</span>
                                <input
                                    type="checkbox"
                                    checked={value}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            notificationPreferences: {
                                                ...settings.notificationPreferences,
                                                [key]: e.target.checked,
                                            },
                                        })
                                    }
                                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                />
                            </label>
                        ))}
                    </div>
                    <div className="mt-4">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {locale === 'ar' ? 'حفظ إعدادات الإشعارات' : 'Save Notification Settings'}
                        </button>
                    </div>
                </div>

                {/* Change Password */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.changePassword")}</h3>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t("settings.currentPassword")}</label>
                            <input
                                type="password"
                                name="currentPassword"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t("settings.newPassword")}</label>
                            <input
                                type="password"
                                name="newPassword"
                                minLength={8}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">{locale === 'ar' ? 'يجب أن تكون 8 أحرف على الأقل' : 'Must be at least 8 characters long'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t("settings.confirmNewPassword")}</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                minLength={8}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {loading ? t("common.loading") : t("settings.changePassword")}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Account Info */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{locale === 'ar' ? 'معلومات الحساب' : 'Account Information'}</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("auth.email")}:</span>
                            <span className="font-medium text-gray-900">{user?.email}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{t("auth.phone")}:</span>
                            <span className="font-medium text-gray-900">{user?.phone}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">{locale === 'ar' ? 'عضو منذ' : 'Member Since'}:</span>
                            <span className="font-medium text-gray-900">
                                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US') : "N/A"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function SettingsPage() {
    return (
        <ProtectedRoute>
            <SettingsContent />
        </ProtectedRoute>
    );
}

