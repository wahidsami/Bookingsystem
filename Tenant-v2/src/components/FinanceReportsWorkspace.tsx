import { useState } from 'react';
import { Banknote, CreditCard, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Language } from '../types';
import FinanceOverviewReport from './reports/FinanceOverviewReport';
import CashFlowSummaryReport from './reports/CashFlowSummaryReport';
import PaymentTransactionsReport from './reports/PaymentTransactionsReport';

type FinanceTab = 'overview' | 'payment-transactions' | 'cash-flow-summary';

interface FinanceReportsWorkspaceProps {
  lang: Language;
}

export default function FinanceReportsWorkspace({ lang }: FinanceReportsWorkspaceProps) {
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');

  const tabs: Array<{ id: FinanceTab; labelEn: string; labelAr: string; icon: ReactNode }> = [
    { id: 'overview', labelEn: 'Finance Overview', labelAr: 'نظرة عامة مالية', icon: <TrendingUp size={16} /> },
    { id: 'payment-transactions', labelEn: 'Payment Transactions', labelAr: 'المعاملات المالية', icon: <CreditCard size={16} /> },
    { id: 'cash-flow-summary', labelEn: 'Cash Flow Summary', labelAr: 'ملخص التدفق النقدي', icon: <Banknote size={16} /> },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {isRtl ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' ? <FinanceOverviewReport lang={lang} /> : null}
      {activeTab === 'payment-transactions' ? <PaymentTransactionsReport lang={lang} /> : null}
      {activeTab === 'cash-flow-summary' ? <CashFlowSummaryReport lang={lang} /> : null}
    </div>
  );
}
