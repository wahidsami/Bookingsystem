import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface CashFlowSummaryTableRow {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number | null;
  cashIn: number | null;
  cashOut: number | null;
  netMovement: number | null;
  closingBalance: number | null;
  cashPayments: number | null;
  cardPayments: number | null;
  onlinePayments: number | null;
  walletPayments: number | null;
  bankTransferPayments: number | null;
  transactionCount: number;
  sourceRows?: any[];
}

export interface CashFlowSummaryReportOptions {
  paymentMethods: BIOption[];
  locations: BIOption[];
  groupings: BIOption[];
}

export function createCashFlowSummaryReportDefinition(
  options: CashFlowSummaryReportOptions
): BIReportDefinition<CashFlowSummaryTableRow> {
  return defineBIReport<CashFlowSummaryTableRow>({
    id: 'cash-flow-summary',
    title: 'Cash Flow Summary',
    description: 'Canonical financial movement summary for cash flow visibility.',
    endpoint: '/tenant/financial/ledger',
    businessRules: [
      'Backend values only.',
      'No balances are recalculated in the frontend.',
      'Opening and closing balances must remain unavailable unless the backend exposes them.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search period, location, payment method, or notes.' },
      { id: 'grouping', label: 'Grouping', type: 'dropdown', options: options.groupings },
      { id: 'paymentMethod', label: 'Payment Method', type: 'payment-method', options: options.paymentMethods },
      { id: 'location', label: 'Location', type: 'location', options: options.locations }
    ],
    columns: [
      { id: 'period', header: 'Period (Day / Week / Month)', accessor: 'period', sortable: true, width: '14rem' },
      { id: 'openingBalance', header: 'Opening Balance', accessor: 'openingBalance', sortable: true, align: 'right', width: '10rem' },
      { id: 'cashIn', header: 'Cash In', accessor: 'cashIn', sortable: true, align: 'right', width: '9rem' },
      { id: 'cashOut', header: 'Cash Out', accessor: 'cashOut', sortable: true, align: 'right', width: '9rem' },
      { id: 'netMovement', header: 'Net Movement', accessor: 'netMovement', sortable: true, align: 'right', width: '10rem' },
      { id: 'closingBalance', header: 'Closing Balance', accessor: 'closingBalance', sortable: true, align: 'right', width: '10rem' },
      { id: 'cashPayments', header: 'Cash Payments', accessor: 'cashPayments', sortable: true, align: 'right', width: '10rem' },
      { id: 'cardPayments', header: 'Card Payments', accessor: 'cardPayments', sortable: true, align: 'right', width: '10rem' },
      { id: 'onlinePayments', header: 'Online Payments', accessor: 'onlinePayments', sortable: true, align: 'right', width: '10rem' },
      { id: 'walletPayments', header: 'Wallet Payments', accessor: 'walletPayments', sortable: true, align: 'right', width: '10rem' },
      { id: 'bankTransferPayments', header: 'Bank Transfer Payments', accessor: 'bankTransferPayments', sortable: true, align: 'right', width: '12rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'period',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: 'Cash Flow Summary is powered by the canonical financial ledger and exposes backend gaps explicitly.'
  });
}
