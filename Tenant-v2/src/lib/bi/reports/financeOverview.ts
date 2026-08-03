import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface FinanceOverviewTableRow {
  id: string;
  transactionId: string;
  date: string;
  reference: string;
  customer: string;
  employee: string;
  service: string;
  paymentMethod: string;
  revenue: number | null;
  tax: number | null;
  discount: number | null;
  status: string;
  source: string;
  entityType: string;
  entityId: string | null;
  detailPath?: string | null;
  notes?: string | null;
}

export interface FinanceOverviewReportOptions {
  paymentMethods: BIOption[];
  statuses: BIOption[];
  paymentStatuses?: BIOption[];
  orderStatuses?: BIOption[];
  sources: BIOption[];
  employees: BIOption[];
}

export function createFinanceOverviewReportDefinition(
  options: FinanceOverviewReportOptions
): BIReportDefinition<FinanceOverviewTableRow> {
  return defineBIReport<FinanceOverviewTableRow>({
    id: 'finance-overview',
    title: 'Finance Overview',
    description: 'Canonical finance overview for revenue, collections, refunds, taxes, and cash flow.',
    endpoint: '/tenant/financial/overview',
    businessRules: [
      'Backend values only.',
      'No accounting formula is calculated in the frontend.',
      'Missing backend values must remain visibly marked as unavailable.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search transaction, reference, customer, employee, method, or source.' },
      { id: 'employee', label: 'Employee', type: 'employee', options: options.employees },
      { id: 'paymentMethod', label: 'Payment Method', type: 'payment-method', options: options.paymentMethods },
      { id: 'paymentStatus', label: 'Payment Status', type: 'status', options: options.paymentStatuses || options.statuses },
      { id: 'orderStatus', label: 'Order Status', type: 'dropdown', options: options.orderStatuses || [] },
      { id: 'source', label: 'Source', type: 'dropdown', options: options.sources },
      { id: 'refundsOnly', label: 'Refunds Only', type: 'boolean', trueLabel: 'Only refunds', falseLabel: 'All transactions' },
      { id: 'amountRange', label: 'Amount Range', type: 'amount-range', minPlaceholder: 'Min amount', maxPlaceholder: 'Max amount' }
    ],
    columns: [
      { id: 'transactionId', header: 'Transaction ID', accessor: 'transactionId', sortable: true, width: '11rem' },
      { id: 'date', header: 'Date', accessor: 'date', sortable: true, width: '12rem' },
      { id: 'reference', header: 'Reference', accessor: 'reference', sortable: true, width: '11rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'employee', header: 'Employee', accessor: 'employee', sortable: true, width: '11rem' },
      { id: 'service', header: 'Service / Order', accessor: 'service', sortable: true, width: '14rem' },
      { id: 'paymentMethod', header: 'Payment Method', accessor: 'paymentMethod', sortable: true, width: '11rem' },
      { id: 'revenue', header: 'Revenue', accessor: 'revenue', sortable: true, align: 'right', width: '10rem' },
      { id: 'tax', header: 'Tax', accessor: 'tax', sortable: true, align: 'right', width: '9rem' },
      { id: 'discount', header: 'Discount', accessor: 'discount', sortable: true, align: 'right', width: '9rem' },
      { id: 'status', header: 'Status', accessor: 'status', sortable: true, width: '9rem' },
      { id: 'source', header: 'Source', accessor: 'source', sortable: true, width: '9rem' }
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
      columnId: 'date',
      direction: 'desc'
    },
    defaultPageSize: 8,
    footer: 'Finance Overview is powered by the canonical finance endpoints.'
  });
}
