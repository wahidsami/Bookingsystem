import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface TaxSummaryTableRow {
  id: string;
  dateTime: string;
  saleNumber: string;
  invoiceNumber: string;
  appointmentReference: string;
  taxType: string;
  taxRate: string;
  item: string;
  category: string;
  customer: string;
  teamMember: string;
  grossSales: number | null;
  taxAmount: number | null;
  netSales: number | null;
  paymentMethod: string;
  status: string;
  location: string;
  itemType: string;
  sourceRow?: any;
  sourceItem?: any;
}

export interface TaxSummaryReportOptions {
  taxTypes: BIOption[];
  customers: BIOption[];
  employees: BIOption[];
  locations: BIOption[];
  services: BIOption[];
  products: BIOption[];
}

export function createTaxSummaryReportDefinition(
  options: TaxSummaryReportOptions
): BIReportDefinition<TaxSummaryTableRow> {
  return defineBIReport<TaxSummaryTableRow>({
    id: 'tax-summary',
    title: 'Tax Summary',
    description: 'Canonical tax visibility built from the financial ledger and invoice item rows.',
    endpoint: '/tenant/financial/ledger',
    businessRules: [
      'Backend values only.',
      'Tax amount is taken from the canonical financial ledger.',
      'Tax type and tax rate are shown only when the backend exposes them.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search item, customer, team member, invoice, tax type, or location.' },
      { id: 'taxType', label: 'Tax Type', type: 'dropdown', options: options.taxTypes },
      { id: 'customer', label: 'Customer', type: 'customer', options: options.customers },
      { id: 'employee', label: 'Employee', type: 'employee', options: options.employees },
      { id: 'location', label: 'Location', type: 'location', options: options.locations },
      { id: 'service', label: 'Service', type: 'dropdown', options: options.services },
      { id: 'product', label: 'Product', type: 'dropdown', options: options.products }
    ],
    columns: [
      { id: 'taxType', header: 'Tax Type', accessor: 'taxType', sortable: true, width: '10rem' },
      { id: 'taxRate', header: 'Tax Rate', accessor: 'taxRate', sortable: true, width: '8rem' },
      { id: 'item', header: 'Item', accessor: 'item', sortable: true, width: '14rem' },
      { id: 'category', header: 'Category', accessor: 'category', sortable: true, width: '11rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'teamMember', header: 'Team Member', accessor: 'teamMember', sortable: true, width: '12rem' },
      { id: 'grossSales', header: 'Gross Sales', accessor: 'grossSales', sortable: true, align: 'right', width: '10rem' },
      { id: 'taxAmount', header: 'Tax Amount', accessor: 'taxAmount', sortable: true, align: 'right', width: '10rem' },
      { id: 'netSales', header: 'Net Sales', accessor: 'netSales', sortable: true, align: 'right', width: '10rem' },
      { id: 'invoiceNumber', header: 'Invoice Number', accessor: 'invoiceNumber', sortable: true, width: '11rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'taxAmount',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: 'Tax Summary is powered by the canonical financial ledger and exposes backend gaps explicitly.'
  });
}
