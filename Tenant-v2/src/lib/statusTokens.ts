/**
 * BarSpa Centralized Semantic Status Tokens
 * 
 * CORE PRINCIPLE: STATUS MUST NEVER LOOK DISABLED OR FAINT.
 * Every semantic state explicitly defines:
 * - background (soft semantic tint)
 * - readable foreground text (high contrast dark text in light mode, bright text in dark mode)
 * - border (matching semantic tint)
 * - dot / accent indicator
 * 
 * Never relies on inherited text color.
 */

export interface SemanticStatusStyle {
  labelAr: string;
  labelEn: string;
  /** Badge container CSS class matching index.css */
  badgeClass: string;
  /** Dot indicator class */
  dotClass: string;
  /** Explicit light background */
  bgLight: string;
  /** Explicit light text color (never faint or inherited) */
  textLight: string;
  /** Explicit light border */
  borderLight: string;
  /** Explicit dark background */
  bgDark: string;
  /** Explicit dark text color */
  textDark: string;
  /** Explicit dark border */
  borderDark: string;
  /** Combined container classes */
  containerClass: string;
  /** Semantic role */
  role: 'active' | 'processing' | 'success' | 'pending' | 'alert' | 'info';
}

const buildStatus = (
  labelAr: string,
  labelEn: string,
  badgeClass: string,
  dotClass: string,
  bgLight: string,
  textLight: string,
  borderLight: string,
  bgDark: string,
  textDark: string,
  borderDark: string,
  role: SemanticStatusStyle['role']
): SemanticStatusStyle => ({
  labelAr,
  labelEn,
  badgeClass,
  dotClass,
  bgLight,
  textLight,
  borderLight,
  bgDark,
  textDark,
  borderDark,
  containerClass: `${bgLight} ${textLight} ${borderLight} ${bgDark} ${textDark} ${borderDark} font-bold border`,
  role
});

/**
 * Canonical Order Fulfillment Status Tokens
 */
export const BARSPA_ORDER_STATUS: Record<string, SemanticStatusStyle> = {
  pending: buildStatus(
    'قيد الانتظار',
    'Pending',
    'badge-status-pending',
    'bg-amber-500',
    'bg-amber-50',
    'text-amber-950',
    'border-amber-300',
    'dark:bg-amber-950/50',
    'dark:text-amber-200',
    'dark:border-amber-700/60',
    'pending'
  ),
  confirmed: buildStatus(
    'تم التأكيد',
    'Confirmed',
    'badge-status-confirmed',
    'bg-[#6537C0]',
    'bg-purple-50',
    'text-[#1D035F]',
    'border-[#A379E2]/50',
    'dark:bg-[#1D035F]/40',
    'dark:text-[#E7DDFC]',
    'dark:border-[#A379E2]/60',
    'active'
  ),
  processing: buildStatus(
    'قيد التجهيز',
    'Processing',
    'badge-status-processing',
    'bg-indigo-500',
    'bg-indigo-50',
    'text-indigo-950',
    'border-indigo-300',
    'dark:bg-indigo-950/50',
    'dark:text-indigo-200',
    'dark:border-indigo-700/60',
    'processing'
  ),
  ready_for_pickup: buildStatus(
    'جاهز للاستلام',
    'Ready for Pickup',
    'badge-status-confirmed',
    'bg-purple-600',
    'bg-purple-50',
    'text-[#1D035F]',
    'border-[#A379E2]/50',
    'dark:bg-[#1D035F]/40',
    'dark:text-[#E7DDFC]',
    'dark:border-[#A379E2]/60',
    'active'
  ),
  shipped: buildStatus(
    'تم الشحن',
    'Shipped',
    'badge-status-shipped',
    'bg-sky-500',
    'bg-sky-50',
    'text-sky-950',
    'border-sky-300',
    'dark:bg-sky-950/50',
    'dark:text-sky-200',
    'dark:border-sky-700/60',
    'info'
  ),
  delivered: buildStatus(
    'تم التوصيل',
    'Delivered',
    'badge-status-completed',
    'bg-emerald-500',
    'bg-emerald-50',
    'text-emerald-950',
    'border-emerald-300',
    'dark:bg-emerald-950/50',
    'dark:text-emerald-200',
    'dark:border-emerald-700/60',
    'success'
  ),
  completed: buildStatus(
    'مكتمل',
    'Completed',
    'badge-status-completed',
    'bg-emerald-500',
    'bg-emerald-50',
    'text-emerald-950',
    'border-emerald-300',
    'dark:bg-emerald-950/50',
    'dark:text-emerald-200',
    'dark:border-emerald-700/60',
    'success'
  ),
  cancelled: buildStatus(
    'ملغي',
    'Cancelled',
    'badge-status-cancelled',
    'bg-rose-500',
    'bg-rose-50',
    'text-rose-950',
    'border-rose-300',
    'dark:bg-rose-950/50',
    'dark:text-rose-200',
    'dark:border-rose-700/60',
    'alert'
  ),
  refunded: buildStatus(
    'مسترجع',
    'Refunded',
    'badge-status-cancelled',
    'bg-rose-500',
    'bg-rose-50/90',
    'text-rose-950',
    'border-rose-300',
    'dark:bg-rose-950/50',
    'dark:text-rose-200',
    'dark:border-rose-700/60',
    'alert'
  ),
};

/**
 * Canonical Payment Status Tokens
 */
export const BARSPA_PAYMENT_STATUS: Record<string, SemanticStatusStyle> = {
  paid: buildStatus(
    'مدفوع',
    'Paid',
    'badge-status-completed',
    'bg-emerald-500',
    'bg-emerald-50',
    'text-emerald-950',
    'border-emerald-300',
    'dark:bg-emerald-950/50',
    'dark:text-emerald-200',
    'dark:border-emerald-700/60',
    'success'
  ),
  pending: buildStatus(
    'بانتظار الدفع',
    'Pending Payment',
    'badge-status-pending',
    'bg-amber-500',
    'bg-amber-50',
    'text-amber-950',
    'border-amber-300',
    'dark:bg-amber-950/50',
    'dark:text-amber-200',
    'dark:border-amber-700/60',
    'pending'
  ),
  failed: buildStatus(
    'فشل الدفع',
    'Failed',
    'badge-status-cancelled',
    'bg-rose-500',
    'bg-rose-50',
    'text-rose-950',
    'border-rose-300',
    'dark:bg-rose-950/50',
    'dark:text-rose-200',
    'dark:border-rose-700/60',
    'alert'
  ),
  refunded: buildStatus(
    'مسترد',
    'Refunded',
    'badge-status-cancelled',
    'bg-rose-500',
    'bg-rose-50/90',
    'text-rose-950',
    'border-rose-300',
    'dark:bg-rose-950/50',
    'dark:text-rose-200',
    'dark:border-rose-700/60',
    'alert'
  ),
  partially_refunded: buildStatus(
    'مسترد جزئياً',
    'Partially Refunded',
    'badge-status-pending',
    'bg-amber-500',
    'bg-amber-50',
    'text-amber-950',
    'border-amber-300',
    'dark:bg-amber-950/50',
    'dark:text-amber-200',
    'dark:border-amber-700/60',
    'pending'
  ),
};

/**
 * Canonical Appointment Status Tokens
 */
export const BARSPA_APPOINTMENT_STATUS: Record<string, SemanticStatusStyle> = {
  booked: buildStatus(
    'محجوز',
    'Booked',
    'badge-status-confirmed',
    'bg-[#6537C0]',
    'bg-purple-50',
    'text-[#1D035F]',
    'border-[#A379E2]/50',
    'dark:bg-[#1D035F]/40',
    'dark:text-[#E7DDFC]',
    'dark:border-[#A379E2]/60',
    'active'
  ),
  confirmed: buildStatus(
    'مؤكد',
    'Confirmed',
    'badge-status-confirmed',
    'bg-[#6537C0]',
    'bg-purple-50',
    'text-[#1D035F]',
    'border-[#A379E2]/50',
    'dark:bg-[#1D035F]/40',
    'dark:text-[#E7DDFC]',
    'dark:border-[#A379E2]/60',
    'active'
  ),
  arrived: buildStatus(
    'وصل للمركز',
    'Arrived',
    'badge-status-processing',
    'bg-indigo-500',
    'bg-indigo-50',
    'text-indigo-950',
    'border-indigo-300',
    'dark:bg-indigo-950/50',
    'dark:text-indigo-200',
    'dark:border-indigo-700/60',
    'processing'
  ),
  started: buildStatus(
    'بدء الخدمة',
    'In Service',
    'badge-status-processing',
    'bg-purple-600',
    'bg-purple-50',
    'text-[#1D035F]',
    'border-[#A379E2]/50',
    'dark:bg-[#1D035F]/40',
    'dark:text-[#E7DDFC]',
    'dark:border-[#A379E2]/60',
    'processing'
  ),
  completed: buildStatus(
    'مكتمل',
    'Completed',
    'badge-status-completed',
    'bg-emerald-500',
    'bg-emerald-50',
    'text-emerald-950',
    'border-emerald-300',
    'dark:bg-emerald-950/50',
    'dark:text-emerald-200',
    'dark:border-emerald-700/60',
    'success'
  ),
  cancelled: buildStatus(
    'ملغي',
    'Cancelled',
    'badge-status-cancelled',
    'bg-rose-500',
    'bg-rose-50',
    'text-rose-950',
    'border-rose-300',
    'dark:bg-rose-950/50',
    'dark:text-rose-200',
    'dark:border-rose-700/60',
    'alert'
  ),
  no_show: buildStatus(
    'لم يحضر',
    'No Show',
    'badge-status-cancelled',
    'bg-rose-500',
    'bg-rose-50',
    'text-rose-950',
    'border-rose-300',
    'dark:bg-rose-950/50',
    'dark:text-rose-200',
    'dark:border-rose-700/60',
    'alert'
  ),
};

/**
 * Safe Token Getters with Default Fallbacks
 */
export const getOrderStatusToken = (status?: string | null): SemanticStatusStyle => {
  if (!status) return BARSPA_ORDER_STATUS.pending;
  return BARSPA_ORDER_STATUS[status.toLowerCase()] || BARSPA_ORDER_STATUS.pending;
};

export const getPaymentStatusToken = (status?: string | null): SemanticStatusStyle => {
  if (!status) return BARSPA_PAYMENT_STATUS.pending;
  return BARSPA_PAYMENT_STATUS[status.toLowerCase()] || BARSPA_PAYMENT_STATUS.pending;
};

export const getAppointmentStatusToken = (status?: string | null): SemanticStatusStyle => {
  if (!status) return BARSPA_APPOINTMENT_STATUS.booked;
  return BARSPA_APPOINTMENT_STATUS[status.toLowerCase()] || BARSPA_APPOINTMENT_STATUS.booked;
};
