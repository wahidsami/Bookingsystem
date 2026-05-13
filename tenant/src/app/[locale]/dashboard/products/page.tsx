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
  FunnelIcon,
  PencilSquareIcon,
  PhotoIcon,
  PowerIcon,
  TagIcon,
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
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("subtitle")}
            </p>
          </div>
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {limits && (
              <div className="text-sm px-3 py-1 bg-gray-100 rounded-lg whitespace-nowrap">
                <span className="text-gray-500">{isRTL ? 'الحد المسموح:' : 'Limit:'} </span>
                <span className={`font-medium ${!limits.allowed ? 'text-red-600' : 'text-gray-900'}`}>
                  {limits.current} / {limits.limit}
                </span>
              </div>
            )}
            <Link
              href={limits && !limits.allowed ? '#' : `/${locale}/dashboard/products/new`}
              className={`btn btn-primary ${limits && !limits.allowed ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              onClick={(e) => {
                if (limits && !limits.allowed) {
                  e.preventDefault();
                  void dialog.alert({
                    title: locale === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit reached',
                    message: isRTL ? 'تم الوصول للحد الأقصى لباقتك' : 'You have reached your subscription limit',
                    tone: "default"
                  });
                }
              }}
            >
              <span className="mr-2">{isRTL ? '➕' : ''}</span>
              {t("addProduct")}
              <span className="ml-2">{!isRTL ? '➕' : ''}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={`card mb-6 ${isRTL ? 'text-right' : ''}`}>
        <div className={`flex flex-col md:flex-row gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>

          {/* Global Filter */}
          <div className="w-full md:w-56">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as ProductFilterMode)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FunnelIcon className="h-4 w-4" />
            <span>{visibleProducts.length} / {products.length}</span>
          </div>
        </div>

        <div className={`mt-4 flex flex-wrap gap-2 ${isRTL ? 'justify-end' : 'justify-start'}`}>
          {categories.map((category) => {
            const selected = selectedCategory === category.key;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setSelectedCategory(category.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary'
                }`}
              >
                {category.name} ({category.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <ArrowPathIcon className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-gray-600">{t("loading")}</p>
          </div>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <PhotoIcon className="mb-4 h-14 w-14 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noProducts")}</h3>
          <p className="text-gray-600 mb-6">{t("noProductsDesc")}</p>
          <Link href={`/${locale}/dashboard/products/new`} className="btn btn-primary">
            {t("addFirstProduct")}
          </Link>
        </div>
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleProducts.map((product) => (
            <div key={product.id} className="rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm transition hover:shadow-md">
              {/* Product Image */}
              <div className="relative mb-4">
                <div className="w-full h-44 bg-white rounded-2xl overflow-hidden flex items-center justify-center ring-1 ring-gray-200">
                  {product.image ? (
                    <img
                      src={getImageUrl(product.image)}
                      alt={locale === 'ar' ? product.name_ar : product.name_en}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PhotoIcon className="h-10 w-10 text-gray-300" />
                  )}
                </div>
                {product.isFeatured && (
                  <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full`}>
                    {t("featured")}
                  </div>
                )}
                <div
                  className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} w-3 h-3 rounded-full border-2 border-white ${product.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  title={product.isAvailable ? t("available") : t("unavailable")}
                ></div>
              </div>

              {/* Product Info */}
              <div className="mb-3">
                <h3 className="text-lg font-bold text-gray-900 truncate mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? product.name_ar : product.name_en}
                </h3>
                <div className="flex flex-wrap gap-2" style={{ justifyContent: isRTL ? 'flex-end' : 'flex-start' }}>
                  {product.category && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                      <TagIcon className="h-3.5 w-3.5" />
                      {product.category}
                    </span>
                  )}
                  {product.brand && (
                    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                      {product.brand}
                    </span>
                  )}
                </div>
              </div>

              {/* Price and Stock */}
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("price")}</span>
                  <span className="font-bold text-primary">
                    <Currency amount={product.price} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("stock")}</span>
                  <span className={`font-semibold ${getProductStockTone(Number(product.stock || 0))}`}>
                    {product.stock} {t("units")}
                  </span>
                </div>
                {product.sku && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{t("sku")}</span>
                    <span className="text-sm font-mono text-gray-700">{product.sku}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              {(product.soldCount > 0 || product.usedAsGiftCount > 0) && (
                <div className="mb-3 p-3 bg-white rounded-2xl ring-1 ring-gray-200">
                  {product.soldCount > 0 && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{t("sold")}</span>
                      <span className="text-xs font-semibold text-gray-900">{product.soldCount}</span>
                    </div>
                  )}
                  {product.usedAsGiftCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{t("usedAsGift")}</span>
                      <span className="text-xs font-semibold text-gray-900">{product.usedAsGiftCount}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className={`flex items-center justify-end gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link
                  href={`/${locale}/dashboard/products/${product.id}`}
                  title={t("edit")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 transition hover:border-primary hover:text-primary"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggleAvailability(product)}
                  title={product.isAvailable ? (locale === 'ar' ? 'إيقاف' : 'Deactivate') : (locale === 'ar' ? 'تفعيل' : 'Activate')}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                    product.isAvailable
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <PowerIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(product.id, locale === 'ar' ? product.name_ar : product.name_en)}
                  title={t("delete")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </TenantLayout>
  );
}

