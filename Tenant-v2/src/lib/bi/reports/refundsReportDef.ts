import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface RefundsTableRow {
  id: string;
  date: string;
  customer: string;
  reference: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  reason: string;
  employee: string;
  refundMode: string;
  status: string;
  amount: number | null;
  sourceRow?: any;
}

export interface RefundsReportOptions {
  paymentMethods: BIOption[];
  refundModes: BIOption[];
}

export function createRefundsReportDefinition(
  options: RefundsReportOptions
): BIReportDefinition<RefundsTableRow> {
  return defineBIReport<RefundsTableRow>({
    id: 'refunds-report',
    title: 'Refunds',
    description: 'Detailed report of all processed refunds.',
    endpoint: '/tenant/reports/refunds',
    businessRules: [
      'Refunds are recorded as negative financial impact in revenue.',
      'Only completed or processing refunds are shown.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search customer, reference, reason, or employee.' },
      { id: 'paymentMethod', label: 'Payment Method', type: 'payment-method', options: options.paymentMethods },
      { id: 'refundMode', label: 'Refund Mode', type: 'dropdown', options: options.refundModes }
    ],
    columns: [
      { id: 'date', header: 'Date', accessor: 'date', sortable: true, width: '12rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'reference', header: 'Reference', accessor: 'reference', sortable: true, width: '12rem' },
      { id: 'paymentMethodLabel', header: 'Payment Method', accessor: 'paymentMethodLabel', sortable: true, width: '12rem' },
      { id: 'employee', header: 'Operator', accessor: 'employee', sortable: true, width: '11rem' },
      { id: 'refundMode', header: 'Refund Mode', accessor: 'refundMode', sortable: true, width: '10rem' },
      { id: 'status', header: 'Status', accessor: 'status', sortable: true, width: '9rem' },
      { id: 'reason', header: 'Reason', accessor: 'reason', sortable: true, width: '14rem' },
      { id: 'amount', header: 'Refund Amount', accessor: 'amount', sortable: true, align: 'right', width: '10rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'date',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: 'Refunds Report is powered by the canonical financial ledger.'
  });
}
