"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import { Currency, InlineCurrency } from "@/components/Currency";
import { useRouter } from "next/navigation";

function WalletContent() {
    const { user, refreshUser } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState("");
    const [showTopUpForm, setShowTopUpForm] = useState(false);
    const [formData, setFormData] = useState({
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
    });

    const formatCardNumber = (value: string) => {
        const cleaned = value.replace(/\s/g, "");
        const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
        return formatted.slice(0, 19);
    };

    const formatExpiryDate = (value: string) => {
        const cleaned = value.replace(/\D/g, "");
        if (cleaned.length >= 2) {
            return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
        }
        return cleaned;
    };

    const handleTopUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post<{ success: boolean; newBalance: number }>("/payments/wallet/topup", {
                amount: topUpAmount,
                cardNumber: formData.cardNumber.replace(/\s/g, ""),
                expiryDate: formData.expiryDate,
                cvv: formData.cvv,
                cardholderName: formData.cardholderName,
            });

            if (response.success) {
                await refreshUser();
                setShowTopUpForm(false);
                setTopUpAmount("");
                setFormData({ cardNumber: "", expiryDate: "", cvv: "", cardholderName: "" });
                alert("Wallet topped up successfully!");
            }
        } catch (error: any) {
            alert(error.message || "Failed to top up wallet");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {/* Wallet Balance Card */}
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg p-8 mb-6 text-white">
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={isRTL ? 'text-end' : ''}>
                            <p className="text-primary-100 text-sm font-medium mb-2">{t("wallet.currentBalance")}</p>
                            <p className="text-4xl font-bold">
                                <Currency amount={parseFloat(user?.walletBalance?.toString() || "0")} locale={locale} />
                            </p>
                        </div>
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-4xl">💰</span>
                        </div>
                    </div>
                    <div className={isRTL ? 'text-end' : ''}>
                        <button
                            onClick={() => setShowTopUpForm(!showTopUpForm)}
                            className="mt-6 px-6 py-3 bg-white text-primary rounded-lg hover:bg-white/90 transition-colors font-semibold"
                        >
                            {showTopUpForm ? t("common.cancel") : `+ ${t("wallet.addFunds")}`}
                        </button>
                    </div>
                </div>

                {/* Top Up Form */}
                {showTopUpForm && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                        <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-end' : ''}`}>{t("wallet.addFunds")}</h3>
                        <form onSubmit={handleTopUp} className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                    {t("payments.amount")} (<InlineCurrency amount={0} locale={locale} />)
                                </label>
                                <input
                                    type="number"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    placeholder="100.00"
                                    min="10"
                                    step="0.01"
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>{t("payments.cardNumber")}</label>
                                <input
                                    type="text"
                                    value={formData.cardNumber}
                                    onChange={(e) =>
                                        setFormData({ ...formData, cardNumber: formatCardNumber(e.target.value) })
                                    }
                                    placeholder="4242 4242 4242 4242"
                                    maxLength={19}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    required
                                    dir="ltr"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                        {t("payments.expiryDate")}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.expiryDate}
                                        onChange={(e) =>
                                            setFormData({ ...formData, expiryDate: formatExpiryDate(e.target.value) })
                                        }
                                        placeholder="MM/YY"
                                        maxLength={5}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        required
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>{t("payments.cvv")}</label>
                                    <input
                                        type="text"
                                        value={formData.cvv}
                                        onChange={(e) =>
                                            setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })
                                        }
                                        placeholder="123"
                                        maxLength={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        required
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>
                                    {t("payments.cardHolder")}
                                </label>
                                <input
                                    type="text"
                                    value={formData.cardholderName}
                                    onChange={(e) => setFormData({ ...formData, cardholderName: e.target.value })}
                                    placeholder={user ? `${user.firstName} ${user.lastName}` : "Full Name"}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {loading ? t("common.loading") : (
                                    <>
                                        {t("wallet.addFunds")} <Currency amount={parseFloat(topUpAmount || "0")} locale={locale} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Loyalty Points Card */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={isRTL ? 'text-end' : ''}>
                            <p className="text-gray-600 text-sm font-medium mb-2">{t("wallet.pointsBalance")}</p>
                            <p className="text-3xl font-bold text-gray-900">
                                {user?.loyaltyPoints || 0} {locale === 'ar' ? 'نقطة' : 'points'}
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                {locale === 'ar' ? '١ ريال = ١ نقطة • استبدل النقاط للحصول على خصومات' : '1 SAR = 1 point • Redeem points for discounts'}
                            </p>
                        </div>
                        <div className="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center">
                            <span className="text-3xl">⭐</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-end' : ''}`}>{locale === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => router.push("/dashboard/payments")}
                            className={`p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ${isRTL ? 'text-end' : 'text-start'}`}
                        >
                            <p className="font-semibold text-gray-900">{locale === 'ar' ? 'عرض سجل المعاملات' : 'View Transaction History'}</p>
                            <p className="text-sm text-gray-600 mt-1">{locale === 'ar' ? 'عرض جميع مدفوعاتك ومعاملاتك' : 'See all your payments and transactions'}</p>
                        </button>
                        <button
                            onClick={() => router.push("/dashboard/payment-methods")}
                            className={`p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ${isRTL ? 'text-end' : 'text-start'}`}
                        >
                            <p className="font-semibold text-gray-900">{locale === 'ar' ? 'إدارة طرق الدفع' : 'Manage Payment Methods'}</p>
                            <p className="text-sm text-gray-600 mt-1">{locale === 'ar' ? 'إضافة أو إزالة البطاقات المحفوظة' : 'Add or remove saved cards'}</p>
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function WalletPage() {
    return (
        <ProtectedRoute>
            <WalletContent />
        </ProtectedRoute>
    );
}

