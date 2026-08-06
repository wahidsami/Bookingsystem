import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { TeamMemberData } from '../../types/employee';

interface FinanceRulesSectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
}

export default function FinanceRulesSection({ formData, setFormData, isRtl }: FinanceRulesSectionProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border-b border-neutral-100 pb-2">
        <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
          {isRtl ? 'إعدادات المستحقات والرواتب والعمولات' : 'Financial Compensation Rules'}
        </h4>
        <p className="text-[11px] text-neutral-400 font-medium">Reconcile official WPS contracts, define base salary levels, service commission rates, and enable product retail payouts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'الراتب الأساسي الشهري (SAR) *' : 'Contracted Monthly Base Salary (SAR) *'}
          </label>
          <input
            type="number"
            required
            value={formData.baseSalary}
            onChange={e => setFormData(p => ({ ...p, baseSalary: Math.max(0, parseInt(e.target.value) || 0) }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'نسبة عمولة حجز الخدمات %' : 'Service Commissions Percentage %'}
          </label>
          <div className="relative">
            <input
              type="number"
              value={formData.commissionRatePct}
              onChange={e => setFormData(p => ({ ...p, commissionRatePct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white pr-8 text-center"
            />
            <span className="absolute right-3.5 top-3 text-neutral-400 font-mono">%</span>
          </div>
        </div>

        {/* Financial Toggles */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] text-neutral-500 font-extrabold block">
            {isRtl ? 'قوانين وقنوات احتساب العمولات النشطة' : 'Active Financial Compensation Channels'}
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, serviceCommissionEnabled: !p.serviceCommissionEnabled }))}
              className={`p-4 rounded-2xl text-xs font-black text-start transition-all cursor-pointer border flex items-center gap-3 ${
                formData.serviceCommissionEnabled 
                  ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' 
                  : 'bg-slate-50 text-neutral-500 border-slate-200'
              }`}
            >
              {formData.serviceCommissionEnabled ? <CheckSquare size={16} /> : <Square size={16} />}
              <div>
                <p>{isRtl ? 'احتساب عمولة الخدمات الفنية' : 'Enable Service Booking Commission'}</p>
                <span className="text-[9px] font-bold text-neutral-400 block mt-0.5">
                  Applies selected {formData.commissionRatePct}% to the stylist gross services total.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, productCommissionEnabled: !p.productCommissionEnabled }))}
              className={`p-4 rounded-2xl text-xs font-black text-start transition-all cursor-pointer border flex items-center gap-3 ${
                formData.productCommissionEnabled 
                  ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' 
                  : 'bg-slate-50 text-neutral-500 border-slate-200'
              }`}
            >
              {formData.productCommissionEnabled ? <CheckSquare size={16} /> : <Square size={16} />}
              <div>
                <p>{isRtl ? 'تفعيل عمولة بيع مستحضرات التجزئة (٥٪)' : 'Enable Product Retail Commission (5% Flat)'}</p>
                <span className="text-[9px] font-bold text-neutral-400 block mt-0.5">
                  Grants a 5% incentive commission on all premium shelf product items sold to checkout clients.
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
