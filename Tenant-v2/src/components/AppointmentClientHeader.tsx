import React, { useState, useRef, useEffect } from 'react';
import { Phone, MessageCircle, MessageSquare, User, MoreVertical, AlertTriangle, Wallet, Sparkles, ExternalLink } from 'lucide-react';

export interface AppointmentClientHeaderProps {
  isRtl: boolean;
  customerNameEn: string;
  customerNameAr: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAvatar?: string;
  loyaltyTier?: string;
  walletBalance?: number;
  tags?: string[];
  allergies?: string | string[];
  stylistNotes?: string | string[];
  isWalkIn?: boolean;
  onViewProfile: () => void;
}

export const AppointmentClientHeader: React.FC<AppointmentClientHeaderProps> = ({
  isRtl,
  customerNameEn,
  customerNameAr,
  customerPhone,
  customerEmail,
  customerAvatar,
  loyaltyTier,
  walletBalance,
  tags = [],
  allergies,
  stylistNotes,
  isWalkIn = false,
  onViewProfile,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const displayName = isRtl
    ? customerNameAr || customerNameEn || (isWalkIn ? 'عميلة زائرة' : 'عميلة')
    : customerNameEn || customerNameAr || (isWalkIn ? 'Walk-in Client' : 'Client');

  const cleanPhone = customerPhone ? customerPhone.replace(/[^\d+]/g, '') : '';
  const waPhone = customerPhone ? customerPhone.replace(/[^\d]/g, '') : '';

  // Format allergies text
  const allergyList = Array.isArray(allergies)
    ? allergies.filter(Boolean)
    : typeof allergies === 'string' && allergies.trim()
      ? [allergies.trim()]
      : [];

  const notesList = Array.isArray(stylistNotes)
    ? stylistNotes.filter(Boolean)
    : typeof stylistNotes === 'string' && stylistNotes.trim()
      ? [stylistNotes.trim()]
      : [];

  // Initials for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E7DDFC] p-4 shadow-xs space-y-3">
      {/* Main Row: Avatar + Name + Quick Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar / Monogram */}
          <div className="relative shrink-0">
            {customerAvatar ? (
              <img
                src={customerAvatar}
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover border-2 border-[#E7DDFC] shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1D035F] to-[#6537C0] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {getInitials(displayName)}
              </div>
            )}
            {isWalkIn && (
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold"
                title={isRtl ? 'عميل بدون موعد مسبق' : 'Walk-in'}
              >
                W
              </span>
            )}
          </div>

          {/* Name & Contact Meta */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-black text-[#1D035F] truncate leading-tight font-sans">
                {displayName}
              </h3>
              {loyaltyTier && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-[#6537C0] border border-[#A379E2]/30">
                  <Sparkles size={10} />
                  <span>{loyaltyTier}</span>
                </span>
              )}
            </div>

            {customerPhone ? (
              <p className="text-xs font-mono font-medium text-slate-500 mt-0.5 truncate dir-ltr text-left">
                {customerPhone}
              </p>
            ) : customerEmail ? (
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {customerEmail}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5 italic">
                {isRtl ? 'لا يوجد هاتف مسجل' : 'No phone recorded'}
              </p>
            )}
          </div>
        </div>

        {/* Client Actions & View Profile Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onViewProfile}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F3EDFC] hover:bg-[#E7DDFC] text-[#1D035F] text-xs font-bold transition-all border border-[#E7DDFC] shadow-2xs cursor-pointer"
            title={isRtl ? 'عرض ملف العميل الشامل' : 'View Full Client Profile'}
          >
            <User size={13} className="text-[#6537C0]" />
            <span>{isRtl ? 'الملف' : 'Profile'}</span>
            <ExternalLink size={10} className="text-[#A379E2]" />
          </button>

          {/* Overflow Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-[#1D035F] hover:bg-[#F3EDFC] transition-colors cursor-pointer"
              title={isRtl ? 'خيارات العميل' : 'Client options'}
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <div
                className={`absolute top-full mt-1.5 ${isRtl ? 'left-0' : 'right-0'} w-44 bg-white rounded-xl shadow-xl border border-[#E7DDFC] py-1.5 z-30 animate-fadeIn`}
              >
                {cleanPhone && (
                  <>
                    <a
                      href={`tel:${cleanPhone}`}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Phone size={13} className="text-emerald-600" />
                      <span>{isRtl ? 'اتصال هاتفي' : 'Call client'}</span>
                    </a>
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <MessageCircle size={13} className="text-emerald-600" />
                      <span>{isRtl ? 'محادثة واتساب' : 'WhatsApp'}</span>
                    </a>
                    <a
                      href={`sms:${cleanPhone}`}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <MessageSquare size={13} className="text-blue-600" />
                      <span>{isRtl ? 'رسالة نصية SMS' : 'Send SMS'}</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onViewProfile();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#F3EDFC] hover:text-[#1D035F] transition-colors text-left"
                >
                  <User size={13} className="text-[#6537C0]" />
                  <span>{isRtl ? 'فتح سجل الزيارات' : 'Visit History'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Communication Shortcut Chips */}
      {cleanPhone && (
        <div className="flex items-center gap-2 pt-1 border-t border-[#FAF7FD]">
          <a
            href={`tel:${cleanPhone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] font-bold transition-all shadow-2xs"
            title={isRtl ? 'اتصال هاتفي' : 'Call'}
          >
            <Phone size={12} className="text-emerald-600" />
            <span>{isRtl ? 'اتصال' : 'Call'}</span>
          </a>
          <a
            href={`https://wa.me/${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] font-bold transition-all shadow-2xs"
            title={isRtl ? 'واتساب' : 'WhatsApp'}
          >
            <MessageCircle size={12} className="text-emerald-600" />
            <span>{isRtl ? 'واتساب' : 'WhatsApp'}</span>
          </a>
          <a
            href={`sms:${cleanPhone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 text-[11px] font-bold transition-all shadow-2xs"
            title={isRtl ? 'رسالة نصية' : 'SMS'}
          >
            <MessageSquare size={12} className="text-blue-600" />
            <span>{isRtl ? 'رسالة' : 'SMS'}</span>
          </a>
        </div>
      )}

      {/* Client Badges & Meta Chips */}
      {(walletBalance !== undefined && walletBalance > 0 || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {walletBalance !== undefined && walletBalance > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Wallet size={11} />
              <span>
                {isRtl ? 'رصيد المحفظة:' : 'Wallet:'}{' '}
                <strong className="font-mono">{walletBalance.toFixed(2)}</strong> {isRtl ? 'ر.س' : 'SAR'}
              </span>
            </span>
          )}
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#FAF7FD] text-[#6537C0] border border-[#E7DDFC]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Allergy Alert Banner (Clinical Warning) */}
      {allergyList.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-black text-[11px] uppercase tracking-wider block">
              {isRtl ? 'تنبيه الحساسية ⚠️' : 'ALLERGY WARNING ⚠️'}
            </span>
            <p className="text-[11px] font-medium mt-0.5 leading-snug">
              {allergyList.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Stylist / Salon Notes Snippet */}
      {notesList.length > 0 && (
        <div className="p-2.5 rounded-xl bg-[#FAF7FD] border border-[#E7DDFC] text-slate-700 text-xs">
          <span className="text-[10px] font-black uppercase text-[#6537C0] tracking-wider block mb-0.5">
            {isRtl ? 'ملاحظات خبيرة التجميل' : 'Stylist Notes'}
          </span>
          <p className="text-[11px] leading-relaxed text-slate-600 line-clamp-2">
            {notesList.join(' • ')}
          </p>
        </div>
      )}
    </div>
  );
};
