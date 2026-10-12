import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Package as PackageIcon,
  Tag
} from 'lucide-react';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';

export interface CustomerHistoricalSession {
  id: string;
  bookingSessionId?: string | null;
  bookingReference?: string | null;
  date: string;
  startTime?: string;
  status: string;
  amount?: number;
  price?: number;
  serviceNameEn?: string;
  serviceNameAr?: string;
  assignedStaffName?: string;
  serviceLines?: any[];
  appointments?: any[];
  details?: {
    services?: any[];
    service?: any;
    staff?: any;
    staffName?: string;
    duration?: number;
    startTime?: string;
    endTime?: string;
    notes?: string;
    serviceVariantName?: string;
  };
}

interface CustomerBookingHistoryProps {
  customerId: string | null;
  customerName?: string;
  isRtl: boolean;
  onRebook: (session: CustomerHistoricalSession) => void;
  disabled?: boolean;
}

export const CustomerBookingHistory: React.FC<CustomerBookingHistoryProps> = ({
  customerId,
  customerName,
  isRtl,
  onRebook,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<CustomerHistoricalSession[]>([]);
  const activeRequestIdRef = useRef<number>(0);

  useEffect(() => {
    // Requirement 6: Immediately clear previous customer history when customer changes
    setHistoryItems([]);
    setError(null);

    if (!customerId) {
      setLoading(false);
      return;
    }

    const currentRequestId = ++activeRequestIdRef.current;
    setLoading(true);

    tenantApiAdapter
      .getCustomerHistory(customerId, { limit: 10, type: 'appointment' })
      .then((res: any) => {
        // Discard result if customer changed while request was in-flight
        if (currentRequestId !== activeRequestIdRef.current) return;

        const rawList: any[] = Array.isArray(res?.appointments) && res.appointments.length > 0
          ? res.appointments
          : Array.isArray(res?.history)
            ? res.history.filter((h: any) => h.kind === 'booking_session' || h.type === 'appointment')
            : [];

        setHistoryItems(rawList);
        setLoading(false);
      })
      .catch((err: any) => {
        if (currentRequestId !== activeRequestIdRef.current) return;
        // Non-blocking error handling
        setError(err?.message || (isRtl ? 'تعذر جلب سجل الحجوزات السابقة' : 'Failed to load booking history'));
        setLoading(false);
      });
  }, [customerId, isRtl]);

  if (!customerId) {
    return null;
  }

  const formatHistoricalDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatHistoricalTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  };

  const getStatusBadge = (status: string) => {
    const s = `${status || ''}`.toLowerCase();
    if (['completed', 'مكتمل'].includes(s)) {
      return {
        label: isRtl ? 'مكتمل' : 'Completed',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (['confirmed', 'مؤكد', 'booked', 'scheduled'].includes(s)) {
      return {
        label: isRtl ? 'مؤكد' : 'Confirmed',
        bg: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    }
    if (['cancelled', 'canceled', 'ملغي'].includes(s)) {
      return {
        label: isRtl ? 'ملغي' : 'Cancelled',
        bg: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    return {
      label: status || (isRtl ? 'سابق' : 'Past'),
      bg: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  };

  return (
    <div className="rounded-xl border border-purple-200/80 bg-purple-50/40 overflow-hidden text-xs transition-all">
      {/* Header bar toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-purple-100/50 transition cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-[#6537C0]" />
          <span className="font-bold text-slate-800">
            {isRtl ? 'سجل الحجوزات السابقة وإعادة الحجز' : 'Past Bookings & One-Click Rebook'}
          </span>
          {loading ? (
            <RefreshCw className="w-3 h-3 text-[#6537C0] animate-spin" />
          ) : historyItems.length > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full bg-[#6537C0]/15 text-[#6537C0] text-[10px] font-black">
              {historyItems.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 text-slate-500 font-semibold text-[11px]">
          <span>{isOpen ? (isRtl ? 'إخفاء' : 'Collapse') : (isRtl ? 'عرض' : 'View')}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="p-2.5 pt-0 border-t border-purple-100 space-y-2">
          {loading && (
            <div className="p-4 text-center text-slate-500 flex flex-col items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-[#6537C0] animate-spin" />
              <span>{isRtl ? 'جاري تحميل الحجوزات السابقة...' : 'Loading previous appointments...'}</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const reqId = ++activeRequestIdRef.current;
                  setLoading(true);
                  setError(null);
                  tenantApiAdapter
                    .getCustomerHistory(customerId, { limit: 10, type: 'appointment' })
                    .then((res: any) => {
                      if (reqId !== activeRequestIdRef.current) return;
                      const rawList: any[] = Array.isArray(res?.appointments) && res.appointments.length > 0
                        ? res.appointments
                        : Array.isArray(res?.history)
                          ? res.history.filter((h: any) => h.kind === 'booking_session' || h.type === 'appointment')
                          : [];
                      setHistoryItems(rawList);
                      setLoading(false);
                    })
                    .catch((err: any) => {
                      if (reqId !== activeRequestIdRef.current) return;
                      setError(err?.message || (isRtl ? 'تعذر جلب الحجوزات' : 'Failed to load'));
                      setLoading(false);
                    });
                }}
                className="font-bold text-[#6537C0] hover:underline shrink-0"
              >
                {isRtl ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}

          {!loading && !error && historyItems.length === 0 && (
            <div className="p-3 rounded-lg bg-white/70 border border-slate-200 text-center text-slate-500">
              <p className="font-medium">
                {isRtl ? 'عميل جديد — لا توجد حجوزات سابقة مسجلة.' : 'First-time client — no previous appointments found.'}
              </p>
            </div>
          )}

          {!loading && !error && historyItems.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {historyItems.map((session, idx) => {
                const dateText = formatHistoricalDate(session.date || session.startTime || '');
                const timeText = formatHistoricalTime(session.date || session.startTime || '');
                const statusBadge = getStatusBadge(session.status);
                const staffName = session.assignedStaffName || session.details?.staffName || session.details?.staff?.name || '';
                
                // Extract services array from session
                const rawServices = session.serviceLines && session.serviceLines.length > 0
                  ? session.serviceLines
                  : session.details?.services && session.details.services.length > 0
                    ? session.details.services
                    : session.appointments && session.appointments.length > 0
                      ? session.appointments
                      : [session];

                const refPrice = session.amount ?? session.price ?? 0;

                return (
                  <div
                    key={session.id || session.bookingSessionId || `hist-${idx}`}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-[#6537C0]/40 transition shadow-2xs space-y-2"
                  >
                    {/* Top row: Date, Time & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{dateText}</span>
                        {timeText && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 font-mono text-[11px]">{timeText}</span>
                          </>
                        )}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusBadge.bg}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    {/* Middle row: Services & Staff */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {rawServices.map((svc: any, sIdx: number) => {
                          const sName = isRtl
                            ? (svc.serviceNameAr || svc.service?.name_ar || svc.name_ar || svc.title || svc.serviceNameEn || '')
                            : (svc.serviceNameEn || svc.service?.name_en || svc.name_en || svc.title || svc.serviceNameAr || '');
                          const vName = svc.serviceVariantName || svc.variantName || svc.details?.serviceVariantName || '';
                          const isPkg = Boolean(svc.packageId || svc.packageItemId || svc.itemType === 'package');

                          return (
                            <span
                              key={sIdx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200"
                            >
                              {isPkg && <PackageIcon className="w-3 h-3 text-purple-600 shrink-0" />}
                              <span>{sName || (isRtl ? 'خدمة' : 'Service')}</span>
                              {vName && (
                                <span className="text-slate-500 font-normal">
                                  ({vName})
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>

                      {staffName && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{isRtl ? 'الموظف السابق:' : 'Previous staff:'}</span>
                          <span className="font-semibold text-slate-700">{staffName}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom row: Reference Price & Rebook Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
                      <div className="text-[10px] text-slate-500">
                        {refPrice > 0 ? (
                          <span>
                            {isRtl ? 'سعر مرجعي سابق: ' : 'Ref price: '}
                            <span className="font-bold text-slate-700">{refPrice.toFixed(2)} SAR</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            {isRtl ? 'السعر يُحسب وفق التعرفة الحالية' : 'Priced at current rates'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onRebook(session)}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#6537C0] text-white font-bold hover:bg-[#522ba3] disabled:opacity-50 transition cursor-pointer shadow-2xs text-[11px]"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{isRtl ? 'إعادة الحجز' : 'Rebook'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default CustomerBookingHistory;
