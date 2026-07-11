import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';
import type { SalesOverviewRow } from './salesOverviewViewModel';

export interface SalesListTableRow extends SalesOverviewRow {
  appointmentReference: string;
  location: string;
  amountPaid: number | null;
  remainingBalance: number | null;
  itemsSold: string;
}

export interface SalesListReportOptions {
  customers: BIOption[];
  employees: BIOption[];
  paymentMethods: BIOption[];
  saleStatuses: BIOption[];
  paymentStatuses: BIOption[];
  locations: BIOption[];
  channels: BIOption[];
}

export function createSalesListReportDefinition(
  options: SalesListReportOptions
): BIReportDefinition<SalesListTableRow> {
  return defineBIReport<SalesListTableRow>({
    id: 'sales-list',
    title: 'Sales List',
    description: 'Canonical sales ledger rows built from the production financial ledger.',
    endpoint: '/tenant/bi/sales-overview',
    businessRules: [
      'Backend values only.',
      'Missing backend fields must be shown as Unavailable.',
      'No financial values are recalculated in the frontend.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search sale number, customer, appointment reference, invoice number, employee, payment method, or items sold.' },
      { id: 'customer', label: 'Customer', type: 'customer', options: options.customers },
      { id: 'employee', label: 'Employee', type: 'employee', options: options.employees },
      { id: 'paymentMethod', label: 'Payment Method', type: 'payment-method', options: options.paymentMethods },
      { id: 'saleStatus', label: 'Sale Status', type: 'status', options: options.saleStatuses },
      { id: 'paymentStatus', label: 'Payment Status', type: 'status', options: options.paymentStatuses },
      { id: 'location', label: 'Location', type: 'location', options: options.locations },
      { id: 'channel', label: 'Channel', type: 'dropdown', options: options.channels },
      { id: 'grossSalesRange', label: 'Gross Sales Range', type: 'amount-range', minPlaceholder: 'Min gross sales', maxPlaceholder: 'Max gross sales' }
    ],
    columns: [
      { id: 'saleNumber', header: 'Sale Number', accessor: 'saleNumber', sortable: true, width: '11rem' },
      { id: 'saleDate', header: 'Sale Date', accessor: 'saleDate', sortable: true, width: '12rem' },
      { id: 'appointmentReference', header: 'Appointment Reference', accessor: 'appointmentReference', sortable: true, width: '14rem' },
      { id: 'invoiceNumber', header: 'Invoice Number', accessor: 'invoiceNumber', sortable: true, width: '11rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'employee', header: 'Employee', accessor: 'employee', sortable: true, width: '11rem' },
      { id: 'location', header: 'Location', accessor: 'location', sortable: true, width: '11rem' },
      { id: 'channel', header: 'Channel', accessor: 'channel', sortable: true, width: '9rem' },
      { id: 'paymentStatus', header: 'Payment Status', accessor: 'paymentStatus', sortable: true, width: '11rem' },
      { id: 'paymentMethod', header: 'Payment Method', accessor: 'paymentMethod', sortable: true, width: '11rem' },
      { id: 'itemsSold', header: 'Items Sold', accessor: 'itemsSold', sortable: true, width: '14rem' },
      { id: 'grossSales', header: 'Gross Sales', accessor: 'grossSales', sortable: true, align: 'right', width: '10rem' },
      { id: 'discount', header: 'Discount', accessor: 'discount', sortable: true, align: 'right', width: '9rem' },
      { id: 'vat', header: 'VAT', accessor: 'vat', sortable: true, align: 'right', width: '8rem' },
      { id: 'netSales', header: 'Net Sales', accessor: 'netSales', sortable: true, align: 'right', width: '10rem' },
      { id: 'amountPaid', header: 'Amount Paid', accessor: 'amountPaid', sortable: true, align: 'right', width: '10rem' },
      { id: 'remainingBalance', header: 'Remaining Balance', accessor: 'remainingBalance', sortable: true, align: 'right', width: '10rem' },
      { id: 'saleStatus', header: 'Sale Status', accessor: 'saleStatus', sortable: true, width: '10rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'saleDate',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: 'Sales List is powered by the canonical BI sales-overview endpoint.'
  });
}
