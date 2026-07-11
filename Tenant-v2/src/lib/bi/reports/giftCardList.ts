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
  options: GiftCardListReportOptions
): BIReportDefinition<GiftCardListTableRow> {
  return defineBIReport<GiftCardListTableRow>({
    id: 'gift-card-list',
    title: 'Gift Card List',
    description: 'Canonical visibility into issued and redeemed gift cards built from the tenant gift-card ledger.',
    endpoint: '/tenant/gift-cards/reports/transactions',
    businessRules: [
      'Backend values only.',
      'Original amount, redeemed amount, and remaining balance are taken from canonical backend rows.',
      'Missing backend values remain visibly marked as unavailable.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search code, sale number, customer, purchaser, redeemer, or invoice.' },
      { id: 'status', label: 'Status', type: 'status', options: options.statuses },
      { id: 'customer', label: 'Customer', type: 'customer', options: options.customers },
      { id: 'employee', label: 'Employee', type: 'employee', options: options.employees },
      { id: 'location', label: 'Location', type: 'location', options: options.locations },
      { id: 'giftCardCode', label: 'Gift Card Code', type: 'dropdown', options: options.giftCardCodes }
    ],
    columns: [
      { id: 'giftCardCode', header: 'Gift Card Code', accessor: 'giftCardCode', sortable: true, width: '11rem' },
      { id: 'saleNumber', header: 'Sale Number', accessor: 'saleNumber', sortable: true, width: '10rem' },
      { id: 'purchasedBy', header: 'Purchased By', accessor: 'purchasedBy', sortable: true, width: '12rem' },
      { id: 'redeemedBy', header: 'Redeemed By', accessor: 'redeemedBy', sortable: true, width: '12rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'status', header: 'Status', accessor: 'status', sortable: true, width: '10rem' },
      { id: 'issueDate', header: 'Issue Date', accessor: 'issueDate', sortable: true, width: '12rem' },
      { id: 'expiryDate', header: 'Expiry Date', accessor: 'expiryDate', sortable: true, width: '12rem' },
      { id: 'originalAmount', header: 'Original Amount', accessor: 'originalAmount', sortable: true, align: 'right', width: '11rem' },
      { id: 'redeemedAmount', header: 'Redeemed Amount', accessor: 'redeemedAmount', sortable: true, align: 'right', width: '11rem' },
      { id: 'remainingBalance', header: 'Remaining Balance', accessor: 'remainingBalance', sortable: true, align: 'right', width: '11rem' },
      { id: 'invoiceNumber', header: 'Invoice Number', accessor: 'invoiceNumber', sortable: true, width: '11rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'issueDate',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: 'Gift Card List is powered by the tenant gift-card transaction ledger and exposes backend gaps explicitly.'
  });
}
