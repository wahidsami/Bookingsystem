"use client";

import { useEffect, useMemo, useState } from "react";
import { tenantApi } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useAppDialog } from "@/components/AppDialogProvider";
import {
  GiftIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  UserIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

type CartMode = "gift_card" | "product";
type CustomerMode = "existing" | "walk_in";
type RecipientType = "self" | "gift";
type CartStep = 1 | 2 | 3;
type PaymentMethod = "cash" | "card_pos" | "wallet" | "bank_transfer";

interface GiftCardPackage {
  id: string;
  title?: string | null;
  title_en?: string | null;
  title_ar?: string | null;
  priceAmount?: number;
  walletCreditAmount?: number;
  bonusAmount?: number;
  imageUrl?: string | null;
  isActive?: boolean;
}

interface ProductItem {
  id: string;
  name_en?: string | null;
  name_ar?: string | null;
  category?: string | null;
  price?: number;
  taxRate?: number | null;
  stock?: number;
  isAvailable?: boolean;
  image?: string | null;
}

interface CustomerItem {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  profileImage?: string | null;
}

interface PaymentRow {
  id: string;
  paymentMethod: PaymentMethod;
  amount: string;
}

interface Props {
  open: boolean;
  locale: string;
  isRTL: boolean;
  mode: CartMode;
  giftCardPackages: GiftCardPackage[];
  products: ProductItem[];
  onClose: () => void;
  onCompleted?: () => void;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; labelAr: string; labelEn: string }> = [
  { value: "cash", labelAr: "نقدي", labelEn: "Cash" },
  { value: "card_pos", labelAr: "بطاقة", labelEn: "Card" },
  { value: "wallet", labelAr: "محفظة", labelEn: "Wallet" },
  { value: "bank_transfer", labelAr: "تحويل", labelEn: "Transfer" }
];

function formatName(customer?: CustomerItem | null) {
  if (!customer) return "";
  return `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
}

function getPackageTitle(item: GiftCardPackage) {
  return item.title || item.title_en || item.title_ar || "Gift card";
}

function getProductTitle(item: ProductItem) {
  return item.name_ar || item.name_en || "Product";
}

function normalizeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AppointmentBoardCartDrawer({
  open,
  locale,
  isRTL,
  mode,
  giftCardPackages,
  products,
  onClose,
  onCompleted
}: Props) {
  const dialog = useAppDialog();
  const [step, setStep] = useState<CartStep>(1);
  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing");
  const [recipientType, setRecipientType] = useState<RecipientType>("self");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerItem[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [walkInFirstName, setWalkInFirstName] = useState("");
  const [walkInLastName, setWalkInLastName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInBirthDate, setWalkInBirthDate] = useState("");
  const [giftCardSearch, setGiftCardSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("all");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, number>>({});
  const [giftMessage, setGiftMessage] = useState("");
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: crypto.randomUUID(), paymentMethod: "cash", amount: "0" }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const selectedPackage = useMemo(
    () => giftCardPackages.find((item) => item.id === selectedPackageId) || null,
    [giftCardPackages, selectedPackageId]
  );

  const selectedProducts = useMemo(() => {
    return products
      .filter((item) => (selectedProductQuantities[item.id] || 0) > 0)
      .map((item) => ({
        ...item,
        quantity: selectedProductQuantities[item.id] || 0
      }));
  }, [products, selectedProductQuantities]);

  const subtotal = useMemo(() => {
    if (mode === "gift_card") {
      return Number(selectedPackage?.priceAmount || 0);
    }

    return selectedProducts.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  }, [mode, selectedPackage, selectedProducts]);

  const taxAmount = useMemo(() => {
    if (mode === "gift_card") return 0;
    return selectedProducts.reduce((sum, item) => {
      const itemSubtotal = Number(item.price || 0) * Number(item.quantity || 0);
      const taxRate = Number(item.taxRate ?? 15);
      return sum + (itemSubtotal * (taxRate / 100));
    }, 0);
  }, [mode, selectedProducts]);

  const totalDue = useMemo(() => {
    return Number((subtotal + taxAmount).toFixed(2));
  }, [subtotal, taxAmount]);

  const splitTotal = useMemo(() => {
    return paymentRows.reduce((sum, row) => sum + normalizeNumber(row.amount), 0);
  }, [paymentRows]);

  const difference = Number((totalDue - splitTotal).toFixed(2));
  const isBalanced = Math.abs(difference) <= 0.01;

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(products.map((item) => `${item.category || ""}`.trim()).filter(Boolean)));
    return ["all", ...categories];
  }, [products]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep(1);
    setGiftCardSearch("");
    setProductSearch("");
    setProductCategory("all");
    setSelectedCustomer(null);
    setCustomerResults([]);
    setCustomerSearch("");
    setWalkInFirstName("");
    setWalkInLastName("");
    setWalkInEmail("");
    setWalkInPhone("");
    setWalkInBirthDate("");
    setSelectedPackageId(mode === "gift_card" ? giftCardPackages[0]?.id || "" : "");
    setSelectedProductQuantities({});
    setGiftMessage("");
    setRecipientType("self");
    setCustomerMode("existing");
    setPaymentRows([{ id: crypto.randomUUID(), paymentMethod: "cash", amount: "0" }]);
  }, [open, mode, giftCardPackages]);

  useEffect(() => {
    if (!open || customerMode !== "existing") return;

    const query = customerSearch.trim();

    const timer = window.setTimeout(async () => {
      try {
        setCustomerLoading(true);
        const response = await tenantApi.getCustomers({ search: query || undefined, limit: 20 });
        setCustomerResults(response?.data?.customers || []);
      } catch (error) {
        console.error("Failed to search customers for cart:", error);
        setCustomerResults([]);
      } finally {
        setCustomerLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [open, customerMode, customerSearch]);

  useEffect(() => {
    setPaymentRows((rows) => {
      if (rows.length === 1) {
        const next = { ...rows[0], amount: totalDue > 0 ? totalDue.toFixed(2) : "0" };
        return [next];
      }
      return rows;
    });
  }, [totalDue]);

  const filteredGiftCards = useMemo(() => {
    const term = giftCardSearch.trim().toLowerCase();
    return giftCardPackages.filter((item) => {
      if (!item.isActive) return false;
      const searchable = `${getPackageTitle(item)} ${item.title_en || ""} ${item.title_ar || ""}`.toLowerCase();
      return !term || searchable.includes(term);
    });
  }, [giftCardPackages, giftCardSearch]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products.filter((item) => {
      if (item.isAvailable === false) return false;
      if (productCategory !== "all" && `${item.category || ""}`.trim() !== productCategory) return false;
      const searchable = `${item.name_en || ""} ${item.name_ar || ""} ${item.category || ""}`.toLowerCase();
      return !term || searchable.includes(term);
    });
  }, [products, productSearch, productCategory]);

  const updatePaymentRow = (rowId: string, updates: Partial<PaymentRow>) => {
    setPaymentRows((rows) => rows.map((row) => row.id === rowId ? { ...row, ...updates } : row));
  };

  const removePaymentRow = (rowId: string) => {
    setPaymentRows((rows) => rows.length === 1 ? rows : rows.filter((row) => row.id !== rowId));
  };

  const addPaymentRow = () => {
    setPaymentRows((rows) => [...rows, { id: crypto.randomUUID(), paymentMethod: "cash", amount: "0" }]);
  };

  const handleSubmit = async () => {
    if (!isBalanced) {
      await dialog.alert({
        title: locale === "ar" ? "تحقق من الدفع" : "Check payment",
        message: locale === "ar"
          ? "مجموع الدفعات يجب أن يساوي المبلغ المطلوب."
          : "The split total must match the amount due.",
        tone: "danger"
      });
      return;
    }

    try {
      setSubmitting(true);

      const paymentAllocations = paymentRows.map((row) => ({
        paymentMethod: row.paymentMethod,
        amount: normalizeNumber(row.amount)
      }));
      const paymentMethod = paymentRows[0]?.paymentMethod || "cash";

      if (mode === "gift_card") {
        if (!selectedPackage) {
          throw new Error(locale === "ar" ? "اختر بطاقة هدية" : "Please choose a gift card package");
        }

        const existingCustomer = selectedCustomer;
        const normalizedEmail = walkInEmail.trim().toLowerCase();
        const hasGuestData = walkInFirstName.trim() || walkInLastName.trim() || normalizedEmail || walkInPhone.trim();

        if (!existingCustomer && !hasGuestData) {
          await dialog.alert({
            title: locale === "ar" ? "لا يوجد عميل" : "No customer",
            message: locale === "ar"
              ? "الرجاء اختيار عميل موجود أو إدخال بيانات العميل."
              : "Please choose an existing customer or enter guest details.",
            tone: "danger"
          });
          return;
        }

        if (!existingCustomer && !walkInFirstName.trim()) {
          await dialog.alert({
            title: locale === "ar" ? "الاسم مطلوب" : "Name required",
            message: locale === "ar"
              ? "أدخل اسم العميل لإكمال البطاقة."
              : "Please enter the guest name to continue.",
            tone: "danger"
          });
          return;
        }

        if (!existingCustomer && !normalizedEmail) {
          await dialog.alert({
            title: locale === "ar" ? "البريد الإلكتروني مطلوب" : "Email required",
            message: locale === "ar"
              ? "لا يوجد حساب Refah لهذا العميل. أضف بريدًا إلكترونيًا للمتابعة."
              : "This customer does not have a Refah account. Please add an email to continue.",
            tone: "danger"
          });
          return;
        }

        if (!existingCustomer && normalizedEmail) {
          const proceed = await dialog.confirm({
            title: locale === "ar" ? "عميل غير مسجل" : "Guest recipient",
            message: locale === "ar"
              ? "هذا العميل لا يملك حساب Refah. سنرسل البطاقة عبر البريد الإلكتروني."
              : "This customer does not have a Refah account. We will send the gift card by email.",
            confirmText: locale === "ar" ? "متابعة" : "Continue",
            cancelText: locale === "ar" ? "إلغاء" : "Cancel",
            tone: "default"
          });
          if (!proceed) {
            return;
          }
        }

        await tenantApi.purchaseCartGiftCard({
          packageId: selectedPackage.id,
          customerId: existingCustomer?.id,
          customerName: `${walkInFirstName || formatName(existingCustomer) || ""} ${walkInLastName || ""}`.trim(),
          customerFirstName: walkInFirstName || existingCustomer?.firstName,
          customerLastName: walkInLastName || existingCustomer?.lastName,
          customerEmail: existingCustomer?.email || normalizedEmail,
          customerPhone: existingCustomer?.phone || walkInPhone.trim(),
          customerBirthDate: walkInBirthDate || undefined,
          amount: Number(selectedPackage.priceAmount || 0),
          paymentMethod,
          paymentAllocations,
          notes: giftMessage || undefined
        });

        await dialog.alert({
          title: locale === "ar" ? "تم الإرسال" : "Completed",
          message: locale === "ar"
            ? "تمت معالجة بطاقة الهدية بنجاح."
            : "Gift card purchase completed successfully.",
          tone: "success"
        });
        onCompleted?.();
        onClose();
        return;
      }

      if (selectedProducts.length === 0) {
        await dialog.alert({
          title: locale === "ar" ? "لا توجد منتجات" : "No products selected",
          message: locale === "ar"
            ? "اختر منتجًا واحدًا على الأقل."
            : "Please select at least one product.",
          tone: "danger"
        });
        return;
      }

      const existingCustomer = selectedCustomer;
      const normalizedEmail = walkInEmail.trim().toLowerCase();
      const hasGuestData = walkInFirstName.trim() || walkInLastName.trim() || normalizedEmail || walkInPhone.trim();

      if (!existingCustomer && !hasGuestData) {
        await dialog.alert({
          title: locale === "ar" ? "لا يوجد عميل" : "No customer",
          message: locale === "ar"
            ? "الرجاء اختيار عميل موجود أو إدخال بيانات العميل."
            : "Please choose an existing customer or enter guest details.",
          tone: "danger"
        });
        return;
      }

      if (!existingCustomer && !walkInFirstName.trim()) {
        await dialog.alert({
          title: locale === "ar" ? "الاسم مطلوب" : "Name required",
          message: locale === "ar"
            ? "أدخل اسم العميل لإرسال الفاتورة."
            : "Please enter the guest name to send the invoice.",
          tone: "danger"
        });
        return;
      }

      if (!existingCustomer && !normalizedEmail) {
        await dialog.alert({
          title: locale === "ar" ? "البريد الإلكتروني مطلوب" : "Email required",
          message: locale === "ar"
            ? "هذا العميل ليس لديه حساب Refah. أضف بريدًا إلكترونيًا لإرسال الفاتورة."
            : "This customer does not have a Refah account. Please add an email to send the invoice.",
          tone: "danger"
        });
        return;
      }

      if (!existingCustomer && normalizedEmail) {
        const proceed = await dialog.confirm({
          title: locale === "ar" ? "عميل غير مسجل" : "Guest recipient",
          message: locale === "ar"
            ? "سيتم إرسال الفاتورة عبر البريد الإلكتروني لهذا العميل."
            : "We will send the invoice to this email address.",
          confirmText: locale === "ar" ? "متابعة" : "Continue",
          cancelText: locale === "ar" ? "إلغاء" : "Cancel",
          tone: "default"
        });
        if (!proceed) {
          return;
        }
      }

      await tenantApi.purchaseCartProducts({
        items: selectedProducts.map((item) => ({
          productId: item.id,
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
          totalPrice: Number(item.price || 0) * Number(item.quantity || 0)
        })),
        customerId: existingCustomer?.id,
        customerName: `${walkInFirstName || formatName(existingCustomer) || ""} ${walkInLastName || ""}`.trim(),
        customerFirstName: walkInFirstName || existingCustomer?.firstName,
        customerLastName: walkInLastName || existingCustomer?.lastName,
        customerEmail: existingCustomer?.email || normalizedEmail,
        customerPhone: existingCustomer?.phone || walkInPhone.trim(),
        customerBirthDate: walkInBirthDate || undefined,
        recipientType,
        notes: giftMessage || undefined,
        paymentMethod,
        paymentAllocations
      });

      await dialog.alert({
        title: locale === "ar" ? "تمت العملية" : "Completed",
        message: locale === "ar"
          ? "تمت معالجة عملية المنتجات بنجاح."
          : "Product purchase completed successfully.",
        tone: "success"
      });
      onCompleted?.();
      onClose();
    } catch (error: any) {
      console.error("Cart checkout failed:", error);
      await dialog.alert({
        title: locale === "ar" ? "تعذر الإكمال" : "Checkout failed",
        message: error?.message || (locale === "ar" ? "تعذر إتمام العملية." : "Unable to complete the checkout."),
        tone: "danger"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const title = mode === "gift_card"
    ? (locale === "ar" ? "سلة البطاقات" : "Gift Card Cart")
    : (locale === "ar" ? "سلة المنتجات" : "Product Cart");
  const subtitle = mode === "gift_card"
    ? (locale === "ar" ? "اتبع الخطوات المختصرة لإكمال العملية." : "Follow the compact steps to complete the purchase.")
    : (locale === "ar" ? "اتبع الخطوات المختصرة لإكمال العملية." : "Follow the compact steps to complete the purchase.");
  const hasSelectedItems = mode === "gift_card" ? Boolean(selectedPackageId) : selectedProducts.length > 0;
  const customerReady = customerMode === "existing"
    ? Boolean(selectedCustomer)
    : Boolean(walkInFirstName.trim() && walkInEmail.trim());
  const paymentReady = isBalanced && subtotal > 0;

  const stepLabel = (value: CartStep) => {
    if (locale === "ar") {
      return value === 1 ? "المنتجات" : value === 2 ? "العميل" : "الدفع";
    }
    return value === 1 ? "Items" : value === 2 ? "Customer" : "Payment";
  };

  const goNext = () => {
    if (step === 1 && hasSelectedItems) {
      setStep(2);
      return;
    }

    if (step === 2 && customerReady) {
      setStep(3);
      return;
    }

    if (step === 3) {
      void handleSubmit();
    }
  };

  const goPrevious = () => {
    setStep((current) => (current > 1 ? ((current - 1) as CartStep) : current));
  };

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" onClick={onClose} />

      <aside
        className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-xl border-l border-gray-200 bg-white shadow-2xl`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary/70">
                {locale === "ar" ? "Cart" : "Cart"}
              </div>
              <h3 className="mt-1 text-xl font-bold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50"
              aria-label={locale === "ar" ? "إغلاق" : "Close"}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${step === 1 ? "bg-primary/10 text-primary" : step > 1 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step === 1 ? "bg-primary text-white" : step > 1 ? "bg-emerald-600 text-white" : "bg-white text-gray-500"}`}>1</span>
                  <span>{mode === "gift_card" ? (locale === "ar" ? "البطاقة" : "Item") : (locale === "ar" ? "المنتج" : "Item")}</span>
                </div>
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${step === 2 ? "bg-primary/10 text-primary" : step > 2 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step === 2 ? "bg-primary text-white" : step > 2 ? "bg-emerald-600 text-white" : "bg-white text-gray-500"}`}>2</span>
                  <span>{locale === "ar" ? "العميل" : "Customer"}</span>
                </div>
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${step === 3 ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step === 3 ? "bg-primary text-white" : "bg-white text-gray-500"}`}>3</span>
                  <span>{locale === "ar" ? "الدفع" : "Payment"}</span>
                </div>
              </div>
            </div>

            {step === 1 ? (
              mode === "gift_card" ? (
              <section className="rounded-3xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                      {locale === "ar" ? "بطاقات الهدايا" : "Gift cards"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {locale === "ar" ? "اختيار مختصر" : "Compact selection"}
                    </div>
                  </div>
                  <div className="inline-flex rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                    {giftCardPackages.length}
                  </div>
                </div>

                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={giftCardSearch}
                    onChange={(event) => setGiftCardSearch(event.target.value)}
                    placeholder={locale === "ar" ? "ابحث عن بطاقة..." : "Search packages..."}
                    className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {filteredGiftCards.map((item) => {
                    const active = item.id === selectedPackageId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedPackageId(item.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          active ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                          <GiftIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">{getPackageTitle(item)}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                            <span><Currency amount={Number(item.priceAmount || 0)} locale={locale === "ar" ? "ar-SA" : "en-US"} /></span>
                            <span>•</span>
                            <span>{locale === "ar" ? "رصيد" : "Credit"} <Currency amount={Number(item.walletCreditAmount || 0)} locale={locale === "ar" ? "ar-SA" : "en-US"} /></span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredGiftCards.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                      {locale === "ar" ? "لا توجد بطاقات مطابقة." : "No matching packages."}
                    </div>
                  ) : null}
                </div>
              </section>
              ) : (
              <section className="rounded-3xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                      {locale === "ar" ? "المنتجات" : "Products"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {locale === "ar" ? "بحث، تصنيف، وكمية" : "Search, category, quantity"}
                    </div>
                  </div>
                  <div className="inline-flex rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                    {selectedProducts.length}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder={locale === "ar" ? "ابحث عن منتج..." : "Search products..."}
                      className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <select
                    value={productCategory}
                    onChange={(event) => setProductCategory(event.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category === "all" ? (locale === "ar" ? "كل الفئات" : "All categories") : category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                  {filteredProducts.map((item) => {
                    const quantity = selectedProductQuantities[item.id] || 0;
                    return (
                      <div key={item.id} className="rounded-2xl border border-gray-200 p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                            <ShoppingBagIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-gray-900">{getProductTitle(item)}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                              <span>{item.category || (locale === "ar" ? "بدون فئة" : "No category")}</span>
                              <span>•</span>
                              <span><Currency amount={Number(item.price || 0)} locale={locale === "ar" ? "ar-SA" : "en-US"} /></span>
                              <span>•</span>
                              <span>{locale === "ar" ? "المخزون" : "Stock"} {Number(item.stock || 0)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedProductQuantities((current) => {
                                const next = { ...current };
                                const updated = Math.max(0, (next[item.id] || 0) - 1);
                                if (updated === 0) delete next[item.id];
                                else next[item.id] = updated;
                                return next;
                              })}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                            >
                              <MinusIcon className="h-4 w-4" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold text-gray-800">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedProductQuantities((current) => ({
                                ...current,
                                [item.id]: Math.min(Number(item.stock || 0), (current[item.id] || 0) + 1)
                              }))}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                      {locale === "ar" ? "لا توجد منتجات مطابقة." : "No matching products."}
                    </div>
                  ) : null}
                </div>
              </section>
              )
            ) : null}

            {step === 2 ? (
            <section className="rounded-3xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    {locale === "ar" ? "العميل" : "Customer"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {locale === "ar" ? "اختر عميلًا أو استمر كضيف" : "Choose a customer or continue as walk-in"}
                  </div>
                </div>
                {selectedCustomer ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <UserIcon className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[10rem]">{formatName(selectedCustomer) || selectedCustomer.email || selectedCustomer.phone}</span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("existing");
                    setSelectedCustomer(null);
                  }}
                  className={`rounded-2xl border p-3 text-left transition ${customerMode === "existing" ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <div className="text-sm font-semibold text-gray-900">{locale === "ar" ? "عميل Refah" : "Refah customer"}</div>
                  <div className="mt-1 text-xs text-gray-500">{locale === "ar" ? "ابحث واختر عميلًا موجودًا" : "Search and pick an existing client"}</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("walk_in");
                    setSelectedCustomer(null);
                  }}
                  className={`rounded-2xl border p-3 text-left transition ${customerMode === "walk_in" ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <div className="text-sm font-semibold text-gray-900">{locale === "ar" ? "Walk-in" : "Walk-in"}</div>
                  <div className="mt-1 text-xs text-gray-500">{locale === "ar" ? "أدخل بيانات العميل" : "Enter customer details"}</div>
                </button>
              </div>

              {mode === "product" ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRecipientType("self")}
                    className={`rounded-2xl border p-3 text-left transition ${recipientType === "self" ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    <div className="text-sm font-semibold text-gray-900">{locale === "ar" ? "لنفسه" : "Self purchase"}</div>
                    <div className="mt-1 text-xs text-gray-500">{locale === "ar" ? "فاتورة فقط" : "Invoice only"}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType("gift")}
                    className={`rounded-2xl border p-3 text-left transition ${recipientType === "gift" ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    <div className="text-sm font-semibold text-gray-900">{locale === "ar" ? "هدية" : "Gift"}</div>
                    <div className="mt-1 text-xs text-gray-500">{locale === "ar" ? "رسالة وإرسال" : "Add a message and send"}</div>
                  </button>
                </div>
              ) : null}

              {customerMode === "existing" ? (
                <>
                  <div className="mt-3 relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder={locale === "ar" ? "ابحث عن عميل..." : "Search customer..."}
                      className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {customerLoading ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500">
                        {locale === "ar" ? "جارٍ تحميل العملاء..." : "Loading customers..."}
                      </div>
                    ) : (
                      customerResults.map((customer) => {
                        const active = selectedCustomer?.id === customer.id;
                        return (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(customer);
                            }}
                            className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
                              active ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-gray-900">{formatName(customer) || customer.email || customer.phone}</div>
                              <div className="truncate text-xs text-gray-500">{customer.email || customer.phone || ""}</div>
                            </div>
                            {active ? <span className="text-xs font-semibold text-primary">{locale === "ar" ? "مختار" : "Selected"}</span> : null}
                          </button>
                        );
                      })
                    )}
                    {!customerLoading && customerResults.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500">
                        {locale === "ar" ? "لا توجد عملاء مطابقة." : "No customers found."}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={walkInFirstName}
                    onChange={(event) => setWalkInFirstName(event.target.value)}
                    placeholder={locale === "ar" ? "الاسم الأول" : "First name"}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <input
                    value={walkInLastName}
                    onChange={(event) => setWalkInLastName(event.target.value)}
                    placeholder={locale === "ar" ? "اسم العائلة" : "Last name"}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <input
                    value={walkInEmail}
                    onChange={(event) => setWalkInEmail(event.target.value)}
                    placeholder={locale === "ar" ? "البريد الإلكتروني" : "Email"}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <input
                    value={walkInPhone}
                    onChange={(event) => setWalkInPhone(event.target.value)}
                    placeholder={locale === "ar" ? "الجوال" : "Mobile"}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  {mode === "gift_card" ? (
                    <input
                      value={walkInBirthDate}
                      onChange={(event) => setWalkInBirthDate(event.target.value)}
                      type="date"
                      placeholder={locale === "ar" ? "تاريخ الميلاد" : "Birth date"}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:col-span-2"
                    />
                  ) : null}
                </div>
              )}

              {mode === "product" && recipientType === "gift" ? (
                <textarea
                  value={giftMessage}
                  onChange={(event) => setGiftMessage(event.target.value)}
                  rows={2}
                  placeholder={locale === "ar" ? "رسالة هدية اختيارية" : "Optional gift message"}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              ) : null}
            </section>
            ) : null}

            <section className={`rounded-3xl border border-gray-200 bg-white p-4 ${step === 3 ? "" : "hidden"}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    {locale === "ar" ? "الدفع" : "Payment"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {locale === "ar" ? "دفع مختصر أو مجزأ" : "Single or split payment"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addPaymentRow}
                  className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  {locale === "ar" ? "إضافة طريقة" : "Add method"}
                </button>
              </div>

              <div className="space-y-3">
                {paymentRows.map((row) => (
                  <div key={row.id} className="flex items-end gap-2 rounded-2xl border border-gray-200 p-3">
                    <div className="flex-1">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                        {locale === "ar" ? "الطريقة" : "Method"}
                      </div>
                      <select
                        value={row.paymentMethod}
                        onChange={(event) => updatePaymentRow(row.id, { paymentMethod: event.target.value as PaymentMethod })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      >
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method.value} value={method.value}>
                            {locale === "ar" ? method.labelAr : method.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                        {locale === "ar" ? "المبلغ" : "Amount"}
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.amount}
                          onChange={(event) => updatePaymentRow(row.id, { amount: event.target.value })}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePaymentRow(row.id)}
                      className="rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "حذف" : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {step === 3 ? (
            <section className="rounded-3xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{locale === "ar" ? "المبلغ المستحق" : "Amount due"}</span>
                  <span className="font-semibold text-gray-900"><Currency amount={totalDue} locale={locale === "ar" ? "ar-SA" : "en-US"} /></span>
                </div>
              {mode === "product" ? (
                <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                  <span>{locale === "ar" ? "الضريبة" : "Tax"}</span>
                  <span className="font-semibold text-gray-900"><Currency amount={taxAmount} locale={locale === "ar" ? "ar-SA" : "en-US"} /></span>
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                <span>{locale === "ar" ? "إجمالي الدفعات" : "Split total"}</span>
                <span className="font-semibold text-gray-900"><Currency amount={splitTotal} locale={locale === "ar" ? "ar-SA" : "en-US"} /></span>
              </div>
              <div className={`mt-3 rounded-2xl px-3 py-2 text-sm font-medium ${isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {isBalanced
                  ? (locale === "ar" ? "إجمالي الدفعات يطابق المبلغ المستحق." : "The split total matches the amount due.")
                  : (locale === "ar" ? `يوجد فرق ${difference.toFixed(2)} ر.س` : `Difference ${difference.toFixed(2)} SAR`)}
              </div>
            </section>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </button>

            <div className="flex items-center gap-2">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goPrevious}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {locale === "ar" ? "السابق" : "Previous"}
                </button>
              ) : null}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={(step === 1 && !hasSelectedItems) || (step === 2 && !customerReady)}
                  className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {locale === "ar" ? "التالي" : "Next"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !paymentReady}
                  className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "تنفيذ" : "Apply")}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
