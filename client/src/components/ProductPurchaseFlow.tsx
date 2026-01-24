"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useLanguage } from "@/contexts/LanguageContext";
import { PaymentModal } from "@/components/PaymentModal";

interface Product {
    id: string;
    name_en: string;
    name_ar?: string;
    description_en?: string;
    description_ar?: string;
    price: number;
    images?: string[];
    category?: string;
    stock?: number;
    isAvailable: boolean;
}

interface ProductPurchaseFlowProps {
    productId: string;
    tenantId: string;
    tenant?: any;
    onComplete?: (orderId: string, amount: number) => void;
    onCancel?: () => void;
    mode?: 'modal' | 'inline';
}

export function ProductPurchaseFlow({
    productId,
    tenantId,
    tenant,
    onComplete,
    onCancel,
    mode = 'modal'
}: ProductPurchaseFlowProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { locale, t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [product, setProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState<"online" | "cash_on_delivery" | "pay_on_visit" | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [orderData, setOrderData] = useState<any>(null);
    const [shippingAddress, setShippingAddress] = useState({
        street: "",
        city: "",
        building: "",
        floor: "",
        apartment: "",
        phone: "",
        notes: ""
    });
    const [pickupDate, setPickupDate] = useState("");

    useEffect(() => {
        if (productId && tenantId) {
            loadProductData();
        } else {
            setError("Missing product or tenant information");
            setLoading(false);
        }
    }, [productId, tenantId]);

    useEffect(() => {
        // Load saved address from profile when Online or POD is selected
        if ((paymentMethod === "online" || paymentMethod === "cash_on_delivery") && user) {
            loadSavedAddress();
        }
    }, [paymentMethod, user]);

    const loadProductData = async () => {
        try {
            setError("");
            setLoading(true);

            const productResponse = await api.get<{ success: boolean; product: Product }>(
                `/public/tenant/${tenantId}/products/${productId}`
            );

            if (productResponse.success && productResponse.product) {
                setProduct(productResponse.product);
            } else {
                setError("Product not found");
            }
        } catch (error: any) {
            console.error("Failed to load product:", error);
            setError(error.message || "Failed to load product details");
        } finally {
            setLoading(false);
        }
    };

    const loadSavedAddress = async () => {
        try {
            const response = await api.get<{ success: boolean; user: any }>("/users/profile");
            if (response.success && response.user) {
                setShippingAddress({
                    street: response.user.addressStreet || "",
                    city: response.user.addressCity || "",
                    building: response.user.addressBuilding || "",
                    floor: response.user.addressFloor || "",
                    apartment: response.user.addressApartment || "",
                    phone: response.user.addressPhone || response.user.phone || "",
                    notes: response.user.addressNotes || ""
                });
            }
        } catch (error) {
            console.error("Failed to load saved address:", error);
        }
    };

    const handlePurchase = async () => {
        if (!product || !tenantId || !paymentMethod) {
            setError("Please select a payment method");
            return;
        }

        // Validate quantity
        if (quantity <= 0 || (product.stock && quantity > product.stock)) {
            setError("Invalid quantity");
            return;
        }

        // Validate delivery requirements
        if (paymentMethod === "online" || paymentMethod === "cash_on_delivery") {
            if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.phone) {
                setError("Please fill in all required shipping address fields");
                return;
            }
        }

        try {
            setSubmitting(true);
            setError("");

            // Delivery type logic
            const deliveryType = paymentMethod === "pay_on_visit" ? "pickup" : "delivery";
            
            const orderResponse = await api.post<{ success: boolean; order: any }>("/orders", {
                tenantId,
                items: [{ productId: product.id, quantity }],
                paymentMethod,
                deliveryType: deliveryType,
                shippingAddress: (paymentMethod === "online" || paymentMethod === "cash_on_delivery") ? shippingAddress : null,
                pickupDate: paymentMethod === "pay_on_visit" ? pickupDate : null,
                notes: ""
            });

            if (orderResponse.success && orderResponse.order) {
                const order = orderResponse.order;

                if (paymentMethod === "online") {
                    // Show payment modal
                    setOrderData({
                        orderId: order.id,
                        amount: order.totalAmount,
                        productName: product.name_ar || product.name_en,
                        quantity: quantity
                    });
                    setShowPaymentModal(true);
                } else {
                    // POD or POV - show success modal
                    setOrderData({
                        orderId: order.id,
                        amount: order.totalAmount,
                        paymentMethod: paymentMethod
                    });
                    setShowSuccessModal(true);
                }
            } else {
                setError("Failed to create order");
            }
        } catch (error: any) {
            console.error("Purchase error:", error);
            setError(error.message || "Failed to process purchase");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading product details...</p>
                </div>
            </div>
        );
    }

    if (error && !product) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Close
                    </button>
                )}
            </div>
        );
    }

    if (!product) {
        return null;
    }

    const totalPrice = (product.price * quantity).toFixed(2);
    const taxAmount = (parseFloat(totalPrice) * 0.15).toFixed(2); // 15% VAT
    const shippingFee = (paymentMethod === "online" || paymentMethod === "cash_on_delivery") ? "25.00" : "0.00";
    const finalTotal = (parseFloat(totalPrice) + parseFloat(taxAmount) + parseFloat(shippingFee)).toFixed(2);

    const primaryColor = tenant?.customColors?.primaryColor || "#9333EA";

    // Modal mode rendering
    if (mode === 'modal') {
        return (
            <>
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Complete Your Purchase</h2>
                                <p className="text-sm text-gray-500">{product.name_en}</p>
                            </div>
                            {onCancel && (
                                <button
                                    onClick={onCancel}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    aria-label="Close"
                                >
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {error && (
                                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column - Product & Details */}
                                <div className="lg:col-span-2 space-y-4">
                                    {/* Product Summary */}
                                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                        <div className="flex gap-4">
                                            {product.images && product.images.length > 0 && (
                                                <img
                                                    src={`http://localhost:5000${product.images[0].startsWith('/') ? product.images[0] : `/uploads/${product.images[0]}`}`}
                                                    alt={product.name_en}
                                                    className="w-20 h-20 rounded-lg object-cover"
                                                />
                                            )}
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold text-gray-900">{product.name_en}</h3>
                                                {product.category && (
                                                    <p className="text-sm text-gray-500">{product.category}</p>
                                                )}
                                                <div className="mt-2 flex items-center gap-4">
                                                    <span className="text-lg font-bold text-primary">
                                                        <Currency amount={product.price} locale={locale} />
                                                    </span>
                                                    <span className="text-sm text-gray-500">per unit</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quantity Selector */}
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                    disabled={quantity <= 1}
                                                    className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={product.stock || 999}
                                                    value={quantity}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 1;
                                                        setQuantity(Math.max(1, Math.min(val, product.stock || 999)));
                                                    }}
                                                    className="w-20 text-center border border-gray-300 rounded-lg px-2 py-1"
                                                />
                                                <button
                                                    onClick={() => setQuantity(Math.min(product.stock || 999, quantity + 1))}
                                                    disabled={quantity >= (product.stock || 999)}
                                                    className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    +
                                                </button>
                                                {product.stock && (
                                                    <span className="text-sm text-gray-500">
                                                        {product.stock} available
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment Method Selection */}
                                    {!paymentMethod && (
                                        <div className="bg-white rounded-xl border border-gray-100 p-6">
                                            <h2 className="text-xl font-bold text-gray-900 mb-4">Select Payment Method</h2>
                                            <div className="space-y-3">
                                                <button
                                                    onClick={() => setPaymentMethod("online")}
                                                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary transition-colors text-start"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">💳 Pay Online</p>
                                                            <p className="text-sm text-gray-600">Pay now and we'll deliver to your address</p>
                                                        </div>
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => setPaymentMethod("cash_on_delivery")}
                                                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary transition-colors text-start"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">🚚 Pay on Delivery (POD)</p>
                                                            <p className="text-sm text-gray-600">Pay when product is delivered to your address</p>
                                                        </div>
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => setPaymentMethod("pay_on_visit")}
                                                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary transition-colors text-start"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">🏢 Pay when Visit</p>
                                                            <p className="text-sm text-gray-600">Pick up from salon and pay when you visit</p>
                                                        </div>
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Shipping Address (for Online and POD) */}
                                    {(paymentMethod === "online" || paymentMethod === "cash_on_delivery") && (
                                        <div className="bg-white rounded-xl border border-gray-100 p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-xl font-bold text-gray-900">
                                                    {paymentMethod === "online" ? "Delivery Address" : "Shipping Address"}
                                                </h2>
                                                <button
                                                    type="button"
                                                    onClick={loadSavedAddress}
                                                    className="text-sm text-primary hover:text-primary/80 font-medium"
                                                >
                                                    Use Saved Address
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Street Address *</label>
                                                    <input
                                                        type="text"
                                                        value={shippingAddress.street}
                                                        onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                                                        <input
                                                            type="text"
                                                            value={shippingAddress.city}
                                                            onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                                                        <input
                                                            type="tel"
                                                            value={shippingAddress.phone}
                                                            onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Building</label>
                                                        <input
                                                            type="text"
                                                            value={shippingAddress.building}
                                                            onChange={(e) => setShippingAddress({ ...shippingAddress, building: e.target.value })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Floor / Apartment</label>
                                                        <input
                                                            type="text"
                                                            value={`${shippingAddress.floor}${shippingAddress.apartment ? `, Apt ${shippingAddress.apartment}` : ''}`}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const parts = val.split(',');
                                                                setShippingAddress({
                                                                    ...shippingAddress,
                                                                    floor: parts[0] || "",
                                                                    apartment: parts[1]?.replace('Apt ', '') || ""
                                                                });
                                                            }}
                                                            placeholder="Floor, Apt"
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Notes (Optional)</label>
                                                    <textarea
                                                        value={shippingAddress.notes}
                                                        onChange={(e) => setShippingAddress({ ...shippingAddress, notes: e.target.value })}
                                                        rows={3}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                                        placeholder="Any special delivery instructions..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pickup Date (for Pay When Visit) */}
                                    {paymentMethod === "pay_on_visit" && (
                                        <div className="bg-white rounded-xl border border-gray-100 p-6">
                                            <h2 className="text-xl font-bold text-gray-900 mb-4">Pickup Information</h2>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Pickup Date (Optional)</label>
                                                <input
                                                    type="date"
                                                    value={pickupDate}
                                                    onChange={(e) => setPickupDate(e.target.value)}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                                />
                                                <p className="text-sm text-gray-500 mt-2">
                                                    Leave empty to pick up anytime, or select a preferred date
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column - Order Summary */}
                                <div className="lg:col-span-1">
                                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 sticky top-4">
                                        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
                                        
                                        <div className="space-y-3 mb-6">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Subtotal ({quantity} {quantity === 1 ? 'item' : 'items'})</span>
                                                <span className="text-gray-900 font-medium"><Currency amount={parseFloat(totalPrice)} locale={locale} /></span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Tax (15% VAT)</span>
                                                <span className="text-gray-900 font-medium"><Currency amount={parseFloat(taxAmount)} locale={locale} /></span>
                                            </div>
                                            {(paymentMethod === "online" || paymentMethod === "cash_on_delivery") && parseFloat(shippingFee) > 0 && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Shipping Fee</span>
                                                    <span className="text-gray-900 font-medium"><Currency amount={parseFloat(shippingFee)} locale={locale} /></span>
                                                </div>
                                            )}
                                            <div className="border-t border-gray-200 pt-3 mt-3">
                                                <div className="flex justify-between">
                                                    <span className="text-lg font-bold text-gray-900">Total</span>
                                                    <span className="text-lg font-bold" style={{ color: primaryColor }}>
                                                        <Currency amount={parseFloat(finalTotal)} locale={locale} />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {paymentMethod && (
                                            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-sm font-medium text-blue-900 mb-2">
                                                    {paymentMethod === "online" && "💳 Pay Online"}
                                                    {paymentMethod === "cash_on_delivery" && "🚚 Pay on Delivery"}
                                                    {paymentMethod === "pay_on_visit" && "🏢 Pay When Visit"}
                                                </p>
                                                <p className="text-xs text-blue-700">
                                                    {paymentMethod === "online" && "Pay now and we'll deliver to your address"}
                                                    {paymentMethod === "cash_on_delivery" && "Pay when product is delivered to your address"}
                                                    {paymentMethod === "pay_on_visit" && "Pick up from salon and pay when you visit"}
                                                </p>
                                            </div>
                                        )}

                                        <button
                                            onClick={handlePurchase}
                                            disabled={submitting || !product.isAvailable || !paymentMethod}
                                            className="w-full px-6 py-3 text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            {submitting ? "Processing..." : (
                                                paymentMethod === "online" ? "Proceed to Payment" : "Place Order"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Modal */}
                {showPaymentModal && orderData && (
                    <PaymentModal
                        isOpen={showPaymentModal}
                        onClose={() => {
                            setShowPaymentModal(false);
                            if (onCancel) onCancel();
                        }}
                        type="product"
                        orderData={{
                            orderId: orderData.orderId,
                            amount: orderData.amount,
                            tenantId: tenantId,
                            productName: orderData.productName,
                            quantity: orderData.quantity
                        }}
                        onSuccess={(transaction) => {
                            setShowPaymentModal(false);
                            if (onComplete) {
                                onComplete(orderData.orderId, orderData.amount);
                            }
                            if (onCancel) onCancel();
                        }}
                    />
                )}

                {/* Success Modal for POD/POV */}
                {showSuccessModal && orderData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("purchase.orderPlacedTitle")}</h2>
                                <p className="text-gray-600 mb-6">
                                    {orderData.paymentMethod === "cash_on_delivery" && t("purchase.podSuccessMessage")}
                                    {orderData.paymentMethod === "pay_on_visit" && t("purchase.povSuccessMessage")}
                                </p>
                                <div className="mb-6 p-4 bg-primary/10 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-1">{t("purchase.orderTotal")}</p>
                                    <p className="text-2xl font-bold text-primary">
                                        <Currency amount={orderData.amount} locale={locale} />
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {orderData.paymentMethod === "cash_on_delivery" && t("purchase.paymentOnDelivery")}
                                        {orderData.paymentMethod === "pay_on_visit" && t("purchase.paymentOnVisit")}
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => {
                                            setShowSuccessModal(false);
                                            if (onComplete) {
                                                onComplete(orderData.orderId, orderData.amount);
                                            }
                                            if (onCancel) onCancel();
                                            router.push("/dashboard/purchases");
                                        }}
                                        className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                                    >
                                        {t("purchase.viewMyPurchases")}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSuccessModal(false);
                                            if (onComplete) {
                                                onComplete(orderData.orderId, orderData.amount);
                                            }
                                            if (onCancel) onCancel();
                                        }}
                                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                                    >
                                        {t("purchase.backToHome")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Inline mode rendering (for future use)
    return null;
}
