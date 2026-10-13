import React, { useState } from 'react';
import { CheckCircle2, Split, CreditCard, Banknote, Wallet, Gift, X, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export interface CheckoutLineItem {
  id: string;
  nameEn: string;
  nameAr: string;
  quantity?: number;
  unitPrice: number;
  subtotal: number;
  type: string;
  stylistEn?: string;
  stylistAr?: string;
}

export interface SplitAllocations {
  card: number;
  cash: number;
  wallet: number;
  gift: number;
}

export interface AppointmentCheckoutOverlayProps {
  isRtl: boolean;
  appointmentId: string;
  customerNameEn: string;
  customerNameAr: string;
  customerWalletBalance?: number;
  lineItems: CheckoutLineItem[];
  subtotal: number;
  discount: number;
  taxable: number;
  vat: number;
  totalDue: number;
  alreadyPaid: number;
  remainingDue: number;
  onConfirmPayment: (payload: {
    paymentMethod: string;
    isSplit: boolean;
    splitAllocations: SplitAllocations;
    giftCardCode?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const AppointmentCheckoutOverlay: React.FC<AppointmentCheckoutOverlayProps> = ({
  isRtl,
  appointmentId,
  customerNameEn,
  customerNameAr,
  customerWalletBalance = 0,
  lineItems,
  subtotal,
  discount,
  taxable,
  vat,
  totalDue,
  alreadyPaid,
  remainingDue,
  onConfirmPayment,
  onClose,
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('card_pos');
  const [isSplitActive, setIsSplitActive] = useState<boolean>(false);
  const [splitAmounts, setSplitAmounts] = useState<SplitAllocations>({
    card: remainingDue > 0 ? remainingDue : 0,
    cash: 0,
    wallet: 0,
    gift: 0,
  });
  const [giftCardCodeInput, setGiftCardCodeInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const customerName = isRtl
    ? customerNameAr || customerNameEn || 'العميل'
    : customerNameEn || customerNameAr || 'Customer';

  const paymentMethodOptions = [
    { value: 'card_pos', labelEn: 'Mada / Card POS', labelAr: 'بطاقة مدى / الدفع الإلكتروني' },
    { value: 'cash', labelEn: 'Cash', labelAr: 'نقداً (كاش)' },
    { value: 'wallet', labelEn: 'Salon Wallet', labelAr: 'محفظة العميل الرقمية' },
    { value: 'gift_card_code', labelEn: 'Gift Card Voucher', labelAr: 'رمز بطاقة الهدية' },
    { value: 'bank_transfer', labelEn: 'Bank Transfer', labelAr: 'تحويل بنكي' },
  ];

  // Split calculation validation
  const splitSum = (splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0) + (splitAmounts.gift || 0);
  const splitRemaining = Math.max(0, remainingDue - splitSum);
  const isSplitValid = remainingDue > 0 && Math.abs(splitSum - remainingDue) < 0.01;
  const isSplitComplete = remainingDue > 0 && splitRemaining === 0 && isSplitValid;
  const hasOverpayment = splitSum > remainingDue + 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (isSplitActive) {
      if (!isSplitComplete) {
        setSubmitError(
          isRtl
            ? 'الرجاء إكمال تخصيص كامل المبلغ المتبقي عبر وسائل الدفع.'
            : 'Please allocate the exact remaining amount across payment methods.'
        );
        return;
      }
      if (splitAmounts.gift > 0 && !giftCardCodeInput.trim()) {
        setSubmitError(
          isRtl
            ? 'الرجاء إدخال رمز بطاقة الهدية عند اختيار الدفع بها.'
            : 'Please enter the gift card code.'
        );
        return;
      }
    } else {
      if (!selectedPaymentMethod) {
        setSubmitError(
          isRtl ? 'الرجاء اختيار وسيلة الدفع.' : 'Please select a payment method.'
        );
        return;
      }
      if (selectedPaymentMethod === 'gift_card_code' && !giftCardCodeInput.trim()) {
        setSubmitError(
          isRtl ? 'الرجاء إدخال رمز بطاقة الهدية.' : 'Please enter the gift card code.'
        );
        return;
      }
      if (selectedPaymentMethod === 'wallet' && customerWalletBalance < remainingDue) {
        setSubmitError(
          isRtl
            ? `رصيد المحفظة (${customerWalletBalance.toFixed(2)} ر.س) غير كافٍ لتغطية المبلغ المطلوب.`
            : `Wallet balance (${customerWalletBalance.toFixed(2)} SAR) is insufficient.`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onConfirmPayment({
        paymentMethod: isSplitActive ? 'split' : selectedPaymentMethod,
        isSplit: isSplitActive,
        splitAllocations: splitAmounts,
        giftCardCode: giftCardCodeInput.trim() || undefined,
      });
    } catch (err: any) {
      console.error('Checkout failed', err);
      setSubmitError(
        err?.message || (isRtl ? 'فشلت معالجة عملية الدفع.' : 'Payment processing failed.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col animate-fadeIn">
      {/* Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#E7DDFC] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl hover:bg-[#F3EDFC] text-slate-600 transition-colors cursor-pointer"
            title={isRtl ? 'العودة لتفاصيل الموعد' : 'Back to appointment'}
          >
            <ArrowLeft size={16} className={isRtl ? 'rotate-180' : ''} />
          </button>
          <div>
            <h3 className="text-sm font-black text-[#1D035F] leading-tight font-sans">
              {isRtl ? 'إتمام الدفع والتحصيل' : 'APPOINTMENT CHECKOUT'}
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              {customerName} • {isRtl ? `طلب #${appointmentId.slice(0, 8)}` : `Order #${appointmentId.slice(0, 8)}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </header>

      {/* Scrollable Checkout Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Line Items Review Card */}
        <div className="bg-[#FAF7FD] rounded-2xl border border-[#E7DDFC] p-3.5 space-y-2">
          <span className="text-[10px] font-black text-[#6537C0] uppercase tracking-wider block">
            {isRtl ? 'بنود الفاتورة المعتمدة' : 'CANONICAL LINE ITEMS'}
          </span>
          <div className="space-y-1.5 divide-y divide-slate-100">
            {lineItems.map((item, idx) => (
              <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-[#1D035F] truncate">
                    {isRtl ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}
                  </p>
                  {(item.stylistAr || item.stylistEn) && (
                    <p className="text-[10px] text-slate-400">
                      {isRtl ? item.stylistAr : item.stylistEn}
                    </p>
                  )}
                </div>
                <span className="font-mono font-black text-slate-800 shrink-0">
                  {item.subtotal.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ZATCA Tax & Pricing Breakdown */}
        <div className="bg-white rounded-2xl border border-[#E7DDFC] p-3.5 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>{isRtl ? 'الإجمالي الأساسي' : 'Subtotal'}</span>
            <span className="font-mono font-bold">{subtotal.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>{isRtl ? 'الخصومات المعتمدة' : 'Promotional Discounts'}</span>
              <span className="font-mono font-black">-{discount.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-500 border-t pt-1.5 border-dashed border-[#E7DDFC]">
            <span>{isRtl ? 'الوعاء الخاضع للضريبة' : 'Taxable Subtotal'}</span>
            <span className="font-mono font-bold">{taxable.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
          </div>

          <div className="flex justify-between text-slate-500">
            <span>{isRtl ? 'ضريبة القيمة المضافة ١٥٪ (ZATCA)' : 'ZATCA VAT (15%)'}</span>
            <span className="font-mono font-bold">{vat.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
          </div>

          <div className="flex justify-between text-sm font-black text-[#1D035F] pt-1.5 border-t border-[#E7DDFC]">
            <span>{isRtl ? 'المبلغ الإجمالي النهائي' : 'Total Amount Due'}</span>
            <span className="font-mono text-[#6537C0]">{totalDue.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
          </div>

          {alreadyPaid > 0 && (
            <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 p-2 rounded-xl border border-emerald-200">
              <span>{isRtl ? 'المسدد سابقاً' : 'Already Paid'}</span>
              <span className="font-mono font-black">{alreadyPaid.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
            </div>
          )}

          <div className="flex justify-between text-xs font-black text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
            <span>{isRtl ? 'المبلغ المطلوب سداده الآن' : 'Balance to Collect Now'}</span>
            <span className="font-mono font-black">{remainingDue.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
          </div>
        </div>

        {/* Payment Configuration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Split Mode Toggle */}
          <div className="flex items-center justify-between bg-[#FAF7FD] p-2.5 rounded-xl border border-[#E7DDFC]">
            <div className="flex items-center gap-2">
              <Split size={14} className="text-[#6537C0]" />
              <span className="text-xs font-bold text-[#1D035F]">
                {isRtl ? 'تقسيم المدفوعات (Split Payment)' : 'Split Payment'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSplitActive(!isSplitActive)}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                isSplitActive
                  ? 'bg-[#6537C0] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {isSplitActive ? (isRtl ? 'مفعّل ✓' : 'Active ✓') : (isRtl ? 'تفعيل' : 'Activate')}
            </button>
          </div>

          {/* Single Payment Method Picker */}
          {!isSplitActive ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                {isRtl ? 'طريقة التحصيل' : 'Payment Method'}
              </label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="w-full bg-white border border-[#E7DDFC] rounded-xl px-3 py-2.5 text-xs font-bold text-[#1D035F] outline-none focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/20 cursor-pointer"
              >
                {paymentMethodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isRtl ? opt.labelAr : opt.labelEn}
                  </option>
                ))}
              </select>

              {/* Wallet Info if Wallet Selected */}
              {selectedPaymentMethod === 'wallet' && (
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-[#6537C0] flex items-center justify-between">
                  <span className="font-bold">{isRtl ? 'الرصيد المتاح بالمحفظة:' : 'Available Wallet Balance:'}</span>
                  <span className="font-mono font-black">{customerWalletBalance.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
                </div>
              )}

              {/* Gift Card Code Input if Selected */}
              {selectedPaymentMethod === 'gift_card_code' && (
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {isRtl ? 'رمز بطاقة الهدية المعتمدة' : 'Gift Card Voucher Code'}
                  </label>
                  <input
                    type="text"
                    value={giftCardCodeInput}
                    onChange={(e) => setGiftCardCodeInput(e.target.value.toUpperCase())}
                    placeholder="TN-GFT-XXXX-XXXX"
                    className="w-full bg-white border border-[#E7DDFC] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1D035F] uppercase outline-none focus:border-[#6537C0]"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Split Payment Matrix */
            <div className="space-y-3 bg-[#FAF7FD] p-3.5 rounded-2xl border border-[#E7DDFC]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600">{isRtl ? 'المجموع المخصص:' : 'Allocated:'}</span>
                <span className={`font-mono font-black ${hasOverpayment ? 'text-rose-600' : isSplitComplete ? 'text-emerald-600' : 'text-[#6537C0]'}`}>
                  {splitSum.toFixed(2)} / {remainingDue.toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Mada / Card */}
                <div className="bg-white p-2.5 rounded-xl border border-[#E7DDFC] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500">Mada / Card</span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitAmounts(prev => ({ ...prev, card: parseFloat((splitRemaining + (prev.card || 0)).toFixed(2)) }))}
                        className="text-[9px] font-bold text-[#6537C0] bg-[#F3EDFC] px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        {isRtl ? '+ الباقي' : '+ Add rest'}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitAmounts.card || ''}
                    onChange={(e) => setSplitAmounts(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))}
                    className="w-full font-mono text-center font-bold text-xs p-1 border border-slate-200 rounded-lg outline-none focus:border-[#6537C0]"
                    placeholder="0.00"
                  />
                </div>

                {/* Cash */}
                <div className="bg-white p-2.5 rounded-xl border border-[#E7DDFC] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500">{isRtl ? 'كاش' : 'Cash'}</span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitAmounts(prev => ({ ...prev, cash: parseFloat((splitRemaining + (prev.cash || 0)).toFixed(2)) }))}
                        className="text-[9px] font-bold text-[#6537C0] bg-[#F3EDFC] px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        {isRtl ? '+ الباقي' : '+ Add rest'}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitAmounts.cash || ''}
                    onChange={(e) => setSplitAmounts(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))}
                    className="w-full font-mono text-center font-bold text-xs p-1 border border-slate-200 rounded-lg outline-none focus:border-[#6537C0]"
                    placeholder="0.00"
                  />
                </div>

                {/* Wallet */}
                <div className="bg-white p-2.5 rounded-xl border border-[#E7DDFC] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500">{isRtl ? 'المحفظة' : 'Wallet'}</span>
                    {splitRemaining > 0 && customerWalletBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const toAdd = Math.min(splitRemaining, customerWalletBalance - (splitAmounts.wallet || 0));
                          if (toAdd > 0) {
                            setSplitAmounts(prev => ({ ...prev, wallet: parseFloat(((prev.wallet || 0) + toAdd).toFixed(2)) }));
                          }
                        }}
                        className="text-[9px] font-bold text-[#6537C0] bg-[#F3EDFC] px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        {isRtl ? '+ الباقي' : '+ Add rest'}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitAmounts.wallet || ''}
                    onChange={(e) => setSplitAmounts(prev => ({ ...prev, wallet: parseFloat(e.target.value) || 0 }))}
                    className="w-full font-mono text-center font-bold text-xs p-1 border border-slate-200 rounded-lg outline-none focus:border-[#6537C0]"
                    placeholder="0.00"
                  />
                </div>

                {/* Gift Card */}
                <div className="bg-white p-2.5 rounded-xl border border-[#E7DDFC] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500">{isRtl ? 'بطاقة هدية' : 'Gift Card'}</span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitAmounts(prev => ({ ...prev, gift: parseFloat((splitRemaining + (prev.gift || 0)).toFixed(2)) }))}
                        className="text-[9px] font-bold text-[#6537C0] bg-[#F3EDFC] px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        {isRtl ? '+ الباقي' : '+ Add rest'}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitAmounts.gift || ''}
                    onChange={(e) => setSplitAmounts(prev => ({ ...prev, gift: parseFloat(e.target.value) || 0 }))}
                    className="w-full font-mono text-center font-bold text-xs p-1 border border-slate-200 rounded-lg outline-none focus:border-[#6537C0]"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {splitAmounts.gift > 0 && (
                <div className="pt-2 border-t border-[#E7DDFC]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {isRtl ? 'رمز بطاقة الهدية' : 'Gift Card Code'}
                  </label>
                  <input
                    type="text"
                    value={giftCardCodeInput}
                    onChange={(e) => setGiftCardCodeInput(e.target.value.toUpperCase())}
                    placeholder="TN-GFT-XXXX-XXXX"
                    className="w-full bg-white border border-[#E7DDFC] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#1D035F] uppercase outline-none focus:border-[#6537C0]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <p className="text-[11px] leading-snug">{submitError}</p>
            </div>
          )}

          {/* Sticky Checkout Confirm Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || (isSplitActive && !isSplitComplete)}
              className="w-full py-3 bg-[#6537C0] hover:bg-[#532ab0] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{isRtl ? 'جارِ معالجة التحصيل...' : 'Processing Payment...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>
                    {isRtl
                      ? `تأكيد التحصيل (${remainingDue.toFixed(2)} ر.س)`
                      : `Confirm Payment (${remainingDue.toFixed(2)} SAR)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
