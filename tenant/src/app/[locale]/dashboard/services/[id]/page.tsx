"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

const SERVICE_CATEGORIES = [
  "Hair Services",
  "Facial & Skin Care",
  "Massage & Body",
  "Nail Services",
  "Makeup",
  "Bridal Services",
  "General"
];

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

export default function EditServicePage() {
  const t = useTranslations("Services");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    category: "General",
    duration: "30",
    includes: [] as string[],
    benefits: [] as {en: string, ar: string}[],
    whatToExpect: [] as {en: string, ar: string}[],
    hasOffer: false,
    offerDetails: "",
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
  const [newBenefit, setNewBenefit] = useState({en: "", ar: ""});
  const [newWhatToExpect, setNewWhatToExpect] = useState({en: "", ar: ""});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);

  useEffect(() => {
    loadGlobalSettings();
    if (id) {
      loadService();
      loadEmployees();
      loadProducts();
    }
  }, [id]);

  const loadGlobalSettings = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/v1/settings/global');
      const data = await response.json();
      if (data.success) {
        setGlobalSettings(data.settings);
      }
    } catch (err) {
      console.error("Failed to load global settings:", err);
    }
  };

  const loadService = async () => {
    try {
      setLoading(true);
      setError("");
      
      const response = await tenantApi.getService(id as string);
      
      if (response.success && response.service) {
        const service = response.service;
        setFormData({
          name_en: service.name_en || "",
          name_ar: service.name_ar || "",
          description_en: service.description_en || "",
          description_ar: service.description_ar || "",
          rawPrice: service.rawPrice?.toString() || "",
          category: service.category || "General",
          duration: service.duration?.toString() || "30",
          includes: service.includes || [],
          benefits: service.benefits || [],
          whatToExpect: service.whatToExpect || [],
          hasOffer: service.hasOffer || false,
          offerDetails: service.offerDetails || "",
          hasGift: service.hasGift || false,
          giftType: service.giftType || "text",
          giftDetails: service.giftDetails || "",
          giftProductId: service.giftType === "product" ? service.giftDetails || "" : "",
          employeeIds: service.employees ? service.employees.map((e: any) => e.id) : [],
          isActive: service.isActive !== undefined ? service.isActive : true,
          availableInCenter: service.availableInCenter !== undefined ? service.availableInCenter : true,
          availableHomeVisit: service.availableHomeVisit !== undefined ? service.availableHomeVisit : false
        });
        
        if (service.image) {
          const imageUrl = `http://localhost:5000/uploads/${service.image}`;
          setExistingImage(imageUrl);
          setImagePreview(imageUrl);
        }
      } else {
        setError(response.message || "Failed to load service");
      }
    } catch (err: any) {
      console.error("Failed to load service:", err);
      setError(err.message || "Failed to load service");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await tenantApi.getEmployees(undefined, true);
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
        benefits: [...prev.benefits, {en: newBenefit.en.trim(), ar: newBenefit.ar.trim()}]
      }));
      setNewBenefit({en: "", ar: ""});
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
        whatToExpect: [...prev.whatToExpect, {en: newWhatToExpect.en.trim(), ar: newWhatToExpect.ar.trim()}]
      }));
      setNewWhatToExpect({en: "", ar: ""});
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

  const calculateFinalPrice = () => {
    const raw = parseFloat(formData.rawPrice || "0");
    const tax = raw * (globalSettings.taxRate / 100);
    const commission = raw * (globalSettings.serviceCommissionRate / 100);
    return raw + tax + commission;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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
      
      // Image (only if new file selected)
      if (imageFile) {
        submitData.append("image", imageFile);
      }

      const response = await tenantApi.updateService(id as string, submitData);
      
      if (response.success) {
        router.push(`/${locale}/dashboard/services`);
      } else {
        setError(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update service:", err);
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

  // Reuse the same form structure as new page, but with pre-filled data
  // For brevity, I'll use the same component structure
  return (
    <TenantLayout>
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("edit")} {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'تعديل معلومات الخدمة' : 'Edit service information'}
            </p>
          </div>
          <Link href={`/${locale}/dashboard/services`} className="btn btn-secondary">
            {t("cancel")}
          </Link>
        </div>
      </div>

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
                      {SERVICE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
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
                    onChange={(e) => setNewBenefit(prev => ({...prev, en: e.target.value}))}
                    placeholder={locale === 'ar' ? 'Benefit (English)...' : 'Benefit (English)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                  <input
                    type="text"
                    value={newBenefit.ar}
                    onChange={(e) => setNewBenefit(prev => ({...prev, ar: e.target.value}))}
                    placeholder={locale === 'ar' ? 'الفائدة (بالعربية)...' : 'الفائدة (بالعربية)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddBenefit}
                    disabled={!newBenefit.en.trim() || !newBenefit.ar.trim()}
                    className="btn btn-secondary w-full"
                  >
                    {t("addBenefit")}
                  </button>
                </div>

                {formData.benefits.length > 0 && (
                  <div className="space-y-2">
                    {formData.benefits.map((benefit, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-primary/10 rounded-lg flex items-start justify-between gap-2"
                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            {benefit.en}
                          </p>
                          <p className="text-sm text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}>
                            {benefit.ar}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBenefit(idx)}
                          className="text-red-500 hover:text-red-700 text-lg"
                        >
                          ×
                        </button>
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
                    onChange={(e) => setNewWhatToExpect(prev => ({...prev, en: e.target.value}))}
                    placeholder={locale === 'ar' ? 'What to Expect (English)...' : 'What to Expect (English)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                  <input
                    type="text"
                    value={newWhatToExpect.ar}
                    onChange={(e) => setNewWhatToExpect(prev => ({...prev, ar: e.target.value}))}
                    placeholder={locale === 'ar' ? 'ما يمكن توقعه (بالعربية)...' : 'ما يمكن توقعه (بالعربية)...'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddWhatToExpect}
                    disabled={!newWhatToExpect.en.trim() || !newWhatToExpect.ar.trim()}
                    className="btn btn-secondary w-full"
                  >
                    {t("addWhatToExpect")}
                  </button>
                </div>

                {formData.whatToExpect.length > 0 && (
                  <div className="space-y-2">
                    {formData.whatToExpect.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-primary/10 rounded-lg flex items-start justify-between gap-2"
                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            {item.en}
                          </p>
                          <p className="text-sm text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left', direction: 'rtl' }}>
                            {item.ar}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveWhatToExpect(idx)}
                          className="text-red-500 hover:text-red-700 text-lg"
                        >
                          ×
                        </button>
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
                        setImagePreview(existingImage);
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

                {/* Final Price Display */}
                {formData.rawPrice && (
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{t("rawPrice")}</span>
                      <span className="font-semibold"><Currency amount={parseFloat(formData.rawPrice)} /></span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{t("tax")} ({globalSettings.taxRate}%)</span>
                      <span className="text-sm"><Currency amount={parseFloat(formData.rawPrice) * (globalSettings.taxRate / 100)} /></span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{t("commission")} ({globalSettings.serviceCommissionRate}%)</span>
                      <span className="text-sm"><Currency amount={parseFloat(formData.rawPrice) * (globalSettings.serviceCommissionRate / 100)} /></span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                      <span className="font-bold text-gray-900">{t("finalPrice")}</span>
                      <span className="font-bold text-primary text-xl"><Currency amount={calculateFinalPrice()} /></span>
                    </div>
                  </div>
                )}
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
            disabled={saving || formData.employeeIds.length === 0}
            className="btn btn-primary flex-1"
          >
            {saving ? t("loading") : t("save")}
          </button>
        </div>
      </form>
    </TenantLayout>
  );
}

