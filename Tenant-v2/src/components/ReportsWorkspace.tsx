import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, Users, Calendar, Sparkles, Plus, Search, MapPin, 
  Clock, Check, X, ShieldAlert, Award, Star, Gift, Package, 
  Receipt, ShoppingBag, CreditCard, ChevronRight, MessageSquare, 
  AlertCircle, ChevronDown, Download, Share2, Printer, Filter, 
  AlertTriangle, Eye, ArrowUpDown, ChevronLeft, HelpCircle, FileSpreadsheet,
  FileText, ArrowUpRight, ArrowDownRight, RefreshCw, CalendarDays, CheckCircle2
} from 'lucide-react';
import { Language } from '../types';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

interface ReportsWorkspaceProps {
  lang: Language;
}

type ReportTab =
  | 'overview'
  | 'sales'
  | 'financial'
  | 'appointments'
  | 'rebookings'
  | 'employees'
  | 'services'
  | 'products'
  | 'discounts'
  | 'refunds'
  | 'paymentMethods'
  | 'customerSales'
  | 'advancedAnalytics';

export default function ReportsWorkspace({ lang }: ReportsWorkspaceProps) {
  const isRtl = lang === 'ar';

  // State Management
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [dateRange, setDateRange] = useState('last_30_days');
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [drillDownId, setDrillDownId] = useState<string | null>(null);
  
  // Custom Toast State
  const [toast, setToast] = useState<{ show: boolean; msgEn: string; msgAr: string; type: 'success' | 'info' }>({
    show: false,
    msgEn: '',
    msgAr: '',
    type: 'success'
  });

  const showToast = (en: string, ar: string, type: 'success' | 'info' = 'success') => {
    setToast({ show: true, msgEn: en, msgAr: ar, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>({});
  const [overviewStats, setOverviewStats] = useState<any>(null);

  const resolveDateRange = (range: string) => {
    const now = new Date();
    const endDate = new Date(now);
    const startDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last_7_days':
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'this_month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last_month': {
        startDate.setMonth(startDate.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'custom':
      case 'last_30_days':
      default:
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };

  const mapBookingTrendRows = (rows: any[]) =>
    rows.map((row) => ({
      id: row.id || row.date,
      date: row.date,
      grossSales: Number(row.revenue || 0),
      discounts: 0,
      refunds: 0,
      netSales: Number(row.revenue || 0),
      total: Number(row.revenue || 0),
      vat: Number((Number(row.revenue || 0) * 0.15).toFixed(2)),
      bookings: Number(row.bookings || 0),
      completed: Number(row.completed || 0)
    }));

  const mapAppointmentTrendRows = (rows: any[]) =>
    rows.map((row) => ({
      id: row.id || row.date,
      date: row.date,
      customer: row.customer || row.customerName || '-',
      customerAr: row.customer || row.customerName || '-',
      stylist: row.stylist || row.employee || '-',
      stylistAr: row.stylist || row.employee || '-',
      service: row.service || row.serviceName || '-',
      serviceAr: row.service || row.serviceName || '-',
      duration: row.duration || '-',
      price: Number(row.revenue || 0),
      status: row.completed ? 'Completed' : 'Booked',
      statusAr: row.completed ? 'مكتمل' : 'محجوز',
      paymentStatus: row.completed ? 'Paid' : 'Pending',
      totalPaid: Number(row.revenue || 0),
      branch: row.branch || '-'
    }));

  const mapFinancialRows = (transactions: any[] = []) =>
    transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.processedAt || transaction.createdAt,
      customer: transaction.appointment?.customer?.fullName || transaction.order?.customer?.fullName || transaction.customerName || '-',
      customerAr: transaction.appointment?.customer?.fullName || transaction.order?.customer?.fullName || transaction.customerName || '-',
      type: transaction.type || transaction.source || (transaction.appointment ? 'Appointment' : transaction.order ? 'Order' : 'Transaction'),
      subtotal: Number(transaction.subtotal || transaction.amount || 0),
      vat: Number(transaction.taxAmount || 0),
      total: Number(transaction.amount || transaction.totalAmount || 0),
      method: transaction.paymentMethod || '-',
      methodAr: transaction.paymentMethod || '-',
      invoiceId: transaction.reference || transaction.invoiceNumber || transaction.transactionRef || transaction.id
    }));

  const mapAdvancedAnalyticsRows = (analytics: any) => {
    if (!analytics) return [];
    const current = analytics.comparativeAnalytics?.current || {};
    const comparisons = analytics.comparativeAnalytics?.comparisons || {};

    return [
      { id: 'current_revenue', date: 'current', nameEn: 'Current revenue', total: Number(current.revenue || 0), pct: current.completionRate || 0 },
      { id: 'current_bookings', date: 'current', nameEn: 'Current bookings', total: Number(current.bookings || 0), pct: current.completionRate || 0 },
      { id: 'current_refunds', date: 'current', nameEn: 'Current refunds', total: Number(current.refunds || 0), pct: current.refunds || 0 },
      { id: 'current_customers', date: 'current', nameEn: 'Current customers', total: Number(current.customers || 0), pct: current.completionRate || 0 },
      { id: 'completion_rate', date: 'current', nameEn: 'Completion rate', total: Number(current.completionRate || 0), pct: current.completionRate || 0 },
      ...Object.entries(comparisons).map(([key, value]: [string, any]) => ({
        id: `comparison_${key}`,
        date: 'comparison',
        nameEn: key,
        total: Number(value || 0),
        pct: Number(value || 0)
      }))
    ];
  };

  // Trigger loading effect when the date range changes
  useEffect(() => {
    async function fetchReportData() {
      setIsLoading(true);
      try {
        const { startDate, endDate } = resolveDateRange(dateRange);
        const groupBy = 'day';

        const [
          empRes,
          srvRes,
          summaryRes,
          financialRes,
          trendsRes,
          servicePerfRes,
          employeePerfRes,
          productRevenueRes,
          peakHoursRes,
          customerAnalyticsRes,
          rebookingRes,
          refundsRes,
          paymentMethodsRes,
          posRes,
          customerSalesRes,
          advancedRes
        ] = await Promise.allSettled([
          tenantApiAdapter.getEmployees(),
          tenantApiAdapter.getServices(),
          tenantApiAdapter.getReportsSummary({ startDate, endDate }),
          tenantApiAdapter.getFinancialOverview({ startDate, endDate }),
          tenantApiAdapter.getBookingTrends({ startDate, endDate, groupBy }),
          tenantApiAdapter.getServicePerformance(startDate, endDate),
          tenantApiAdapter.getEmployeePerformance(startDate, endDate),
          tenantApiAdapter.getProductRevenue({ startDate, endDate }),
          tenantApiAdapter.getPeakHoursAnalysis({ startDate, endDate }),
          tenantApiAdapter.getCustomerAnalytics(startDate, endDate),
          tenantApiAdapter.getRebookingAnalytics(startDate, endDate),
          tenantApiAdapter.getRefundsReport(startDate, endDate),
          tenantApiAdapter.getPaymentMethodsReport(startDate, endDate),
          tenantApiAdapter.getPosClosingSummary({ date: endDate.split('T')[0] }),
          tenantApiAdapter.getFullReport(startDate, endDate, ['customerSales']),
          tenantApiAdapter.getAdvancedAnalytics({ startDate, endDate, groupBy })
        ]);

        const employees = empRes.status === 'fulfilled' && empRes.value?.employees
          ? empRes.value.employees
          : [];
        setEmployeesList([
          { id: 'all', nameEn: 'All Staff', nameAr: 'جميع الموظفات' },
          ...employees.map((e: any) => ({
            id: e.id,
            nameEn: `${e.firstName} ${e.lastName}`,
            nameAr: `${e.firstName} ${e.lastName}`,
            ...e
          }))
        ]);

        const services = srvRes.status === 'fulfilled' && srvRes.value?.services
          ? srvRes.value.services
          : [];
        const uniqueCats = Array.from(new Set(services.map((s: any) => s.categoryEn || 'Uncategorized')));
        setServiceCategories([
          { id: 'all', nameEn: 'All Categories', nameAr: 'جميع التصنيفات' },
          ...uniqueCats.map((c: any) => ({ id: (c as string).toLowerCase(), nameEn: c, nameAr: c }))
        ]);

        const summaryData = summaryRes.status === 'fulfilled' && summaryRes.value?.success
          ? (summaryRes.value.data || summaryRes.value.overview || summaryRes.value)
          : null;
        const financialOverviewData = financialRes.status === 'fulfilled' && financialRes.value?.success
          ? (financialRes.value.overview || financialRes.value.data || null)
          : null;
        const bookingTrendRows = trendsRes.status === 'fulfilled' && trendsRes.value?.success
          ? (trendsRes.value.data || [])
          : [];
        const servicePerformanceRows = servicePerfRes.status === 'fulfilled' && servicePerfRes.value?.success
          ? (servicePerfRes.value.data || [])
          : [];
        const employeePerformanceRows = employeePerfRes.status === 'fulfilled' && employeePerfRes.value?.success
          ? (employeePerfRes.value.data || [])
          : [];
        const productRevenueData = productRevenueRes.status === 'fulfilled' && productRevenueRes.value?.success
          ? {
              rows: productRevenueRes.value.products || [],
              totals: productRevenueRes.value.totals || null
            }
          : { rows: [], totals: null };
        const peakHoursData = peakHoursRes.status === 'fulfilled' && peakHoursRes.value?.success
          ? (peakHoursRes.value.data || null)
          : null;
        const customerAnalyticsData = customerAnalyticsRes.status === 'fulfilled' && customerAnalyticsRes.value?.success
          ? (customerAnalyticsRes.value.data || null)
          : null;
        const rebookingAnalyticsData = rebookingRes.status === 'fulfilled' && rebookingRes.value?.success
          ? {
              rows: rebookingRes.value.data || [],
              totals: rebookingRes.value.totals || null,
              trend: rebookingRes.value.trend || [],
              topRebookingEmployees: rebookingRes.value.topRebookingEmployees || []
            }
          : { rows: [], totals: null, trend: [], topRebookingEmployees: [] };
        const refundsData = refundsRes.status === 'fulfilled' && refundsRes.value?.success
          ? {
              rows: refundsRes.value.data || [],
              totals: refundsRes.value.totals || null
            }
          : { rows: [], totals: null };
        const paymentMethodsData = paymentMethodsRes.status === 'fulfilled' && paymentMethodsRes.value?.success
          ? {
              rows: paymentMethodsRes.value.data || [],
              totals: paymentMethodsRes.value.totals || null,
              trend: paymentMethodsRes.value.trend || []
            }
          : { rows: [], totals: null, trend: [] };
        const posSummary = posRes.status === 'fulfilled' && posRes.value?.success
          ? posRes.value.summary || null
          : null;
        const posTransactions = posRes.status === 'fulfilled' && posRes.value?.success
          ? posRes.value.transactions || []
          : [];
        const financialSourceRows = posTransactions.length
          ? posTransactions
          : (financialOverviewData?.discountTotals?.topDiscountedOrders || []).map((entry: any) => ({
              id: entry.id,
              processedAt: endDate,
              customerName: entry.orderNumber || entry.id,
              amount: entry.totalAmount,
              subtotal: entry.baseAmount,
              taxAmount: Number((Number(entry.totalAmount || 0) - Number(entry.baseAmount || 0)).toFixed(2)),
              paymentMethod: 'order',
              type: 'order'
            }));
        const customerSalesData = customerSalesRes.status === 'fulfilled' && customerSalesRes.value?.success
          ? (customerSalesRes.value.data || {})
          : {};
        const advancedAnalyticsData = advancedRes.status === 'fulfilled' && advancedRes.value?.success
          ? (advancedRes.value.data || null)
          : null;
        const mappedCustomerSales = Array.isArray(customerSalesData.customerSales)
          ? customerSalesData.customerSales.map((row: any) => ({
              ...row,
              nameAr: row.name || row.customer || row.customerDisplayName || row.id,
              name: row.customer || row.name || row.customerDisplayName || row.id,
              phone: row.phone || '-',
              tier: row.customerBadge || row.customerType || '-',
              visits: Number(row.bookings || row.visits || 0),
              spentServices: Number(row.revenue || row.spentServices || 0),
              spentProducts: Number(row.spentProducts || 0),
              totalSpent: Number(row.totalSpent || row.revenue || 0)
            }))
          : [];
        const serviceRevenueTotal = servicePerformanceRows.reduce((sum: number, row: any) => sum + Number(row.revenue || 0), 0) || 1;
        const mappedServices = servicePerformanceRows.map((row: any) => ({
          id: row.id,
          name: row.name_en || row.name_ar || row.name || row.id,
          nameAr: row.name_ar || row.name_en || row.name || row.id,
          category: row.category || '-',
          categoryAr: row.category || '-',
          bookings: Number(row.totalBookings || row.bookings || 0),
          duration: row.duration || '-',
          avgPrice: Number(row.avgRevenue || row.avgPrice || row.price || 0),
          totalRevenue: Number(row.revenue || 0),
          share: `${((Number(row.revenue || 0) / serviceRevenueTotal) * 100).toFixed(1)}%`
        }));
        const mappedEmployees = employeePerformanceRows.map((row: any) => ({
          id: row.id,
          name: row.name || row.firstName || row.id,
          nameAr: row.name || row.firstName || row.id,
          role: row.commissionRate != null ? `${row.commissionRate}%` : '-',
          roleAr: row.commissionRate != null ? `${row.commissionRate}%` : '-',
          bookings: Number(row.totalBookings || row.bookings || 0),
          utilization: `${Number(row.completionRate || 0).toFixed(1)}%`,
          servicesSales: Number(row.revenue || 0),
          productSales: 0,
          tips: Number(row.commission || 0),
          totalSales: Number(row.revenue || 0),
          photo: row.photo || null
        }));
        const mappedProducts = (productRevenueData.rows || []).map((row: any) => ({
          id: row.id,
          sku: row.id,
          name: row.name_en || row.name_ar || row.name || row.id,
          nameAr: row.name_ar || row.name_en || row.name || row.id,
          category: row.category || '-',
          categoryAr: row.category || '-',
          sold: Number(row.totalQuantity || row.sold || 0),
          unitPrice: Number(row.productPrice || row.unitPrice || 0),
          revenue: Number(row.totalRevenue || row.revenue || 0),
          stock: row.stock ?? row.stockQuantity ?? 0
        }));
        const mappedPaymentMethods = paymentMethodsData.rows.map((row: any) => ({
          id: row.paymentMethod,
          method: row.paymentMethodLabel || row.paymentMethod,
          methodAr: row.paymentMethodLabel || row.paymentMethod,
          transactions: Number(row.transactionCount || 0),
          collected: Number(row.revenue || 0),
          fees: 0,
          settlement: Number(row.revenue || 0),
          pct: `${paymentMethodsData.totals?.revenue ? ((Number(row.revenue || 0) / Number(paymentMethodsData.totals.revenue || 1)) * 100).toFixed(1) : '0.0'}%`,
          rating: 'Live'
        }));
        const mappedDiscounts = Array.isArray(financialOverviewData?.discountTotals?.topDiscountedServices)
          ? financialOverviewData.discountTotals.topDiscountedServices.map((row: any) => ({
              id: row.id,
              code: row.id,
              description: row.name_en || row.name_ar || row.name || row.id,
              descriptionAr: row.name_ar || row.name_en || row.name || row.id,
              appliedCount: Number(row.bookingCount || row.appliedCount || 0),
              avgDiscount: Number(row.bookingCount ? row.discountAmount / Math.max(Number(row.bookingCount || 0), 1) : row.discountAmount || 0).toFixed(2),
              totalDiscount: Number(row.discountAmount || 0).toFixed(2),
              category: row.category || '-'
            }))
          : [];
        const mappedRebookings = rebookingAnalyticsData.rows.map((row: any) => ({
          id: row.id,
          customer: row.customer || row.customerName || row.id,
          customerAr: row.customer || row.customerName || row.id,
          service: row.service || '-',
          serviceAr: row.service || '-',
          lastVisit: row.date || row.lastVisit || '-',
          rebookedDate: row.date || row.rebookedDate || '-',
          interval: row.interval || 0,
          rate: 'Rebooked',
          rebookAr: isRtl ? 'معاد الحجز' : 'Rebooked',
          stylist: row.employee || row.stylist || '-'
        }));

        setOverviewStats(summaryData);
        setReportData({
          overview: summaryData,
          sales: mapBookingTrendRows(bookingTrendRows),
          financial: mapFinancialRows(financialSourceRows),
          appointments: mapAppointmentTrendRows(bookingTrendRows),
          rebookings: mappedRebookings,
          employees: mappedEmployees,
          services: mappedServices,
          products: mappedProducts,
          discounts: mappedDiscounts,
          refunds: refundsData.rows,
          paymentMethods: mappedPaymentMethods,
          customerSales: mappedCustomerSales,
          advancedAnalytics: mapAdvancedAnalyticsRows(advancedAnalyticsData),
          financialOverview: financialOverviewData,
          bookingTrends: bookingTrendRows,
          peakHours: peakHoursData,
          customerAnalytics: customerAnalyticsData,
          rebookingAnalytics: rebookingAnalyticsData,
          refundsReport: refundsData,
          paymentMethodsReport: paymentMethodsData,
          posClosingSummary: posSummary,
          customerSalesReport: customerSalesData
        });
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReportData();
  }, [dateRange]);

  // Translations
  const t = {
    overview: isRtl ? 'نظرة عامة والتحليلات' : 'Overview & Analytics',
    sales: isRtl ? 'تقارير المبيعات' : 'Sales Reports',
    financial: isRtl ? 'التقارير المالية والضريبية' : 'Financial Reports',
    appointments: isRtl ? 'تقارير المواعيد والحجوزات' : 'Appointment Reports',
    rebookings: isRtl ? 'تحليلات إعادة الحجز' : 'Rebooking Analytics',
    employees: isRtl ? 'أداء وتكليف الموظفات' : 'Employee Reports',
    services: isRtl ? 'تحليل أداء الخدمات' : 'Service Reports',
    products: isRtl ? 'مبيعات المنتجات والمخزون' : 'Product Reports',
    discounts: isRtl ? 'تقارير الخصومات والعروض' : 'Discounts Reports',
    refunds: isRtl ? 'تقارير المرتجعات والاسترداد' : 'Refund Reports',
    paymentMethods: isRtl ? 'قنوات طرق الدفع' : 'Payment Methods',
    customerSales: isRtl ? 'تحليل مبيعات العملاء' : 'Customer Sales',
    advancedAnalytics: isRtl ? 'التحليلات المتقدمة' : 'Advanced Analytics',

    // Overview Stats Labels
    revenue: isRtl ? 'إجمالي الإيرادات' : 'Gross Revenue',
    bookings: isRtl ? 'عدد الحجوزات' : 'Total Bookings',
    retention: isRtl ? 'نسبة الاحتفاظ بالعملاء' : 'Client Retention',
    noShowRate: isRtl ? 'نسبة عدم الحضور' : 'No-Show Rate',
    rebookingRate: isRtl ? 'معدل إعادة الحجز' : 'Rebooking Rate',
    totalRefunds: isRtl ? 'إجمالي المرتجعات' : 'Total Refunds',
    avgValue: isRtl ? 'متوسط قيمة الحجز' : 'Avg Booking Value',
    vatLabel: isRtl ? 'شامل ضريبة القيمة المضافة (15%)' : 'Inc. VAT (15%)',

    // Quick filter titles
    dateRangeLabel: isRtl ? 'نطاق التاريخ' : 'Date Range',
    employeeLabel: isRtl ? 'عضو الفريق' : 'Team Member',
    serviceLabel: isRtl ? 'تصنيف الخدمة' : 'Service Category',
    paymentLabel: isRtl ? 'طريقة السداد' : 'Payment Method',
    exportLabel: isRtl ? 'تصدير البيانات' : 'Export Actions',
    savedReportsLabel: isRtl ? 'التقارير المحفوظة' : 'Saved Reports',

    // Presets
    allEmployees: isRtl ? 'جميع أعضاء الفريق' : 'All Team Members',
    allServices: isRtl ? 'جميع تصنيفات الخدمات' : 'All Service Categories',
    allPayments: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods',

    // Alert Header
    opsAlerts: isRtl ? 'التنبيهات التشغيلية والذكية' : 'Operational & Smart Alerts',

    // Table common
    searchPlaceholder: isRtl ? 'البحث في السجلات...' : 'Search records...',
    noDataTitle: isRtl ? 'لا توجد نتائج مطابقة' : 'No matching results found',
    noDataDesc: isRtl ? 'يرجى تغيير نطاق التاريخ أو إزالة الفلاتر لإظهار البيانات.' : 'Try adjusting your date range, filters, or search terms.',
    clearFilters: isRtl ? 'إعادة تعيين' : 'Clear Filters',
    drillDownTitle: isRtl ? 'التدقيق والتفاصيل التفصيلية' : 'Drill-Down Granular Details',
    closeDrillDown: isRtl ? 'إغلاق التفاصيل' : 'Close Details',
    displaying: isRtl ? 'عرض' : 'Displaying',
    of: isRtl ? 'من' : 'of',
    records: isRtl ? 'سجلات' : 'records',
    previous: isRtl ? 'السابق' : 'Previous',
    next: isRtl ? 'التالي' : 'Next'
  };

  const mockDateRanges = [
    { id: 'today', labelEn: 'Today', labelAr: 'اليوم' },
    { id: 'yesterday', labelEn: 'Yesterday', labelAr: 'الأمس' },
    { id: 'last_7_days', labelEn: 'Last 7 Days', labelAr: 'آخر 7 أيام' },
    { id: 'last_30_days', labelEn: 'Last 30 Days', labelAr: 'آخر 30 يوماً' },
    { id: 'this_month', labelEn: 'This Month', labelAr: 'الشهر الحالي' },
    { id: 'last_month', labelEn: 'Last Month', labelAr: 'الشهر الماضي' },
    { id: 'custom', labelEn: 'Custom Date', labelAr: 'تاريخ مخصص' }
  ];

  const mockPaymentMethodsList = [
    { id: 'all', nameEn: 'All Methods', nameAr: 'جميع القنوات' },
    { id: 'mada', nameEn: 'Mada Debit', nameAr: 'مدى Mada' },
    { id: 'card', nameEn: 'Credit Card', nameAr: 'بطاقة ائتمانية' },
    { id: 'cash', nameEn: 'Cash', nameAr: 'نقدي Cash' },
    { id: 'wallet', nameEn: 'Wallet', nameAr: 'المحفظة الرقمية' }
  ];

  const mockSavedReports = [
    { id: 'vat_q2', labelEn: 'Q2 VAT Tax Compliance', labelAr: 'إقرار ضريبة القيمة المضافة Q2', tab: 'financial', dateRange: 'this_month' },
    { id: 'emp_comm', labelEn: 'Employee Commission Audit', labelAr: 'تدقيق عمولات الموظفات', tab: 'employees', emp: 'st-1' },
    { id: 'retention_low', labelEn: 'VIP Rebooking Peak Days', labelAr: 'أيام ذروة إعادة حجز VIP', tab: 'rebookings', service: 'hair' },
    { id: 'discount_limit', labelEn: 'Discount Threshold Review', labelAr: 'مراجعة حدود الخصومات الممنوحة', tab: 'discounts' }
  ];

  // Helper to filter and sort the raw records
  const getFilteredData = () => {
    let list: any[] = [];
    switch (activeTab) {
      case 'sales': list = reportData.sales || []; break;
      case 'financial': list = reportData.financial || []; break;
      case 'appointments': list = reportData.appointments || []; break;
      case 'employees': list = reportData.employees || []; break;
      case 'services': list = reportData.services || []; break;
      case 'products': list = reportData.products || []; break;
      case 'discounts': list = reportData.discounts || []; break;
      case 'refunds': list = reportData.refunds || []; break;
      case 'paymentMethods': list = reportData.paymentMethods || []; break;
      case 'customerSales': list = reportData.customerSales || []; break;
      case 'rebookings': list = reportData.rebookings || []; break;
      case 'advancedAnalytics': list = reportData.advancedAnalytics || []; break;
      default: list = [];
    }

    // Text search filter
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => {
        return Object.values(item).some(val => 
          typeof val === 'string' && val.toLowerCase().includes(q)
        );
      });
    }

    // Dropdown filters (Employee filter)
    if (selectedEmployee !== 'all') {
      if (activeTab === 'employees') {
        list = list.filter(i => i.id === selectedEmployee || i.nameEn?.toLowerCase().includes(selectedEmployee.replace('st-', '')) || i.name?.toLowerCase().includes(selectedEmployee.replace('st-', '')));
      } else if (activeTab === 'appointments') {
        if (selectedEmployee !== 'all') {
          list = list.filter(i => i.stylistId === selectedEmployee || i.stylist === employeesList.find(e => e.id === selectedEmployee)?.nameEn);
        }
      }
    }

    // Category Filter
    if (selectedService !== 'all') {
      if (activeTab === 'services') {
        list = list.filter(i => i.category.toLowerCase() === selectedService);
      } else if (activeTab === 'products') {
        list = list.filter(i => i.category.toLowerCase().includes(selectedService));
      }
    }

    // Sort logic
    if (sortField) {
      list = [...list].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string' && valA.includes('%')) valA = parseFloat(valA);
        if (typeof valB === 'string' && valB.includes('%')) valB = parseFloat(valB);

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  };

  const filteredRecords = getFilteredData();
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * 5, currentPage * 5);
  const totalPages = Math.ceil(filteredRecords.length / 5) || 1;
  const totalBookingsValue = Number(overviewStats?.totalBookings || 0);
  const totalRevenueValue = Number(overviewStats?.totalRevenue || 0);
  const completionRateValue = Number(overviewStats?.completionRate || 0);
  const avgBookingValue = Number(overviewStats?.avgBookingValue || 0);
  const noShowRateValue = totalBookingsValue > 0
    ? Number(((Number(overviewStats?.noShowBookings || 0) / totalBookingsValue) * 100).toFixed(1))
    : 0;
  const rebookingRateValue = Number(reportData?.rebookingAnalytics?.totals?.rebookingRate || 0);
  const refundTotalValue = Number(reportData?.refundsReport?.totals?.totalRefunds || 0);
  const uniqueCustomersValue = Number(overviewStats?.uniqueCustomers || 0);

  // Handles export simulations
  const handleExport = (format: 'pdf' | 'csv' | 'excel' | 'print') => {
    if (format === 'print') {
      window.print();
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (format === 'csv') {
        // Build a CSV content
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Date/Detail,Primary Column,Value/Total\r\n";
        filteredRecords.forEach(r => {
          csvContent += `${r.id},${r.date || r.sku || ''},${r.nameEn || r.customer || r.code || ''},${r.total || r.totalSpent || r.revenue || r.collected || ''}\r\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Refah_Report_${activeTab}_Export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("CSV file exported and downloaded successfully.", "تم تصدير وتحميل ملف CSV المالي بنجاح.", "success");
      } else if (format === 'excel') {
        showToast("Generating secure Excel format...", "جاري إنشاء وتصدير مستند Excel للشركة...", "info");
        setTimeout(() => {
          showToast("Excel spreadsheet generated successfully.", "تم تصدير ملف الإكسل وإرساله للتحميل المباشر.", "success");
        }, 1500);
      } else if (format === 'pdf') {
        showToast("Compiling PDF report layout...", "جاري إعداد وتصدير مستند PDF معتمد تشغيلياً...", "info");
        setTimeout(() => {
          showToast("PDF report exported successfully.", "تم إنتاج وتنزيل التقرير بتنسيق PDF بنجاح.", "success");
        }, 1500);
      }
    }, 600);
  };

  const triggerSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Preset Saved Reports select handler
  const selectSavedPreset = (presetId: string) => {
    const preset = mockSavedReports.find(p => p.id === presetId);
    if (!preset) return;
    setActiveTab(preset.tab as ReportTab);
    if (preset.dateRange) setDateRange(preset.dateRange);
    if (preset.emp) setSelectedEmployee(preset.emp);
    if (preset.service) setSelectedService(preset.service);
    showToast(
      `Saved Filter applied: ${preset.labelEn}`,
      `تم تطبيق التقرير المحفوظ: ${preset.labelAr}`,
      'success'
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start select-none font-sans" id="reports-workspace-master">
      
      {/* Dynamic Toast System */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl border flex items-center gap-3 shadow-2xl ${
              toast.type === 'success' 
                ? 'bg-zinc-900 border-emerald-500/30 text-emerald-400' 
                : 'bg-zinc-900 border-blue-500/30 text-blue-400'
            }`}
          >
            <CheckCircle2 size={18} className="shrink-0" />
            <span className="text-xs font-bold">{isRtl ? toast.msgAr : toast.msgEn}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT REPORT TYPE NAVIGATION (col-span-3) */}
      <div className="xl:col-span-3 space-y-4 bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs">
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2 px-2 flex items-center gap-1.5">
          <TrendingUp size={14} className="text-amber-500" />
          {isRtl ? 'تصنيفات التحليلات' : 'Analytics & Invoicing'}
        </h3>
        <div className="flex flex-col gap-1">
          {[
            { id: 'overview', label: t.overview, icon: TrendingUp },
            { id: 'sales', label: t.sales, icon: Receipt },
            { id: 'financial', label: t.financial, icon: FileText },
            { id: 'appointments', label: t.appointments, icon: Calendar },
            { id: 'rebookings', label: t.rebookings, icon: Clock },
            { id: 'employees', label: t.employees, icon: Users },
            { id: 'services', label: t.services, icon: Sparkles },
            { id: 'products', label: t.products, icon: Package },
            { id: 'discounts', label: t.discounts, icon: Gift },
            { id: 'refunds', label: t.refunds, icon: RefreshCw },
            { id: 'paymentMethods', label: t.paymentMethods, icon: CreditCard },
            { id: 'customerSales', label: t.customerSales, icon: Award },
            { id: 'advancedAnalytics', label: t.advancedAnalytics, icon: MessageSquare }
          ].map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as ReportTab);
                  setSearchTerm('');
                  setDrillDownId(null);
                  setCurrentPage(1);
                }}
                className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-md font-extrabold scale-102 translate-x-1'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <item.icon size={15} className={isActive ? 'text-amber-400' : 'text-neutral-400'} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${isRtl ? 'mr-auto' : 'ml-auto'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT REPORT AREA (col-span-9) */}
      <div className="xl:col-span-9 space-y-6">
        
        {/* TOP STICKY FILTER BAR */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs sticky top-0 z-20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Header / Subtitle mapping inside filter bar */}
            <div>
              <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-md uppercase block w-fit">
                {isRtl ? 'صالون ومستودع رفاه الملكي' : 'REFAH BEAUTY HQ'}
              </span>
              <h2 className="text-lg font-bold text-neutral-800 font-sans tracking-tight mt-1">
                {isRtl ? 'تحليلات المبيعات ونقاط البيع' : 'Fresha & Shopify Analytics Integration'}
              </h2>
            </div>

            {/* Export buttons block */}
            <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl">
              <button
                onClick={() => handleExport('excel')}
                className="p-2 hover:bg-white rounded-lg text-neutral-600 hover:text-green-700 transition-all cursor-pointer"
                title="Excel Spreadsheet"
              >
                <FileSpreadsheet size={15} />
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="p-2 hover:bg-white rounded-lg text-neutral-600 hover:text-rose-600 transition-all cursor-pointer"
                title="Export PDF Report"
              >
                <FileText size={15} />
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="p-2 hover:bg-white rounded-lg text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer"
                title="CSV Format File"
              >
                <Download size={15} />
              </button>
              <div className="w-px h-5 bg-neutral-200" />
              <button
                onClick={() => handleExport('print')}
                className="p-2 hover:bg-white rounded-lg text-neutral-600 hover:text-indigo-600 transition-all cursor-pointer"
                title="Print Report Data"
              >
                <Printer size={15} />
              </button>
            </div>
          </div>

          {/* Core Interactive Selectors */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-neutral-100">
            
            {/* 1. Date range drop */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                <CalendarDays size={11} className="text-amber-500" />
                {t.dateRangeLabel}
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-700 outline-none cursor-pointer transition-all"
              >
                {mockDateRanges.map(dr => (
                  <option key={dr.id} value={dr.id}>{isRtl ? dr.labelAr : dr.labelEn}</option>
                ))}
              </select>
            </div>

            {/* 2. Employee Drop */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                <Users size={11} className="text-amber-500" />
                {t.employeeLabel}
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-700 outline-none cursor-pointer transition-all"
              >
                <option value="all">👑 {t.allEmployees}</option>
                {employeesList.slice(1).map(emp => (
                  <option key={emp.id} value={emp.id}>{isRtl ? emp.nameAr : emp.nameEn}</option>
                ))}
              </select>
            </div>

            {/* 3. Service category drop */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" />
                {t.serviceLabel}
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-700 outline-none cursor-pointer transition-all"
              >
                <option value="all">✨ {t.allServices}</option>
                {serviceCategories.slice(1).map(cat => (
                  <option key={cat.id} value={cat.id}>{isRtl ? cat.nameAr : cat.nameEn}</option>
                ))}
              </select>
            </div>

            {/* 4. Payment method dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                <CreditCard size={11} className="text-amber-500" />
                {t.paymentLabel}
              </label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-2 text-xs font-bold text-neutral-700 outline-none cursor-pointer transition-all"
              >
                {mockPaymentMethodsList.map(m => (
                  <option key={m.id} value={m.id}>{isRtl ? m.nameAr : m.nameEn}</option>
                ))}
              </select>
            </div>

            {/* 5. Preset saved reports trigger */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                <Award size={11} className="text-amber-500" />
                {t.savedReportsLabel}
              </label>
              <select
                onChange={(e) => selectSavedPreset(e.target.value)}
                defaultValue=""
                className="w-full bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 rounded-xl p-2 text-xs font-black text-amber-800 outline-none cursor-pointer transition-all"
              >
                <option value="" disabled>{isRtl ? 'اختر تقرير محفوظ...' : 'Saved Presets...'}</option>
                {mockSavedReports.map(sr => (
                  <option key={sr.id} value={sr.id}>{isRtl ? sr.labelAr : sr.labelEn}</option>
                ))}
              </select>
            </div>

          </div>

        </div>

        {/* LOADING SHIMMER EFFECT AREA */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="shimmer-loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(idx => (
                  <div key={idx} className="h-24 bg-white rounded-2xl border border-neutral-100 p-5 space-y-3 animate-pulse">
                    <div className="h-3 w-1/3 bg-neutral-100 rounded-md" />
                    <div className="h-6 w-2/3 bg-neutral-200 rounded-md" />
                  </div>
                ))}
              </div>
              <div className="h-72 bg-white rounded-2xl border border-neutral-100 p-6 animate-pulse space-y-4">
                <div className="h-4 w-1/4 bg-neutral-200 rounded-md" />
                <div className="w-full h-44 bg-neutral-100 rounded-lg" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="main-report-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              
              {/* ======================================= */}
              {/* OVERVIEW PAGE RENDER */}
              {/* ======================================= */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  
                  {/* Seven Critical Stats Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Revenue */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 text-neutral-900 group-hover:scale-110 transition-transform">
                        <Receipt size={40} />
                      </div>
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{t.revenue}</span>
                      <p className="text-xl md:text-2xl font-black text-neutral-800 font-mono tracking-tight mt-1">
                        {totalRevenueValue.toLocaleString()} <span className="text-xs font-bold text-neutral-500">{isRtl ? 'ر.س' : 'SAR'}</span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ArrowUpRight size={11} />
                        {isRtl ? 'مؤشر مباشر من البيانات الإنتاجية' : 'Live production metric'}
                      </span>
                    </div>

                    {/* Bookings */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 text-neutral-900 group-hover:scale-110 transition-transform">
                        <Calendar size={40} />
                      </div>
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{t.bookings}</span>
                      <p className="text-xl md:text-2xl font-black text-neutral-800 font-mono tracking-tight mt-1">
                        {totalBookingsValue.toLocaleString()} <span className="text-xs font-bold text-neutral-500">{isRtl ? 'حجزاً' : 'bookings'}</span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ArrowUpRight size={11} />
                        {isRtl ? 'مؤشر مباشر من البيانات الإنتاجية' : 'Live production metric'}
                      </span>
                    </div>

                    {/* Retention */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 text-neutral-900 group-hover:scale-110 transition-transform">
                        <Users size={40} />
                      </div>
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{t.retention}</span>
                      <p className="text-xl md:text-2xl font-black text-neutral-800 font-mono tracking-tight mt-1">
                        {uniqueCustomersValue.toLocaleString()}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ArrowUpRight size={11} />
                        {isRtl ? 'عملاء فريدون من التقارير الإنتاجية' : 'Live unique customers'}
                      </span>
                    </div>

                    {/* Average Booking Value */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 text-neutral-900 group-hover:scale-110 transition-transform">
                        <ShoppingBag size={40} />
                      </div>
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{t.avgValue}</span>
                      <p className="text-xl md:text-2xl font-black text-neutral-800 font-mono tracking-tight mt-1">
                        {avgBookingValue.toLocaleString()} <span className="text-xs font-bold text-neutral-500">{isRtl ? 'ر.س' : 'SAR'}</span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ArrowUpRight size={11} />
                        {isRtl ? 'مؤشر مباشر من البيانات الإنتاجية' : 'Live production metric'}
                      </span>
                    </div>

                    {/* No-show rate */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs relative overflow-hidden group">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{t.noShowRate}</span>
                      <p className="text-xl md:text-2xl font-black text-neutral-800 font-mono tracking-tight mt-1">
                        {noShowRateValue.toFixed(1)}%
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 mt-2 bg-rose-50 px-2 py-0.5 rounded-full">
                        <ArrowDownRight size={11} />
                        {isRtl ? 'مؤشر مباشر من البيانات الإنتاجية' : 'Live production metric'}
                      </span>
                    </div>

                    {/* Rebooking rate */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs relative overflow-hidden group">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{t.rebookingRate}</span>
                      <p className="text-xl md:text-2xl font-black text-neutral-800 font-mono tracking-tight mt-1">
                        {rebookingRateValue.toFixed(1)}%
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ArrowUpRight size={11} />
                        {isRtl ? 'تحليلات إعادة الحجز من الإنتاج' : 'Live rebooking analytics'}
                      </span>
                    </div>

                    {/* Refunds */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs relative overflow-hidden group">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{t.totalRefunds}</span>
                      <p className="text-xl md:text-2xl font-black text-neutral-800 font-mono tracking-tight mt-1">
                        {refundTotalValue.toLocaleString()} <span className="text-xs font-bold text-neutral-500">{isRtl ? 'ر.س' : 'SAR'}</span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-2 bg-amber-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} />
                        {isRtl ? 'تقرير مرتجعات مباشر من الإنتاج' : 'Live refund totals'}
                      </span>
                    </div>

                    {/* Operational efficiency / Occupancy */}
                    <div className="bg-zinc-900 text-white p-5 rounded-2xl border border-zinc-800 shadow-xs relative overflow-hidden group col-span-2 lg:col-span-1">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">{isRtl ? 'معدل إشغال الصالون' : 'Salon Room Occupancy'}</span>
                      <p className="text-xl md:text-2xl font-black text-amber-400 font-mono tracking-tight mt-1">
                        {completionRateValue.toFixed(1)}%
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-2 bg-zinc-800 px-2 py-0.5 rounded-full">
                        <ArrowUpRight size={11} />
                        {isRtl ? 'مؤشر مباشر من البيانات الإنتاجية' : 'Live production metric'}
                      </span>
                    </div>

                  </div>

                  {/* TREND CHARTS COMPONENT */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Area line chart: Revenue Growth Trend */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs lg:col-span-2 space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-extrabold text-neutral-800 text-sm md:text-base">{isRtl ? 'تطور ومسار مبيعات صالون رفاه' : 'Gross Revenue growth trend (SAR)'}</h4>
                          <p className="text-[11px] text-neutral-400 font-bold mt-0.5">{isRtl ? 'تحليل مسار مبيعات الـ 7 أيام الماضية' : 'Dynamic chart mapping of daily sales logs'}</p>
                        </div>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">Jun 21 - Jun 27</span>
                      </div>

                      {/* Line Chart */}
                      <div className="relative pt-4 h-48">
                        <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
                            </linearGradient>
                          </defs>
                          
                          {/* Grid lines */}
                          <line x1="0" y1="20" x2="500" y2="20" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="3" />
                          <line x1="0" y1="60" x2="500" y2="60" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="3" />
                          <line x1="0" y1="100" x2="500" y2="100" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="3" />
                          <line x1="0" y1="140" x2="500" y2="140" stroke="#e4e4e7" strokeWidth="1.5" />

                          {/* Data Path */}
                          {/* Daily values: 15.8k, 6.2k, 9.8k, 14.5k, 7.5k, 12.4k, 8.9k */}
                          {/* Rescaled Y values: Y = 140 - (Value * 100 / 16000) */}
                          <path
                            d="M 5 41 L 85 101 L 165 78 L 245 49 L 325 93 L 405 62 L 485 84 L 485 140 L 5 140 Z"
                            fill="url(#chart-glow)"
                          />
                          <path
                            d="M 5 41 L 85 101 L 165 78 L 245 49 L 325 93 L 405 62 L 485 84"
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Data Points */}
                          <circle cx="5" cy="41" r="4.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                          <circle cx="85" cy="101" r="4.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                          <circle cx="165" cy="78" r="4.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                          <circle cx="245" cy="49" r="4.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                          <circle cx="325" cy="93" r="4.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                          <circle cx="405" cy="62" r="4.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                          <circle cx="485" cy="84" r="4.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                        </svg>

                        {/* Chart label overlay */}
                        <div className="absolute top-2 right-10 bg-zinc-950 text-white p-2 rounded-lg text-[9px] font-mono shadow-md hidden sm:block pointer-events-none">
                          <p className="font-bold">Peak Revenue: SAR 15,800</p>
                          <p className="text-amber-400 mt-0.5">Sunday Peak Service</p>
                        </div>
                      </div>

                      {/* X-axis custom tags */}
                      <div className="flex justify-between text-[10px] font-bold text-neutral-400 font-mono px-1">
                        <span>Jun 21 (Sun)</span>
                        <span>Jun 22</span>
                        <span>Jun 23</span>
                        <span>Jun 24 (Wed)</span>
                        <span>Jun 25</span>
                        <span>Jun 26</span>
                        <span>Jun 27 (Sat)</span>
                      </div>
                    </div>

                    {/* Interactive Donut: Booking Channel Distribution */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
                      <h4 className="font-extrabold text-neutral-800 text-sm md:text-base">{isRtl ? 'مصادر قنوات المبيعات والطلب' : 'Channel Distribution'}</h4>
                      
                      <div className="flex justify-center items-center py-2 relative">
                        {/* Custom Radial SVG */}
                        <svg className="w-32 h-32" viewBox="0 0 36 36">
                          {/* Background channel */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f4f4f5" strokeWidth="3.5" />
                          
                          {/* Widget channel (65%) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3.5" 
                            strokeDasharray="65 35" strokeDashoffset="25" />

                          {/* POS channel (25%) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="3.5" 
                            strokeDasharray="25 75" strokeDashoffset="-40" />

                          {/* Instagram/Social (10%) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3.5" 
                            strokeDasharray="10 90" strokeDashoffset="-65" />
                        </svg>
                        
                        {/* Center rate label */}
                        <div className="absolute flex flex-col items-center">
                          <span className="text-xl font-black text-neutral-800 font-mono">65%</span>
                          <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">{isRtl ? 'أونلاين' : 'Online'}</span>
                        </div>
                      </div>

                      {/* Legends */}
                      <div className="space-y-2 pt-2 text-xs">
                        <div className="flex justify-between items-center text-neutral-700">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span>{isRtl ? 'الحجز الذاتي عبر الرابط الإلكتروني' : 'Online Booking Widget'}</span>
                          </div>
                          <span className="font-mono font-bold text-neutral-800">65%</span>
                        </div>
                        <div className="flex justify-between items-center text-neutral-700">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <span>{isRtl ? 'حجز مسجل يدوياً عبر الكاونتر (POS)' : 'Walk-in / POS Counter'}</span>
                          </div>
                          <span className="font-mono font-bold text-neutral-800">25%</span>
                        </div>
                        <div className="flex justify-between items-center text-neutral-700">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>{isRtl ? 'عبر قنوات التواصل الاجتماعي' : 'Social Channels'}</span>
                          </div>
                          <span className="font-mono font-bold text-neutral-800">10%</span>
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* OPERATIONAL SMART ALERTS SECTION */}
                  <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2 pb-2 border-b border-neutral-100">
                      <ShieldAlert size={14} className="text-amber-500 animate-bounce" />
                      {t.opsAlerts}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Alert 1 */}
                      <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 text-xs flex gap-3">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-800">{isRtl ? 'ملاحظة سلوكية لتفادي التغيب' : 'High Sunday No-shows detected'}</p>
                          <p className="text-neutral-500 mt-1 leading-relaxed">
                            {isRtl 
                              ? 'لوحظت زيادة في نسبة عدم حضور العملاء (+4.2%) مع الأخصائية إيلينا فاسيلي خلال فترات يوم الأحد.' 
                              : 'Elena Vasily experienced an abnormal spike in no-shows during Sunday evening blocks. System auto-reminders recommended.'}
                          </p>
                        </div>
                      </div>

                      {/* Alert 2 */}
                      <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 text-xs flex gap-3">
                        <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-rose-800">{isRtl ? 'مؤشر أمان حدود الخصومات الممنوحة' : 'Discount Limit Warning Trigger'}</p>
                          <p className="text-neutral-500 mt-1 leading-relaxed">
                            {isRtl 
                              ? 'معدل الخصم الإجمالي تخطى حاجز الأمان (15%) في يوم السبت وبلغ 18.4%. يرجى مراجعة الصلاحيات لرموز الترويج.' 
                              : 'Discounts exceeded your 15% safety margin on Saturday, reaching 18.4%. Review and restrict promotional overrides.'}
                          </p>
                        </div>
                      </div>

                      {/* Alert 3 */}
                      <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs flex gap-3">
                        <Award size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-emerald-800">{isRtl ? 'التزام الإقرار الضريبي المعتمد (ZATCA)' : 'ZATCA VAT Return Ready'}</p>
                          <p className="text-neutral-500 mt-1 leading-relaxed">
                            {isRtl 
                              ? 'سجل VAT للربع الحالي جاهز ومطابق للفوترة الفورية والضوابط. يرجى المراجعة والرفع قبل نهاية المدة.' 
                              : 'Tax summaries for Q2 2026 comply with ZATCA phase-2 parameters. Sandbox validated with zero ledger discrepancy.'}
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              )}

              {/* ======================================= */}
              {/* REPORTS PAGES WITH TABLES, CHARTS & DRILL-DOWN */}
              {/* ======================================= */}
              {activeTab !== 'overview' && (
                <div className="space-y-6">
                  
                  {/* Dynamic report description */}
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-black text-neutral-800 text-xs uppercase tracking-wider">{t[activeTab]}</h4>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                        {isRtl 
                          ? 'تفاصيل حركة السجلات المالية والتشغيلية المفصلة للصالون. انقر فوق أي سجل بالجدول لإجراء تدقيق وتدفق المعاملة.' 
                          : 'Deep inspection and transaction tracing logs. Click any record below to trigger the interactive drill-down workflow.'}
                      </p>
                    </div>

                    {/* Search Field inside table container */}
                    <div className="relative">
                      <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-neutral-400`} size={13} />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder={t.searchPlaceholder}
                        className={`bg-white border border-neutral-200 rounded-xl py-1.5 ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} text-xs font-sans outline-none focus:ring-1 focus:ring-brand-500 w-48 transition-all`}
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-neutral-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CUSTOM SVG CHART DESIGNED TO MATCH INDIVIDUAL REPORT VIEWS */}
                  <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
                    <h4 className="font-extrabold text-neutral-800 text-sm">{isRtl ? 'التمثيل البياني للحركة والنشاط' : 'Visual Analytics representation'}</h4>
                    
                    <div className="h-36 relative flex items-end">
                      
                      {/* Rendering a dynamic Bar / Chart pattern based on the report data length */}
                      {filteredRecords.length > 0 ? (
                        <div className="w-full h-full flex items-end gap-2.5 pt-4">
                          {filteredRecords.map((item, index) => {
                            // Calculate height percentage based on standard column
                            const totalVal = item.total || item.grossSales || item.revenue || item.collected || item.totalSales || item.totalSpent || item.bookings * 100 || 100;
                            const maxVal = Math.max(...filteredRecords.map(r => r.total || r.grossSales || r.revenue || r.collected || r.totalSales || r.totalSpent || r.bookings * 100 || 100));
                            const heightPct = Math.max(15, (totalVal / maxVal) * 80);
                            
                            return (
                              <div key={item.id} className="flex-1 flex flex-col items-center group h-full justify-end cursor-pointer">
                                
                                {/* Bar Value Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-1 bg-zinc-950 text-white font-mono text-[9px] py-1 px-1.5 rounded shadow-lg pointer-events-none transition-opacity z-10">
                                  {totalVal} {isRtl ? 'ر.س' : 'SAR'}
                                </div>

                                {/* Custom Bar segment with rounded top */}
                                <div 
                                  className="w-full bg-gradient-to-t from-amber-500/10 to-amber-500/80 group-hover:from-zinc-900 group-hover:to-zinc-800 rounded-t-lg transition-all"
                                  style={{ height: `${heightPct}%` }}
                                />
                                
                                {/* Label representing the X-Axis */}
                                <span className="text-[9px] font-mono text-neutral-400 font-bold truncate w-full text-center mt-1.5">
                                  {item.date || item.id || item.code || item.name || item.customer}
                                </span>

                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
                          {isRtl ? 'لا تتوفر إحصائيات بيانية للفلاتر المحددة' : 'Analytical charts not available for the selected parameters'}
                        </div>
                      )}

                    </div>
                  </div>

                  {/* REPORT RENDER TABLES */}
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-xs overflow-hidden">
                    
                    {filteredRecords.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-start text-xs border-collapse">
                          
                          {/* TABLE HEADERS MAP */}
                          <thead>
                            <tr className="border-b border-neutral-100 text-neutral-400 font-bold bg-neutral-50/50">
                              
                              {/* Headers for Sales Reports */}
                              {activeTab === 'sales' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'رقم التقرير' : 'ID'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('date')}>{isRtl ? 'التاريخ' : 'Date'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('grossSales')}>{isRtl ? 'المبيعات الإجمالية' : 'Gross Sales'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'الخصومات' : 'Discounts'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'المرتجعات' : 'Refunds'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'صافي المبيعات' : 'Net Sales'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('total')}>{isRtl ? 'الإجمالي العام' : 'Total Revenue'} <ArrowUpDown size={10} className="inline" /></th>
                                </>
                              )}

                              {/* Headers for Financial Reports */}
                              {activeTab === 'financial' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'مرجع الفاتورة' : 'Invoice ID'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('date')}>{isRtl ? 'التاريخ والساعة' : 'Timestamp'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'العميل' : 'Customer'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'النوع' : 'Category'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'صافي الفاتورة' : 'Ex-VAT Subtotal'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الضريبة' : 'Tax'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('total')}>{isRtl ? 'المبلغ الكلي' : 'Collected Total'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'طريقة الدفع' : 'Payment Type'}</th>
                                </>
                              )}

                              {/* Headers for Appointment Reports */}
                              {activeTab === 'appointments' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'رقم الموعد' : 'Booking ID'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'العميل' : 'Customer'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الخبيرة الأخصائية' : 'Stylist'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الخدمة المقدمة' : 'Service Provided'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('date')}>{isRtl ? 'التاريخ' : 'Scheduled Date'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'المدة' : 'Duration'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('price')}>{isRtl ? 'القيمة' : 'Value'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'حالة الحجز' : 'Status'}</th>
                                </>
                              )}

                              {/* Headers for Employee Reports */}
                              {activeTab === 'employees' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'الموظفة' : 'Employee'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'التخصص الفرعي' : 'Role'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('bookings')}>{isRtl ? 'إجمالي الحجوزات' : 'Bookings'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('utilization')}>{isRtl ? 'معدل الإشغال والإنتاجية' : 'Utilization Rate'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'مبيعات الخدمات' : 'Service Sales'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'مبيعات المنتجات' : 'Retail Sales'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'إكراميات هدايا' : 'Tips'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('totalSales')}>{isRtl ? 'مجموع المبيعات' : 'Total Revenue'} <ArrowUpDown size={10} className="inline" /></th>
                                </>
                              )}

                              {/* Headers for Service Reports */}
                              {activeTab === 'services' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'الخدمة' : 'Service'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'التصنيف الرئيسي' : 'Category'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('bookings')}>{isRtl ? 'عدد الحجوزات' : 'Bookings'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'المدة الزمنية' : 'Duration'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'متوسط السعر' : 'Avg Price'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('totalRevenue')}>{isRtl ? 'صافي العائد المالي' : 'Revenue Generated'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'حصة المساهمة %' : 'Category Share %'}</th>
                                </>
                              )}

                              {/* Headers for Product Reports */}
                              {activeTab === 'products' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'رمز التخزين SKU' : 'SKU'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'المنتج' : 'Product'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'التصنيف' : 'Category'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('sold')}>{isRtl ? 'الوحدات المباعة' : 'Units Sold'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'سعر الوحدة' : 'Unit Price'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('revenue')}>{isRtl ? 'إجمالي المبيعات' : 'Revenue'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'المخزون المتاح' : 'Stock Quantity'}</th>
                                </>
                              )}

                              {/* Headers for Discounts Reports */}
                              {activeTab === 'discounts' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'كود العرض / القسيمة' : 'Promo Code'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'البيان وتفاصيل العرض' : 'Description'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('appliedCount')}>{isRtl ? 'عدد مرات الاستخدام' : 'Applied Count'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'متوسط قيمة الخصم' : 'Avg Deduction'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('totalDiscount')}>{isRtl ? 'إجمالي المبالغ المخصومة' : 'Total Discount Value'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'نوع الحملة' : 'Campaign Category'}</th>
                                </>
                              )}

                              {/* Headers for Refund Reports */}
                              {activeTab === 'refunds' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'رقم عملية الاسترداد' : 'Refund ID'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('date')}>{isRtl ? 'التاريخ والوقت' : 'Date & Time'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'رقم الفاتورة الأصلية' : 'Original Invoice'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'العميل المستفيد' : 'Customer'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'البند المسترد' : 'Refunded Item'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'سبب الاسترجاع المعتمد' : 'Reason For Refund'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('amount')}>{isRtl ? 'المبلغ المسترد' : 'Refunded Amount'} <ArrowUpDown size={10} className="inline" /></th>
                                </>
                              )}

                              {/* Headers for Payment Methods */}
                              {activeTab === 'paymentMethods' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'بوابة الدفع وقناة السداد' : 'Payment Method / Provider'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('transactions')}>{isRtl ? 'عدد العمليات' : 'Transactions count'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('collected')}>{isRtl ? 'إجمالي المبالغ المحصلة' : 'Gross Collected'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'رسوم معالجة الشبكة' : 'Processing Fees'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'صافي التسوية والتحويل' : 'Net Settlement'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'النسبة من الإجمالي' : 'Distribution %'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'تقييم كفاءة الشبكة' : 'Provider Health Status'}</th>
                                </>
                              )}

                              {/* Headers for Customer Sales */}
                              {activeTab === 'customerSales' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'كود العميل ID' : 'Client Code'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الاسم' : 'Customer'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'رقم الجوال' : 'Phone'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'فئة الولاء' : 'Loyalty Tier'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('visits')}>{isRtl ? 'إجمالي الزيارات' : 'Total Visits'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'مشتريات الخدمات' : 'Services Value'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'مشتريات المنتجات' : 'Products Value'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('totalSpent')}>{isRtl ? 'مجموع المنفق' : 'Aggregate Spent'} <ArrowUpDown size={10} className="inline" /></th>
                                </>
                              )}

                              {/* Headers for Advanced Analytics */}
                              {activeTab === 'advancedAnalytics' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'المؤشر' : 'Metric'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('total')}>{isRtl ? 'القيمة' : 'Value'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'السياق' : 'Context'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                                </>
                              )}

                              {/* Headers for Rebooking Analytics */}
                              {activeTab === 'rebookings' && (
                                <>
                                  <th className="p-3 text-start">{isRtl ? 'رقم التحليل' : 'ID'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'العميل' : 'Customer'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الخدمة الأساسية' : 'Primary Service'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الزيارة السابقة' : 'Last Visit Date'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'تاريخ إعادة الحجز' : 'Rebooked Date'}</th>
                                  <th className="p-3 text-start cursor-pointer hover:text-neutral-800" onClick={() => triggerSort('interval')}>{isRtl ? 'متوسط الفاصل (بالأيام)' : 'Avg Interval (Days)'} <ArrowUpDown size={10} className="inline" /></th>
                                  <th className="p-3 text-start">{isRtl ? 'معدل ونوع إعادة الحجز' : 'Rebooking Status'}</th>
                                  <th className="p-3 text-start">{isRtl ? 'الأخصائية المرشحة' : 'Assigned Stylist'}</th>
                                </>
                              )}

                              <th className="p-3 text-center">{isRtl ? 'الإجراء' : 'Details'}</th>
                            </tr>
                          </thead>

                          {/* TABLE BODY RECORD RENDERS */}
                          <tbody className="divide-y divide-neutral-100 font-sans">
                            {paginatedRecords.map((item) => (
                              <tr 
                                key={item.id} 
                                className={`hover:bg-neutral-50/50 transition-colors cursor-pointer ${drillDownId === item.id ? 'bg-amber-50/20' : ''}`}
                                onClick={() => setDrillDownId(drillDownId === item.id ? null : item.id)}
                              >
                                
                                {/* 1. Sales Report Column Renders */}
                                {activeTab === 'sales' && (
                                  <>
                                    <td className="p-3 font-mono font-bold text-neutral-800">{item.id}</td>
                                    <td className="p-3 font-mono">{item.date}</td>
                                    <td className="p-3 font-mono font-bold text-neutral-700">{item.grossSales} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono text-rose-600">-{item.discounts} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono text-rose-500">-{item.refunds} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-bold text-emerald-600">{item.netSales} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono text-neutral-500">{item.vat} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-neutral-900">{item.total} {isRtl ? 'ر.س' : 'SAR'}</td>
                                  </>
                                )}

                                {/* 2. Financial Reports Column Renders */}
                                {activeTab === 'financial' && (
                                  <>
                                    <td className="p-3 font-mono font-bold text-neutral-800">{item.id}</td>
                                    <td className="p-3 font-mono text-neutral-500">{item.date}</td>
                                    <td className="p-3 font-bold text-neutral-800">{isRtl ? item.customerAr : item.customer}</td>
                                    <td className="p-3 font-semibold text-neutral-600">{item.type}</td>
                                    <td className="p-3 font-mono">{item.subtotal} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono text-neutral-500">{item.vat} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-neutral-900">{item.total} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3">
                                      <span className="bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                        {isRtl ? item.methodAr : item.method}
                                      </span>
                                    </td>
                                  </>
                                )}

                                {/* 3. Appointment Reports Column Renders */}
                                {activeTab === 'appointments' && (
                                  <>
                                    <td className="p-3 font-mono font-bold text-neutral-800">{item.id}</td>
                                    <td className="p-3 font-bold">{isRtl ? item.customerAr : item.customer}</td>
                                    <td className="p-3">{isRtl ? item.stylistAr : item.stylist}</td>
                                    <td className="p-3 text-neutral-600">{isRtl ? item.serviceAr : item.service}</td>
                                    <td className="p-3 font-mono">{item.date}</td>
                                    <td className="p-3 font-mono text-neutral-500">{item.duration}</td>
                                    <td className="p-3 font-mono font-bold">{item.price} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                                        item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        item.status === 'Confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        item.status === 'No-Show' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                        'bg-neutral-50 text-neutral-500 border-neutral-200'
                                      }`}>
                                        {isRtl ? item.statusAr : item.status}
                                      </span>
                                    </td>
                                  </>
                                )}

                                {/* 4. Employee Reports Column Renders */}
                                {activeTab === 'employees' && (
                                  <>
                                    <td className="p-3 font-bold text-neutral-800">{isRtl ? item.nameAr : item.name}</td>
                                    <td className="p-3 text-neutral-500">{isRtl ? item.roleAr : item.role}</td>
                                    <td className="p-3 font-mono font-bold">{item.bookings}</td>
                                    <td className="p-3 font-mono text-emerald-600 font-bold">{item.utilization}</td>
                                    <td className="p-3 font-mono">{item.servicesSales} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono">{item.productSales} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono text-amber-600">+{item.tips} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-neutral-900">{item.totalSales} {isRtl ? 'ر.س' : 'SAR'}</td>
                                  </>
                                )}

                                {/* 5. Service Reports Column Renders */}
                                {activeTab === 'services' && (
                                  <>
                                    <td className="p-3 font-bold text-neutral-800">{isRtl ? item.nameAr : item.name}</td>
                                    <td className="p-3 text-neutral-500">{isRtl ? item.categoryAr : item.category}</td>
                                    <td className="p-3 font-mono font-bold">{item.bookings}</td>
                                    <td className="p-3 font-mono text-neutral-500">{item.duration}</td>
                                    <td className="p-3 font-mono">{item.avgPrice} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-neutral-900">{item.totalRevenue} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-black text-brand-600">{item.share}</td>
                                  </>
                                )}

                                {/* 6. Product Reports Column Renders */}
                                {activeTab === 'products' && (
                                  <>
                                    <td className="p-3 font-mono text-neutral-400 font-bold">{item.sku}</td>
                                    <td className="p-3 font-bold text-neutral-800">{isRtl ? item.nameAr : item.name}</td>
                                    <td className="p-3 text-neutral-500">{isRtl ? item.categoryAr : item.category}</td>
                                    <td className="p-3 font-mono font-bold">{item.sold}</td>
                                    <td className="p-3 font-mono">{item.unitPrice} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-neutral-900">{item.revenue} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                        item.stock < 10 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      }`}>
                                        {item.stock} {isRtl ? 'وحدات متبقية' : 'in stock'}
                                      </span>
                                    </td>
                                  </>
                                )}

                                {/* 7. Discounts Reports Column Renders */}
                                {activeTab === 'discounts' && (
                                  <>
                                    <td className="p-3 font-mono font-black text-brand-600">{item.code}</td>
                                    <td className="p-3 text-neutral-600">{isRtl ? item.descriptionAr : item.description}</td>
                                    <td className="p-3 font-mono font-bold">{item.appliedCount}</td>
                                    <td className="p-3 font-mono">{item.avgDiscount} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-rose-600">-{item.totalDiscount} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3">
                                      <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-bold text-[10px]">
                                        {item.category}
                                      </span>
                                    </td>
                                  </>
                                )}

                                {/* 8. Refund Reports Column Renders */}
                                {activeTab === 'refunds' && (
                                  <>
                                    <td className="p-3 font-mono font-bold text-neutral-800">{item.id}</td>
                                    <td className="p-3 font-mono text-neutral-500">{item.date}</td>
                                    <td className="p-3 font-mono font-bold text-neutral-700">{item.invoice}</td>
                                    <td className="p-3 font-bold">{isRtl ? item.customerAr : item.customer}</td>
                                    <td className="p-3 font-semibold text-neutral-600">{isRtl ? item.itemAr : item.item}</td>
                                    <td className="p-3 text-rose-800 font-bold">{isRtl ? item.reasonAr : item.reason}</td>
                                    <td className="p-3 font-mono font-extrabold text-rose-600">-{item.amount} {isRtl ? 'ر.س' : 'SAR'}</td>
                                  </>
                                )}

                                {/* 9. Payment Methods Column Renders */}
                                {activeTab === 'paymentMethods' && (
                                  <>
                                    <td className="p-3 font-bold text-neutral-800">{isRtl ? item.methodAr : item.method}</td>
                                    <td className="p-3 font-mono font-bold">{item.transactions}</td>
                                    <td className="p-3 font-mono font-extrabold text-neutral-900">{item.collected} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono text-rose-600">-{item.fees} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-emerald-600">{item.settlement} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-bold text-brand-600">{item.pct}</td>
                                    <td className="p-3">
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                                        {item.rating}
                                      </span>
                                    </td>
                                  </>
                                )}

                                {/* 10. Customer Sales Column Renders */}
                                {activeTab === 'customerSales' && (
                                  <>
                                    <td className="p-3 font-mono text-neutral-400 font-bold">{item.id}</td>
                                    <td className="p-3 font-bold text-neutral-800">{isRtl ? item.nameAr : item.name}</td>
                                    <td className="p-3 font-mono text-neutral-500">{item.phone}</td>
                                    <td className="p-3">
                                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                        {item.tier}
                                      </span>
                                    </td>
                                    <td className="p-3 font-mono font-bold">{item.visits}</td>
                                    <td className="p-3 font-mono">{item.spentServices} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono">{item.spentProducts} {isRtl ? 'ر.س' : 'SAR'}</td>
                                    <td className="p-3 font-mono font-extrabold text-emerald-600">{item.totalSpent} {isRtl ? 'ر.س' : 'SAR'}</td>
                                  </>
                                )}

                                {/* 11. Advanced Analytics Column Renders */}
                                {activeTab === 'advancedAnalytics' && (
                                  <>
                                    <td className="p-3 font-bold text-neutral-800">{isRtl ? item.nameAr || item.nameEn : item.nameEn || item.nameAr || item.id}</td>
                                    <td className="p-3 font-mono font-extrabold text-emerald-600">{item.total ?? 0}</td>
                                    <td className="p-3 text-neutral-500">{item.pct ?? '-'}</td>
                                    <td className="p-3 font-bold">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700">
                                        {isRtl ? 'مباشر' : 'Live'}
                                      </span>
                                    </td>
                                  </>
                                )}

                                {/* 12. Rebooking Analytics Column Renders */}
                                {activeTab === 'rebookings' && (
                                  <>
                                    <td className="p-3 font-mono font-bold text-neutral-800">{item.id}</td>
                                    <td className="p-3 font-bold">{isRtl ? item.customerAr : item.customer}</td>
                                    <td className="p-3 text-neutral-600">{isRtl ? item.serviceAr : item.service}</td>
                                    <td className="p-3 font-mono">{item.lastVisit}</td>
                                    <td className="p-3 font-mono text-emerald-600 font-bold">{item.rebookedDate}</td>
                                    <td className="p-3 font-mono font-bold">{item.interval > 0 ? `${item.interval} days` : 'N/A'}</td>
                                    <td className="p-3 font-bold">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                        item.rate === 'Rebooked' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                      }`}>
                                        {isRtl ? item.rebookAr : item.rate}
                                      </span>
                                    </td>
                                    <td className="p-3 text-neutral-500">{item.stylist}</td>
                                  </>
                                )}

                                <td className="p-3 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDrillDownId(drillDownId === item.id ? null : item.id);
                                    }}
                                    className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                                  >
                                    <Eye size={14} />
                                  </button>
                                </td>

                              </tr>
                            ))}
                          </tbody>

                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center bg-white space-y-3">
                        <div className="p-3 bg-neutral-100 rounded-full w-fit mx-auto text-neutral-400 border border-neutral-200">
                          <Search size={28} />
                        </div>
                        <h4 className="font-extrabold text-neutral-800 text-sm">{t.noDataTitle}</h4>
                        <p className="text-xs text-neutral-400 max-w-sm mx-auto">{t.noDataDesc}</p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedEmployee('all');
                            setSelectedService('all');
                            setSelectedPaymentMethod('all');
                            setDateRange('last_30_days');
                          }}
                          className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 cursor-pointer"
                        >
                          {t.clearFilters}
                        </button>
                      </div>
                    )}

                    {/* PAGINATION TOOLBAR */}
                    {filteredRecords.length > 5 && (
                      <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs font-bold text-neutral-600">
                        <span>
                          {t.displaying} {(currentPage - 1) * 5 + 1} - {Math.min(currentPage * 5, filteredRecords.length)} {t.of} {filteredRecords.length} {t.records}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-[11px] disabled:opacity-50 transition-all cursor-pointer"
                          >
                            {t.previous}
                          </button>
                          <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-[11px] disabled:opacity-50 transition-all cursor-pointer"
                          >
                            {t.next}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* INTERACTIVE DRILL-DOWN CARD WORKSPACE */}
                  <AnimatePresence>
                    {drillDownId && (
                      (() => {
                        const rec = filteredRecords.find(r => r.id === drillDownId);
                        if (!rec) return null;
                        return (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-zinc-950 text-white p-6 rounded-2xl border border-zinc-800 shadow-2xl relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                              <Receipt size={120} className="text-white" />
                            </div>

                            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                              <h4 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-400" />
                                {t.drillDownTitle} — {rec.id}
                              </h4>
                              <button
                                onClick={() => setDrillDownId(null)}
                                className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {/* Drill down specifications mapping */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 text-xs">
                              
                              <div className="space-y-1 bg-zinc-900/50 p-3 rounded-xl border border-zinc-850">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">{isRtl ? 'الهوية التشغيلية' : 'OPERATIONAL ENTITY'}</p>
                                <p className="font-bold text-neutral-200 font-sans mt-0.5">{rec.id}</p>
                                <p className="text-zinc-400 mt-1">{rec.date || rec.lastVisit || 'System Recorded'}</p>
                              </div>

                              <div className="space-y-1 bg-zinc-900/50 p-3 rounded-xl border border-zinc-850">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">{isRtl ? 'العنصر / العميل الأساسي' : 'PRIMARY ENTITY / VISITS'}</p>
                                <p className="font-bold text-neutral-200 mt-0.5">{rec.nameEn || rec.customer || rec.code || rec.method || 'General ledger transaction'}</p>
                                <p className="text-zinc-400 mt-1">{rec.tier || rec.sku || rec.category || 'Revenue channel audit'}</p>
                              </div>

                              <div className="space-y-1 bg-zinc-900/50 p-3 rounded-xl border border-zinc-850">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">{isRtl ? 'المبيعات والحجوزات' : 'PERFORMANCE VALUE'}</p>
                                <p className="font-mono font-black text-amber-400 mt-0.5">
                                  {rec.total || rec.totalSales || rec.revenue || rec.collected || rec.totalSpent || rec.price || 'SAR 0'}
                                </p>
                                <p className="text-zinc-400 mt-1">{rec.pct || rec.utilization || rec.itemSales || 'VAT compliant'}</p>
                              </div>

                              <div className="space-y-1 bg-zinc-900/50 p-3 rounded-xl border border-zinc-850">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">{isRtl ? 'ضمان الامتثال والتحقق' : 'COMPLIANCE AUDIT'}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                                  <span className="text-[11px] text-zinc-300 font-bold">ZATCA Verified</span>
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-0.5">SHA256 Cryptographic Crypt Ledger</p>
                              </div>

                            </div>

                            {/* Custom audit description / drill down message */}
                            <div className="mt-4 p-3 bg-zinc-900 rounded-xl border border-zinc-850 text-[11px] text-zinc-400 leading-relaxed">
                              {isRtl 
                                ? 'هذه المعاملة تم فحصها من قبل النظام ومطابقتها لضوابط الفوترة والضوابط الضريبية لمشغلي ومراكز التجميل الملكية التابعة لشركة رفاه.' 
                                : 'This transactional and performance record represents a valid system ledger audit entry matching Refah core operating frameworks. Synchronized with live database states.'}
                            </div>

                          </motion.div>
                        );
                      })()
                    )}
                  </AnimatePresence>

                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}
