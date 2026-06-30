export type SalesGroupBy = "type" | "category" | "item" | "teamMember" | "customer";

export type SalesEntry = {
  id: string;
  date: string;
  salesNo: string;
  type: string;
  category: string;
  item: string;
  customerId: string | null;
  customer: string;
  teamMember: string;
  channel: string;
  location: string;
  status: string;
  salesQty: number;
  itemsSold: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  serviceCharges: number;
  giftCards: number;
  amountDue: number;
  tax: number;
  eInvoice: string;
  detailPath?: string | null;
  retention?: string;
  gender?: string;
  segment?: string;
  raw?: any;
};

export type SalesGroupedRow = {
  id: string;
  label: string;
  salesCount: number;
  salesQty: number;
  itemsSold: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  serviceCharges: number;
  giftCards: number;
  amountDue: number;
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateValue(value: unknown) {
  if (!value) return "";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return `${value}`;
  }
  return date.toISOString().split("T")[0];
}

function normalizeLabel(value: unknown, fallback: string) {
  const text = `${value ?? ""}`.trim();
  return text || fallback;
}

export function resolveRetentionBucket(bookings: number) {
  if (bookings <= 1) return "one_time";
  if (bookings <= 3) return "occasional";
  if (bookings <= 6) return "regular";
  return "loyal";
}

export function resolveRetentionLabel(bucket: string, locale = "en") {
  if (locale === "ar") {
    switch (bucket) {
      case "one_time":
        return "مرة واحدة";
      case "occasional":
        return "متكرر أحيانًا";
      case "regular":
        return "منتظم";
      case "loyal":
        return "وفي";
      default:
        return "غير محدد";
    }
  }

  switch (bucket) {
    case "one_time":
      return "One-time";
    case "occasional":
      return "Occasional";
    case "regular":
      return "Regular";
    case "loyal":
      return "Loyal";
    default:
      return "Unknown";
  }
}

export function resolveSegmentBucket(bookings: number) {
  if (bookings === 1) return "one_time";
  if (bookings <= 3) return "occasional";
  if (bookings <= 6) return "regular";
  return "loyal";
}

export function buildCustomerLookup(customers: any[] = []): Map<string, { name: string; gender: string; bookings: number; type: string }> {
  return new Map<string, { name: string; gender: string; bookings: number; type: string }>(
    customers.map((customer) => {
      const id = `${customer.id || ""}`.trim();
      return [
        id,
        {
          name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.name || id,
          gender: `${customer.gender || ""}`.trim().toLowerCase() || "unknown",
          bookings: safeNumber(customer.totalBookings),
          type: `${customer.customerType || ""}`.trim().toLowerCase() || "unknown"
        }
      ] as const;
    })
  );
}

export function buildCustomerAnalyticsLookup(customerAnalytics: any): Map<string, { bookings: number; completed: number; revenue: number; retention: string; segment: string }> {
  const rows = Array.isArray(customerAnalytics?.topCustomers) ? customerAnalytics.topCustomers : [];
  return new Map<string, { bookings: number; completed: number; revenue: number; retention: string; segment: string }>(
    rows.map((row: any) => [
      `${row.id || ""}`.trim(),
      {
        bookings: safeNumber(row.bookings),
        completed: safeNumber(row.completed),
        revenue: safeNumber(row.revenue),
        retention: resolveRetentionBucket(safeNumber(row.bookings)),
        segment: resolveSegmentBucket(safeNumber(row.bookings))
      }
    ] as const)
  );
}

export function normalizeFinancialLedgerEntries(ledger: any) {
  const rows = Array.isArray(ledger?.revenueLedger?.rows) ? ledger.revenueLedger.rows : [];

  return rows.map((row: any) => {
    const grossSales = Math.abs(safeNumber(row.revenue));
    const tax = safeNumber(row.tax);
    const discount = Math.abs(safeNumber(row.discount));
    const refunds = safeNumber(row.revenue) < 0 ? Math.abs(safeNumber(row.revenue)) : 0;
    return {
      id: `${row.id || row.reference || row.entityId || Math.random()}`.trim(),
      date: formatDateValue(row.date),
      salesNo: normalizeLabel(row.reference, "—"),
      type: normalizeLabel(row.entityType, "sale"),
      category: `${row.entityType || ""}`.toLowerCase() === "appointment" ? "Service" : "Product",
      item: normalizeLabel(row.service, row.reference || "Item"),
      customerId: row.customerId || null,
      customer: normalizeLabel(row.customer, "Unknown customer"),
      teamMember: normalizeLabel(row.employee, "—"),
      channel: normalizeLabel(row.paymentMethodLabel || row.paymentMethod, "—"),
      location: "All locations",
      status: normalizeLabel(row.status, "completed"),
      salesQty: 1,
      itemsSold: 1,
      grossSales,
      discounts: discount,
      refunds,
      serviceCharges: tax,
      giftCards: 0,
      amountDue: Math.max(grossSales + tax - discount - refunds, 0),
      tax,
      eInvoice: normalizeLabel(row.eInvoice, "—"),
      detailPath: row.detailPath || null,
      retention: undefined,
      gender: undefined,
      segment: undefined
    } satisfies SalesEntry;
  });
}

export function normalizeRefundEntries(refundsReport: any) {
  const rows = Array.isArray(refundsReport?.refunds) ? refundsReport.refunds : Array.isArray(refundsReport?.rows) ? refundsReport.rows : [];

  return rows.map((row: any) => {
    const amount = safeNumber(row.amount);
    return {
      id: `${row.id || row.reference || Math.random()}`.trim(),
      date: formatDateValue(row.date),
      salesNo: normalizeLabel(row.reference, "—"),
      type: "Refund",
      category: normalizeLabel(row.entityLabel || row.entityType, "Refund"),
      item: normalizeLabel(row.entityLabel || row.reference, "Refund"),
      customerId: null,
      customer: normalizeLabel(row.customer || row.customerName, "Unknown customer"),
      teamMember: normalizeLabel(row.employee, "—"),
      channel: normalizeLabel(row.methodLabel || row.method, "—"),
      location: "All locations",
      status: normalizeLabel(row.status, "refunded"),
      salesQty: 0,
      itemsSold: 0,
      grossSales: 0,
      discounts: 0,
      refunds: amount,
      serviceCharges: 0,
      giftCards: 0,
      amountDue: -amount,
      tax: 0,
      eInvoice: "—",
      detailPath: row.detailPath || null,
      retention: undefined,
      gender: undefined,
      segment: undefined
    } satisfies SalesEntry;
  });
}

export function normalizeGiftCardEntries(transactions: any[] = []) {
  return transactions.map((transaction: any) => {
    const purchaseAmount = safeNumber(transaction.purchaseAmount);
    const creditAmount = safeNumber(transaction.creditAmount);
    const bonusAmount = safeNumber(transaction.bonusAmount);
    const totalCreditAmount = safeNumber(transaction.totalCreditAmount) || (creditAmount + bonusAmount);
    const discountValue = Math.max(totalCreditAmount - purchaseAmount, 0);
    const sender = transaction.sender;
    const recipient = transaction.recipient;
    const purchaser = sender
      ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email || "Unknown"
      : transaction.senderEmail || transaction.recipientEmail || "Unknown";

    return {
      id: `${transaction.id || Math.random()}`.trim(),
      date: formatDateValue(transaction.createdAt),
      salesNo: normalizeLabel(transaction.id ? String(transaction.id).slice(0, 8).toUpperCase() : transaction.reference, "—"),
      type: "Gift Card",
      category: normalizeLabel(transaction.package?.title_en || transaction.package?.title_ar || transaction.package?.title, "Gift cards"),
      item: normalizeLabel(transaction.package?.title_en || transaction.package?.title_ar || transaction.package?.title, "Gift cards"),
      customerId: transaction.senderPlatformUserId || null,
      customer: purchaser,
      teamMember: normalizeLabel(sender?.firstName || sender?.email, "—"),
      channel: normalizeLabel(transaction.deliveryChannel, "in_app"),
      location: "All locations",
      status: normalizeLabel(transaction.status, "purchased"),
      salesQty: 1,
      itemsSold: 1,
      grossSales: purchaseAmount,
      discounts: discountValue,
      refunds: 0,
      serviceCharges: 0,
      giftCards: totalCreditAmount,
      amountDue: purchaseAmount,
      tax: 0,
      eInvoice: "—",
      detailPath: null,
      retention: undefined,
      gender: undefined,
      segment: undefined,
      raw: transaction
    } satisfies SalesEntry;
  });
}

export function filterSalesEntries(
  entries: SalesEntry[],
  filters: {
    location?: string;
    teamMember?: string;
    status?: string;
    type?: string;
    customerSegment?: string;
    customerGender?: string;
    customerRetention?: string;
    channel?: string;
  }
) {
  return entries.filter((entry) => {
    const isAll = (value?: string) => !value || value === "all";
    if (!isAll(filters.location) && entry.location.toLowerCase() !== filters.location?.toLowerCase()) return false;
    if (!isAll(filters.teamMember) && entry.teamMember.toLowerCase() !== filters.teamMember?.toLowerCase()) return false;
    if (!isAll(filters.status) && entry.status.toLowerCase() !== filters.status?.toLowerCase()) return false;
    if (!isAll(filters.type) && entry.type.toLowerCase() !== filters.type?.toLowerCase()) return false;
    if (!isAll(filters.channel) && entry.channel.toLowerCase() !== filters.channel?.toLowerCase()) return false;
    if (!isAll(filters.customerGender) && entry.gender?.toLowerCase() !== filters.customerGender?.toLowerCase()) return false;
    if (!isAll(filters.customerRetention) && entry.retention?.toLowerCase() !== filters.customerRetention?.toLowerCase()) return false;
    if (!isAll(filters.customerSegment) && entry.segment?.toLowerCase() !== filters.customerSegment?.toLowerCase()) return false;
    return true;
  });
}

export function buildSalesOverview(entries: SalesEntry[]) {
  const totals = entries.reduce((acc, entry) => {
    acc.salesQty += entry.salesQty;
    acc.itemsSold += entry.itemsSold;
    acc.grossSales += entry.grossSales;
    acc.discounts += entry.discounts;
    acc.refunds += entry.refunds;
    acc.serviceCharges += entry.serviceCharges;
    acc.giftCards += entry.giftCards;
    acc.amountDue += entry.amountDue;
    return acc;
  }, {
    total: entries.length,
    salesQty: 0,
    itemsSold: 0,
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    serviceCharges: 0,
    giftCards: 0,
    amountDue: 0
  });

  return {
    ...totals,
    grossSales: Number(totals.grossSales.toFixed(2)),
    discounts: Number(totals.discounts.toFixed(2)),
    refunds: Number(totals.refunds.toFixed(2)),
    serviceCharges: Number(totals.serviceCharges.toFixed(2)),
    giftCards: Number(totals.giftCards.toFixed(2)),
    amountDue: Number(totals.amountDue.toFixed(2))
  };
}

export function groupSalesEntries(entries: SalesEntry[], groupBy: SalesGroupBy): SalesGroupedRow[] {
  const buckets = new Map<string, SalesGroupedRow>();

  entries.forEach((entry) => {
    const key =
      groupBy === "type"
        ? entry.type
        : groupBy === "category"
          ? entry.category
          : groupBy === "item"
            ? entry.item
            : groupBy === "teamMember"
              ? entry.teamMember
              : entry.customer;

    const label = normalizeLabel(key, "—");
    const existing = buckets.get(label) || {
      id: label,
      label,
      salesCount: 0,
      salesQty: 0,
      itemsSold: 0,
      grossSales: 0,
      discounts: 0,
      refunds: 0,
      serviceCharges: 0,
      giftCards: 0,
      amountDue: 0
    };

    existing.salesCount += 1;
    existing.salesQty += entry.salesQty;
    existing.itemsSold += entry.itemsSold;
    existing.grossSales += entry.grossSales;
    existing.discounts += entry.discounts;
    existing.refunds += entry.refunds;
    existing.serviceCharges += entry.serviceCharges;
    existing.giftCards += entry.giftCards;
    existing.amountDue += entry.amountDue;

    buckets.set(label, existing);
  });

  return Array.from(buckets.values())
    .map((row) => ({
      ...row,
      grossSales: Number(row.grossSales.toFixed(2)),
      discounts: Number(row.discounts.toFixed(2)),
      refunds: Number(row.refunds.toFixed(2)),
      serviceCharges: Number(row.serviceCharges.toFixed(2)),
      giftCards: Number(row.giftCards.toFixed(2)),
      amountDue: Number(row.amountDue.toFixed(2))
    }))
    .sort((left, right) => right.amountDue - left.amountDue);
}
