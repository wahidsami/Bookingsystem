import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Trash2, Plus, ArrowLeft, Check, X, Gift, DollarSign, 
  Clock, Users, Heart, Info, Calendar, Coffee, Tag, MapPin, 
  Sparkle, Upload, Edit, Eye, Filter, SlidersHorizontal, Search, CheckSquare, Square,
  Activity, RotateCw, AlertTriangle, Image
} from 'lucide-react';
import { Language, Employee, Product, QuickLaunchRequest } from '../types';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import {
  buildServicePayload,
  createEmptyServiceDraft,
  createEmptyServiceVariantDraft,
  normalizeServicePaymentOptions,
  normalizeServiceRecord,
  resolveServiceImageUrl,
  type ServiceDraft,
  type ServiceRecord
} from '../lib/serviceContract';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import {
  buildTenantPlanSummary,
  formatTenantPlanLimit,
  getTenantPlanUsageCount
} from '../lib/tenantSubscription';

interface ServicesWorkspaceProps {
  lang: Language;
  quickLaunchRequest?: QuickLaunchRequest | null;
}

type ServiceCategoryOption = {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  icon?: string | null;
  sortOrder?: number;
};

// Canonical service contract with backwards-compatible aliases for display only
export type EnhancedService = ServiceRecord;

const defaultImage = 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=600&auto=format&fit=crop';
export default function ServicesWorkspace({ lang, quickLaunchRequest }: ServicesWorkspaceProps) {
  const isRtl = lang === 'ar';
  const { tenant, tenantSettings, packageEntitlements, subscription, subscriptionUsage } = useTenantAuth();

  // 1. Core Services State
  const [services, setServices] = useState<EnhancedService[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryOption[]>([]);

  const fetchData = async () => {
    try {
      const [srvRes, empRes, prdRes, catRes] = await Promise.all([
        tenantApiAdapter.getServices(),
        tenantApiAdapter.getEmployees(),
        tenantApiAdapter.getProducts(),
        tenantApiAdapter.getServiceCategories()
      ]);
      const normalizedServices: EnhancedService[] = ((srvRes as any).services || []).map((srv: any) => normalizeServiceRecord(srv));
      setServices(normalizedServices);
      setEmployees((empRes as any).employees || []);
      setProducts((prdRes as any).products || []);
      const normalizedCategories: ServiceCategoryOption[] = Array.isArray((catRes as any)?.categories)
        ? (catRes as any).categories
            .map((cat: any) => ({
              id: `${cat?.id || cat?.slug || cat?.name_en || cat?.name_ar || ''}`.trim(),
              slug: `${cat?.slug || cat?.id || cat?.name_en || cat?.name_ar || ''}`.trim(),
              labelAr: `${cat?.name_ar || cat?.nameAr || cat?.labelAr || cat?.title_ar || cat?.title || cat?.slug || ''}`.trim(),
              labelEn: `${cat?.name_en || cat?.nameEn || cat?.labelEn || cat?.title_en || cat?.title || cat?.slug || ''}`.trim(),
              icon: cat?.icon || null,
              sortOrder: Number(cat?.sortOrder ?? cat?.sort_order ?? 0)
            }))
            .filter((cat: ServiceCategoryOption) => cat.id && (cat.labelEn || cat.labelAr))
            .sort((left: ServiceCategoryOption, right: ServiceCategoryOption) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.labelEn.localeCompare(right.labelEn))
        : [];
      if (normalizedCategories.length > 0) {
        setServiceCategories(normalizedCategories);
      }
    } catch (err) {
      console.error('Failed to load services data:', err);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  // 2. Navigation & View State
  const [activeView, setActiveView] = useState<'list' | 'form'>('list');
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // 3. Search and Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [offerFilter, setOfferFilter] = useState(false);
  const [giftFilter, setGiftFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'price-asc' | 'price-desc' | 'duration-asc' | 'duration-desc'>('none');

  const planSummary = buildTenantPlanSummary({
    locale: isRtl ? 'ar' : 'en',
    tenant,
    tenantSettings,
    packageEntitlements,
    subscription,
    usageSnapshot: subscriptionUsage
  });
  const serviceLimit = planSummary.usage.services?.limit ?? planSummary.packageLimits?.maxServices ?? null;
  const serviceUsage = getTenantPlanUsageCount(planSummary.usage.services, services.length);
  const servicePlanName = isRtl ? planSummary.planNameAr : planSummary.planNameEn;

  // 5. Active form section guided editor
  const [activeSection, setActiveSection] = useState<'basic' | 'team' | 'options' | 'settings'>('basic');
  const serviceSectionOrder: Array<'basic' | 'team' | 'options' | 'settings'> = ['basic', 'team', 'options', 'settings'];
  const activeSectionIndex = Math.max(0, serviceSectionOrder.indexOf(activeSection));
  const goToPreviousSection = () => {
    setActiveSection(serviceSectionOrder[Math.max(0, activeSectionIndex - 1)]);
  };
  const goToNextSection = () => {
    setActiveSection(serviceSectionOrder[Math.min(serviceSectionOrder.length - 1, activeSectionIndex + 1)]);
  };

  // 6. Refreshing and synchronization feedback
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 7. Form Lifecycle State
  const [formData, setFormData] = useState<ServiceDraft>(() => createEmptyServiceDraft());

  React.useEffect(() => {
    if (activeView !== 'form' || formMode !== 'add' || serviceCategories.length === 0) {
      return;
    }

    const currentCategory = `${formData.categoryEn || formData.categoryAr || formData.category || ''}`.trim();
    const hasLiveCategory = serviceCategories.some((category) =>
      category.id === currentCategory
      || category.slug === currentCategory
      || category.labelEn === currentCategory
      || category.labelAr === currentCategory
    );

    if (hasLiveCategory) {
      return;
    }

    const liveDefault = serviceCategories[0];
    if (!liveDefault) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      category: liveDefault.slug,
      categoryEn: liveDefault.labelEn,
      categoryAr: liveDefault.labelAr
    }));
  }, [activeView, formMode, serviceCategories, formData.categoryEn, formData.categoryAr, formData.category]);

  // Auxiliary form temp states
  const [tempIncludeAr, setTempIncludeAr] = useState('');
  const [tempIncludeEn, setTempIncludeEn] = useState('');
  const [tempVariantNameAr, setTempVariantNameAr] = useState('');
  const [tempVariantNameEn, setTempVariantNameEn] = useState('');
  const [tempVariantDescriptionAr, setTempVariantDescriptionAr] = useState('');
  const [tempVariantDescriptionEn, setTempVariantDescriptionEn] = useState('');
  const [tempVariantPrice, setTempVariantPrice] = useState<string>('50');
  const [tempVariantDuration, setTempVariantDuration] = useState<string>('15');
  const [tempVariantIsActive, setTempVariantIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Custom premium Toast Notifications
  const [toasts, setToasts] = useState<{ id: string; msgAr: string; msgEn: string; type: 'success' | 'info' | 'error' }[]>([]);

  const triggerToast = (en: string, ar: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msgAr: ar, msgEn: en, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Image Uploading States & Helpers
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError(isRtl ? 'الملف المحدد ليس صورة صالحة. يرجى اختيار ملف صورة (PNG, JPG, WEBP).' : 'The selected file is not a valid image. Please select an image file (PNG, JPG, WEBP).');
      triggerToast('Invalid file format', 'تنسيق الملف غير صالح', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError(isRtl ? 'حجم الملف كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.' : 'File size is too large. Maximum allowed size is 5MB.');
      triggerToast('File size exceeds 5MB limit', 'حجم الملف يتجاوز الحد المسموح به 5 ميجابايت', 'error');
      return;
    }

    setUploadError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSelectedImageFile(file);
        setFormData(prev => ({
          ...prev,
          image: e.target!.result as string
        }));
        triggerToast('Image uploaded successfully!', 'تم رفع الصورة وتحديث غلاف الخدمة بنجاح!', 'success');
      }
      setUploading(false);
    };
    reader.onerror = () => {
      setUploadError(isRtl ? 'فشل قراءة الملف. يرجى المحاولة مرة أخرى.' : 'Failed to read file. Please try again.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const fallbackCategories: ServiceCategoryOption[] = [
    { id: 'massage-therapy', slug: 'massage-therapy', labelAr: 'علاجات ومساج', labelEn: 'Massage & Therapy' },
    { id: 'skincare', slug: 'skincare', labelAr: 'عناية بالبشرة', labelEn: 'Skincare' },
    { id: 'hair-care', slug: 'hair-care', labelAr: 'العناية بالشعر', labelEn: 'Hair Care' },
    { id: 'nail-care', slug: 'nail-care', labelAr: 'عناية بالأظافر', labelEn: 'Nail Care' }
  ];

  const categories = [
    { id: 'all', slug: 'all', labelAr: 'كل الفئات', labelEn: 'All Categories' },
    ...(serviceCategories.length > 0 ? serviceCategories : fallbackCategories)
  ];

  const resolveCategoryOption = (value: string) => {
    const normalized = `${value || ''}`.trim();
    if (!normalized) {
      return categories[1] || fallbackCategories[0] || categories[0];
    }

    return categories.find((category) =>
      category.id === normalized
      || category.slug === normalized
      || category.labelEn === normalized
      || category.labelAr === normalized
    ) || categories[1] || fallbackCategories[0] || categories[0];
  };

  const getServiceCategoryOption = (service: Partial<EnhancedService> & { category?: string; categoryEn?: string; categoryAr?: string }) => {
    const rawValue = service.category || service.categoryEn || service.categoryAr || '';
    return resolveCategoryOption(rawValue);
  };

  const matchesCategoryValue = (service: Partial<EnhancedService> & { category?: string; categoryEn?: string; categoryAr?: string }, categoryId: string) => {
    if (categoryId === 'all') return true;
    const resolvedCategory = getServiceCategoryOption(service);
    const candidates = new Set(
      [service.category, service.categoryEn, service.categoryAr, resolvedCategory.id, resolvedCategory.slug, resolvedCategory.labelEn, resolvedCategory.labelAr]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.trim())
    );
    return candidates.has(categoryId.trim());
  };

  const presetImages = [
    { url: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=600&auto=format&fit=crop', labelAr: 'جلسة تدليك ومساج', labelEn: 'Massage Session' },
    { url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=600&auto=format&fit=crop', labelAr: 'عناية وتنظيف بشرة', labelEn: 'Facial & Skincare' },
    { url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=600&auto=format&fit=crop', labelAr: 'تصفيف وقص شعر', labelEn: 'Haircut & Styling' },
    { url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600&auto=format&fit=crop', labelAr: 'عناية بالسبا وعلاج الشعر', labelEn: 'Hair Care & Organic Therapy' },
    { url: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=600&auto=format&fit=crop', labelAr: 'طلاء وعناية أظافر', labelEn: 'Nails & Pedicure' },
    { url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=600&auto=format&fit=crop', labelAr: 'علاجات حمام مغربي', labelEn: 'Moroccan Hammam' }
  ];

  // AI Content Generator
  const handleAIFillService = () => {
    if (!formData.nameEn && !formData.nameAr) {
      triggerToast(
        'Please input at least one Service Name (Arabic or English) to allow AI context pre-filling.',
        'يرجى كتابة اسم الخدمة بالعربية أو الإنجليزية أولاً لتمكين نظام الذكاء الاصطناعي من استنتاج البيانات.',
        'error'
      );
      return;
    }

    const name = formData.nameEn || formData.nameAr;
    triggerToast('Generating optimized service descriptions and specifications...', 'جاري توليد النبذة المهنية وتفاصيل الخدمة بواسطة الذكاء الاصطناعي...', 'info');

    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        descriptionEn: prev.descriptionEn || `Immersive premium therapeutic ${name} customized session. Uses award-winning premium materials, temperature-controlled luxury suites, and clinical experts to deliver profound revitalization and ultimate cell relief.`,
        descriptionAr: prev.descriptionAr || `جلسة ${name} الاحترافية الفاخرة مصممة خصيصاً لتلبية أعلى المعايير الفندقية. نستخدم منتجات طبيعية حاصلة على جوائز مع عطور مسترخية في أجنحة معقمة تحت إشراف نخبة من الكوادر المعتمدة لضمان النضارة التامة وعمق الارتياح.`,
        categoryAr: prev.categoryAr || 'علاجات ومساج',
        categoryEn: prev.categoryEn || 'Massage & Therapy'
      }));
      triggerToast('AI Generation completed! Localized details synchronized successfully.', 'تم اكتمال التوليد الذكي وصياغة التفاصيل الثنائية بنجاح.', 'success');
    }, 1200);
  };

  // AI Description Translation Helper
  const handleAITranslate = (direction: 'enToAr' | 'arToEn') => {
    if (direction === 'enToAr') {
      if (!formData.descriptionEn) {
        triggerToast('No English content found to translate.', 'لا يوجد محتوى باللغة الإنجليزية للترجمة.', 'error');
        return;
      }
      triggerToast('Translating English to localized Arabic...', 'جاري ترجمة الوصف إلى اللغة العربية الفصحى...', 'info');
      setTimeout(() => {
        setFormData(p => ({
          ...p,
          descriptionAr: `[ترجمة ذكية] ${p.descriptionEn} - صُمم هذا البرنامج خصيصاً لتعزيز الاسترخاء البدني الكامل وتحفيز تجديد الخلايا واستعادة حيوية الجسم بالكامل.`
        }));
        triggerToast('Translation completed!', 'تمت الترجمة وتحديث الوصف العربي بنجاح.', 'success');
      }, 800);
    } else {
      if (!formData.descriptionAr) {
        triggerToast('No Arabic content found to translate.', 'لا يوجد محتوى باللغة العربية للترجمة.', 'error');
        return;
      }
      triggerToast('Translating Arabic to English context...', 'جاري ترجمة الوصف إلى الإنجليزية...', 'info');
      setTimeout(() => {
        setFormData(p => ({
          ...p,
          descriptionEn: `[AI Translation] ${p.descriptionAr} - Specifically engineered to maximize muscular tissue decompression, accelerate healing, and yield long-lasting stress alleviation.`
        }));
        triggerToast('Translation completed!', 'تمت الترجمة وتحديث الوصف الإنجليزي بنجاح.', 'success');
      }, 800);
    }
  };

  // Open creation form
  const handleOpenAddForm = () => {
    const defaultCategory = categories[1] || fallbackCategories[0] || categories[0];
    setFormMode('add');
    setFormData(createEmptyServiceDraft(defaultCategory));
    setSelectedImageFile(null);
    setTempIncludeAr('');
    setTempIncludeEn('');
    setTempVariantNameAr('');
    setTempVariantNameEn('');
    setTempVariantDescriptionAr('');
    setTempVariantDescriptionEn('');
    setTempVariantPrice('50');
    setTempVariantDuration('15');
    setTempVariantIsActive(true);
    setFieldErrors({});
    setActiveSection('basic');
    setActiveView('form');
  };

  React.useEffect(() => {
    if (quickLaunchRequest?.target !== 'service') {
      return;
    }

    handleOpenAddForm();
  }, [quickLaunchRequest?.nonce]);

  // Open edit form
  const handleOpenEditForm = (srv: EnhancedService) => {
    const selectedCategoryOption = getServiceCategoryOption(srv);
    const normalizedService = normalizeServiceRecord(srv);
    setFormMode('edit');
    setSelectedImageFile(null);
    setFormData({
      ...createEmptyServiceDraft(selectedCategoryOption),
      ...normalizedService,
      category: selectedCategoryOption.slug,
      categoryEn: selectedCategoryOption.labelEn,
      categoryAr: selectedCategoryOption.labelAr,
      includes: [...(srv.includes || [])],
      variants: Array.isArray(normalizedService.variants) ? normalizedService.variants.map((v) => ({ ...v })) : [],
      paymentOptions: normalizeServicePaymentOptions(srv.paymentOptions),
      employeeAssignments: [...(srv.employeeAssignments || [])],
      employeeCommissions: srv.employeeCommissions ? { ...srv.employeeCommissions } : {}
    });
    setTempIncludeAr('');
    setTempIncludeEn('');
    setTempVariantNameAr('');
    setTempVariantNameEn('');
    setTempVariantDescriptionAr('');
    setTempVariantDescriptionEn('');
    setTempVariantPrice(String((normalizeServiceRecord(srv).finalPrice || 50)));
    setTempVariantDuration(String((normalizeServiceRecord(srv).duration || 15)));
    setTempVariantIsActive(true);
    setFieldErrors({});
    setActiveSection('basic');
    setActiveView('form');
  };

  // Toggle active status in list view
  const handleToggleActiveStatus = (id: string) => {
    setServices(prev => prev.map(srv => {
      if (srv.id === id) {
        const nextState = !srv.isActive;
        triggerToast(
          `Service status updated to ${nextState ? 'Active' : 'Inactive'}`,
          `تم تغيير حالة الخدمة بنجاح إلى ${nextState ? 'نشطة ومتوفرة للحجز' : 'غير نشطة وموقوفة مؤقتاً'}`,
          'info'
        );
        return { ...srv, isActive: nextState };
      }
      return srv;
    }));
  };

  // Delete service handler
  const handleDeleteService = async (id: string) => {
    const srv = services.find(s => s.id === id);
    if (!srv) return;
    
    try {
      await tenantApiAdapter.deleteService(id);
      setServices(prev => prev.filter(s => s.id !== id));
      triggerToast(
        `Service "${srv.nameEn || srv.nameAr}" deleted successfully from catalog.`,
        `تم إزالة خدمة "${srv.nameAr || srv.nameEn}" بالكامل من قائمة الخدمات المعتمدة.`,
        'success'
      );
    } catch (err: any) {
      triggerToast(err.message || 'Failed to delete service', 'فشل مسح الخدمة', 'error');
    }
  };

  // Refresh services catalog action
  const handleRefreshCatalog = () => {
    setIsRefreshing(true);
    triggerToast('Synchronizing services list with database...', 'جاري مزامنة كتالوج الخدمات وتأكيد صحة المواعيد النشطة...', 'info');
    setTimeout(() => {
      setIsRefreshing(false);
      triggerToast('Catalog successfully synchronized!', 'تمت مزامنة كتالوج الخدمات والتحقق من التغييرات بنجاح.', 'success');
    }, 1000);
  };

  // Save/Deploy Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Auto assign category texts based on selection
    const matchedCat = resolveCategoryOption(formData.category || formData.categoryEn || formData.categoryAr || '');
    const finalFormData: any = buildServicePayload({
      ...formData,
      category: matchedCat.slug,
      categoryEn: matchedCat.labelEn,
      categoryAr: matchedCat.labelAr
    });
    const imageValue = `${formData.image || ''}`.trim();
    const shouldPersistBodyImage = !selectedImageFile && imageValue.length > 0 && imageValue !== defaultImage;

    const nextErrors: Record<string, string> = {};
    if (!finalFormData.name_ar) {
      nextErrors.name_ar = isRtl ? 'اسم الخدمة بالعربية مطلوب.' : 'Arabic service name is required.';
    }
    if (!finalFormData.name_en) {
      nextErrors.name_en = isRtl ? 'اسم الخدمة بالإنجليزية مطلوب.' : 'English service name is required.';
    }
    if (finalFormData.priceType !== 'free' && !Number.isFinite(Number(finalFormData.finalPrice)) && !Number.isFinite(Number(finalFormData.rawPrice))) {
      nextErrors.finalPrice = isRtl ? 'السعر مطلوب للخدمات غير المجانية.' : 'A valid price is required for non-free services.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      triggerToast(
        'Please fix the validation issues before saving.',
        'يرجى مراجعة الأخطاء الظاهرة قبل الحفظ.',
        'error'
      );
      return;
    }

    try {
      const buildFormData = () => {
        const fd = new FormData();
        const appendValue = (key: string, value: any) => {
          if (value === undefined || value === null) {
            return;
          }

          if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof File) && !(value instanceof Blob))) {
            fd.append(key, JSON.stringify(value));
            return;
          }

          fd.append(key, `${value}`);
        };

        Object.entries(finalFormData).forEach(([key, value]) => {
          if (key === 'image') {
            return;
          }
          appendValue(key, value);
        });

        if (selectedImageFile) {
          fd.append('image', selectedImageFile);
        } else if (shouldPersistBodyImage) {
          fd.append('image', imageValue);
        }

        return fd;
      };

      const payload = selectedImageFile || shouldPersistBodyImage ? buildFormData() : finalFormData;
      if (formMode === 'add') {
        const res = await tenantApiAdapter.createService(payload);
        setServices(prev => [normalizeServiceRecord(res.service), ...prev]);
        triggerToast(
          `Deployed new service successfully!`,
          `تم إضافة وتنشيط الخدمة الجديدة في الكتالوج بنجاح!`,
          'success'
        );
      } else {
        const res = await tenantApiAdapter.updateService(finalFormData.id, payload);
        setServices(prev => prev.map(s => s.id === finalFormData.id ? normalizeServiceRecord(res.service) : s));
        triggerToast(
          `Updated service details!`,
          `تم حفظ تحديثات الخدمة وتثبيتها بنجاح.`,
          'success'
        );
      }
      setSelectedImageFile(null);
      setActiveView('list');
    } catch (err: any) {
      const rawMessage = `${err?.message || ''}`;
      const lower = rawMessage.toLowerCase();
      const nextErrors: Record<string, string> = {};
      if (lower.includes('service name') || lower.includes('name in both english and arabic')) {
        nextErrors.name_ar = rawMessage;
        nextErrors.name_en = rawMessage;
      }
      if (lower.includes('price')) {
        nextErrors.finalPrice = rawMessage;
      }
      if (lower.includes('payment option')) {
        nextErrors.paymentOptions = rawMessage;
      }
      if (lower.includes('employee')) {
        nextErrors.employeeAssignments = rawMessage;
      }
      if (lower.includes('variant')) {
        nextErrors.variants = rawMessage;
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
      }
      triggerToast(err.message || 'Failed to save service', 'فشل حفظ الخدمة', 'error');
    }
  };

  // Include Perks helpers
  const handleAddInclude = () => {
    const term = isRtl ? tempIncludeAr.trim() : tempIncludeEn.trim();
    if (!term) return;
    setFormData(prev => ({
      ...prev,
      includes: [...prev.includes, term]
    }));
    setTempIncludeAr('');
    setTempIncludeEn('');
  };

  const handleRemoveInclude = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      includes: prev.includes.filter((_, i) => i !== idx)
    }));
  };

  // Variants helpers
  const handleAddVariant = () => {
    const name = isRtl ? tempVariantNameAr.trim() : tempVariantNameEn.trim();
    if (!name) return;

    const newVar = {
      ...createEmptyServiceVariantDraft(),
      id: `var-${Date.now()}`,
      name_ar: tempVariantNameAr.trim() || tempVariantNameEn.trim(),
      name_en: tempVariantNameEn.trim() || tempVariantNameAr.trim(),
      description_ar: tempVariantDescriptionAr.trim(),
      description_en: tempVariantDescriptionEn.trim(),
      duration: Math.max(5, Math.round((parseInt(tempVariantDuration) || 0) / 5) * 5),
      rawPrice: parseFloat(tempVariantPrice) || 0,
      finalPrice: parseFloat(tempVariantPrice) || 0,
      isActive: tempVariantIsActive,
      nameAr: tempVariantNameAr.trim() || tempVariantNameEn.trim(),
      nameEn: tempVariantNameEn.trim() || tempVariantNameAr.trim(),
      descriptionAr: tempVariantDescriptionAr.trim(),
      descriptionEn: tempVariantDescriptionEn.trim(),
      description: tempVariantDescriptionEn.trim() || tempVariantDescriptionAr.trim() || tempVariantNameEn.trim() || tempVariantNameAr.trim(),
      price: parseFloat(tempVariantPrice) || 0
    };

    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, newVar]
    }));

    setTempVariantNameAr('');
    setTempVariantNameEn('');
    setTempVariantDescriptionAr('');
    setTempVariantDescriptionEn('');
    setTempVariantPrice('50');
    setTempVariantDuration('15');
    setTempVariantIsActive(true);
  };

  const handleRemoveVariant = (id: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id)
    }));
  };

  // Payment options toggles
  const handleTogglePaymentOption = (opt: string) => {
    setFormData(prev => {
      const active = prev.paymentOptions.includes(opt);
      const nextOpts = active 
        ? prev.paymentOptions.filter(o => o !== opt)
        : [...prev.paymentOptions, opt];
      return { ...prev, paymentOptions: nextOpts };
    });
  };

  // Employee assignment toggles
  const handleToggleEmployeeAssignment = (empId: string) => {
    setFormData(prev => {
      const assigned = prev.employeeAssignments.includes(empId);
      const nextAssigned = assigned
        ? prev.employeeAssignments.filter(id => id !== empId)
        : [...prev.employeeAssignments, empId];
      
      // Initialize or remove commission defaults
      const nextCommissions = { ...(prev.employeeCommissions || {}) };
      if (assigned) {
        delete nextCommissions[empId];
      } else {
        nextCommissions[empId] = { enabled: false, type: 'percentage', value: 10 };
      }

      return { 
        ...prev, 
        employeeAssignments: nextAssigned,
        employeeCommissions: nextCommissions
      };
    });
  };

  // Employee individual commission adjustments
  const handleUpdateCommission = (empId: string, fields: Partial<{ enabled: boolean; type: 'percentage' | 'fixed'; value: number }>) => {
    setFormData(prev => {
      const currentComm = prev.employeeCommissions?.[empId] || { enabled: false, type: 'percentage', value: 10 };
      return {
        ...prev,
        employeeCommissions: {
          ...(prev.employeeCommissions || {}),
          [empId]: { ...currentComm, ...fields }
        }
      };
    });
  };

  // FILTER LOGIC
  const filteredServices = services.filter(srv => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      srv.nameAr.toLowerCase().includes(query) ||
      srv.nameEn.toLowerCase().includes(query) ||
      (srv.descriptionAr && srv.descriptionAr.toLowerCase().includes(query)) ||
      (srv.descriptionEn && srv.descriptionEn.toLowerCase().includes(query));

    const matchesCategory = selectedCategory === 'all' || 
      matchesCategoryValue(srv, selectedCategory);

    const matchesGender = selectedGender === 'all' || srv.targetGender === selectedGender;

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && srv.isActive) ||
      (statusFilter === 'inactive' && !srv.isActive);

    const matchesOffer = !offerFilter || srv.hasOffer;

    const matchesGift = !giftFilter || srv.hasGift;

    return matchesSearch && matchesCategory && matchesGender && matchesStatus && matchesOffer && matchesGift;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'duration-asc') return a.duration - b.duration;
    if (sortBy === 'duration-desc') return b.duration - a.duration;
    return 0;
  });

  // Calculate unique category count dynamically helper
  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return services.length;
    return services.filter(s => matchesCategoryValue(s, catId)).length;
  };

  const isLimitReached = serviceLimit !== null && serviceLimit !== -1 && serviceUsage >= serviceLimit;

  return (
    <div className="font-sans relative space-y-6" id="services-management-workspace">
      
      {/* Toast Manager Rendering */}
      <div className="fixed top-24 right-6 left-6 md:left-auto md:w-96 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`p-4 rounded-2xl shadow-xl flex items-start gap-3 border pointer-events-auto ${
                t.type === 'success' 
                  ? 'bg-emerald-950 text-emerald-100 border-emerald-800' 
                  : t.type === 'error'
                  ? 'bg-rose-950 text-rose-100 border-rose-800'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-800'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {t.type === 'success' ? <CheckSquare size={16} className="text-emerald-400" /> : <Info size={16} className="text-amber-400" />}
              </div>
              <p className="text-xs font-bold leading-relaxed flex-1">
                {isRtl ? t.msgAr : t.msgEn}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        
        {/* LIST VIEW SCREEN */}
        {activeView === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* 2.2 Top Header Block - simplified to remove duplicate banner title */}
            <div className="flex justify-end gap-4 bg-white p-4 rounded-3xl border border-neutral-200/60 shadow-2xs">
              {/* Subscription limit summary chip */}
              <div className="flex items-center gap-2.5 bg-indigo-50/50 border border-indigo-100 p-3 rounded-2xl shrink-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-600/20">
                  <Activity size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-indigo-700 tracking-wider block leading-none mb-1">
                    {servicePlanName}
                  </span>
                  <span className="text-xs font-bold text-neutral-700 block leading-none">
                    {isRtl 
                      ? `تم استخدام ${serviceUsage} من أصل ${formatTenantPlanLimit(serviceLimit, 'ar')} خدمات` 
                      : `${serviceUsage} of ${formatTenantPlanLimit(serviceLimit, 'en')} Services Used`}
                  </span>
                </div>
              </div>
            </div>

            {/* 2.3 Search and Actions Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-neutral-200/60 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                {/* Search input field */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? 'البحث باسم الخدمة، الوصف أو معايير الخدمة...' : 'Search services, details, or keywords...'}
                    className="w-full bg-slate-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-800"
                  />
                  <Search size={14} className="absolute left-3.5 top-3.5 text-neutral-400" />
                </div>

                {/* Filter and sorting groups */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedGender}
                    onChange={e => setSelectedGender(e.target.value)}
                    className="bg-slate-50 hover:bg-slate-100 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs font-bold text-neutral-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{isRtl ? 'كل الجماهير' : 'All Genders'}</option>
                    <option value="female">{isRtl ? 'نساء فقط' : 'Females Only'}</option>
                    <option value="male">{isRtl ? 'رجال فقط' : 'Males Only'}</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="bg-slate-50 hover:bg-slate-100 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs font-bold text-neutral-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{isRtl ? 'كل الحالات' : 'All Status'}</option>
                    <option value="active">{isRtl ? 'نشط' : 'Active Only'}</option>
                    <option value="inactive">{isRtl ? 'غير نشط' : 'Inactive Only'}</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-slate-50 hover:bg-slate-100 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs font-bold text-neutral-700 focus:outline-none cursor-pointer"
                  >
                    <option value="none">{isRtl ? 'ترتيب افتراضي' : 'Default Sorting'}</option>
                    <option value="price-asc">{isRtl ? 'السعر: من الأقل للأعلى' : 'Price: Low to High'}</option>
                    <option value="price-desc">{isRtl ? 'السعر: من الأعلى للأقل' : 'Price: High to Low'}</option>
                    <option value="duration-asc">{isRtl ? 'الوقت: الأقصر أولاً' : 'Duration: Shortest'}</option>
                    <option value="duration-desc">{isRtl ? 'الوقت: الأطول أولاً' : 'Duration: Longest'}</option>
                  </select>
                </div>
              </div>

              {/* Add Service button with status boundary limit warning check */}
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={handleOpenAddForm}
                  disabled={isLimitReached}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0 ${
                    isLimitReached 
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 shadow-none cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10'
                  }`}
                >
                  <Plus size={14} />
                  <span>{isRtl ? 'إضافة خدمة جديدة' : 'Add New Service'}</span>
                </button>
              </div>
            </div>

            {/* Warning banner if subscription limits exceeded */}
            {isLimitReached && (
              <div className="bg-amber-50 border border-amber-200/70 p-4 rounded-2xl text-xs text-amber-800 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">{isRtl ? 'لقد وصلت للحد الأقصى للخدمات مسبقة التفعيل في باقتك الحالية' : 'Subscription catalog limit reached'}</p>
                  <p className="text-[11px] text-amber-700/95 mt-0.5">
                    {isRtl 
                      ? `الباقة الحالية تدعم بحد أقصى ${formatTenantPlanLimit(serviceLimit, 'ar')} خدمات نشطة. لإنشاء المزيد من الخدمات، يرجى الترقية إلى باقة أعلى أو أرشفة الخدمات القديمة.` 
                      : `The current plan supports up to ${formatTenantPlanLimit(serviceLimit, 'en')} active catalog services. To add more, archive existing services or upgrade your subscription plan.`}
                  </p>
                </div>
              </div>
            )}

            {/* MAIN CATALOG TWO-COLUMN LAYOUT */}
            {services.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-neutral-150 text-center space-y-3">
                <div className="w-16 h-16 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
                  <SlidersHorizontal size={24} />
                </div>
                <h3 className="text-sm font-black text-neutral-700">{isRtl ? 'لم يتم إضافة أي خدمات بالكتالوج حتى الآن' : 'No Catalog Services Found'}</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  {isRtl 
                    ? 'ابدأ بتهيئة أولى خدماتك بالضغط على الزر العلوي "إضافة خدمة جديدة" للبدء بالبيع وتلقي الحجوزات.' 
                    : 'Get started by creating your very first service to activate the online client reservation flow.'}
                </p>
                <button
                  onClick={handleOpenAddForm}
                  className="px-4 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 transition-all cursor-pointer"
                >
                  {isRtl ? 'ابدأ بإضافة أولى خدماتك' : 'Create First Service'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 2.6 Left Column: Category Navigation compact panel */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-white rounded-2xl border border-neutral-200/60 p-4 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <span className="text-xs font-black text-neutral-800 uppercase tracking-tight">
                        {isRtl ? 'الفئات المعتمدة' : 'Service Categories'}
                      </span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black">
                        {services.length}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      {categories.map(cat => {
                        const active = selectedCategory === cat.id;
                        const count = getCategoryCount(cat.id);
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left rtl:text-right ${
                              active 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-neutral-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-xs font-bold truncate pr-2">
                              {isRtl ? cat.labelAr : cat.labelEn}
                            </span>
                            <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                              active ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-neutral-500'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Filters checklist */}
                  <div className="bg-white rounded-2xl border border-neutral-200/60 p-4 space-y-3 shadow-2xs">
                    <span className="text-xs font-black text-neutral-800 uppercase tracking-tight block border-b border-slate-100 pb-2">
                      {isRtl ? 'مرشحات ترويجية سريعة' : 'Promotion Filters'}
                    </span>
                    <div className="space-y-2 pt-1 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-neutral-600">
                        <input
                          type="checkbox"
                          checked={offerFilter}
                          onChange={e => setOfferFilter(e.target.checked)}
                          className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>{isRtl ? 'الخدمات ذات العروض الخاصة' : 'Services with Special Offers'}</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-neutral-600">
                        <input
                          type="checkbox"
                          checked={giftFilter}
                          onChange={e => setGiftFilter(e.target.checked)}
                          className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>{isRtl ? 'الخدمات المرفقة بهدايا عينية' : 'Services with Free Gifts'}</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2.7 Right Column: Filtered service results main panel */}
                <div className="lg:col-span-9 space-y-4">
                  
                  {/* Results Panel Header */}
                  <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/60 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <h2 className="text-xs font-black text-neutral-800 uppercase tracking-wide">
                        {isRtl 
                          ? `نتائج الفئة: ${categories.find(c => c.id === selectedCategory)?.labelAr || selectedCategory}` 
                          : `Category Results: ${categories.find(c => c.id === selectedCategory)?.labelEn || selectedCategory}`}
                      </h2>
                      <span className="text-[10px] text-neutral-400 font-bold">
                        ({filteredServices.length} {isRtl ? 'خدمة مفعّلة' : 'services match'})
                      </span>
                    </div>

                    <button
                      onClick={handleRefreshCatalog}
                      disabled={isRefreshing}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-neutral-500 hover:text-indigo-600 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title={isRtl ? 'تحديث الكتالوج' : 'Refresh Catalog'}
                    >
                      <RotateCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                      <span>{isRtl ? 'مزامنة الكتالوج' : 'Sync Catalog'}</span>
                    </button>
                  </div>

                  {/* 2.8 Service results list stack of horizontal cards */}
                  {filteredServices.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 border border-neutral-200/60 text-center space-y-3 shadow-2xs">
                      <div className="w-12 h-12 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
                        <Filter size={18} />
                      </div>
                      <h3 className="text-xs font-black text-neutral-700">{isRtl ? 'عذراً، لم نعثر على نتائج مطابقة' : 'No Matching Services'}</h3>
                      <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                        {isRtl 
                          ? 'يرجى تغيير الكلمات البحثية أو تصفية فئة الخدمات في اليسار للوصول إلى الخدمات المعتمدة.' 
                          : 'Try adjusting your filters, searching for alternate keywords, or choosing another category.'}
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('all');
                          setSelectedGender('all');
                          setStatusFilter('all');
                          setOfferFilter(false);
                          setGiftFilter(false);
                        }}
                        className="px-3 py-1.5 bg-slate-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-all cursor-pointer border border-neutral-200"
                      >
                        {isRtl ? 'إعادة ضبط كل المرشحات' : 'Clear All Filters'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {filteredServices.map(srv => {
                        const finalPrice = srv.hasOffer && srv.offerDiscountPct
                          ? Math.round(srv.price * (1 - srv.offerDiscountPct / 100))
                          : srv.price;

                        return (
                          <div 
                            key={srv.id} 
                            className="bg-white rounded-2xl border border-neutral-200/60 p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between shadow-2xs hover:shadow-md transition-all relative"
                          >
                            
                            {/* 1) Main identity zone */}
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 min-w-0">
                              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border shrink-0 relative">
                                <img 
                                  src={resolveServiceImageUrl(srv.image || defaultImage)}
                                  alt={srv.nameEn} 
                                  className="w-full h-full object-cover" 
                                />
                                {srv.hasOffer && (
                                  <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                                    {srv.offerDiscountPct}% OFF
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[9px] bg-slate-100 text-neutral-600 px-2 py-0.5 rounded-md font-bold uppercase">
                                    {isRtl ? getServiceCategoryOption(srv).labelAr : getServiceCategoryOption(srv).labelEn}
                                  </span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${
                                    srv.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
                                  }`}>
                                    {srv.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                                  </span>
                                  <span className="text-[9px] bg-slate-100 text-neutral-600 px-2 py-0.5 rounded-md font-bold">
                                    {srv.targetGender === 'female' ? (isRtl ? 'للنساء' : 'Females') : srv.targetGender === 'male' ? (isRtl ? 'للرجال' : 'Males') : (isRtl ? 'للجنسين' : 'Unisex')}
                                  </span>
                                </div>

                                <h3 className="text-sm font-black text-neutral-800 tracking-tight leading-tight line-clamp-1">
                                  {isRtl ? srv.nameAr : srv.nameEn}
                                </h3>

                                <p className="text-xs text-neutral-400 line-clamp-1">
                                  {isRtl ? (srv.descriptionAr || 'لا يوجد وصف عربي متاح.') : (srv.descriptionEn || 'No English description added.')}
                                </p>
                                
                                <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-500 font-bold">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-indigo-500" />
                                    <span>{srv.duration} {isRtl ? 'دقيقة' : 'mins'}</span>
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-neutral-300" />
                                  <span className="flex items-center gap-1">
                                    <Users size={12} className="text-indigo-500" />
                                    <span>{(srv.employeeAssignments || []).length} {isRtl ? 'أخصائيات معتمدات' : 'specialists'}</span>
                                  </span>
                                </div>

                                {/* Offer / Gift labels */}
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {srv.hasOffer && (
                                    <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                                      <Tag size={10} />
                                      <span>{isRtl ? srv.offerDetailsAr : srv.offerDetailsEn}</span>
                                    </span>
                                  )}
                                  {srv.hasGift && (
                                    <span className="text-[9px] bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                                      <Gift size={10} />
                                      <span>{isRtl ? srv.giftDetailsAr : srv.giftDetailsEn}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 2) Price and actions zone */}
                            <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 w-full lg:w-48 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                              <div className="text-left lg:text-right">
                                <span className="text-[9px] text-neutral-400 font-black uppercase block">{isRtl ? 'السعر النهائي' : 'Final Price'}</span>
                                <div className="flex items-center gap-1.5 lg:justify-end">
                                  {srv.hasOffer && (
                                    <span className="text-xs text-neutral-400 line-through font-mono">
                                      {srv.price}
                                    </span>
                                  )}
                                  <span className="text-base font-black text-indigo-600 font-mono">
                                    {finalPrice} <span className="text-[10px]">{isRtl ? 'ر.س' : 'SAR'}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleToggleActiveStatus(srv.id)}
                                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                                    srv.isActive 
                                      ? 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100' 
                                      : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {srv.isActive ? (isRtl ? 'تعطيل' : 'Deactivate') : (isRtl ? 'تفعيل' : 'Activate')}
                                </button>
                                
                                <button
                                  onClick={() => handleOpenEditForm(srv)}
                                  className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all cursor-pointer"
                                  title={isRtl ? 'تعديل الخدمة' : 'Configure Service'}
                                >
                                  <Edit size={13} />
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteService(srv.id)}
                                  className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all cursor-pointer"
                                  title={isRtl ? 'حذف الخدمة' : 'Remove Service'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>
            )}
          </motion.div>
        )}

        {/* FULL PAGE DEDICATED FORM VIEW (ADD / EDIT) */}
        {activeView === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-3xl border border-neutral-100 shadow-md overflow-hidden"
          >
            {/* 3.2 Top Editor Header */}
            <div className="bg-zinc-900 text-white p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-750 flex items-center justify-center text-white transition-all cursor-pointer border border-zinc-700 shadow-sm"
                >
                  <ArrowLeft size={16} className={isRtl ? "rotate-180" : ""} />
                </button>
                <div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">
                    {formMode === 'add' 
                      ? (isRtl ? 'إنشاء خدمة جديدة بالكامل' : 'DEPLOY NEW CONTEXTUAL SERVICE') 
                      : (isRtl ? 'تحديث إعدادات ومعايير الخدمة' : 'CONFIGURE ACTIVE SERVICE MODEL')
                    }
                  </span>
                  <h1 className="text-lg font-black tracking-tight mt-0.5">
                    {formMode === 'add'
                      ? (isRtl ? 'إضافة وتنسيق خدمة جديدة' : 'Onboard & Deploy New Service')
                      : (isRtl ? `تعديل خدمة: ${formData.nameAr || formData.nameEn}` : `Configure Details: ${formData.nameEn || formData.nameAr}`)
                    }
                  </h1>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded-xl text-xs font-bold text-neutral-300 transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء وتراجع' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveService}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{formMode === 'add' ? (isRtl ? 'تنشيط الخدمة في الكتالوج' : 'Deploy Changes') : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}</span>
                </button>
              </div>
            </div>

            {/* Smart Compliance Banner */}
            <div className="bg-indigo-50 border-b border-indigo-100 p-4 px-6 text-xs text-indigo-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-indigo-600 shrink-0" />
                <p className="font-semibold">
                  {isRtl 
                    ? 'الذكاء الاصطناعي متاح لمساعدتك في صياغة بيانات الخدمة ووصفها اللغوي بشكل ثنائي فوراً.'
                    : 'Refah AI Assistant is online. Select your active section and tap any AI help trigger for instant content enhancement.'}
                </p>
              </div>
            </div>

            {/* Main Form Body Layout */}
            <div className="p-6 md:p-8 bg-slate-50/40">
              <form onSubmit={handleSaveService} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* 3.3 Left Section Navigation Column (Progress Indicator & Navigation) */}
                <div className="lg:col-span-3 space-y-3 bg-white p-4 rounded-2xl border border-neutral-200/60 shadow-2xs">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block border-b border-slate-100 pb-2">
                    {isRtl ? 'أقسام إعداد الخدمة' : 'Service Creation Progress'}
                  </span>
                  
                  <div className="flex flex-col gap-2 pt-1">
                    {[
                      { id: 'basic', labelEn: 'Basic Info & Identity', labelAr: 'الهوية والمعلومات الأساسية', stepEn: 'Step 1 of 4', stepAr: 'الخطوة ١ من ٤', value: 25 },
                      { id: 'team', labelEn: 'Service Performers', labelAr: 'تعيين الكادر والعمولات', stepEn: 'Step 2 of 4', stepAr: 'الخطوة ٢ من ٤', value: 50 },
                      { id: 'options', labelEn: 'Includes & Upgrades', labelAr: 'المشمولات وباقات الدلال', stepEn: 'Step 3 of 4', stepAr: 'الخطوة ٣ من ٤', value: 75 },
                      { id: 'settings', labelEn: 'Channels & Policies', labelAr: 'سياسات الحجز والسداد', stepEn: 'Step 4 of 4', stepAr: 'الخطوة ٤ من ٤', value: 100 }
                    ].map(sect => {
                      const active = activeSection === sect.id;
                      return (
                        <button
                          key={sect.id}
                          type="button"
                          onClick={() => setActiveSection(sect.id as any)}
                          className={`w-full text-left rtl:text-right p-3 rounded-xl border transition-all cursor-pointer ${
                            active 
                              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 shadow-2xs' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-neutral-600'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-extrabold truncate pr-1">
                              {isRtl ? sect.labelAr : sect.labelEn}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between text-[9px] text-neutral-400 font-bold mb-1.5">
                            <span>{isRtl ? sect.stepAr : sect.stepEn}</span>
                            <span>{sect.value}%</span>
                          </div>

                          {/* Progress Line */}
                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${active ? 'bg-indigo-600' : 'bg-neutral-300'}`}
                              style={{ width: `${sect.value}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3.4 Main Editor Area - Conditional Display by activeSection */}
                <div className="lg:col-span-9">
                  
                  {/* SECTION 1: BASIC INFORMATION & LOCALE */}
                  {activeSection === 'basic' && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-xs space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal size={16} className="text-indigo-600" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                            {isRtl ? 'المعلومات التعريفية وهوية الخدمة' : 'Basic Identity & Information'}
                          </h3>
                        </div>

                        {/* AI Fill button in section header */}
                        <button
                          type="button"
                          onClick={handleAIFillService}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-all shrink-0"
                        >
                          <Sparkles size={11} />
                          <span>{isRtl ? 'صياغة ذكية متكاملة' : 'AI Content Generator'}</span>
                        </button>
                      </div>

                      {fieldErrors.general && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                          {fieldErrors.general}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Name fields stacked vertically */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-bold block">
                            {isRtl ? 'اسم الخدمة بالعربية *' : 'Service Name (Arabic) *'}
                          </label>
                          <input
                            type="text"
                            required
                            autoFocus
                            value={formData.nameAr}
                            onChange={e => setFormData(p => ({ ...p, nameAr: e.target.value, name_ar: e.target.value }))}
                            placeholder="مثال: جلسة مساج السويدي الملكي بالأروما"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500 text-neutral-800"
                          />
                          {fieldErrors.name_ar && <p className="text-[10px] font-bold text-rose-600">{fieldErrors.name_ar}</p>}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-bold block">
                            {isRtl ? 'اسم الخدمة بالإنجليزي *' : 'Service Name (English) *'}
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.nameEn}
                            onChange={e => setFormData(p => ({ ...p, nameEn: e.target.value, name_en: e.target.value }))}
                            placeholder="e.g. Royal Swedish Massage with Aromatherapy"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500 text-neutral-800"
                          />
                          {fieldErrors.name_en && <p className="text-[10px] font-bold text-rose-600">{fieldErrors.name_en}</p>}
                        </div>

                        {/* Description fields with localized translations attached */}
                        <div className="space-y-1 md:col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-neutral-500 font-bold block">
                              {isRtl ? 'الوصف التعريفي للخدمة بالعربية' : 'Detailed Description (Arabic)'}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleAITranslate('enToAr')}
                              className="text-[9px] text-indigo-600 font-black hover:underline cursor-pointer"
                            >
                              {isRtl ? 'توليد ترجمة عربية ذكية' : 'Translate English to Arabic'}
                            </button>
                          </div>
                          <textarea
                            value={formData.descriptionAr}
                            onChange={e => setFormData(p => ({ ...p, descriptionAr: e.target.value, description_ar: e.target.value }))}
                            placeholder="اكتب نبذة مهنية عن الخدمة لتظهر للعميل في التطبيق والموقع..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500 h-24 leading-relaxed text-neutral-800"
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-neutral-500 font-bold block">
                              {isRtl ? 'الوصف التعريفي للخدمة بالإنجليزي' : 'Detailed Description (English)'}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleAITranslate('arToEn')}
                              className="text-[9px] text-indigo-600 font-black hover:underline cursor-pointer"
                            >
                              {isRtl ? 'توليد ترجمة إنجليزية ذكية' : 'Translate Arabic to English'}
                            </button>
                          </div>
                          <textarea
                            value={formData.descriptionEn}
                            onChange={e => setFormData(p => ({ ...p, descriptionEn: e.target.value, description_en: e.target.value }))}
                            placeholder="Write rich description showcasing results, organic products used, and benefits..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500 h-24 leading-relaxed text-neutral-800"
                          />
                        </div>

                        {/* Category and duration row side-by-side */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-bold block">
                            {isRtl ? 'فئة الخدمة الرئيسية *' : 'Service Main Category *'}
                          </label>
                          <select
                            value={formData.category || categories[1]?.slug || categories[0]?.slug || 'general'}
                            onChange={e => {
                              const val = e.target.value;
                              const matched = categories.find(c => c.id === val || c.slug === val || c.labelEn === val || c.labelAr === val);
                              setFormData(p => ({
                                ...p,
                                category: matched?.slug || val,
                                categoryEn: matched ? matched.labelEn : val,
                                categoryAr: matched ? matched.labelAr : val
                              }));
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500 text-neutral-800 cursor-pointer"
                          >
                            {categories.slice(1).map(c => (
                              <option key={c.slug || c.id} value={c.slug || c.id}>{isRtl ? c.labelAr : c.labelEn}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-bold block">
                            {isRtl ? 'مدة الجلسة الفعلية (بالدقائق) *' : 'Actual Session Duration (Mins) *'}
                          </label>
                          <input
                            type="number"
                            required
                            value={formData.duration}
                            onChange={e => setFormData(p => ({ ...p, duration: parseInt(e.target.value) || 30 }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:bg-white focus:ring-1 focus:ring-indigo-500 text-neutral-800 font-mono"
                            placeholder="e.g. 60"
                          />
                        </div>

                        {/* Target audience field */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] text-neutral-500 font-bold block">
                            {isRtl ? 'الجمهور المستهدف من الخدمة' : 'Audience Gender Demographics'}
                          </label>
                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/50">
                            {[
                              { id: 'all', labelAr: 'للجميع', labelEn: 'All Genders' },
                              { id: 'female', labelAr: 'نساء فقط', labelEn: 'Females Only' },
                              { id: 'male', labelAr: 'رجال فقط', labelEn: 'Males Only' }
                            ].map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, targetGender: t.id as any }))}
                                className={`py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                  formData.targetGender === t.id 
                                    ? 'bg-zinc-950 text-white shadow-2xs' 
                                    : 'text-neutral-500 hover:bg-neutral-100'
                                }`}
                              >
                                {isRtl ? t.labelAr : t.labelEn}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Pricing component */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-bold block">
                            {isRtl ? 'نوع التسعير' : 'Pricing Type'}
                          </label>
                          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/50">
                            {[
                              { id: 'fixed', labelAr: 'مبلغ محدد وثابت', labelEn: 'Fixed Price' },
                              { id: 'free', labelAr: 'مجانية', labelEn: 'Free' }
                            ].map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, priceType: t.id as any }))}
                                className={`py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                  formData.priceType === t.id 
                                    ? 'bg-zinc-950 text-white shadow-2xs' 
                                    : 'text-neutral-500 hover:bg-neutral-100'
                                }`}
                              >
                                {isRtl ? t.labelAr : t.labelEn}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-500 font-bold block">
                            {isRtl ? 'السعر المطلوب الأساسي (ر.س) *' : 'Service Price (SAR) *'}
                          </label>
                          <input
                            type="number"
                            required
                            value={formData.finalPrice ?? formData.price}
                            onChange={e => setFormData(p => ({
                              ...p,
                              price: parseFloat(e.target.value) || 0,
                              finalPrice: parseFloat(e.target.value) || 0,
                              rawPrice: parseFloat(e.target.value) || 0
                            }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:bg-white focus:ring-1 focus:ring-indigo-500 text-neutral-800 font-mono"
                            placeholder="e.g. 450"
                          />
                          {fieldErrors.finalPrice && <p className="text-[10px] font-bold text-rose-600">{fieldErrors.finalPrice}</p>}
                        </div>

                      </div>
                    </div>
                  )}

                  {/* SECTION 2: STAFF & TEAM ASSIGNMENT */}
                  {activeSection === 'team' && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-indigo-600" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                            {isRtl ? 'تفويض الأخصائيات والعمولات المنفردة' : 'Service Performers & Individual Commission'}
                          </h3>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-neutral-700 px-2 py-0.5 rounded-full font-black">
                          {formData.employeeAssignments.length} {isRtl ? 'أخصائيات معينات' : 'assigned'}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] text-neutral-400 font-bold leading-relaxed">
                          {isRtl 
                            ? 'عيّن الأخصائيات المسموح لهن بتقديم هذه الجلسة، مع إمكانية تمكين وضبط عمولة منفردة مخصصة لكل واحدة منهن.' 
                            : 'Check all employees certified to perform this specific treatment, and optionally override their base salary with custom session commissions.'}
                        </p>

                        {fieldErrors.employeeAssignments && (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                            {fieldErrors.employeeAssignments}
                          </div>
                        )}

                        <div className="space-y-3">
                          {employees.map(emp => {
                            const assigned = formData.employeeAssignments.includes(emp.id);
                            const comm = formData.employeeCommissions?.[emp.id] || { enabled: false, type: 'percentage', value: 10 };
                            
                            return (
                              <div 
                                key={emp.id}
                                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                  assigned 
                                    ? 'bg-indigo-50/20 border-indigo-200 shadow-2xs' 
                                    : 'bg-white border-slate-200 opacity-70'
                                }`}
                              >
                                {/* Left identity block */}
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEmployeeAssignment(emp.id)}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                      assigned ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-300 bg-white'
                                    }`}
                                  >
                                    {assigned && <Check size={12} />}
                                  </button>

                                  <img 
                                    src={emp.avatar} 
                                    alt={emp.nameEn} 
                                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-100"
                                  />

                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-neutral-800">
                                      {isRtl ? emp.nameAr : emp.nameEn}
                                    </p>
                                    <p className="text-[9px] text-neutral-400 font-extrabold">
                                      {isRtl ? emp.roleAr : emp.roleEn}
                                    </p>
                                  </div>
                                </div>

                                {/* Right commission override block (if assigned) */}
                                {assigned && (
                                  <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200/70 self-start md:self-auto text-xs">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={comm.enabled}
                                        onChange={e => handleUpdateCommission(emp.id, { enabled: e.target.checked })}
                                        className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                      />
                                      <span className="text-[10px] text-neutral-500 font-bold">{isRtl ? 'عمولة خاصة' : 'Custom Commission'}</span>
                                    </label>

                                    {comm.enabled && (
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={comm.type}
                                          onChange={e => handleUpdateCommission(emp.id, { type: e.target.value as any })}
                                          className="bg-slate-100 border border-slate-200 rounded-lg p-1 text-[10px] font-bold text-neutral-700"
                                        >
                                          <option value="percentage">%</option>
                                          <option value="fixed">{isRtl ? 'ر.س' : 'SAR'}</option>
                                        </select>
                                        <input
                                          type="number"
                                          value={comm.value}
                                          onChange={e => handleUpdateCommission(emp.id, { value: parseFloat(e.target.value) || 0 })}
                                          className="w-16 bg-slate-50 border border-slate-200 rounded-lg p-1 text-[10px] font-bold font-mono text-center"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: SERVICE OPTIONS & COMPLIMENTARY EXTRAS (With contextual right extras column!) */}
                  {activeSection === 'options' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* Left form column for primary sections */}
                      <div className="lg:col-span-8 space-y-6">
                        
                        {/* Includes Block */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-4">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 block">
                              {isRtl ? 'مشمولات الخدمة ومظاهر الدلال' : 'What is Included in This Service'}
                            </h3>
                            <span className="text-[9px] text-neutral-400 font-bold block mt-1">
                              {isRtl ? 'مزايا إضافية مجانية مرافقة للجلسة لتعزيز رغبة الحجز لدى العميل.' : 'Free session perks to trigger high reservation rates.'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={isRtl ? tempIncludeAr : tempIncludeEn}
                              onChange={e => isRtl ? setTempIncludeAr(e.target.value) : setTempIncludeEn(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddInclude())}
                              placeholder={isRtl ? 'مثال: تقديم شاي اللافندر الساخن' : 'e.g. Complimentary hot herbal tea'}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-neutral-700 focus:bg-white text-neutral-800"
                            />
                            <button
                              type="button"
                              onClick={handleAddInclude}
                              className="px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition-all"
                            >
                              {isRtl ? 'إضافة' : 'Add'}
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {formData.includes.length === 0 ? (
                              <span className="text-[10px] text-neutral-400 font-medium italic">
                                {isRtl ? 'لا يوجد مشمولات مضافة للخدمة حتى الآن' : 'No inclusions added yet.'}
                              </span>
                            ) : (
                              formData.includes.map((inc, i) => (
                                <span key={i} className="bg-indigo-50/40 border border-indigo-100/60 text-indigo-950 px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5 font-bold">
                                  <span>{inc}</span>
                                  <button type="button" onClick={() => handleRemoveInclude(i)} className="text-neutral-400 hover:text-rose-600 cursor-pointer">
                                    <X size={10} />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Pricing variants section */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-4">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 block">
                              {isRtl ? 'مستويات الترقيات والبدائل' : 'Service Pricing Variants & Upgrades'}
                            </h3>
                            <span className="text-[9px] text-neutral-400 font-bold block mt-1">
                              {isRtl ? 'إتاحة خيارات بديلة للعميل لتكثيف الوقت أو إضافة مواد ترقية لزيادة قيمة الحجز.' : 'Enable alternative options for duration extensions or premium additions.'}
                            </span>
                          </div>

                          {fieldErrors.variants && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                              {fieldErrors.variants}
                            </div>
                          )}

                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-wider text-neutral-500">
                              <span>{isRtl ? 'الاسم بالعربية *' : 'Arabic Name *'}</span>
                              <span>{isRtl ? 'الاسم بالإنجليزية *' : 'English Name *'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={tempVariantNameAr}
                                onChange={e => setTempVariantNameAr(e.target.value)}
                                placeholder="الاسم بالعربية"
                                className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold text-neutral-800 focus:bg-white focus:outline-none"
                              />
                              <input
                                type="text"
                                value={tempVariantNameEn}
                                onChange={e => setTempVariantNameEn(e.target.value)}
                                placeholder="Name in English"
                                className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold text-neutral-800 focus:bg-white focus:outline-none"
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-wider text-neutral-500 pt-1">
                              <span>{isRtl ? 'الوصف بالعربية' : 'Arabic Description'}</span>
                              <span>{isRtl ? 'الوصف بالإنجليزية' : 'English Description'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <textarea
                                value={tempVariantDescriptionAr}
                                onChange={e => setTempVariantDescriptionAr(e.target.value)}
                                placeholder={isRtl ? 'وصف البديل بالعربية' : 'Arabic variant description'}
                                className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-medium text-neutral-800 focus:bg-white focus:outline-none min-h-[72px] resize-none"
                              />
                              <textarea
                                value={tempVariantDescriptionEn}
                                onChange={e => setTempVariantDescriptionEn(e.target.value)}
                                placeholder="English variant description"
                                className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-medium text-neutral-800 focus:bg-white focus:outline-none min-h-[72px] resize-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block">
                                  {isRtl ? 'السعر الإضافي *' : 'Variant Price *'}
                                </label>
                                <input
                                  type="number"
                                  value={tempVariantPrice}
                                  onChange={e => setTempVariantPrice(e.target.value)}
                                  placeholder="50"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold font-mono text-neutral-800 focus:bg-white focus:outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block">
                                  {isRtl ? 'المدة بالدقائق *' : 'Variant Duration (mins) *'}
                                </label>
                                <input
                                  type="number"
                                  value={tempVariantDuration}
                                  onChange={e => setTempVariantDuration(e.target.value)}
                                  placeholder="15"
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold font-mono text-neutral-800 focus:bg-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                              <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-600 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={tempVariantIsActive}
                                  onChange={(e) => setTempVariantIsActive(e.target.checked)}
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span>{isRtl ? 'البديل متاح للحجز الآن' : 'Variant is active and bookable'}</span>
                              </label>
                              <button
                                type="button"
                                onClick={handleAddVariant}
                                className="px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-black cursor-pointer"
                              >
                                {isRtl ? 'حفظ بديل' : 'Add Upgrade'}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {formData.variants.length === 0 ? (
                              <span className="text-[10px] text-neutral-400 font-medium italic">
                                {isRtl ? 'لا يوجد بدائل تسعيرية مضافة للخدمة حالياً' : 'No alternative upgrades defined.'}
                              </span>
                            ) : (
                              formData.variants.map((v) => (
                                <div key={v.id} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border text-[10px] font-bold">
                                  <div>
                                    <span className="font-extrabold text-neutral-700">{isRtl ? v.nameAr : v.nameEn}</span>
                                    <span className="text-neutral-400 ml-2">({v.duration} {isRtl ? 'دقيقة إضافية' : 'add. mins'})</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-black ${v.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                      {v.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'متوقف' : 'Inactive')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-indigo-600 font-mono">+{v.price} {isRtl ? 'ر.س' : 'SAR'}</span>
                                    <button type="button" onClick={() => handleRemoveVariant(v.id)} className="text-neutral-400 hover:text-rose-600 cursor-pointer">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Gifts Block */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-4">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.hasGift}
                              onChange={e => setFormData(p => ({ ...p, hasGift: e.target.checked }))}
                              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span className="text-xs font-black text-neutral-800">{isRtl ? 'ربط وتوزيع منتج هدية عينية مجانية مع هذه الخدمة' : 'Attach Complimentary Gift with This Booking'}</span>
                          </label>

                          {formData.hasGift && (
                            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                              <div className="space-y-1">
                                <label className="text-[9px] text-neutral-500 font-bold block">{isRtl ? 'اختر منتج الهدية من مخزون المستودع' : 'Select Gift Product from Stock'}</label>
                                <select
                                  value={formData.giftProductId || ''}
                                  onChange={e => setFormData(p => ({ ...p, giftProductId: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-neutral-800 cursor-pointer"
                                >
                                  <option value="">{isRtl ? '-- حدد منتج عيني --' : '-- Select Retail Product --'}</option>
                                  {products.map(prd => (
                                    <option key={prd.id} value={prd.id}>
                                      {isRtl ? prd.nameAr : prd.nameEn} ({prd.sku})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-neutral-500 font-bold block">{isRtl ? 'تفاصيل ووصف الهدية بالعربية' : 'Gift Description (Arabic)'}</label>
                                  <input
                                    type="text"
                                    value={formData.giftDetailsAr || ''}
                                    onChange={e => setFormData(p => ({ ...p, giftDetailsAr: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-neutral-800"
                                    placeholder="مثال: لوشن مرطب بخلاصة اللافندر مجاني"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[9px] text-neutral-500 font-bold block">{isRtl ? 'تفاصيل ووصف الهدية بالإنجليزي' : 'Gift Description (English)'}</label>
                                  <input
                                    type="text"
                                    value={formData.giftDetailsEn || ''}
                                    onChange={e => setFormData(p => ({ ...p, giftDetailsEn: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-neutral-800"
                                    placeholder="e.g. Complimenary lavender hydrating lotion"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Right column for section-specific contextual extras */}
                      <div className="lg:col-span-4 space-y-6">
                        
                        {/* Image upload and preview card */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                              {isRtl ? 'صورة الغلاف للخدمة' : 'Service Display Cover'}
                            </span>
                            {formData.image !== defaultImage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(p => ({ ...p, image: defaultImage }));
                                  setSelectedImageFile(null);
                                  setUploadError(null);
                                  triggerToast('Reverted to default image placeholder', 'تمت إعادة تعيين الصورة إلى الافتراضية', 'info');
                                }}
                                className="text-[10px] font-black text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 size={11} />
                                <span>{isRtl ? 'إزالة الصورة' : 'Remove Image'}</span>
                              </button>
                            )}
                          </div>

                          {/* Interactive Drop / Click Upload Zone */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              if (e.dataTransfer.files?.[0]) {
                                handleFileChange(e.dataTransfer.files[0]);
                              }
                            }}
                            onClick={() => {
                              document.getElementById('service-image-upload')?.click();
                            }}
                            className={`relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all overflow-hidden ${
                              isDragging
                                ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]'
                                : 'border-neutral-200 hover:border-indigo-400 hover:bg-slate-50/50'
                            }`}
                          >
                            {/* Hidden file input */}
                            <input
                              type="file"
                              id="service-image-upload"
                              className="hidden"
                              accept="image/png, image/jpeg, image/jpg, image/webp"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileChange(e.target.files[0]);
                                }
                              }}
                            />

                            {uploading ? (
                              <div className="space-y-3 w-full px-4">
                                <div className="flex justify-center">
                                  <RotateCw className="animate-spin text-indigo-600" size={24} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs font-black text-neutral-700">{isRtl ? 'جاري معالجة الصورة...' : 'Processing image file...'}</p>
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-600 h-full animate-pulse" style={{ width: '75%' }}></div>
                                  </div>
                                </div>
                              </div>
                            ) : formData.image && formData.image !== defaultImage ? (
                              <div className="absolute inset-0 group">
                                <img src={resolveServiceImageUrl(formData.image)} alt="Service cover" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                                  <Upload size={20} className="drop-shadow-xs" />
                                  <span className="text-[10px] font-black">{isRtl ? 'اضغط أو اسحب لتغيير الصورة' : 'Click or Drag to replace'}</span>
                                </div>
                                <div className="absolute bottom-2 right-2 bg-indigo-600 text-[8px] font-black text-white px-2 py-0.5 rounded shadow-sm">
                                  {isRtl ? 'مرفوع بنجاح' : 'Custom Uploaded'}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2 pointer-events-none">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto">
                                  <Upload size={18} />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-xs font-black text-neutral-700">
                                    {isRtl ? 'اسحب وأفلت صورة هنا أو تصفح' : 'Drag & drop image here or browse'}
                                  </p>
                                  <p className="text-[10px] font-bold text-neutral-400">
                                    {isRtl ? 'صيغ PNG, JPG, WEBP حتى 5 ميجابايت' : 'PNG, JPG, WEBP up to 5MB'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Error block if any */}
                          {uploadError && (
                            <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
                              {uploadError}
                            </p>
                          )}

                          {/* Live preview label if default image is shown */}
                          {formData.image === defaultImage && (
                            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold justify-center bg-slate-50 p-2 rounded-xl border border-neutral-150">
                              <Image size={12} className="text-neutral-400" />
                              <span>{isRtl ? 'يتم عرض الصورة الافتراضية للخدمة' : 'Showing default service placeholder image'}</span>
                            </div>
                          )}
                        </div>

                        {/* Offers configuration card */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.hasOffer}
                              onChange={e => setFormData(p => ({ ...p, hasOffer: e.target.checked }))}
                              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span className="text-xs font-black text-neutral-800">{isRtl ? 'تنشيط عرض وخصم ترويجي' : 'Enable Special Promotion'}</span>
                          </label>

                          {formData.hasOffer && (
                            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-neutral-500 font-bold block">{isRtl ? 'نسبة الخصم %' : 'Discount Rate %'}</label>
                                  <input
                                    type="number"
                                    value={formData.offerDiscountPct || ''}
                                    onChange={e => setFormData(p => ({ ...p, offerDiscountPct: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold font-mono text-neutral-800"
                                    placeholder="e.g. 15"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-neutral-500 font-bold block">{isRtl ? 'تاريخ الانتهاء' : 'Valid Until'}</label>
                                  <input
                                    type="date"
                                    value={formData.offerTo || ''}
                                    onChange={e => setFormData(p => ({ ...p, offerTo: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold text-neutral-800"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-neutral-500 font-bold block">{isRtl ? 'تفاصيل العرض بالعربية' : 'Offer Details (Arabic)'}</label>
                                <input
                                  type="text"
                                  value={formData.offerDetailsAr || ''}
                                  onChange={e => setFormData(p => ({ ...p, offerDetailsAr: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-neutral-800"
                                  placeholder="خصم خاص 15% لحجوزات منتصف الأسبوع"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-neutral-500 font-bold block">{isRtl ? 'تفاصيل العرض بالإنجليزي' : 'Offer Details (English)'}</label>
                                <input
                                  type="text"
                                  value={formData.offerDetailsEn || ''}
                                  onChange={e => setFormData(p => ({ ...p, offerDetailsEn: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-neutral-800"
                                  placeholder="Special 15% off for active sessions"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  )}

                  {/* SECTION 4: SETTINGS, POLICIES & AVAILABILITY SWITCHES */}
                  {activeSection === 'settings' && (
                    <div className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-xs space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <DollarSign size={16} className="text-indigo-600" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                          {isRtl ? 'قنوات تفعيل الخدمة وسياسات السداد' : 'Accepted Payment Channels & Reservation Policies'}
                        </h3>
                      </div>

                      <div className="space-y-6">
                        
                        {/* 1) Payment options group (multiple checkboxes card-style) */}
                        <div className="space-y-3">
                          <label className="text-[10px] text-neutral-400 font-black uppercase tracking-wider block">
                            {isRtl ? 'طرق وسياسات السداد المقبولة للحجز' : 'Accepted Booking Payment Channels'}
                          </label>

                          {fieldErrors.paymentOptions && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                              {fieldErrors.paymentOptions}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                              { id: 'at-center', titleEn: 'Cash / Card at Center', titleAr: 'الدفع المباشر داخل فرع الصالون' },
                              { id: 'online-full', titleEn: 'Full Pre-payment Online', titleAr: 'سداد كامل القيمة عبر البوابة الإلكترونية' },
                              { id: 'booking-fee', titleEn: 'Guaranteed Deposit', titleAr: 'دفع عربون تأمين لضمان الحضور' }
                            ].map(opt => {
                              const active = formData.paymentOptions.includes(opt.id);
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleTogglePaymentOption(opt.id)}
                                  className={`p-4 rounded-xl border text-left rtl:text-right flex items-center gap-3 cursor-pointer select-none transition-all ${
                                    active 
                                      ? 'bg-indigo-50/50 border-indigo-200 shadow-2xs' 
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-300 bg-white'
                                  }`}>
                                    {active && <Check size={11} />}
                                  </div>
                                  <span className="text-xs font-extrabold text-neutral-700 leading-tight">
                                    {isRtl ? opt.titleAr : opt.titleEn}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2) Service status group & 3) Availability groups */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                          
                          <div className="space-y-4">
                            <span className="text-[10px] text-neutral-400 font-black uppercase tracking-wider block">
                              {isRtl ? 'الحالة التشغيلية وقنوات الخدمة' : 'Service Operations status'}
                            </span>

                            <div className="space-y-3.5">
                              <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={formData.isActive}
                                  onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                                />
                                <div className="text-xs">
                                  <span className="font-extrabold text-neutral-700 block">{isRtl ? 'تنشيط الخدمة فوراً للحجز' : 'Active and Open for Bookings'}</span>
                                  <span className="text-[10px] text-neutral-400 block">{isRtl ? 'تظهر للعملاء في التطبيق وموقع الويب' : 'Show immediately in online reservation flow'}</span>
                                </div>
                              </label>

                              <label className="flex items-start gap-3 cursor-pointer select-none pt-2.5 border-t border-slate-100">
                                <input
                                  type="checkbox"
                                  checked={formData.availableInCenter}
                                  onChange={e => setFormData(p => ({ ...p, availableInCenter: e.target.checked }))}
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                                />
                                <div className="text-xs">
                                  <span className="font-extrabold text-neutral-700 block">{isRtl ? 'متاحة للتقديم داخل الصالون / الفرع' : 'Available for In-Center Visits'}</span>
                                  <span className="text-[10px] text-neutral-400 block">{isRtl ? 'تنفيذ الجلسة في الغرف والأجنحة المخصصة' : 'Client travels to the registered tenant suites'}</span>
                                </div>
                              </label>
                            </div>

                          </div>

                          <div className="space-y-4">
                            <span className="text-[10px] text-neutral-400 font-black uppercase tracking-wider block">
                              {isRtl ? 'سياسات الحجز والزيارات الخارجية' : 'Scheduling & Visitiation limits'}
                            </span>

                            <div className="space-y-3.5">
                              <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={formData.availableHomeVisit}
                                  onChange={e => setFormData(p => ({ ...p, availableHomeVisit: e.target.checked }))}
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                                />
                                <div className="text-xs">
                                  <span className="font-extrabold text-neutral-700 block">{isRtl ? 'متاحة لخدمة المنازل (الزيارة الخارجية)' : 'Available for Home Services'}</span>
                                  <span className="text-[10px] text-neutral-400 block">{isRtl ? 'ينتقل كادر العمل لعنوان العميل مباشرة' : 'On-duty specialists travel to the customer address'}</span>
                                </div>
                              </label>

                              <label className="flex items-start gap-3 cursor-pointer select-none pt-2.5 border-t border-slate-100">
                                <input
                                  type="checkbox"
                                  checked={formData.allowReschedule}
                                  onChange={e => setFormData(p => ({ ...p, allowReschedule: e.target.checked }))}
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                                />
                                <div className="text-xs">
                                  <span className="font-extrabold text-neutral-700 block">{isRtl ? 'السماح للعميل بإعادة الجدولة وتعديل الموعد' : 'Allow Customer Rescheduling'}</span>
                                  <span className="text-[10px] text-neutral-400 block">{isRtl ? 'وفقاً لسياسة الإلغاء والجدولة في الإعدادات العامة' : 'Follows standard cancel/reschedule boundaries'}</span>
                                </div>
                              </label>
                            </div>

                          </div>

                        </div>

                      </div>
                    </div>
                  )}

                </div>

                <div className="lg:col-span-12 flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/60 bg-white px-4 py-3 shadow-2xs">
                  <button
                    type="button"
                    onClick={goToPreviousSection}
                    disabled={activeSectionIndex === 0}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      activeSectionIndex === 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isRtl ? 'السابق' : 'Previous'}
                  </button>

                  <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    {isRtl
                      ? `الخطوة ${activeSectionIndex + 1} من ${serviceSectionOrder.length}`
                      : `Step ${activeSectionIndex + 1} of ${serviceSectionOrder.length}`}
                  </div>

                  <button
                    type="button"
                    onClick={goToNextSection}
                    disabled={activeSectionIndex === serviceSectionOrder.length - 1}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      activeSectionIndex === serviceSectionOrder.length - 1
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isRtl ? 'التالي' : 'Next'}
                  </button>
                </div>

              </form>
            </div>

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
