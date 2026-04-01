"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

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

const CATEGORIES = [
  "Hair Care",
  "Skin Care",
  "Makeup",
  "Fragrance",
  "Tools & Accessories",
  "General"
];

export default function ProductsPage() {
  const t = useTranslations("Products");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAvailable, setFilterAvailable] = useState<boolean | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [error, setError] = useState("");
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    loadProducts();
  }, [filterAvailable, filterCategory, searchTerm]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const params: any = {};
      if (filterAvailable !== undefined) {
        params.isAvailable = filterAvailable;
      }
      if (filterCategory) {
        params.category = filterCategory;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const [response, limitsData] = await Promise.all([
        tenantApi.getProducts(params),
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

        if (productsList.length === 0 && !filterAvailable && !filterCategory && !searchTerm) {
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

  const handleDelete = async (id: string, name: string) => {
    const productName = locale === 'ar' ? name : name;
    if (!confirm(locale === 'ar'
      ? `هل أنت متأكد من حذف المنتج "${productName}"؟`
      : `Are you sure you want to delete product "${productName}"?`)) {
      return;
    }

    try {
      const response = await tenantApi.deleteProduct(id);
      if (response.success) {
        loadProducts();
      } else {
        alert(response.message || t("deleteError"));
      }
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      alert(err.message || t("deleteError"));
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
                  alert(isRTL ? 'تم الوصول للحد الأقصى לבاقتك' : 'You have reached your subscription limit');
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

          {/* Category Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="">{t("allCategories")}</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Available Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterAvailable(undefined)}
              className={`px-4 py-2 rounded-lg transition-colors ${filterAvailable === undefined
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              {t("all")}
            </button>
            <button
              onClick={() => setFilterAvailable(true)}
              className={`px-4 py-2 rounded-lg transition-colors ${filterAvailable === true
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              {t("available")}
            </button>
            <button
              onClick={() => setFilterAvailable(false)}
              className={`px-4 py-2 rounded-lg transition-colors ${filterAvailable === false
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              {t("unavailable")}
            </button>
          </div>
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
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🛍️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noProducts")}</h3>
          <p className="text-gray-600 mb-6">{t("noProductsDesc")}</p>
          <Link href={`/${locale}/dashboard/products/new`} className="btn btn-primary">
            {t("addFirstProduct")}
          </Link>
        </div>
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="card hover:shadow-xl transition-shadow">
              {/* Product Image */}
              <div className="relative mb-4">
                <div className="w-full h-48 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                  {product.image ? (
                    <img
                      src={getImageUrl(product.image)}
                      alt={locale === 'ar' ? product.name_ar : product.name_en}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl">📦</span>
                  )}
                </div>
                {product.isFeatured && (
                  <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded`}>
                    ⭐ {t("featured")}
                  </div>
                )}
                <div
                  className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} w-6 h-6 rounded-full border-2 border-white ${product.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  title={product.isAvailable ? t("available") : t("unavailable")}
                ></div>
              </div>

              {/* Product Info */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? product.name_ar : product.name_en}
                </h3>
                {product.category && (
                  <p className="text-sm text-gray-600 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    📂 {product.category}
                  </p>
                )}
                {product.brand && (
                  <p className="text-sm text-gray-600 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    🏷️ {product.brand}
                  </p>
                )}
              </div>

              {/* Price and Stock */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("price")}</span>
                  <span className="font-semibold text-gray-900">
                    <Currency amount={product.price} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("stock")}</span>
                  <span className={`font-semibold ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
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
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
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
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link
                  href={`/${locale}/dashboard/products/${product.id}`}
                  className="flex-1 btn btn-secondary text-center"
                >
                  {t("edit")}
                </Link>
                <button
                  onClick={() => handleDelete(product.id, locale === 'ar' ? product.name_ar : product.name_en)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </TenantLayout>
  );
}

