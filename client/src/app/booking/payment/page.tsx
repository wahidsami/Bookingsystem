"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingData {
    appointmentId: string;
    amount: number;
    tenantId: string;
    serviceName: string;
    staffName: string;
    dateTime: string;
}

function PaymentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { locale, t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [bookingData, setBookingData] = useState<BookingData | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [formData, setFormData] = useState({
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
        saveCard: false,
    });

    useEffect(() => {
        // Get booking data from query params or session
        const appointmentId = searchParams.get("appointmentId");
        const amount = searchParams.get("amount");
        const tenantId = searchParams.get("tenantId");
        const serviceName = searchParams.get("serviceName");
        const staffName = searchParams.get("staffName");
        const dateTime = searchParams.get("dateTime");

        if (appointmentId && amount && tenantId) {
            setBookingData({
                appointmentId,
                amount: parseFloat(amount),
                tenantId,
                serviceName: serviceName || "Service",
                staffName: staffName || "Staff",
                dateTime: dateTime || "",
            });
        } else {
            setError("Missing booking information");
        }
    }, [searchParams]);

    const formatCardNumber = (value: string) => {
        const cleaned = value.replace(/\s/g, "");
        const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
        return formatted.slice(0, 19); // Max 16 digits + 3 spaces
    };

    const formatExpiryDate = (value: string) => {
        const cleaned = value.replace(/\D/g, "");
        if (cleaned.length >= 2) {
            return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
        }
        return cleaned;
    };

    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatCardNumber(e.target.value);
        setFormData({ ...formData, cardNumber: formatted });
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatExpiryDate(e.target.value);
        setFormData({ ...formData, expiryDate: formatted });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (!bookingData) {
            setError("Booking information missing");
            setLoading(false);
            return;
        }

        try {
            // Validate form data before submitting
            if (!formData.cardNumber || !formData.expiryDate || !formData.cvv || !formData.cardholderName) {
                setError("Please fill in all card details");
                setLoading(false);
                return;
            }

            const response = await api.post<{ success: boolean; transaction: any }>("/payments/process", {
                appointmentId: bookingData.appointmentId,
                amount: bookingData.amount,
                tenantId: bookingData.tenantId,
                cardNumber: formData.cardNumber.replace(/\s/g, ""),
                expiryDate: formData.expiryDate,
                cvv: formData.cvv,
                cardholderName: formData.cardholderName,
                saveCard: formData.saveCard,
            });

            if (response.success) {
                setShowSuccessModal(true);
            } else {
                setError("Payment failed. Please try again.");
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            // Extract error message from response
            const errorMessage = error.message || "Payment failed. Please check your card details and try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!bookingData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || "Loading payment page..."}</p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
            <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                            title="Go back"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Payment</h1>
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Booking Summary */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Service:</span>
                            <span className="font-medium">{bookingData.serviceName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Staff:</span>
                            <span className="font-medium">{bookingData.staffName}</span>
                        </div>
                        {bookingData.dateTime && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Date & Time:</span>
                                <span className="font-medium">{new Date(bookingData.dateTime).toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-gray-200">
                            <span className="text-gray-900 font-semibold">Total Amount:</span>
                            <span className="text-primary font-bold text-lg">
                                <Currency amount={bookingData.amount} locale={locale} />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Payment Form */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Card Details</h2>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Test Card Info */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg shadow-sm">
                        <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                            💳 Test Payment Cards (Demo Mode)
                        </p>
                        <div className="space-y-2">
                            <div className="text-sm bg-white rounded px-3 py-2 border border-blue-200">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-blue-900">4242 4242 4242 4242</span>
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">✓ Visa - Success</span>
                                </div>
                            </div>
                            <div className="text-sm bg-white rounded px-3 py-2 border border-blue-200">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-blue-900">5555 5555 5555 4444</span>
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">✓ Mastercard - Success</span>
                                </div>
                            </div>
                            <div className="text-sm bg-white rounded px-3 py-2 border border-blue-200">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-blue-900">5297 4121 2345 6789</span>
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">✓ Mada - Success</span>
                                </div>
                            </div>
                            <div className="text-sm bg-white rounded px-3 py-2 border border-red-200">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-gray-700">4000 0000 0000 0002</span>
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">✗ Declined</span>
                                </div>
                            </div>
                            <div className="text-sm bg-white rounded px-3 py-2 border border-orange-200">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-gray-700">4000 0000 0000 9995</span>
                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">⚠ Insufficient Funds</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-blue-700 mt-3 font-medium">💡 Use any future expiry date (e.g., 12/28) and any 3-digit CVV</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Card Number
                            </label>
                            <input
                                type="text"
                                value={formData.cardNumber}
                                onChange={handleCardNumberChange}
                                placeholder="4242 4242 4242 4242"
                                maxLength={19}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg tracking-wider"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Expiry Date
                                </label>
                                <input
                                    type="text"
                                    value={formData.expiryDate}
                                    onChange={handleExpiryChange}
                                    placeholder="MM/YY"
                                    maxLength={5}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    CVV
                                </label>
                                <input
                                    type="text"
                                    value={formData.cvv}
                                    onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                                    placeholder="123"
                                    maxLength={4}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cardholder Name
                            </label>
                            <input
                                type="text"
                                value={formData.cardholderName}
                                onChange={(e) => setFormData({ ...formData, cardholderName: e.target.value })}
                                placeholder={user ? `${user.firstName} ${user.lastName}` : "Full Name"}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                required
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="saveCard"
                                checked={formData.saveCard}
                                onChange={(e) => setFormData({ ...formData, saveCard: e.target.checked })}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <label htmlFor="saveCard" className="ml-2 text-sm text-gray-700">
                                Save this card for future payments
                            </label>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold"
                            >
                                {loading ? (locale === 'ar' ? 'جاري المعالجة...' : 'Processing...') : (
                                    <>
                                        {locale === 'ar' ? 'دفع' : 'Pay'} <Currency amount={bookingData.amount} locale={locale} />
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
                        <div className="text-center">
                            {/* Success Icon */}
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                                <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            {/* Success Message */}
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                {locale === 'ar' ? 'تم الدفع بنجاح!' : 'Payment Successful!'}
                            </h2>
                            <p className="text-gray-600 mb-6">
                                {locale === 'ar' 
                                    ? 'تم تأكيد حجزك. ستصلك رسالة تأكيد عبر البريد الإلكتروني قريباً.'
                                    : 'Your booking has been confirmed. You will receive a confirmation email shortly.'
                                }
                            </p>

                            {/* Amount Display */}
                            {bookingData && (
                                <div className="mb-6 p-4 bg-primary/10 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-1">
                                        {locale === 'ar' ? 'المبلغ المدفوع' : 'Amount Paid'}
                                    </p>
                                    <p className="text-2xl font-bold text-primary">
                                        <Currency amount={bookingData.amount} locale={locale} />
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => router.push("/dashboard/bookings")}
                                    className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                                >
                                    {locale === 'ar' ? 'عرض حجوزاتي' : 'View My Bookings'}
                                </button>
                                <button
                                    onClick={() => router.push("/tenants")}
                                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                                >
                                    {locale === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PaymentPage() {
    return (
        <ProtectedRoute>
            <PaymentContent />
        </ProtectedRoute>
    );
}

