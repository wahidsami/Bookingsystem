"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api, Appointment, Tenant } from "@/lib/api";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function DashboardContent() {
    const { user } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [bookings, setBookings] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalBookings: 0,
        upcomingBookings: 0,
        totalSpent: 0,
    });
    const [successMessage, setSuccessMessage] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (searchParams.get("booking") === "success") {
            setSuccessMessage(t("booking.bookingConfirmedMessage"));
            // Clear the query param
            router.replace("/dashboard");
            // Clear message after 5 seconds
            setTimeout(() => setSuccessMessage(""), 5000);
        }
        loadBookings();
    }, []);

    const loadBookings = async () => {
        try {
            setError(null);
            setLoading(true);
            const response = await api.get<{ success: boolean; appointments: Appointment[] }>("/bookings");
            if (response.success) {
                setBookings(response.appointments || []);
                
                // Calculate stats
                const upcoming = response.appointments.filter(
                    (apt) => new Date(apt.startTime) > new Date() && apt.status !== "cancelled"
                );
                
                const totalSpent = response.appointments
                    .filter((apt) => apt.status === "completed")
                    .reduce((sum, apt) => sum + parseFloat(apt.price.toString()), 0);

                setStats({
                    totalBookings: response.appointments.length,
                    upcomingBookings: upcoming.length,
                    totalSpent,
                });
            }
        } catch (error: any) {
            console.error("Failed to load bookings:", error);
            setError(
                error.message || t("errors.networkError") || "Failed to connect to the server. Please ensure the backend is running."
            );
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(locale === 'ar' ? "ar-SA" : "en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "confirmed": return t("bookings.confirmed");
            case "pending": return t("bookings.pending");
            case "completed": return t("bookings.completed");
            case "cancelled": return t("bookings.cancelled");
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed":
                return "bg-green-100 text-green-800";
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "completed":
                return "bg-blue-100 text-blue-800";
            case "cancelled":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto">
                {/* Success Message */}
                {successMessage && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                        {successMessage}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div 
                            className="flex items-center justify-between"
                            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                <p className="text-gray-600 text-sm font-medium">{t("dashboard.totalBookings")}</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {stats.totalBookings}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">📅</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div 
                            className="flex items-center justify-between"
                            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                <p className="text-gray-600 text-sm font-medium">{t("dashboard.upcomingBookings")}</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {stats.upcomingBookings}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">✓</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div 
                            className="flex items-center justify-between"
                            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                <p className="text-gray-600 text-sm font-medium">{t("dashboard.totalSpent")}</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    <Currency amount={stats.totalSpent} locale={locale} />
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">💰</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <div className="text-3xl">⚠️</div>
                            <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                <h3 className="font-bold text-red-900 mb-2">
                                    {locale === 'ar' ? 'خطأ في الاتصال' : 'Connection Error'}
                                </h3>
                                <p className="text-red-700 mb-4">{error}</p>
                                <div className="text-sm text-red-600 mb-4">
                                    <p className="font-medium mb-2">
                                        {locale === 'ar' ? 'يرجى التأكد من:' : 'Please ensure:'}
                                    </p>
                                    <ul className="list-disc list-inside space-y-1" style={{ marginLeft: isRTL ? 0 : '1rem', marginRight: isRTL ? '1rem' : 0 }}>
                                        <li>{locale === 'ar' ? 'Docker Desktop يعمل' : 'Docker Desktop is running'}</li>
                                        <li>{locale === 'ar' ? 'خادم الواجهة الخلفية يعمل' : 'Backend server is running'}</li>
                                    </ul>
                                </div>
                                <button
                                    onClick={loadBookings}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    {locale === 'ar' ? 'إعادة المحاولة' : 'Retry Connection'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bookings List */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                    <div className="p-6 border-b border-gray-200" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <h2 className="text-xl font-bold text-gray-900">{t("bookings.title")}</h2>
                        <p className="text-gray-600 text-sm mt-1">
                            {locale === 'ar' ? 'جميع مواعيدك في جميع الصالونات' : 'All your appointments across all salons'}
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-gray-600">{t("common.loading")}</p>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-600 mb-4">
                                {locale === 'ar' ? 'لا يمكن تحميل الحجوزات في الوقت الحالي' : 'Unable to load bookings at this time'}
                            </p>
                        </div>
                    ) : bookings.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-600 mb-4">{t("dashboard.noUpcomingBookings")}</p>
                            <Link
                                href="/tenants"
                                className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                {t("nav.browseSalons")}
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {bookings.map((booking) => (
                                <div 
                                    key={booking.id} 
                                    className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                                >
                                    <div 
                                        className="flex items-start justify-between"
                                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                                    >
                                        <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                            <div 
                                                className="flex items-center gap-3 mb-2"
                                                style={{ 
                                                    flexDirection: isRTL ? 'row-reverse' : 'row',
                                                    justifyContent: isRTL ? 'flex-end' : 'flex-start'
                                                }}
                                            >
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {locale === 'ar' ? (booking.Service?.name_ar || booking.Service?.name_en) : booking.Service?.name_en || t("bookings.service")}
                                                </h3>
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                        booking.status
                                                    )}`}
                                                >
                                                    {getStatusText(booking.status)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <p>
                                                    <span className="font-medium">{t("bookings.staff")}:</span>{" "}
                                                    {booking.Staff?.name || "N/A"}
                                                </p>
                                                <p>
                                                    <span className="font-medium">{t("bookings.date")} & {t("bookings.time")}:</span>{" "}
                                                    {formatDate(booking.startTime)}
                                                </p>
                                                <p>
                                                    <span className="font-medium">{t("bookings.price")}:</span>{" "}
                                                    <Currency amount={parseFloat(booking.price.toString())} locale={locale} />
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2" style={{ marginLeft: isRTL ? 0 : '1rem', marginRight: isRTL ? '1rem' : 0 }}>
                                            {booking.status === "confirmed" && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation(); // Prevent card click
                                                        if (!confirm("Are you sure you want to cancel this booking?")) return;
                                                        try {
                                                            await api.patch(`/bookings/${booking.id}/cancel`);
                                                            loadBookings();
                                                        } catch (error) {
                                                            alert(t("errors.networkError"));
                                                        }
                                                    }}
                                                    className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                                                >
                                                    {t("bookings.cancelBooking")}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function DashboardPage() {
    return (
        <ProtectedRoute>
            <DashboardContent />
        </ProtectedRoute>
    );
}

