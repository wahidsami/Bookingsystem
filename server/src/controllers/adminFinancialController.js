const { Op } = require('sequelize');
const db = require('../models');
const FinancialService = require('../services/financialService');
const { successResponse, errorResponse } = require('../utils/responses');

/**
 * Admin Financial Controller
 * Handles all financial reporting endpoints
 */

exports.getPlatformSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await FinancialService.getPlatformSummary(startDate, endDate);
    res.json(successResponse('Platform summary retrieved', summary));
  } catch (error) {
    console.error('Error fetching platform summary:', error);
    res.status(500).json(errorResponse('Failed to fetch platform summary', error.message));
  }
};

exports.getTenantFinancials = async (req, res) => {
  try {
    const { tenantId, startDate, endDate } = req.query;
    const financials = await FinancialService.getTenantFinancials(tenantId, startDate, endDate);
    res.json(successResponse('Tenant financials retrieved', financials));
  } catch (error) {
    console.error('Error fetching tenant financials:', error);
    res.status(500).json(errorResponse('Failed to fetch tenant financials', error.message));
  }
};

exports.getTenantLeaderboard = async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    const leaderboard = await FinancialService.getTenantLeaderboard(
      parseInt(limit),
      startDate,
      endDate
    );
    res.json(successResponse('Tenant leaderboard retrieved', leaderboard));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json(errorResponse('Failed to fetch leaderboard', error.message));
  }
};

exports.getTenantEmployeeMetrics = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.query.tenantId;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json(errorResponse('tenantId is required'));
    }

    const metrics = await FinancialService.getTenantEmployeeMetrics(
      tenantId,
      startDate,
      endDate
    );
    res.json(successResponse('Employee metrics retrieved', metrics));
  } catch (error) {
    console.error('Error fetching employee metrics:', error);
    res.status(500).json(errorResponse('Failed to fetch employee metrics', error.message));
  }
};

exports.getMonthlyComparison = async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const comparison = await FinancialService.getMonthlyComparison(parseInt(limit));
    res.json(successResponse('Monthly comparison retrieved', comparison));
  } catch (error) {
    console.error('Error fetching monthly comparison:', error);
    res.status(500).json(errorResponse('Failed to fetch monthly comparison', error.message));
  }
};

exports.getCommissionByPlan = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const breakdown = await FinancialService.getCommissionByPlan(startDate, endDate);
    res.json(successResponse('Commission breakdown retrieved', breakdown));
  } catch (error) {
    console.error('Error fetching commission breakdown:', error);
    res.status(500).json(errorResponse('Failed to fetch commission breakdown', error.message));
  }
};

exports.getRevenueByType = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await FinancialService.getRevenueByType(startDate, endDate);
    res.json(successResponse('Revenue by type retrieved', data));
  } catch (error) {
    console.error('Error fetching revenue by type:', error);
    res.status(500).json(errorResponse('Failed to fetch revenue by type', error.message));
  }
};

exports.getBillsSummary = async (req, res) => {
  try {
    const { status } = req.query;
    const data = await FinancialService.getBillsSummary(status || null);
    res.json(successResponse('Bills summary retrieved', data));
  } catch (error) {
    console.error('Error fetching bills summary:', error);
    res.status(500).json(errorResponse('Failed to fetch bills summary', error.message));
  }
};

exports.getCommissionByPackage = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await FinancialService.getCommissionByPackage(startDate, endDate);
    res.json(successResponse('Commission by package retrieved', data));
  } catch (error) {
    console.error('Error fetching commission by package:', error);
    res.status(500).json(errorResponse('Failed to fetch commission by package', error.message));
  }
};

exports.getTransactionDetails = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.query.tenantId;
    const { limit = 50, offset = 0 } = req.query;

    if (!tenantId) {
      return res.status(400).json(errorResponse('tenantId is required'));
    }

    const transactions = await FinancialService.getTransactionDetails(
      tenantId,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(successResponse('Transaction details retrieved', transactions));
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json(errorResponse('Failed to fetch transaction details', error.message));
  }
};

exports.getTopEmployees = async (req, res) => {
  try {
    const { limit = 20, startDate, endDate } = req.query;
    const topEmployees = await FinancialService.getTopEmployees(parseInt(limit), startDate, endDate);
    res.json(successResponse('Top employees retrieved', topEmployees));
  } catch (error) {
    console.error('Error fetching top employees:', error);
    res.status(500).json(errorResponse('Failed to fetch top employees', error.message));
  }
};

// Combined endpoint for dashboard overview
exports.getDashboardOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const [summary, leaderboard, monthlyComparison, commissionBreakdown, topEmployees, revenueByType, billsSummary] =
      await Promise.all([
        FinancialService.getPlatformSummary(startDate, endDate),
        FinancialService.getTenantLeaderboard(5, startDate, endDate),
        FinancialService.getMonthlyComparison(6),
        FinancialService.getCommissionByPackage(startDate, endDate),
        FinancialService.getTopEmployees(5, startDate, endDate),
        FinancialService.getRevenueByType(startDate, endDate),
        FinancialService.getBillsSummary(),
      ]);

    res.json(
      successResponse('Dashboard overview retrieved', {
        summary,
        leaderboard,
        monthlyComparison,
        commissionBreakdown,
        topEmployees,
        revenueByType,
        billsSummary,
      })
    );
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json(errorResponse('Failed to fetch dashboard overview', error.message));
  }
};

function resolveComparisonOptions(query = {}) {
  const mode = `${query.mode || query.comparisonMode || 'current_previous'}`.trim().toLowerCase();

  return {
    mode,
    compareStartDate: `${query.compareStartDate || ''}`.trim() || undefined,
    compareEndDate: `${query.compareEndDate || ''}`.trim() || undefined,
  };
}

exports.getFinancialComparison = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json(errorResponse('startDate and endDate are required'));
    }

    const comparison = await FinancialService.getComparisonAnalytics(
      startDate,
      endDate,
      resolveComparisonOptions(req.query)
    );

    res.json(successResponse('Financial comparison retrieved', comparison));
  } catch (error) {
    console.error('Error fetching financial comparison:', error);
    res.status(500).json(errorResponse('Failed to fetch financial comparison', error.message));
  }
};

exports.getGeneralReport = async (req, res) => {
  try {
    const { startDate, endDate, leaderboardLimit = 5, monthlyLimit = 6, employeesLimit = 5 } = req.query;

    const [summary, leaderboard, monthlyComparison, commissionBreakdown, topEmployees, revenueByType, billsSummary, comparison] =
      await Promise.all([
        FinancialService.getPlatformSummary(startDate, endDate),
        FinancialService.getTenantLeaderboard(parseInt(leaderboardLimit, 10), startDate, endDate),
        FinancialService.getMonthlyComparison(parseInt(monthlyLimit, 10)),
        FinancialService.getCommissionByPackage(startDate, endDate),
        FinancialService.getTopEmployees(parseInt(employeesLimit, 10), startDate, endDate),
        FinancialService.getRevenueByType(startDate, endDate),
        FinancialService.getBillsSummary(),
        startDate && endDate
          ? FinancialService.getComparisonAnalytics(startDate, endDate, resolveComparisonOptions(req.query))
          : Promise.resolve(null),
      ]);

    res.json(successResponse('General report retrieved', {
      summary,
      leaderboard,
      monthlyComparison,
      commissionBreakdown,
      topEmployees,
      revenueByType,
      billsSummary,
      comparison,
    }));
  } catch (error) {
    console.error('Error fetching general report:', error);
    res.status(500).json(errorResponse('Failed to fetch general report', error.message));
  }
};

exports.getOperationalInsights = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd);
    defaultStart.setDate(defaultStart.getDate() - 29);

    const start = startDate || defaultStart.toISOString();
    const end = endDate || defaultEnd.toISOString();
    const insights = await FinancialService.getOperationalInsights(start, end);

    res.json(successResponse('Operational insights retrieved', insights));
  } catch (error) {
    console.error('Error fetching operational insights:', error);
    res.status(500).json(errorResponse('Failed to fetch operational insights', error.message));
  }
};

exports.getDetailedReport = async (req, res) => {
  try {
    const query = parseAnalyticsQuery(req.query);
    query.entity = 'transactions';

    const data = await getAnalyticsTransactions(query);
    const comparison = query.startDate && query.endDate
      ? await FinancialService.getComparisonAnalytics(query.startDate, query.endDate, resolveComparisonOptions(req.query))
      : null;

    res.json(successResponse('Detailed report retrieved', {
      transactions: data.rows,
      total: data.total,
      summary: data.summary,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(Math.ceil(data.total / query.limit), 1),
      },
      filters: {
        search: query.search,
        tenantId: query.tenantId,
        type: query.type,
        startDate: query.startDate,
        endDate: query.endDate,
      },
      comparison,
    }));
  } catch (error) {
    console.error('Error fetching detailed report:', error);
    res.status(500).json(errorResponse('Failed to fetch detailed report', error.message));
  }
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

function parseAnalyticsQuery(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    search: `${query.search || ''}`.trim(),
    tenantId: `${query.tenantId || ''}`.trim(),
    status: `${query.status || ''}`.trim(),
    type: `${query.type || ''}`.trim(),
    paymentStatus: `${query.paymentStatus || ''}`.trim(),
    paymentMethod: `${query.paymentMethod || ''}`.trim(),
    category: `${query.category || ''}`.trim(),
    active: query.active,
    startDate: `${query.startDate || ''}`.trim(),
    endDate: `${query.endDate || ''}`.trim(),
    entity: `${query.entity || query.kind || ''}`.trim().toLowerCase(),
    exportRows: `${query.exportRows || query.export || ''}`.trim().toLowerCase() === 'true'
  };
}

function buildDateWhere(column, startDate, endDate) {
  if (!startDate && !endDate) return undefined;
  const where = {};
  if (startDate) where[Op.gte] = new Date(startDate);
  if (endDate) where[Op.lte] = new Date(endDate);
  return { [column]: where };
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildLike(value) {
  return { [Op.iLike]: `%${value}%` };
}

function fullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || '-';
}

function normalizeTransactionRow(transaction) {
  const user = transaction.user || {};
  const appointment = transaction.appointment || {};
  const service = appointment.service || {};
  const order = transaction.order || {};
  const tenant = transaction.tenant || {};

  return {
    id: transaction.id,
    occurredAt: transaction.createdAt,
    tenantName: tenant.name || tenant.name_en || tenant.name_ar || '-',
    customerName: fullName(user.firstName, user.lastName),
    customerEmail: user.email || '-',
    itemName: service.name_en || service.name_ar || order.orderNumber || appointment.bookingNumber || transaction.stripePaymentIntentId || transaction.id,
    itemType: transaction.type || '-',
    amount: toNumber(transaction.amount),
    platformFee: toNumber(transaction.platformFee),
    tenantRevenue: toNumber(transaction.tenantRevenue),
    status: transaction.status || '-',
    paymentMethod: transaction.paymentMethod?.name || transaction.paymentMethod || '-',
    reference: appointment.bookingNumber || order.orderNumber || transaction.stripePaymentIntentId || '-'
  };
}

function normalizeAppointmentRow(appointment) {
  const user = appointment.user || {};
  const service = appointment.service || {};
  const staff = appointment.staff || {};
  const tenant = appointment.tenant || {};

  return {
    id: appointment.id,
    occurredAt: appointment.startTime,
    tenantName: tenant.name || tenant.name_en || tenant.name_ar || '-',
    customerName: fullName(user.firstName, user.lastName),
    customerEmail: user.email || '-',
    serviceName: service.name_en || service.name_ar || '-',
    employeeName: staff.name || '-',
    bookingNumber: appointment.bookingNumber || '-',
    status: appointment.status || '-',
    paymentStatus: appointment.paymentStatus || '-',
    amount: toNumber(appointment.price),
    paymentMethod: appointment.paymentMethod || '-'
  };
}

function normalizePaymentRow(payment) {
  const appointment = payment.appointment || {};
  const order = payment.order || {};
  const processor = payment.processor || {};
  const user = appointment.user || order.user || {};
  const tenant = appointment.tenant || order.tenant || {};

  return {
    id: payment.id,
    occurredAt: payment.processedAt || payment.createdAt,
    tenantName: tenant.name || tenant.name_en || tenant.name_ar || '-',
    customerName: fullName(user.firstName, user.lastName),
    reference: payment.transactionRef || order.orderNumber || appointment.bookingNumber || '-',
    type: payment.type || '-',
    paymentMethod: payment.paymentMethod || '-',
    status: payment.status || '-',
    amount: toNumber(payment.amount),
    processorName: processor.name || '-',
    notes: payment.notes || '-'
  };
}

function normalizeCustomerRow(customer) {
  return {
    id: customer.id,
    name: fullName(customer.firstName, customer.lastName),
    email: customer.email || '-',
    phone: customer.phone || '-',
    totalBookings: customer.totalBookings ?? 0,
    totalSpent: toNumber(customer.totalSpent),
    walletBalance: toNumber(customer.walletBalance),
    loyaltyPoints: customer.loyaltyPoints ?? 0,
    lastLogin: customer.lastLogin || customer.updatedAt || customer.createdAt,
    joinedAt: customer.createdAt
  };
}

function normalizeEmployeeRow(employee) {
  const tenant = employee.tenant || {};
  return {
    id: employee.id,
    tenantName: tenant.name || tenant.name_en || tenant.name_ar || '-',
    name: employee.name || '-',
    email: employee.email || '-',
    phone: employee.phone || '-',
    position: employee.position || '-',
    active: employee.isActive ? 'Active' : 'Inactive',
    rating: toNumber(employee.rating),
    appointmentsCount: employee.appointmentsCount ?? 0,
    commissionEarned: toNumber(employee.commissionEarned),
    totalValueHandled: toNumber(employee.totalValueHandled)
  };
}

function normalizeServiceRow(service) {
  const tenant = service.tenant || {};
  return {
    id: service.id,
    tenantName: tenant.name || tenant.name_en || tenant.name_ar || '-',
    serviceName: service.name_en || service.name_ar || '-',
    category: service.category || '-',
    price: toNumber(service.finalPrice || service.rawPrice || service.basePrice),
    appointmentsCount: service.appointmentsCount ?? 0,
    employeesCount: service.employeesCount ?? 0,
    revenue: toNumber(service.revenue),
    active: service.isActive ? 'Active' : 'Inactive'
  };
}

function normalizeProductRow(product) {
  const tenant = product.tenant || {};
  return {
    id: product.id,
    tenantName: tenant.name || tenant.name_en || tenant.name_ar || '-',
    productName: product.name_en || product.name_ar || '-',
    category: product.category || '-',
    sku: product.sku || '-',
    price: toNumber(product.price),
    stock: product.stock ?? 0,
    soldUnits: product.soldUnits ?? 0,
    revenue: toNumber(product.revenue),
    active: product.isAvailable ? 'Active' : 'Inactive'
  };
}

function normalizeInvoiceRow(invoice) {
  const tenant = invoice.tenant || {};
  const buyer = invoice.platformUser || {};
  return {
    id: invoice.id,
    billNumber: invoice.billNumber || invoice.invoiceNumber || '-',
    tenantName: tenant.name || tenant.name_en || tenant.name_ar || '-',
    customerName: fullName(buyer.firstName, buyer.lastName),
    type: invoice.type || invoice.entityType || '-',
    status: invoice.status || '-',
    amount: toNumber(invoice.amount || invoice.totalAmount),
    issuedAt: invoice.issuedAt || invoice.invoiceIssuedAt || invoice.createdAt,
    paidAt: invoice.paidAt || null,
    dueDate: invoice.dueDate || null,
    packageName: invoice.packageName || invoice.packageNameAr || '-'
  };
}

async function getAnalyticsTransactions(query) {
  const where = {};
  const dateWhere = buildDateWhere('createdAt', query.startDate, query.endDate);
  if (dateWhere) Object.assign(where, dateWhere);
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;

  if (query.search) {
    where[Op.or] = [
      { id: buildLike(query.search) },
      { stripePaymentIntentId: buildLike(query.search) },
      { '$user.firstName$': buildLike(query.search) },
      { '$user.lastName$': buildLike(query.search) },
      { '$user.email$': buildLike(query.search) },
      { '$tenant.name$': buildLike(query.search) },
      { '$appointment.bookingNumber$': buildLike(query.search) },
      { '$order.orderNumber$': buildLike(query.search) }
    ];
  }

  const result = await db.Transaction.findAndCountAll({
    where,
    include: [
      { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false },
      { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false },
      {
        model: db.Appointment,
        as: 'appointment',
        attributes: ['id', 'bookingNumber', 'bookingReference', 'startTime'],
        required: false,
        include: [
          { model: db.Service, as: 'service', attributes: ['id', 'name_en', 'name_ar'], required: false }
        ]
      },
      { model: db.Order, as: 'order', attributes: ['id', 'orderNumber'], required: false },
      { model: db.PaymentMethod, as: 'paymentMethod', attributes: ['id', 'type', 'cardBrand', 'cardLast4'], required: false }
    ],
    order: [['createdAt', 'DESC']],
    distinct: true,
    limit: query.limit,
    offset: query.offset,
    subQuery: false
  });

  return {
    rows: (result.rows || []).map(normalizeTransactionRow),
    total: result.count,
    summary: {
      totalAmount: (result.rows || []).reduce((sum, row) => sum + toNumber(row.amount), 0),
      totalPlatformFee: (result.rows || []).reduce((sum, row) => sum + toNumber(row.platformFee), 0),
      totalTenantRevenue: (result.rows || []).reduce((sum, row) => sum + toNumber(row.tenantRevenue), 0)
    }
  };
}

async function getAnalyticsAppointments(query) {
  const where = {};
  const dateWhere = buildDateWhere('startTime', query.startDate, query.endDate);
  if (dateWhere) Object.assign(where, dateWhere);
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

  if (query.search) {
    where[Op.or] = [
      { bookingNumber: buildLike(query.search) },
      { bookingReference: buildLike(query.search) },
      { '$user.firstName$': buildLike(query.search) },
      { '$user.lastName$': buildLike(query.search) },
      { '$user.email$': buildLike(query.search) },
      { '$service.name_en$': buildLike(query.search) },
      { '$service.name_ar$': buildLike(query.search) },
      { '$staff.name$': buildLike(query.search) }
    ];
  }

  const result = await db.Appointment.findAndCountAll({
    where,
    include: [
      { model: db.Service, as: 'service', attributes: ['id', 'name_en', 'name_ar', 'category'], required: false },
      { model: db.Staff, as: 'staff', attributes: ['id', 'name', 'position'], required: false },
      { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false },
      { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }
    ],
    order: [['startTime', 'DESC']],
    distinct: true,
    limit: query.limit,
    offset: query.offset,
    subQuery: false
  });

  return {
    rows: (result.rows || []).map(normalizeAppointmentRow),
    total: result.count,
    summary: {
      totalAmount: (result.rows || []).reduce((sum, row) => sum + toNumber(row.price), 0)
    }
  };
}

async function getAnalyticsPayments(query) {
  const where = {};
  const dateWhere = buildDateWhere('processedAt', query.startDate, query.endDate);
  if (dateWhere) Object.assign(where, dateWhere);
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

  if (query.search) {
    where[Op.or] = [
      { transactionRef: buildLike(query.search) },
      { notes: buildLike(query.search) },
      { '$appointment.bookingNumber$': buildLike(query.search) },
      { '$order.orderNumber$': buildLike(query.search) },
      { '$processor.name$': buildLike(query.search) }
    ];
  }

  const result = await db.PaymentTransaction.findAndCountAll({
    where,
    include: [
      { model: db.Appointment, as: 'appointment', attributes: ['id', 'bookingNumber', 'tenantId'], required: false, include: [
        { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false },
        { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false }
      ] },
      { model: db.Order, as: 'order', attributes: ['id', 'orderNumber', 'tenantId'], required: false, include: [
        { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false },
        { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false }
      ] },
      { model: db.Staff, as: 'processor', attributes: ['id', 'name'], required: false }
    ],
    order: [['processedAt', 'DESC']],
    distinct: true,
    limit: query.limit,
    offset: query.offset,
    subQuery: false
  });

  return {
    rows: (result.rows || []).map(normalizePaymentRow),
    total: result.count,
    summary: {
      totalAmount: (result.rows || []).reduce((sum, row) => sum + toNumber(row.amount), 0)
    }
  };
}

async function getAnalyticsCustomers(query) {
  const where = {};
  if (query.search) {
    where[Op.or] = [
      { firstName: buildLike(query.search) },
      { lastName: buildLike(query.search) },
      { email: buildLike(query.search) },
      { phone: buildLike(query.search) }
    ];
  }

  const result = await db.PlatformUser.findAndCountAll({
    where,
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      'phone',
      'walletBalance',
      'loyaltyPoints',
      'totalBookings',
      'totalSpent',
      'lastLogin',
      'createdAt'
    ],
    order: [['createdAt', 'DESC']],
    limit: query.limit,
    offset: query.offset
  });

  return {
    rows: (result.rows || []).map(normalizeCustomerRow),
    total: result.count,
    summary: {
      totalSpent: (result.rows || []).reduce((sum, row) => sum + toNumber(row.totalSpent), 0)
    }
  };
}

async function getAnalyticsEmployees(query) {
  const where = {};
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.active === 'true') where.isActive = true;
  if (query.active === 'false') where.isActive = false;
  if (query.category) where.position = query.category;
  if (query.search) {
    where[Op.or] = [
      { name: buildLike(query.search) },
      { email: buildLike(query.search) },
      { phone: buildLike(query.search) },
      { position: buildLike(query.search) }
    ];
  }

  const result = await db.Staff.findAndCountAll({
    where,
    attributes: [
      'id',
      'tenantId',
      'name',
      'email',
      'phone',
      'position',
      'rating',
      'isActive',
      'createdAt',
      [db.sequelize.literal('(SELECT COUNT(*) FROM appointments a WHERE a."staffId" = "Staff".id)'), 'appointmentsCount'],
      [db.sequelize.literal('(SELECT COALESCE(SUM(CAST(a."employeeCommission" AS NUMERIC)), 0) FROM appointments a WHERE a."staffId" = "Staff".id AND a.status = \'completed\')'), 'commissionEarned'],
      [db.sequelize.literal('(SELECT COALESCE(SUM(CAST(a.price AS NUMERIC)), 0) FROM appointments a WHERE a."staffId" = "Staff".id AND a.status = \'completed\')'), 'totalValueHandled']
    ],
    include: [
      { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }
    ],
    order: [['createdAt', 'DESC']],
    limit: query.limit,
    offset: query.offset,
    distinct: true,
    subQuery: false
  });

  return {
    rows: (result.rows || []).map(normalizeEmployeeRow),
    total: result.count,
    summary: {
      totalCommission: (result.rows || []).reduce((sum, row) => sum + toNumber(row.getDataValue ? row.getDataValue('commissionEarned') : row.commissionEarned), 0)
    }
  };
}

async function getAnalyticsServices(query) {
  const where = {};
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.active === 'true') where.isActive = true;
  if (query.active === 'false') where.isActive = false;
  if (query.category) where.category = query.category;
  if (query.search) {
    where[Op.or] = [
      { name_en: buildLike(query.search) },
      { name_ar: buildLike(query.search) },
      { category: buildLike(query.search) }
    ];
  }

  const result = await db.Service.findAndCountAll({
    where,
    attributes: [
      'id',
      'tenantId',
      'name_en',
      'name_ar',
      'category',
      'rawPrice',
      'finalPrice',
      'isActive',
      'createdAt',
      [db.sequelize.literal('(SELECT COUNT(*) FROM appointments a WHERE a."serviceId" = "Service".id)'), 'appointmentsCount'],
      [db.sequelize.literal('(SELECT COUNT(*) FROM service_employees se WHERE se."serviceId" = "Service".id)'), 'employeesCount'],
      [db.sequelize.literal('(SELECT COALESCE(SUM(CAST(a.price AS NUMERIC)), 0) FROM appointments a WHERE a."serviceId" = "Service".id AND a.status = \'completed\')'), 'revenue']
    ],
    include: [
      { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }
    ],
    order: [['createdAt', 'DESC']],
    limit: query.limit,
    offset: query.offset,
    distinct: true,
    subQuery: false
  });

  return {
    rows: (result.rows || []).map(normalizeServiceRow),
    total: result.count,
    summary: {
      totalRevenue: (result.rows || []).reduce((sum, row) => sum + toNumber(row.getDataValue ? row.getDataValue('revenue') : row.revenue), 0)
    }
  };
}

async function getAnalyticsProducts(query) {
  const where = {};
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.active === 'true') where.isAvailable = true;
  if (query.active === 'false') where.isAvailable = false;
  if (query.category) where.category = query.category;
  if (query.search) {
    where[Op.or] = [
      { name_en: buildLike(query.search) },
      { name_ar: buildLike(query.search) },
      { sku: buildLike(query.search) },
      { brand: buildLike(query.search) }
    ];
  }

  const result = await db.Product.findAndCountAll({
    where,
    attributes: [
      'id',
      'tenantId',
      'name_en',
      'name_ar',
      'category',
      'sku',
      'price',
      'stock',
      'isAvailable',
      'soldCount',
      'createdAt',
      [db.sequelize.literal('(SELECT COALESCE(SUM(COALESCE(oi.quantity, 0)), 0) FROM order_items oi WHERE oi."productId" = "Product".id)'), 'soldUnits'],
      [db.sequelize.literal('(SELECT COALESCE(SUM(CAST(oi."totalPrice" AS NUMERIC)), 0) FROM order_items oi WHERE oi."productId" = "Product".id)'), 'revenue']
    ],
    include: [
      { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }
    ],
    order: [['createdAt', 'DESC']],
    limit: query.limit,
    offset: query.offset,
    distinct: true,
    subQuery: false
  });

  return {
    rows: (result.rows || []).map(normalizeProductRow),
    total: result.count,
    summary: {
      totalRevenue: (result.rows || []).reduce((sum, row) => sum + toNumber(row.getDataValue ? row.getDataValue('revenue') : row.revenue), 0)
    }
  };
}

async function getAnalyticsInvoices(query) {
  const where = {};
  const dateWhere = buildDateWhere('issuedAt', query.startDate, query.endDate);
  if (dateWhere) Object.assign(where, dateWhere);
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.status) where.status = query.status;
  if (query.type) where.entityType = query.type;
  if (query.search) {
    where[Op.or] = [
      { invoiceNumber: buildLike(query.search) },
      { '$platformUser.firstName$': buildLike(query.search) },
      { '$platformUser.lastName$': buildLike(query.search) },
      { '$platformUser.email$': buildLike(query.search) },
      { '$tenant.name$': buildLike(query.search) }
    ];
  }

  const result = await db.CustomerInvoice.findAndCountAll({
    where,
    include: [
      { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false },
      { model: db.PlatformUser, as: 'platformUser', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false }
    ],
    order: [['issuedAt', 'DESC']],
    limit: query.limit,
    offset: query.offset,
    distinct: true,
    subQuery: false
  });

  return {
    rows: (result.rows || []).map(normalizeInvoiceRow),
    total: result.count,
    summary: {
      totalAmount: (result.rows || []).reduce((sum, row) => sum + toNumber(row.amount || row.totalAmount), 0)
    }
  };
}

exports.getAnalyticsDrilldown = async (req, res) => {
  try {
    const query = parseAnalyticsQuery(req.query);
    const entity = query.entity;

    const handlers = {
      transactions: getAnalyticsTransactions,
      appointments: getAnalyticsAppointments,
      payments: getAnalyticsPayments,
      customers: getAnalyticsCustomers,
      employees: getAnalyticsEmployees,
      services: getAnalyticsServices,
      products: getAnalyticsProducts,
      invoices: getAnalyticsInvoices,
      bills: getAnalyticsInvoices
    };

    const handler = handlers[entity];
    if (!handler) {
      return res.status(400).json(errorResponse(`Unsupported analytics entity: ${entity || 'unknown'}`));
    }

    const data = await handler(query);

    res.json(successResponse('Analytics drilldown retrieved', {
      entity,
      page: query.page,
      limit: query.limit,
      total: data.total,
      totalPages: Math.max(Math.ceil(data.total / query.limit), 1),
      rows: data.rows,
      summary: data.summary,
      filters: {
        search: query.search,
        tenantId: query.tenantId,
        status: query.status,
        type: query.type,
        paymentStatus: query.paymentStatus,
        paymentMethod: query.paymentMethod,
        category: query.category,
        startDate: query.startDate,
        endDate: query.endDate
      }
    }));
  } catch (error) {
    console.error('Error fetching analytics drilldown:', error);
    res.status(500).json(errorResponse('Failed to fetch analytics drilldown', error.message));
  }
};
