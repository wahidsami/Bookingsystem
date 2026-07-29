import { defineBIReport } from '../reportDefinition';
import type { BIOption, BIReportDefinition } from '../types';

export interface CustomerOverviewTableRow {
  id: string;
  customer: string;
  visits: number | null;
  completedVisits: number | null;
  revenue: number | null;
  firstVisit: string;
  lastVisit: string;
  customerType: string;
  retentionRate: number | null;
  lifetimeRevenue?: number | null;
  notes?: string | null;
}

export interface EmployeePerformanceTableRow {
  id: string;
  employee: string;
  appointments: number | null;
  servicesPerformed: number | null;
  revenue: number | null;
  averageTicket: number | null;
  productivity: number | null;
  commission: number | null;
  completionRate: number | null;
  noShows?: number | null;
  cancellations?: number | null;
  notes?: string | null;
}

export interface ServicePerformanceTableRow {
  id: string;
  service: string;
  category: string;
  quantitySold: number | null;
  revenue: number | null;
  averagePrice: number | null;
  completedBookings: number | null;
  completionRate: number | null;
  trend?: Array<{
    date: string;
    bookings: number;
    revenue: number;
    averagePrice: number;
  }>;
  notes?: string | null;
}

export interface ProductPerformanceTableRow {
  id: string;
  product: string;
  category: string;
  orders: number | null;
  quantitySold: number | null;
  revenue: number | null;
  averagePrice: number | null;
  platformFees: number | null;
  tenantRevenue: number | null;
  stock?: number | null;
  soldCount?: number | null;
  usedAsGiftCount?: number | null;
  inventoryImpact?: number | null;
  trend?: Array<{
    date: string;
    quantitySold: number;
    revenue: number;
    averagePrice: number;
  }>;
  notes?: string | null;
}

export interface CustomerOverviewReportOptions {
  customerTypes: BIOption[];
}

export interface EmployeePerformanceReportOptions {
}

export interface ServicePerformanceReportOptions {
  categories: BIOption[];
}

export interface ProductPerformanceReportOptions {
  categories: BIOption[];
}

export function createCustomerOverviewReportDefinition(
  options: CustomerOverviewReportOptions
): BIReportDefinition<CustomerOverviewTableRow> {
  return defineBIReport<CustomerOverviewTableRow>({
    id: 'customer-overview',
    title: 'Customer Overview',
    description: 'Canonical customer intelligence for visits, retention, and revenue contribution.',
    endpoint: '/tenant/reports/full?sections=overview,bookingTrends,customerAnalytics',
    businessRules: [
      'Backend values only.',
      'Customer lifetime revenue is shown only when the backend provides it.',
      'Missing backend values remain visibly marked as unavailable.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search customer name, segment, or notes.' },
      { id: 'customerType', label: 'Customer Type', type: 'dropdown', options: options.customerTypes },
      { id: 'visitsRange', label: 'Visits Range', type: 'amount-range', minPlaceholder: 'Min visits', maxPlaceholder: 'Max visits' }
    ],
    columns: [
      { id: 'customer', header: 'Customer', accessor: 'customer', sortable: true, width: '14rem' },
      { id: 'visits', header: 'Visits', accessor: 'visits', sortable: true, align: 'right', width: '8rem' },
      { id: 'completedVisits', header: 'Completed Visits', accessor: 'completedVisits', sortable: true, align: 'right', width: '10rem' },
      { id: 'revenue', header: 'Revenue', accessor: 'revenue', sortable: true, align: 'right', width: '10rem' },
      { id: 'lifetimeRevenue', header: 'Lifetime Revenue', accessor: 'lifetimeRevenue', sortable: true, align: 'right', width: '11rem' },
      { id: 'customerType', header: 'Customer Type', accessor: 'customerType', sortable: true, width: '11rem' },
      { id: 'firstVisit', header: 'First Visit', accessor: 'firstVisit', sortable: true, width: '12rem' },
      { id: 'lastVisit', header: 'Last Visit', accessor: 'lastVisit', sortable: true, width: '12rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'revenue',
      direction: 'desc'
    },
    defaultPageSize: 8,
    footer: 'Customer Overview is powered by the canonical customer analytics and booking trend sections.'
  });
}

export function createEmployeePerformanceReportDefinition(
  _options: EmployeePerformanceReportOptions
): BIReportDefinition<EmployeePerformanceTableRow> {
  return defineBIReport<EmployeePerformanceTableRow>({
    id: 'employee-performance',
    title: 'Employee Performance',
    description: 'Canonical employee intelligence for service delivery, productivity, and revenue contribution.',
    endpoint: '/tenant/reports/full?sections=overview,employeePerformance',
    businessRules: [
      'Backend values only.',
      'Cancellation and no-show breakdowns remain backend-owned.',
      'Missing backend values remain visibly marked as unavailable.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search employee name or notes.' },
      { id: 'revenueRange', label: 'Revenue Range', type: 'amount-range', minPlaceholder: 'Min revenue', maxPlaceholder: 'Max revenue' }
    ],
    columns: [
      { id: 'employee', header: 'Employee', accessor: 'employee', sortable: true, width: '14rem' },
      { id: 'appointments', header: 'Appointments', accessor: 'appointments', sortable: true, align: 'right', width: '9rem' },
      { id: 'servicesPerformed', header: 'Services Performed', accessor: 'servicesPerformed', sortable: true, align: 'right', width: '10rem' },
      { id: 'revenue', header: 'Revenue', accessor: 'revenue', sortable: true, align: 'right', width: '10rem' },
      { id: 'averageTicket', header: 'Average Ticket', accessor: 'averageTicket', sortable: true, align: 'right', width: '10rem' },
      { id: 'productivity', header: 'Productivity', accessor: 'productivity', sortable: true, align: 'right', width: '9rem' },
      { id: 'completionRate', header: 'Completion Rate', accessor: 'completionRate', sortable: true, align: 'right', width: '10rem' },
      { id: 'noShows', header: 'No-shows', accessor: 'noShows', sortable: true, align: 'right', width: '8rem' },
      { id: 'cancellations', header: 'Cancellations', accessor: 'cancellations', sortable: true, align: 'right', width: '9rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'revenue',
      direction: 'desc'
    },
    defaultPageSize: 8,
    footer: 'Employee Performance is powered by the canonical employee analytics section.'
  });
}

export function createServicePerformanceReportDefinition(
  options: ServicePerformanceReportOptions
): BIReportDefinition<ServicePerformanceTableRow> {
  return defineBIReport<ServicePerformanceTableRow>({
    id: 'service-performance',
    title: 'Service Performance',
    description: 'Canonical service intelligence for revenue, quantity sold, and completion rate.',
    endpoint: '/tenant/reports/full?sections=overview,servicePerformance',
    businessRules: [
      'Backend values only.',
      'Average price is used only when the backend exposes it.',
      'Missing backend values remain visibly marked as unavailable.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search service name, category, or notes.' },
      { id: 'category', label: 'Category', type: 'dropdown', options: options.categories },
      { id: 'quantityRange', label: 'Quantity Range', type: 'amount-range', minPlaceholder: 'Min quantity', maxPlaceholder: 'Max quantity' }
    ],
    columns: [
      { id: 'service', header: 'Service', accessor: 'service', sortable: true, width: '14rem' },
      { id: 'category', header: 'Category', accessor: 'category', sortable: true, width: '11rem' },
      { id: 'quantitySold', header: 'Quantity Sold', accessor: 'quantitySold', sortable: true, align: 'right', width: '10rem' },
      { id: 'revenue', header: 'Revenue', accessor: 'revenue', sortable: true, align: 'right', width: '10rem' },
      { id: 'averagePrice', header: 'Average Price', accessor: 'averagePrice', sortable: true, align: 'right', width: '10rem' },
      { id: 'completedBookings', header: 'Completed', accessor: 'completedBookings', sortable: true, align: 'right', width: '8rem' },
      { id: 'completionRate', header: 'Completion Rate', accessor: 'completionRate', sortable: true, align: 'right', width: '10rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'revenue',
      direction: 'desc'
    },
    defaultPageSize: 8,
    footer: 'Service Performance is powered by the canonical service analytics section.'
  });
}

export function createProductPerformanceReportDefinition(
  options: ProductPerformanceReportOptions
): BIReportDefinition<ProductPerformanceTableRow> {
  return defineBIReport<ProductPerformanceTableRow>({
    id: 'product-performance',
    title: 'Product Performance',
    description: 'Canonical product intelligence for sales, quantities, and revenue contribution.',
    endpoint: '/tenant/reports/full?sections=overview,products',
    businessRules: [
      'Backend values only.',
      'Inventory impact is shown only when the backend provides it.',
      'Missing backend values remain visibly marked as unavailable.'
    ],
    filters: [
      { id: 'search', label: 'Search', type: 'search', helperText: 'Search product name, category, or notes.' },
      { id: 'category', label: 'Category', type: 'dropdown', options: options.categories },
      { id: 'revenueRange', label: 'Revenue Range', type: 'amount-range', minPlaceholder: 'Min revenue', maxPlaceholder: 'Max revenue' }
    ],
    columns: [
      { id: 'product', header: 'Product', accessor: 'product', sortable: true, width: '14rem' },
      { id: 'category', header: 'Category', accessor: 'category', sortable: true, width: '11rem' },
      { id: 'orders', header: 'Orders', accessor: 'orders', sortable: true, align: 'right', width: '8rem' },
      { id: 'quantitySold', header: 'Quantity Sold', accessor: 'quantitySold', sortable: true, align: 'right', width: '10rem' },
      { id: 'stock', header: 'Stock', accessor: 'stock', sortable: true, align: 'right', width: '8rem' },
      { id: 'soldCount', header: 'Sold Count', accessor: 'soldCount', sortable: true, align: 'right', width: '9rem' },
      { id: 'usedAsGiftCount', header: 'Gift Uses', accessor: 'usedAsGiftCount', sortable: true, align: 'right', width: '9rem' },
      { id: 'inventoryImpact', header: 'Inventory Impact', accessor: 'inventoryImpact', sortable: true, align: 'right', width: '10rem' },
      { id: 'revenue', header: 'Revenue', accessor: 'revenue', sortable: true, align: 'right', width: '10rem' },
      { id: 'averagePrice', header: 'Average Price', accessor: 'averagePrice', sortable: true, align: 'right', width: '10rem' },
      { id: 'tenantRevenue', header: 'Tenant Revenue', accessor: 'tenantRevenue', sortable: true, align: 'right', width: '10rem' }
    ],
    exports: {
      enabled: { csv: true, excel: true, pdf: true, print: true }
    },
    defaultSort: {
      columnId: 'revenue',
      direction: 'desc'
    },
    defaultPageSize: 8,
    footer: 'Product Performance is powered by the canonical product revenue section.'
  });
}
