"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

interface PaymentMethod {
    id: string;
    type: string;
    cardLast4: string;
    cardBrand: string;
    cardExpiry: string;
    cardHolderName: string;
    isDefault: boolean;
    isActive: boolean;
}

function PaymentMethodsContent() {
    const { user } = useAuth();
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
    });

    useEffect(() => {
        loadPaymentMethods();
    }, []);

    const loadPaymentMethods = async () => {
        try {
            setLoading(true);
            const response = await api.get<{ success: boolean; paymentMethods: PaymentMethod[] }>(
                "/users/payment-methods"
            );
            if (response.success) {
                setPaymentMethods(response.paymentMethods || []);
            }
        } catch (error) {
            console.error("Failed to load payment methods:", error);
        } finally {
            setLoading(false);
        }
    };

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

    const handleAddCard = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post<{ success: boolean; paymentMethod: PaymentMethod }>(
                "/users/payment-methods",
                {
                    cardNumber: formData.cardNumber.replace(/\s/g, ""),
                    expiryDate: formData.expiryDate,
                    cvv: formData.cvv,
                    cardholderName: formData.cardholderName,
                }
            );
            if (response.success) {
                setShowAddForm(false);
                setFormData({ cardNumber: "", expiryDate: "", cvv: "", cardholderName: "" });
                loadPaymentMethods();
            }
        } catch (error: any) {
            alert(error.message || "Failed to add payment method");
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
            await api.put(`/users/payment-methods/${id}/set-default`);
            loadPaymentMethods();
        } catch (error) {
            alert("Failed to set default payment method");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this payment method?")) return;

        try {
            await api.delete(`/users/payment-methods/${id}`);
            loadPaymentMethods();
        } catch (error) {
            alert("Failed to delete payment method");
        }
    };

    const getCardBrandIcon = (brand: string) => {
        switch (brand.toLowerCase()) {
            case "visa":
                return "💳";
            case "mastercard":
                return "💳";
            case "amex":
                return "💳";
            default:
                return "💳";
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Payment Methods</h2>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        {showAddForm ? "Cancel" : "+ Add Card"}
                    </button>
                </div>

                {/* Add Card Form */}
                {showAddForm && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Card</h3>
                        <form onSubmit={handleAddCard} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Card Number
                                </label>
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
                                        onChange={(e) =>
                                            setFormData({ ...formData, expiryDate: formatExpiryDate(e.target.value) })
                                        }
                                        placeholder="MM/YY"
                                        maxLength={5}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
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
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Add Card
                            </button>
                        </form>
                    </div>
                )}

                {/* Payment Methods List */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading payment methods...</p>
                        </div>
                    ) : paymentMethods.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-600 mb-4">No payment methods saved</p>
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Add Your First Card
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {paymentMethods.map((method) => (
                                <div key={method.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="text-4xl">{getCardBrandIcon(method.cardBrand)}</div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-lg font-semibold text-gray-900">
                                                        •••• •••• •••• {method.cardLast4}
                                                    </p>
                                                    {method.isDefault && (
                                                        <span className="px-2 py-1 bg-primary text-white text-xs rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                    {method.cardHolderName} • Expires {method.cardExpiry}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {!method.isDefault && (
                                                <button
                                                    onClick={() => handleSetDefault(method.id)}
                                                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    Set Default
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(method.id)}
                                                className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                                            >
                                                Delete
                                            </button>
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

export default function PaymentMethodsPage() {
    return (
        <ProtectedRoute>
            <PaymentMethodsContent />
        </ProtectedRoute>
    );
}

