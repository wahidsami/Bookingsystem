"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api, Appointment } from "@/lib/api";
import { Currency } from "@/components/Currency";

type BookingTab = 'upcoming' | 'completed' | 'cancelled';

function BookingsContent() {
    const router = useRouter();
    const { user } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const [allBookings, setAllBookings] = useState<Appointment[]>([]);
    const [bookings, setBookings] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<BookingTab>('upcoming');
    const [filters, setFilters] = useState({
        startDate: "",
        endDate: "",
        tenantId: "",
    });

    useEffect(() => {
        loadBookings();
    }, [filters]);

    // Filter bookings based on active tab
    useEffect(() => {
        const now = new Date();
        let filtered = [...allBookings];

        // Filter by tab
        switch (activeTab) {
            case 'upcoming':
                // Upcoming: pending or confirmed bookings with startTime in the future
                filtered = allBookings.filter(booking => {
                    const startTime = new Date(booking.startTime);
                    return (
                        (booking.status === 'pending' || booking.status === 'confirmed') &&
                        startTime >= now
                    );
                });
                break;
            case 'completed':
                filtered = allBookings.filter(booking => booking.status === 'completed');
                break;
            case 'cancelled':
                filtered = allBookings.filter(booking => booking.status === 'cancelled');
                break;
        }

        // Sort: upcoming by startTime ascending, others by startTime descending
        filtered.sort((a, b) => {
            const dateA = new Date(a.startTime).getTime();
            const dateB = new Date(b.startTime).getTime();
            return activeTab === 'upcoming' ? dateA - dateB : dateB - dateA;
        });

        setBookings(filtered);
    }, [activeTab, allBookings]);

    const loadBookings = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            // Load all bookings, we'll filter by tab client-side
            if (filters.startDate) params.append("startDate", filters.startDate);
            if (filters.endDate) params.append("endDate", filters.endDate);
            if (filters.tenantId) params.append("tenantId", filters.tenantId);

            const response = await api.get<{ success: boolean; bookings: Appointment[] }>(
                `/users/bookings?${params.toString()}`
            );
            if (response.success) {
                setAllBookings(response.bookings || []);
            }
        } catch (error) {
            console.error("Failed to load bookings:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(locale === 'ar' ? "ar-SA" : "en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
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

    const handleCancel = async (bookingId: string) => {
        if (!confirm("Are you sure you want to cancel this booking?")) return;

        try {
            await api.patch(`/bookings/${bookingId}/cancel`);
            loadBookings();
        } catch (error) {
            alert("Failed to cancel booking");
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto">
                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="flex gap-4 px-6">
                            <button
                                onClick={() => setActiveTab('upcoming')}
                                className={`px-4 py-4 font-medium text-sm border-b-2 transition-colors ${
                                    activeTab === 'upcoming'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {t("bookings.upcoming")}
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`px-4 py-4 font-medium text-sm border-b-2 transition-colors ${
                                    activeTab === 'completed'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {t("bookings.completed")}
                            </button>
                            <button
                                onClick={() => setActiveTab('cancelled')}
                                className={`px-4 py-4 font-medium text-sm border-b-2 transition-colors ${
                                    activeTab === 'cancelled'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {t("bookings.cancelled")}
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("common.filter")}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{locale === 'ar' ? 'تاريخ البداية' : 'Start Date'}</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{locale === 'ar' ? 'تاريخ النهاية' : 'End Date'}</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setFilters({ startDate: "", endDate: "", tenantId: "" })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                {locale === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bookings List */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900">{t("bookings.title")}</h2>
                        <p className="text-gray-600 text-sm mt-1">
                            {bookings.length} {locale === 'ar' ? 'حجز' : (bookings.length !== 1 ? "bookings" : "booking")} {locale === 'ar' ? 'موجود' : 'found'}
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-gray-600">{t("common.loading")}</p>
                        </div>
                    ) : bookings.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-600">{t("bookings.noBookings")}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {bookings.map((booking) => (
                                <div 
                                    key={booking.id} 
                                    className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {locale === 'ar' ? (booking.Service?.name_ar || booking.Service?.name_en) : booking.Service?.name_en || t("bookings.service")}
                                                </h3>
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                        booking.status
                                                    )}`}
                                                >
                                                    {getStatusText(booking.status)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                                                <div>
                                                    <span className="font-medium">{t("bookings.staff")}:</span>{" "}
                                                    {booking.Staff?.name || "N/A"}
                                                </div>
                                                <div>
                                                    <span className="font-medium">{t("bookings.date")} & {t("bookings.time")}:</span>{" "}
                                                    {formatDate(booking.startTime)}
                                                </div>
                                                <div>
                                                    <span className="font-medium">{locale === 'ar' ? 'الصالون' : 'Salon'}:</span>{" "}
                                                    {booking.tenant?.name || "N/A"}
                                                </div>
                                                <div>
                                                    <span className="font-medium">{t("bookings.price")}:</span>{" "}
                                                    <span className="font-semibold text-primary">
                                                        <Currency amount={parseFloat(booking.price.toString())} locale={locale} />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ms-4">
                                            {booking.status === "confirmed" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent card click
                                                        handleCancel(booking.id);
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

export default function BookingsPage() {
    return (
        <ProtectedRoute>
            <BookingsContent />
        </ProtectedRoute>
    );
}

