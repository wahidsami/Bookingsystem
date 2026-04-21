"use client";

import { useEffect, useMemo, useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { API_BASE_URL, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import { hasAIAssistantEntitlement } from "@/lib/packageEntitlements";
import Link from "next/link";
import { SparklesIcon, LanguageIcon } from "@heroicons/react/24/outline";
import { ServiceEditorFrame, ServiceEditorSection } from "@/components/ServiceEditorFrame";
import { ServicePricingVariantsSection, ServiceVariant } from "@/components/ServicePricingVariantsSection";
import { ServiceTeamSection } from "@/components/ServiceTeamSection";
import {
  buildServiceEmployeeAssignments,
  getSelectedServiceEmployeeIds,
  type ServiceEmployeeAssignment
} from "@/components/serviceEmployeeAssignments";
import { type ServicePaymentMethod } from "@/components/servicePaymentOptions";

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
  photo?: string | null;
  position?: string | null;
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
  const [employeeAssignments, setEmployeeAssignments] = useState<ServiceEmployeeAssignment[]>([]);
  const [teamAssignmentsReady, setTeamAssignmentsReady] = useState(false);
  const [formData, setFormData] = useState({
    name_en: "",
    name_ar: "",
    description_en: "",
    description_ar: "",
    priceType: "fixed",
    finalPrice: "",
    targetGender: "all",
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
    paymentOptions: ['at-center', 'online-full', 'booking-fee'] as ServicePaymentMethod[],
    employeeIds: [] as string[],
    isActive: true,
    availableInCenter: true,
    availableHomeVisit: false
  });
  const [newInclude, setNewInclude] = useState("");
  const [newBenefit, setNewBenefit] = useState({ en: "", ar: "" });
  const [newWhatToExpect, setNewWhatToExpect] = useState({ en: "", ar: "" });
  const [variants, setVariants] = useState<ServiceVariant[]>([]);
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
        setHasAIFeature(hasAIAssistantEntitlement(response.limits));
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
        setTeamAssignmentsReady(true);
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

  const toggleServicePaymentOption = (option: ServicePaymentMethod) => {
    setFormData(prev => {
      const next = prev.paymentOptions.includes(option)
        ? prev.paymentOptions.filter((item) => item !== option)
        : [...prev.paymentOptions, option];

      return {
        ...prev,
        paymentOptions: next.length > 0 ? next : [...prev.paymentOptions]
      };
    });
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

  const handlePriceTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      priceType: value,
      finalPrice: value === "free" ? "0" : prev.finalPrice
    }));
  };

  useEffect(() => {
    if (!teamAssignmentsReady || employees.length === 0) {
      return;
    }

    setEmployeeAssignments((current) => {
      if (current.length > 0) {
        return current;
      }

      return buildServiceEmployeeAssignments(employees, []);
    });
  }, [employees, teamAssignmentsReady]);

  const selectedEmployeeIds = useMemo(
    () => getSelectedServiceEmployeeIds(employeeAssignments),
    [employeeAssignments]
  );

  const serviceSections = useMemo(() => {
    const basicFields = [
      formData.name_en.trim(),
      formData.name_ar.trim(),
      formData.category.trim(),
      formData.targetGender.trim(),
      formData.priceType.trim(),
      formData.finalPrice.trim(),
      formData.duration.trim()
    ];
    const basicFilled = basicFields.filter(Boolean).length;
    const teamFilled = selectedEmployeeIds.length > 0 ? 1 : 0;
    const optionsFilled = [imagePreview, formData.hasOffer, formData.hasGift].some(Boolean) ? 1 : 0;
    const settingsFilled = [
      formData.paymentOptions.length > 0,
      formData.isActive !== undefined,
    ].filter(Boolean).length;

    return [
      {
        id: "service-basic",
        label: locale === "ar" ? "المعلومات الأساسية" : "Basic information",
        progressLabel: `${basicFilled}/7`,
        progressPercent: (basicFilled / 7) * 100,
      },
      {
        id: "service-team",
        label: locale === "ar" ? "الفريق" : "Team",
        progressLabel: selectedEmployeeIds.length > 0 ? "1/1" : "0/1",
        progressPercent: teamFilled * 100,
      },
      {
        id: "service-options",
        label: locale === "ar" ? "خيارات الخدمة" : "Service options",
        progressLabel: optionsFilled ? "1/1" : "Optional",
        progressPercent: optionsFilled ? 100 : 0,
      },
      {
        id: "service-settings",
        label: locale === "ar" ? "الإعدادات" : "Settings",
        progressLabel: `${settingsFilled}/2`,
        progressPercent: Math.min((settingsFilled / 2) * 100, 100),
      },
    ];
  }, [
    formData.availableHomeVisit,
    formData.availableInCenter,
    formData.category,
    formData.duration,
    selectedEmployeeIds.length,
    formData.finalPrice,
    formData.hasGift,
    formData.hasOffer,
    formData.isActive,
    formData.name_ar,
    formData.name_en,
    formData.paymentOptions.length,
    formData.targetGender,
    imagePreview,
    locale
  ]) as ServiceEditorSection[];

  const [activeSection, setActiveSection] = useState("service-basic");
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
      submitData.append("priceType", formData.priceType);
      submitData.append("finalPrice", formData.finalPrice);
      submitData.append("targetGender", formData.targetGender);

      // Service details
      submitData.append("category", formData.category);
      submitData.append("duration", formData.duration);
      submitData.append("includes", JSON.stringify(formData.includes));
      submitData.append("benefits", JSON.stringify(formData.benefits));
      submitData.append("whatToExpect", JSON.stringify(formData.whatToExpect));
      submitData.append("variants", JSON.stringify(variants));

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

      submitData.append("paymentOptions", JSON.stringify(formData.paymentOptions));

      // Employees
      submitData.append("employeeAssignments", JSON.stringify(employeeAssignments));

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
    if (!hasAIFeature) return;

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
    if (!hasAIFeature) return;

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
    if (!hasAIFeature) return;

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
      <ServiceEditorFrame
        locale={locale}
        isRTL={isRTL}
        title={t("addService")}
        subtitle={locale === 'ar' ? 'أضف خدمة جديدة إلى الكتالوج' : 'Add a new service to your catalog'}
        cancelHref={`/${locale}/dashboard/services`}
        saveLabel={t("save")}
        loadingLabel={t("loading")}
        cancelLabel={t("cancel")}
        formId="service-editor-form"
        loading={loading}
        error={error}
        sections={serviceSections}
        activeSection={activeSection}
        onSectionSelect={scrollToSection}
      >
        <form id="service-editor-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="card" id="service-basic">
              <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                </h3>
                {hasAIFeature && (
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
                )}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("targetAudience")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="targetGender"
                    value={formData.targetGender}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="all">{t("allGenders")}</option>
                    <option value="female">{t("femaleOnly")}</option>
                    <option value="male">{t("maleOnly")}</option>
                  </select>
                </div>

                <ServicePricingVariantsSection
                  locale={locale}
                  isRTL={isRTL}
                  priceType={formData.priceType}
                  finalPrice={formData.finalPrice}
                  duration={formData.duration}
                  globalSettings={globalSettings}
                  employeeAssignments={employeeAssignments}
                  variants={variants}
                  onPriceTypeChange={handlePriceTypeChange}
                  onFinalPriceChange={(value) => setFormData(prev => ({ ...prev, finalPrice: value }))}
                  onDurationChange={(value) => setFormData(prev => ({ ...prev, duration: value }))}
                  onVariantsChange={setVariants}
                />
              </div>
            </div>

            {/* Team */}
            <div className="card" id="service-team">
              <ServiceTeamSection
                locale={locale}
                isRTL={isRTL}
                employees={employees}
                assignments={employeeAssignments}
                onAssignmentsChange={setEmployeeAssignments}
              />

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-4 text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'التوفر' : 'Availability'}
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
            </div>

            {/* Includes Section */}
            <div className="card" id="service-options">
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

            {/* Settings */}
            <div className="card" id="service-settings">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'الإعدادات' : 'Settings'}
              </h3>

              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{t("paymentOptions")}</p>
                      <p className="text-sm text-gray-500">
                        {locale === 'ar'
                          ? 'حدد طريقة أو أكثر ليظهر للعميل عند الحجز.'
                          : 'Choose one or more methods that customers can select when booking.'}
                      </p>
                    </div>
                    <span className="text-xs rounded-full bg-purple-50 text-primary px-3 py-1">
                      {formData.paymentOptions.length}/3
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'at-center' as ServicePaymentMethod,
                        title: locale === 'ar' ? 'الدفع عند المركز' : 'Pay at Center',
                        description: locale === 'ar'
                          ? 'يدفع العميل عند الحضور.'
                          : 'Customer pays when arriving at the center.'
                      },
                      {
                        id: 'online-full' as ServicePaymentMethod,
                        title: locale === 'ar' ? 'الدفع الكامل عبر الإنترنت' : 'Pay in Full Online',
                        description: locale === 'ar'
                          ? 'يتم الدفع الكامل قبل تأكيد الحجز.'
                          : 'Collect the full amount before confirming the booking.'
                      },
                      {
                        id: 'booking-fee' as ServicePaymentMethod,
                        title: locale === 'ar' ? 'عربون الحجز' : 'Booking Fee',
                        description: locale === 'ar'
                          ? 'يدفع العميل عربوناً مقدماً والباقي لاحقاً.'
                          : 'Customer pays a deposit now and settles the remainder later.'
                      }
                    ].map((option) => {
                      const checked = formData.paymentOptions.includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                            checked ? 'border-primary bg-purple-50' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleServicePaymentOption(option.id)}
                            className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                          />
                          <span className="flex-1">
                        <span className="block font-medium text-gray-900">{option.title}</span>
                            <span className="block text-xs text-gray-500 mt-1">{option.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{t("serviceStatus")}</p>
                      <p className="text-sm text-gray-500">
                        {locale === 'ar'
                          ? 'التحكم في ظهور الخدمة للعميل.'
                          : 'Control whether the service is visible to customers.'}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleChange}
                        className="w-5 h-5 text-primary focus:ring-primary"
                      />
                      <span className="font-medium text-gray-700">{formData.isActive ? (locale === 'ar' ? 'نشط' : 'Active') : (locale === 'ar' ? 'غير نشط' : 'Inactive')}</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="font-medium text-gray-900 mb-3">{locale === 'ar' ? 'التوفر' : 'Availability'}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { name: 'availableInCenter', label: locale === 'ar' ? 'متوفر في المركز' : 'Available in Center' },
                      { name: 'availableHomeVisit', label: locale === 'ar' ? 'متوفر كزيارة منزلية' : 'Available as Home Visit' }
                    ].map((item) => (
                      <label key={item.name} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                        <input
                          type="checkbox"
                          name={item.name}
                          checked={(formData as any)[item.name]}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary focus:ring-primary"
                        />
                        <span className="font-medium text-gray-700">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
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
        </form>
      </ServiceEditorFrame>
    </TenantLayout>
  );
}
