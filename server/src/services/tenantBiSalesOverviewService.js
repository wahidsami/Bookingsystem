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

function buildSalesOverviewPayload(result, startDate, endDate) {
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
    const operationalAlerts = advancedAnalytics.operationalAlerts || [];

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

    const totalRows = Number(revenueLedger?.totals?.totalRows || revenueLedgerRows.length);
    const averageSale = totalRows > 0 && Number.isFinite(Number(revenueLedger?.totals?.revenue))
        ? Number((Number(revenueLedger.totals.revenue) / totalRows).toFixed(2))
        : null;
    const averageVat = totalRows > 0 && Number.isFinite(Number(revenueLedger?.totals?.tax))
        ? Number((Number(revenueLedger.totals.tax) / totalRows).toFixed(2))
        : null;
    const averageBasketSize = Number.isFinite(Number(productTotals.totalOrders)) && Number(productTotals.totalOrders) > 0
        ? Number((Number(productTotals.totalQuantity || 0) / Number(productTotals.totalOrders)).toFixed(2))
        : null;

    const revenueByCategory = buildGroupedRevenue(
        servicePerformance.length ? servicePerformance : services,
        'category',
        servicePerformance.length ? 'revenue' : 'totalRevenue'
    );
    const revenueByCustomerType = buildGroupedRevenue(customerSales, 'customerType', 'revenue');
    const customerGrowth = customerCohorts?.rows || [];
    const walkInCustomers = customerSales.filter((row) => row.customerType === 'walk_in_customer').length;
    const collectedAmount = Number.isFinite(Number(financialLedger?.overview?.netCollected))
        ? Number(financialLedger.overview.netCollected)
        : Number(overview.totalRevenue || 0);
    const outstandingAmount = Number(overview.pendingPayments || 0);

    const financeOverview = {
        revenue: Number(overview.totalRevenue || 0),
        netRevenue: Number(overview.netRevenue || 0),
        tax: Number(overview.totalTax || 0),
        discount: Number(overview.totalDiscountAmount || 0),
        platformFees: Number(overview.totalPlatformFees || 0),
        tenantRevenue: Number(overview.totalTenantRevenue || 0),
        collectedAmount,
        outstandingAmount
    };

    const salesTotals = {
        salesCount: totalRows,
        completedSales: revenueLedgerRows.filter((row) => `${row.status || ''}`.toLowerCase() === 'completed').length,
        cancelledSales: Number(overview.cancelledBookings || 0),
        noShowBookings: Number(overview.noShowBookings || 0),
        completionRate: Number(overview.completionRate || 0),
        averageTicket: Number(overview.avgBookingValue || 0),
        averageSale,
        averageVat,
        averageDiscount: Number(overview.discountTotals?.averageDiscountAmount || 0),
        averageBasketSize
    };

    const summaryDateRange = financialLedger.dateRange || {
        startDate: startDate || null,
        endDate: endDate || null
    };

    return {
        summary: {
            dateRange: summaryDateRange,
            totals: financeOverview,
            metrics: {
                salesCount: salesTotals.salesCount,
                completionRate: salesTotals.completionRate,
                averageTicket: salesTotals.averageTicket,
                uniqueCustomers: Number(overview.uniqueCustomers || 0),
                repeatRate: Number(customerAnalytics.retentionRate || 0)
            }
        },
        sales: {
            totals: salesTotals,
            trends: {
                dailyRevenue,
                bookingTrends,
                revenueByDay: dailyRevenue,
                revenueByCategory,
                revenueByCustomerType
            },
            ledger: {
                revenueLedger: {
                    rows: revenueLedgerRows,
                    totals: revenueLedger.totals || null
                }
            }
        },
        customers: {
            analytics: customerAnalytics,
            sales: customerSales,
            growth: customerGrowth,
            topCustomer,
            cohorts: customerCohorts,
            walkInCustomers
        },
        employees: {
            revenue: employees,
            performance: employeePerformance,
            totals: result.employeeTotals || null,
            topEmployee
        },
        services: {
            revenue: services,
            performance: servicePerformance,
            totals: result.serviceTotals || null,
            topService
        },
        products: {
            revenue: products,
            totals: productTotals,
            topProduct
        },
        payments: {
            methods: {
                rows: paymentMethods.rows || [],
                trend: paymentMethods.trend || [],
                totals: paymentMethods.totals || null
            },
            ledger: {
                paymentLedger: {
                    rows: paymentLedgerRows,
                    totals: paymentLedger.totals || null
                },
                refundLedger: {
                    rows: refundLedgerRows,
                    totals: refundLedger.totals || null
                }
            },
            collections: {
                collectedAmount,
                outstandingAmount,
                totalTransactions: Number(financialLedger?.overview?.totalTransactions || revenueLedgerRows.length)
            }
        },
        finance: {
            overview: financeOverview,
            ledger: {
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
            refunds: refundTrends,
            commissions: {
                ledger: commissionLedgerRows,
                totals: commissionLedger.totals || null
            },
            settlements: {
                ledger: settlementLedgerRows,
                totals: settlementLedger.totals || null
            }
        },
        performance: {
            dailyRevenue,
            bookingTrends,
            paymentMethodTrends,
            revenueByCategory,
            revenueByCustomerType,
            customerGrowth,
            refunds: refundTrends,
            rebookings: rebookingAnalytics,
            operationalAlerts
        },
        executive: {
            topCustomer,
            topEmployee,
            topService,
            topProduct,
            highestSale,
            alerts: operationalAlerts
        },
        metadata: {
            generatedAt: new Date().toISOString(),
            dateRange: summaryDateRange
        }
    };
}

module.exports = {
    buildSalesOverviewPayload,
    buildGroupedRevenue
};
