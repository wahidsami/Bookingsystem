export type FinancialReportNavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  badge?: string | number;
};

export function getFinancialReportNavItems(locale: string): FinancialReportNavItem[] {
  return [
    {
      id: "hub",
      label: locale === "ar" ? "مركز المالية" : "Financial hub",
      href: `/${locale}/dashboard/reports/financial`,
      description: locale === "ar" ? "نقطة الدخول إلى التقارير المالية الجديدة" : "Entry point for the new financial workspaces"
    },
    {
      id: "summary",
      label: locale === "ar" ? "ملخص المالية" : "Finance summary",
      href: `/${locale}/dashboard/reports/financial/summary`,
      description: locale === "ar" ? "ملخص المبيعات والمدفوعات والتحصيل" : "Sales, payments, and cash flow summary"
    },
    {
      id: "payment-transactions",
      label: locale === "ar" ? "معاملات الدفع" : "Payment transactions",
      href: `/${locale}/dashboard/reports/financial/payment-transactions`,
      description: locale === "ar" ? "سجل المعاملات مع مرشحات الدفع" : "Transaction ledger with payment filters"
    },
    {
      id: "cash-flow",
      label: locale === "ar" ? "التدفق النقدي" : "Cash flow summary",
      href: `/${locale}/dashboard/reports/financial/cash-flow`,
      description: locale === "ar" ? "التحصيلات والأرصدة الافتتاحية والختامية" : "Opening, inflows, outflows, and closing balance"
    }
  ];
}
