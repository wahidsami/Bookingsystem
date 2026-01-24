"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

interface UserProfile {
    id: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    profileImage?: string;
    preferredLanguage: string;
    notificationPreferences: {
        email: boolean;
        sms: boolean;
        whatsapp: boolean;
        push: boolean;
    };
    addressStreet?: string;
    addressCity?: string;
    addressBuilding?: string;
    addressFloor?: string;
    addressApartment?: string;
    addressPhone?: string;
    addressNotes?: string;
}

function ProfileContent() {
    const { user, refreshUser } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        gender: "",
        preferredLanguage: "en",
        notificationPreferences: {
            email: true,
            sms: true,
            whatsapp: true,
            push: true,
        },
        addressStreet: "",
        addressCity: "",
        addressBuilding: "",
        addressFloor: "",
        addressApartment: "",
        addressPhone: "",
        addressNotes: "",
    });

    const notificationLabels: Record<string, string> = {
        email: t("profile.emailNotifications"),
        sms: t("profile.smsNotifications"),
        whatsapp: t("profile.whatsappNotifications"),
        push: t("profile.pushNotifications"),
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const response = await api.get<{ success: boolean; user: UserProfile }>("/users/profile");
            if (response.success && response.user) {
                setProfile(response.user);
                setFormData({
                    firstName: response.user.firstName || "",
                    lastName: response.user.lastName || "",
                    dateOfBirth: response.user.dateOfBirth || "",
                    gender: response.user.gender || "",
                    preferredLanguage: response.user.preferredLanguage || "en",
                    notificationPreferences: response.user.notificationPreferences || {
                        email: true,
                        sms: true,
                        whatsapp: true,
                        push: true,
                    },
                    addressStreet: response.user.addressStreet || "",
                    addressCity: response.user.addressCity || "",
                    addressBuilding: response.user.addressBuilding || "",
                    addressFloor: response.user.addressFloor || "",
                    addressApartment: response.user.addressApartment || "",
                    addressPhone: response.user.addressPhone || "",
                    addressNotes: response.user.addressNotes || "",
                });
            }
        } catch (error) {
            console.error("Failed to load profile:", error);
            setMessage({ type: 'error', text: 'Failed to load profile' });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const response = await api.put<{ success: boolean; user: UserProfile }>("/users/profile", formData);
            if (response.success) {
                setProfile(response.user);
                await refreshUser();
                setMessage({ type: 'success', text: 'Profile updated successfully' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Please select an image file' });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
            return;
        }

        setPhotoUploading(true);
        setMessage(null);

        try {
            const formData = new FormData();
            formData.append('photo', file);

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/users/profile/photo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('rifah_access_token')}`,
                },
                body: formData,
            });

            const data = await response.json();
            if (data.success) {
                setProfile(prev => prev ? { ...prev, profileImage: data.profileImage } : null);
                await refreshUser();
                setMessage({ type: 'success', text: 'Profile photo uploaded successfully' });
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to upload photo' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to upload photo' });
        } finally {
            setPhotoUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${
                        message.type === 'success' 
                            ? 'bg-green-50 border border-green-200 text-green-700' 
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    {/* Profile Photo */}
                    <div className="mb-8">
                        <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                            {t("profile.profilePhoto")}
                        </label>
                        <div className={`flex items-center gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className="relative">
                                {profile?.profileImage ? (
                                    <img
                                        src={`http://localhost:5000${profile.profileImage}`}
                                        alt="Profile"
                                        className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
                                        onError={(e) => {
                                            console.error('Image load error:', profile.profileImage);
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-primary/20">
                                        <span className="text-3xl text-gray-400">
                                            {profile?.firstName?.[0] || 'U'}
                                        </span>
                                    </div>
                                )}
                                {photoUploading && (
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                    </div>
                                )}
                            </div>
                            <div className={isRTL ? 'text-end' : ''}>
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                        disabled={photoUploading}
                                    />
                                    <span className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors inline-block">
                                        {photoUploading ? t("profile.uploading") : t("profile.uploadPhoto")}
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1">{t("profile.photoHint")}</p>
                            </div>
                        </div>
                    </div>

                    {/* Profile Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                    {t("auth.firstName")}
                                </label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                    required
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                    {t("auth.lastName")}
                                </label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                    required
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                    {t("profile.dateOfBirth")}
                                </label>
                                <input
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                    {t("profile.gender")}
                                </label>
                                <select
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                >
                                    <option value="">{t("profile.selectGender")}</option>
                                    <option value="male">{t("profile.male")}</option>
                                    <option value="female">{t("profile.female")}</option>
                                    <option value="other">{t("profile.other")}</option>
                                </select>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                    {t("profile.preferredLanguage")}
                                </label>
                                <select
                                    value={formData.preferredLanguage}
                                    onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                >
                                    <option value="en">{t("profile.english")}</option>
                                    <option value="ar">{t("profile.arabic")}</option>
                                </select>
                            </div>
                        </div>

                        {/* Address Information */}
                        <div className="border-t border-gray-200 pt-6 mt-6">
                            <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-end' : ''}`}>
                                {t("profile.deliveryAddress")}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("profile.streetAddress")}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.addressStreet}
                                        onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                        placeholder={t("profile.streetAddressPlaceholder")}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("profile.city")}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.addressCity}
                                        onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                        placeholder={t("profile.cityPlaceholder")}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("profile.building")}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.addressBuilding}
                                        onChange={(e) => setFormData({ ...formData, addressBuilding: e.target.value })}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                        placeholder={t("profile.buildingPlaceholder")}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("profile.floor")}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.addressFloor}
                                        onChange={(e) => setFormData({ ...formData, addressFloor: e.target.value })}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                        placeholder={t("profile.floorPlaceholder")}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("profile.apartment")}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.addressApartment}
                                        onChange={(e) => setFormData({ ...formData, addressApartment: e.target.value })}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                        placeholder={t("profile.apartmentPlaceholder")}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("profile.deliveryPhone")}
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.addressPhone}
                                        onChange={(e) => setFormData({ ...formData, addressPhone: e.target.value })}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                        placeholder={t("profile.deliveryPhonePlaceholder")}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("profile.deliveryNotes")}
                                    </label>
                                    <textarea
                                        value={formData.addressNotes}
                                        onChange={(e) => setFormData({ ...formData, addressNotes: e.target.value })}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                        placeholder={t("profile.deliveryNotesPlaceholder")}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Notification Preferences */}
                        <div className="border-t border-gray-200 pt-6 mt-6">
                            <label className={`block text-sm font-medium text-gray-700 mb-3 ${isRTL ? 'text-end' : ''}`}>
                                {t("profile.notificationPreferences")}
                            </label>
                            <div className="space-y-2">
                                {Object.entries(formData.notificationPreferences).map(([key, value]) => (
                                    <label key={key} className={`flex items-center ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={value}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                notificationPreferences: {
                                                    ...formData.notificationPreferences,
                                                    [key]: e.target.checked
                                                }
                                            })}
                                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                        />
                                        <span className={`text-sm text-gray-700 ${isRTL ? 'me-2' : 'ms-2'}`}>{notificationLabels[key]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className={`flex gap-4 pt-4 ${isRTL ? 'justify-end' : ''}`}>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {saving ? t("profile.saving") : t("profile.saveChanges")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileContent />
        </ProtectedRoute>
    );
}

