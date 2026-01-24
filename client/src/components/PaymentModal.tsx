"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'booking' | 'product';
    orderData: {
        appointmentId?: string;
        orderId?: string;
        amount: number;
        tenantId: string;
        serviceName?: string;
        productName?: string;
        staffName?: string;
        dateTime?: string;
        quantity?: number;
    };
    onSuccess: (transaction: any) => void;
}

export function PaymentModal({
    isOpen,
    onClose,
    type,
    orderData,
    onSuccess
}: PaymentModalProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { locale, t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
        saveCard: false,
    });
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    if (!isOpen) return null;

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

        try {
            if (!formData.cardNumber || !formData.expiryDate || !formData.cvv || !formData.cardholderName) {
                setError("Please fill in all card details");
                setLoading(false);
                return;
            }

            // Use the same endpoint for both booking and product payments
            // The backend will determine the type based on whether appointmentId or orderId is provided
            const paymentPayload: any = {
                amount: orderData.amount,
                tenantId: orderData.tenantId,
                cardNumber: formData.cardNumber.replace(/\s/g, ""),
                expiryDate: formData.expiryDate,
                cvv: formData.cvv,
                cardholderName: formData.cardholderName,
                saveCard: formData.saveCard,
            };

            if (type === 'booking' && orderData.appointmentId) {
                paymentPayload.appointmentId = orderData.appointmentId;
            } else if (type === 'product' && orderData.orderId) {
                paymentPayload.orderId = orderData.orderId;
            }

            const response = await api.post<{ success: boolean; transaction: any }>("/payments/process", paymentPayload);

            if (response.success) {
                setShowSuccessModal(true);
                onSuccess(response.transaction);
            } else {
                setError("Payment failed. Please try again.");
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            setError(error.message || "Payment failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Success modal
    if (showSuccessModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                            <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("payment.successTitle")}</h2>
                        <p className="text-gray-600 mb-6">
                            {type === 'booking' 
                                ? t("payment.bookingSuccessMessage")
                                : t("payment.productOrderSuccessMessage")
                            }
                        </p>
                        <div className="mb-6 p-4 bg-primary/10 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">{t("payment.amountPaid")}</p>
                            <p className="text-2xl font-bold text-primary">
                                <Currency amount={orderData.amount} locale={locale} />
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    onClose();
                                    if (type === 'booking') {
                                        router.push("/dashboard/bookings");
                                    } else {
                                        router.push("/dashboard/purchases");
                                    }
                                }}
                                className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                            >
                                {type === 'booking' ? t("payment.viewMyBookings") : t("payment.viewMyPurchases")}
                            </button>
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    onClose();
                                    // Stay on current page (tenant page) - onClose will handle it
                                }}
                                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                            >
                                {t("payment.backToHome")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Payment</h2>
                        <p className="text-sm text-gray-500">
                            {type === 'booking' ? 'Complete your booking' : 'Complete your purchase'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Order Summary */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                        {type === 'booking' && (
                            <>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Service:</span>
                                        <span className="font-medium text-gray-900">{orderData.serviceName}</span>
                                    </div>
                                    {orderData.staffName && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Staff:</span>
                                            <span className="font-medium text-gray-900">{orderData.staffName}</span>
                                        </div>
                                    )}
                                    {orderData.dateTime && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Date & Time:</span>
                                            <span className="font-medium text-gray-900">
                                                {new Date(orderData.dateTime).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {type === 'product' && (
                            <>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Product:</span>
                                        <span className="font-medium text-gray-900">{orderData.productName}</span>
                                    </div>
                                    {orderData.quantity && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Quantity:</span>
                                            <span className="font-medium text-gray-900">{orderData.quantity}</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-900">Total:</span>
                                <span className="text-2xl font-bold text-primary">
                                    <Currency amount={orderData.amount} locale={locale} />
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Test Card Info */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-2">Test Card Information:</p>
                        <div className="text-xs text-blue-800 space-y-1">
                            <p><strong>Card Number:</strong> 4111 1111 1111 1111</p>
                            <p><strong>Expiry:</strong> 12/25</p>
                            <p><strong>CVV:</strong> 123</p>
                            <p><strong>Name:</strong> Any name</p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Payment Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Card Number */}
                        <div>
                            <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
                                Card Number
                            </label>
                            <input
                                id="cardNumber"
                                type="text"
                                required
                                value={formData.cardNumber}
                                onChange={handleCardNumberChange}
                                placeholder="1234 5678 9012 3456"
                                maxLength={19}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>

                        {/* Expiry and CVV */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                                    Expiry Date
                                </label>
                                <input
                                    id="expiryDate"
                                    type="text"
                                    required
                                    value={formData.expiryDate}
                                    onChange={handleExpiryChange}
                                    placeholder="MM/YY"
                                    maxLength={5}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                                    CVV
                                </label>
                                <input
                                    id="cvv"
                                    type="text"
                                    required
                                    value={formData.cvv}
                                    onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                                    placeholder="123"
                                    maxLength={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Cardholder Name */}
                        <div>
                            <label htmlFor="cardholderName" className="block text-sm font-medium text-gray-700 mb-1">
                                Cardholder Name
                            </label>
                            <input
                                id="cardholderName"
                                type="text"
                                required
                                value={formData.cardholderName}
                                onChange={(e) => setFormData({ ...formData, cardholderName: e.target.value })}
                                placeholder="John Doe"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>

                        {/* Save Card */}
                        <div className="flex items-center">
                            <input
                                id="saveCard"
                                type="checkbox"
                                checked={formData.saveCard}
                                onChange={(e) => setFormData({ ...formData, saveCard: e.target.checked })}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <label htmlFor="saveCard" className="ml-2 text-sm text-gray-700">
                                Save card for future payments
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-6 px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? t("common.loading") : `Pay ${orderData.amount.toFixed(2)}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
