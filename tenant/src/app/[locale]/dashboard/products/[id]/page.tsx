"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

const CATEGORIES = [
  "Hair Care",
  "Skin Care",
  "Makeup",
  "Fragrance",
  "Tools & Accessories",
  "General"
];

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
  ingredients?: string;
  isAvailable: boolean;
  isFeatured: boolean;
}

export default function EditProductPage() {
  const t = useTranslations("Products");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name_en: "",
    name_ar: "",
    description_en: "",
    description_ar: "",
    price: "",
    category: "General",
    stock: "",
    sku: "",
    brand: "",
    size: "",
    color: "",
    ingredients: "",
    isAvailable: true,
    isFeatured: false
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError("");
      
      const response = await tenantApi.getProduct(id as string);
      
      if (response.success && response.product) {
        const prod = response.product;
        setFormData({
          name_en: prod.name_en || "",
          name_ar: prod.name_ar || "",
          description_en: prod.description_en || "",
          description_ar: prod.description_ar || "",
          price: prod.price?.toString() || "",
          category: prod.category || "General",
          stock: prod.stock?.toString() || "",
          sku: prod.sku || "",
          brand: prod.brand || "",
          size: prod.size || "",
          color: prod.color || "",
          ingredients: prod.ingredients || "",
          isAvailable: prod.isAvailable !== undefined ? prod.isAvailable : true,
          isFeatured: prod.isFeatured !== undefined ? prod.isFeatured : false
        });
        
        if (prod.image) {
          setExistingImage(`http://localhost:5000/uploads/${prod.image}`);
          setImagePreview(`http://localhost:5000/uploads/${prod.image}`);
        }
      } else {
        setError(response.message || "Failed to load product");
      }
    } catch (err: any) {
      console.error("Failed to load product:", err);
      setError(err.message || "Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "isAvailable" || name === "isFeatured") {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const submitData = new FormData();
      
      // Append all form fields
      submitData.append("name_en", formData.name_en);
      submitData.append("name_ar", formData.name_ar);
      if (formData.description_en) submitData.append("description_en", formData.description_en);
      if (formData.description_ar) submitData.append("description_ar", formData.description_ar);
      submitData.append("price", formData.price);
      submitData.append("category", formData.category);
      submitData.append("stock", formData.stock);
      if (formData.sku) submitData.append("sku", formData.sku);
      if (formData.brand) submitData.append("brand", formData.brand);
      if (formData.size) submitData.append("size", formData.size);
      if (formData.color) submitData.append("color", formData.color);
      if (formData.ingredients) submitData.append("ingredients", formData.ingredients);
      submitData.append("isAvailable", formData.isAvailable.toString());
      submitData.append("isFeatured", formData.isFeatured.toString());
      
      // Append image only if a new one is selected
      if (imageFile) {
        submitData.append("image", imageFile);
      }

      const response = await tenantApi.updateProduct(id as string, submitData);
      
      if (response.success) {
        router.push(`/${locale}/dashboard/products`);
      } else {
        setError(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update product:", err);
      setError(err.message || t("updateError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("edit")} {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'تعديل معلومات المنتج' : 'Edit product information'}
            </p>
          </div>
          <Link href={`/${locale}/dashboard/products`} className="btn btn-secondary">
            {t("cancel")}
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Form - Same structure as new page */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("nameEn")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name_en"
                    value={formData.name_en}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("nameAr")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name_ar"
                    value={formData.name_ar}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("descriptionEn")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <textarea
                    name="description_en"
                    value={formData.description_en}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("descriptionAr")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <textarea
                    name="description_ar"
                    value={formData.description_ar}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'تفاصيل المنتج' : 'Product Details'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("category")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("brand")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("size")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    placeholder={locale === 'ar' ? 'مثال: 100ml' : 'e.g., 100ml'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("color")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="text"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("sku")} <span className="text-gray-400">({t("optional")})</span>
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder={locale === 'ar' ? 'رمز المنتج الفريد' : 'Unique product code'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("ingredients")} <span className="text-gray-400">({t("optional")})</span>
                </label>
                <textarea
                  name="ingredients"
                  value={formData.ingredients}
                  onChange={handleChange}
                  rows={3}
                  placeholder={locale === 'ar' ? 'المكونات أو المواد' : 'Ingredients or materials'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Image & Pricing */}
          <div className="space-y-6">
            {/* Image Upload */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("image")}
              </h3>
              
              <div className="space-y-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(existingImage);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-6xl">📦</span>
                  </div>
                )}
                
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <span className="btn btn-secondary w-full text-center cursor-pointer">
                    {imagePreview && imagePreview !== existingImage ? t("changeImage") : t("uploadImage")}
                  </span>
                </label>
              </div>
            </div>

            {/* Pricing & Inventory */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'التسعير والمخزون' : 'Pricing & Inventory'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("price")} (SAR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("stock")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="card space-y-4">
              <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <input
                  type="checkbox"
                  name="isAvailable"
                  checked={formData.isAvailable}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <label className="font-medium text-gray-700">{t("isAvailable")}</label>
              </div>

              <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <label className="font-medium text-gray-700">{t("isFeatured")}</label>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link href={`/${locale}/dashboard/products`} className="btn btn-secondary">
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? t("loading") : t("save")}
          </button>
        </div>
      </form>
    </TenantLayout>
  );
}

