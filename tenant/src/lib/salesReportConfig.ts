export type SalesReportId =
  | "hub"
  | "summary"
  | "list"
  | "log-details"
  | "gift-cards"
  | "discounts"
  | "taxes";

export type SalesReportNavItem = {
  id: SalesReportId;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  href: string;
};

export const SALES_REPORT_NAV_ITEMS: SalesReportNavItem[] = [
  {
    id: "summary",
    labelEn: "Sales Summary",
    labelAr: "ملخص المبيعات",
    descriptionEn: "Grouped sales totals and breakdowns.",
    descriptionAr: "إجماليات المبيعات وتوزيعاتها.",
    href: "/dashboard/reports/sales/summary"
  },
  {
    id: "list",
    labelEn: "Sales List",
    labelAr: "قائمة المبيعات",
    descriptionEn: "Transaction-level sales rows.",
    descriptionAr: "صفوف المبيعات على مستوى العملية.",
    href: "/dashboard/reports/sales/list"
  },
  {
    id: "log-details",
    labelEn: "Sales Log Details",
    labelAr: "تفاصيل سجل المبيعات",
    descriptionEn: "Detailed ledger-style rows.",
    descriptionAr: "صفوف تفصيلية على نمط دفتر الأستاذ.",
    href: "/dashboard/reports/sales/log-details"
  },
  {
    id: "gift-cards",
    labelEn: "Gift Card List",
    labelAr: "قائمة بطاقات الهدايا",
    descriptionEn: "Gift card sales and expiry dates.",
    descriptionAr: "مبيعات بطاقات الهدايا وتواريخ الانتهاء.",
    href: "/dashboard/reports/sales/gift-cards"
  },
  {
    id: "discounts",
    labelEn: "Discount Summary",
    labelAr: "ملخص الخصومات",
    descriptionEn: "Discount totals by category.",
    descriptionAr: "إجماليات الخصومات حسب الفئة.",
    href: "/dashboard/reports/sales/discounts"
  },
  {
    id: "taxes",
    labelEn: "Taxes Summary",
    labelAr: "ملخص الضرائب",
    descriptionEn: "Tax totals by source and rate.",
    descriptionAr: "إجماليات الضرائب حسب المصدر والنسبة.",
    href: "/dashboard/reports/sales/taxes"
  }
];

export function getSalesReportNavItems(locale: string) {
  return SALES_REPORT_NAV_ITEMS.map((item) => ({
    id: item.id,
    label: locale === "ar" ? item.labelAr : item.labelEn,
    description: locale === "ar" ? item.descriptionAr : item.descriptionEn,
    href: item.href
  }));
}

export function getSalesReportTitle(locale: string, reportId: SalesReportId) {
  const item = SALES_REPORT_NAV_ITEMS.find((entry) => entry.id === reportId);
  return locale === "ar" ? item?.labelAr || "المبيعات" : item?.labelEn || "Sales";
}
