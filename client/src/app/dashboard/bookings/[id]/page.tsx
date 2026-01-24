"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api, Appointment } from "@/lib/api";
import { Currency } from "@/components/Currency";
import Link from "next/link";

function BookingDetailsContent() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const [booking, setBooking] = useState<Appointment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const bookingId = params.id as string;

    useEffect(() => {
        if (bookingId) {
            loadBookingDetails();
        }
    }, [bookingId]);

    const loadBookingDetails = async () => {
        try {
            setError(null);
            setLoading(true);
            const response = await api.get<{ success: boolean; appointment: Appointment }>(
                `/bookings/${bookingId}`
            );
            if (response.success && response.appointment) {
                setBooking(response.appointment);
            } else {
                setError("Booking not found");
            }
        } catch (error: any) {
            console.error("Failed to load booking:", error);
            setError(error.message || "Failed to load booking details");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel this booking?")) return;

        try {
            setCancelling(true);
            await api.patch(`/bookings/${bookingId}/cancel`);
            // Reload booking to get updated status
            await loadBookingDetails();
            alert("Booking cancelled successfully");
        } catch (error: any) {
            alert(error.message || "Failed to cancel booking");
        } finally {
            setCancelling(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(locale === 'ar' ? "ar-SA" : "en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString(locale === 'ar' ? "ar-SA" : "en-US", {
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
            case "no_show": return "No Show";
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed":
                return "bg-green-100 text-green-800 border-green-300";
            case "pending":
                return "bg-yellow-100 text-yellow-800 border-yellow-300";
            case "completed":
                return "bg-blue-100 text-blue-800 border-blue-300";
            case "cancelled":
                return "bg-red-100 text-red-800 border-red-300";
            case "no_show":
                return "bg-gray-100 text-gray-800 border-gray-300";
            default:
                return "bg-gray-100 text-gray-800 border-gray-300";
        }
    };

    const getPaymentStatusText = (status: string) => {
        switch (status) {
            case "paid": return "Paid";
            case "pending": return "Pending";
            case "refunded": return "Refunded";
            case "partially_refunded": return "Partially Refunded";
            default: return status;
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="max-w-4xl mx-auto">
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-gray-600">{t("common.loading")}</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !booking) {
        return (
            <DashboardLayout>
                <div className="max-w-4xl mx-auto">
                    <div className="p-8 text-center">
                        <p className="text-red-600 mb-4">{error || "Booking not found"}</p>
                        <Link
                            href="/dashboard/bookings"
                            className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Back to Bookings
                        </Link>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {/* Back Button */}
                <div className="mb-6">
                    <Link
                        href="/dashboard/bookings"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-5 h-5 arrow-back" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>{locale === 'ar' ? 'العودة إلى الحجوزات' : 'Back to Bookings'}</span>
                    </Link>
                </div>

                {/* Booking Header */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                {locale === 'ar' ? (booking.service?.name_ar || booking.service?.name_en) : booking.service?.name_en || t("bookings.service")}
                            </h1>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(booking.status)}`}>
                                {getStatusText(booking.status)}
                            </span>
                        </div>
                        {booking.status === "confirmed" && (
                            <button
                                onClick={handleCancel}
                                disabled={cancelling}
                                className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {cancelling ? "Cancelling..." : t("bookings.cancelBooking")}
                            </button>
                        )}
                    </div>
                </div>

                {/* Booking Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Service Information */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {locale === 'ar' ? 'معلومات الخدمة' : 'Service Information'}
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-600">{locale === 'ar' ? 'الخدمة:' : 'Service:'}</span>
                                <p className="text-gray-900 mt-1">
                                    {locale === 'ar' ? (booking.service?.name_ar || booking.service?.name_en) : booking.service?.name_en}
                                </p>
                            </div>
                            {booking.service?.description_en && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'الوصف:' : 'Description:'}</span>
                                    <p className="text-gray-700 mt-1">
                                        {locale === 'ar' ? booking.service?.description_ar : booking.service?.description_en}
                                    </p>
                                </div>
                            )}
                            {booking.service?.duration && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'المدة:' : 'Duration:'}</span>
                                    <p className="text-gray-900 mt-1">{booking.service.duration} {locale === 'ar' ? 'دقيقة' : 'minutes'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Staff Information */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {locale === 'ar' ? 'معلومات الموظف' : 'Staff Information'}
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-600">{t("bookings.staff")}:</span>
                                <p className="text-gray-900 mt-1">{booking.staff?.name || "N/A"}</p>
                            </div>
                            {booking.staff?.rating && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'التقييم:' : 'Rating:'}</span>
                                    <p className="text-gray-900 mt-1">
                                        ⭐ {Number(booking.staff.rating).toFixed(1)} / 5.0
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {locale === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-600">{locale === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                                <p className="text-gray-900 mt-1">{formatDate(booking.startTime)}</p>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">{locale === 'ar' ? 'وقت البدء:' : 'Start Time:'}</span>
                                <p className="text-gray-900 mt-1">{formatTime(booking.startTime)}</p>
                            </div>
                            <div>
                                <span className="font-medium text-gray-600">{locale === 'ar' ? 'وقت الانتهاء:' : 'End Time:'}</span>
                                <p className="text-gray-900 mt-1">{formatTime(booking.endTime)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {locale === 'ar' ? 'معلومات الدفع' : 'Payment Information'}
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-600">{t("bookings.price")}:</span>
                                <p className="text-primary font-bold text-lg mt-1">
                                    <Currency amount={parseFloat(booking.price.toString())} locale={locale} />
                                </p>
                            </div>
                            {booking.paymentStatus && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'حالة الدفع:' : 'Payment Status:'}</span>
                                    <p className="text-gray-900 mt-1">{getPaymentStatusText(booking.paymentStatus)}</p>
                                </div>
                            )}
                            {booking.paymentMethod && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}</span>
                                    <p className="text-gray-900 mt-1">{booking.paymentMethod}</p>
                                </div>
                            )}
                            {booking.paidAt && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'تاريخ الدفع:' : 'Paid At:'}</span>
                                    <p className="text-gray-900 mt-1">{formatDate(booking.paidAt)} {formatTime(booking.paidAt)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Additional Information */}
                {(booking.notes || booking.tenant) && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {locale === 'ar' ? 'معلومات إضافية' : 'Additional Information'}
                        </h2>
                        <div className="space-y-3 text-sm">
                            {booking.tenant && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'الصالون:' : 'Salon:'}</span>
                                    <p className="text-gray-900 mt-1">{booking.tenant.name || "N/A"}</p>
                                </div>
                            )}
                            {booking.notes && (
                                <div>
                                    <span className="font-medium text-gray-600">{locale === 'ar' ? 'ملاحظات:' : 'Notes:'}</span>
                                    <p className="text-gray-700 mt-1">{booking.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Booking ID (for reference) */}
                <div className="mt-6 text-center text-xs text-gray-500">
                    {locale === 'ar' ? 'معرف الحجز:' : 'Booking ID:'} {booking.id}
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function BookingDetailsPage() {
    return (
        <ProtectedRoute>
            <BookingDetailsContent />
        </ProtectedRoute>
    );
}
