import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CreditCard,
  FileText,
  Gift,
  RefreshCw,
  Sparkles,
  Clock,
  Users,
  Wallet,
} from 'lucide-react';
import {
  BIActiveFilterSummary,
  BIDataTable,
  BIDetailsDrawer,
  BIKpiCards,
  BIReportFilters,
  BIReportShell,
  BIReportToolbar,
  BIPagination,
} from '../bi';
import {
  buildExportFileName,
  downloadCsv,
  downloadTextFile,
  resolveBIDateRange,
  serializeRowsToCsv,
  useBIColumnPreferences,
  useBISavedViews,
} from '../../lib/bi';
import { useBIReportRefreshSignal } from '../../lib/bi/refreshSignals';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import {
  createGiftCardListReportDefinition,
  type GiftCardListReportOptions,
  type GiftCardListTableRow,
} from '../../lib/bi/reports/giftCardList';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type GiftCardListPayload = {
  giftCards?: any[];
  giftCardSummary?: any;
  transactions?: any[];
};

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
  if (value === null || value === undefined || value === '') return lang === 'ar' ? 'غير متاح' : 'Unavailable';
  const number = Number(value);
  if (!Number.isFinite(number)) return lang === 'ar' ? 'غير متاح' : 'Unavailable';
  return `${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;
}

function formatDate(value: unknown, lang: Language): string {
  if (!value) return lang === 'ar' ? 'غير متاح' : 'Unavailable';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(lang === 'ar' ? 'ar-SA' : undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatText(value: unknown, fallback = 'Unavailable'): string {
  if (value === null || value === undefined || value === '' || value === '-') return fallback;
  return `${value}`;
}

function humanizeStatus(value: unknown, lang: Language): string {
  const text = `${value ?? ''}`.trim();
  if (!text) return lang === 'ar' ? 'غير متاح' : 'Unavailable';
  if (lang === 'ar') {
    const normalized = text.toLowerCase();
    const translations: Record<string, string> = {
      issued: 'صادرة',
      purchased: 'مشتراة',
      redeemed: 'مستردة',
      partially: 'مستردة جزئياً',
      partial: 'مستردة جزئياً',
      expired: 'منتهية الصلاحية',
      active: 'نشطة',
      inactive: 'غير نشطة',
      disabled: 'معطلة',
      pending: 'قيد الانتظار',
      available: 'متاحة',
      unavailable: 'غير متاحة',
    };
    const direct = translations[normalized];
    if (direct) return direct;
  }
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dedupeOptions(options: BIOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const value = `${option.value ?? ''}`.trim();
    if (!value) return false;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function uniqueValues(rows: GiftCardListTableRow[], accessor: (row: GiftCardListTableRow) => string) {
  const seen = new Set<string>();
  const options: BIOption[] = [];
  rows.forEach((row) => {
    const value = `${accessor(row) || ''}`.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ label: value, value });
  });
  return options;
}

function buildPrintHtml({
  title,
  description,
  rows,
  columns,
  lang,
}: {
  title: string;
  description: string;
  rows: GiftCardListTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: GiftCardListTableRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: GiftCardListTableRow, column: { accessor: any; format?: (value: unknown, row: GiftCardListTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof GiftCardListTableRow];
    const formatted = column.format ? column.format(rawValue, row) : rawValue;
    if (formatted === null || formatted === undefined || formatted === '') return lang === 'ar' ? 'غير متاح' : 'Unavailable';
    if (typeof formatted === 'number') return formatted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted}`;
  };

  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 16px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <table>
          <thead>
            <tr>${columns.map((column) => `<th>${column.header}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${columns.map((column) => `<td>${renderValue(row, column)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function SectionBlock({
  title,
  children,
  description,
  icon,
}: {
  title: string;
  children: ReactNode;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon ? <span className="text-slate-500">{icon}</span> : null}
            <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
          </div>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, emptyLabel = 'Unavailable' }: { label: string; value: ReactNode; emptyLabel?: string }) {
  const normalizedValue = value === null || value === undefined || value === '' || value === '-'
    ? emptyLabel
    : value;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{normalizedValue}</span>
    </div>
  );
}

function buildGiftCardRows(report: GiftCardListPayload, lang: Language): GiftCardListTableRow[] {
  const unavailableText = lang === 'ar' ? 'غير متاح' : 'Unavailable';
  const giftCardRows = Array.isArray(report.giftCards) && report.giftCards.length
    ? report.giftCards
    : Array.isArray(report.transactions)
      ? report.transactions
      : [];

  return giftCardRows.map((row: any) => ({
    id: String(row?.id || row?.giftCardCode || row?.saleNumber || row?.sourceTransaction?.id || '-'),
    giftCardCode: formatText(row?.giftCardCode || row?.code || row?.sourceTransaction?.giftCardCode || unavailableText, unavailableText),
    saleNumber: formatText(row?.saleNumber || row?.sourceTransaction?.id || unavailableText, unavailableText),
    purchasedBy: formatText(row?.purchasedBy || row?.sourceTransaction?.metadata?.createdByLabel || row?.sourceTransaction?.metadata?.paymentCollectedByLabel || unavailableText, unavailableText),
    redeemedBy: formatText(row?.redeemedBy || unavailableText, unavailableText),
    customer: formatText(row?.customer || unavailableText, unavailableText),
    status: humanizeStatus(row?.status, lang),
    issueDate: row?.issueDate || row?.createdAt || row?.sourceTransaction?.createdAt || null,
    expiryDate: row?.expiryDate || row?.expiresAt || row?.sourceTransaction?.expiresAt || null,
    originalAmount: row?.originalAmount === null || row?.originalAmount === undefined ? null : Number(row.originalAmount),
    redeemedAmount: row?.redeemedAmount === null || row?.redeemedAmount === undefined ? null : Number(row.redeemedAmount),
    remainingBalance: row?.remainingBalance === null || row?.remainingBalance === undefined ? null : Number(row.remainingBalance),
    invoiceNumber: formatText(row?.invoiceNumber || row?.sourceTransaction?.metadata?.invoiceNumber || unavailableText, unavailableText),
    location: formatText(row?.location || unavailableText, unavailableText),
    employee: formatText(row?.employee || row?.purchasedBy || unavailableText, unavailableText),
    paymentMethod: formatText(row?.paymentMethod || unavailableText, unavailableText),
    sourceTransaction: row?.sourceTransaction || row,
    redemptions: Array.isArray(row?.redemptions) ? row.redemptions : [],
    latestRedemption: row?.latestRedemption || null,
  }));
}

function buildGiftCardBackendGaps(rows: GiftCardListTableRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.invoiceNumber === 'Unavailable')) gaps.add('Invoice Number');
  if (rows.some((row) => row.originalAmount == null)) gaps.add('Original Amount');
  if (rows.some((row) => row.redeemedAmount == null)) gaps.add('Redeemed Amount');
  if (rows.some((row) => row.remainingBalance == null)) gaps.add('Remaining Balance');
  return Array.from(gaps);
}

function GiftCardActivityViewer({ rowId, lang, copy }: { rowId: string; lang: Language; copy: any }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const res = await tenantApiAdapter.get(`/tenant/gift-cards/reports/transactions/${rowId}/activity`);
        if (active && res.success) setData(res.activity);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    if (rowId) fetchActivity();
    return () => { active = false; };
  }, [rowId]);

  if (loading) return <div className="p-8 text-center text-sm text-slate-500">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>;
  if (!data || !data.transaction) return <div className="p-8 text-center text-sm text-red-500">{lang === 'ar' ? 'فشل تحميل بيانات النشاط' : 'Failed to load activity'}</div>;

  const { transaction, walletCreditLedgerEntry, subsequentWalletActivity } = data;
  const isAutoWallet = transaction.sourceTransaction?.status === 'sent_completed_auto_wallet';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{copy.general}</div>
        <div className="mt-3 space-y-2 text-sm">
          <Field label={copy.giftCardCode} value={transaction.giftCardCode} emptyLabel={copy.unavailable} />
          <Field label={copy.status} value={humanizeStatus(transaction.status, lang)} emptyLabel={copy.unavailable} />
          <Field label={copy.issueDate} value={formatDate(transaction.issueDate, lang)} emptyLabel={copy.unavailable} />
          <Field label={copy.expiryDate} value={formatDate(transaction.expiryDate, lang)} emptyLabel={copy.unavailable} />
          <Field label={copy.originalAmountField} value={formatMoney(transaction.originalAmount, lang)} emptyLabel={copy.unavailable} />
          <Field label={copy.remainingBalanceField} value={formatMoney(transaction.remainingBalance, lang)} emptyLabel={copy.unavailable} />
          <Field label={lang === 'ar' ? 'المدفوع من العميل' : 'Paid by Customer'} value={formatMoney(transaction.sourceTransaction?.purchaseAmount, lang)} emptyLabel={copy.unavailable} />
          <Field label={copy.purchasedFor} value={transaction.customer} emptyLabel={copy.unavailable} />
        </div>
      </div>

      {!isAutoWallet ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{copy.redemption}</div>
          <div className="mt-3 space-y-4 text-sm">
            <Field label={copy.redeemedAmountField} value={formatMoney(transaction.redeemedAmount, lang)} emptyLabel={copy.unavailable} />
            <Field label={copy.redemptionsCount} value={String(transaction.redemptions?.length || 0)} emptyLabel={copy.unavailable} />

            {transaction.redemptions && transaction.redemptions.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="mb-2 font-semibold text-slate-900">{lang === 'ar' ? 'سجل الاسترداد' : 'Redemption History'}</div>
                <div className="space-y-3">
                  {transaction.redemptions.map((red: any, idx: number) => (
                    <div key={idx} className="rounded-lg bg-white p-3 shadow-sm border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-900">{formatMoney(red.redeemedAmount, lang)}</span>
                        <span className="text-xs text-slate-500">{formatDate(red.redeemedAt, lang)}</span>
                      </div>
                      {red.appointment && (
                        <div className="text-xs text-slate-600 mt-1">
                          {lang === 'ar' ? 'موعد' : 'Appointment'}: {red.appointment.bookingNumber}
                          {red.appointment.service && ` - ${lang === 'ar' ? red.appointment.service.name_ar : red.appointment.service.name_en}`}
                        </div>
                      )}
                      {red.order && (
                        <div className="text-xs text-slate-600 mt-1">
                          {lang === 'ar' ? 'طلب' : 'Order'}: {red.order.orderNumber}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-1">
                        {lang === 'ar' ? 'بواسطة' : 'By'}: {red.redeemedBy}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{lang === 'ar' ? 'نشاط المحفظة' : 'Wallet Activity'}</div>

          <div className="mt-3 space-y-4 text-sm">
            {walletCreditLedgerEntry && (
              <div className="rounded-lg bg-green-50 p-3 shadow-sm border border-green-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-green-900">{lang === 'ar' ? 'تم الشحن' : 'Credited'}: {formatMoney(walletCreditLedgerEntry.amount, lang)}</span>
                  <span className="text-xs text-green-700">{formatDate(walletCreditLedgerEntry.createdAt, lang)}</span>
                </div>
                <div className="text-xs text-green-800">
                  {lang === 'ar' ? 'رصيد المحفظة قبل' : 'Balance Before'}: {formatMoney(walletCreditLedgerEntry.balanceBefore, lang)}<br/>
                  {lang === 'ar' ? 'رصيد المحفظة بعد' : 'Balance After'}: {formatMoney(walletCreditLedgerEntry.balanceAfter, lang)}
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-2 font-semibold text-slate-900">
                {lang === 'ar' ? 'نشاط المحفظة بعد شحن هذه البطاقة' : 'Wallet activity after this gift card was credited'}
              </div>

              {!subsequentWalletActivity || subsequentWalletActivity.length === 0 ? (
                <div className="text-xs text-slate-500 italic">
                  {lang === 'ar' ? 'لا يوجد نشاط مسجل' : 'No activity recorded yet'}
                </div>
              ) : (
                <div className="space-y-3">
                  {subsequentWalletActivity.map((debit: any, idx: number) => (
                    <div key={idx} className="rounded-lg bg-white p-3 shadow-sm border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-red-600">-{formatMoney(debit.amount, lang)}</span>
                        <span className="text-xs text-slate-500">{formatDate(debit.createdAt, lang)}</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {lang === 'ar' ? 'النوع' : 'Type'}: {debit.referenceType}
                      </div>
                      {debit.appointment && (
                        <div className="text-xs text-slate-600 mt-1">
                          {lang === 'ar' ? 'موعد' : 'Appointment'}: {debit.appointment.bookingNumber}
                          {debit.appointment.service && ` - ${lang === 'ar' ? debit.appointment.service.name_ar : debit.appointment.service.name_en}`}
                        </div>
                      )}
                      {debit.order && (
                        <div className="text-xs text-slate-600 mt-1">
                          {lang === 'ar' ? 'طلب' : 'Order'}: {debit.order.orderNumber}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-1 flex justify-between">
                        <span>{lang === 'ar' ? 'المرجع' : 'Ref'}: {debit.id.split('-')[0]}</span>
                        <span>{lang === 'ar' ? 'الرصيد' : 'Balance'}: {formatMoney(debit.balanceAfter, lang)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{copy.backendSnapshot}</div>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(transaction.sourceTransaction || transaction, null, 2)}</pre>
      </div>
    </div>
  );
}

export default function GiftCardListReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'gift-card-list';
  const copy = useMemo(() => isRtl ? {
    allStatuses: 'جميع الحالات',
    allCustomers: 'جميع العملاء',
    allEmployees: 'جميع الموظفين',
    allLocations: 'كل المواقع',
    allCodes: 'جميع الرموز',
    giftCards: 'بطاقات الهدايا',
    originalAmount: 'القيمة الأصلية',
    redeemedAmount: 'قيمة الاسترداد',
    remainingBalance: 'الرصيد المتبقي',
    issued: 'صادرة',
    redeemed: 'مستردة',
    partiallyRedeemed: 'مستردة جزئياً',
    expired: 'منتهية الصلاحية',
    totalCards: 'إجمالي البطاقات',
    originalAmountNote: 'القيمة الأصلية',
    redeemedAmountNote: 'المبلغ المسترد',
    remainingBalanceNote: 'الرصيد المتبقي',
    issuedNote: 'بطاقات صادرة',
    redeemedNote: 'بطاقات مستردة',
    partiallyRedeemedNote: 'استرداد جزئي',
    expiredNote: 'بطاقات منتهية الصلاحية',
    tableTitle: 'جدول بطاقات الهدايا',
    tableDescription: 'صفوف سجل بطاقات الهدايا المعيارية من سجل الواجهة الخلفية للمنشأة.',
    emptyState: 'لا توجد بطاقات هدايا مطابقة للمعايير المحددة.',
    backendGapTitle: 'فجوات الواجهة الخلفية',
    backendGapDescription: 'لا تزال الحقول المفقودة أدناه غير متوفرة في الحمولة المعيارية الحالية لكل صف.',
    general: 'عام',
    purchase: 'الشراء',
    redemption: 'الاسترداد',
    customer: 'العميل',
    invoice: 'الفاتورة',
    timeline: 'الخط الزمني',
    backendSnapshot: 'لقطة الواجهة الخلفية',
    unavailable: 'غير متاح',
    sourceTransaction: 'المعاملة الأصلية',
    redemptionsCount: 'عدد عمليات الاسترداد',
    latestRedemption: 'آخر عملية استرداد',
    issuedAt: 'تم الإصدار في',
    latestRedemptionAt: 'آخر استرداد في',
    lastUpdated: 'آخر تحديث',
    backendUpdated: 'تحديث الواجهة الخلفية',
    purchasedFor: 'تم الشراء من أجل',
    redeemedFor: 'تم الاسترداد من أجل',
    giftCardCode: 'رمز بطاقة الهدايا',
    saleNumber: 'رقم البيع',
    purchasedBy: 'تم الشراء بواسطة',
    redeemedBy: 'تم الاسترداد بواسطة',
    status: 'الحالة',
    issueDate: 'تاريخ الإصدار',
    expiryDate: 'تاريخ الانتهاء',
    originalAmountField: 'القيمة الأصلية',
    redeemedAmountField: 'قيمة الاسترداد',
    remainingBalanceField: 'الرصيد المتبقي',
    paymentMethod: 'طريقة الدفع',
    location: 'الموقع',
    employee: 'الموظف',
    invoiceNumber: 'رقم الفاتورة'
  } : {
    allStatuses: 'All Statuses',
    allCustomers: 'All Customers',
    allEmployees: 'All Employees',
    allLocations: 'All Locations',
    allCodes: 'All Gift Card Codes',
    giftCards: 'Gift Cards',
    originalAmount: 'Original Amount',
    redeemedAmount: 'Redeemed Amount',
    remainingBalance: 'Remaining Balance',
    issued: 'Issued',
    redeemed: 'Redeemed',
    partiallyRedeemed: 'Partially Redeemed',
    expired: 'Expired',
    totalCards: 'Total cards',
    originalAmountNote: 'Original amount',
    redeemedAmountNote: 'Redeemed amount',
    remainingBalanceNote: 'Remaining balance',
    issuedNote: 'Issued cards',
    redeemedNote: 'Redeemed cards',
    partiallyRedeemedNote: 'Partially redeemed',
    expiredNote: 'Expired cards',
    tableTitle: 'Gift Card Table',
    tableDescription: 'Canonical gift card ledger rows from the production tenant ledger.',
    emptyState: 'No gift cards found for the selected criteria.',
    backendGapTitle: 'Backend gaps',
    backendGapDescription: 'Missing backend fields are still not exposed by the current canonical row payload.',
    general: 'General',
    purchase: 'Purchase',
    redemption: 'Redemption',
    customer: 'Customer',
    invoice: 'Invoice',
    timeline: 'Timeline',
    backendSnapshot: 'Backend Snapshot',
    unavailable: 'Unavailable',
    sourceTransaction: 'Source Transaction',
    redemptionsCount: 'Redemptions Count',
    latestRedemption: 'Latest Redemption',
    issuedAt: 'Issued At',
    latestRedemptionAt: 'Latest Redemption At',
    lastUpdated: 'Last Updated',
    backendUpdated: 'Backend Updated',
    purchasedFor: 'Purchased For',
    redeemedFor: 'Redeemed For',
    giftCardCode: 'Gift Card Code',
    saleNumber: 'Sale Number',
    purchasedBy: 'Purchased By',
    redeemedBy: 'Redeemed By',
    status: 'Status',
    issueDate: 'Issue Date',
    expiryDate: 'Expiry Date',
    originalAmountField: 'Original Amount',
    redeemedAmountField: 'Redeemed Amount',
    remainingBalanceField: 'Remaining Balance',
    paymentMethod: 'Payment Method',
    location: 'Location',
    employee: 'Employee',
    invoiceNumber: 'Invoice Number'
  }, [isRtl]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GiftCardListPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'issueDate', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    status: '',
    customer: '',
    employee: '',
    location: '',
    giftCardCode: '',
  });
  const [drawerRow, setDrawerRow] = useState<GiftCardListTableRow | null>(null);

  useBIReportRefreshSignal(() => setRefreshTick((tick) => tick + 1));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
        try {
          const range = resolveBIDateRange(datePreset, customDateRange);
          const query = new URLSearchParams({
            startDate: range.from,
            endDate: range.to,
            limit: '1000',
            search,
            ...filterValues,
          }).toString();
          const response = await tenantApiAdapter.get(`/tenant/gift-cards/reports/transactions${query ? `?${query}` : ''}`);
        const payload = (response?.data || response || {}) as GiftCardListPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load gift card list report.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [customDateRange, datePreset, filterValues, refreshTick, search]);

  const rows = useMemo(() => buildGiftCardRows(report, lang), [lang, report]);

  const definitionOptions = useMemo(() => {
    const statuses = dedupeOptions([
      { label: copy.allStatuses, value: '' },
      ...uniqueValues(rows, (row) => row.status).map((option) => ({ label: humanizeStatus(option.value, lang), value: option.value })),
    ]);
    const customers = dedupeOptions([
      { label: copy.allCustomers, value: '' },
      ...uniqueValues(rows, (row) => row.customer),
    ]);
    const employees = dedupeOptions([
      { label: copy.allEmployees, value: '' },
      ...uniqueValues(rows, (row) => row.employee),
    ]);
    const locations = dedupeOptions([
      { label: copy.allLocations, value: '' },
      ...uniqueValues(rows, (row) => row.location),
    ]);
    const giftCardCodes = dedupeOptions([
      { label: copy.allCodes, value: '' },
      ...uniqueValues(rows, (row) => row.giftCardCode),
    ]);

    const options: GiftCardListReportOptions = {
      statuses,
      customers,
      employees,
      locations,
      giftCardCodes,
    };

    return options;
  }, [copy.allCodes, copy.allCustomers, copy.allEmployees, copy.allLocations, copy.allStatuses, lang, rows]);

  const reportDefinition = useMemo(
    () => createGiftCardListReportDefinition(definitionOptions, lang),
    [definitionOptions, lang]
  );
  useEffect(() => {
    setPageSize(reportDefinition.defaultPageSize || 10);
  }, [reportDefinition.defaultPageSize]);

  const columns = reportDefinition.columns || [];

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedStatus = normalizeText(filterValues.status);
    const selectedCustomer = normalizeText(filterValues.customer);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedLocation = normalizeText(filterValues.location);
    const selectedGiftCardCode = normalizeText(filterValues.giftCardCode);

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.giftCardCode,
          row.saleNumber,
          row.purchasedBy,
          row.redeemedBy,
          row.customer,
          row.status,
          row.invoiceNumber,
          row.location,
          row.employee,
          row.paymentMethod,
          row.issueDate,
          row.expiryDate,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedStatus && normalizeText(row.status) !== selectedStatus) return false;
      if (selectedCustomer && normalizeText(row.customer) !== selectedCustomer) return false;
      if (selectedEmployee && normalizeText(row.employee) !== selectedEmployee) return false;
      if (selectedLocation && normalizeText(row.location) !== selectedLocation) return false;
      if (selectedGiftCardCode && normalizeText(row.giftCardCode) !== selectedGiftCardCode) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const summary = report.giftCardSummary || {};
  const kpiItems = [
    { id: 'gift-cards', label: copy.giftCards, value: Number(summary.totalGiftCards ?? rows.length ?? 0).toLocaleString(), note: copy.totalCards, icon: <Gift size={18} /> },
    { id: 'original-amount', label: copy.originalAmount, value: formatMoney(summary.totalOriginalAmount, lang), note: copy.originalAmountNote, icon: <CreditCard size={18} /> },
    { id: 'redeemed-amount', label: copy.redeemedAmount, value: formatMoney(summary.totalRedeemedAmount, lang), note: copy.redeemedAmountNote, icon: <RefreshCw size={18} /> },
    { id: 'remaining-balance', label: copy.remainingBalance, value: formatMoney(summary.totalRemainingBalance, lang), note: copy.remainingBalanceNote, icon: <Wallet size={18} /> },
    { id: 'issued', label: copy.issued, value: Number(summary.issuedCount ?? rows.filter((row) => normalizeText(row.status).includes('issued') || normalizeText(row.status).includes('purchased')).length ?? 0).toLocaleString(), note: copy.issuedNote, icon: <Sparkles size={18} /> },
    { id: 'redeemed', label: copy.redeemed, value: Number(summary.redeemedCount ?? rows.filter((row) => normalizeText(row.status).includes('redeemed')).length ?? 0).toLocaleString(), note: copy.redeemedNote, icon: <Users size={18} /> },
    { id: 'partial', label: copy.partiallyRedeemed, value: Number(summary.partiallyRedeemedCount ?? rows.filter((row) => normalizeText(row.status).includes('partially')).length ?? 0).toLocaleString(), note: copy.partiallyRedeemedNote, icon: <Clock size={18} /> },
    { id: 'expired', label: copy.expired, value: Number(summary.expiredCount ?? rows.filter((row) => normalizeText(row.status).includes('expired')).length ?? 0).toLocaleString(), note: copy.expiredNote, icon: <AlertTriangle size={18} /> },
  ];

  const backendGaps = useMemo(() => buildGiftCardBackendGaps(rows), [rows]);

  const tableColumns = useMemo(() => columns.map((column) => {
    if (['originalAmount', 'redeemedAmount', 'remainingBalance'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (['issueDate', 'expiryDate'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatDate(value, lang) };
    }
    return column;
  }), [columns, lang]);

  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, tableColumns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(String(reportDefinition.title), 'csv'), serializeRowsToCsv(filteredRows, visibleColumns));
      return;
    }
    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(String(reportDefinition.title), 'excel'),
        serializeRowsToCsv(filteredRows, visibleColumns),
        'application/vnd.ms-excel;charset=utf-8'
      );
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml({
      title: String(reportDefinition.title),
      description: String(reportDefinition.description || ''),
      rows: filteredRows,
      columns: visibleColumns,
      lang,
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      if (format !== 'print') {
        setTimeout(() => printWindow.close(), 250);
      }
    };
  };

  return (
    <BIReportShell
      title={reportDefinition.title}
      description={reportDefinition.description}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar
            reportTitle={String(reportDefinition.title)}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={() => setRefreshTick((tick) => tick + 1)}
            rows={filteredRows}
            columns={tableColumns}
            onExport={handleExport}
            onPrint={() => handleExport('print')}
            availableExports={['csv', 'excel', 'pdf', 'print']}
            datePreset={datePreset}
            onDatePresetChange={(preset) => {
              setDatePreset(preset);
              setPage(1);
            }}
            customDateRange={customDateRange}
            onCustomDateRangeChange={(next) => {
              setCustomDateRange(next);
              setPage(1);
            }}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            savedViews={savedViews}
            onSaveView={(name) => saveView(name, { search, datePreset, customDateRange, filters: filterValues, page, pageSize, sort })}
            onLoadSavedView={(view) => {
              setSearch(view.query.search);
              setDatePreset(view.query.datePreset);
              setCustomDateRange(view.query.customDateRange);
              setFilterValues(view.query.filters);
              setPage(view.query.page);
              setSort(view.query.sort);
            }}
            onDeleteSavedView={deleteView}
            columnState={columnState}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
            summary={
              <BIActiveFilterSummary
                filters={reportDefinition.filters || []}
                values={filterValues}
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                datePreset={datePreset}
                onDatePresetChange={(preset) => {
                  setDatePreset(preset);
                  setPage(1);
                }}
                customDateRange={customDateRange}
                onCustomDateRangeChange={(next) => {
                  setCustomDateRange(next);
                  setPage(1);
                }}
                onFilterValuesChange={(next) => {
                  setFilterValues(next);
                  setPage(1);
                }}
              />
            }
          />

          <BIReportFilters
            open={filtersOpen}
            filters={reportDefinition.filters || []}
            values={filterValues}
            onApply={(next) => {
              setFilterValues(next);
              setPage(1);
            }}
            onReset={() => {
              setFilterValues({
                status: '',
                customer: '',
                employee: '',
                location: '',
                giftCardCode: '',
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      table={
        <SectionBlock title={copy.tableTitle} description={copy.tableDescription} icon={<Gift size={18} />}>
          <BIDataTable<GiftCardListTableRow>
            rows={paginatedRows}
            columns={visibleColumns}
            rowKey={(row) => row.id}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onRowClick={(row) => setDrawerRow(row)}
            emptyState={error ? error : copy.emptyState}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                {copy.backendGapTitle}
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.map((gap) => ({
                  'Invoice Number': lang === 'ar' ? 'رقم الفاتورة' : 'Invoice Number',
                  'Original Amount': lang === 'ar' ? 'القيمة الأصلية' : 'Original Amount',
                  'Redeemed Amount': lang === 'ar' ? 'قيمة الاسترداد' : 'Redeemed Amount',
                  'Remaining Balance': lang === 'ar' ? 'الرصيد المتبقي' : 'Remaining Balance',
                }[gap] || gap)).join(', ')} {copy.backendGapDescription}
              </p>
            </div>
          ) : null}
        </SectionBlock>
      }
      pagination={
        <BIPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
          totalItems={filteredRows.length}
        />
      }
      footer={reportDefinition.footer}
    >
      <BIDetailsDrawer<GiftCardListTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.giftCardCode || String(reportDefinition.title)}
        subtitle={drawerRow?.customer || undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <GiftCardActivityViewer rowId={row.saleNumber} lang={lang} copy={copy} />
        )}
      />
    </BIReportShell>
  );
}
