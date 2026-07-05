"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Banknote, CalendarDays, Link2, Receipt, User2, X } from "lucide-react";

type TransactionDetailsDrawerProps = {
  open: boolean;
  transaction: any | null;
  isRtl?: boolean;
  currencyLabel?: string;
  onClose: () => void;
  onOpenAppointment?: () => void;
  onOpenInvoice?: () => void;
  onOpenCustomer?: () => void;
};

type FieldItem = {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
};

const formatValue = (value: any, fallback = "—") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return fallback;
  }
  return value;
};

const formatDate = (value: any, locale: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
};

const statusTone = (statusValue: any) => {
  const status = `${statusValue || ""}`.toLowerCase();
  if (["paid", "completed", "success", "captured", "fully_paid", "deposit_paid"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["pending", "processing", "in_progress", "partially_paid"].includes(status)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (["failed", "cancelled", "canceled", "void", "refunded", "partially_refunded"].includes(status)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export function TransactionDetailsDrawer({
  open,
  transaction,
  isRtl = false,
  currencyLabel = "SAR",
  onClose,
  onOpenAppointment,
  onOpenInvoice,
  onOpenCustomer,
}: TransactionDetailsDrawerProps) {
  if (!open || !transaction) {
    return null;
  }

  const locale = isRtl ? "ar-SA" : "en-US";
  const amount = Number(transaction.amount || 0);
  const title = transaction.typeLabel || transaction.title || (isRtl ? "معاملة مالية" : "Financial Transaction");
  const statusLabel = transaction.statusLabel || transaction.paymentStatus || transaction.normalizedPaymentStatus || "—";
  const reference = transaction.reference || transaction.transactionRef || transaction.invoiceNumber || transaction.id || "—";
  const dateLabel = formatDate(transaction.date || transaction.processedAt || transaction.createdAt, locale);
  const fields: FieldItem[] = [
    { label: isRtl ? "نوع المعاملة" : "Transaction Type", value: formatValue(transaction.typeLabel || transaction.title || transaction.type) },
    { label: isRtl ? "المبلغ" : "Amount", value: `${amount.toFixed(2)} ${currencyLabel}` },
    { label: isRtl ? "الحالة" : "Status", value: statusLabel },
    { label: isRtl ? "التاريخ" : "Date", value: dateLabel },
    { label: isRtl ? "العميل" : "Customer", value: formatValue(transaction.customerNameEn || transaction.customerNameAr || transaction.customerLabel || transaction.customerId) },
    { label: isRtl ? "الخدمة / المنتج" : "Service / Product", value: formatValue(transaction.serviceLabel || transaction.productLabel || transaction.title || transaction.reference) },
    { label: isRtl ? "الموظف" : "Employee", value: formatValue(transaction.employeeLabel || transaction.processorName || transaction.staffName) },
    { label: isRtl ? "طريقة الدفع" : "Payment Method", value: formatValue(transaction.paymentMethodLabel || transaction.paymentMethod || transaction.method) },
    { label: isRtl ? "رقم المرجع" : "Reference Number", value: formatValue(transaction.reference || transaction.transactionRef) },
    { label: isRtl ? "رقم الفاتورة" : "Invoice Number", value: formatValue(transaction.invoiceNumber) },
    { label: isRtl ? "الفرع" : "Branch", value: formatValue(transaction.branchLabel || transaction.branchName) },
  ];

  const relatedActions = [
    {
      label: isRtl ? "Open Appointment" : "Open Appointment",
      icon: ArrowUpRight,
      onClick: onOpenAppointment,
      disabled: !transaction.appointmentIdLinked || typeof onOpenAppointment !== "function",
    },
    {
      label: isRtl ? "Open Invoice" : "Open Invoice",
      icon: Receipt,
      onClick: onOpenInvoice,
      disabled: typeof onOpenInvoice !== "function",
    },
    {
      label: isRtl ? "Open Customer" : "Open Customer",
      icon: User2,
      onClick: onOpenCustomer,
      disabled: typeof onOpenCustomer !== "function",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140]"
    >
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
        <motion.aside
          initial={{ x: isRtl ? -36 : 36, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isRtl ? -36 : 36, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 220 }}
          className={`absolute top-0 bottom-0 ${isRtl ? "left-0 border-r" : "right-0 border-l"} w-[min(56rem,88vw)] bg-slate-50 border-slate-200 shadow-2xl flex flex-col`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">
                {isRtl ? "تفاصيل المعاملة" : "Transaction Details"}
              </p>
              <div className="mt-1 flex items-center gap-2 min-w-0">
                <h2 className="truncate text-sm font-black text-slate-900 sm:text-base">
                  {title}
                </h2>
                <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusTone(statusLabel)}`}>
                  {formatValue(statusLabel)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {reference}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label={isRtl ? "إغلاق" : "Close"}
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-4">
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isRtl ? "النوع" : "Type"}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{formatValue(title)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isRtl ? "المبلغ" : "Amount"}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900 font-mono">{amount.toFixed(2)} {currencyLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isRtl ? "الحالة" : "Status"}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{formatValue(statusLabel)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isRtl ? "التاريخ" : "Date"}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{dateLabel}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Link2 size={16} className="text-amber-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {isRtl ? "التفاصيل" : "Details"}
                  </h3>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {fields.map((field) => (
                    <div
                      key={field.label}
                      className={`rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 ${field.wide ? "md:col-span-2" : ""}`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{field.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 break-words">
                        {field.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-emerald-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {isRtl ? "السجلات المرتبطة" : "Related Records"}
                  </h3>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {relatedActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-amber-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                            <Icon size={15} />
                          </span>
                          <span>{action.label}</span>
                        </span>
                        <ArrowUpRight size={14} className="text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Banknote size={16} className="text-slate-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {isRtl ? "ملاحظات" : "Notes"}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {formatValue(transaction.notes || transaction.subtitle || (isRtl ? "لا توجد ملاحظات إضافية." : "No additional notes available."))}
                </p>
              </section>
            </div>
          </div>
        </motion.aside>
    </motion.div>
  );
}
