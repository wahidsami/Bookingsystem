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
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    deliveryType: string;
    subtotal: number;
    taxAmount: number;
    shippingFee: number;
    platformFee: number;
    totalAmount: number;
    shippingAddress?: any;
    pickupDate?: string;
    trackingNumber?: string;
    estimatedDeliveryDate?: string;
    deliveredAt?: string;
    notes?: string;
    cancellationReason?: string;
    cancelledAt?: string;
    createdAt: string;
    items: OrderItem[];
    tenant?: {
        id: string;
        name: string;
        slug: string;
        logo?: string;
    };
}

function OrderDetailsContent({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { user } = useAuth();
    const { t, locale, isRTL } = useLanguage();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchOrderDetails() {
            try {
                setLoading(true);
                setError(null);
                const response = await api.get<{ success: boolean; order: Order; message?: string }>(
                    `/orders/${params.id}`
                );
                if (response.success) {
                    setOrder(response.order);
                } else {
                    setError(response.message || "Failed to fetch order details.");
                }
            } catch (err: any) {
                console.error("Error fetching order details:", err);
                setError(err.message || "Failed to load order details.");
            } finally {
                setLoading(false);
            }
        }

        if (params.id) {
            fetchOrderDetails();
        }
    }, [params.id]);

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
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
        const statusMap: Record<string, string> = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'processing': 'Processing',
            'ready_for_pickup': 'Ready for Pickup',
            'shipped': 'Shipped',
            'delivered': 'Delivered',
            'completed': 'Completed',
            'cancelled': 'Cancelled',
            'refunded': 'Refunded'
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

    const getPaymentMethodText = (method: string) => {
        const methodMap: Record<string, string> = {
            'online': 'Paid Online',
            'cash_on_delivery': 'Pay on Delivery',
            'pay_on_visit': 'Pay When Visit'
        };
        return methodMap[method] || method;
    };

    const handleCancel = async () => {
        if (!order) return;
        if (!confirm("Are you sure you want to cancel this order?")) return;

        try {
            const response = await api.patch<{ success: boolean }>(`/orders/${order.id}/cancel`, {
                reason: "Cancelled by customer"
            });
            if (response.success) {
                alert("Order cancelled successfully");
                router.push("/dashboard/purchases");
            } else {
                alert("Failed to cancel order");
            }
        } catch (err: any) {
            console.error("Failed to cancel order:", err);
            alert(err.message || "Failed to cancel order");
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading order details...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !order) {
        return (
            <DashboardLayout>
                <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
                    <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-gray-100">
                        <p className="text-red-600 mb-4">{error || "Order not found"}</p>
                        <button
                            onClick={() => router.push("/dashboard/purchases")}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                        >
                            Back to Purchases
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <svg className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 space-y-6">
                    {/* Order Header */}
                    <div className={`flex items-center justify-between pb-4 border-b border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Order #{order.orderNumber}</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Placed on {formatDate(order.createdAt)}
                            </p>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                        </span>
                    </div>

                    {/* Order Items */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
                        <div className="space-y-4">
                            {order.items && order.items.map((item) => (
                                <div key={item.id} className={`flex items-center gap-4 p-4 bg-gray-50 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    {item.productImage && (
                                        <img
                                            src={`http://localhost:5000${item.productImage.startsWith('/') ? item.productImage : `/uploads/${item.productImage}`}`}
                                            alt={item.productName}
                                            className="w-20 h-20 rounded-lg object-cover"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900">
                                            {locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName}
                                        </h4>
                                        <p className="text-sm text-gray-600">
                                            Quantity: {item.quantity} × <Currency amount={item.unitPrice} />
                                        </p>
                                    </div>
                                    <div className={`text-right ${isRTL ? 'text-left' : ''}`}>
                                        <p className="font-bold text-gray-900">
                                            <Currency amount={item.totalPrice} />
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Order Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-gray-700 pt-4 border-t border-gray-200">
                        <div className={isRTL ? 'text-end' : ''}>
                            <p className="font-semibold text-gray-900">Tenant:</p>
                            <p className="text-lg">{order.tenant?.name || "N/A"}</p>
                        </div>
                        <div className={isRTL ? 'text-end' : ''}>
                            <p className="font-semibold text-gray-900">Payment Method:</p>
                            <p className="text-lg">{getPaymentMethodText(order.paymentMethod)}</p>
                        </div>
                        <div className={isRTL ? 'text-end' : ''}>
                            <p className="font-semibold text-gray-900">Payment Status:</p>
                            <p className="text-lg capitalize">{order.paymentStatus || "Pending"}</p>
                        </div>
                        <div className={isRTL ? 'text-end' : ''}>
                            <p className="font-semibold text-gray-900">Delivery Type:</p>
                            <p className="text-lg capitalize">{order.deliveryType || "Pickup"}</p>
                        </div>
                        {order.trackingNumber && (
                            <div className={isRTL ? 'text-end' : ''}>
                                <p className="font-semibold text-gray-900">Tracking Number:</p>
                                <p className="text-lg font-mono">{order.trackingNumber}</p>
                            </div>
                        )}
                        {order.estimatedDeliveryDate && (
                            <div className={isRTL ? 'text-end' : ''}>
                                <p className="font-semibold text-gray-900">Estimated Delivery:</p>
                                <p className="text-lg">{formatDate(order.estimatedDeliveryDate)}</p>
                            </div>
                        )}
                        {order.deliveredAt && (
                            <div className={isRTL ? 'text-end' : ''}>
                                <p className="font-semibold text-gray-900">Delivered At:</p>
                                <p className="text-lg">{formatDate(order.deliveredAt)}</p>
                            </div>
                        )}
                        {order.pickupDate && (
                            <div className={isRTL ? 'text-end' : ''}>
                                <p className="font-semibold text-gray-900">Pickup Date:</p>
                                <p className="text-lg">{formatDate(order.pickupDate)}</p>
                            </div>
                        )}
                        {order.shippingAddress && (
                            <div className={`md:col-span-2 ${isRTL ? 'text-end' : ''}`}>
                                <p className="font-semibold text-gray-900">Shipping Address:</p>
                                <div className="text-base text-gray-600 mt-1">
                                    {(() => {
                                        try {
                                            const address = typeof order.shippingAddress === 'string'
                                                ? JSON.parse(order.shippingAddress)
                                                : order.shippingAddress;
                                            return (
                                                <div>
                                                    <p>{address.street}</p>
                                                    <p>{address.city}</p>
                                                    {address.building && <p>Building: {address.building}</p>}
                                                    {address.floor && <p>Floor: {address.floor}</p>}
                                                    {address.apartment && <p>Apartment: {address.apartment}</p>}
                                                    {address.phone && <p>Phone: {address.phone}</p>}
                                                    {address.notes && <p className="mt-2 italic">Notes: {address.notes}</p>}
                                                </div>
                                            );
                                        } catch (e) {
                                            return <p>Invalid address format</p>;
                                        }
                                    })()}
                                </div>
                            </div>
                        )}
                        {order.notes && (
                            <div className={`md:col-span-2 ${isRTL ? 'text-end' : ''}`}>
                                <p className="font-semibold text-gray-900">Notes:</p>
                                <p className="text-base text-gray-600">{order.notes}</p>
                            </div>
                        )}
                        {order.cancellationReason && (
                            <div className={`md:col-span-2 ${isRTL ? 'text-end' : ''}`}>
                                <p className="font-semibold text-red-900">Cancellation Reason:</p>
                                <p className="text-base text-red-700">{order.cancellationReason}</p>
                            </div>
                        )}
                    </div>

                    {/* Price Breakdown */}
                    <div className="pt-4 border-t border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Breakdown</h3>
                        <div className="space-y-2">
                            <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="text-gray-900 font-medium"><Currency amount={order.subtotal} /></span>
                            </div>
                            <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <span className="text-gray-600">Tax (15% VAT):</span>
                                <span className="text-gray-900 font-medium"><Currency amount={order.taxAmount} /></span>
                            </div>
                            {order.shippingFee > 0 && (
                                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-gray-600">Shipping Fee:</span>
                                    <span className="text-gray-900 font-medium"><Currency amount={order.shippingFee} /></span>
                                </div>
                            )}
                            <div className={`flex justify-between pt-2 border-t border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <span className="text-lg font-bold text-gray-900">Total:</span>
                                <span className="text-2xl font-bold text-primary">
                                    <Currency amount={order.totalAmount} />
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className={`flex gap-4 pt-6 border-t border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {order.status !== "cancelled" && order.status !== "completed" && order.paymentStatus === "pending" && order.paymentMethod === "online" && (
                            <button
                                onClick={() => router.push(`/products/payment?orderId=${order.id}&amount=${order.totalAmount}`)}
                                className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                            >
                                Pay Now
                            </button>
                        )}
                        {!['cancelled', 'completed', 'refunded'].includes(order.status) && (
                            <button
                                onClick={handleCancel}
                                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                            >
                                Cancel Order
                            </button>
                        )}
                        <Link
                            href="/dashboard/purchases"
                            className="flex-1 text-center px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                        >
                            Back to Purchases
                        </Link>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
    return (
        <ProtectedRoute>
            <OrderDetailsContent params={params} />
        </ProtectedRoute>
    );
}
