import React from 'react';
import { Clock, User, Edit3, Trash2, Sparkles, ShieldAlert, Check } from 'lucide-react';

export interface AppointmentServiceItem {
  id: string;
  serviceId?: string;
  serviceNameEn: string;
  serviceNameAr: string;
  serviceVariantId?: string;
  serviceVariantName?: string;
  serviceVariantDescription?: string;
  duration: number; // in minutes
  startTime?: string | number; // ISO string or board minutes
  endTime?: string | number;
  staffId?: string;
  staffNameEn?: string;
  staffNameAr?: string;
  staffAvatar?: string;
  price: number; // authoritative SAR price
  rawPrice?: number;
  isComplimentary?: boolean;
  participantName?: string; // for group bookings
  participantId?: string;
  resourceWarning?: string | null;
  overtimeApproved?: boolean;
}

export interface AppointmentServiceCardProps {
  isRtl: boolean;
  item: AppointmentServiceItem;
  canEdit?: boolean;
  canRemove?: boolean;
  formatMinutesToTime?: (mins: number) => string;
  onEdit?: (item: AppointmentServiceItem) => void;
  onRemove?: (item: AppointmentServiceItem) => void;
}

export const AppointmentServiceCard: React.FC<AppointmentServiceCardProps> = ({
  isRtl,
  item,
  canEdit = true,
  canRemove = false,
  formatMinutesToTime,
  onEdit,
  onRemove,
}) => {
  const serviceName = isRtl
    ? item.serviceNameAr || item.serviceNameEn || 'الخدمة'
    : item.serviceNameEn || item.serviceNameAr || 'Service';

  const variantName = isRtl
    ? item.serviceVariantDescription || item.serviceVariantName || ''
    : item.serviceVariantName || item.serviceVariantDescription || '';

  const staffName = isRtl
    ? item.staffNameAr || item.staffNameEn || 'غير محدد'
    : item.staffNameEn || item.staffNameAr || 'Unassigned';

  // Format time range
  const formatTimeRange = () => {
    if (typeof item.startTime === 'number' && formatMinutesToTime) {
      const start = formatMinutesToTime(item.startTime);
      const end = formatMinutesToTime(item.startTime + item.duration);
      return `${start} – ${end}`;
    }
    if (typeof item.startTime === 'string' && item.startTime.includes('T')) {
      try {
        const startDate = new Date(item.startTime);
        const endDate = item.endTime ? new Date(item.endTime as string) : new Date(startDate.getTime() + item.duration * 60000);
        const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
        const startStr = startDate.toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', opts);
        const endStr = endDate.toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', opts);
        return `${startStr} – ${endStr}`;
      } catch {
        return `${item.duration} min`;
      }
    }
    return `${item.duration} ${isRtl ? 'دقيقة' : 'min'}`;
  };

  return (
    <div className="group relative bg-white hover:bg-[#FAF7FD] rounded-xl border border-[#E7DDFC] hover:border-[#6537C0]/40 p-3 transition-all shadow-2xs space-y-2">
      {/* Participant Badge (Group Bookings) */}
      {item.participantName && (
        <div className="flex items-center justify-between pb-1.5 border-b border-[#FAF7FD]">
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-[#F3EDFC] text-[#6537C0] border border-[#E7DDFC]">
            <User size={10} />
            <span>{item.participantName}</span>
          </span>
          {item.isComplimentary && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {isRtl ? 'مجاني 🎁' : 'Complimentary 🎁'}
            </span>
          )}
        </div>
      )}

      {/* Main Service Info Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-black text-[#1D035F] leading-snug truncate font-sans">
            {serviceName}
          </h4>
          {variantName && variantName !== serviceName && (
            <p className="text-xs font-semibold text-[#6537C0] mt-0.5 truncate">
              {variantName}
            </p>
          )}
        </div>

        {/* Price Tag */}
        <div className="text-right shrink-0">
          <p className="text-sm font-black font-mono text-[#1D035F]">
            {item.price.toFixed(2)}{' '}
            <span className="text-[10px] font-sans font-bold text-[#A379E2]">
              {isRtl ? 'ر.س' : 'SAR'}
            </span>
          </p>
          {item.rawPrice && item.rawPrice > item.price && (
            <p className="text-[10px] font-mono line-through text-slate-400">
              {item.rawPrice.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Middle Row: Duration, Time Range, Stylist */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#FAF7FD] text-xs">
        {/* Timing Pill */}
        <div className="flex items-center gap-1.5 text-slate-600 bg-[#FAF7FD] px-2.5 py-1 rounded-xl border border-[#E7DDFC]/60">
          <Clock size={12} className="text-[#6537C0] shrink-0" />
          <span className="font-mono font-bold text-[11px] text-slate-700">
            {formatTimeRange()}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            ({item.duration} {isRtl ? 'د' : 'm'})
          </span>
        </div>

        {/* Assigned Stylist Pill */}
        <div className="flex items-center gap-1.5 bg-[#FAF7FD] px-2.5 py-1 rounded-xl border border-[#E7DDFC]/60">
          {item.staffAvatar ? (
            <img
              src={item.staffAvatar}
              alt={staffName}
              className="w-4 h-4 rounded-full object-cover shrink-0"
            />
          ) : (
            <User size={12} className="text-[#6537C0] shrink-0" />
          )}
          <span className="text-[11px] font-bold text-[#1D035F] truncate max-w-[120px]">
            {staffName}
          </span>
        </div>
      </div>

      {/* Badges / Warnings */}
      {(item.overtimeApproved || item.resourceWarning) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {item.overtimeApproved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <Sparkles size={10} />
              <span>{isRtl ? 'تمديد خارج الدوام معتمد' : 'Overtime Approved'}</span>
            </span>
          )}
          {item.resourceWarning && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert size={10} />
              <span>{item.resourceWarning}</span>
            </span>
          )}
        </div>
      )}

      {/* Actions (Edit / Remove) */}
      {(canEdit || canRemove) && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#FAF7FD]">
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-[#6537C0] hover:bg-[#F3EDFC] text-[11px] font-bold transition-all cursor-pointer"
              title={isRtl ? 'تعديل الخدمة والخبيرة والوقت' : 'Edit service, staff, or timing'}
            >
              <Edit3 size={12} />
              <span>{isRtl ? 'تعديل' : 'Edit'}</span>
            </button>
          )}
          {canRemove && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition-all cursor-pointer"
              title={isRtl ? 'حذف هذه الخدمة' : 'Remove service'}
            >
              <Trash2 size={12} />
              <span>{isRtl ? 'حذف' : 'Remove'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
