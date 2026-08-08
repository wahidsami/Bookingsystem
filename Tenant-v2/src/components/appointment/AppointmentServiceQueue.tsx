import React from 'react';
import { Trash } from 'lucide-react';
import { type ServiceRecord } from '../../lib/serviceContract';

export interface StagedService {
  id: string;
  serviceId: string;
  variantId?: string;
  serviceCategory?: string;
  staffId: string;
  startTime: number;
  duration: number;
  discountType: 'none' | 'flat' | 'percent';
  discountValue: number;
  notes: string;
  basePrice?: number;
  finalPrice?: number;
}

interface AppointmentServiceQueueProps {
  isRtl: boolean;
  stagedServices: StagedService[];
  canonicalServices: ServiceRecord[];
  availableStylists: any[];
  formatMinutesToTime: (totalMins: number) => string;
  onRemoveService: (index: number) => void;
}

const toMoney = (val: any) => {
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
};

export default function AppointmentServiceQueue({
  isRtl,
  stagedServices,
  canonicalServices,
  availableStylists,
  formatMinutesToTime,
  onRemoveService
}: AppointmentServiceQueueProps) {
  const totalDuration = stagedServices.reduce((sum, item) => sum + item.duration, 0);
  const totalPrice = stagedServices.reduce((sum, item) => {
    const service = canonicalServices.find((entry) => entry.id === item.serviceId);
    const variant = service?.variants?.find((entry) => entry.id === item.variantId) || service?.variants?.[0] || null;
    const basePrice = toMoney(variant?.finalPrice ?? variant?.price ?? service?.finalPrice ?? service?.price ?? 0);
    let finalPrice = basePrice;
    if (item.discountType === 'flat') {
      finalPrice = Math.max(0, basePrice - item.discountValue);
    } else if (item.discountType === 'percent') {
      finalPrice = Math.max(0, basePrice - (basePrice * item.discountValue) / 100);
    }
    return sum + finalPrice;
  }, 0);

  return (
    <aside className="flex flex-col h-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/70">
          {isRtl ? 'جلسة الموعد' : 'Appointment session'}
        </p>
        <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
          {isRtl ? 'الخدمات المختارة' : 'Selected Services'}
        </h4>
        
        <div className="mt-4 grid grid-cols-3 gap-2 text-left">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{isRtl ? 'خدمات' : 'Items'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{stagedServices.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{isRtl ? 'مدة' : 'Duration'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {totalDuration} {isRtl ? 'د' : 'm'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{isRtl ? 'إجمالي' : 'Total'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {totalPrice.toFixed(2)} SAR
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
        {stagedServices.length > 0 ? (
          stagedServices.map((item, index) => {
            const service = canonicalServices.find((entry) => entry.id === item.serviceId) || null;
            const variant = service?.variants?.find((entry) => entry.id === item.variantId) || null;
            const staff = availableStylists.find((stylist) => stylist.id === item.staffId) || null;
            const basePrice = toMoney(variant?.finalPrice ?? variant?.price ?? service?.finalPrice ?? service?.price ?? 0);
            const discountedPrice = item.discountType === 'flat'
              ? Math.max(0, basePrice - item.discountValue)
              : item.discountType === 'percent'
                ? Math.max(0, basePrice - (basePrice * item.discountValue) / 100)
                : basePrice;

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-start gap-3 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-black text-white">
                    #{index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {isRtl ? service?.nameAr || service?.nameEn || item.serviceId : service?.nameEn || service?.nameAr || item.serviceId}
                        </p>
                        {variant && (
                          <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                            {isRtl ? variant.nameAr || variant.nameEn : variant.nameEn || variant.nameAr}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-semibold text-slate-900">{discountedPrice.toFixed(2)} SAR</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                        {staff ? (isRtl ? staff.nameAr : staff.nameEn) : (isRtl ? 'تعيين تلقائي' : 'Auto')}
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                        {formatMinutesToTime(item.startTime)}
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                        {item.duration} {isRtl ? 'د' : 'm'}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => onRemoveService(index)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      aria-label="Remove service"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-32 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <p className="text-xs font-medium text-slate-500">
              {isRtl
                ? 'لا توجد خدمات مختارة. ابدأ بإضافة خدمات من القائمة.'
                : 'No services selected. Start by adding services from the browser.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
