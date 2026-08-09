import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface GiftCardListTableRow {
  id: string;
  giftCardCode: string;
  saleNumber: string;
  purchasedBy: string;
  redeemedBy: string;
  customer: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  originalAmount: number | null;
  redeemedAmount: number | null;
  remainingBalance: number | null;
  invoiceNumber: string;
  location: string;
  employee: string;
  paymentMethod: string;
  sourceTransaction?: any;
  redemptions?: any[];
  latestRedemption?: any;
}

export interface GiftCardListReportOptions {
  statuses: BIOption[];
  customers: BIOption[];
  employees: BIOption[];
  locations: BIOption[];
  giftCardCodes: BIOption[];
}

export function createGiftCardListReportDefinition(
  options: GiftCardListReportOptions,
  lang: 'ar' | 'en' = 'en'
): BIReportDefinition<GiftCardListTableRow> {
  const isRtl = lang === 'ar';
  const copy = isRtl ? {
    title: 'قائمة بطاقات الهدايا',
    description: 'رؤية معيارية لبطاقات الهدايا الصادرة والمستردة مبنية من سجل بطاقات الهدايا الخاص بالمنشأة.',
    businessRules: [
      'قِيَم الواجهة الخلفية فقط.',
      'تُؤخذ القيمة الأصلية وقيمة الاسترداد والرصيد المتبقي من صفوف الواجهة الخلفية المعيارية.',
      'القيم غير المتوفرة تظهر بوضوح على أنها غير متاحة.'
    ],
    filters: {
      search: 'بحث',
      searchHelper: 'ابحث في الرمز أو رقم البيع أو العميل أو المُشتري أو المسترد أو الفاتورة.',
      status: 'الحالة',
      customer: 'العميل',
      employee: 'الموظف',
      location: 'الموقع',
      giftCardCode: 'رمز بطاقة الهدايا'
    },
    columns: {
      giftCardCode: 'رمز بطاقة الهدايا',
      saleNumber: 'رقم البيع',
      purchasedBy: 'تم الشراء بواسطة',
      redeemedBy: 'تم الاسترداد بواسطة',
      customer: 'العميل',
      status: 'الحالة',
      issueDate: 'تاريخ الإصدار',
      expiryDate: 'تاريخ الانتهاء',
      originalAmount: 'القيمة الأصلية',
      redeemedAmount: 'قيمة الاسترداد',
      remainingBalance: 'الرصيد المتبقي',
      invoiceNumber: 'رقم الفاتورة'
    },
    footer: 'تعرض قائمة بطاقات الهدايا صفوف سجل بطاقات الهدايا وتوضح أي فجوات في بيانات الواجهة الخلفية بشكل صريح.'
  } : {
    title: 'Gift Card List',
    description: 'Canonical visibility into issued and redeemed gift cards built from the tenant gift-card ledger.',
    businessRules: [
      'Backend values only.',
      'Original amount, redeemed amount, and remaining balance are taken from canonical backend rows.',
      'Missing backend values remain visibly marked as unavailable.'
    ],
    filters: {
      search: 'Search',
      searchHelper: 'Search code, sale number, customer, purchaser, redeemer, or invoice.',
      status: 'Status',
      customer: 'Customer',
      employee: 'Employee',
      location: 'Location',
      giftCardCode: 'Gift Card Code'
    },
    columns: {
      giftCardCode: 'Gift Card Code',
      saleNumber: 'Sale Number',
      purchasedBy: 'Purchased By',
      redeemedBy: 'Redeemed By',
      customer: 'Customer',
      status: 'Status',
      issueDate: 'Issue Date',
      expiryDate: 'Expiry Date',
      originalAmount: 'Original Amount',
      redeemedAmount: 'Redeemed Amount',
      remainingBalance: 'Remaining Balance',
      invoiceNumber: 'Invoice Number'
    },
    footer: 'Gift Card List is powered by the tenant gift-card transaction ledger and exposes backend gaps explicitly.'
  };

  return defineBIReport<GiftCardListTableRow>({
    id: 'gift-card-list',
    title: copy.title,
    description: copy.description,
    endpoint: '/tenant/gift-cards/reports/transactions',
    businessRules: copy.businessRules,
    filters: [
      { id: 'search', label: copy.filters.search, type: 'search', helperText: copy.filters.searchHelper },
      { id: 'status', label: copy.filters.status, type: 'status', options: options.statuses },
      { id: 'customer', label: copy.filters.customer, type: 'customer', options: options.customers },
      { id: 'employee', label: copy.filters.employee, type: 'employee', options: options.employees },
      { id: 'location', label: copy.filters.location, type: 'location', options: options.locations },
      { id: 'giftCardCode', label: copy.filters.giftCardCode, type: 'dropdown', options: options.giftCardCodes }
    ],
    columns: [
      { id: 'giftCardCode', header: copy.columns.giftCardCode, accessor: 'giftCardCode', sortable: true, width: '11rem' },
      { id: 'saleNumber', header: copy.columns.saleNumber, accessor: 'saleNumber', sortable: true, width: '10rem' },
      { id: 'purchasedBy', header: copy.columns.purchasedBy, accessor: 'purchasedBy', sortable: true, width: '12rem' },
      { id: 'redeemedBy', header: copy.columns.redeemedBy, accessor: 'redeemedBy', sortable: true, width: '12rem' },
      { id: 'customer', header: copy.columns.customer, accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'status', header: copy.columns.status, accessor: 'status', sortable: true, width: '10rem' },
      { id: 'issueDate', header: copy.columns.issueDate, accessor: 'issueDate', sortable: true, width: '12rem' },
      { id: 'expiryDate', header: copy.columns.expiryDate, accessor: 'expiryDate', sortable: true, width: '12rem' },
      { id: 'originalAmount', header: copy.columns.originalAmount, accessor: 'originalAmount', sortable: true, align: 'right', width: '11rem' },
      { id: 'redeemedAmount', header: copy.columns.redeemedAmount, accessor: 'redeemedAmount', sortable: true, align: 'right', width: '11rem' },
      { id: 'remainingBalance', header: copy.columns.remainingBalance, accessor: 'remainingBalance', sortable: true, align: 'right', width: '11rem' },
      { id: 'invoiceNumber', header: copy.columns.invoiceNumber, accessor: 'invoiceNumber', sortable: true, width: '11rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'issueDate',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: copy.footer
  });
}
