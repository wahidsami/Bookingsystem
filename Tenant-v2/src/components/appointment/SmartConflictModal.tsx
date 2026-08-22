import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, User, Loader2 } from 'lucide-react';
import { ChainConflictDialogState, ChainConflictView, BookingRecoveryMode } from '../../hooks/useSmartConflictResolver';

interface SmartConflictModalProps {
  isRtl?: boolean;
  startHour?: number;
  stylists: any[];
  canonicalServices: any[];
  conflictDialog: ChainConflictDialogState | null;
  conflictView: ChainConflictView;
  bookingRecoveryMode: BookingRecoveryMode;
  setConflictView: (view: ChainConflictView) => void;
  setConflictDialog: React.Dispatch<React.SetStateAction<ChainConflictDialogState | null>>;
  onClose: () => void;
  onModifyProfessionals: () => void;
  onSeparateServices: () => void;
  onConfirm?: (chain: any) => void;
  onSearchDate?: (dateStr: string) => void;
}

const formatConflictTime = (isoString: string, isRtl: boolean) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? (isRtl ? 'م' : 'PM') : (isRtl ? 'ص' : 'AM');
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
};

const formatMinutesToTime = (totalMinutes: number, isRtl = false) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  // NOTE: This assumes startHour logic is applied by the caller if needed.
  // In the original component, it was `const min = ... - (START_HOUR * 60)`.
  // We expect the caller to pass absolute minutes or we format the absolute date instead.

  const displayH = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? (isRtl ? 'م' : 'PM') : (isRtl ? 'ص' : 'AM');
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
};

export const SmartConflictModal: React.FC<SmartConflictModalProps> = ({
  isRtl = false,
  startHour = 9,
  stylists,
  canonicalServices,
  conflictDialog,
  conflictView,
  bookingRecoveryMode,
  setConflictView,
  setConflictDialog,
  onClose,
  onModifyProfessionals,
  onSeparateServices,
  onConfirm,
  onSearchDate
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    conflictDialog?.selectedDateKey || new Date().toISOString().split('T')[0]
  );

  if (!conflictDialog) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl relative z-10 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center gap-3 mb-4 text-rose-600">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="text-lg font-bold">
              {isRtl ? 'تعذر إكمال الحجز' : 'Unable to complete booking'}
            </h3>
          </div>

          {conflictView === 'explanation' && (
            <>
              <p className="text-sm font-medium text-slate-800 mb-2">
                {isRtl ? 'لا يمكن تنفيذ الخدمات بشكل متواصل في الوقت المحدد للأسباب التالية:' : 'The requested services cannot be booked continuously due to the following reasons:'}
              </p>
              <div className="mb-6 space-y-3">
                {conflictDialog.conflictCards?.map((card, idx) => (
                  <div key={`${card.staffId || card.staffName || 'conflict'}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600">
                        {card.avatar ? (
                          <img src={card.avatar} alt={card.staffName} className="h-full w-full object-cover" />
                        ) : (
                          <span>
                            {card.staffName
                              .split(' ')
                              .filter(Boolean)
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-extrabold text-slate-900">{card.staffName}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${card.reasonType === 'existing_booking' ? 'bg-rose-50 text-rose-600' : card.reasonType === 'outside_working_hours' ? 'bg-amber-50 text-amber-700' : card.reasonType === 'time_off' ? 'bg-slate-100 text-slate-600' : card.reasonType === 'blocked_time' ? 'bg-orange-50 text-orange-700' : card.reasonType === 'staff_break' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{card.reasonTitle}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{card.reasonDescription}</p>
                        {(card.conflictStartTime || card.conflictEndTime) && (
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {formatConflictTime(card.conflictStartTime || '', isRtl)}
                            {card.conflictEndTime ? ` – ${formatConflictTime(card.conflictEndTime, isRtl)}` : ''}
                          </p>
                        )}
                        {card.workingHoursEnd && card.reasonType === 'outside_working_hours' && (
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {isRtl
                              ? `ينتهي دوامها: ${formatConflictTime(card.workingHoursEnd, isRtl)}`
                              : `Working hours end: ${formatConflictTime(card.workingHoursEnd, isRtl)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setConflictView('date-selection')}
                  className="w-full px-4 py-3 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  {isRtl ? 'البحث عن موعد بديل' : 'Search for alternative time'}
                </button>

                <button
                  onClick={onModifyProfessionals}
                  className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  {isRtl ? 'تعديل المختصين' : 'Modify Professionals'}
                </button>

                {bookingRecoveryMode !== 'separate_services' && (
                  <button
                    onClick={onSeparateServices}
                    className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    {isRtl ? 'حجز الخدمات بشكل منفصل' : 'Book services separately'}
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mt-2"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </>
          )}

          {conflictView === 'date-selection' && (
            <>
              <p className="text-sm font-medium text-slate-800 mb-4">
                {isRtl ? 'اختر اليوم الذي تريد البحث فيه' : 'Choose the day to search'}
              </p>

              <div className="flex flex-col gap-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                />

                <button
                  onClick={() => onSearchDate && onSearchDate(selectedDate)}
                  className="w-full px-4 py-3 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  {isRtl ? 'بحث في هذا التاريخ' : 'Search this date'}
                </button>
              </div>

              <button
                onClick={() => setConflictView('explanation')}
                className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mt-4"
              >
                {isRtl ? 'رجوع' : 'Back'}
              </button>
            </>
          )}

          {conflictView === 'time-selection' && (
            <>
              <p className="text-sm font-bold text-slate-800 mb-4">
                {isRtl ? 'الأوقات المتاحة لبدء الحجز' : 'Available Start Times'}
              </p>

              {conflictDialog.validChains.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {conflictDialog.validChains.map((chain, i) => {
                     const d = new Date(chain.startTime);
                     const min = (d.getHours() * 60 + d.getMinutes()) - (startHour * 60);
                     return (
                       <button
                         key={i}
                         onClick={() => setConflictDialog(prev => prev ? { ...prev, selectedChain: chain } : null) || setConflictView('confirmation')}
                         className="px-2 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                       >
                         {formatMinutesToTime(min + (startHour * 60), isRtl)}
                       </button>
                     );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-600 mb-6">
                    {isRtl ? 'لا توجد سلسلة متواصلة متاحة في هذا اليوم. يمكنك اختيار يوماً آخر للبحث عن موعد مناسب.' : 'No continuous chain available on this day. Please choose another day.'}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setConflictView('date-selection')}
                  className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  {isRtl ? 'اختيار يوم آخر' : 'Choose another day'}
                </button>
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </>
          )}

          {conflictView === 'confirmation' && conflictDialog.selectedChain && (
            <>
              <p className="text-sm font-bold text-emerald-600 mb-2">
                {isRtl ? 'الموعد متاح' : 'Time is available'}
              </p>
              <p className="text-sm text-slate-600 mb-6">
                {isRtl ? 'يمكن تنفيذ الخدمات بالتسلسل في الوقت الذي اخترته:' : 'The services can be executed sequentially at the time you chose:'}
              </p>

              <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {conflictDialog.selectedChain.slots.map((slot: any, index: number) => {
                  const srv = canonicalServices.find(s => s.id === slot.serviceId);
                  const st = stylists.find(s => s.id === slot.staffId);
                  const dStart = new Date(slot.startTime);
                  const dEnd = new Date(slot.endTime);
                  const startMin = dStart.getHours() * 60 + dStart.getMinutes();
                  const endMin = dEnd.getHours() * 60 + dEnd.getMinutes();

                  return (
                    <div key={index} className="flex flex-col gap-1 text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div className="font-bold text-slate-800">{isRtl ? srv?.nameAr : srv?.nameEn}</div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5"/> {isRtl ? st?.nameAr : st?.nameEn}</span>
                        <span className="flex items-center gap-1 font-mono text-xs">{formatMinutesToTime(startMin, isRtl)} - {formatMinutesToTime(endMin, isRtl)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-sm font-semibold text-slate-800 text-center mb-6">
                {isRtl ? 'هل تريد حجز هذا الموعد الآن؟' : 'Do you want to book this time now?'}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  disabled={conflictDialog.isRevalidating}
                  onClick={() => onConfirm ? onConfirm(conflictDialog.selectedChain) : null}
                  className="w-full px-4 py-3 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {conflictDialog.isRevalidating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isRtl ? 'نعم، احجز الموعد' : 'Yes, book this time'}
                </button>
                <button
                  disabled={conflictDialog.isRevalidating}
                  onClick={() => setConflictView('time-selection')}
                  className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {isRtl ? 'اختيار وقت آخر' : 'Choose another time'}
                </button>
                <button
                  disabled={conflictDialog.isRevalidating}
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
