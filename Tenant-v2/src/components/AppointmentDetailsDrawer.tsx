import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, CheckCircle2, Clock, Calendar as CalendarIcon, User, Users,
  CreditCard, Sparkles, AlertTriangle, ArrowRight, Share2, 
  Printer, Split, FileText, ChevronRight, ChevronLeft, ChevronDown, Receipt
} from 'lucide-react';
import { AppointmentClientHeader } from './AppointmentClientHeader';
import { AppointmentServiceCard, AppointmentServiceItem } from './AppointmentServiceCard';
import { AppointmentServiceEditor, StylistOption } from './AppointmentServiceEditor';
import { AppointmentActionMenu } from './AppointmentActionMenu';
import { AppointmentCheckoutOverlay, CheckoutLineItem, SplitAllocations } from './AppointmentCheckoutOverlay';

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'in_service', 'completed', 'cancelled', 'no_show'],
  booked: ['checked_in', 'in_service', 'completed', 'cancelled', 'no_show'],
  checked_in: ['confirmed', 'in_service', 'completed', 'cancelled', 'no_show'],
  in_service: ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: ['confirmed', 'checked_in'],
  no_show: ['confirmed'],
};

export const normalizeDrawerStatus = (rawStatus: any): string => {
  const raw = `${rawStatus || ''}`.toLowerCase().trim();
  if (raw === 'arrived') return 'checked_in';
  if (raw === 'started') return 'in_service';
  if (raw === 'canceled' || raw === 'late_cancelled') return 'cancelled';
  if (raw === 'noshow' || raw === 'no-show') return 'no_show';
  if (raw === 'booked') return 'confirmed';
  if (['pending', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show'].includes(raw)) {
    return raw;
  }
  return 'confirmed';
};

export const STATUS_META: Record<string, { labelEn: string; labelAr: string; cls: string }> = {
  confirmed: {
    labelEn: 'Confirmed',
    labelAr: 'مؤكد',
    cls: 'bg-[#F3EDFC] text-[#6537C0] border-[#E7DDFC]',
  },
  pending: {
    labelEn: 'Pending',
    labelAr: 'قيد الانتظار',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  checked_in: {
    labelEn: 'Arrived',
    labelAr: 'وصلت المركز',
    cls: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  in_service: {
    labelEn: 'In Service',
    labelAr: 'بدأت الجلسة',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  completed: {
    labelEn: 'Completed',
    labelAr: 'اكتملت الخدمة',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  cancelled: {
    labelEn: 'Cancelled',
    labelAr: 'ملغي',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  no_show: {
    labelEn: 'No-Show',
    labelAr: 'عدم حضور',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

export interface AppointmentDetailsDrawerProps {
  isOpen: boolean;
  isRtl: boolean;
  appointment: any | null;
  stylists: StylistOption[];
  readOnly?: boolean;
  slotMinutes?: number;
  formatMinutesToTime: (mins: number) => string;
  onClose: () => void;
  onStatusChange: (newStatus: string) => Promise<void>;
  onViewProfile: (customerId: string) => void;
  onViewHistory?: (customerId: string) => void;
  onViewSale: (appointment: any) => void;
  onRebook: (appointment: any) => void;
  onReschedule: (appointment: any) => void;
  onCancel: (appointment: any) => void;
  onLateCancel?: (appointment: any) => void;
  onNoShow?: (appointment: any) => void;
  tenantTimezone?: string;
  onSaveServiceEdit: (updatedItem: {
    id: string;
    staffId: string;
    startTime: number;
    duration: number;
    date: string;
  }) => Promise<void>;
  onConfirmCheckout: (payload: {
    appointmentId: string;
    paymentMethod: string;
    isSplit: boolean;
    splitAllocations: SplitAllocations;
    giftCardCode?: string;
    totalDue?: number;
    scope?: string;
    bookingSessionId?: string;
    isGroupSession?: boolean;
  }) => Promise<void>;
}

export const AppointmentDetailsDrawer: React.FC<AppointmentDetailsDrawerProps> = ({
  isOpen,
  isRtl,
  appointment,
  stylists,
  readOnly = false,
  slotMinutes = 15,
  tenantTimezone,
  formatMinutesToTime,
  onClose,
  onStatusChange,
  onViewProfile,
  onViewHistory,
  onViewSale,
  onRebook,
  onReschedule,
  onCancel,
  onLateCancel,
  onNoShow,
  onSaveServiceEdit,
  onConfirmCheckout,
}) => {
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isStatusTransitioning, setIsStatusTransitioning] = useState<boolean>(false);

  if (!isOpen || !appointment) {
    return null;
  }

  // Determine if appointment is part of a group booking session
  const isGroupSession = Boolean(
    appointment.isGroupBooking ||
    (Array.isArray(appointment.bookingSession?.appointments) && appointment.bookingSession.appointments.length > 1) ||
    appointment.bookingSessionId
  );

  const sessionAppointments: any[] = Array.isArray(appointment.bookingSession?.appointments) && appointment.bookingSession.appointments.length > 0
    ? appointment.bookingSession.appointments
    : [appointment];

  const eligibleAppointments = sessionAppointments.filter(
    (a: any) => `${a.status || ''}`.toLowerCase() !== 'cancelled'
  );

  // Extract independent bookable service items, preserving genuine packages as single units
  const rawServices: any[] = (() => {
    // Case 1: Session contains multiple appointments (e.g. group booking or multi-appointment session)
    if (Array.isArray(appointment.bookingSession?.appointments) && appointment.bookingSession.appointments.length > 1) {
      const apts = appointment.bookingSession.appointments;
      const grouped: any[] = [];
      const packageMap = new Map<string, any[]>();

      for (const item of apts) {
        const pkgKey = item.packageInstanceId || item.packageId;
        const isPkg = Boolean(pkgKey || item.packageSnapshot || item.isPackage);
        if (isPkg && pkgKey) {
          if (!packageMap.has(pkgKey)) {
            const groupList: any[] = [];
            packageMap.set(pkgKey, groupList);
            grouped.push({ __isPackageGroup: true, pkgKey, items: groupList });
          }
          packageMap.get(pkgKey)!.push(item);
        } else {
          grouped.push(item);
        }
      }

      return grouped.map(entry => {
        if (entry.__isPackageGroup) {
          const items = entry.items;
          const first = items[0];
          const totalDuration = items.reduce((sum: number, it: any) => sum + Number(it.duration || it.service?.duration || 0), 0);
          const totalPrice = items.reduce((sum: number, it: any) => sum + Number(it.price ?? it.service?.price ?? 0), 0);
          return {
            ...first,
            duration: totalDuration,
            price: totalPrice,
            serviceNameEn: first.packageSnapshot?.packageNameEn || first.packageNameEn || first.serviceNameEn || first.service?.name_en || 'Package',
            serviceNameAr: first.packageSnapshot?.packageNameAr || first.packageNameAr || first.serviceNameAr || first.service?.name_ar || 'باقة',
            isPackage: true
          };
        }
        return entry;
      });
    }

    // Case 2: Multi-service items on a single appointment
    const multi = Array.isArray(appointment.services) && appointment.services.length > 0
      ? appointment.services
      : Array.isArray(appointment.serviceItems) && appointment.serviceItems.length > 0
        ? appointment.serviceItems
        : null;

    if (multi && multi.length > 0) {
      const grouped: any[] = [];
      const packageMap = new Map<string, any[]>();

      for (const item of multi) {
        const pkgKey = item.packageInstanceId || item.packageId;
        const isPkg = Boolean(pkgKey || item.packageSnapshot || item.isPackage);
        if (isPkg && pkgKey) {
          if (!packageMap.has(pkgKey)) {
            const groupList: any[] = [];
            packageMap.set(pkgKey, groupList);
            grouped.push({ __isPackageGroup: true, pkgKey, items: groupList });
          }
          packageMap.get(pkgKey)!.push(item);
        } else {
          grouped.push(item);
        }
      }

      return grouped.map(entry => {
        if (entry.__isPackageGroup) {
          const items = entry.items;
          const first = items[0];
          const totalDuration = items.reduce((sum: number, it: any) => sum + Number(it.duration || it.service?.duration || 0), 0);
          const totalPrice = items.reduce((sum: number, it: any) => sum + Number(it.price ?? it.service?.price ?? 0), 0);
          return {
            ...first,
            duration: totalDuration,
            price: totalPrice,
            serviceNameEn: first.packageSnapshot?.packageNameEn || first.packageNameEn || first.serviceNameEn || first.service?.name_en || 'Package',
            serviceNameAr: first.packageSnapshot?.packageNameAr || first.packageNameAr || first.serviceNameAr || first.service?.name_ar || 'باقة',
            isPackage: true
          };
        }
        return entry;
      });
    }

    // Case 3: Single appointment from bookingSession
    if (Array.isArray(appointment.bookingSession?.appointments) && appointment.bookingSession.appointments.length === 1) {
      return [appointment.bookingSession.appointments[0]];
    }

    // Default: Single appointment record
    return [appointment];
  })();

  const serviceItems: AppointmentServiceItem[] = rawServices.map((svc: any, idx: number) => {
    const sId = svc.id || `${appointment.id}-svc-${idx}`;
    const sNameEn = svc.service?.name_en
      || svc.service?.nameEn
      || svc.service?.name
      || svc.primaryServiceNameEn
      || svc.serviceNameEn
      || svc.nameEn
      || svc.name
      || (rawServices.length === 1 ? appointment.primaryServiceNameEn || appointment.serviceNameEn : 'Service')
      || 'Service';
    const sNameAr = svc.service?.name_ar
      || svc.service?.nameAr
      || svc.service?.name
      || svc.primaryServiceNameAr
      || svc.serviceNameAr
      || svc.nameAr
      || svc.name
      || (rawServices.length === 1 ? appointment.primaryServiceNameAr || appointment.serviceNameAr : 'الخدمة')
      || 'الخدمة';
    const variantName = svc.serviceVariantName || svc.serviceVariant?.name_en || svc.serviceVariant?.nameEn || (rawServices.length === 1 ? appointment.serviceVariantName : '') || '';
    const variantDesc = svc.serviceVariantDescription || svc.serviceVariant?.name_ar || svc.serviceVariant?.nameAr || (rawServices.length === 1 ? appointment.serviceVariantDescription : '') || '';
    const sDuration = Number(svc.duration || svc.service?.duration || appointment.duration || 30);
    const sPrice = Number(svc.price ?? svc.service?.price ?? (rawServices.length === 1 ? appointment.price : 0));
    const sStaffId = svc.staffId || svc.employeeId || appointment.staffId || '';
    const assignedStylist = stylists.find(st => st.id === sStaffId);
    const svcStatus = svc.status || appointment.status || 'confirmed';
    const resolvedParticipantName = svc.participantName
      || (svc.user?.firstName ? `${svc.user.firstName} ${svc.user.lastName || ''}`.trim() : null)
      || (isGroupSession ? (svc.customerNameEn || svc.customerNameAr || `Guest ${idx + 1}`) : undefined);

    return {
      id: sId,
      serviceId: svc.serviceId || svc.service?.id || appointment.serviceId,
      serviceNameEn: sNameEn,
      serviceNameAr: sNameAr,
      serviceVariantId: svc.serviceVariantId || (rawServices.length === 1 ? appointment.serviceVariantId : undefined),
      serviceVariantName: variantName,
      serviceVariantDescription: variantDesc,
      duration: sDuration,
      startTime: svc.startTime ?? appointment.startTime,
      endTime: svc.endTime ?? appointment.endTime,
      staffId: sStaffId,
      staffNameEn: assignedStylist?.nameEn || svc.staffNameEn || svc.staffName || '',
      staffNameAr: assignedStylist?.nameAr || svc.staffNameAr || svc.staffName || '',
      staffAvatar: assignedStylist?.avatar || svc.staffAvatar || appointment.staffAvatar,
      price: sPrice,
      participantName: resolvedParticipantName,
      status: svcStatus,
      appointmentId: svc.appointmentId || svc.id || appointment.id,
      overtimeApproved: Boolean(svc.overtimeApproval?.approved || appointment.overtimeApproval?.approved),
    };
  });

  // Calculate authoritative session totals and ZATCA VAT
  const totalServicePrice = serviceItems.reduce((sum, item) => sum + item.price, 0);
  const productsTotal = Array.isArray(appointment.products)
    ? appointment.products.reduce((sum: number, p: any) => sum + (Number(p.price || 0) * Number(p.quantity || 1)), 0)
    : 0;
  const originalSubtotal = totalServicePrice + productsTotal;
  const appointmentDiscount = isGroupSession
    ? eligibleAppointments.reduce((sum: number, a: any) => sum + Number(a.discountAmount || 0), 0)
    : Number(appointment.discountAmount || 0);
  const totalAmountDue = Math.max(0, originalSubtotal - appointmentDiscount);
  const taxableSubtotal = totalAmountDue / 1.15;
  const vat15 = totalAmountDue - taxableSubtotal;

  // Authoritative total paid across eligible session appointments
  const totalPaid = isGroupSession
    ? eligibleAppointments.reduce((sum: number, a: any) => sum + Number(a.totalPaid ?? 0), 0)
    : Number(appointment.totalPaid ?? 0);
  const remainingDue = Math.max(0, totalAmountDue - totalPaid);

  const normalizedStatus = normalizeDrawerStatus(appointment.status);
  const isAppointmentCompleted = normalizedStatus === 'completed';
  const isPaid = (totalAmountDue > 0 && remainingDue <= 0.01) || (
    isGroupSession
      ? eligibleAppointments.every((a: any) => a.paymentStatus === 'paid' || a.paymentStatus === 'fully_paid')
      : (appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'fully_paid')
  );

  const statusMeta = STATUS_META[normalizedStatus] || {
    labelEn: normalizedStatus,
    labelAr: normalizedStatus,
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const isPartiallyPaid = !isPaid && totalPaid > 0 && remainingDue > 0.01;
  const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'no_show';

  // Status transitions
  const handleTransitionStatus = async (nextStatus: string) => {
    try {
      setIsStatusTransitioning(true);
      await onStatusChange(nextStatus);
    } finally {
      setIsStatusTransitioning(false);
    }
  };

  // Convert serviceItems to checkout line items
  const checkoutLineItems: CheckoutLineItem[] = [
    ...serviceItems.map(item => ({
      id: item.id,
      nameEn: (isGroupSession && item.participantName ? `[${item.participantName}] ` : '') + item.serviceNameEn + (item.serviceVariantName ? ` / ${item.serviceVariantName}` : ''),
      nameAr: (isGroupSession && item.participantName ? `[${item.participantName}] ` : '') + item.serviceNameAr + (item.serviceVariantDescription ? ` / ${item.serviceVariantDescription}` : ''),
      unitPrice: item.price,
      subtotal: item.price,
      type: 'Service',
      stylistEn: item.staffNameEn,
      stylistAr: item.staffNameAr,
    })),
    ...(Array.isArray(appointment.products) ? appointment.products.map((p: any, idx: number) => ({
      id: p.id || `prod-${idx}`,
      nameEn: p.nameEn || p.name || 'Product',
      nameAr: p.nameAr || p.name || 'منتج',
      quantity: Number(p.quantity || 1),
      unitPrice: Number(p.price || 0),
      subtotal: Number(p.price || 0) * Number(p.quantity || 1),
      type: 'Product',
    })) : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      {/* Semi-transparent backdrop allowing calendar visibility behind */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/30 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Drawer Sheet (460px Desktop, 500px XL, Full-Width Mobile) */}
      <motion.div
        initial={{ x: isRtl ? '-100%' : '100%' }}
        animate={{ x: 0 }}
        exit={{ x: isRtl ? '-100%' : '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className={`absolute top-0 bottom-0 ${isRtl ? 'left-0' : 'right-0'} w-full sm:w-[460px] xl:w-[500px] max-w-full bg-[#FAF7FD] border-${isRtl ? 'r' : 'l'} border-[#E7DDFC] shadow-2xl flex flex-col z-10`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* STICKY TOP APP BAR */}
        <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#E7DDFC] px-4 py-3 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2.5 bg-[#1D035F] text-white rounded-xl shadow-2xs shrink-0">
              <CheckCircle2 size={17} />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs font-black text-[#1D035F] tracking-wide font-sans truncate">
                {isRtl ? 'تفاصيل الموعد' : 'APPOINTMENT DETAILS'}
              </h2>
              <p className="text-[11px] text-[#A379E2] font-semibold mt-0.5 truncate font-mono">
                {isRtl ? `مرجع: ${appointment.id.slice(0, 8).toUpperCase()}` : `REF: ${appointment.id.slice(0, 8).toUpperCase()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Prominent Interactive Header Status Dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={normalizedStatus}
                disabled={readOnly || isStatusTransitioning || normalizedStatus === 'completed'}
                onChange={async (e) => {
                  const next = e.target.value;
                  if (next !== normalizedStatus) {
                    await handleTransitionStatus(next);
                  }
                }}
                aria-label={isRtl ? 'حالة الموعد' : 'Appointment Status'}
                className={`appearance-none h-[38px] sm:h-[40px] min-w-[130px] sm:min-w-[140px] text-[13.5px] sm:text-[14px] font-bold rounded-xl border shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-[#6537C0] focus:ring-offset-1 focus:border-[#6537C0] ${isRtl ? 'ps-3.5 pe-8 text-right' : 'ps-3.5 pe-8 text-left'} ${statusMeta.cls} ${isStatusTransitioning ? 'opacity-60 cursor-wait' : ''} ${normalizedStatus === 'completed' ? 'cursor-default opacity-90' : 'cursor-pointer hover:border-[#6537C0]/40'}`}
              >
                <option value={normalizedStatus} className="bg-white text-slate-800 font-medium">
                  {isRtl ? statusMeta.labelAr : statusMeta.labelEn}
                </option>
                {(VALID_STATUS_TRANSITIONS[normalizedStatus] || [])
                  .filter((targetStatus) => targetStatus !== normalizedStatus)
                  .map((targetStatus) => {
                    const targetMeta = STATUS_META[targetStatus] || { labelEn: targetStatus, labelAr: targetStatus };
                    return (
                      <option key={targetStatus} value={targetStatus} className="bg-white text-slate-800 font-medium">
                        {isRtl ? targetMeta.labelAr : targetMeta.labelEn}
                      </option>
                    );
                  })}
              </select>
              <ChevronDown 
                size={15} 
                className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'left-2.5' : 'right-2.5'} pointer-events-none opacity-70 transition-opacity`} 
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-[38px] w-[38px] sm:h-[40px] sm:w-[40px] flex items-center justify-center rounded-xl bg-[#F3EDFC] text-[#1D035F] hover:bg-[#E7DDFC] transition-colors cursor-pointer shrink-0"
              title={isRtl ? 'إغلاق' : 'Close'}
            >
              <X size={17} />
            </button>
          </div>
        </header>

        {/* SCROLLABLE MAIN CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* ZONE A: Client Context Card */}
          <AppointmentClientHeader
            isRtl={isRtl}
            customerNameEn={appointment.customerNameEn}
            customerNameAr={appointment.customerNameAr}
            customerPhone={appointment.customerPhone}
            customerEmail={appointment.customerEmail}
            customerAvatar={appointment.avatar}
            loyaltyTier={appointment.loyaltyTier}
            walletBalance={appointment.walletBalance}
            tags={appointment.tags || []}
            allergies={appointment.allergies}
            stylistNotes={appointment.salonNotes || appointment.notesSummary}
            isWalkIn={Boolean(appointment.isWalkIn)}
            onViewProfile={() => {
              if (appointment.customerId) {
                onViewProfile(appointment.customerId);
              }
            }}
            onViewHistory={() => {
              if (appointment.customerId) {
                if (onViewHistory) {
                  onViewHistory(appointment.customerId);
                } else {
                  onViewProfile(appointment.customerId);
                }
              }
            }}
          />

          {/* ZONE B: Appointment Operations */}
          <div className="space-y-3">
            {/* Visit Timing & Date Overview Banner */}
            <div className="bg-white rounded-2xl border border-[#E7DDFC] p-3.5 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#F3EDFC] text-[#6537C0] rounded-xl shrink-0">
                  <CalendarIcon size={16} />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#1D035F]">
                    {appointment.date || (isRtl ? 'اليوم' : 'Today')}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {typeof appointment.startTime === 'number'
                      ? `${formatMinutesToTime(appointment.startTime)} – ${formatMinutesToTime(appointment.startTime + appointment.duration)}`
                      : `${appointment.duration} ${isRtl ? 'دقيقة' : 'min'}`}
                  </p>
                </div>
              </div>

              {/* Status Fast Progression Button */}
              {!readOnly && (
                <div className="shrink-0">
                  {status === 'confirmed' && (
                    <button
                      type="button"
                      disabled={isStatusTransitioning}
                      onClick={() => handleTransitionStatus('checked_in')}
                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold border border-teal-200 transition-all cursor-pointer shadow-2xs"
                    >
                      {isRtl ? 'وصلت المركز ✓' : 'Mark Arrived ✓'}
                    </button>
                  )}
                  {status === 'checked_in' && (
                    <button
                      type="button"
                      disabled={isStatusTransitioning}
                      onClick={() => handleTransitionStatus('in_service')}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold border border-blue-200 transition-all cursor-pointer shadow-2xs"
                    >
                      {isRtl ? 'بدء الجلسة ▶' : 'Start Service ▶'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Unified Group Session Context Banner */}
            {isGroupSession && (
              <div className="bg-[#F8F5FE] border border-[#D5C2F8] rounded-2xl p-3.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-[#6537C0]" />
                    <span className="text-xs font-black text-[#1D035F]">
                      {isRtl ? 'جلسة حجز جماعي موحدة' : 'Unified Group Session'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[#6537C0] bg-white px-2 py-0.5 rounded-full border border-[#D5C2F8]">
                    {isRtl ? `${eligibleAppointments.length} مشاركين` : `${eligibleAppointments.length} Guests`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {isRtl
                    ? 'نظام السداد الجماعي الموحد: يتم تحصيل جميع خدمات الجلسة معاً تحت فاتورة موحدة.'
                    : 'Unified group billing: All eligible services across this session are settled together under one group invoice.'}
                </p>
              </div>
            )}

            {/* Stacked Individual Service Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase text-[#6537C0] tracking-wider block font-sans">
                  {isRtl ? `الخدمات المحجوزة (${serviceItems.length})` : `BOOKED SERVICES (${serviceItems.length})`}
                </span>
                {isGroupSession && (
                  <span className="text-[10px] font-bold text-[#6537C0] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {isRtl ? 'حجز جماعي' : 'Group Session'}
                  </span>
                )}
              </div>

              {serviceItems.map((item) => {
                const isItemCompleted = item.status === 'completed' || (item.appointmentId === appointment.id && isAppointmentCompleted);
                const isItemCancelled = item.status === 'cancelled' || (item.appointmentId === appointment.id && isCancelled);
                const canEditItem = !readOnly && !isItemCompleted && !isItemCancelled;

                return (
                  <div key={item.id} className="space-y-2">
                    <AppointmentServiceCard
                      isRtl={isRtl}
                      item={item}
                      canEdit={canEditItem}
                      canRemove={false}
                      formatMinutesToTime={formatMinutesToTime}
                      onEdit={(svc) => {
                        if (!canEditItem) return;
                        setEditingServiceId(editingServiceId === svc.id ? null : svc.id);
                      }}
                    />

                    {/* Option A In-Place Service Editor */}
                    {editingServiceId === item.id && canEditItem && (
                      <AppointmentServiceEditor
                        isRtl={isRtl}
                        item={item}
                        dateKey={appointment.date || ''}
                        stylists={stylists}
                        slotMinutes={slotMinutes}
                        tenantTimezone={tenantTimezone}
                        formatMinutesToTime={formatMinutesToTime}
                        onSave={async (updated) => {
                          await onSaveServiceEdit(updated);
                          setEditingServiceId(null);
                        }}
                        onCancel={() => setEditingServiceId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Appointment Notes (if any) */}
            {appointment.notes && (
              <div className="bg-white rounded-2xl border border-[#E7DDFC] p-3.5 space-y-1 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  {isRtl ? 'ملاحظات الحجز' : 'Appointment Notes'}
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* Financial Summary Card (Itemized Subtotal + ZATCA 15% VAT) */}
            <div className="bg-white rounded-2xl border border-[#E7DDFC] p-3.5 space-y-2 text-xs shadow-2xs">
              <span className="text-[10px] font-black uppercase text-[#6537C0] tracking-wider block font-sans">
                {isRtl ? 'الملخص المالي المعتمد' : 'CANONICAL FINANCIAL SUMMARY'}
              </span>

              <div className="flex justify-between text-slate-500">
                <span>{isRtl ? 'المجموع الأساسي' : 'Services Subtotal'}</span>
                <span className="font-mono font-bold">{originalSubtotal.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
              </div>

              {appointmentDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>{isRtl ? 'الخصومات الترويجية' : 'Promotional Discounts'}</span>
                  <span className="font-mono font-black">-{appointmentDiscount.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-500 border-t pt-1.5 border-dashed border-[#E7DDFC]">
                <span>{isRtl ? 'الوعاء الخاضع للضريبة' : 'Taxable Amount'}</span>
                <span className="font-mono font-bold">{taxableSubtotal.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
              </div>

              <div className="flex justify-between text-slate-500">
                <span>{isRtl ? 'ضريبة القيمة المضافة ١٥٪ (ZATCA)' : 'ZATCA VAT (15%)'}</span>
                <span className="font-mono font-bold">{vat15.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
              </div>

              <div className="flex justify-between text-sm font-black text-[#1D035F] pt-1.5 border-t border-[#E7DDFC]">
                <span>{isRtl ? 'المبلغ الإجمالي' : 'Total Price'}</span>
                <span className="font-mono text-[#6537C0]">{totalAmountDue.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ZONE C: STICKY CONTEXTUAL FOOTER ACTION BAR */}
        <footer className="sticky bottom-0 bg-white border-t border-[#E7DDFC] p-4 shadow-lg shrink-0 space-y-3 z-20">
          {/* Status & Balance Summary Pill */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="font-bold text-slate-700">
                {isPaid
                  ? isRtl ? 'مدفوع بالكامل ✓' : 'Fully Paid ✓'
                  : isRtl ? 'غير مدفوع' : 'Unpaid'}
              </span>
            </div>

            <div className="text-right">
              {isPaid ? (
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {totalAmountDue.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
                </span>
              ) : (
                <span className="text-xs font-mono font-black text-rose-600">
                  {isRtl ? 'المتبقي:' : 'Due:'} {remainingDue.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
                </span>
              )}
            </div>
          </div>

          {/* Primary Action Button + Secondary Action Menu */}
          <div className="flex items-center gap-2">
            {/* Dynamic Primary CTA based on Appointment & Payment Lifecycle */}
            {isPaid ? (
              <button
                type="button"
                onClick={() => onViewSale(appointment)}
                className="flex-1 py-3 bg-[#1D035F] hover:bg-[#2e098a] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Receipt size={15} className="text-[#E7DDFC]" />
                <span>{isRtl ? 'عرض تفاصيل الفاتورة (View Sale)' : 'View Sale & Receipt'}</span>
              </button>
            ) : isCancelled ? (
              <button
                type="button"
                onClick={() => onRebook(appointment)}
                className="flex-1 py-3 bg-[#6537C0] hover:bg-[#532ab0] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={15} className="text-[#E7DDFC]" />
                <span>{isRtl ? 'إعادة حجز الموعد' : 'Rebook Appointment'}</span>
              </button>
            ) : isPartiallyPaid ? (
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(true)}
                className="flex-1 py-3 bg-[#6537C0] hover:bg-[#532ab0] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard size={15} className="text-[#E7DDFC]" />
                <span>
                  {isGroupSession
                    ? (isRtl ? `تحصيل المتبقي للجلسة الجماعية (${remainingDue.toFixed(2)} ر.س)` : `Collect Remaining Group Due (${remainingDue.toFixed(2)} SAR)`)
                    : (isRtl ? `تحصيل المتبقي (${remainingDue.toFixed(2)} ر.س)` : `Collect Remaining Due (${remainingDue.toFixed(2)} SAR)`)}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(true)}
                className="flex-1 py-3 bg-[#6537C0] hover:bg-[#532ab0] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard size={15} className="text-[#E7DDFC]" />
                <span>
                  {isGroupSession
                    ? (isRtl ? `سداد الجلسة الجماعية بالكامل (${remainingDue.toFixed(2)} ر.س)` : `Unified Group Checkout (${remainingDue.toFixed(2)} SAR)`)
                    : (isRtl ? 'إتمام الدفع والتحصيل (Checkout)' : 'Proceed to Checkout')}
                </span>
              </button>
            )}

            {/* Secondary Actions Overflow Menu */}
            <AppointmentActionMenu
              isRtl={isRtl}
              appointmentStatus={normalizedStatus}
              isGroupBooking={Boolean(isGroupSession || appointment.isGroupBooking)}
              readOnly={readOnly}
              onReschedule={() => {
                if (isAppointmentCompleted || isCancelled) return;
                const firstEditable = serviceItems.find(s => s.status !== 'completed' && s.status !== 'cancelled');
                if (firstEditable) {
                  setEditingServiceId(firstEditable.id);
                }
                if (onReschedule) {
                  onReschedule(appointment);
                }
              }}
              onRebook={() => onRebook(appointment)}
              onLateCancel={onLateCancel ? () => onLateCancel(appointment) : undefined}
              onNoShow={onNoShow ? () => onNoShow(appointment) : undefined}
              onCancel={() => onCancel(appointment)}
            />
          </div>
        </footer>

        {/* Option A Focused Checkout Overlay (Mounted on top of drawer) */}
        {isCheckoutOpen && (
          <AppointmentCheckoutOverlay
            isRtl={isRtl}
            appointmentId={appointment.id}
            customerNameEn={appointment.customerNameEn}
            customerNameAr={appointment.customerNameAr}
            customerWalletBalance={appointment.walletBalance}
            lineItems={checkoutLineItems}
            subtotal={originalSubtotal}
            discount={appointmentDiscount}
            taxable={taxableSubtotal}
            vat={vat15}
            totalDue={totalAmountDue}
            alreadyPaid={totalPaid}
            remainingDue={remainingDue}
            onConfirmPayment={async (payload) => {
              await onConfirmCheckout({
                appointmentId: appointment.id,
                totalDue: totalAmountDue,
                remainingDue,
                scope: isGroupSession ? 'session' : 'appointment',
                bookingSessionId: appointment.bookingSessionId || appointment.bookingSession?.id,
                isGroupSession,
                ...payload,
              });
              setIsCheckoutOpen(false);
            }}
            onClose={() => setIsCheckoutOpen(false)}
          />
        )}
      </motion.div>
    </div>
  );
};
