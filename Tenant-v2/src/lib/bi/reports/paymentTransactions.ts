import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface PaymentTransactionsTableRow {
  id: string;
  paymentDate: string;
  paymentNumber: string;
  saleNumber: string;
  appointmentReference: string;
  customer: string;
  teamMember: string;
  location: string;
  paymentMethod: string;
  transactionType: string;
  status: string;
  paymentAmount: number | null;
  invoiceNumber: string;
  notes: string;
  detailPath?: string | null;
  sourcePaymentRow?: any;
  sourceRevenueRow?: any;
}

export interface PaymentTransactionsReportOptions {
  customers: BIOption[];
  employees: BIOption[];
  locations: BIOption[];
  paymentMethods: BIOption[];
  transactionTypes: BIOption[];
  statuses: BIOption[];
}

export function createPaymentTransactionsReportDefinition(
  options: PaymentTransactionsReportOptions
): BIReportDefinition<PaymentTransactionsTableRow> {
  return defineBIReport<PaymentTransactionsTableRow>({
    id: 'payment-transactions',
    title: 'Payment Transactions',
    description: 'Canonical financial ledger of every payment received by the business.',
    endpoint: '/tenant/financial/ledger',
    businessRules: [
      'Backend values only.',
      'No payment totals are recalculated in the frontend.',
      'Missing backend values must remain visibly marked as unavailable.',
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search payment number, sale number, customer, appointment reference, team member, invoice number, method, or notes.' },
      { id: 'customer', label: 'Customer', type: 'customer', options: options.customers },
      { id: 'employee', label: 'Team Member', type: 'employee', options: options.employees },
      { id: 'location', label: 'Location', type: 'location', options: options.locations },
      { id: 'paymentMethod', label: 'Payment Method', type: 'payment-method', options: options.paymentMethods },
      { id: 'transactionType', label: 'Transaction Type', type: 'dropdown', options: options.transactionTypes },
      { id: 'status', label: 'Status', type: 'status', options: options.statuses },
      { id: 'amountRange', label: 'Amount Range', type: 'amount-range', minPlaceholder: 'Min amount', maxPlaceholder: 'Max amount' },
    ],
    columns: [
      { id: 'paymentDate', header: 'Payment Date', accessor: 'paymentDate', sortable: true, width: '12rem' },
      { id: 'paymentNumber', header: 'Payment Number', accessor: 'paymentNumber', sortable: true, width: '12rem' },
      { id: 'saleNumber', header: 'Sale Number', accessor: 'saleNumber', sortable: true, width: '12rem' },
      { id: 'appointmentReference', header: 'Appointment Reference', accessor: 'appointmentReference', sortable: true, width: '14rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'teamMember', header: 'Team Member', accessor: 'teamMember', sortable: true, width: '12rem' },
      { id: 'location', header: 'Location', accessor: 'location', sortable: true, width: '11rem' },
      { id: 'paymentMethod', header: 'Payment Method', accessor: 'paymentMethod', sortable: true, width: '11rem' },
      { id: 'transactionType', header: 'Transaction Type', accessor: 'transactionType', sortable: true, width: '11rem' },
      { id: 'status', header: 'Status', accessor: 'status', sortable: true, width: '11rem' },
      { id: 'paymentAmount', header: 'Payment Amount', accessor: 'paymentAmount', sortable: true, align: 'right', width: '10rem' },
      { id: 'invoiceNumber', header: 'Invoice Number', accessor: 'invoiceNumber', sortable: true, width: '11rem' },
      { id: 'notes', header: 'Notes', accessor: 'notes', sortable: true, width: '14rem' },
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true },
    },
    defaultSort: {
      columnId: 'paymentDate',
      direction: 'desc',
    },
    defaultPageSize: 10,
    footer: 'Payment Transactions is powered by the canonical finance ledger and exposes backend gaps explicitly.',
  });
}
