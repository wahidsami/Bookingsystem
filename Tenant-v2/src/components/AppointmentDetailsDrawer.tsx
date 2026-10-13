import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, CheckCircle2, Clock, Calendar as CalendarIcon, User, 
  CreditCard, Sparkles, AlertTriangle, ArrowRight, Share2, 
  Printer, Split, FileText, ChevronRight, ChevronLeft, Receipt
} from 'lucide-react';
import { AppointmentClientHeader } from './AppointmentClientHeader';
import { AppointmentServiceCard, AppointmentServiceItem } from './AppointmentServiceCard';
import { AppointmentServiceEditor, StylistOption } from './AppointmentServiceEditor';
import { AppointmentActionMenu } from './AppointmentActionMenu';
import { AppointmentCheckoutOverlay, CheckoutLineItem, SplitAllocations } from './AppointmentCheckoutOverlay';

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
  onViewSale: (appointment: any) => void;
  onRebook: (appointment: any) => void;
  onReschedule: (appointment: any) => void;
  onCancel: (appointment: any) => void;
  onLateCancel?: (appointment: any) => void;
  onNoShow?: (appointment: any) => void;
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
  }) => Promise<void>;
}

export const AppointmentDetailsDrawer: React.FC<AppointmentDetailsDrawerProps> = ({
  isOpen,
  isRtl,
  appointment,
  stylists,
  readOnly = false,
  slotMinutes = 15,
  formatMinutesToTime,
  onClose,
  onStatusChange,
  onViewProfile,
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

  // Determine individual services list
  const sessionAppointments = Array.isArray(appointment.bookingSession?.appointments)
    ? appointment.bookingSession.appointments
    : [];

  const rawServices = sessionAppointments.length > 0
    ? sessionAppointments
    : Array.isArray(appointment.services) && appointment.services.length > 0
      ? appointment.services
      : Array.isArray(appointment.serviceItems) && appointment.serviceItems.length > 0
        ? appointment.serviceItems
        : [appointment];

  const serviceItems: AppointmentServiceItem[] = rawServices.map((svc: any, idx: number) => {
    const sId = svc.id || `${appointment.id}-svc-${idx}`;
    const sNameEn = svc.serviceNameEn || svc.service?.name_en || svc.service?.nameEn || svc.service?.name || svc.nameEn || svc.name || appointment.serviceNameEn || 'Service';
    const sNameAr = svc.serviceNameAr || svc.service?.name_ar || svc.service?.nameAr || svc.service?.name || svc.nameAr || svc.name || appointment.serviceNameAr || 'الخدمة';
    const variantName = svc.serviceVariantName || svc.serviceVariant?.name_en || svc.serviceVariant?.nameEn || appointment.serviceVariantName || '';
    const variantDesc = svc.serviceVariantDescription || svc.serviceVariant?.name_ar || svc.serviceVariant?.nameAr || appointment.serviceVariantDescription || '';
    const sDuration = Number(svc.duration || svc.service?.duration || appointment.duration || 30);
    const sPrice = Number(svc.price ?? svc.service?.price ?? (idx === 0 ? appointment.price : 0));
    const sStaffId = svc.staffId || svc.employeeId || appointment.staffId || '';
    const assignedStylist = stylists.find(st => st.id === sStaffId);

    return {
      id: sId,
      serviceId: svc.serviceId || svc.service?.id || appointment.serviceId,
      serviceNameEn: sNameEn,
      serviceNameAr: sNameAr,
      serviceVariantId: svc.serviceVariantId || appointment.serviceVariantId,
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
      participantName: svc.participantName || (appointment.isGroupBooking ? svc.customerNameEn || svc.customerNameAr : undefined),
      overtimeApproved: Boolean(svc.overtimeApproval?.approved || appointment.overtimeApproval?.approved),
    };
  });

  // Calculate totals and ZATCA VAT
  const totalServicePrice = serviceItems.reduce((sum, item) => sum + item.price, 0);
  const productsTotal = Array.isArray(appointment.products)
    ? appointment.products.reduce((sum: number, p: any) => sum + (Number(p.price || 0) * Number(p.quantity || 1)), 0)
    : 0;
  const originalSubtotal = totalServicePrice + productsTotal;
  const appointmentDiscount = Number(appointment.discountAmount || 0);
  const totalAmountDue = Math.max(0, originalSubtotal - appointmentDiscount);
  const taxableSubtotal = totalAmountDue / 1.15;
  const vat15 = totalAmountDue - taxableSubtotal;
  const totalPaid = Number(appointment.totalPaid ?? 0);
  const remainingDue = Math.max(0, totalAmountDue - totalPaid);

  const isPaid = appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'fully_paid' || (totalAmountDue > 0 && remainingDue <= 0.01);
  const status = appointment.status || 'confirmed';

  // Status Badge Class
  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'confirmed':
      case 'booked':
      case 'pending':
        return {
          label: isRtl ? 'مؤكد' : 'Confirmed',
          cls: 'bg-[#F3EDFC] text-[#6537C0] border-[#E7DDFC]',
        };
      case 'checked_in':
      case 'arrived':
        return {
          label: isRtl ? 'وصلت المركز' : 'Arrived',
          cls: 'bg-teal-50 text-teal-700 border-teal-200',
        };
      case 'in_service':
      case 'started':
        return {
          label: isRtl ? 'بدأت الجلسة' : 'In Service',
          cls: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'completed':
        return {
          label: isRtl ? 'اكتملت الخدمة' : 'Completed',
          cls: 'bg-slate-100 text-slate-700 border-slate-300',
        };
      case 'cancelled':
      case 'late_cancelled':
        return {
          label: isRtl ? 'ملغي' : 'Cancelled',
          cls: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'no_show':
        return {
          label: isRtl ? 'عدم حضور' : 'No-Show',
          cls: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      default:
        return {
          label: st,
          cls: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const statusBadge = getStatusBadge(status);

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
      nameEn: item.serviceNameEn + (item.serviceVariantName ? ` / ${item.serviceVariantName}` : ''),
      nameAr: item.serviceNameAr + (item.serviceVariantDescription ? ` / ${item.serviceVariantDescription}` : ''),
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

      {/* Slide-over Drawer Sheet (480px Desktop, 540px XL, Full-Width Mobile) */}
      <motion.div
        initial={{ x: isRtl ? '-100%' : '100%' }}
        animate={{ x: 0 }}
        exit={{ x: isRtl ? '-100%' : '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className={`absolute top-0 bottom-0 ${isRtl ? 'left-0' : 'right-0'} w-full sm:w-[480px] xl:w-[540px] max-w-full bg-[#FAF7FD] border-${isRtl ? 'r' : 'l'} border-[#E7DDFC] shadow-2xl flex flex-col z-10`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* STICKY TOP APP BAR */}
        <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#E7DDFC] px-4 py-3 flex items-center justify-between shrink-0 shadow-2xs z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 bg-[#1D035F] text-white rounded-xl shadow-2xs shrink-0">
              <CheckCircle2 size={16} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-[#1D035F] tracking-wide font-sans">
                  {isRtl ? 'تفاصيل الموعد' : 'APPOINTMENT DETAILS'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-[10px] text-[#A379E2] font-semibold mt-0.5 truncate font-mono">
                {isRtl ? `مرجع: ${appointment.id.slice(0, 8).toUpperCase()}` : `REF: ${appointment.id.slice(0, 8).toUpperCase()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-[#F3EDFC] text-[#1D035F] hover:bg-[#E7DDFC] transition-colors cursor-pointer"
              title={isRtl ? 'إغلاق' : 'Close'}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* SCROLLABLE MAIN CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

            {/* Stacked Individual Service Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase text-[#6537C0] tracking-wider block font-sans">
                  {isRtl ? `الخدمات المحجوزة (${serviceItems.length})` : `BOOKED SERVICES (${serviceItems.length})`}
                </span>
                {appointment.isGroupBooking && (
                  <span className="text-[10px] font-bold text-[#6537C0] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {isRtl ? 'حجز جماعي' : 'Group Session'}
                  </span>
                )}
              </div>

              {serviceItems.map((item) => (
                <div key={item.id} className="space-y-2">
                  <AppointmentServiceCard
                    isRtl={isRtl}
                    item={item}
                    canEdit={!readOnly && status !== 'completed' && status !== 'cancelled'}
                    canRemove={false}
                    formatMinutesToTime={formatMinutesToTime}
                    onEdit={(svc) => {
                      setEditingServiceId(editingServiceId === svc.id ? null : svc.id);
                    }}
                  />

                  {/* Option A In-Place Service Editor */}
                  {editingServiceId === item.id && (
                    <AppointmentServiceEditor
                      isRtl={isRtl}
                      item={item}
                      dateKey={appointment.date || ''}
                      stylists={stylists}
                      slotMinutes={slotMinutes}
                      formatMinutesToTime={formatMinutesToTime}
                      onSave={async (updated) => {
                        await onSaveServiceEdit(updated);
                        setEditingServiceId(null);
                      }}
                      onCancel={() => setEditingServiceId(null)}
                    />
                  )}
                </div>
              ))}
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
            ) : status === 'in_service' || status === 'checked_in' ? (
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(true)}
                className="flex-1 py-3 bg-[#6537C0] hover:bg-[#532ab0] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={15} className="text-[#E7DDFC]" />
                <span>{isRtl ? 'إتمام الدفع والتحصيل (Checkout)' : 'Proceed to Checkout'}</span>
              </button>
            ) : status === 'confirmed' ? (
              <>
                <button
                  type="button"
                  disabled={isStatusTransitioning}
                  onClick={() => handleTransitionStatus('checked_in')}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>{isRtl ? 'تسجيل وصول الزبونة' : 'Mark Arrived'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="px-3.5 py-3 bg-[#F3EDFC] hover:bg-[#E7DDFC] text-[#6537C0] rounded-xl text-xs font-bold border border-[#E7DDFC] transition-all cursor-pointer"
                  title={isRtl ? 'الدفع المسبق' : 'Pre-pay Checkout'}
                >
                  <CreditCard size={15} />
                </button>
              </>
            ) : status === 'completed' && !isPaid ? (
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(true)}
                className="flex-1 py-3 bg-[#6537C0] hover:bg-[#532ab0] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard size={15} className="text-[#E7DDFC]" />
                <span>{isRtl ? 'تحصيل المبلغ المتبقي' : 'Collect Remaining Due'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRebook(appointment)}
                className="flex-1 py-3 bg-[#6537C0] hover:bg-[#532ab0] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={15} className="text-[#E7DDFC]" />
                <span>{isRtl ? 'إعادة حجز الموعد' : 'Rebook Appointment'}</span>
              </button>
            )}

            {/* Secondary Actions Overflow Menu */}
            <AppointmentActionMenu
              isRtl={isRtl}
              appointmentStatus={status}
              isGroupBooking={Boolean(appointment.isGroupBooking)}
              readOnly={readOnly}
              onReschedule={() => onReschedule(appointment)}
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
