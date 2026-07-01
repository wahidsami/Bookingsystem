"use client";

import { useState, useEffect, useMemo } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { getProductStockTone, type ProductFilterMode } from "@/lib/productHelpers";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { useAppDialog } from "@/components/AppDialogProvider";
import {
  ArrowPathIcon,
  PencilSquareIcon,
  PlusIcon,
  PhotoIcon,
  PowerIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

interface Product {
  id: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  image?: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
  brand?: string;
  size?: string;
  color?: string;
  isAvailable: boolean;
  isFeatured: boolean;
  soldCount: number;
  usedAsGiftCount: number;
  createdAt: string;
}

export default function ProductsPage() {
  const dialog = useAppDialog();
  const t = useTranslations("Products");
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<ProductFilterMode>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [error, setError] = useState("");
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const [response, limitsData] = await Promise.all([
        tenantApi.getProducts(),
        tenantApi.getSubscriptionLimits().catch(() => null)
      ]);

      if (limitsData?.products) {
        setLimits(limitsData.products);
      }

      // Handle different response structures
      const data = response.data || response;

      if (data.success !== false) {
        // Response is successful (either success: true or success is undefined but no error)
        const productsList = data.products || data.data?.products || [];
        setProducts(productsList);

        if (productsList.length === 0) {
          console.log("No products found. Response:", response);
        }
      } else {
        setError(data.message || t("loadError"));
        setProducts([]);
      }
    } catch (err: any) {
      console.error("Failed to load products:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        response: err.response
      });
      setError(err.message || t("loadError"));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filterOptions = useMemo(() => ([
    { value: "all", label: locale === "ar" ? "كل المنتجات" : "All products" },
    { value: "available", label: t("available") },
    { value: "unavailable", label: t("unavailable") },
    { value: "featured", label: t("featured") },
    { value: "in_stock", label: locale === "ar" ? "متوفر بالمخزون" : "In stock" },
    { value: "low_stock", label: locale === "ar" ? "مخزون منخفض" : "Low stock" },
    { value: "out_of_stock", label: locale === "ar" ? "نفد المخزون" : "Out of stock" },
    { value: "az", label: locale === "ar" ? "ترتيب أ-ي" : "Sort A-Z" },
    { value: "za", label: locale === "ar" ? "ترتيب ي-أ" : "Sort Z-A" },
    { value: "newest", label: locale === "ar" ? "الأحدث" : "Newest" },
    { value: "oldest", label: locale === "ar" ? "الأقدم" : "Oldest" }
  ]), [locale, t]);

  const productsAfterGlobalFilters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const searchable = `${product.name_en || ""} ${product.name_ar || ""} ${product.description_en || ""} ${product.description_ar || ""} ${product.brand || ""} ${product.sku || ""}`.toLowerCase();
      if (term && !searchable.includes(term)) return false;

      switch (filterMode) {
        case "available":
          return product.isAvailable;
        case "unavailable":
          return !product.isAvailable;
        case "featured":
          return product.isFeatured;
        case "in_stock":
          return Number(product.stock || 0) > 10;
        case "low_stock":
          return Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 10;
        case "out_of_stock":
          return Number(product.stock || 0) <= 0;
        default:
          return true;
      }
    });

    const sorted = [...filtered];
    switch (filterMode) {
      case "az":
        sorted.sort((a, b) => (locale === "ar" ? (a.name_ar || "").localeCompare(b.name_ar || "") : (a.name_en || "").localeCompare(b.name_en || "")));
        break;
      case "za":
        sorted.sort((a, b) => (locale === "ar" ? (b.name_ar || "").localeCompare(a.name_ar || "") : (b.name_en || "").localeCompare(a.name_en || "")));
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      default:
        break;
    }

    return sorted;
  }, [filterMode, locale, products, searchTerm]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    productsAfterGlobalFilters.forEach((product) => {
      const category = (product.category || "").trim() || (locale === "ar" ? "غير مصنف" : "Uncategorized");
      map.set(category, (map.get(category) || 0) + 1);
    });

    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return [
      { key: "all", name: t("allCategories"), count: productsAfterGlobalFilters.length },
      ...entries.map(([name, count]) => ({ key: name, name, count }))
    ];
  }, [productsAfterGlobalFilters, locale, t]);

  const visibleProducts = useMemo(() => {
    if (selectedCategory === "all") {
      return productsAfterGlobalFilters;
    }

    return productsAfterGlobalFilters.filter((product) => {
      const category = (product.category || "").trim() || (locale === "ar" ? "غير مصنف" : "Uncategorized");
      return category === selectedCategory;
    });
  }, [locale, productsAfterGlobalFilters, selectedCategory]);

  const currentCategoryLabel = useMemo(() => {
    return categories.find((category) => category.key === selectedCategory)?.name || t("allCategories");
  }, [categories, selectedCategory, t]);

  const handleDelete = async (id: string, name: string) => {
    const productName = locale === 'ar' ? name : name;
    if (!(await dialog.confirm(locale === 'ar'
      ? `هل أنت متأكد من حذف المنتج "${productName}"؟`
      : `Are you sure you want to delete product "${productName}"?`))) {
      return;
    }

    try {
      const response = await tenantApi.deleteProduct(id);
      if (response.success) {
        await dialog.alert({
          title: locale === 'ar' ? 'تم الحذف' : 'Deleted',
          message: locale === 'ar' ? `تم حذف المنتج "${productName}" بنجاح.` : `Product "${productName}" was deleted successfully.`,
          tone: "success"
        });
        await loadProducts();
      } else {
        await dialog.alert({
          title: locale === 'ar' ? 'تعذر الحذف' : 'Delete failed',
          message: response.message || t("deleteError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر الحذف' : 'Delete failed',
        message: err.message || t("deleteError"),
        tone: "danger"
      });
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    const nextIsAvailable = !product.isAvailable;
    const confirmed = await dialog.confirm(
      locale === 'ar'
        ? `هل تريد ${nextIsAvailable ? "تفعيل" : "إيقاف"} المنتج "${product.name_ar || product.name_en}"؟`
        : `Do you want to ${nextIsAvailable ? "activate" : "deactivate"} product "${product.name_en || product.name_ar}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const payload = new FormData();
      payload.append("isAvailable", String(nextIsAvailable));
      payload.append("rawPrice", String(product.price ?? 0));
      payload.append("stock", String(product.stock ?? 0));

      const response = await tenantApi.updateProduct(product.id, payload);
      if (response.success) {
        await dialog.alert({
          title: locale === 'ar' ? 'تم التحديث' : 'Updated',
          message: locale === 'ar'
            ? `تم ${nextIsAvailable ? "تفعيل" : "إيقاف"} المنتج بنجاح.`
            : `Product was ${nextIsAvailable ? "activated" : "deactivated"} successfully.`,
          tone: "success"
        });
        await loadProducts();
      } else {
        await dialog.alert({
          title: locale === 'ar' ? 'فشل التحديث' : 'Update failed',
          message: response.message || t("loadError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to update product status:", err);
      await dialog.alert({
        title: locale === 'ar' ? 'فشل التحديث' : 'Update failed',
        message: err.message || t("loadError"),
        tone: "danger"
      });
    }
  };

  return (
    <TenantLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_28px_100px_rgba(15,23,42,0.3)] sm:p-6">
          <div className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className="max-w-3xl space-y-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                {locale === 'ar' ? 'واجهة المنتجات' : 'Products shell'}
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">{t("subtitle")}</p>
            </div>
            {limits && (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
                <div className="text-slate-400">{locale === 'ar' ? 'الحد المسموح' : 'Limit'}</div>
                <div className={`text-xl font-semibold ${!limits.allowed ? 'text-red-300' : 'text-white'}`}>
                  {limits.current} / {limits.limit}
                </div>
              </div>
            )}
          </div>

          <div className={`mt-5 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </div>
              <div className="w-full lg:w-72">
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as ProductFilterMode)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Link
              href={limits && !limits.allowed ? '#' : `/${locale}/dashboard/products/new`}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400 ${limits && !limits.allowed ? 'pointer-events-none opacity-50' : ''}`}
              onClick={(e) => {
                if (limits && !limits.allowed) {
                  e.preventDefault();
                  dialog.alert({
                    title: locale === 'ar' ? 'الحد وصل' : 'Limit reached',
                    message: locale === 'ar' ? 'تم الوصول للحد الأقصى في الباقة الحالية.' : 'You have reached your current package limit.',
                    tone: 'danger'
                  });
                }
              }}
            >
              <PlusIcon className="h-5 w-5" />
              <span>{t("addProduct")}</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
              <ArrowPathIcon className="h-5 w-5 animate-spin text-cyan-300" />
              <p className="text-sm text-slate-300">{t("loading")}</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 py-16 text-center text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
            <PhotoIcon className="mb-4 h-14 w-14 text-slate-500" />
            <h3 className="text-xl font-semibold text-white">{t("noProducts")}</h3>
            <p className="mt-2 max-w-md text-sm text-slate-300">{t("noProductsDesc")}</p>
            <Link href={`/${locale}/dashboard/products/new`} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400">
              <PlusIcon className="h-5 w-5" />
              <span>{t("addFirstProduct")}</span>
            </Link>
          </div>
        ) : (
          <div className={`grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] ${isRTL ? 'lg:[direction:rtl]' : ''}`}>
            <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <h3 className="text-lg font-bold text-white">{locale === 'ar' ? 'الفئات' : 'Categories'}</h3>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {categories.length - 1}
                </span>
              </div>
              <div className="space-y-2">
                {categories.map((category) => {
                  const active = selectedCategory === category.key;
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setSelectedCategory(category.key)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100 shadow-[0_10px_30px_rgba(6,182,212,0.12)]'
                          : 'border-white/10 bg-slate-950/40 text-slate-200 hover:border-cyan-300/30 hover:bg-white/10'
                      }`}
                      style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                    >
                      <span className="font-medium">{category.name}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-slate-200'}`}>
                        {category.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <h3 className="text-xl font-bold text-white">{currentCategoryLabel}</h3>
                  <p className="text-sm text-slate-300">
                    {visibleProducts.length} {locale === 'ar' ? 'منتج' : 'products'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadProducts()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>{locale === 'ar' ? 'تحديث' : 'Refresh'}</span>
                </button>
              </div>

              {visibleProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 py-16 text-center">
                  <PhotoIcon className="h-14 w-14 text-slate-500" />
                  <h4 className="mt-4 text-lg font-semibold text-white">{t("noProducts")}</h4>
                  <p className="mt-2 text-sm text-slate-300">{t("noProductsDesc")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleProducts.map((product) => {
                    const stock = Number(product.stock || 0);
                    const stockLabel = stock <= 0
                      ? (locale === 'ar' ? 'نفد المخزون' : 'Out of stock')
                      : stock <= 10
                        ? (locale === 'ar' ? 'مخزون منخفض' : 'Low stock')
                        : (locale === 'ar' ? 'متوفر' : 'In stock');

                    return (
                      <div
                        key={product.id}
                        className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.14)] transition hover:border-cyan-300/20 hover:shadow-[0_18px_60px_rgba(15,23,42,0.22)]"
                      >
                        <div className={`flex flex-col gap-4 xl:flex-row xl:items-center ${isRTL ? 'xl:flex-row-reverse' : ''}`}>
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
                              {product.image ? (
                                <img
                                  src={getImageUrl(product.image)}
                                  alt={locale === 'ar' ? product.name_ar : product.name_en}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <PhotoIcon className="h-8 w-8 text-slate-500" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                              <h4 className="truncate text-lg font-bold text-white">
                                {locale === 'ar' ? product.name_ar : product.name_en}
                              </h4>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium">
                                  {locale === 'ar' ? 'المخزون' : 'Stock'}: {product.stock} {t("units")}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium">
                                  {locale === 'ar' ? 'الفئة' : 'Category'}: {(product.category || "").trim() || (locale === "ar" ? "غير مصنف" : "Uncategorized")}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${product.isAvailable ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
                                  {product.isAvailable ? t("available") : t("unavailable")}
                                </span>
                                {product.isFeatured && (
                                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-200">
                                    {t("featured")}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                                {product.brand && <span>{locale === 'ar' ? 'العلامة' : 'Brand'}: {product.brand}</span>}
                                {product.sku && <span>• SKU: {product.sku}</span>}
                                <span>• {stockLabel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-between gap-4 xl:flex-col xl:items-end">
                            <div className="text-right">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                                {t("price")}
                              </div>
                              <div className={`text-2xl font-bold ${getProductStockTone(stock)}`}>
                                <Currency amount={product.price} />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Link
                                href={`/${locale}/dashboard/products/${product.id}`}
                                title={t("edit")}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-200"
                              >
                                <PencilSquareIcon className="h-5 w-5" />
                              </Link>
                              <button
                                type="button"
                                title={product.isAvailable ? (locale === 'ar' ? 'إيقاف' : 'Deactivate') : (locale === 'ar' ? 'تفعيل' : 'Activate')}
                                onClick={() => handleToggleAvailability(product)}
                                className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                                  product.isAvailable
                                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200'
                                }`}
                              >
                                <PowerIcon className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                title={t("delete")}
                                onClick={() => handleDelete(product.id, locale === 'ar' ? product.name_ar : product.name_en)}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 text-red-200 transition hover:bg-red-500/15"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}

