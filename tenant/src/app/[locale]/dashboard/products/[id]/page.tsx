"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { SparklesIcon, LanguageIcon } from "@heroicons/react/24/outline";

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
  allowsDelivery?: boolean;
  allowsPickup?: boolean;
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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [hasAIFeature, setHasAIFeature] = useState(false);
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
    ingredients_en: "",
    ingredients_ar: "",
    howToUse_en: "",
    howToUse_ar: "",
    features_en: "",
    features_ar: "",
    isAvailable: true,
    isFeatured: false,
    allowsDelivery: true,
    allowsPickup: true
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProduct();
      checkSubscriptionLimits();
    }
  }, [id]);

  const checkSubscriptionLimits = async () => {
    try {
      const response = await tenantApi.getSubscriptionLimits();
      if (response.success && response.limits) {
        setHasAIFeature(response.limits.hasAIContentAssistant || false);
      }
    } catch (err) {
      console.error("Failed to fetch subscription limits:", err);
    }
  };

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
          ingredients_en: prod.ingredients_en || "",
          ingredients_ar: prod.ingredients_ar || "",
          howToUse_en: prod.howToUse_en || "",
          howToUse_ar: prod.howToUse_ar || "",
          features_en: prod.features_en || "",
          features_ar: prod.features_ar || "",
          isAvailable: prod.isAvailable !== undefined ? prod.isAvailable : true,
          isFeatured: prod.isFeatured !== undefined ? prod.isFeatured : false,
          allowsDelivery: prod.allowsDelivery !== undefined ? prod.allowsDelivery : true,
          allowsPickup: prod.allowsPickup !== undefined ? prod.allowsPickup : true
        });

        if (prod.image) {
          setExistingImage(getImageUrl(prod.image));
          setImagePreview(getImageUrl(prod.image));
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

    if (name === "isAvailable" || name === "isFeatured" || name === "allowsDelivery" || name === "allowsPickup") {
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
      if (formData.ingredients_en) submitData.append("ingredients_en", formData.ingredients_en);
      if (formData.ingredients_ar) submitData.append("ingredients_ar", formData.ingredients_ar);
      if (formData.howToUse_en) submitData.append("howToUse_en", formData.howToUse_en);
      if (formData.howToUse_ar) submitData.append("howToUse_ar", formData.howToUse_ar);
      if (formData.features_en) submitData.append("features_en", formData.features_en);
      if (formData.features_ar) submitData.append("features_ar", formData.features_ar);
      submitData.append("isAvailable", String(formData.isAvailable ?? true));
      submitData.append("isFeatured", String(formData.isFeatured ?? false));
      submitData.append("allowsDelivery", String(formData.allowsDelivery ?? true));
      submitData.append("allowsPickup", String(formData.allowsPickup ?? true));

      // Append image only if a new one is selected (field name must be 'images' to match server multer)
      if (imageFile) {
        submitData.append("images", imageFile);
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

  const handleAIFill = async () => {
    if (!formData.name_en) {
      setError(locale === 'ar' ? "يرجى إدخال اسم المنتج باللغة الإنجليزية أولاً لاستخدام الذكاء الاصطناعي." : "Please enter the English product name first to use AI fill.");
      return;
    }

    setIsGeneratingAI(true);
    setError("");

    try {
      const response = await tenantApi.generateProductAI({
        name_en: formData.name_en,
        brand: formData.brand,
        category: formData.category
      });

      if (response.success && response.data) {
        const aiData = response.data;
        setFormData(prev => ({
          ...prev,
          description_en: aiData.description_en || prev.description_en,
          description_ar: aiData.description_ar || prev.description_ar,
          // The old 'ingredients' was merged, but if the AI returns split we can just dump the english one or combine them
          ingredients: aiData.ingredients_en + (aiData.ingredients_ar ? "\n" + aiData.ingredients_ar : ""),
        }));
      } else {
        setError(response.message || "Failed to generate AI content");
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      setError(err.message || "Failed to generate AI content");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleTranslate = async (sourceField: string, targetField: string, targetLang: 'English' | 'Arabic') => {
    const sourceText = formData[sourceField as keyof typeof formData] as string;
    if (!sourceText) return;

    setTranslatingField(targetField);
    setError("");

    try {
      const response = await tenantApi.translateTextAI({
        text: sourceText,
        targetLanguage: targetLang
      });

      if (response.success && response.translatedText) {
        setFormData(prev => ({
          ...prev,
          [targetField]: response.translatedText
        }));
      } else {
        setError(response.message || "Failed to translate text");
      }
    } catch (err: any) {
      console.error("Translation Error:", err);
      setError(err.message || "Failed to translate text");
    } finally {
      setTranslatingField(null);
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
          <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {hasAIFeature && (
              <button
                type="button"
                onClick={handleAIFill}
                disabled={isGeneratingAI || !formData.name_en}
                className="btn bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
                title={!formData.name_en ? (locale === 'ar' ? 'أدخل الاسم باللغة الإنجليزية أولاً' : 'Enter English name first') : ''}
              >
                <SparklesIcon className="w-5 h-5" />
                {isGeneratingAI
                  ? (locale === 'ar' ? 'جاري التوليد...' : 'Generating...')
                  : (locale === 'ar' ? '✨ تعبئة ذكية' : '✨ AI Fill')
                }
              </button>
            )}
            <Link href={`/${locale}/dashboard/products`} className="btn btn-secondary">
              {t("cancel")}
            </Link>
          </div>
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

              <div className="mt-4 space-y-4">
                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("ingredientsEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {hasAIFeature && formData.ingredients_ar && !formData.ingredients_en && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('ingredients_ar', 'ingredients_en', 'English')}
                        disabled={translatingField === 'ingredients_en'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'ingredients_en' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للإنجليزية' : 'Translate to EN')}
                      </button>
                    )}
                  </div>
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
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("descriptionEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {hasAIFeature && formData.description_ar && !formData.description_en && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('description_ar', 'description_en', 'English')}
                        disabled={translatingField === 'description_en'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'description_en' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للإنجليزية' : 'Translate to EN')}
                      </button>
                    )}
                  </div>
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
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("descriptionAr")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {hasAIFeature && formData.description_en && !formData.description_ar && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('description_en', 'description_ar', 'Arabic')}
                        disabled={translatingField === 'description_ar'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'description_ar' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للعربية' : 'Translate to AR')}
                      </button>
                    )}
                  </div>
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
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("ingredientsAr")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {hasAIFeature && formData.ingredients_en && !formData.ingredients_ar && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('ingredients_en', 'ingredients_ar', 'Arabic')}
                        disabled={translatingField === 'ingredients_ar'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'ingredients_ar' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للعربية' : 'Translate to AR')}
                      </button>
                    )}
                  </div>
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
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("howToUseEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {hasAIFeature && formData.howToUse_ar && !formData.howToUse_en && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('howToUse_ar', 'howToUse_en', 'English')}
                        disabled={translatingField === 'howToUse_en'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'howToUse_en' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للإنجليزية' : 'Translate to EN')}
                      </button>
                    )}
                  </div>
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

              <div className="mt-4 space-y-4">
                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("ingredientsEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {hasAIFeature && formData.ingredients_ar && !formData.ingredients_en && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('ingredients_ar', 'ingredients_en', 'English')}
                        disabled={translatingField === 'ingredients_en'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'ingredients_en' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للإنجليزية' : 'Translate to EN')}
                      </button>
                    )}
                  </div>
                  <textarea
                    name="ingredients_en"
                    value={formData.ingredients_en}
                    onChange={handleChange}
                    rows={3}
                    placeholder={locale === 'ar' ? 'المكونات باللغة الإنجليزية' : 'Ingredients in English'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("ingredientsAr")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {hasAIFeature && formData.ingredients_en && !formData.ingredients_ar && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('ingredients_en', 'ingredients_ar', 'Arabic')}
                        disabled={translatingField === 'ingredients_ar'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'ingredients_ar' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للعربية' : 'Translate to AR')}
                      </button>
                    )}
                  </div>
                  <textarea
                    name="ingredients_ar"
                    value={formData.ingredients_ar}
                    onChange={handleChange}
                    rows={3}
                    placeholder={locale === 'ar' ? 'المكونات باللغة العربية' : 'المكونات بالعربية'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                </div>
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
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'خيارات التوصيل والاستلام' : 'Fulfillment options'}
              </p>
              <p className="text-xs text-gray-500 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'اختر واحدًا أو كليهما. يجب تفعيل خيار واحد على الأقل.' : 'Select one or both. At least one must be enabled.'}
              </p>
              <div className="flex flex-wrap gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input
                    type="checkbox"
                    name="allowsDelivery"
                    checked={formData.allowsDelivery ?? true}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({ ...prev, allowsDelivery: checked }));
                      if (!checked && !formData.allowsPickup) setFormData(prev => ({ ...prev, allowsPickup: true }));
                    }}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <label className="font-medium text-gray-700">{locale === 'ar' ? 'التوصيل' : 'Delivery'}</label>
                </div>
                <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input
                    type="checkbox"
                    name="allowsPickup"
                    checked={formData.allowsPickup ?? true}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({ ...prev, allowsPickup: checked }));
                      if (!checked && !formData.allowsDelivery) setFormData(prev => ({ ...prev, allowsDelivery: true }));
                    }}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <label className="font-medium text-gray-700">{locale === 'ar' ? 'الاستلام من المركز' : 'Pick on visit'}</label>
                </div>
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

