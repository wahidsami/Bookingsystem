"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import { Currency } from "@/components/Currency";

interface Transaction {
    id: string;
    amount: string;
    currency: string;
    type: "booking" | "refund" | "wallet_topup" | "loyalty_redemption";
    status: "pending" | "completed" | "failed" | "refunded";
    createdAt: string;
    appointment?: {
        id: string;
        Service?: { name_en: string };
        Staff?: { name: string };
    };
    tenant?: { name: string };
}

function PaymentsContent() {
    const { user } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        type: "",
        status: "",
        startDate: "",
        endDate: "",
    });

    useEffect(() => {
        loadTransactions();
    }, [filters]);

    const loadTransactions = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.type) params.append("type", filters.type);
            if (filters.status) params.append("status", filters.status);
            if (filters.startDate) params.append("startDate", filters.startDate);
            if (filters.endDate) params.append("endDate", filters.endDate);

            const response = await api.get<{ success: boolean; transactions: Transaction[] }>(
                `/payments/history?${params.toString()}`
            );
            if (response.success) {
                setTransactions(response.transactions || []);
            }
        } catch (error) {
            console.error("Failed to load transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(locale === 'ar' ? "ar-SA" : "en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getTypeLabel = (type: string) => {
        if (locale === 'ar') {
            switch (type) {
                case "booking": return "دفع الحجز";
                case "refund": return "استرداد";
                case "wallet_topup": return "شحن المحفظة";
                case "loyalty_redemption": return "استبدال نقاط الولاء";
                default: return type;
            }
        }
        switch (type) {
            case "booking": return "Booking Payment";
            case "refund": return "Refund";
            case "wallet_topup": return "Wallet Top-up";
            case "loyalty_redemption": return "Loyalty Redemption";
            default: return type;
        }
    };

    const getStatusText = (status: string) => {
        if (locale === 'ar') {
            switch (status) {
                case "completed": return "مكتمل";
                case "pending": return "قيد الانتظار";
                case "failed": return "فشل";
                case "refunded": return "مسترد";
                default: return status;
            }
        }
        return status;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "bg-green-100 text-green-800";
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "failed":
                return "bg-red-100 text-red-800";
            case "refunded":
                return "bg-blue-100 text-blue-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const totalAmount = transactions
        .filter((t) => t.status === "completed")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto">
                {/* Summary Card */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={isRTL ? 'text-end' : ''}>
                            <p className="text-gray-600 text-sm font-medium">{t("dashboard.totalSpent")}</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                <Currency amount={totalAmount} locale={locale} />
                            </p>
                        </div>
                        <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                            <span className="text-3xl">💰</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                    <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-end' : ''}`}>{t("common.filter")}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>{t("payments.type")}</label>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                            >
                                <option value="">{t("common.all")}</option>
                                <option value="booking">{getTypeLabel("booking")}</option>
                                <option value="refund">{getTypeLabel("refund")}</option>
                                <option value="wallet_topup">{getTypeLabel("wallet_topup")}</option>
                                <option value="loyalty_redemption">{getTypeLabel("loyalty_redemption")}</option>
                            </select>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>{t("bookings.status")}</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${isRTL ? 'text-end' : ''}`}
                            >
                                <option value="">{t("common.all")}</option>
                                <option value="completed">{getStatusText("completed")}</option>
                                <option value="pending">{getStatusText("pending")}</option>
                                <option value="failed">{getStatusText("failed")}</option>
                                <option value="refunded">{getStatusText("refunded")}</option>
                            </select>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-end' : ''}`}>{locale === 'ar' ? 'تاريخ البداية' : 'Start Date'}</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setFilters({ type: "", status: "", startDate: "", endDate: "" })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                {locale === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Transactions List */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                    <div className={`p-6 border-b border-gray-200 ${isRTL ? 'text-end' : ''}`}>
                        <h2 className="text-xl font-bold text-gray-900">{t("payments.transactionHistory")}</h2>
                        <p className="text-gray-600 text-sm mt-1">
                            {transactions.length} {locale === 'ar' ? 'معاملة' : (transactions.length !== 1 ? "transactions" : "transaction")} {locale === 'ar' ? 'موجودة' : 'found'}
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-gray-600">{t("common.loading")}</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-600">{t("payments.noTransactions")}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {transactions.map((transaction) => (
                                <div key={transaction.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <div className={`flex-1 ${isRTL ? 'text-end' : ''}`}>
                                            <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {getTypeLabel(transaction.type)}
                                                </h3>
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                        transaction.status
                                                    )}`}
                                                >
                                                    {getStatusText(transaction.status)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                {transaction.appointment && (
                                                    <p>
                                                        <span className="font-medium">{t("bookings.service")}:</span>{" "}
                                                        {transaction.appointment.Service?.name_en || "N/A"}
                                                    </p>
                                                )}
                                                {transaction.tenant && (
                                                    <p>
                                                        <span className="font-medium">{locale === 'ar' ? 'الصالون' : 'Salon'}:</span>{" "}
                                                        {transaction.tenant.name}
                                                    </p>
                                                )}
                                                <p>
                                                    <span className="font-medium">{t("bookings.date")}:</span>{" "}
                                                    {formatDate(transaction.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={isRTL ? 'text-start' : 'text-end'}>
                                            <p
                                                className={`text-xl font-bold ${
                                                    transaction.type === "refund"
                                                        ? "text-green-600"
                                                        : "text-primary"
                                                }`}
                                            >
                                                {transaction.type === "refund" ? "+" : "-"}
                                                <Currency amount={parseFloat(transaction.amount)} locale={locale} />
                                            </p>
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

export default function PaymentsPage() {
    return (
        <ProtectedRoute>
            <PaymentsContent />
        </ProtectedRoute>
    );
}

