export type FinancialReportFilters = {
  location: string;
  teamMember: string;
  paymentMethod: string;
  amountMin: string;
  amountMax: string;
  excludeGiftCards: boolean;
  excludeDeposits: boolean;
};

export type FinancialSummaryRow = {
  id: string;
  label: string;
  total: number;
  monthly: Record<string, number>;
  depth?: number;
};

export type FinancialPaymentTransactionRow = {
  id: string;
  date: string;
  paymentNo: string;
  saleDate: string;
  saleNo: string;
  appointmentRef: string;
  customer: string;
  location: string;
  teamMember: string;
  transactionType: string;
  paymentMethod: string;
  paymentAmount: number;
  source: string;
  status: string;
  detailPath?: string | null;
  raw?: any;
};

export type FinancialCashFlowRow = {
  id: string;
  type: string;
  location: string;
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  closingBalance: number;
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown, fallback = "—") {
  const text = `${value ?? ""}`.trim();
  return text || fallback;
}

function formatMonthKey(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string, locale: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return monthKey;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { month: "short", year: "numeric" }).format(date);
}

function monthKeysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate || ""}`);
  const end = new Date(`${endDate || ""}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [formatMonthKey(startDate || endDate || new Date().toISOString())].filter(Boolean);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
  const keys: string[] = [];
  while (cursor <= endCursor) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function createMonthlyBuckets(monthKeys: string[]) {
  return Object.fromEntries(monthKeys.map((key) => [key, 0]));
}

function addMonthlyAmount(target: Record<string, number>, valueDate: string, amount: number) {
  const monthKey = formatMonthKey(valueDate);
  if (!monthKey) return;
  if (Object.prototype.hasOwnProperty.call(target, monthKey)) {
    target[monthKey] += amount;
  }
}

function getPaymentMethodGroup(paymentMethod: string) {
  const method = `${paymentMethod || ""}`.trim().toLowerCase();
  if (["cash", "pay_on_visit", "cash_on_delivery"].includes(method)) return "cash";
  if (["card_pos"].includes(method)) return "card";
  if (method === "wallet") return "online";
  if (["online", "online-full", "mock_online"].includes(method)) return "online";
  if (method === "bank_transfer") return "bank";
  if (method === "booking-fee" || method === "deposit" || method === "deposit_paid") return "deposit";
  if (method === "gift_card_code") return "gift_card";
  return "other";
}

function normalizePaymentMethodFilterValue(value: string) {
  const method = `${value || ""}`.trim().toLowerCase();
  if (!method) return "other";
  if (["cash", "pay on visit", "cash on delivery"].includes(method)) return "cash";
  if (["card pos", "card_pos"].includes(method)) return "card";
  if (["online", "online-full", "mock online", "wallet"].includes(method)) return "online";
  if (["bank transfer", "bank_transfer"].includes(method)) return "bank";
  if (["deposit", "booking-fee", "booking fee", "deposit paid"].includes(method)) return "deposit";
  if (["gift card", "gift_card", "gift_card_code"].includes(method)) return "gift_card";
  return method;
}

function getLedgerRows(ledgerResponse: any) {
  return {
    revenueRows: Array.isArray(ledgerResponse?.revenueLedger?.rows) ? ledgerResponse.revenueLedger.rows : [],
    paymentRows: Array.isArray(ledgerResponse?.paymentLedger?.rows) ? ledgerResponse.paymentLedger.rows : [],
    refundRows: Array.isArray(ledgerResponse?.refundLedger?.rows) ? ledgerResponse.refundLedger.rows : [],
    settlementRows: Array.isArray(ledgerResponse?.settlementLedger?.rows) ? ledgerResponse.settlementLedger.rows : []
  };
}

export function buildFinancialSummaryRows(params: {
  locale: string;
  startDate: string;
  endDate: string;
  overview: any;
  ledgerResponse: any;
  giftCardSummary?: any;
  giftCardTransactions?: any[];
  giftCardRedemptions?: any[];
}) {
  const { locale, startDate, endDate, overview, ledgerResponse, giftCardSummary, giftCardTransactions = [], giftCardRedemptions = [] } = params;
  const monthKeys = monthKeysBetween(startDate, endDate);
  const { revenueRows, paymentRows, refundRows } = getLedgerRows(ledgerResponse);
  const monthly = () => createMonthlyBuckets(monthKeys);

  const salesMonthly = monthly();
  const discountMonthly = monthly();
  const refundMonthly = monthly();
  const taxMonthly = monthly();
  const serviceChargeMonthly = monthly();
  const paymentCashMonthly = monthly();
  const paymentCardMonthly = monthly();
  const paymentOnlineMonthly = monthly();
  const paymentBankMonthly = monthly();
  const paymentDepositMonthly = monthly();
  const giftCardSalesMonthly = monthly();
  const redemptionsMonthly = monthly();

  revenueRows.forEach((row: any) => {
    const date = `${row.date || ""}`;
    const revenue = safeNumber(row.revenue);
    const discount = safeNumber(row.discount);
    const tax = safeNumber(row.tax);
    const paymentMethod = getPaymentMethodGroup(row.paymentMethod);
    if (revenue > 0) {
      addMonthlyAmount(salesMonthly, date, revenue);
    }
    if (discount > 0) {
      addMonthlyAmount(discountMonthly, date, discount);
    }
    if (tax > 0) {
      addMonthlyAmount(taxMonthly, date, tax);
    }
    if (paymentMethod === "cash") addMonthlyAmount(paymentCashMonthly, date, revenue);
    if (paymentMethod === "card") addMonthlyAmount(paymentCardMonthly, date, revenue);
    if (paymentMethod === "online") addMonthlyAmount(paymentOnlineMonthly, date, revenue);
    if (paymentMethod === "bank") addMonthlyAmount(paymentBankMonthly, date, revenue);
    if (paymentMethod === "deposit") addMonthlyAmount(paymentDepositMonthly, date, revenue);
  });

  refundRows.forEach((row: any) => {
    const date = `${row.date || ""}`;
    addMonthlyAmount(refundMonthly, date, safeNumber(row.amount));
  });

  (giftCardTransactions || []).forEach((row: any) => {
    const date = `${row.createdAt || row.date || ""}`;
    addMonthlyAmount(giftCardSalesMonthly, date, safeNumber(row.purchaseAmount));
  });

  (giftCardRedemptions || []).forEach((row: any) => {
    const date = `${row.createdAt || ""}`;
    addMonthlyAmount(redemptionsMonthly, date, safeNumber(row.redeemedAmount));
  });

  const grossSales = safeNumber(overview?.appointmentRevenue) + safeNumber(overview?.orderRevenue);
  const discounts = safeNumber(overview?.totalDiscountAmount);
  const refunds = safeNumber(overview?.totalRefunds);
  const taxes = safeNumber(overview?.totalTax);
  const giftCardSales = safeNumber(giftCardSummary?.totalRevenue ?? overview?.giftCardRevenue);
  const serviceCharges = safeNumber(overview?.totalPlatformFees);
  const tips = 0;
  const netSales = grossSales - discounts - refunds;
  const totalSales = netSales + taxes;
  const netOtherSales = 0;
  const taxOnOtherSales = 0;
  const totalOtherSales = netOtherSales + taxOnOtherSales;
  const totalSalesAndOtherSales = totalSales + totalOtherSales;
  const salesPaidInPeriod = paymentRows.reduce((sum: number, row: any) => {
    const type = `${row.source || row.entityType || ""}`.toLowerCase();
    if (type === "appointment" || type === "order") {
      return sum + safeNumber(row.amount ?? row.revenue);
    }
    return sum;
  }, 0);
  const unpaidSalesInPeriod = safeNumber(overview?.pendingPayments);
  const cashPayments = paymentRows.filter((row: any) => getPaymentMethodGroup(row.paymentMethod) === "cash").reduce((sum: number, row: any) => sum + safeNumber(row.amount ?? row.revenue), 0);
  const cardPayments = paymentRows.filter((row: any) => getPaymentMethodGroup(row.paymentMethod) === "card").reduce((sum: number, row: any) => sum + safeNumber(row.amount ?? row.revenue), 0);
  const onlinePayments = paymentRows.filter((row: any) => getPaymentMethodGroup(row.paymentMethod) === "online").reduce((sum: number, row: any) => sum + safeNumber(row.amount ?? row.revenue), 0);
  const bankTransferPayments = paymentRows.filter((row: any) => getPaymentMethodGroup(row.paymentMethod) === "bank").reduce((sum: number, row: any) => sum + safeNumber(row.amount ?? row.revenue), 0);
  const depositPayments = paymentRows.filter((row: any) => getPaymentMethodGroup(row.paymentMethod) === "deposit").reduce((sum: number, row: any) => sum + safeNumber(row.amount ?? row.revenue), 0);
  const totalPayments = cashPayments + cardPayments + onlinePayments + bankTransferPayments + depositPayments;
  const paymentsForSalesInPeriod = paymentRows.reduce((sum: number, row: any) => {
    const method = getPaymentMethodGroup(row.paymentMethod);
    if (method === "gift_card" || method === "deposit") return sum;
    return sum + safeNumber(row.amount ?? row.revenue);
  }, 0);
  const paymentsForPreviousPeriods = 0;
  const prepayments = depositPayments;
  const giftCardRedemption = (giftCardRedemptions || []).reduce((sum: number, row: any) => sum + safeNumber(row.redeemedAmount), 0);
  const depositRedemption = 0;
  const totalRedemptions = giftCardRedemption + depositRedemption;

  return {
    monthKeys,
    monthLabels: monthKeys.map((key) => ({ id: key, label: monthLabel(key, locale) })),
    sections: [
      {
        id: "sales",
        label: locale === "ar" ? "المبيعات" : "Sales",
        rows: [
          { id: "gross-sales", label: locale === "ar" ? "Gross Sales" : "Gross Sales", total: grossSales, monthly: salesMonthly },
          { id: "discounts", label: locale === "ar" ? "Discounts" : "Discounts", total: discounts, monthly: discountMonthly },
          { id: "refunds", label: locale === "ar" ? "Refunds" : "Refunds", total: refunds, monthly: refundMonthly },
          { id: "net-sales", label: locale === "ar" ? "Net Sales" : "Net Sales", total: netSales, monthly: salesMonthly },
          { id: "taxes", label: locale === "ar" ? "Taxes" : "Taxes", total: taxes, monthly: taxMonthly },
          { id: "total-sales", label: locale === "ar" ? "Total Sales" : "Total Sales", total: totalSales, monthly: salesMonthly },
          { id: "gift-card-sales", label: locale === "ar" ? "Gift Card Sales" : "Gift Card Sales", total: giftCardSales, monthly: giftCardSalesMonthly },
          { id: "service-charges", label: locale === "ar" ? "Service Charges" : "Service Charges", total: serviceCharges, monthly: serviceChargeMonthly },
          { id: "tips", label: locale === "ar" ? "Tips" : "Tips", total: tips, monthly: monthly() },
          { id: "net-other-sales", label: locale === "ar" ? "Net Other Sales" : "Net Other Sales", total: netOtherSales, monthly: monthly() },
          { id: "tax-on-other-sales", label: locale === "ar" ? "Tax On Other Sales" : "Tax On Other Sales", total: taxOnOtherSales, monthly: monthly() },
          { id: "total-other-sales", label: locale === "ar" ? "Total Other Sales" : "Total Other Sales", total: totalOtherSales, monthly: monthly() },
          { id: "total-sales-and-other-sales", label: locale === "ar" ? "Total Sales + Other Sales" : "Total Sales + Other Sales", total: totalSalesAndOtherSales, monthly: monthly() },
          { id: "sales-paid-in-period", label: locale === "ar" ? "Sales Paid In Period" : "Sales Paid In Period", total: salesPaidInPeriod, monthly: salesMonthly },
          { id: "unpaid-sales-in-period", label: locale === "ar" ? "Unpaid Sales In Period" : "Unpaid Sales In Period", total: unpaidSalesInPeriod, monthly: monthly() }
        ]
      },
      {
        id: "payments",
        label: locale === "ar" ? "المدفوعات" : "Payments",
        rows: [
          { id: "cash", label: locale === "ar" ? "Cash" : "Cash", total: cashPayments, monthly: paymentCashMonthly },
          { id: "card", label: locale === "ar" ? "Card" : "Card", total: cardPayments, monthly: paymentCardMonthly },
          { id: "online", label: locale === "ar" ? "Online" : "Online", total: onlinePayments, monthly: paymentOnlineMonthly },
          { id: "bank-transfer", label: locale === "ar" ? "Bank Transfer" : "Bank Transfer", total: bankTransferPayments, monthly: paymentBankMonthly },
          { id: "deposit", label: locale === "ar" ? "Deposit" : "Deposit", total: depositPayments, monthly: paymentDepositMonthly },
          { id: "total-payments", label: locale === "ar" ? "Total Payments" : "Total Payments", total: totalPayments, monthly: monthly() },
          { id: "payments-for-sales", label: locale === "ar" ? "Payments For Sales In Period" : "Payments For Sales In Period", total: paymentsForSalesInPeriod, monthly: monthly() },
          { id: "payments-for-previous-periods", label: locale === "ar" ? "Payments For Previous Periods" : "Payments For Previous Periods", total: paymentsForPreviousPeriods, monthly: monthly() },
          { id: "prepayments", label: locale === "ar" ? "Prepayments" : "Prepayments", total: prepayments, monthly: paymentDepositMonthly }
        ]
      },
      {
        id: "redemptions",
        label: locale === "ar" ? "الاستردادات" : "Redemptions",
        rows: [
          { id: "gift-card-redemption", label: locale === "ar" ? "Gift Card Redemption" : "Gift Card Redemption", total: giftCardRedemption, monthly: redemptionsMonthly },
          { id: "deposit-redemption", label: locale === "ar" ? "Deposit Redemption" : "Deposit Redemption", total: depositRedemption, monthly: monthly() },
          { id: "total-redemptions", label: locale === "ar" ? "Total Redemptions" : "Total Redemptions", total: totalRedemptions, monthly: redemptionsMonthly }
        ]
      }
    ] as Array<{ id: string; label: string; rows: FinancialSummaryRow[] }>
  };
}

function normalizePaymentStatus(status: unknown) {
  const text = `${status || ""}`.trim().toLowerCase();
  if (!text) return "completed";
  return text;
}

function buildPaymentMethodLabel(paymentMethod: string) {
  const method = `${paymentMethod || ""}`.trim().toLowerCase();
  return ({
    cash: "Cash",
    card_pos: "Card POS",
    online: "Online",
    "online-full": "Online",
    mock_online: "Online",
    bank_transfer: "Bank transfer",
    wallet: "Wallet",
    gift_card_code: "Gift card",
    "booking-fee": "Deposit",
    deposit: "Deposit"
  }[method] || paymentMethod || "Not set");
}

function normalizeGiftCardRows(giftTransactions: any[] = []) {
  return giftTransactions.map((transaction: any) => ({
    id: `${transaction.id || transaction.createdAt || Math.random()}`,
    date: transaction.createdAt || transaction.date || "",
    paymentNo: transaction.id || transaction.code || "",
    saleDate: transaction.createdAt || transaction.date || "",
    saleNo: transaction.id || transaction.code || "",
    appointmentRef: "",
    customer: transaction.recipient?.firstName || transaction.recipient?.email || transaction.recipientEmail || "Guest Customer",
    location: "All locations",
    teamMember: transaction.sender ? `${transaction.sender.firstName || ""} ${transaction.sender.lastName || ""}`.trim() || transaction.sender.email || "—" : "—",
    transactionType: "Gift card sale",
    paymentMethod: "Gift card",
    paymentAmount: safeNumber(transaction.purchaseAmount),
    source: "gift_card",
    status: normalizePaymentStatus(transaction.status),
    detailPath: null,
    raw: transaction
  }));
}

function normalizeRedemptionRows(redemptions: any[] = []) {
  return redemptions.map((redemption: any) => ({
    id: redemption.id,
    date: redemption.createdAt || "",
    paymentNo: redemption.code || redemption.id,
    saleDate: redemption.createdAt || "",
    saleNo: redemption.code || redemption.id,
    appointmentRef: redemption.appointmentId || redemption.orderId || "",
    customer: redemption.senderName || redemption.senderEmail || "Guest Customer",
    location: "All locations",
    teamMember: "—",
    transactionType: "Gift card redemption",
    paymentMethod: "Gift card redemption",
    paymentAmount: safeNumber(redemption.redeemedAmount),
    source: "redemption",
    status: "completed",
    detailPath: redemption.appointmentId ? `/dashboard/appointments/${redemption.appointmentId}` : redemption.orderId ? `/dashboard/orders/${redemption.orderId}` : null,
    raw: redemption
  }));
}

export function buildFinancialPaymentTransactionRows(params: {
  ledgerResponse: any;
  giftCardTransactions?: any[];
  giftCardRedemptions?: any[];
}) {
  const { ledgerResponse, giftCardTransactions = [], giftCardRedemptions = [] } = params;
  const paymentRows = Array.isArray(ledgerResponse?.paymentLedger?.rows) ? ledgerResponse.paymentLedger.rows : [];
  const revenueRows = Array.isArray(ledgerResponse?.revenueLedger?.rows) ? ledgerResponse.revenueLedger.rows : [];
  const revenueById = new Map(revenueRows.map((row: any) => [row.id, row]));

  const normalizedPayments: FinancialPaymentTransactionRow[] = paymentRows.map((row: any) => {
    const revenueRow = (revenueById.get(row.id) || {}) as any;
    return {
      id: `${row.id}`,
      date: row.date || revenueRow.date || "",
      paymentNo: row.reference || row.id,
      saleDate: row.date || revenueRow.date || "",
      saleNo: row.reference || row.id,
      appointmentRef: row.source === "appointment" ? row.reference || row.id : "",
      customer: normalizeText(row.customer, "Guest Customer"),
      location: "All locations",
      teamMember: normalizeText(revenueRow.employee || row.employee, "—"),
      transactionType: row.source === "appointment" ? "Appointment payment" : "Order payment",
      paymentMethod: buildPaymentMethodLabel(row.paymentMethod || revenueRow.paymentMethod),
      paymentAmount: safeNumber(row.amount ?? revenueRow.revenue),
      source: row.source || revenueRow.entityType || "payment",
      status: normalizePaymentStatus(row.status),
      detailPath: row.detailPath || revenueRow.detailPath || null,
      raw: { payment: row, revenue: revenueRow }
    };
  });

  const giftRows = normalizeGiftCardRows(giftCardTransactions);
  const redemptionRows = normalizeRedemptionRows(giftCardRedemptions);
  return [...normalizedPayments, ...giftRows, ...redemptionRows].sort((left, right) => `${right.date}`.localeCompare(`${left.date}`));
}

export function applyFinancialPaymentFilters(rows: FinancialPaymentTransactionRow[], filters: FinancialReportFilters) {
  const minAmount = filters.amountMin ? safeNumber(filters.amountMin) : null;
  const maxAmount = filters.amountMax ? safeNumber(filters.amountMax) : null;
  const methodFilter = normalizePaymentMethodFilterValue(filters.paymentMethod);
  const teamMemberFilter = `${filters.teamMember || ""}`.trim().toLowerCase();

  return rows.filter((row) => {
    const rowMethod = normalizePaymentMethodFilterValue(`${row.paymentMethod || ""}`);
    if (methodFilter !== "all" && rowMethod !== methodFilter) return false;
    if (teamMemberFilter !== "all" && `${row.teamMember || ""}`.trim().toLowerCase() !== teamMemberFilter) return false;
    if (filters.excludeGiftCards && `${row.source || ""}`.toLowerCase().includes("gift")) return false;
    if (filters.excludeDeposits && `${row.paymentMethod || ""}`.toLowerCase().includes("deposit")) return false;
    if (minAmount !== null && safeNumber(row.paymentAmount) < minAmount) return false;
    if (maxAmount !== null && safeNumber(row.paymentAmount) > maxAmount) return false;
    return true;
  });
}

export function filterFinancialReportData(params: {
  ledgerResponse: any;
  giftCardTransactions?: any[];
  giftCardRedemptions?: any[];
  filters: FinancialReportFilters;
}) {
  const { ledgerResponse, giftCardTransactions = [], giftCardRedemptions = [], filters } = params;
  const methodFilter = normalizePaymentMethodFilterValue(filters.paymentMethod);
  const teamMemberFilter = `${filters.teamMember || ""}`.trim().toLowerCase();
  const minAmount = filters.amountMin ? safeNumber(filters.amountMin) : null;
  const maxAmount = filters.amountMax ? safeNumber(filters.amountMax) : null;

  const filteredRevenueRows = Array.isArray(ledgerResponse?.revenueLedger?.rows)
    ? ledgerResponse.revenueLedger.rows.filter((row: any) => {
      const rowMethod = normalizePaymentMethodFilterValue(row.paymentMethod);
      if (teamMemberFilter !== "all" && `${row.employee || ""}`.trim().toLowerCase() !== teamMemberFilter) return false;
      if (methodFilter !== "all" && rowMethod !== methodFilter) return false;
      const amount = safeNumber(row.revenue);
      if (minAmount !== null && amount < minAmount) return false;
      if (maxAmount !== null && amount > maxAmount) return false;
      return true;
    })
    : [];

  const filteredPaymentRows = Array.isArray(ledgerResponse?.paymentLedger?.rows)
    ? ledgerResponse.paymentLedger.rows.filter((row: any) => {
      const rowMethod = normalizePaymentMethodFilterValue(row.paymentMethod);
      if (teamMemberFilter !== "all" && `${row.employee || ""}`.trim().toLowerCase() !== teamMemberFilter) return false;
      if (methodFilter !== "all" && rowMethod !== methodFilter) return false;
      if (filters.excludeGiftCards && rowMethod === "gift_card") return false;
      if (filters.excludeDeposits && rowMethod === "deposit") return false;
      const amount = safeNumber(row.amount);
      if (minAmount !== null && amount < minAmount) return false;
      if (maxAmount !== null && amount > maxAmount) return false;
      return true;
    })
    : [];

  const filteredRefundRows = Array.isArray(ledgerResponse?.refundLedger?.rows)
    ? ledgerResponse.refundLedger.rows.filter((row: any) => {
      if (teamMemberFilter !== "all" && `${row.employee || ""}`.trim().toLowerCase() !== teamMemberFilter) return false;
      const amount = safeNumber(row.amount);
      if (minAmount !== null && amount < minAmount) return false;
      if (maxAmount !== null && amount > maxAmount) return false;
      return true;
    })
    : [];

  const filteredGiftCards = filters.excludeGiftCards ? [] : giftCardTransactions;
  const filteredRedemptions = filters.excludeGiftCards ? [] : giftCardRedemptions;

  return {
    ledgerResponse: {
      ...ledgerResponse,
      revenueLedger: {
        ...ledgerResponse?.revenueLedger,
        rows: filteredRevenueRows
      },
      paymentLedger: {
        ...ledgerResponse?.paymentLedger,
        rows: filteredPaymentRows
      },
      refundLedger: {
        ...ledgerResponse?.refundLedger,
        rows: filteredRefundRows
      }
    },
    giftCardTransactions: filteredGiftCards,
    giftCardRedemptions: filteredRedemptions
  };
}

export function buildFinancialCashFlowRows(params: {
  locale: string;
  startDate: string;
  endDate: string;
  currentLedger: any;
  previousLedger: any;
  giftCardSummary?: any;
  giftCardTransactions?: any[];
  giftCardRedemptions?: any[];
}) {
  const { locale, currentLedger, previousLedger, giftCardSummary, giftCardTransactions = [], giftCardRedemptions = [] } = params;
  const currentRows = getLedgerRows(currentLedger);
  const previousRows = getLedgerRows(previousLedger);
  const currentPayments = currentRows.paymentRows;
  const previousPayments = previousRows.paymentRows;
  const currentRefunds = currentRows.refundRows;
  const currentRevenue = currentRows.revenueRows;
  const previousRevenue = previousRows.revenueRows;

  const openingBalance = previousRows.settlementRows.reduce((sum: number, row: any) => sum + safeNumber(row.netCollected), 0)
    || previousRevenue.reduce((sum: number, row: any) => sum + safeNumber(row.revenue), 0);

  const inflowsByType = {
    sales: currentRevenue.reduce((sum: number, row: any) => sum + Math.max(0, safeNumber(row.revenue)), 0),
    giftCards: (giftCardTransactions || []).reduce((sum: number, row: any) => sum + safeNumber(row.purchaseAmount), 0),
    payments: currentPayments.reduce((sum: number, row: any) => sum + Math.max(0, safeNumber(row.amount)), 0)
  };

  const outflowsByType = {
    refunds: currentRefunds.reduce((sum: number, row: any) => sum + Math.max(0, safeNumber(row.amount)), 0),
    redemptions: (giftCardRedemptions || []).reduce((sum: number, row: any) => sum + safeNumber(row.redeemedAmount), 0)
  };

  const totalInflows = inflowsByType.sales + inflowsByType.giftCards + inflowsByType.payments;
  const totalOutflows = outflowsByType.refunds + outflowsByType.redemptions;
  const closingBalance = openingBalance + totalInflows - totalOutflows;
  const locationLabel = locale === "ar" ? "جميع المواقع" : "All locations";

  return [
    {
      id: "sales",
      type: locale === "ar" ? "Sales" : "Sales",
      location: locationLabel,
      openingBalance: safeNumber(openingBalance),
      totalInflows: inflowsByType.sales,
      totalOutflows: 0,
      closingBalance: safeNumber(openingBalance) + inflowsByType.sales
    },
    {
      id: "gift-cards",
      type: locale === "ar" ? "Gift Cards" : "Gift Cards",
      location: locationLabel,
      openingBalance: safeNumber(openingBalance),
      totalInflows: inflowsByType.giftCards,
      totalOutflows: 0,
      closingBalance: safeNumber(openingBalance) + inflowsByType.giftCards
    },
    {
      id: "payments",
      type: locale === "ar" ? "Payments" : "Payments",
      location: locationLabel,
      openingBalance: safeNumber(openingBalance),
      totalInflows: inflowsByType.payments,
      totalOutflows: 0,
      closingBalance: safeNumber(openingBalance) + inflowsByType.payments
    },
    {
      id: "refunds",
      type: locale === "ar" ? "Refunds" : "Refunds",
      location: locationLabel,
      openingBalance: safeNumber(openingBalance),
      totalInflows: 0,
      totalOutflows: outflowsByType.refunds,
      closingBalance: safeNumber(openingBalance) - outflowsByType.refunds
    },
    {
      id: "redemptions",
      type: locale === "ar" ? "Redemptions" : "Redemptions",
      location: locationLabel,
      openingBalance: safeNumber(openingBalance),
      totalInflows: 0,
      totalOutflows: outflowsByType.redemptions,
      closingBalance: safeNumber(openingBalance) - outflowsByType.redemptions
    },
    {
      id: "net",
      type: locale === "ar" ? "Net" : "Net",
      location: locationLabel,
      openingBalance: safeNumber(openingBalance),
      totalInflows,
      totalOutflows,
      closingBalance
    }
  ];
}
