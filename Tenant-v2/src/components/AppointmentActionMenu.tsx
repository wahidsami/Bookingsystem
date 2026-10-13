import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Calendar, RotateCcw, Printer, Share2, AlertOctagon, XCircle, UserX, Clock } from 'lucide-react';

export interface AppointmentActionMenuProps {
  isRtl: boolean;
  appointmentStatus: string;
  isGroupBooking?: boolean;
  readOnly?: boolean;
  onReschedule?: () => void;
  onRebook?: () => void;
  onLateCancel?: () => void;
  onNoShow?: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}

export const AppointmentActionMenu: React.FC<AppointmentActionMenuProps> = ({
  isRtl,
  appointmentStatus,
  isGroupBooking = false,
  readOnly = false,
  onReschedule,
  onRebook,
  onLateCancel,
  onNoShow,
  onCancel,
  onPrint,
  onShare,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const isCancelled = appointmentStatus === 'cancelled' || appointmentStatus === 'late_cancelled';
  const isCompleted = appointmentStatus === 'completed';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-2xs"
        title={isRtl ? 'إجراءات إضافية' : 'More Actions'}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full mb-2 ${isRtl ? 'left-0' : 'right-0'} w-52 bg-white rounded-2xl shadow-xl border border-[#E7DDFC] py-2 z-40 animate-fadeIn divide-y divide-slate-100`}
        >
          {/* Section 1: Scheduling & Operational Actions */}
          <div className="py-1">
            {/* Reschedule applies ONLY to active/upcoming visits (strictly forbidden on completed) */}
            {!isCancelled && !isCompleted && !readOnly && onReschedule && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onReschedule();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors text-left cursor-pointer"
              >
                <Calendar size={14} className="text-[#6537C0]" />
                <span>{isRtl ? 'إعادة جدولة الموعد' : 'Reschedule Visit'}</span>
              </button>
            )}

            {/* Rebook creates a fresh draft for completed or previous visits */}
            {onRebook && (isCompleted || isCancelled) && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onRebook();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors text-left cursor-pointer"
              >
                <RotateCcw size={14} className="text-[#6537C0]" />
                <span>{isRtl ? 'إعادة حجز الموعد' : 'Rebook Appointment'}</span>
              </button>
            )}

            {onPrint && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onPrint();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors text-left cursor-pointer"
              >
                <Printer size={14} className="text-slate-500" />
                <span>{isRtl ? 'طباعة تفاصيل الموعد' : 'Print Summary'}</span>
              </button>
            )}

            {onShare && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onShare();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors text-left cursor-pointer"
              >
                <Share2 size={14} className="text-slate-500" />
                <span>{isRtl ? 'مشاركة عبر واتساب' : 'Share via WhatsApp'}</span>
              </button>
            )}
          </div>

          {/* Section 2: Destructive / Exception Actions */}
          {!isCancelled && !readOnly && (
            <div className="py-1">
              {onLateCancel && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onLateCancel();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors text-left cursor-pointer"
                >
                  <Clock size={14} className="text-amber-600" />
                  <span>{isRtl ? 'إلغاء متأخر' : 'Mark Late Cancel'}</span>
                </button>
              )}

              {onNoShow && !isCompleted && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNoShow();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                >
                  <UserX size={14} className="text-rose-600" />
                  <span>{isRtl ? 'تسجيل عدم حضور (No-show)' : 'Mark as No-Show'}</span>
                </button>
              )}

              {onCancel && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onCancel();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                >
                  <XCircle size={14} className="text-rose-600" />
                  <span>
                    {isGroupBooking
                      ? isRtl ? 'إلغاء الموعد أو المجموعة...' : 'Cancel Appointment / Group...'
                      : isRtl ? 'إلغاء الموعد...' : 'Cancel Appointment...'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
