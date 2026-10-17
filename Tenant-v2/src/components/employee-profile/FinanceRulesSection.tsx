import React from 'react';
import { CheckSquare, Square, DollarSign, Percent, ShieldCheck } from 'lucide-react';
import { TeamMemberData } from '../../types/employee';

interface FinanceRulesSectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
}

export default function FinanceRulesSection({ formData, setFormData, isRtl }: FinanceRulesSectionProps) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-neutral-100 pb-3">
        <h4 className="text-sm font-black text-neutral-900 tracking-tight flex items-center gap-2">
          <DollarSign size={16} className="text-[#6537C0]" />
          <span>{isRtl ? 'قواعد المستحقات المالية والرواتب والعمولات' : 'Financial Rules & Compensation'}</span>
        </h4>
        <p className="text-xs text-neutral-500 font-medium mt-0.5">
          {isRtl 
            ? 'تحديد الراتب الأساسي المطابق لنظام حماية الأجور (WPS)، نسب عمولة الخدمات، وقنوات صرف عمولات مبيعات التجزئة.' 
            : 'Reconcile base salaries with WPS standards, set service commission rates, and activate retail product payouts.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Base Salary Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center justify-between">
            <span>{isRtl ? 'الراتب الأساسي الشهري التعاقدي *' : 'Contracted Monthly Base Salary *'}</span>
            <span className="text-[10px] text-neutral-400 font-normal">SAR</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min={0}
              required
              value={formData.baseSalary}
              onChange={e => setFormData(p => ({ ...p, baseSalary: Math.max(0, parseInt(e.target.value) || 0) }))}
              placeholder="0"
              className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-mono font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors"
            />
          </div>
        </div>

        {/* Commission Rate % Input with Direction-Aware Label */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center justify-between">
            <span>{isRtl ? 'نسبة عمولة حجز الخدمات الفنية' : 'Service Commission Percentage'}</span>
            <span className="text-[10px] text-neutral-400 font-normal">0 - 100%</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              min={0}
              max={100}
              value={formData.commissionRatePct}
              onChange={e => setFormData(p => ({ ...p, commissionRatePct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
              placeholder="0"
              className={`w-full bg-neutral-50/60 border border-neutral-200 rounded-xl p-2.5 text-xs font-mono font-bold text-neutral-900 focus:bg-white focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] transition-colors ${
                isRtl ? 'pl-8 text-start' : 'pr-8 text-start'
              }`}
            />
            <span className={`absolute top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs pointer-events-none ${
              isRtl ? 'left-3' : 'right-3'
            }`}>
              %
            </span>
          </div>
        </div>

        {/* Financial Channels Toggles with BARSPA Purple Design */}
        <div className="space-y-2 md:col-span-2 pt-1">
          <label className="text-[11px] text-neutral-600 font-extrabold flex items-center gap-1.5">
            <Percent size={13} className="text-[#6537C0]" />
            <span>{isRtl ? 'قنوات تفعيل واحتساب العمولات' : 'Active Compensation Channels'}</span>
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Service Commission Toggle */}
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, serviceCommissionEnabled: !p.serviceCommissionEnabled }))}
              className={`p-3.5 rounded-2xl text-xs font-bold text-start transition-all cursor-pointer border flex items-start gap-3 ${
                formData.serviceCommissionEnabled 
                  ? 'bg-purple-50/70 border-purple-200/90 text-[#1D035F] shadow-xs' 
                  : 'bg-neutral-50/50 text-neutral-600 border-neutral-200/80 hover:bg-neutral-100/60'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {formData.serviceCommissionEnabled ? (
                  <CheckSquare size={16} className="text-[#6537C0]" />
                ) : (
                  <Square size={16} className="text-neutral-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs">
                  {isRtl ? 'تفعيل عمولة الخدمات الفنية' : 'Enable Service Booking Commission'}
                </p>
                <p className="text-[10px] text-neutral-500 font-normal mt-0.5 leading-relaxed">
                  {isRtl 
                    ? `تطبيق نسبة ${formData.commissionRatePct}٪ على إجمالي قيمة الخدمات المنجزة بواسطة هذا الموظف.`
                    : `Applies ${formData.commissionRatePct}% to the total gross amount of services performed by this employee.`}
                </p>
              </div>
            </button>

            {/* Product Commission Toggle */}
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, productCommissionEnabled: !p.productCommissionEnabled }))}
              className={`p-3.5 rounded-2xl text-xs font-bold text-start transition-all cursor-pointer border flex items-start gap-3 ${
                formData.productCommissionEnabled 
                  ? 'bg-purple-50/70 border-purple-200/90 text-[#1D035F] shadow-xs' 
                  : 'bg-neutral-50/50 text-neutral-600 border-neutral-200/80 hover:bg-neutral-100/60'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {formData.productCommissionEnabled ? (
                  <CheckSquare size={16} className="text-[#6537C0]" />
                ) : (
                  <Square size={16} className="text-neutral-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs">
                  {isRtl ? 'تفعيل عمولة مبيعات التجزئة (٥٪)' : 'Enable Product Retail Commission (5%)'}
                </p>
                <p className="text-[10px] text-neutral-500 font-normal mt-0.5 leading-relaxed">
                  {isRtl 
                    ? 'منح عمولة تشجيعية بنسبة 5٪ على كافة منتجات العناية المباعة للعملاء عبر نقطة البيع.'
                    : 'Grants a 5% incentive commission on all retail beauty care products sold at checkout.'}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* WPS Compliance Notice */}
        <div className="md:col-span-2 bg-neutral-50/80 border border-neutral-200/70 p-3 rounded-xl flex items-start gap-2.5 text-xs text-neutral-600">
          <ShieldCheck size={16} className="text-[#6537C0] shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold text-neutral-800">
              {isRtl ? 'نظام حماية الأجور (WPS): ' : 'Wage Protection System (WPS): '}
            </span>
            <span className="text-neutral-500 font-medium">
              {isRtl 
                ? 'تُدرج رواتب وعمولات الموظفين تلقائياً ضمن مسيرات الرواتب الشهرية لمطابقة متطلبات وزارة الموارد البشرية وبوابة قوى.'
                : 'Salaries and commissions are automatically aggregated into monthly payroll runs compliant with Qiwa and official bank portals.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
