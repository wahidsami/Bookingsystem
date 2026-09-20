/**
 * BarSpa Centralized Semantic Status Tokens
 * 
 * CORE PRINCIPLE: STATUS MUST NEVER LOOK DISABLED.
 * Every semantic state guarantees high contrast, rich visual roles,
 * distinct semantic meaning, and seamless light/dark mode support.
 */

export interface SemanticStatusStyle {
  labelAr: string;
  labelEn: string;
  /** Badge container classes */
  badgeClass: string;
  /** Dot indicator class */
  dotClass: string;
  /** Semantic role */
  role: 'active' | 'processing' | 'success' | 'pending' | 'alert' | 'info';
}

/**
 * Canonical Order Fulfillment Status Tokens
 */
export const BARSPA_ORDER_STATUS: Record<string, SemanticStatusStyle> = {
  pending: {
    labelAr: 'قيد الانتظار',
    labelEn: 'Pending',
    badgeClass: 'badge-status-pending',
    dotClass: 'bg-amber-500',
    role: 'pending',
  },
  confirmed: {
    labelAr: 'تم التأكيد',
    labelEn: 'Confirmed',
    badgeClass: 'badge-status-confirmed',
    dotClass: 'bg-[#6537C0]',
    role: 'active',
  },
  processing: {
    labelAr: 'قيد التجهيز',
    labelEn: 'Processing',
    badgeClass: 'badge-status-processing',
    dotClass: 'bg-indigo-500',
    role: 'processing',
  },
  ready_for_pickup: {
    labelAr: 'جاهز للاستلام',
    labelEn: 'Ready for Pickup',
    badgeClass: 'badge-status-confirmed',
    dotClass: 'bg-[#6537C0]',
    role: 'active',
  },
  shipped: {
    labelAr: 'تم الشحن',
    labelEn: 'Shipped',
    badgeClass: 'badge-status-shipped',
    dotClass: 'bg-sky-500',
    role: 'info',
  },
  delivered: {
    labelAr: 'تم التوصيل',
    labelEn: 'Delivered',
    badgeClass: 'badge-status-completed',
    dotClass: 'bg-emerald-500',
    role: 'success',
  },
  completed: {
    labelAr: 'مكتمل',
    labelEn: 'Completed',
    badgeClass: 'badge-status-completed',
    dotClass: 'bg-emerald-500',
    role: 'success',
  },
  cancelled: {
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    badgeClass: 'badge-status-cancelled',
    dotClass: 'bg-rose-500',
    role: 'alert',
  },
  refunded: {
    labelAr: 'مسترجع',
    labelEn: 'Refunded',
    badgeClass: 'badge-status-cancelled',
    dotClass: 'bg-rose-500',
    role: 'alert',
  },
};

/**
 * Canonical Appointment Status Tokens
 */
export const BARSPA_APPOINTMENT_STATUS: Record<string, SemanticStatusStyle> = {
  booked: {
    labelAr: 'محجوز',
    labelEn: 'Booked',
    badgeClass: 'badge-status-confirmed',
    dotClass: 'bg-[#6537C0]',
    role: 'active',
  },
  confirmed: {
    labelAr: 'مؤكد',
    labelEn: 'Confirmed',
    badgeClass: 'badge-status-confirmed',
    dotClass: 'bg-[#6537C0]',
    role: 'active',
  },
  arrived: {
    labelAr: 'وصل للمركز',
    labelEn: 'Arrived',
    badgeClass: 'badge-status-processing',
    dotClass: 'bg-indigo-500',
    role: 'processing',
  },
  started: {
    labelAr: 'بدء الخدمة',
    labelEn: 'In Service',
    badgeClass: 'badge-status-processing',
    dotClass: 'bg-purple-600',
    role: 'processing',
  },
  completed: {
    labelAr: 'مكتمل',
    labelEn: 'Completed',
    badgeClass: 'badge-status-completed',
    dotClass: 'bg-emerald-500',
    role: 'success',
  },
  cancelled: {
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    badgeClass: 'badge-status-cancelled',
    dotClass: 'bg-rose-500',
    role: 'alert',
  },
  no_show: {
    labelAr: 'لم يحضر',
    labelEn: 'No Show',
    badgeClass: 'badge-status-cancelled',
    dotClass: 'bg-rose-500',
    role: 'alert',
  },
};

/**
 * Canonical Payment Status Tokens
 */
export const BARSPA_PAYMENT_STATUS: Record<string, SemanticStatusStyle> = {
  paid: {
    labelAr: 'مدفوع',
    labelEn: 'Paid',
    badgeClass: 'badge-status-completed',
    dotClass: 'bg-emerald-500',
    role: 'success',
  },
  pending: {
    labelAr: 'قيد الدفع',
    labelEn: 'Pending',
    badgeClass: 'badge-status-pending',
    dotClass: 'bg-amber-500',
    role: 'pending',
  },
  failed: {
    labelAr: 'فشل الدفع',
    labelEn: 'Failed',
    badgeClass: 'badge-status-cancelled',
    dotClass: 'bg-rose-500',
    role: 'alert',
  },
  refunded: {
    labelAr: 'مسترد',
    labelEn: 'Refunded',
    badgeClass: 'badge-status-cancelled',
    dotClass: 'bg-rose-500',
    role: 'alert',
  },
  partially_refunded: {
    labelAr: 'مسترد جزئياً',
    labelEn: 'Partially Refunded',
    badgeClass: 'badge-status-pending',
    dotClass: 'bg-amber-500',
    role: 'pending',
  },
};
