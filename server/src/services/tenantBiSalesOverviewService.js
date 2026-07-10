function buildGroupedRevenue(rows = [], keyField, revenueField = 'revenue', countField = null) {
    const buckets = new Map();

    rows.forEach((row) => {
        const key = `${row?.[keyField] || 'Uncategorized'}`.trim() || 'Uncategorized';
        const existing = buckets.get(key) || {
            key,
            revenue: 0,
            count: 0
        };

        existing.revenue += Number(row?.[revenueField] || 0);
        if (countField) {
            existing.count += Number(row?.[countField] || 0);
        } else {
            existing.count += 1;
        }
        buckets.set(key, existing);
    });

    return Array.from(buckets.values())
        .map((row) => ({
            ...row,
            revenue: Number(row.revenue.toFixed(2))
        }))
        .sort((left, right) => right.revenue - left.revenue);
}

function buildSalesOverviewPayload(result, startDate, endDate, sections = []) {
    const overview = result.overview || {};
    const financialLedger = result.financialLedger || {};
    const revenueLedger = financialLedger.revenueLedger || {};
    const paymentLedger = financialLedger.paymentLedger || {};
    const refundLedger = financialLedger.refundLedger || {};
    const commissionLedger = financialLedger.commissionLedger || {};
    const settlementLedger = financialLedger.settlementLedger || {};
    const customerAnalytics = result.customerAnalytics || {};
    const customerSales = Array.isArray(result.customerSales) ? result.customerSales : [];
    const dailyRevenue = Array.isArray(result.dailyRevenue) ? result.dailyRevenue : [];
    const bookingTrends = Array.isArray(result.bookingTrends) ? result.bookingTrends : [];
    const paymentMethods = result.paymentMethods || {};
    const employees = Array.isArray(result.employees) ? result.employees : [];
    const employeePerformance = Array.isArray(result.employeePerformance) ? result.employeePerformance : [];
    const services = Array.isArray(result.services) ? result.services : [];
    const servicePerformance = Array.isArray(result.servicePerformance) ? result.servicePerformance : [];
    const products = Array.isArray(result.products) ? result.products : [];
    const productTotals = result.productTotals || {};
    const advancedAnalytics = result.advancedAnalytics || {};
    const customerCohorts = advancedAnalytics.customerCohorts || null;
    const paymentMethodTrends = advancedAnalytics.paymentMethodTrends || paymentMethods.trend || [];
    const refundTrends = advancedAnalytics.refundTrends || result.refunds || null;
    const rebookingAnalytics = advancedAnalytics.rebookingAnalytics || result.rebookings || null;

    const revenueLedgerRows = Array.isArray(revenueLedger.rows) ? revenueLedger.rows : [];
    const paymentLedgerRows = Array.isArray(paymentLedger.rows) ? paymentLedger.rows : [];
    const refundLedgerRows = Array.isArray(refundLedger.rows) ? refundLedger.rows : [];
    const commissionLedgerRows = Array.isArray(commissionLedger.rows) ? commissionLedger.rows : [];
    const settlementLedgerRows = Array.isArray(settlementLedger.rows) ? settlementLedger.rows : [];

    const topCustomer = Array.isArray(customerAnalytics.topCustomers) && customerAnalytics.topCustomers.length
        ? customerAnalytics.topCustomers[0]
        : null;
    const topEmployee = employeePerformance.length ? employeePerformance[0] : employees[0] || null;
    const topService = servicePerformance.length ? servicePerformance[0] : services[0] || null;
    const topProduct = products.length ? products[0] : null;
    const highestSale = revenueLedgerRows.reduce((best, row) => {
        if (!best) return row;
        return Number(row?.revenue || 0) > Number(best?.revenue || 0) ? row : best;
    }, null);

    const averageSale = Number.isFinite(Number(revenueLedger?.totals?.revenue))
        && Number(revenueLedger?.totals?.totalRows || revenueLedgerRows.length) > 0
        ? Number((Number(revenueLedger.totals.revenue) / Number(revenueLedger.totals.totalRows || revenueLedgerRows.length)).toFixed(2))
        : null;
    const averageVat = Number.isFinite(Number(revenueLedger?.totals?.tax))
        && Number(revenueLedger?.totals?.totalRows || revenueLedgerRows.length) > 0
        ? Number((Number(revenueLedger.totals.tax) / Number(revenueLedger.totals.totalRows || revenueLedgerRows.length)).toFixed(2))
        : null;
    const averageBasketSize = Number.isFinite(Number(productTotals.totalQuantity))
        && Number.isFinite(Number(productTotals.totalOrders))
        && Number(productTotals.totalOrders) > 0
        ? Number((Number(productTotals.totalQuantity) / Number(productTotals.totalOrders)).toFixed(2))
        : null;

    const revenueByCategory = buildGroupedRevenue(
        servicePerformance.length ? servicePerformance : services,
        'category',
        servicePerformance.length ? 'revenue' : 'totalRevenue'
    );
    const revenueByCustomerType = buildGroupedRevenue(customerSales, 'customerType', 'revenue');
    const customerGrowth = customerCohorts?.rows || [];

    const walkInCustomers = customerSales.filter((row) => row.customerType === 'walk_in_customer').length;
    const completedSales = revenueLedgerRows.filter((row) => `${row.status || ''}`.toLowerCase() === 'completed').length;
    const cancelledSales = Number(overview.cancelledBookings || 0);
    const salesCount = Number(revenueLedger?.totals?.totalRows || revenueLedgerRows.length);
    const collectedAmount = Number.isFinite(Number(financialLedger?.overview?.netCollected))
        ? Number(financialLedger.overview.netCollected)
        : Number(overview.totalRevenue || 0);
    const outstandingAmount = Number(overview.pendingPayments || 0);
    const averageAppointmentValue = Number(overview.avgBookingValue || 0);
    const averageDiscount = Number(overview.discountTotals?.averageDiscountAmount || 0);

    return {
        summary: {
            overview,
            ledger: financialLedger.overview || null,
            dateRange: financialLedger.dateRange || {
                startDate: startDate || null,
                endDate: endDate || null
            }
        },
        kpis: {
            revenue: {
                totalRevenue: Number(overview.totalRevenue || 0),
                netRevenue: Number(overview.netRevenue || 0),
                totalTax: Number(overview.totalTax || 0),
                totalDiscountAmount: Number(overview.totalDiscountAmount || 0),
                totalPlatformFees: Number(overview.totalPlatformFees || 0),
                totalTenantRevenue: Number(overview.totalTenantRevenue || 0)
            },
            sales: {
                salesCount,
                completedSales,
                cancelledSales,
                noShowBookings: Number(overview.noShowBookings || 0),
                completionRate: Number(overview.completionRate || 0),
                averageTicket: averageAppointmentValue,
                averageSale,
                averageVat,
                averageDiscount,
                averageBasketSize
            },
            customers: {
                uniqueCustomers: Number(overview.uniqueCustomers || 0),
                newCustomers: Number(customerAnalytics.newCustomers || customerCohorts?.totals?.newCustomers || 0),
                returningCustomers: Number(customerAnalytics.returningCustomers || customerCohorts?.totals?.returningCustomers || 0),
                walkInCustomers,
                repeatRate: Number(customerAnalytics.retentionRate || 0)
            },
            collections: {
                collectedAmount,
                outstandingAmount,
                totalTransactions: Number(financialLedger?.overview?.totalTransactions || revenueLedgerRows.length),
                paymentMethods: paymentMethods.totals || null
            },
            top: {
                topCustomer,
                topEmployee,
                topService,
                topProduct,
                highestSale
            },
            missing: [
                !Array.isArray(dailyRevenue) || dailyRevenue.length === 0 ? 'dailyRevenue' : null,
                !Array.isArray(bookingTrends) || bookingTrends.length === 0 ? 'bookingTrends' : null,
                !paymentMethodTrends || (Array.isArray(paymentMethodTrends) && paymentMethodTrends.length === 0) ? 'paymentMethodTrends' : null,
                !Array.isArray(revenueLedgerRows) || revenueLedgerRows.length === 0 ? 'financialLedger' : null
            ].filter(Boolean)
        },
        charts: {
            revenueByDay: dailyRevenue,
            bookingTrends,
            paymentMethodTrends,
            revenueByEmployee: employeePerformance.length ? employeePerformance : employees,
            revenueByService: servicePerformance.length ? servicePerformance : services,
            revenueByCategory,
            revenueByCustomerType,
            customerGrowth,
            refunds: refundTrends,
            rebookings: rebookingAnalytics
        },
        paymentMethods: {
            rows: paymentMethods.rows || [],
            trend: paymentMethods.trend || [],
            totals: paymentMethods.totals || null
        },
        customers: {
            analytics: customerAnalytics,
            sales: customerSales,
            growth: customerGrowth
        },
        employees: {
            revenue: employees,
            performance: employeePerformance,
            totals: result.employeeTotals || null
        },
        services: {
            revenue: services,
            performance: servicePerformance,
            totals: result.serviceTotals || null
        },
        sales: {
            dailyRevenue,
            bookingTrends,
            refunds: result.refunds || null,
            rebookings: result.rebookings || null,
            advancedAnalytics,
            productRevenue: products,
            productTotals,
            finance: financialLedger.overview || null
        },
        table: {
            revenueLedger: {
                rows: revenueLedgerRows,
                totals: revenueLedger.totals || null
            },
            paymentLedger: {
                rows: paymentLedgerRows,
                totals: paymentLedger.totals || null
            },
            refundLedger: {
                rows: refundLedgerRows,
                totals: refundLedger.totals || null
            },
            commissionLedger: {
                rows: commissionLedgerRows,
                totals: commissionLedger.totals || null
            },
            settlementLedger: {
                rows: settlementLedgerRows,
                totals: settlementLedger.totals || null
            }
        },
        metadata: {
            generatedAt: new Date().toISOString(),
            dateRange: {
                startDate: startDate || financialLedger.dateRange?.startDate || null,
                endDate: endDate || financialLedger.dateRange?.endDate || null
            },
            sourceSections: sections,
            sourceEndpoints: [
                '/tenant/financial/overview',
                '/tenant/financial/daily',
                '/tenant/financial/ledger',
                '/tenant/financial/products',
                '/tenant/reports/booking-trends',
                '/tenant/reports/service-performance',
                '/tenant/reports/employee-performance',
                '/tenant/reports/customer-analytics',
                '/tenant/reports/payment-methods',
                '/tenant/reports/advanced-analytics'
            ]
        }
    };
}

module.exports = {
    buildSalesOverviewPayload,
    buildGroupedRevenue
};
