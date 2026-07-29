import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface SalesOverviewTableRow {
  id: string;
  saleNumber: string;
  invoiceNumber: string;
  saleDate: string;
  customer: string;
  employee: string;
  channel: string;
  items: string;
  grossSales: number | null;
  discount: number | null;
  vat: number | null;
  refund: number | null;
  refundAmount?: number | null;
  netSales: number | null;
  paymentMethod: string;
  status: string;
  detailPath?: string | null;
  notes?: string | null;
  itemsSold?: string;
  category?: string;
  amountPaid?: number | null;
  remainingBalance?: number | null;
  service?: string;
  entityType?: string;
  sourceRow?: any;
}

export interface SalesOverviewReportOptions {
  employees: BIOption[];
  services: BIOption[];
  paymentMethods: BIOption[];
  categories: BIOption[];
  statuses: BIOption[];
}

export function createSalesOverviewReportDefinition(
  options: SalesOverviewReportOptions
): BIReportDefinition<SalesOverviewTableRow> {
  return defineBIReport<SalesOverviewTableRow>({
    id: 'sales-overview',
    title: 'Sales Overview',
    description: 'Canonical business overview for revenue, sales, payments, and customer performance.',
    endpoint: '/tenant/bi/sales-overview',
    businessRules: [
      'Backend values only.',
      'No accounting formula is calculated in the frontend.',
      'Missing backend values must remain visibly marked as unavailable.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search sale number, customer, employee, payment method, or item.' },
      { id: 'employee', label: 'Employee', type: 'employee', options: options.employees },
      { id: 'service', label: 'Service', type: 'dropdown', options: options.services },
      { id: 'paymentMethod', label: 'Payment Method', type: 'payment-method', options: options.paymentMethods },
      { id: 'category', label: 'Category', type: 'category', options: options.categories },
      { id: 'status', label: 'Status', type: 'status', options: options.statuses },
      { id: 'refundOnly', label: 'Refunds Only', type: 'boolean', trueLabel: 'Only refunds', falseLabel: 'All sales' },
      { id: 'grossSalesRange', label: 'Gross Sales Range', type: 'amount-range', minPlaceholder: 'Min gross sales', maxPlaceholder: 'Max gross sales' }
    ],
    columns: [
      { id: 'saleNumber', header: 'Sale Number', accessor: 'saleNumber', sortable: true, width: '11rem' },
      { id: 'invoiceNumber', header: 'Invoice Number', accessor: 'invoiceNumber', sortable: true, width: '11rem' },
      { id: 'saleDate', header: 'Sale Date', accessor: 'saleDate', sortable: true, width: '12rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'employee', header: 'Employee', accessor: 'employee', sortable: true, width: '11rem' },
      { id: 'channel', header: 'Channel', accessor: 'channel', sortable: true, width: '9rem' },
      { id: 'items', header: 'Items', accessor: 'items', sortable: true, width: '14rem' },
      { id: 'grossSales', header: 'Gross Sales', accessor: 'grossSales', sortable: true, align: 'right', width: '10rem' },
      { id: 'discount', header: 'Discount', accessor: 'discount', sortable: true, align: 'right', width: '9rem' },
      { id: 'vat', header: 'VAT', accessor: 'vat', sortable: true, align: 'right', width: '8rem' },
      { id: 'refund', header: 'Refund', accessor: 'refund', sortable: true, align: 'right', width: '9rem' },
      { id: 'netSales', header: 'Net Sales', accessor: 'netSales', sortable: true, align: 'right', width: '10rem' },
      { id: 'paymentMethod', header: 'Payment Method', accessor: 'paymentMethod', sortable: true, width: '11rem' },
      { id: 'status', header: 'Status', accessor: 'status', sortable: true, width: '10rem' }
    ],
    kpis: [],
    charts: [],
    drawer: {
      render: () => null
    },
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'saleDate',
      direction: 'desc'
    },
    defaultPageSize: 8,
    footer: 'Sales Overview is powered by the canonical BI endpoint.'
  });
}
