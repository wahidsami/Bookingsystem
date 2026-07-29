import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface DiscountSummaryTableRow {
  id: string;
  saleDate: string;
  saleNumber: string;
  invoiceNumber: string;
  appointmentReference: string;
  discountCategory: string;
  discountType: string;
  item: string;
  category: string;
  customer: string;
  teamMember: string;
  grossSales: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  netSales: number | null;
  status: string;
}

export interface DiscountSummaryReportOptions {
  discountCategories: BIOption[];
  discountTypes: BIOption[];
  customers: BIOption[];
  employees: BIOption[];
  locations: BIOption[];
  services: BIOption[];
  products: BIOption[];
}

export function createDiscountSummaryReportDefinition(
  options: DiscountSummaryReportOptions
): BIReportDefinition<DiscountSummaryTableRow> {
  return defineBIReport<DiscountSummaryTableRow>({
    id: 'discount-summary',
    title: 'Discount Summary',
    description: 'Canonical discount visibility built from sales ledger rows and backend discount totals.',
    endpoint: '/tenant/bi/sales-overview',
    businessRules: [
      'Backend values only.',
      'Discount amount is taken from the canonical sales ledger.',
      'Discount type and discount percent are shown only when the backend exposes them.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search item, customer, team member, category, location, or discount metadata.' },
      { id: 'discountCategory', label: 'Discount Category', type: 'dropdown', options: options.discountCategories },
      { id: 'discountType', label: 'Discount Type', type: 'dropdown', options: options.discountTypes },
      { id: 'customer', label: 'Customer', type: 'customer', options: options.customers },
      { id: 'employee', label: 'Team Member', type: 'employee', options: options.employees },
      { id: 'location', label: 'Location', type: 'location', options: options.locations },
      { id: 'service', label: 'Service', type: 'dropdown', options: options.services },
      { id: 'product', label: 'Product', type: 'dropdown', options: options.products }
    ],
    columns: [
      { id: 'discountCategory', header: 'Discount Category', accessor: 'discountCategory', sortable: true, width: '11rem' },
      { id: 'discountType', header: 'Discount Type', accessor: 'discountType', sortable: true, width: '11rem' },
      { id: 'item', header: 'Item', accessor: 'item', sortable: true, width: '14rem' },
      { id: 'category', header: 'Category', accessor: 'category', sortable: true, width: '11rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'teamMember', header: 'Team Member', accessor: 'teamMember', sortable: true, width: '12rem' },
      { id: 'grossSales', header: 'Gross Sales', accessor: 'grossSales', sortable: true, align: 'right', width: '10rem' },
      { id: 'discountAmount', header: 'Discount Amount', accessor: 'discountAmount', sortable: true, align: 'right', width: '11rem' },
      { id: 'discountPercent', header: 'Discount %', accessor: 'discountPercent', sortable: true, align: 'right', width: '9rem' },
      { id: 'netSales', header: 'Net Sales', accessor: 'netSales', sortable: true, align: 'right', width: '10rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'discountAmount',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: 'Discount Summary is powered by the canonical sales overview payload and exposes backend gaps explicitly.'
  });
}
