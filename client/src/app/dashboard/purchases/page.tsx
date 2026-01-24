"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import { Currency } from "@/components/Currency";
import Link from "next/link";

interface OrderItem {
    id: string;
    productName: string;
    productNameAr?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productImage?: string;
}

interface Order {
    id: string;
    orderNumber: string;
    status: 'pending' | 'confirmed' | 'processing' | 'ready_for_pickup' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
    paymentMethod: 'online' | 'cash_on_delivery' | 'pay_on_visit';
    deliveryType: 'pickup' | 'delivery';
    totalAmount: number;
    createdAt: string;
    items: OrderItem[];
    tenant?: {
        id: string;
        name: string;
        slug: string;
        logo?: string;
    };
}

function PurchasesContent() {
    const router = useRouter();
    const { user } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'cancelled'>('active');
    const [error, setError] = useState("");

    useEffect(() => {
        loadOrders();
    }, [activeTab]);

    const loadOrders = async () => {
        try {
            setLoading(true);
            setError("");

            let statusFilter: string | undefined;
            if (activeTab === 'active') {
                // Active: pending, confirmed, processing, ready_for_pickup, shipped
                statusFilter = undefined; // We'll filter client-side
            } else if (activeTab === 'completed') {
                statusFilter = 'completed';
            } else if (activeTab === 'cancelled') {
                statusFilter = 'cancelled';
            }

            const response = await api.get<{ success: boolean; orders: Order[] }>("/orders", {
                params: statusFilter ? { status: statusFilter } : {}
            });

            if (response.success) {
                let filteredOrders = response.orders;

                // Filter active orders client-side
                if (activeTab === 'active') {
                    filteredOrders = response.orders.filter(order => 
                        !['completed', 'cancelled', 'refunded'].includes(order.status)
                    );
                }

                setOrders(filteredOrders);
            } else {
                setError(t("purchases.loadFailed"));
            }
        } catch (err: any) {
            console.error("Failed to load orders:", err);
            setError(err.message || t("purchases.loadFailed"));
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (orderId: string) => {
        if (!confirm(t("purchases.confirmCancel"))) {
            return;
        }

        try {
            const response = await api.patch<{ success: boolean }>(`/orders/${orderId}/cancel`, {
                reason: "Cancelled by customer"
            });

            if (response.success) {
                loadOrders(); // Reload orders
            } else {
                alert(t("purchases.cancelFailed"));
            }
        } catch (err: any) {
            console.error("Failed to cancel order:", err);
            alert(err.message || t("purchases.cancelFailed"));
        }
    };

    const getStatusText = (status: string) => {
        const statusMap: Record<string, string> = {
            'pending': t("purchases.status.pending"),
            'confirmed': t("purchases.status.confirmed"),
            'processing': t("purchases.status.processing"),
            'ready_for_pickup': t("purchases.status.readyForPickup"),
            'shipped': t("purchases.status.shipped"),
            'delivered': t("purchases.status.delivered"),
            'completed': t("purchases.status.completed"),
            'cancelled': t("purchases.status.cancelled"),
            'refunded': t("purchases.status.refunded")
        };
        return statusMap[status] || status;
    };

    const getStatusColor = (status: string) => {
        const colorMap: Record<string, string> = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'confirmed': 'bg-blue-100 text-blue-800',
            'processing': 'bg-purple-100 text-purple-800',
            'ready_for_pickup': 'bg-green-100 text-green-800',
            'shipped': 'bg-indigo-100 text-indigo-800',
            'delivered': 'bg-teal-100 text-teal-800',
            'completed': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800',
            'refunded': 'bg-gray-100 text-gray-800'
        };
        return colorMap[status] || 'bg-gray-100 text-gray-800';
    };

    const getPaymentMethodText = (method: string, paymentStatus: string) => {
        // If payment is pending, show "Pay Online" instead of "Paid Online"
        if (method === 'online' && paymentStatus === 'pending') {
            return t("purchases.paymentMethod.payOnline");
        }
        const methodMap: Record<string, string> = {
            'online': t("purchases.paymentMethod.paidOnline"),
            'cash_on_delivery': t("purchases.paymentMethod.payOnDelivery"),
            'pay_on_visit': t("purchases.paymentMethod.payWhenVisit")
        };
        return methodMap[method] || method;
    };

    if (loading && orders.length === 0) {
        return (
            <DashboardLayout>
                <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-gray-600">{t("purchases.loadingOrders")}</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                                activeTab === 'active'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {t("purchases.active")} ({orders.filter(o => !['completed', 'cancelled', 'refunded'].includes(o.status)).length})
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                                activeTab === 'completed'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {t("purchases.completed")} ({orders.filter(o => o.status === 'completed').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('cancelled')}
                            className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                                activeTab === 'cancelled'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {t("purchases.cancelled")} ({orders.filter(o => o.status === 'cancelled').length})
                        </button>
                    </nav>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {/* Orders List */}
                {orders.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-gray-100">
                        <p className="text-gray-600 text-lg mb-4">
                            {activeTab === 'active' && t("purchases.noActiveOrders")}
                            {activeTab === 'completed' && t("purchases.noCompletedOrders")}
                            {activeTab === 'cancelled' && t("purchases.noCancelledOrders")}
                        </p>
                        <Link
                            href="/tenants"
                            className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            {t("purchases.browseProducts")}
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow cursor-pointer"
                                onClick={() => router.push(`/dashboard/purchases/${order.id}`)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {t("purchases.order")} #{order.orderNumber}
                                            </h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                                                {getStatusText(order.status)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            {new Date(order.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                        {order.tenant && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                {t("purchases.from")}: {order.tenant.name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-end">
                                        <p className="text-2xl font-bold text-primary">
                                            <Currency amount={order.totalAmount} locale={locale} />
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {getPaymentMethodText(order.paymentMethod, order.paymentStatus)}
                                        </p>
                                    </div>
                                </div>

                                {/* Order Items Preview */}
                                {order.items && order.items.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <div className="flex items-center gap-4">
                                            {order.items[0].productImage && (
                                                <img
                                                    src={`http://localhost:5000${order.items[0].productImage.startsWith('/') ? order.items[0].productImage : `/uploads/${order.items[0].productImage}`}`}
                                                    alt={order.items[0].productName}
                                                    className="w-16 h-16 rounded-lg object-cover"
                                                />
                                            )}
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900">
                                                    {locale === 'ar' && order.items[0].productNameAr
                                                        ? order.items[0].productNameAr
                                                        : order.items[0].productName}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {t("purchases.quantity")}: {order.items[0].quantity}
                                                    {order.items.length > 1 && ` + ${order.items.length - 1} ${order.items.length > 2 ? t("purchases.moreItemsPlural") : t("purchases.moreItems")}`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                                    {order.status !== 'cancelled' && order.status !== 'completed' && order.paymentStatus === 'pending' && order.paymentMethod === 'online' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/products/payment?orderId=${order.id}&amount=${order.totalAmount}`);
                                            }}
                                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold"
                                        >
                                            {t("purchases.payNow")}
                                        </button>
                                    )}
                                    {!['cancelled', 'completed', 'refunded'].includes(order.status) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCancel(order.id);
                                            }}
                                            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-semibold"
                                        >
                                            {t("purchases.cancelOrder")}
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/dashboard/purchases/${order.id}`);
                                        }}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
                                    >
                                        {t("purchases.viewDetails")}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

export default function PurchasesPage() {
    return (
        <ProtectedRoute>
            <PurchasesContent />
        </ProtectedRoute>
    );
}
