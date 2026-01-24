"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BRANDING } from "@/config/branding";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const { register } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        gender: "" as "male" | "female" | "other" | "",
    });

    const validateForm = () => {
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError("Please enter a valid email address");
            return false;
        }

        // Phone validation (Saudi format)
        const phoneRegex = /^\+966[0-9]{9}$|^0[0-9]{9}$/;
        if (!phoneRegex.test(formData.phone.replace(/\s/g, ""))) {
            setError("Please enter a valid Saudi phone number (+966XXXXXXXXX or 05XXXXXXXX)");
            return false;
        }

        // Password validation
        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters long");
            return false;
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            setError("Password must contain at least one uppercase letter, one lowercase letter, and one number");
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return false;
        }

        // Name validation
        if (formData.firstName.length < 2) {
            setError("First name must be at least 2 characters");
            return false;
        }

        if (formData.lastName.length < 2) {
            setError("Last name must be at least 2 characters");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            // Format phone number
            let phone = formData.phone.replace(/\s/g, "");
            if (phone.startsWith("0")) {
                phone = "+966" + phone.substring(1);
            } else if (!phone.startsWith("+966")) {
                phone = "+966" + phone;
            }

            // Check if there's a return URL (from tenant page)
            const returnUrl = typeof window !== 'undefined' 
                ? sessionStorage.getItem('rifah_return_after_register')
                : null;
            
            await register({
                email: formData.email.trim(),
                phone,
                password: formData.password,
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                dateOfBirth: formData.dateOfBirth || undefined,
                gender: formData.gender || undefined,
            }, { skipRedirect: false }); // Will use returnUrl if available
        } catch (err: any) {
            setError(err.message || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 relative">
            {/* Language Switcher - Top Right */}
            <div className="absolute top-4 end-4">
                <LanguageSwitcher variant="toggle" />
            </div>

            <div className="w-full max-w-md">
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-primary mb-2">
                            {t("auth.createYourAccount")}
                        </h1>
                        <p className="text-gray-600">{t("auth.registerSubtitle")}</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Registration Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t("auth.firstName")} *
                                </label>
                                <input
                                    id="firstName"
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Ahmed"
                                />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t("auth.lastName")} *
                                </label>
                                <input
                                    id="lastName"
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Al-Saud"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("auth.email")} *
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="ahmed@example.com"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("auth.phone")} *
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                required
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="+966 50 123 4567"
                            />
                            <p className="mt-1 text-xs text-gray-500">Saudi format: +966XXXXXXXXX or 05XXXXXXXX</p>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("auth.password")} *
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="••••••••"
                            />
                            <p className="mt-1 text-xs text-gray-500">Min 8 chars, 1 uppercase, 1 lowercase, 1 number</p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("auth.confirmPassword")} *
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Optional Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t("profile.dateOfBirth")}
                                </label>
                                <input
                                    id="dateOfBirth"
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t("profile.gender")}
                                </label>
                                <select
                                    id="gender"
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="">{t("profile.selectGender")}</option>
                                    <option value="male">{t("profile.male")}</option>
                                    <option value="female">{t("profile.female")}</option>
                                    <option value="other">{t("profile.other")}</option>
                                </select>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                        >
                            {loading ? t("common.loading") : t("auth.createAccount")}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            {t("auth.hasAccount")}{" "}
                            <Link href="/login" className="text-primary font-semibold hover:underline">
                                {t("auth.signIn")}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

