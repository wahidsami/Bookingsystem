"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { API_BASE_URL, tenantApi } from "@/lib/api";
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

export default function NewProductPage() {
  const t = useTranslations("Products");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<'search' | 'enhance'>('search');
  const [showNotFoundPopup, setShowNotFoundPopup] = useState(false);
  const [error, setError] = useState("");
  const [globalSettings, setGlobalSettings] = useState({
    taxRate: 15.00,
    productCommissionRate: 10.00
  });
  const [formData, setFormData] = useState({
    name_en: "",
    name_ar: "",
    description_en: "",
    description_ar: "",
    rawPrice: "",
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
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    loadGlobalSettings();
  }, []);

  const loadGlobalSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/global`);
      const data = await response.json();
      if (data.success) {
        setGlobalSettings(data.settings);
      }
    } catch (err) {
      console.error("Failed to load global settings:", err);
    }
  };

  const calculateFinalPrice = () => {
    const raw = parseFloat(formData.rawPrice || "0");
    const platformFee = raw * (globalSettings.productCommissionRate / 100);
    const subtotalBeforeTax = raw + platformFee;
    const tax = subtotalBeforeTax * (globalSettings.taxRate / 100);
    return subtotalBeforeTax + tax;
  };
  const getPricingBreakdown = () => {
    const raw = parseFloat(formData.rawPrice || "0");
    const platformFee = raw * (globalSettings.productCommissionRate / 100);
    const subtotalBeforeTax = raw + platformFee;
    const tax = subtotalBeforeTax * (globalSettings.taxRate / 100);
    return { raw, platformFee, subtotalBeforeTax, tax, final: subtotalBeforeTax + tax };
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
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    // Validate: Maximum 5 images total
    const totalImages = imageFiles.length + files.length;
    if (totalImages > 5) {
      setError(`Maximum 5 images allowed. You already have ${imageFiles.length} image(s).`);
      return;
    }

    // Add new files
    const newFiles = [...imageFiles, ...files];
    setImageFiles(newFiles);

    // Create previews for new files
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const submitData = new FormData();

      // Append all form fields
      submitData.append("name_en", formData.name_en);
      submitData.append("name_ar", formData.name_ar);
      if (formData.description_en) submitData.append("description_en", formData.description_en);
      if (formData.description_ar) submitData.append("description_ar", formData.description_ar);
      submitData.append("rawPrice", formData.rawPrice);
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
      submitData.append("isAvailable", formData.isAvailable.toString());
      submitData.append("isFeatured", formData.isFeatured.toString());
      submitData.append("allowsDelivery", formData.allowsDelivery.toString());
      submitData.append("allowsPickup", formData.allowsPickup.toString());

      // Validation: At least 1 image is required
      if (imageFiles.length === 0) {
        setError("At least one product image is required");
        setLoading(false);
        return;
      }

      // Append images (up to 5)
      imageFiles.forEach((file) => {
        submitData.append("images", file);
      });

      const response = await tenantApi.createProduct(submitData);

      if (response.success) {
        router.push(`/${locale}/dashboard/products`);
      } else {
        setError(response.message || t("createError"));
      }
    } catch (err: any) {
      console.error("Failed to create product:", err);
      setError(err.message || t("createError"));
    } finally {
      setLoading(false);
    }
  };

  const handleAIFill = async () => {
    const hasEnglish = formData.name_en.trim().length > 0;
    const hasArabic = formData.name_ar.trim().length > 0;

    if (!hasEnglish && !hasArabic) {
      setError(locale === 'ar'
        ? 'يرجى إدخال اسم المنتج بالعربية أو الإنجليزية أولاً'
        : 'Please enter the product name in English or Arabic first');
      return;
    }

    setIsGeneratingAI(true);
    setError('');
    setShowNotFoundPopup(false);

    try {
      const inputLang = hasEnglish ? 'English' : 'Arabic';
      const productName = hasEnglish ? formData.name_en : formData.name_ar;

      const response = await tenantApi.generateProductAI({
        name_en: hasEnglish ? formData.name_en : undefined,
        name_ar: hasArabic ? formData.name_ar : undefined,
        brand: formData.brand,
        category: formData.category,
        inputLanguage: inputLang,
        mode: aiMode,
        existingData: aiMode === 'enhance' ? {
          description_en: formData.description_en,
          description_ar: formData.description_ar,
          ingredients_en: formData.ingredients_en,
          ingredients_ar: formData.ingredients_ar,
          howToUse_en: formData.howToUse_en,
          howToUse_ar: formData.howToUse_ar,
          features_en: formData.features_en,
          features_ar: formData.features_ar,
        } : undefined
      });

      if (response.success && response.data) {
        const aiData = response.data;

        if (aiData.found === false) {
          // Product not found — show popup and switch to enhance mode
          setShowNotFoundPopup(true);
          setAiMode('enhance');
        } else {
          // Product found (or enhance mode) — fill all fields
          setFormData(prev => ({
            ...prev,
            name_en: hasEnglish ? prev.name_en : (aiData.name_en || prev.name_en),
            name_ar: hasArabic ? prev.name_ar : (aiData.name_ar || prev.name_ar),
            brand: prev.brand || aiData.brand || prev.brand,
            description_en: aiData.description_en || prev.description_en,
            description_ar: aiData.description_ar || prev.description_ar,
            ingredients_en: aiData.ingredients_en || prev.ingredients_en,
            ingredients_ar: aiData.ingredients_ar || prev.ingredients_ar,
            howToUse_en: aiData.howToUse_en || prev.howToUse_en,
            howToUse_ar: aiData.howToUse_ar || prev.howToUse_ar,
            features_en: aiData.features_en || prev.features_en,
            features_ar: aiData.features_ar || prev.features_ar,
          }));
          // Reset to search mode after successful fill
          setAiMode('search');
        }
      } else {
        setError(response.message || 'Failed to generate AI content');
      }
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setError(err.message || 'Failed to generate AI content');
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

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("addProduct")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'أضف منتجاً جديداً إلى الكتالوج' : 'Add a new product to your catalog'}
            </p>
          </div>
          <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link href={`/${locale}/dashboard/products`} className="btn btn-secondary">
              {t("cancel")}
            </Link>
          </div>
        </div>
      </div>

      {/* Not Found Popup */}
      {showNotFoundPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <SparklesIcon className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {locale === 'ar' ? 'لم أجد تطابقاً لهذا المنتج' : 'No Product Match Found'}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {locale === 'ar'
                    ? 'لم أجد تطابقاً لاسم المنتج الذي أدخلته. ادخل البيانات يدوياً في الحقول ثم اضغط عليّ مرة أخرى لتحسين محتواك.'
                    : "I didn't find a match to the product name you entered. Enter the data manually in the fields, then click me again to enhance your content."
                  }
                </p>
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200">
                  <SparklesIcon className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">
                    {locale === 'ar' ? 'الزر سيتحول إلى: ✨ تحسين المحتوى' : 'Button now: ✨ Enhance Content'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowNotFoundPopup(false)}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                {locale === 'ar' ? 'حسناً، سأدخل البيانات يدوياً' : 'Got it, I\'ll enter data manually'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="card">
              <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                </h3>
                <button
                  type="button"
                  onClick={handleAIFill}
                  disabled={isGeneratingAI || (!formData.name_en && !formData.name_ar)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${aiMode === 'enhance'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
                    }`}
                  title={!formData.name_en && !formData.name_ar ? (locale === 'ar' ? 'أدخل اسم المنتج أولاً' : 'Enter product name first') : ''}
                >
                  <SparklesIcon className="w-4 h-4" />
                  {isGeneratingAI
                    ? (locale === 'ar' ? 'جاري البحث...' : 'Searching...')
                    : aiMode === 'enhance'
                      ? (locale === 'ar' ? '✨ تحسين المحتوى' : '✨ Enhance Content')
                      : (locale === 'ar' ? '✨ تعبئة ذكية' : '✨ AI Fill')
                  }
                </button>
              </div>

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
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("descriptionEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {formData.description_ar && !formData.description_en && (
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
                    {formData.description_en && !formData.description_ar && (
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

              <div className="mt-4 space-y-4">
                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("ingredientsEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {formData.ingredients_ar && !formData.ingredients_en && (
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
                    {formData.ingredients_en && !formData.ingredients_ar && (
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

                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("howToUseEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {formData.howToUse_ar && !formData.howToUse_en && (
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
                  <textarea
                    name="howToUse_en"
                    value={formData.howToUse_en}
                    onChange={handleChange}
                    rows={3}
                    placeholder={locale === 'ar' ? 'كيفية الاستخدام باللغة الإنجليزية' : 'How to use instructions in English'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("howToUseAr")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {formData.howToUse_en && !formData.howToUse_ar && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('howToUse_en', 'howToUse_ar', 'Arabic')}
                        disabled={translatingField === 'howToUse_ar'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'howToUse_ar' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للعربية' : 'Translate to AR')}
                      </button>
                    )}
                  </div>
                  <textarea
                    name="howToUse_ar"
                    value={formData.howToUse_ar}
                    onChange={handleChange}
                    rows={3}
                    placeholder={locale === 'ar' ? 'كيفية الاستخدام باللغة العربية' : 'كيفية الاستخدام بالعربية'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                </div>

                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("featuresEn")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {formData.features_ar && !formData.features_en && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('features_ar', 'features_en', 'English')}
                        disabled={translatingField === 'features_en'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'features_en' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للإنجليزية' : 'Translate to EN')}
                      </button>
                    )}
                  </div>
                  <textarea
                    name="features_en"
                    value={formData.features_en}
                    onChange={handleChange}
                    rows={3}
                    placeholder={locale === 'ar' ? 'مميزات المنتج باللغة الإنجليزية' : 'Product features in English (one per line or comma-separated)'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <div className={`flex justify-between items-center mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("featuresAr")} <span className="text-gray-400">({t("optional")})</span>
                    </label>
                    {formData.features_en && !formData.features_ar && (
                      <button
                        type="button"
                        onClick={() => handleTranslate('features_en', 'features_ar', 'Arabic')}
                        disabled={translatingField === 'features_ar'}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <LanguageIcon className="w-3 h-3" />
                        {translatingField === 'features_ar' ? (locale === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (locale === 'ar' ? 'ترجم للعربية' : 'Translate to AR')}
                      </button>
                    )}
                  </div>
                  <textarea
                    name="features_ar"
                    value={formData.features_ar}
                    onChange={handleChange}
                    rows={3}
                    placeholder={locale === 'ar' ? 'مميزات المنتج باللغة العربية' : 'مميزات المنتج بالعربية (سطر واحد لكل ميزة أو مفصولة بفواصل)'}
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
                {t("images")} <span className="text-red-500">*</span>
              </h3>
              <p className="text-sm text-gray-500 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'حد أدنى: صورة واحدة، حد أقصى: 5 صور' : 'Minimum: 1 image, Maximum: 5 images'}
              </p>

              <div className="space-y-4">
                {/* Image Previews Grid */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                {imagePreviews.length < 5 && (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={imagePreviews.length >= 5}
                    />
                    <span className="btn btn-secondary w-full text-center cursor-pointer">
                      {imagePreviews.length === 0
                        ? `${t("uploadImage")} (${t("required")})`
                        : `${t("addMoreImages")} (${imagePreviews.length}/5)`
                      }
                    </span>
                  </label>
                )}

                {imagePreviews.length === 0 && (
                  <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-4xl">📦</span>
                  </div>
                )}
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
                    {t("rawPrice")} (SAR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="rawPrice"
                    value={formData.rawPrice}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("taxRate")} (%)
                    </label>
                    <input
                      type="number"
                      value={globalSettings.taxRate}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 opacity-60 cursor-not-allowed"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                    <p className="text-xs text-gray-500 mt-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar' ? 'يتم التحكم به من لوحة الإدارة' : 'Controlled by admin'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("commissionRate")} (%)
                    </label>
                    <input
                      type="number"
                      value={globalSettings.productCommissionRate}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 opacity-60 cursor-not-allowed"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                    <p className="text-xs text-gray-500 mt-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {locale === 'ar' ? 'يتم التحكم به من لوحة الإدارة' : 'Controlled by admin'}
                    </p>
                  </div>
                </div>

                {/* Final Price Display: (raw + platform fee), then tax = 15% of that sum */}
                {formData.rawPrice && (() => {
                  const b = getPricingBreakdown();
                  return (
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">{t("rawPrice")}</span>
                        <span className="font-semibold"><Currency amount={b.raw} /></span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">{t("commission")} ({globalSettings.productCommissionRate}%)</span>
                        <span className="text-sm"><Currency amount={b.platformFee} /></span>
                      </div>
                      <div className="flex items-center justify-between mb-2 text-gray-500 text-sm">
                        <span>{t("subtotalBeforeTax") || "Subtotal (raw + platform fee)"}</span>
                        <span><Currency amount={b.subtotalBeforeTax} /></span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">{t("tax")} ({globalSettings.taxRate}% of subtotal)</span>
                        <span className="text-sm"><Currency amount={b.tax} /></span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                        <span className="font-bold text-gray-900">{t("finalPrice")}</span>
                        <span className="font-bold text-primary text-xl"><Currency amount={b.final} /></span>
                      </div>
                    </div>
                  );
                })()}

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
                    checked={formData.allowsDelivery}
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
                    checked={formData.allowsPickup}
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
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? t("loading") : t("save")}
          </button>
        </div>
      </form>
    </TenantLayout>
  );
}

