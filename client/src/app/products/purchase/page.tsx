"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
    id: string;
    name_en: string;
    name_ar?: string;
    description_en?: string;
    price: number;
    images?: string[];
    category?: string;
    stock?: number;
    isAvailable: boolean;
}

function PurchaseContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { locale } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [product, setProduct] = useState<Product | null>(null);
    const [tenant, setTenant] = useState<any>(null);
    const [quantity, setQuantity] = useState(1);
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

    const productId = searchParams.get("productId");
    const tenantId = searchParams.get("tenantId");
    const paymentMethod = searchParams.get("paymentMethod") as "online" | "cash_on_delivery" | "pay_on_visit" | null;

    useEffect(() => {
        if (productId && tenantId) {
            loadProductData();
        } else {
            setError("Missing product or tenant information");
            setLoading(false);
        }
    }, [productId, tenantId]);

    useEffect(() => {
        // Load saved address from profile when Online or POD is selected (both require delivery)
        if ((paymentMethod === "online" || paymentMethod === "cash_on_delivery") && user) {
            loadSavedAddress();
        }
    }, [paymentMethod, user]);

    const loadProductData = async () => {
        try {
            setError("");
            setLoading(true);

            // Load product details
            const productResponse = await api.get<{ success: boolean; product: Product }>(
                `/public/tenant/${tenantId}/products/${productId}`
            );

            if (productResponse.success && productResponse.product) {
                setProduct(productResponse.product);
            } else {
                setError("Product not found");
            }

            // Load tenant details (optional - for name, etc.)
            // Note: We don't have a public endpoint for tenant by ID, so we'll skip this
            // The product data is sufficient for the purchase page
            // If we need tenant info, we can get it from the product's tenantId later
            setTenant({ id: tenantId, name: "Salon", slug: "" }); // Placeholder

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
            // Don't show error - just use empty address
        }
    };

    const handlePurchase = async () => {
        if (!product || !tenantId || !paymentMethod) {
            setError("Missing required information");
            return;
        }

        // Validate quantity
        if (quantity <= 0 || (product.stock && quantity > product.stock)) {
            setError("Invalid quantity");
            return;
        }

        // Validate delivery requirements
        // Online and POD both require shipping address (delivery)
        // Pay on Visit doesn't require address (pickup)
        if (paymentMethod === "online" || paymentMethod === "cash_on_delivery") {
            if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.phone) {
                setError("Please fill in all required shipping address fields");
                return;
            }
        }

        try {
            setSubmitting(true);
            setError("");

            // Create order
            // Delivery type logic:
            // - Online: delivery (customer paid, expects delivery to address)
            // - POD: delivery (customer will pay when delivered to address)
            // - Pay on Visit: pickup (customer picks up from salon and pays there)
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

                // Handle different payment methods
                if (paymentMethod === "online") {
                    // Redirect to payment page with all required parameters
                    const productName = product.name_ar || product.name_en;
                    const quantityParam = quantity || 1;
                    router.push(`/products/payment?orderId=${order.id}&amount=${order.totalAmount}&tenantId=${tenantId}&productName=${encodeURIComponent(productName)}&quantity=${quantityParam}`);
                } else {
                    // POD or POV - order created, show success modal
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
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading product details...</p>
                </div>
            </div>
        );
    }

    if (error && !product) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <Link
                        href="/tenants"
                        className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Back to Salons
                    </Link>
                </div>
            </div>
        );
    }

    if (!product || !paymentMethod) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Invalid purchase request</p>
                    <Link
                        href="/tenants"
                        className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Back to Salons
                    </Link>
                </div>
            </div>
        );
    }

    const totalPrice = (product.price * quantity).toFixed(2);
    const taxAmount = (parseFloat(totalPrice) * 0.15).toFixed(2); // 15% VAT
    const platformFee = (parseFloat(totalPrice) * 0.025).toFixed(2); // 2.5% platform fee
    // Shipping fee applies to both online and POD (both require delivery)
    // Pay on Visit doesn't have shipping fee (customer picks up)
    const shippingFee = (paymentMethod === "online" || paymentMethod === "cash_on_delivery") ? "25.00" : "0.00";
    const finalTotal = (parseFloat(totalPrice) + parseFloat(taxAmount) + parseFloat(shippingFee)).toFixed(2);

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
            <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Back to Product</span>
                    </button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Complete Your Purchase</h1>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Product & Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Product Summary */}
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Product Summary</h2>
                            <div className="flex gap-4">
                                {product.images && product.images.length > 0 && (
                                    <img
                                        src={`http://localhost:5000${product.images[0].startsWith('/') ? product.images[0] : `/uploads/${product.images[0]}`}`}
                                        alt={product.name_en}
                                        className="w-24 h-24 rounded-lg object-cover"
                                    />
                                )}
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">{product.name_en}</h3>
                                    {product.category && (
                                        <p className="text-sm text-gray-500">{product.category}</p>
                                    )}
                                    <div className="mt-2 flex items-center gap-4">
                                        <span className="text-lg font-bold text-primary">
                                            <Currency amount={product.price} />
                                        </span>
                                        <span className="text-sm text-gray-500">per unit</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quantity Selector */}
                            <div className="mt-6">
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

                        {/* Shipping Address (for Online and POD - both require delivery) */}
                        {(paymentMethod === "online" || paymentMethod === "cash_on_delivery") && (
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
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
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
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
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sticky top-4">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
                            
                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal ({quantity} {quantity === 1 ? 'item' : 'items'})</span>
                                    <span className="text-gray-900 font-medium"><Currency amount={parseFloat(totalPrice)} /></span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Tax (15% VAT)</span>
                                    <span className="text-gray-900 font-medium"><Currency amount={parseFloat(taxAmount)} /></span>
                                </div>
                                {(paymentMethod === "online" || paymentMethod === "cash_on_delivery") && parseFloat(shippingFee) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Shipping Fee</span>
                                        <span className="text-gray-900 font-medium"><Currency amount={parseFloat(shippingFee)} /></span>
                                    </div>
                                )}
                                <div className="border-t border-gray-200 pt-3 mt-3">
                                    <div className="flex justify-between">
                                        <span className="text-lg font-bold text-gray-900">Total</span>
                                        <span className="text-lg font-bold text-primary">
                                            <Currency amount={parseFloat(finalTotal)} />
                                        </span>
                                    </div>
                                </div>
                            </div>

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

                            <button
                                onClick={handlePurchase}
                                disabled={submitting || !product.isAvailable}
                                className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
    );
}

export default function PurchasePage() {
    return (
        <ProtectedRoute>
            <PurchaseContent />
        </ProtectedRoute>
    );
}
