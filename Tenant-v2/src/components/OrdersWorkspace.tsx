import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  Store,
  AlertTriangle,
  XCircle,
  CreditCard,
  Banknote,
  Wallet,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import {
  Language,
  TenantOrder,
  TenantOrderStats,
  TenantOrderPagination,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderPaymentMethod,
  OrderDeliveryType
} from '../types';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

export interface OrdersWorkspaceProps {
  lang: Language;
  darkMode?: boolean;
}

interface ToastMessage {
  id: string;
  msgAr: string;
  msgEn: string;
  type: 'success' | 'error' | 'info';
}

const STATUS_CONFIG: Record<OrderFulfillmentStatus, {
  labelAr: string;
  labelEn: string;
  bgLight: string;
  textLight: string;
  bgDark: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
}> = {
  pending: {
    labelAr: 'قيد الانتظار',
    labelEn: 'Pending',
    bgLight: 'bg-amber-50',
    textLight: 'text-amber-700',
    bgDark: 'dark:bg-amber-950/40',
    textDark: 'dark:text-amber-400',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-800/40'
  },
  confirmed: {
    labelAr: 'تم التأكيد',
    labelEn: 'Confirmed',
    bgLight: 'bg-blue-50',
    textLight: 'text-blue-700',
    bgDark: 'dark:bg-blue-950/40',
    textDark: 'dark:text-blue-400',
    borderLight: 'border-blue-200',
    borderDark: 'dark:border-blue-800/40'
  },
  processing: {
    labelAr: 'قيد التجهيز',
    labelEn: 'Processing',
    bgLight: 'bg-indigo-50',
    textLight: 'text-indigo-700',
    bgDark: 'dark:bg-indigo-950/40',
    textDark: 'dark:text-indigo-400',
    borderLight: 'border-indigo-200',
    borderDark: 'dark:border-indigo-800/40'
  },
  ready_for_pickup: {
    labelAr: 'جاهز للاستلام',
    labelEn: 'Ready for Pickup',
    bgLight: 'bg-purple-50',
    textLight: 'text-purple-700',
    bgDark: 'dark:bg-purple-950/40',
    textDark: 'dark:text-purple-400',
    borderLight: 'border-purple-200',
    borderDark: 'dark:border-purple-800/40'
  },
  shipped: {
    labelAr: 'تم الشحن',
    labelEn: 'Shipped',
    bgLight: 'bg-cyan-50',
    textLight: 'text-cyan-700',
    bgDark: 'dark:bg-cyan-950/40',
    textDark: 'dark:text-cyan-400',
    borderLight: 'border-cyan-200',
    borderDark: 'dark:border-cyan-800/40'
  },
  delivered: {
    labelAr: 'تم التوصيل',
    labelEn: 'Delivered',
    bgLight: 'bg-teal-50',
    textLight: 'text-teal-700',
    bgDark: 'dark:bg-teal-950/40',
    textDark: 'dark:text-teal-400',
    borderLight: 'border-teal-200',
    borderDark: 'dark:border-teal-800/40'
  },
  completed: {
    labelAr: 'مكتمل',
    labelEn: 'Completed',
    bgLight: 'bg-emerald-50',
    textLight: 'text-emerald-700',
    bgDark: 'dark:bg-emerald-950/40',
    textDark: 'dark:text-emerald-400',
    borderLight: 'border-emerald-200',
    borderDark: 'dark:border-emerald-800/40'
  },
  cancelled: {
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    bgLight: 'bg-rose-50',
    textLight: 'text-rose-700',
    bgDark: 'dark:bg-rose-950/40',
    textDark: 'dark:text-rose-400',
    borderLight: 'border-rose-200',
    borderDark: 'dark:border-rose-800/40'
  },
  refunded: {
    labelAr: 'مسترجع',
    labelEn: 'Refunded',
    bgLight: 'bg-neutral-100',
    textLight: 'text-neutral-700',
    bgDark: 'dark:bg-zinc-800',
    textDark: 'dark:text-neutral-300',
    borderLight: 'border-neutral-200',
    borderDark: 'dark:border-zinc-700'
  }
};

const PAYMENT_STATUS_CONFIG: Record<OrderPaymentStatus, {
  labelAr: string;
  labelEn: string;
  colorClass: string;
}> = {
  paid: {
    labelAr: 'مدفوع',
    labelEn: 'Paid',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
  },
  pending: {
    labelAr: 'بانتظار الدفع',
    labelEn: 'Pending',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40'
  },
  failed: {
    labelAr: 'فشل الدفع',
    labelEn: 'Failed',
    colorClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40'
  },
  refunded: {
    labelAr: 'مسترجع',
    labelEn: 'Refunded',
    colorClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/40'
  },
  partially_refunded: {
    labelAr: 'مسترجع جزئياً',
    labelEn: 'Partially Refunded',
    colorClass: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-zinc-800 dark:text-neutral-300 dark:border-zinc-700'
  }
};

const PAYMENT_METHOD_LABELS: Record<string, { labelAr: string; labelEn: string }> = {
  online: { labelAr: 'دفع إلكتروني', labelEn: 'Online Payment' },
  cash_on_delivery: { labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on Delivery' },
  pay_on_visit: { labelAr: 'الدفع عند الزيارة', labelEn: 'Pay on Visit' },
  split: { labelAr: 'دفع مجزأ', labelEn: 'Split Payment' },
  cash: { labelAr: 'نقدي', labelEn: 'Cash' },
  card_pos: { labelAr: 'شبكة / POS', labelEn: 'Card / POS' },
  wallet: { labelAr: 'المحفظة', labelEn: 'Wallet' }
};

export default function OrdersWorkspace({ lang, darkMode = false }: OrdersWorkspaceProps) {
  const isRtl = lang === 'ar';

  // Core Data States
  const [orders, setOrders] = useState<TenantOrder[]>([]);
  const [stats, setStats] = useState<TenantOrderStats>({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0
  });
  const [pagination, setPagination] = useState<TenantOrderPagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selected Order / Drawer State
  const [selectedOrder, setSelectedOrder] = useState<TenantOrder | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Action Modals State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderFulfillmentStatus | ''>('');
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [estimatedDeliveryInput, setEstimatedDeliveryInput] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethodInput, setPaymentMethodInput] = useState<'cash' | 'card_pos' | 'wallet'>('cash');
  const [transactionRefInput, setTransactionRefInput] = useState('');
  const [paymentNotesInput, setPaymentNotesInput] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const triggerToast = useCallback((en: string, ar: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, msgAr: ar, msgEn: en, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  // Fetch orders from tenant API
  const fetchOrders = useCallback(async (pageToLoad: number = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await tenantApiAdapter.getOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        paymentStatus: paymentStatusFilter !== 'all' ? paymentStatusFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchQuery.trim() || undefined,
        page: pageToLoad,
        limit: 20
      });

      if (res.success) {
        setOrders(res.orders || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
        if (res.stats) {
          setStats(res.stats);
        }
      } else {
        throw new Error('Failed to retrieve orders');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch tenant orders:', err);
      setError(message);
      triggerToast('Failed to load orders', 'فشل تحميل الطلبات', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, paymentStatusFilter, startDate, endDate, searchQuery, triggerToast]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  // View full order details in slide-over drawer
  const handleOpenOrderDetail = async (orderId: string) => {
    setIsDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await tenantApiAdapter.getOrder(orderId);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
      } else {
        throw new Error('Could not load order details');
      }
    } catch (err: unknown) {
      console.error('Failed to load order details:', err);
      triggerToast('Could not load order details', 'تعذر تحميل تفاصيل الطلب', 'error');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedOrder(null);
  };

  // Determine allowed transitions strictly according to backend business rules
  const getAllowedTransitions = (order: TenantOrder): OrderFulfillmentStatus[] => {
    const current = order.status;
    const isPickup = order.deliveryType === 'pickup';

    switch (current) {
      case 'pending':
        return ['confirmed', 'cancelled'];
      case 'confirmed':
        return ['processing', 'cancelled'];
      case 'processing':
        return isPickup ? ['ready_for_pickup', 'cancelled'] : ['shipped', 'cancelled'];
      case 'ready_for_pickup':
        return ['completed', 'cancelled'];
      case 'shipped':
        return ['delivered', 'cancelled'];
      case 'delivered':
        return ['completed'];
      case 'completed':
      case 'cancelled':
      case 'refunded':
      default:
        return [];
    }
  };

  // Submit Status Update
  const handleConfirmStatusUpdate = async () => {
    if (!selectedOrder || !targetStatus) return;

    if (targetStatus === 'completed' && selectedOrder.paymentStatus !== 'paid') {
      triggerToast(
        'Cannot complete an order with unpaid payment status. Please collect payment first.',
        'لا يمكن إكمال طلب لم يتم تسديد قيمته. يرجى تحصيل الدفعة أولاً.',
        'error'
      );
      return;
    }

    setIsSubmittingStatus(true);
    try {
      const res = await tenantApiAdapter.updateOrderStatus(selectedOrder.id, {
        status: targetStatus,
        trackingNumber: trackingNumberInput.trim() || undefined,
        estimatedDeliveryDate: estimatedDeliveryInput.trim() || undefined
      });

      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setOrders(prev => prev.map(o => o.id === res.order.id ? res.order : o));
        setStatusModalOpen(false);
        setTargetStatus('');
        setTrackingNumberInput('');
        setEstimatedDeliveryInput('');
        triggerToast('Order status updated successfully', 'تم تحديث حالة الطلب بنجاح', 'success');
        fetchOrders(pagination.page);
      } else {
        throw new Error(res.message || 'Status update failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Update status error:', err);
      triggerToast(msg || 'Failed to update order status', 'فشل تحديث حالة الطلب', 'error');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Submit Payment Collection
  const handleConfirmPaymentCollection = async () => {
    if (!selectedOrder) return;

    setIsSubmittingPayment(true);
    try {
      const res = await tenantApiAdapter.updateOrderPaymentStatus(selectedOrder.id, {
        paymentStatus: 'paid',
        paymentMethod: paymentMethodInput,
        transactionRef: transactionRefInput.trim() || undefined,
        notes: paymentNotesInput.trim() || undefined
      });

      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setOrders(prev => prev.map(o => o.id === res.order.id ? res.order : o));
        setPaymentModalOpen(false);
        setTransactionRefInput('');
        setPaymentNotesInput('');
        triggerToast('Payment collected successfully', 'تم تحصيل الدفعة بنجاح', 'success');
        fetchOrders(pagination.page);
      } else {
        throw new Error(res.message || 'Payment update failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Payment collection error:', err);
      triggerToast(msg || 'Failed to record payment', 'فشل تسجيل الدفعة', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const formatPrice = (amount: number | string | undefined | null) => {
    const num = Number(amount || 0);
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isRtl ? 'ر.س' : 'SAR'}`;
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className={`space-y-6 font-sans ${isRtl ? 'text-right' : 'text-left'}`}>

      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <ShoppingBag size={22} />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                {isRtl ? 'إدارة طلبات المنتجات' : 'Product Orders Management'}
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isRtl ? 'متابعة وتجهيز طلبات منتجات المتجر المسندة إلى الصالون' : 'Track and fulfill customer product purchases assigned to your branch'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders(pagination.page)}
            disabled={isLoading}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              darkMode
                ? 'border-zinc-850 hover:bg-zinc-850 text-zinc-300'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-brand-500' : ''} />
            <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Operational Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        <div className={`p-4 rounded-2xl border transition-all ${
          darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase">
              {isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
            </span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <ShoppingBag size={16} />
            </span>
          </div>
          <p className="text-2xl font-black mt-2 font-mono">
            {stats.total.toLocaleString()}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase">
              {isRtl ? 'قيد المعالجة والتجهيز' : 'Pending / Active'}
            </span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Clock size={16} />
            </span>
          </div>
          <p className="text-2xl font-black mt-2 font-mono text-amber-600 dark:text-amber-400">
            {stats.pending.toLocaleString()}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase">
              {isRtl ? 'الطلبات المكتملة' : 'Completed'}
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <p className="text-2xl font-black mt-2 font-mono text-emerald-600 dark:text-emerald-400">
            {stats.completed.toLocaleString()}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase">
              {isRtl ? 'الملغاة والمسترجعة' : 'Cancelled / Refunded'}
            </span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <XCircle size={16} />
            </span>
          </div>
          <p className="text-2xl font-black mt-2 font-mono text-rose-600 dark:text-rose-400">
            {stats.cancelled.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 3. Filters and Search Control Panel */}
      <div className={`p-4 rounded-2xl border space-y-3.5 ${
        darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-4 relative">
            <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'بحث برقم الطلب أو اسم العميل...' : 'Search order # or customer...'}
              className={`w-full py-2 text-xs rounded-xl border bg-transparent transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
              } ${darkMode ? 'border-zinc-800 text-white placeholder-zinc-500' : 'border-slate-200 text-slate-800 placeholder-slate-400'}`}
            />
          </div>

          {/* Payment Status Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className={`w-full py-2 px-3 text-xs rounded-xl border bg-transparent transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer ${
                darkMode ? 'border-zinc-800 text-white bg-zinc-900' : 'border-slate-200 text-slate-800 bg-white'
              }`}
            >
              <option value="all">{isRtl ? 'كل حالات الدفع' : 'All Payment Statuses'}</option>
              <option value="paid">{isRtl ? 'مدفوع' : 'Paid'}</option>
              <option value="pending">{isRtl ? 'بانتظار الدفع' : 'Pending'}</option>
              <option value="failed">{isRtl ? 'فشل الدفع' : 'Failed'}</option>
              <option value="refunded">{isRtl ? 'مسترجع' : 'Refunded'}</option>
            </select>
          </div>

          {/* Date Range Filters */}
          <div className="lg:col-span-5 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title={isRtl ? 'من تاريخ' : 'Start date'}
              className={`w-full py-1.5 px-2.5 text-xs rounded-xl border bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                darkMode ? 'border-zinc-800 text-white' : 'border-slate-200 text-slate-700'
              }`}
            />
            <span className="text-neutral-400 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title={isRtl ? 'إلى تاريخ' : 'End date'}
              className={`w-full py-1.5 px-2.5 text-xs rounded-xl border bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                darkMode ? 'border-zinc-800 text-white' : 'border-slate-200 text-slate-700'
              }`}
            />
          </div>
        </div>

        {/* Status Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs border-t pt-3 border-neutral-100 dark:border-zinc-800/80">
          {[
            { id: 'all', labelAr: 'الكل', labelEn: 'All' },
            { id: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending' },
            { id: 'confirmed', labelAr: 'مؤكد', labelEn: 'Confirmed' },
            { id: 'processing', labelAr: 'قيد التجهيز', labelEn: 'Processing' },
            { id: 'ready_for_pickup', labelAr: 'جاهز للاستلام', labelEn: 'Ready' },
            { id: 'shipped', labelAr: 'تم الشحن', labelEn: 'Shipped' },
            { id: 'delivered', labelAr: 'تم التوصيل', labelEn: 'Delivered' },
            { id: 'completed', labelAr: 'مكتمل', labelEn: 'Completed' },
            { id: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' }
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-xs font-bold'
                    : darkMode
                      ? 'bg-zinc-850/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {isRtl ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Orders Data Table / List */}
      <div className={`rounded-2xl border overflow-hidden ${
        darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-brand-500" />
            <span className="text-xs text-neutral-400 font-medium">
              {isRtl ? 'جارٍ تحميل الطلبات...' : 'Loading orders...'}
            </span>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3">
            <AlertTriangle size={32} className="mx-auto text-rose-500" />
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              onClick={() => fetchOrders(pagination.page)}
              className="px-4 py-1.5 text-xs rounded-xl bg-brand-500 text-white font-semibold cursor-pointer"
            >
              {isRtl ? 'إعادة المحاولة' : 'Try Again'}
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <ShoppingBag size={40} className="mx-auto text-neutral-300 dark:text-zinc-700 stroke-[1.5]" />
            <h3 className="text-base font-bold">
              {isRtl ? 'لا توجد طلبات' : 'No orders found'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {isRtl
                ? 'لم يتم العثور على طلبات مطابقة لمعايير البحث الحالية.'
                : 'No orders matched the current filtering criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                darkMode ? 'bg-zinc-950/40 border-zinc-850 text-neutral-400' : 'bg-slate-50 border-slate-100 text-slate-500'
              }`}>
                <tr>
                  <th className="py-3.5 px-4">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'العميل' : 'Customer'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'النوع والتوصيل' : 'Fulfillment'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'حالة الطلب' : 'Status'}</th>
                  <th className="py-3.5 px-4">{isRtl ? 'حالة الدفع' : 'Payment'}</th>
                  <th className="py-3.5 px-4 text-end">{isRtl ? 'الإجمالي' : 'Total'}</th>
                  <th className="py-3.5 px-4 text-center">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-zinc-850">
                {orders.map((order) => {
                  const statusMeta = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const paymentMeta = PAYMENT_STATUS_CONFIG[order.paymentStatus] || PAYMENT_STATUS_CONFIG.pending;
                  const itemCount = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors hover:bg-neutral-50/70 dark:hover:bg-zinc-850/40 ${
                        selectedOrder?.id === order.id ? (darkMode ? 'bg-brand-500/10' : 'bg-brand-50/50') : ''
                      }`}
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-brand-600 dark:text-brand-400">
                        {order.orderNumber}
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold">
                          {order.user?.firstName || order.user?.lastName
                            ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim()
                            : (isRtl ? 'عميل زائر' : 'Guest Customer')}
                        </div>
                        {order.user?.phone && (
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            {order.user.phone}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-400">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Delivery Type */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          order.deliveryType === 'delivery'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40'
                            : 'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-zinc-800 dark:text-neutral-300 dark:border-zinc-700'
                        }`}>
                          {order.deliveryType === 'delivery' ? <Truck size={12} /> : <Store size={12} />}
                          <span>{order.deliveryType === 'delivery' ? (isRtl ? 'توصيل' : 'Delivery') : (isRtl ? 'استلام' : 'Pickup')}</span>
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                          {itemCount} {isRtl ? 'منتجات' : 'items'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          statusMeta.bgLight
                        } ${statusMeta.textLight} ${statusMeta.borderLight} ${statusMeta.bgDark} ${statusMeta.textDark} ${statusMeta.borderDark}`}>
                          {isRtl ? statusMeta.labelAr : statusMeta.labelEn}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${paymentMeta.colorClass}`}>
                          {isRtl ? paymentMeta.labelAr : paymentMeta.labelEn}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-end font-mono font-bold text-sm">
                        {formatPrice(order.totalAmount)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenOrderDetail(order.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                            darkMode
                              ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-200'
                              : 'border-slate-200 hover:bg-slate-100 text-slate-800 shadow-2xs'
                          }`}
                        >
                          <Eye size={13} />
                          <span>{isRtl ? 'عرض' : 'View'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className={`p-3.5 flex items-center justify-between border-t text-xs ${
            darkMode ? 'bg-zinc-950/50 border-zinc-850 text-neutral-400' : 'bg-slate-50/60 border-slate-100 text-slate-600'
          }`}>
            <span>
              {isRtl
                ? `صفحة ${pagination.page} من ${pagination.totalPages} (${pagination.total} طلب)`
                : `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} orders)`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => fetchOrders(pagination.page - 1)}
                className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => fetchOrders(pagination.page + 1)}
                className="p-1.5 rounded-lg border disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Slide-Over Order Detail Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDrawer}
              className="absolute inset-0 bg-neutral-950/60 backdrop-blur-xs"
            />

            <div className={`fixed inset-y-0 ${isRtl ? 'left-0' : 'right-0'} max-w-full flex`}>
              <motion.div
                initial={{ x: isRtl ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: isRtl ? '-100%' : '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className={`w-screen max-w-xl flex flex-col shadow-2xl overflow-y-auto ${
                  darkMode ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-slate-800'
                }`}
              >
                {drawerLoading || !selectedOrder ? (
                  <div className="flex-1 flex items-center justify-center py-20">
                    <RefreshCw size={24} className="animate-spin text-brand-500" />
                  </div>
                ) : (
                  <>
                    {/* Drawer Header */}
                    <div className={`p-5 border-b sticky top-0 z-10 flex items-center justify-between ${
                      darkMode ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-slate-200'
                    } backdrop-blur-md`}>
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                          <ShoppingBag size={20} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-mono font-bold text-base md:text-lg text-brand-600 dark:text-brand-400">
                              {selectedOrder.orderNumber}
                            </h2>
                          </div>
                          <p className="text-[10px] text-neutral-400">
                            {isRtl ? 'تاريخ الإنشاء:' : 'Created:'} {formatDate(selectedOrder.createdAt)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleCloseDrawer}
                        className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="p-5 space-y-5 flex-1">

                      {/* Status Summary & Quick Actions */}
                      <div className={`p-4 rounded-2xl border space-y-3.5 ${
                        darkMode ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {/* Fulfillment Status */}
                            {(() => {
                              const s = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.pending;
                              return (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${s.bgLight} ${s.textLight} ${s.borderLight} ${s.bgDark} ${s.textDark} ${s.borderDark}`}>
                                  {isRtl ? s.labelAr : s.labelEn}
                                </span>
                              );
                            })()}

                            {/* Payment Status */}
                            {(() => {
                              const p = PAYMENT_STATUS_CONFIG[selectedOrder.paymentStatus] || PAYMENT_STATUS_CONFIG.pending;
                              return (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${p.colorClass}`}>
                                  {isRtl ? p.labelAr : p.labelEn}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Order Action Buttons */}
                          <div className="flex items-center gap-2">
                            {/* Update Status Button */}
                            {getAllowedTransitions(selectedOrder).length > 0 && (
                              <button
                                onClick={() => {
                                  setTargetStatus('');
                                  setStatusModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                              >
                                {isRtl ? 'تحديث الحالة' : 'Update Status'}
                              </button>
                            )}

                            {/* Collect Payment Button */}
                            {selectedOrder.paymentStatus !== 'paid' && (
                              <button
                                onClick={() => {
                                  setPaymentMethodInput('cash');
                                  setPaymentModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <DollarSign size={13} />
                                <span>{isRtl ? 'تحصيل الدفعة' : 'Collect Payment'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Payment Method Details */}
                        <div className="text-xs flex items-center justify-between text-neutral-500 dark:text-neutral-400 pt-2 border-t border-neutral-200/60 dark:border-zinc-800">
                          <span>{isRtl ? 'طريقة الدفع المختارة:' : 'Payment Method:'}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod]
                              ? (isRtl ? PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod].labelAr : PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod].labelEn)
                              : selectedOrder.paymentMethod}
                          </span>
                        </div>
                      </div>

                      {/* Customer Information Card */}
                      <div className={`p-4 rounded-2xl border space-y-2.5 ${
                        darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
                      }`}>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                          <User size={14} />
                          <span>{isRtl ? 'معلومات العميل' : 'Customer Information'}</span>
                        </h4>
                        <div className="text-xs space-y-1.5">
                          <div className="font-bold text-sm">
                            {selectedOrder.user?.firstName || selectedOrder.user?.lastName
                              ? `${selectedOrder.user.firstName || ''} ${selectedOrder.user.lastName || ''}`.trim()
                              : (isRtl ? 'عميل زائر' : 'Guest Customer')}
                          </div>
                          {selectedOrder.user?.phone && (
                            <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                              <Phone size={12} />
                              <span className="font-mono">{selectedOrder.user.phone}</span>
                            </div>
                          )}
                          {selectedOrder.user?.email && (
                            <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                              <Mail size={12} />
                              <span>{selectedOrder.user.email}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fulfillment & Delivery Details */}
                      <div className={`p-4 rounded-2xl border space-y-2.5 ${
                        darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
                      }`}>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                          {selectedOrder.deliveryType === 'delivery' ? <Truck size={14} /> : <Store size={14} />}
                          <span>{isRtl ? 'بيانات التوصيل والاستلام' : 'Fulfillment Details'}</span>
                        </h4>

                        <div className="text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">{isRtl ? 'نوع التسليم:' : 'Delivery Type:'}</span>
                            <span className="font-bold">
                              {selectedOrder.deliveryType === 'delivery'
                                ? (isRtl ? 'توصيل إلى العنوان' : 'Delivery to Address')
                                : (isRtl ? 'استلام من الصالون' : 'Pickup at Salon')}
                            </span>
                          </div>

                          {/* Delivery Address */}
                          {selectedOrder.deliveryType === 'delivery' && selectedOrder.shippingAddress && (
                            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950/40 border border-neutral-200/50 dark:border-zinc-800/60 space-y-1">
                              <div className="flex items-start gap-1.5 text-neutral-700 dark:text-neutral-300">
                                <MapPin size={14} className="shrink-0 mt-0.5 text-brand-500" />
                                <div>
                                  {selectedOrder.shippingAddress.street && <p>{selectedOrder.shippingAddress.street}</p>}
                                  {selectedOrder.shippingAddress.city && (
                                    <p className="text-neutral-400">
                                      {selectedOrder.shippingAddress.city}
                                      {selectedOrder.shippingAddress.district ? `, ${selectedOrder.shippingAddress.district}` : ''}
                                    </p>
                                  )}
                                  {selectedOrder.shippingAddress.notes && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                      {isRtl ? 'ملاحظة:' : 'Note:'} {selectedOrder.shippingAddress.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Pickup Date */}
                          {selectedOrder.deliveryType === 'pickup' && selectedOrder.pickupDate && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400">{isRtl ? 'تاريخ الاستلام المحدد:' : 'Pickup Date:'}</span>
                              <span className="font-mono">{formatDate(selectedOrder.pickupDate)}</span>
                            </div>
                          )}

                          {/* Tracking Number */}
                          {selectedOrder.trackingNumber && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400">{isRtl ? 'رقم التتبع:' : 'Tracking #:'}</span>
                              <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                                {selectedOrder.trackingNumber}
                              </span>
                            </div>
                          )}

                          {/* Estimated Delivery */}
                          {selectedOrder.estimatedDeliveryDate && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400">{isRtl ? 'تاريخ التوصيل المتوقع:' : 'Estimated Delivery:'}</span>
                              <span className="font-mono">{formatDate(selectedOrder.estimatedDeliveryDate)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items Breakdown Table */}
                      <div className={`p-4 rounded-2xl border space-y-3 ${
                        darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
                      }`}>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                          <Package size={14} />
                          <span>{isRtl ? 'المنتجات المطلوبة' : 'Order Items'}</span>
                        </h4>

                        <div className="divide-y divide-neutral-100 dark:divide-zinc-850">
                          {selectedOrder.items && selectedOrder.items.length > 0 ? (
                            selectedOrder.items.map((it) => (
                              <div key={it.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2.5">
                                  {it.product?.image ? (
                                    <img
                                      src={it.product.image}
                                      alt={it.productName}
                                      className="w-10 h-10 rounded-lg object-cover border border-neutral-200 dark:border-zinc-800 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center text-neutral-400 shrink-0">
                                      <Package size={18} />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold">
                                      {isRtl ? (it.productNameAr || it.productName) : it.productName}
                                    </p>
                                    <p className="text-[10px] text-neutral-400 font-mono">
                                      {it.quantity} × {formatPrice(it.unitPrice)}
                                    </p>
                                  </div>
                                </div>
                                <div className="font-mono font-bold">
                                  {formatPrice(it.totalPrice)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-neutral-400 py-3 text-center">
                              {isRtl ? 'لا توجد بيانات للمنتجات' : 'No items found'}
                            </p>
                          )}
                        </div>

                        {/* Financial Totals */}
                        <div className="pt-3 border-t border-neutral-100 dark:border-zinc-800 text-xs space-y-1.5">
                          <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                            <span>{isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                            <span className="font-mono">{formatPrice(selectedOrder.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                            <span>{isRtl ? 'ضريبة القيمة المضافة (15%):' : 'VAT (15%):'}</span>
                            <span className="font-mono">{formatPrice(selectedOrder.taxAmount)}</span>
                          </div>
                          {Number(selectedOrder.shippingFee) > 0 && (
                            <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                              <span>{isRtl ? 'رسوم التوصيل:' : 'Shipping Fee:'}</span>
                              <span className="font-mono">{formatPrice(selectedOrder.shippingFee)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-black pt-2 border-t border-neutral-200 dark:border-zinc-800">
                            <span>{isRtl ? 'الإجمالي الكلي:' : 'Total Amount:'}</span>
                            <span className="font-mono text-brand-600 dark:text-brand-400">
                              {formatPrice(selectedOrder.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Payment Transactions Record */}
                      {selectedOrder.paymentTransactions && selectedOrder.paymentTransactions.length > 0 && (
                        <div className={`p-4 rounded-2xl border space-y-3 ${
                          darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
                        }`}>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                            <CreditCard size={14} />
                            <span>{isRtl ? 'سجل العمليات المالية' : 'Payment Transactions'}</span>
                          </h4>

                          <div className="space-y-2">
                            {selectedOrder.paymentTransactions.map((tx) => (
                              <div
                                key={tx.id}
                                className="p-2.5 rounded-xl border border-neutral-100 dark:border-zinc-800 text-xs flex justify-between items-center"
                              >
                                <div>
                                  <div className="font-bold">
                                    {PAYMENT_METHOD_LABELS[tx.paymentMethod]
                                      ? (isRtl ? PAYMENT_METHOD_LABELS[tx.paymentMethod].labelAr : PAYMENT_METHOD_LABELS[tx.paymentMethod].labelEn)
                                      : tx.paymentMethod}
                                  </div>
                                  <div className="text-[10px] text-neutral-400">
                                    {formatDate(tx.processedAt)}
                                    {tx.processor?.name ? ` • ${tx.processor.name}` : ''}
                                  </div>
                                </div>
                                <div className="text-end">
                                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatPrice(tx.amount)}
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-zinc-800 uppercase font-semibold">
                                    {tx.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {selectedOrder.notes && (
                        <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
                          darkMode ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <span className="font-bold text-neutral-400 flex items-center gap-1">
                            <FileText size={12} />
                            <span>{isRtl ? 'ملاحظات العميل:' : 'Customer Notes:'}</span>
                          </span>
                          <p>{selectedOrder.notes}</p>
                        </div>
                      )}

                    </div>
                  </>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Status Update Modal */}
      <AnimatePresence>
        {statusModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStatusModalOpen(false)}
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 ${
                darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-zinc-800">
                <h3 className="font-bold text-base">
                  {isRtl ? 'تحديث حالة الطلب' : 'Update Order Status'}
                </h3>
                <button
                  onClick={() => setStatusModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs space-y-3">
                <div>
                  <label className="block text-neutral-400 mb-1.5 font-medium">
                    {isRtl ? 'الحالة الجديدة:' : 'New Status:'}
                  </label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as OrderFulfillmentStatus)}
                    className={`w-full p-2.5 rounded-xl border bg-transparent text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none ${
                      darkMode ? 'border-zinc-800 text-white bg-zinc-900' : 'border-slate-200 text-slate-800 bg-white'
                    }`}
                  >
                    <option value="">{isRtl ? '-- اختر الحالة --' : '-- Select Status --'}</option>
                    {getAllowedTransitions(selectedOrder).map((st) => {
                      const cfg = STATUS_CONFIG[st];
                      return (
                        <option key={st} value={st}>
                          {isRtl ? cfg.labelAr : cfg.labelEn}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Additional fields if shipping */}
                {targetStatus === 'shipped' && (
                  <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-zinc-800">
                    <div>
                      <label className="block text-neutral-400 mb-1 font-medium">
                        {isRtl ? 'رقم التتبع (اختياري):' : 'Tracking Number (Optional):'}
                      </label>
                      <input
                        type="text"
                        value={trackingNumberInput}
                        onChange={(e) => setTrackingNumberInput(e.target.value)}
                        placeholder="TRK-12345678"
                        className={`w-full p-2 rounded-xl border bg-transparent font-mono ${
                          darkMode ? 'border-zinc-800 text-white' : 'border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-400 mb-1 font-medium">
                        {isRtl ? 'تاريخ التوصيل المتوقع (اختياري):' : 'Estimated Delivery Date (Optional):'}
                      </label>
                      <input
                        type="date"
                        value={estimatedDeliveryInput}
                        onChange={(e) => setEstimatedDeliveryInput(e.target.value)}
                        className={`w-full p-2 rounded-xl border bg-transparent ${
                          darkMode ? 'border-zinc-800 text-white' : 'border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isSubmittingStatus}
                  onClick={() => setStatusModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={!targetStatus || isSubmittingStatus}
                  onClick={handleConfirmStatusUpdate}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {isSubmittingStatus && <RefreshCw size={12} className="animate-spin" />}
                  <span>{isRtl ? 'تأكيد التحديث' : 'Confirm Update'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Payment Collection Modal */}
      <AnimatePresence>
        {paymentModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPaymentModalOpen(false)}
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 ${
                darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-zinc-800">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-500" />
                  <span>{isRtl ? 'تحصيل دفعة الطلب' : 'Collect Order Payment'}</span>
                </h3>
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs flex justify-between items-center">
                <span className="text-neutral-500 dark:text-neutral-400">
                  {isRtl ? 'المبلغ المطلوب تحصيله:' : 'Amount Due:'}
                </span>
                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                  {formatPrice(selectedOrder.totalAmount)}
                </span>
              </div>

              <div className="text-xs space-y-3">
                <div>
                  <label className="block text-neutral-400 mb-1.5 font-medium">
                    {isRtl ? 'طريقة التحصيل:' : 'Payment Method:'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', labelAr: 'نقدي', labelEn: 'Cash', icon: Banknote },
                      { id: 'card_pos', labelAr: 'شبكة POS', labelEn: 'Card POS', icon: CreditCard },
                      { id: 'wallet', labelAr: 'المحفظة', labelEn: 'Wallet', icon: Wallet }
                    ].map((method) => {
                      const Icon = method.icon;
                      const isSelected = paymentMethodInput === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethodInput(method.id as 'cash' | 'card_pos' | 'wallet')}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-bold'
                              : 'border-neutral-200 dark:border-zinc-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-zinc-850'
                          }`}
                        >
                          <Icon size={16} />
                          <span className="text-[11px]">{isRtl ? method.labelAr : method.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">
                    {isRtl ? 'رقم الإيصال / المرجع (اختياري):' : 'Receipt / Transaction Ref (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={transactionRefInput}
                    onChange={(e) => setTransactionRefInput(e.target.value)}
                    placeholder="POS-REF-9921"
                    className={`w-full p-2 rounded-xl border bg-transparent font-mono ${
                      darkMode ? 'border-zinc-800 text-white' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">
                    {isRtl ? 'ملاحظات التحصيل (اختياري):' : 'Collection Notes (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={paymentNotesInput}
                    onChange={(e) => setPaymentNotesInput(e.target.value)}
                    placeholder={isRtl ? 'تم الاستلام نقداً في الفرع' : 'Collected in cash at salon'}
                    className={`w-full p-2 rounded-xl border bg-transparent ${
                      darkMode ? 'border-zinc-800 text-white' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isSubmittingPayment}
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingPayment}
                  onClick={handleConfirmPaymentCollection}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {isSubmittingPayment && <RefreshCw size={12} className="animate-spin" />}
                  <span>{isRtl ? 'تأكيد تسجيل الدفع' : 'Confirm Payment'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. Toast Alerts Portal */}
      <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none`}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className={`p-3.5 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-medium pointer-events-auto ${
                toast.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/80 dark:border-rose-850 dark:text-rose-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-850 dark:text-emerald-200'
              }`}
            >
              {toast.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              <span>{isRtl ? toast.msgAr : toast.msgEn}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
