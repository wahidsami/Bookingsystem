"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";

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
  createdAt: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
  user?: User;
  items?: OrderItem[];
}

export default function OrdersPage() {
  const t = useTranslations("Orders");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0
  });
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of current month
    return date.toISOString().split('T')[0];
  });
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    loadOrders();
  }, [startDate, endDate, filterStatus, filterPaymentStatus, search]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await tenantApi.getOrders({
        status: filterStatus || undefined,
        paymentStatus: filterPaymentStatus || undefined,
        startDate,
        endDate,
        search: search || undefined,
        page: 1,
        limit: 50
      });

      if (response.success) {
        setOrders(response.orders || []);
        if (response.stats) {
          setStats(response.stats);
        }
      } else {
        setError(response.message || t("loadError"));
      }
    } catch (err: any) {
      console.error("Failed to load orders:", err);
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
          <div className="text-sm font-medium text-blue-600 mb-1">{t("totalOrders")}</div>
          <div className="text-2xl font-bold text-blue-800">{stats.total}</div>
        </div>
        <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200">
          <div className="text-sm font-medium text-yellow-600 mb-1">{t("pendingOrders")}</div>
          <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
          <div className="text-sm font-medium text-green-600 mb-1">{t("completedOrders")}</div>
          <div className="text-2xl font-bold text-green-800">{stats.completed}</div>
        </div>
        <div className="card bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
          <div className="text-sm font-medium text-red-600 mb-1">{t("cancelledOrders")}</div>
          <div className="text-2xl font-bold text-red-800">{stats.cancelled}</div>
        </div>
      </div>

      {/* Filters */}
      <div className={`card mb-6 ${isRTL ? 'text-right' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t("filters")}
        </h3>
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 ${isRTL ? 'md:grid-cols-2 lg:grid-cols-6' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("startDate")}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("endDate")}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("status")}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="">{t("allStatuses")}</option>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("paymentStatus")}
            </label>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="">{t("allPaymentStatuses")}</option>
              <option value="pending">{t("paymentPending")}</option>
              <option value="paid">{t("paid")}</option>
              <option value="failed">{t("failed")}</option>
              <option value="refunded">{t("refunded")}</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("search")}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noOrders")}</h3>
          <p className="text-gray-600">{t("noOrdersDesc")}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t("orderNumber")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t("customer")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t("items")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t("paymentMethod")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-center' : 'text-center'}`}>
                    {t("status")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-center' : 'text-center'}`}>
                    {t("paymentStatus")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t("totalAmount")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t("date")}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{order.orderNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.user ? (
                        <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            {order.user.photo ? (
                              <img
                                src={order.user.photo.startsWith('/') ? `http://localhost:5000${order.user.photo}` : `http://localhost:5000/uploads/${order.user.photo}`}
                                alt={`${order.user.firstName} ${order.user.lastName}`}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center hidden">
                              <span className="text-primary-600 font-medium text-sm">
                                {order.user.firstName.charAt(0)}{order.user.lastName.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {order.user.firstName} {order.user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{order.user.phone}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">{t("guest")}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {order.items && order.items.length > 0 ? (
                        <div className="text-sm text-gray-900">
                          {order.items.length} {order.items.length === 1 ? t("item") : t("items")}
                          <div className="text-xs text-gray-500 mt-1">
                            {order.items.slice(0, 2).map((item, idx) => (
                              <div key={idx}>
                                {locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName} × {item.quantity}
                              </div>
                            ))}
                            {order.items.length > 2 && (
                              <div>+{order.items.length - 2} {t("more")}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.paymentMethod === 'online' && '💳 ' + t("online")}
                        {order.paymentMethod === 'cash_on_delivery' && '🚚 ' + t("cashOnDelivery")}
                        {order.paymentMethod === 'pay_on_visit' && '🏢 ' + t("payOnVisit")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.deliveryType === 'pickup' ? '🏪 ' + t("pickup") : '🚚 ' + t("delivery")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {t(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {t(order.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <div className="font-semibold text-gray-900">
                        <Currency amount={order.totalAmount} />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <div className="text-sm text-gray-900">{formatDate(order.createdAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <button
                        onClick={() => router.push(`/${locale}/dashboard/orders/${order.id}`)}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                      >
                        {t("viewDetails")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
