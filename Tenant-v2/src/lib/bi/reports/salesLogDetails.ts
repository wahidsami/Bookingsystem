import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface SalesLogDetailsTableRow {
  id: string;
  dateTime: string;
  saleNumber: string;
  appointmentReference: string;
  invoiceNumber: string;
  customer: string;
  employee: string;
  itemType: string;
  itemName: string;
  category: string;
  quantity: number | null;
  unitPrice: number | null;
  gross: number | null;
  discount: number | null;
  vat: number | null;
  net: number | null;
  paymentMethod: string;
  status: string;
  location: string;
  sourceRow?: any;
  sourceItem?: any;
}

export interface SalesLogDetailsReportOptions {
  customers: BIOption[];
  employees: BIOption[];
  categories: BIOption[];
  itemTypes: BIOption[];
  paymentMethods: BIOption[];
  statuses: BIOption[];
  locations: BIOption[];
}

export function createSalesLogDetailsReportDefinition(
  options: SalesLogDetailsReportOptions
): BIReportDefinition<SalesLogDetailsTableRow> {
  return defineBIReport<SalesLogDetailsTableRow>({
    id: 'sales-log-details',
    title: 'Sales Log Details',
    description: 'Detailed operational ledger of invoice line items built from the canonical financial ledger.',
    endpoint: '/tenant/financial/ledger',
    businessRules: [
      'No financial values are recalculated in the frontend.',
      'Missing backend fields must be displayed as Unavailable.',
      'Every row must originate from canonical invoice and ledger data.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search sale number, invoice, customer, employee, item name, category, payment method, or location.' },
      { id: 'customer', label: 'Customer', type: 'customer', options: options.customers },
      { id: 'employee', label: 'Employee', type: 'employee', options: options.employees },
      { id: 'category', label: 'Category', type: 'category', options: options.categories },
      { id: 'itemType', label: 'Item Type', type: 'dropdown', options: options.itemTypes },
      { id: 'paymentMethod', label: 'Payment Method', type: 'payment-method', options: options.paymentMethods },
      { id: 'status', label: 'Status', type: 'status', options: options.statuses },
      { id: 'location', label: 'Location', type: 'location', options: options.locations }
    ],
    columns: [
      { id: 'dateTime', header: 'Date / Time', accessor: 'dateTime', sortable: true, width: '13rem' },
      { id: 'saleNumber', header: 'Sale Number', accessor: 'saleNumber', sortable: true, width: '11rem' },
      { id: 'appointmentReference', header: 'Appointment Reference', accessor: 'appointmentReference', sortable: true, width: '13rem' },
      { id: 'invoiceNumber', header: 'Invoice Number', accessor: 'invoiceNumber', sortable: true, width: '11rem' },
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '12rem' },
      { id: 'employee', header: 'Team Member', accessor: 'employee', sortable: true, width: '11rem' },
      { id: 'itemType', header: 'Item Type', accessor: 'itemType', sortable: true, width: '10rem' },
      { id: 'itemName', header: 'Item Name', accessor: 'itemName', sortable: true, width: '14rem' },
      { id: 'category', header: 'Category', accessor: 'category', sortable: true, width: '11rem' },
      { id: 'quantity', header: 'Quantity', accessor: 'quantity', sortable: true, align: 'right', width: '8rem' },
      { id: 'unitPrice', header: 'Unit Price', accessor: 'unitPrice', sortable: true, align: 'right', width: '9rem' },
      { id: 'gross', header: 'Gross', accessor: 'gross', sortable: true, align: 'right', width: '9rem' },
      { id: 'discount', header: 'Discount', accessor: 'discount', sortable: true, align: 'right', width: '9rem' },
      { id: 'vat', header: 'VAT', accessor: 'vat', sortable: true, align: 'right', width: '8rem' },
      { id: 'net', header: 'Net', accessor: 'net', sortable: true, align: 'right', width: '9rem' },
      { id: 'paymentMethod', header: 'Payment Method', accessor: 'paymentMethod', sortable: true, width: '11rem' },
      { id: 'status', header: 'Status', accessor: 'status', sortable: true, width: '10rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'dateTime',
      direction: 'desc'
    },
    defaultPageSize: 10,
    footer: 'Sales Log Details is powered by the canonical financial ledger and invoice records.'
  });
}
