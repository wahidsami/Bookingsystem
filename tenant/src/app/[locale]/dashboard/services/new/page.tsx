"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { API_BASE_URL, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { SparklesIcon, LanguageIcon } from "@heroicons/react/24/outline";

interface ServiceCategory {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
}

interface Employee {
  id: string;
  name: string;
  isActive: boolean;
}

interface Product {
  id: string;
  name_en: string;
  name_ar: string;
  price: number;
}

export default function NewServicePage() {
  const t = useTranslations("Services");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [hasAIFeature, setHasAIFeature] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    taxRate: 15.00,
    serviceCommissionRate: 10.00
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    name_en: "",
    name_ar: "",
    description_en: "",
    description_ar: "",
    rawPrice: "",
    category: "",
    duration: "30",
    includes: [] as string[],
    benefits: [] as { en: string, ar: string }[],
    whatToExpect: [] as { en: string, ar: string }[],
    hasOffer: false,
    offerDetails: "",
    offerFrom: "",
    offerTo: "",
    hasGift: false,
    giftType: "text" as "text" | "product",
    giftDetails: "",
    giftProductId: "",
    employeeIds: [] as string[],
    isActive: true,
    availableInCenter: true,
    availableHomeVisit: false
  });
  const [newInclude, setNewInclude] = useState("");
  const [newBenefit, setNewBenefit] = useState({ en: "", ar: "" });
  const [newWhatToExpect, setNewWhatToExpect] = useState({ en: "", ar: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    loadGlobalSettings();
    loadEmployees();
    loadProducts();
    loadCategories();
    checkSubscriptionLimits();
  }, []);

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

  const loadEmployees = async () => {
    try {
      const response = await tenantApi.getEmployees({ isActive: true }); // Only active employees
      if (response.success) {
        setEmployees(response.employees || []);
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await tenantApi.getProducts({ isAvailable: true });
      if (response.success) {
        setProducts(response.products || []);
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await tenantApi.getServiceCategories();
      if (response.success) {
        setServiceCategories(response.categories || []);
        // Set default category to first one if none selected
        if (!formData.category && response.categories?.length > 0) {
          setFormData(prev => ({ ...prev, category: response.categories[0].slug }));
        }
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "hasOffer" || name === "hasGift" || name === "isActive" || name === "availableInCenter" || name === "availableHomeVisit") {
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

  const handleAddInclude = () => {
    if (newInclude.trim() && !formData.includes.includes(newInclude.trim())) {
      setFormData(prev => ({
        ...prev,
        includes: [...prev.includes, newInclude.trim()]
      }));
      setNewInclude("");
    }
  };

  const handleRemoveInclude = (item: string) => {
    setFormData(prev => ({
      ...prev,
      includes: prev.includes.filter(i => i !== item)
    }));
  };

  const handleAddBenefit = () => {
    if (newBenefit.en.trim() && newBenefit.ar.trim()) {
      setFormData(prev => ({
        ...prev,
        benefits: [...prev.benefits, { en: newBenefit.en.trim(), ar: newBenefit.ar.trim() }]
      }));
      setNewBenefit({ en: "", ar: "" });
    }
  };

  const handleRemoveBenefit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index)
    }));
  };

  const handleAddWhatToExpect = () => {
    if (newWhatToExpect.en.trim() && newWhatToExpect.ar.trim()) {
      setFormData(prev => ({
        ...prev,
        whatToExpect: [...prev.whatToExpect, { en: newWhatToExpect.en.trim(), ar: newWhatToExpect.ar.trim() }]
      }));
      setNewWhatToExpect({ en: "", ar: "" });
    }
  };

  const handleRemoveWhatToExpect = (index: number) => {
    setFormData(prev => ({
      ...prev,
      whatToExpect: prev.whatToExpect.filter((_, i) => i !== index)
    }));
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setFormData(prev => {
      const currentIds = prev.employeeIds;
      if (currentIds.includes(employeeId)) {
        return { ...prev, employeeIds: currentIds.filter(id => id !== employeeId) };
      } else {
        return { ...prev, employeeIds: [...currentIds, employeeId] };
      }
    });
  };

  // Final price: (raw + platform fee) then 15% tax on that sum
  const calculateFinalPrice = () => {
    const raw = parseFloat(formData.rawPrice || "0");
    const platformFee = raw * (globalSettings.serviceCommissionRate / 100);
    const subtotalBeforeTax = raw + platformFee;
    const tax = subtotalBeforeTax * (globalSettings.taxRate / 100);
    return subtotalBeforeTax + tax;
  };
  const getPricingBreakdown = () => {
    const raw = parseFloat(formData.rawPrice || "0");
    const platformFee = raw * (globalSettings.serviceCommissionRate / 100);
    const subtotalBeforeTax = raw + platformFee;
    const tax = subtotalBeforeTax * (globalSettings.taxRate / 100);
    return { raw, platformFee, subtotalBeforeTax, tax, final: subtotalBeforeTax + tax };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const submitData = new FormData();

      // Basic info
      submitData.append("name_en", formData.name_en);
      submitData.append("name_ar", formData.name_ar);
      if (formData.description_en) submitData.append("description_en", formData.description_en);
      if (formData.description_ar) submitData.append("description_ar", formData.description_ar);

      // Pricing (tax and commission rates are controlled by admin, not sent from frontend)
      submitData.append("rawPrice", formData.rawPrice);

      // Service details
      submitData.append("category", formData.category);
      submitData.append("duration", formData.duration);
      submitData.append("includes", JSON.stringify(formData.includes));
      submitData.append("benefits", JSON.stringify(formData.benefits));
      submitData.append("whatToExpect", JSON.stringify(formData.whatToExpect));

      // Offers
      submitData.append("hasOffer", formData.hasOffer.toString());
      if (formData.hasOffer && formData.offerDetails) {
        submitData.append("offerDetails", formData.offerDetails);
      }
      if (formData.hasOffer && formData.offerFrom) {
        submitData.append("offerFrom", formData.offerFrom);
      }
      if (formData.hasOffer && formData.offerTo) {
        submitData.append("offerTo", formData.offerTo);
      }

      // Gifts
      submitData.append("hasGift", formData.hasGift.toString());
      if (formData.hasGift) {
        submitData.append("giftType", formData.giftType);
        if (formData.giftType === "text") {
          submitData.append("giftDetails", formData.giftDetails);
        } else if (formData.giftType === "product" && formData.giftProductId) {
          submitData.append("giftDetails", formData.giftProductId);
        }
      }

      // Employees
      submitData.append("employeeIds", JSON.stringify(formData.employeeIds));

      // Status
      submitData.append("isActive", formData.isActive.toString());
      submitData.append("availableInCenter", formData.availableInCenter.toString());
      submitData.append("availableHomeVisit", formData.availableHomeVisit.toString());

      // Image
      if (imageFile) {
        submitData.append("image", imageFile);
      }

      const response = await tenantApi.createService(submitData);

      if (response.success) {
        router.push(`/${locale}/dashboard/services`);
      } else {
        setError(response.message || t("createError"));
      }
    } catch (err: any) {
      console.error("Failed to create service:", err);
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
        ? 'يرجى إدخال اسم الخدمة بالعربية أو الإنجليزية أولاً'
        : 'Please enter the service name in English or Arabic first');
      return;
    }

    setIsGeneratingAI(true);
    setError('');

    try {
      const selectedCat = serviceCategories.find(c => c.slug === formData.category);
      const categoryName = selectedCat
        ? (hasEnglish ? selectedCat.name_en : selectedCat.name_ar)
        : formData.category;

      // Determine primary input language and the service name to send
      const inputName = hasEnglish ? formData.name_en : formData.name_ar;
      const inputLang = hasEnglish ? 'English' : 'Arabic';

      const response = await tenantApi.generateServiceAI({
        name_en: hasEnglish ? formData.name_en : formData.name_ar,
        category: categoryName,
        inputLanguage: inputLang
      });

      if (response.success && response.data) {
        const aiData = response.data;
        setFormData(prev => ({
          ...prev,
          // Fill the other language's name if not already filled
          name_en: hasEnglish ? prev.name_en : (aiData.name_en || prev.name_en),
          name_ar: hasArabic ? prev.name_ar : (aiData.name_ar || prev.name_ar),
          // Fill descriptions (always overwrite if blank)
          description_en: prev.description_en || aiData.description_en || '',
          description_ar: prev.description_ar || aiData.description_ar || '',
          // Append generated benefits (1-5 items)
          benefits: aiData.benefits?.length
            ? [...prev.benefits, ...aiData.benefits]
            : prev.benefits,
          // Append generated whatToExpect (1-5 items)
          whatToExpect: aiData.whatToExpect?.length
            ? [...prev.whatToExpect, ...aiData.whatToExpect]
            : prev.whatToExpect,
        }));
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

  const handleTranslate = async (
    sourceField: "description_en" | "description_ar",
    targetField: "description_ar" | "description_en",
    targetLang: 'English' | 'Arabic'
  ) => {
    const sourceText = formData[sourceField];
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

  const handleTranslateArrayItem = async (
    arrayName: 'benefits' | 'whatToExpect',
    index: number,
    sourceLang: 'en' | 'ar',
    targetLangName: 'English' | 'Arabic'
  ) => {
    const item = formData[arrayName][index];
    const sourceText = item[sourceLang];
    if (!sourceText) return;

    const targetLangCode = sourceLang === 'en' ? 'ar' : 'en';
    setTranslatingField(`${arrayName}_${index}_${targetLangCode}`);
    setError("");

    try {
      const response = await tenantApi.translateTextAI({
        text: sourceText,
        targetLanguage: targetLangName
      });

      if (response.success && response.translatedText) {
        setFormData(prev => {
          const newArray = [...prev[arrayName]];
          newArray[index] = {
            ...newArray[index],
            [targetLangCode]: response.translatedText
          };
          return { ...prev, [arrayName]: newArray };
        });
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
              {t("addService")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'أضف خدمة جديدة إلى الكتالوج' : 'Add a new service to your catalog'}
            </p>
          </div>
          <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link href={`/${locale}/dashboard/services`} className="btn btn-secondary">
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
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium hover:from-purple-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  title={!formData.name_en && !formData.name_ar ? (locale === 'ar' ? 'أدخل اسم الخدمة أولاً' : 'Enter service name first') : (locale === 'ar' ? 'تعبئة تلقائية بالذكاء الاصطناعي' : 'Auto-fill with AI')}
                >
                  <SparklesIcon className="w-4 h-4" />
                  {isGeneratingAI
                    ? (locale === 'ar' ? 'جاري التوليد...' : 'Generating...')
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

                <div className="grid grid-cols-2 gap-4">
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
                      <option value="">{locale === 'ar' ? 'اختر الفئة' : 'Select category'}</option>
                      {serviceCategories.map(cat => (
                        <option key={cat.id} value={cat.slug}>
                          {locale === 'ar' ? cat.name_ar : cat.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t("duration")} ({t("minutes")}) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleChange}
                      required
                      min="15"
                      step="15"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Service Availability */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("serviceAvailability")}
              </h3>

              <div className="space-y-3">
                <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input
                    type="checkbox"
                    name="availableInCenter"
                    checked={formData.availableInCenter}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <label className="font-medium text-gray-700">{t("availableInCenter")}</label>
                </div>

                <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input
                    type="checkbox"
                    name="availableHomeVisit"
                    checked={formData.availableHomeVisit}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <label className="font-medium text-gray-700">{t("availableHomeVisit")}</label>
                </div>
              </div>
            </div>

            {/* Includes Section */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("includes")} <span className="text-gray-400">({t("optional")})</span>
              </h3>

              <div className="space-y-4">
                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="text"
                    value={newInclude}
                    onChange={(e) => setNewInclude(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInclude())}
                    placeholder={t("addIncludePlaceholder")}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                  <button type="button" onClick={handleAddInclude} className="btn btn-secondary">
                    {t("add")}
                  </button>
                </div>

                {formData.includes.length > 0 && (
                  <div className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : ''}`}>
                    {formData.includes.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                        <span className="text-sm">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveInclude(item)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Benefits List */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("benefitsList")} <span className="text-gray-400">({t("optional")})</span>
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newBenefit.en}
                    onChange={(e) => setNewBenefit(prev => ({ ...prev, en: e.target.value }))}
                    placeholder={locale === 'ar' ? 'Benefit (English)...' : 'Benefit (English)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                  <input
                    type="text"
                    value={newBenefit.ar}
                    onChange={(e) => setNewBenefit(prev => ({ ...prev, ar: e.target.value }))}
                    placeholder={locale === 'ar' ? 'الفائدة (بالعربية)...' : 'الفائدة (بالعربية)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddBenefit}
                    disabled={!newBenefit.en.trim() && !newBenefit.ar.trim()}
                    className="btn btn-secondary w-full"
                  >
                    {t("addBenefit")}
                  </button>
                </div>

                {formData.benefits.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {formData.benefits.map((item, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveBenefit(index)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700 bg-white rounded-full p-1"
                          style={{ right: isRTL ? 'auto' : '0.5rem', left: isRTL ? '0.5rem' : 'auto' }}
                        >
                          ×
                        </button>
                        <div className="space-y-2 pr-6 pl-6">
                          <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm border-l-2 border-primary pl-2 block text-left w-full" style={{ textAlign: 'left', borderLeft: '2px solid #6366f1', paddingLeft: '0.5rem', borderRight: 'none', paddingRight: '0' }}>{item.en}</span>
                            {hasAIFeature && item.ar && !item.en && (
                              <button
                                type="button"
                                onClick={() => handleTranslateArrayItem('benefits', index, 'ar', 'English')}
                                disabled={translatingField === `benefits_${index}_en`}
                                className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50 whitespace-nowrap"
                              >
                                <LanguageIcon className="w-3 h-3" />
                                {translatingField === `benefits_${index}_en` ? '...' : (locale === 'ar' ? 'ترجم للإنجليزية' : 'Translate to EN')}
                              </button>
                            )}
                          </div>
                          <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm border-r-2 border-primary pr-2 block text-right w-full" style={{ textAlign: 'right', borderRight: '2px solid #6366f1', paddingRight: '0.5rem', borderLeft: 'none', paddingLeft: '0' }} dir="rtl">{item.ar}</span>
                            {hasAIFeature && item.en && !item.ar && (
                              <button
                                type="button"
                                onClick={() => handleTranslateArrayItem('benefits', index, 'en', 'Arabic')}
                                disabled={translatingField === `benefits_${index}_ar`}
                                className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50 whitespace-nowrap"
                              >
                                <LanguageIcon className="w-3 h-3" />
                                {translatingField === `benefits_${index}_ar` ? '...' : (locale === 'ar' ? 'ترجم للعربية' : 'Translate to AR')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* What to Expect */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("whatToExpect")} <span className="text-gray-400">({t("optional")})</span>
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newWhatToExpect.en}
                    onChange={(e) => setNewWhatToExpect(prev => ({ ...prev, en: e.target.value }))}
                    placeholder={locale === 'ar' ? 'What to Expect (English)...' : 'What to Expect (English)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                  <input
                    type="text"
                    value={newWhatToExpect.ar}
                    onChange={(e) => setNewWhatToExpect(prev => ({ ...prev, ar: e.target.value }))}
                    placeholder={locale === 'ar' ? 'ما يمكن توقعه (بالعربية)...' : 'ما يمكن توقعه (بالعربية)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddWhatToExpect}
                    disabled={!newWhatToExpect.en.trim() && !newWhatToExpect.ar.trim()}
                    className="btn btn-secondary w-full"
                  >
                    {t("addWhatToExpect")}
                  </button>
                </div>

                {formData.whatToExpect.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {formData.whatToExpect.map((item, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveWhatToExpect(index)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700 bg-white rounded-full p-1"
                          style={{ right: isRTL ? 'auto' : '0.5rem', left: isRTL ? '0.5rem' : 'auto' }}
                        >
                          ×
                        </button>
                        <div className="space-y-2 pr-6 pl-6">
                          <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm border-l-2 border-primary pl-2 block text-left w-full" style={{ textAlign: 'left', borderLeft: '2px solid #6366f1', paddingLeft: '0.5rem', borderRight: 'none', paddingRight: '0' }}>{item.en}</span>
                            {hasAIFeature && item.ar && !item.en && (
                              <button
                                type="button"
                                onClick={() => handleTranslateArrayItem('whatToExpect', index, 'ar', 'English')}
                                disabled={translatingField === `whatToExpect_${index}_en`}
                                className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50 whitespace-nowrap"
                              >
                                <LanguageIcon className="w-3 h-3" />
                                {translatingField === `whatToExpect_${index}_en` ? '...' : (locale === 'ar' ? 'ترجم للإنجليزية' : 'Translate to EN')}
                              </button>
                            )}
                          </div>
                          <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm border-r-2 border-primary pr-2 block text-right w-full" style={{ textAlign: 'right', borderRight: '2px solid #6366f1', paddingRight: '0.5rem', borderLeft: 'none', paddingLeft: '0' }} dir="rtl">{item.ar}</span>
                            {hasAIFeature && item.en && !item.ar && (
                              <button
                                type="button"
                                onClick={() => handleTranslateArrayItem('whatToExpect', index, 'en', 'Arabic')}
                                disabled={translatingField === `whatToExpect_${index}_ar`}
                                className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50 whitespace-nowrap"
                              >
                                <LanguageIcon className="w-3 h-3" />
                                {translatingField === `whatToExpect_${index}_ar` ? '...' : (locale === 'ar' ? 'ترجم للعربية' : 'Translate to AR')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column - Image & Status */}
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
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-6xl">💇</span>
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
                    {imagePreview ? t("changeImage") : t("uploadImage")}
                  </span>
                </label>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'التسعير' : 'Pricing'}
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
                      value={globalSettings.serviceCommissionRate}
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
                        <span className="text-sm text-gray-600">{t("commission")} ({globalSettings.serviceCommissionRate}%)</span>
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
              </div>
            </div>

            {/* Employee Assignment */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("assignEmployees")} <span className="text-red-500">*</span>
              </h3>

              {employees.length === 0 ? (
                <p className="text-gray-600 text-sm" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("noEmployees")} <Link href={`/${locale}/dashboard/employees/new`} className="text-primary underline">{t("addEmployee")}</Link>
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {employees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.employeeIds.includes(employee.id)}
                        onChange={() => handleEmployeeToggle(employee.id)}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-gray-900">{employee.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Offers Section */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("offers")}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input
                    type="checkbox"
                    name="hasOffer"
                    checked={formData.hasOffer}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <label className="font-medium text-gray-700">{t("hasOffer")}</label>
                </div>

                {formData.hasOffer && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("offerDetails")} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="offerDetails"
                        value={formData.offerDetails}
                        onChange={handleChange}
                        required={formData.hasOffer}
                        rows={3}
                        placeholder={t("offerDetailsPlaceholder")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          {locale === "ar" ? "العرض من تاريخ" : "Offer from"}
                        </label>
                        <input
                          type="date"
                          name="offerFrom"
                          value={formData.offerFrom}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          {locale === "ar" ? "العرض إلى تاريخ" : "Offer to"}
                        </label>
                        <input
                          type="date"
                          name="offerTo"
                          value={formData.offerTo}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </div>
                    {formData.offerFrom && formData.offerTo && formData.offerTo < formData.offerFrom && (
                      <p className="text-sm text-red-600">{locale === "ar" ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" : "Offer end date must be after start date"}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Gifts Section */}
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("gifts")}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input
                    type="checkbox"
                    name="hasGift"
                    checked={formData.hasGift}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <label className="font-medium text-gray-700">{t("hasGift")}</label>
                </div>

                {formData.hasGift && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("giftType")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="giftType"
                        value={formData.giftType}
                        onChange={handleChange}
                        required={formData.hasGift}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        <option value="text">{t("giftTypeText")}</option>
                        <option value="product">{t("giftTypeProduct")}</option>
                      </select>
                    </div>

                    {formData.giftType === "text" ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          {t("giftDetails")} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="giftDetails"
                          value={formData.giftDetails}
                          onChange={handleChange}
                          required={formData.hasGift && formData.giftType === "text"}
                          rows={3}
                          placeholder={t("giftDetailsPlaceholder")}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          {t("selectProduct")} <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="giftProductId"
                          value={formData.giftProductId}
                          onChange={(e) => setFormData(prev => ({ ...prev, giftProductId: e.target.value }))}
                          required={formData.hasGift && formData.giftType === "product"}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        >
                          <option value="">{t("selectProductPlaceholder")}</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {locale === 'ar' ? product.name_ar : product.name_en} - <Currency amount={product.price} />
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="card">
              <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <label className="font-medium text-gray-700">{t("isActive")}</label>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link href={`/${locale}/dashboard/services`} className="btn btn-secondary">
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={loading || formData.employeeIds.length === 0}
            className="btn btn-primary flex-1"
          >
            {loading ? t("loading") : t("save")}
          </button>
        </div>
      </form>
    </TenantLayout>
  );
}

