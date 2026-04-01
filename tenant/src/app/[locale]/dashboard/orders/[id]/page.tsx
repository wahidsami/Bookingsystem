"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface OrderItem {
  id: string;
  productName: string;
  productNameAr?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: {
    id: string;
    name_en: string;
    name_ar?: string;
    image?: string;
    category?: string;
  };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'processing' | 'ready_for_pickup' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  paymentMethod: 'online' | 'cash_on_delivery' | 'pay_on_visit';
  deliveryType: 'pickup' | 'delivery';
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  platformFee: number;
  createdAt: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
  shippingAddress?: any;
  pickupDate?: string;
  notes?: string;
  user?: User;
  items?: OrderItem[];
}

export default function OrderDetailsPage() {
  const t = useTranslations("Orders");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [newPaymentStatus, setNewPaymentStatus] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<string>("");

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await tenantApi.getOrder(orderId);

      if (response.success) {
        setOrder(response.order);
        setTrackingNumber(response.order.trackingNumber || "");
        setEstimatedDeliveryDate(response.order.estimatedDeliveryDate ? new Date(response.order.estimatedDeliveryDate).toISOString().split('T')[0] : "");
      } else {
        setError(response.message || t("loadError"));
      }
    } catch (err: any) {
      console.error("Failed to load order:", err);
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    try {
      setUpdating(true);
      const response = await tenantApi.updateOrderStatus(
        orderId,
        newStatus,
        trackingNumber || undefined,
        estimatedDeliveryDate || undefined
      );

      if (response.success) {
        setOrder(response.order);
        setShowStatusModal(false);
        setNewStatus("");
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert(err.message || t("updateError"));
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentStatusUpdate = async () => {
    if (!newPaymentStatus) return;

    try {
      setUpdating(true);
      const response = await tenantApi.updateOrderPaymentStatus(orderId, newPaymentStatus);

      if (response.success) {
        setOrder(response.order);
        setShowPaymentModal(false);
        setNewPaymentStatus("");
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update payment status:", err);
      alert(err.message || t("updateError"));
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      case 'ready_for_pickup': return 'bg-indigo-100 text-indigo-800';
      case 'shipped': return 'bg-cyan-100 text-cyan-800';
      case 'delivered': return 'bg-teal-100 text-teal-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
      case 'partially_refunded': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </TenantLayout>
    );
  }

  if (error || !order) {
    return (
      <TenantLayout>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error || t("orderNotFound")}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            {t("goBack")}
          </button>
        </div>
      </TenantLayout>
    );
  }

  const userName = order.user ? `${order.user.firstName} ${order.user.lastName}` : t("guest");

  return (
    <TenantLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            {isRTL ? <ArrowLeftIcon className="w-5 h-5 rotate-180" /> : <ArrowLeftIcon className="w-5 h-5" />}
          </button>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("orderDetails")} - {order.orderNumber}
            </h1>
            <p className="text-gray-500">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t("orderStatus")}</label>
                <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(order.status)}`}>
                  {t(order.status)}
                </span>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t("paymentStatus")}</label>
                <span className={`px-4 py-2 text-sm font-medium rounded-full ${getPaymentStatusColor(order.paymentStatus)}`}>
                  {t(order.paymentStatus)}
                </span>
              </div>
            </div>
            <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button
                onClick={() => {
                  setNewStatus(order.status);
                  setShowStatusModal(true);
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t("updateStatus")}
              </button>
              {(order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'pay_on_visit') && order.paymentStatus === 'pending' && (
                <button
                  onClick={() => {
                    setNewPaymentStatus(order.paymentStatus);
                    setShowPaymentModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t("confirmPayment")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t("customerDetails")}
          </h3>
          {order.user ? (
            <div className="flex items-center gap-4 mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                {order.user.photo ? (
                  <>
                    <img
                      src={getImageUrl(order.user.photo)}
                      alt={userName}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center hidden">
                      <span className="text-primary-600 font-semibold text-xl">
                        {order.user.firstName.charAt(0)}{order.user.lastName.charAt(0)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-primary-600 font-semibold text-xl">
                    {order.user.firstName.charAt(0)}{order.user.lastName.charAt(0)}
                  </span>
                )}
              </div>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <p className="text-lg font-semibold text-gray-900">{userName}</p>
                <p className="text-sm text-gray-600">{order.user.email}</p>
                <p className="text-sm text-gray-600">{order.user.phone}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">{t("guestOrder")}</p>
          )}
        </div>

        {/* Order Items */}
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t("orderItems")}
          </h3>
          {order.items && order.items.length > 0 ? (
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  {item.product?.image && (
                    <img
                      src={getImageUrl(item.product.image)}
                      alt={locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <p className="font-semibold text-gray-900">
                      {locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t("quantity")}: {item.quantity} × <Currency amount={item.unitPrice} />
                    </p>
                  </div>
                  <div className="font-semibold text-gray-900" style={{ textAlign: isRTL ? 'left' : 'right' }}>
                    <Currency amount={item.totalPrice} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">{t("noItems")}</p>
          )}
        </div>

        {/* Order Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment & Delivery Info */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("paymentAndDelivery")}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span className="text-gray-600">{t("paymentMethod")}:</span>
                <span className="font-medium">
                  {order.paymentMethod === 'online' && '💳 ' + t("online")}
                  {order.paymentMethod === 'cash_on_delivery' && '🚚 ' + t("cashOnDelivery")}
                  {order.paymentMethod === 'pay_on_visit' && '🏢 ' + t("payOnVisit")}
                </span>
              </div>
              <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span className="text-gray-600">{t("deliveryType")}:</span>
                <div className="text-end" style={{ textAlign: isRTL ? 'left' : 'right' }}>
                  <span className="font-medium block">
                    {order.deliveryType === 'pickup' ? '🏪 ' + t("pickup") : '🚚 ' + t("delivery")}
                  </span>
                  {order.deliveryType === 'pickup' && (
                    <span className="text-xs text-gray-500 block mt-1">
                      {order.paymentMethod === 'online' 
                        ? (locale === 'ar' ? '(العميل يستلم من الصالون)' : '(Customer picks up from salon)')
                        : (locale === 'ar' ? '(العميل يستلم من الصالون)' : '(Customer picks up from salon)')
                      }
                    </span>
                  )}
                  {order.deliveryType === 'delivery' && (
                    <span className="text-xs text-gray-500 block mt-1">
                      {locale === 'ar' ? '(سيتم التوصيل للعميل)' : '(Will be delivered to customer)'}
                    </span>
                  )}
                </div>
              </div>
              {order.shippingAddress && (
                <div>
                  <span className="text-gray-600 block mb-2">{t("shippingAddress")}:</span>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm">
                    {typeof order.shippingAddress === 'string' ? (
                      <pre className="whitespace-pre-wrap">{order.shippingAddress}</pre>
                    ) : (
                      <>
                        {order.shippingAddress.street && <div>{order.shippingAddress.street}</div>}
                        {order.shippingAddress.city && <div>{order.shippingAddress.city}</div>}
                        {order.shippingAddress.building && <div>{t("building")}: {order.shippingAddress.building}</div>}
                        {order.shippingAddress.phone && <div>{t("phone")}: {order.shippingAddress.phone}</div>}
                      </>
                    )}
                  </div>
                </div>
              )}
              {order.pickupDate && (
                <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span className="text-gray-600">{t("pickupDate")}:</span>
                  <span className="font-medium">{formatDate(order.pickupDate)}</span>
                </div>
              )}
              {order.trackingNumber && (
                <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span className="text-gray-600">{t("trackingNumber")}:</span>
                  <span className="font-medium font-mono">{order.trackingNumber}</span>
                </div>
              )}
              {order.estimatedDeliveryDate && (
                <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span className="text-gray-600">{t("estimatedDelivery")}:</span>
                  <span className="font-medium">{formatDate(order.estimatedDeliveryDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("priceBreakdown")}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span className="text-gray-600">{t("subtotal")}:</span>
                <span className="font-medium"><Currency amount={order.subtotal} /></span>
              </div>
              <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span className="text-gray-600">{t("tax")} (15%):</span>
                <span className="font-medium"><Currency amount={order.taxAmount} /></span>
              </div>
              {order.shippingFee > 0 && (
                <div className="flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span className="text-gray-600">{t("shippingFee")}:</span>
                  <span className="font-medium"><Currency amount={order.shippingFee} /></span>
                </div>
              )}
              <div className="flex justify-between text-red-600" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span>{t("platformFee")}:</span>
                <span className="font-medium">- <Currency amount={order.platformFee} /></span>
              </div>
              <div className="pt-3 border-t border-gray-200 flex justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span className="text-lg font-semibold text-gray-900">{t("totalAmount")}:</span>
                <span className="text-lg font-bold text-primary">
                  <Currency amount={order.totalAmount} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("notes")}
            </h3>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {order.notes}
            </p>
          </div>
        )}

        {/* Status Update Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("updateOrderStatus")}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("newStatus")}
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="pending">{t("pending")}</option>
                    <option value="confirmed">{t("confirmed")}</option>
                    <option value="processing">{t("processing")}</option>
                    <option value="ready_for_pickup">{t("readyForPickup")}</option>
                    <option value="shipped">{t("shipped")}</option>
                    <option value="delivered">{t("delivered")}</option>
                    <option value="completed">{t("completed")}</option>
                    <option value="cancelled">{t("cancelled")}</option>
                  </select>
                </div>
                {newStatus === 'shipped' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("trackingNumber")}
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={t("trackingNumberPlaceholder")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("estimatedDeliveryDate")}
                      </label>
                      <input
                        type="date"
                        value={estimatedDeliveryDate}
                        onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={updating || !newStatus}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {updating ? t("updating") : t("update")}
                  </button>
                  <button
                    onClick={() => {
                      setShowStatusModal(false);
                      setNewStatus("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Status Update Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("updatePaymentStatus")}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("newPaymentStatus")}
                  </label>
                  <select
                    value={newPaymentStatus}
                    onChange={(e) => setNewPaymentStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="pending">{t("paymentPending")}</option>
                    <option value="paid">{t("paid")}</option>
                    <option value="failed">{t("failed")}</option>
                    <option value="refunded">{t("refunded")}</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <button
                    onClick={handlePaymentStatusUpdate}
                    disabled={updating || !newPaymentStatus}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {updating ? t("updating") : t("confirm")}
                  </button>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setNewPaymentStatus("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
