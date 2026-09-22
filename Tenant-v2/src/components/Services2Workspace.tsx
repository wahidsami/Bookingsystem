import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Trash2, Plus, ArrowLeft, Check, X, Gift, DollarSign, 
  Clock, Users, Heart, Info, Calendar, Coffee, Tag, MapPin, 
  Sparkle, Upload, Edit, Eye, Filter, SlidersHorizontal, Search, CheckSquare, Square,
  Activity, RotateCw, AlertTriangle, Image, Package, FolderPlus, ChevronDown, ChevronLeft, ChevronRight, Layers,
  Globe, CheckCircle2, MoreVertical, Boxes
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
  resolveServiceOrBundleCategory,
  type ServiceDraft,
  type ServiceRecord
} from '../lib/serviceContract';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import {
  buildTenantPlanSummary,
  formatTenantPlanLimit,
  getTenantPlanUsageCount
} from '../lib/tenantSubscription';
import BundleBuilderModal from './services2/BundleBuilderModal';
import ServiceResourceRequirementsSection from './services2/ServiceResourceRequirementsSection';

interface Services2WorkspaceProps {
  lang: Language;
  quickLaunchRequest?: QuickLaunchRequest | null;
}

export type TenantCategoryOption = {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
  packages?: any[];
  services?: any[];
};

// Canonical service contract with backwards-compatible aliases for display only
export type EnhancedService = ServiceRecord;

export interface UnifiedServiceItem {
  type: 'service';
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  image?: string | null;
  tenantServiceCategoryId?: string | null;
  category: string;
  categoryEn?: string;
  categoryAr?: string;
  price: number;
  finalPrice: number;
  duration: number;
  targetGender: 'all' | 'female' | 'male';
  isActive: boolean;
  hasOffer?: boolean;
  offerDiscountPct?: number;
  offerDetailsEn?: string | null;
  offerDetailsAr?: string | null;
  hasGift?: boolean;
  giftDetailsEn?: string | null;
  giftDetailsAr?: string | null;
  employeeAssignments?: any[];
  rawRecord: EnhancedService;
}

export interface UnifiedBundleItem {
  type: 'bundle';
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  image?: string | null;
  tenantServiceCategoryId?: string | null;
  tenantCategory?: any;
  price: number;
  finalPrice: number;
  totalPrice: number;
  duration: number;
  totalDuration: number;
  targetGender: 'all' | 'female' | 'male';
  isActive: boolean;
  itemsCount: number;
  items: any[];
  allowOnlineBooking: boolean;
  scheduleType?: 'sequence' | 'parallel';
  pricingType?: 'service' | 'custom' | 'discount' | 'free';
  discountPercentage?: number | null;
  customPrice?: number | null;
  rawRecord: any;
}

export type UnifiedCatalogItem = UnifiedServiceItem | UnifiedBundleItem;

const defaultImage = 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=600&auto=format&fit=crop';
export default function Services2Workspace({ lang, quickLaunchRequest }: Services2WorkspaceProps) {
  const isRtl = lang === 'ar';
  const { tenant, tenantSettings, packageEntitlements, subscription, subscriptionUsage } = useTenantAuth();

  // 1. Core Services & Bundles State
  const [services, setServices] = useState<EnhancedService[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<TenantCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1.2 Phase 4A UI Modals and Menus
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'service' | 'bundle'>('all');
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TenantCategoryOption | null>(null);
  const [isBundleInfoModalOpen, setIsBundleInfoModalOpen] = useState(false);
  const [selectedBundleForInfo, setSelectedBundleForInfo] = useState<UnifiedBundleItem | null>(null);
  const [isBundleBuilderOpen, setIsBundleBuilderOpen] = useState(false);
  const [bundleToEdit, setBundleToEdit] = useState<UnifiedBundleItem | null>(null);

  // Category creation & editing form states
  const [catNameAr, setCatNameAr] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catDescAr, setCatDescAr] = useState('');
  const [catDescEn, setCatDescEn] = useState('');
  const [catSortOrder, setCatSortOrder] = useState<number>(0);
  const [catFormError, setCatFormError] = useState<string | null>(null);
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [srvRes, empRes, prdRes, catRes, bundleRes] = await Promise.all([
        tenantApiAdapter.getServices(),
        tenantApiAdapter.getEmployees(),
        tenantApiAdapter.getProducts(),
        tenantApiAdapter.getTenantServiceCategories(),
        tenantApiAdapter.getServices2Bundles().catch(() => tenantApiAdapter.getPackages())
      ]);
      const normalizedServices: EnhancedService[] = ((srvRes as any).services || []).map((srv: any) => normalizeServiceRecord(srv));
      setServices(normalizedServices);
      setEmployees((empRes as any).employees || []);
      setProducts((prdRes as any).products || []);
      setPackages((bundleRes as any).bundles || (bundleRes as any).packages || []);

      const normalizedCategories: TenantCategoryOption[] = Array.isArray((catRes as any)?.categories)
        ? (catRes as any).categories
            .map((cat: any) => ({
              id: `${cat?.id || ''}`.trim(),
              slug: `${cat?.slug || cat?.id || ''}`.trim(),
              labelAr: `${cat?.name_ar || cat?.nameAr || ''}`.trim(),
              labelEn: `${cat?.name_en || cat?.nameEn || ''}`.trim(),
              descriptionAr: cat?.description_ar || null,
              descriptionEn: cat?.description_en || null,
              icon: cat?.icon || null,
              sortOrder: Number(cat?.sortOrder ?? cat?.sort_order ?? 0),
              isActive: cat?.isActive !== false,
              packages: cat?.packages || [],
              services: cat?.services || []
            }))
            .filter((cat: TenantCategoryOption) => cat.id && (cat.labelEn || cat.labelAr))
            .sort((left: TenantCategoryOption, right: TenantCategoryOption) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.labelEn.localeCompare(right.labelEn))
        : [];
      setServiceCategories(normalizedCategories);
    } catch (err) {
      console.error('Failed to load Services data:', err);
      triggerToast('Failed to sync Services catalog', 'فشل تحميل بيانات الخدمات', 'error');
    } finally {
      setIsLoading(false);
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
  const [pendingQuickLaunch, setPendingQuickLaunch] = useState<QuickLaunchRequest | null>(null);

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

  // Categories: Strictly Tenant-Owned Categories (no global Super Admin categories)
  const categories = serviceCategories;

  // Unified Items: Map Services and Packages into a Unified Catalog Item List
  const unifiedItems: UnifiedCatalogItem[] = React.useMemo(() => {
    const serviceItems: UnifiedServiceItem[] = services.map(srv => {
      const finalPrice = srv.hasOffer && srv.offerDiscountPct
        ? Math.round(srv.price * (1 - srv.offerDiscountPct / 100))
        : srv.price;

      return {
        type: 'service',
        id: srv.id,
        nameEn: srv.nameEn,
        nameAr: srv.nameAr,
        descriptionEn: srv.descriptionEn,
        descriptionAr: srv.descriptionAr,
        image: srv.image,
        tenantServiceCategoryId: srv.tenantServiceCategoryId || null,
        category: srv.category,
        categoryEn: srv.categoryEn,
        categoryAr: srv.categoryAr,
        price: srv.price,
        finalPrice,
        duration: srv.duration,
        targetGender: srv.targetGender,
        isActive: srv.isActive,
        hasOffer: srv.hasOffer,
        offerDiscountPct: srv.offerDiscountPct,
        offerDetailsEn: srv.offerDetailsEn,
        offerDetailsAr: srv.offerDetailsAr,
        hasGift: srv.hasGift,
        giftDetailsEn: srv.giftDetailsEn,
        giftDetailsAr: srv.giftDetailsAr,
        employeeAssignments: srv.employeeAssignments,
        rawRecord: srv
      };
    });

    const bundleItems: UnifiedBundleItem[] = packages.map(pkg => {
      const rawPrice = parseFloat(pkg.totalPrice || 0);
      const rawDuration = Number(pkg.totalDuration || 0);
      const rawItems = Array.isArray(pkg.items) ? pkg.items : [];

      return {
        type: 'bundle',
        id: pkg.id,
        nameEn: pkg.name_en || pkg.nameEn || '',
        nameAr: pkg.name_ar || pkg.nameAr || '',
        descriptionEn: pkg.description_en || pkg.descriptionEn || null,
        descriptionAr: pkg.description_ar || pkg.descriptionAr || null,
        image: pkg.image || null,
        tenantServiceCategoryId: pkg.tenantServiceCategoryId
          || pkg.tenant_service_category_id
          || (typeof pkg.tenantCategory === 'string' ? pkg.tenantCategory : pkg.tenantCategory?.id)
          || pkg.categoryId
          || null,
        tenantCategory: pkg.tenantCategory || null,
        price: rawPrice,
        finalPrice: rawPrice,
        totalPrice: rawPrice,
        duration: rawDuration,
        totalDuration: rawDuration,
        targetGender: (pkg.targetGender as any) || 'all',
        isActive: pkg.isActive !== false,
        itemsCount: rawItems.length,
        items: rawItems,
        allowOnlineBooking: pkg.allowOnlineBooking !== false,
        rawRecord: pkg
      };
    });

    return [...serviceItems, ...bundleItems];
  }, [services, packages]);

  // Category resolution for catalog items using authoritative helper
  const resolveItemCategory = (item: UnifiedCatalogItem) => {
    return resolveServiceOrBundleCategory(item.rawRecord || item, serviceCategories);
  };

  const matchesCategoryValue = (item: UnifiedCatalogItem, categoryId: string) => {
    if (categoryId === 'all') return true;
    const resolved = resolveItemCategory(item);
    if (categoryId === 'uncategorized') {
      return !resolved;
    }
    return resolved?.id === categoryId || (resolved?.slug && resolved?.slug === categoryId);
  };

  // Dynamically calculate category stats (services + bundles)
  const getCategoryStats = (catId: string) => {
    const matched = catId === 'all'
      ? unifiedItems
      : catId === 'uncategorized'
      ? unifiedItems.filter(item => !resolveItemCategory(item))
      : unifiedItems.filter(item => {
          const res = resolveItemCategory(item);
          return res?.id === catId || (res?.slug && res?.slug === catId);
        });
    const serviceCount = matched.filter(i => i.type === 'service').length;
    const bundleCount = matched.filter(i => i.type === 'bundle').length;
    return {
      total: matched.length,
      services: serviceCount,
      bundles: bundleCount,
      serviceCount,
      bundleCount
    };
  };

  // Check if uncategorized items exist
  const uncategorizedStats = React.useMemo(() => {
    const uncat = unifiedItems.filter(item => !resolveItemCategory(item));
    return {
      total: uncat.length,
      services: uncat.filter(i => i.type === 'service').length,
      bundles: uncat.filter(i => i.type === 'bundle').length,
      serviceCount: uncat.filter(i => i.type === 'service').length,
      bundleCount: uncat.filter(i => i.type === 'bundle').length
    };
  }, [unifiedItems, serviceCategories]);

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
    const defaultCategory = serviceCategories[0] || { id: '', slug: 'general', labelAr: 'عام', labelEn: 'General', sortOrder: 0, isActive: true };
    setFormMode('add');
    setFormData(createEmptyServiceDraft({
      id: defaultCategory.id,
      slug: defaultCategory.slug,
      labelAr: defaultCategory.labelAr,
      labelEn: defaultCategory.labelEn
    } as any));
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

  const handleOpenAddService = () => {
    handleOpenAddForm();
  };

  const handleOpenAddBundle = () => {
    setBundleToEdit(null);
    setIsBundleBuilderOpen(true);
    setIsAddMenuOpen(false);
  };

  const handleOpenEditBundle = (bundle: UnifiedBundleItem) => {
    setBundleToEdit(bundle);
    setIsBundleBuilderOpen(true);
  };

  React.useEffect(() => {
    if (quickLaunchRequest?.target !== 'service') {
      return;
    }

    setPendingQuickLaunch(quickLaunchRequest);
  }, [quickLaunchRequest?.nonce, quickLaunchRequest?.serviceId, quickLaunchRequest?.section, quickLaunchRequest?.target]);

  React.useEffect(() => {
    const request = pendingQuickLaunch;
    if (!request || request.target !== 'service') {
      return;
    }

    if (request.serviceId) {
      const targetService = services.find((service) => `${service.id}` === `${request.serviceId}`);
      if (!targetService) {
        return;
      }

      handleOpenEditForm(targetService);
      if (request.section) {
        setActiveSection(request.section);
      }
      setPendingQuickLaunch(null);
      return;
    }

    handleOpenAddForm();
    setPendingQuickLaunch(null);
  }, [pendingQuickLaunch, services]);

  // Open edit form
  const handleOpenEditForm = (srv: EnhancedService) => {
    const matchedCategory = resolveServiceOrBundleCategory(srv, serviceCategories);
    const selectedCategoryOption = matchedCategory ? {
      id: matchedCategory.id,
      slug: matchedCategory.slug,
      labelAr: matchedCategory.labelAr,
      labelEn: matchedCategory.labelEn,
    } : {
      id: 'uncategorized',
      slug: 'uncategorized',
      labelAr: isRtl ? 'غير مصنف' : 'Uncategorized',
      labelEn: 'Uncategorized',
    };
    const normalizedService = normalizeServiceRecord(srv);
    setSelectedServiceId(normalizedService.id);
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
      resourceRequirements: Array.isArray(normalizedService.resourceRequirements) ? normalizedService.resourceRequirements.map((r) => ({ ...r })) : [],
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

  // Bundle action handlers
  const handleToggleBundleStatus = async (bundleId: string, currentStatus: boolean) => {
    try {
      await tenantApiAdapter.updatePackage(bundleId, { isActive: !currentStatus });
      setPackages(prev => prev.map(p => p.id === bundleId ? { ...p, isActive: !currentStatus } : p));
      triggerToast(
        `Bundle ${!currentStatus ? 'activated' : 'deactivated'} successfully!`,
        `تم ${!currentStatus ? 'تفعيل' : 'تعطيل'} الباقة بنجاح!`,
        'success'
      );
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to update bundle', 'فشل تحديث حالة الباقة', 'error');
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    const target = packages.find(p => p.id === bundleId);
    const name = target ? (isRtl ? target.name_ar : target.name_en) : 'this bundle';
    if (!window.confirm(isRtl ? `هل أنت متأكد من حذف الباقة "${name}"؟` : `Are you sure you want to remove "${name}"?`)) {
      return;
    }
    try {
      await tenantApiAdapter.deletePackage(bundleId);
      setPackages(prev => prev.filter(p => p.id !== bundleId));
      triggerToast('Bundle removed successfully', 'تم حذف الباقة بنجاح', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to delete bundle', 'فشل حذف الباقة', 'error');
    }
  };

  // Category CRUD Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatFormError(null);

    if (!catNameAr.trim() || !catNameEn.trim()) {
      setCatFormError(isRtl ? 'يرجى إدخال اسم الفئة بالعربية والإنجليزية.' : 'Please provide the category name in both Arabic and English.');
      return;
    }

    setIsSubmittingCat(true);
    try {
      const res = await tenantApiAdapter.createTenantServiceCategory({
        name_ar: catNameAr.trim(),
        name_en: catNameEn.trim(),
        description_ar: catDescAr.trim() || undefined,
        description_en: catDescEn.trim() || undefined,
        sortOrder: Number(catSortOrder) || 0
      });

      if (res.success && res.category) {
        const newCat: TenantCategoryOption = {
          id: res.category.id,
          slug: res.category.slug || res.category.id,
          labelAr: res.category.name_ar,
          labelEn: res.category.name_en,
          descriptionAr: res.category.description_ar,
          descriptionEn: res.category.description_en,
          icon: res.category.icon,
          sortOrder: res.category.sortOrder || 0,
          isActive: res.category.isActive !== false
        };

        setServiceCategories(prev => [...prev, newCat].sort((a, b) => a.sortOrder - b.sortOrder));
        setSelectedCategory(newCat.id);
        setIsCreateCategoryModalOpen(false);
        setCatNameAr('');
        setCatNameEn('');
        setCatDescAr('');
        setCatDescEn('');
        setCatSortOrder(0);
        triggerToast('Category created successfully!', 'تم إنشاء فئة الخدمات بنجاح!', 'success');
      } else {
        throw new Error(res.message || 'Failed to create category');
      }
    } catch (err: any) {
      console.error('Category creation error:', err);
      setCatFormError(err?.message || (isRtl ? 'حدث خطأ أثناء إنشاء الفئة' : 'Error creating category'));
    } finally {
      setIsSubmittingCat(false);
    }
  };

  const handleOpenEditCategory = (cat: TenantCategoryOption) => {
    setEditingCategory(cat);
    setCatNameAr(cat.labelAr);
    setCatNameEn(cat.labelEn);
    setCatDescAr(cat.descriptionAr || '');
    setCatDescEn(cat.descriptionEn || '');
    setCatSortOrder(cat.sortOrder);
    setCatFormError(null);
    setIsEditCategoryModalOpen(true);
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setCatFormError(null);

    if (!catNameAr.trim() || !catNameEn.trim()) {
      setCatFormError(isRtl ? 'يرجى إدخال اسم الفئة بالعربية والإنجليزية.' : 'Please provide the category name in both Arabic and English.');
      return;
    }

    setIsSubmittingCat(true);
    try {
      const res = await tenantApiAdapter.updateTenantServiceCategory(editingCategory.id, {
        name_ar: catNameAr.trim(),
        name_en: catNameEn.trim(),
        description_ar: catDescAr.trim() || undefined,
        description_en: catDescEn.trim() || undefined,
        sortOrder: Number(catSortOrder) || 0
      });

      if (res.success && res.category) {
        setServiceCategories(prev => prev.map(c => c.id === editingCategory.id ? {
          ...c,
          labelAr: res.category.name_ar,
          labelEn: res.category.name_en,
          descriptionAr: res.category.description_ar,
          descriptionEn: res.category.description_en,
          sortOrder: res.category.sortOrder || 0
        } : c).sort((a, b) => a.sortOrder - b.sortOrder));

        setIsEditCategoryModalOpen(false);
        setEditingCategory(null);
        triggerToast('Category updated successfully!', 'تم تحديث فئة الخدمات بنجاح!', 'success');
      }
    } catch (err: any) {
      setCatFormError(err?.message || (isRtl ? 'حدث خطأ أثناء تحديث الفئة' : 'Error updating category'));
    } finally {
      setIsSubmittingCat(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const stats = getCategoryStats(catId);
    if (stats.total > 0) {
      triggerToast(
        `Cannot delete category containing ${stats.total} item(s). Reassign or remove services/bundles first.`,
        `لا يمكن حذف فئة تحتوي على ${stats.total} خدمة أو باقة. يرجى نقل أو إزالة العناصر أولاً.`,
        'error'
      );
      return;
    }

    const cat = serviceCategories.find(c => c.id === catId);
    const name = cat ? (isRtl ? cat.labelAr : cat.labelEn) : 'this category';

    if (!window.confirm(isRtl ? `هل أنت متأكد من حذف الفئة "${name}"؟` : `Are you sure you want to remove category "${name}"?`)) {
      return;
    }

    try {
      await tenantApiAdapter.deleteTenantServiceCategory(catId);
      setServiceCategories(prev => prev.filter(c => c.id !== catId));
      if (selectedCategory === catId) {
        setSelectedCategory('all');
      }
      setIsEditCategoryModalOpen(false);
      setEditingCategory(null);
      triggerToast('Category deleted successfully', 'تم حذف الفئة بنجاح', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to delete category', 'فشل حذف الفئة', 'error');
    }
  };

  // Refresh Services catalog action
  const handleRefreshCatalog = async () => {
    setIsRefreshing(true);
    triggerToast('Synchronizing Services catalog...', 'جاري مزامنة كتالوج الخدمات والباقات...', 'info');
    await fetchData();
    setIsRefreshing(false);
    triggerToast('Catalog successfully synchronized!', 'تمت مزامنة كتالوج الخدمات والباقات بنجاح.', 'success');
  };

  // Save/Deploy Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Auto assign category texts and tenantServiceCategoryId based on selection
    const matchedCat = serviceCategories.find(c => c.id === formData.category || c.slug === formData.category || c.labelEn === formData.category || c.labelAr === formData.category) || serviceCategories[0];
    const finalFormData: any = buildServicePayload({
      ...formData,
      category: matchedCat ? matchedCat.slug : (formData.category || 'general'),
      categoryEn: matchedCat ? matchedCat.labelEn : (formData.categoryEn || 'General'),
      categoryAr: matchedCat ? matchedCat.labelAr : (formData.categoryAr || 'عام')
    });
    if (matchedCat?.id) {
      finalFormData.tenantServiceCategoryId = matchedCat.id;
    }
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

  // FILTER & SORT UNIFIED CATALOG ITEMS (Services + Bundles)
  const filteredItems = unifiedItems.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (item.nameAr && item.nameAr.toLowerCase().includes(query)) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(query)) ||
      (item.descriptionAr && item.descriptionAr.toLowerCase().includes(query)) ||
      (item.descriptionEn && item.descriptionEn.toLowerCase().includes(query));

    const matchesCategory = matchesCategoryValue(item, selectedCategory);

    const matchesType = itemTypeFilter === 'all' || item.type === itemTypeFilter;

    const matchesGender = selectedGender === 'all' || item.targetGender === selectedGender;

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && item.isActive) ||
      (statusFilter === 'inactive' && !item.isActive);

    const matchesOffer = !offerFilter || (item.type === 'service' && item.hasOffer);

    const matchesGift = !giftFilter || (item.type === 'service' && item.hasGift);

    return matchesSearch && matchesCategory && matchesType && matchesGender && matchesStatus && matchesOffer && matchesGift;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.finalPrice - b.finalPrice;
    if (sortBy === 'price-desc') return b.finalPrice - a.finalPrice;
    if (sortBy === 'duration-asc') return a.duration - b.duration;
    if (sortBy === 'duration-desc') return b.duration - a.duration;
    return 0;
  });

  const filteredServicesCount = filteredItems.filter(i => i.type === 'service').length;
  const filteredBundlesCount = filteredItems.filter(i => i.type === 'bundle').length;

  const isLimitReached = serviceLimit !== null && serviceLimit !== -1 && serviceUsage >= serviceLimit;

  // Group filtered items by real category for "All Categories" view
  const groupedCategorySections = React.useMemo(() => {
    if (selectedCategory !== 'all') {
      return [];
    }

    const sections: Array<{
      id: string;
      labelAr: string;
      labelEn: string;
      category: TenantCategoryOption | null;
      items: UnifiedCatalogItem[];
      servicesCount: number;
      bundlesCount: number;
    }> = [];

    // 1. Tenant-owned categories in deterministic order
    serviceCategories.forEach(cat => {
      const catItems = filteredItems.filter(item => {
        const resolved = resolveItemCategory(item);
        return resolved?.id === cat.id;
      });

      if (catItems.length > 0) {
        sections.push({
          id: cat.id,
          labelAr: cat.labelAr,
          labelEn: cat.labelEn,
          category: cat,
          items: catItems,
          servicesCount: catItems.filter(i => i.type === 'service').length,
          bundlesCount: catItems.filter(i => i.type === 'bundle').length,
        });
      }
    });

    // 2. Uncategorized items (placed last)
    const uncatItems = filteredItems.filter(item => !resolveItemCategory(item));
    if (uncatItems.length > 0) {
      sections.push({
        id: 'uncategorized',
        labelAr: 'غير مصنفة',
        labelEn: 'Uncategorized',
        category: null,
        items: uncatItems,
        servicesCount: uncatItems.filter(i => i.type === 'service').length,
        bundlesCount: uncatItems.filter(i => i.type === 'bundle').length,
      });
    }

    return sections;
  }, [selectedCategory, serviceCategories, filteredItems]);

  // Reusable card renderer for unified services and bundles
  const renderCatalogItem = (item: UnifiedCatalogItem) => {
    if (item.type === 'service') {
      return (
        <div 
          key={`srv-${item.id}`} 
          className="bg-white rounded-2xl border border-neutral-200/60 p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between shadow-2xs hover:shadow-md transition-all relative group"
        >
          {/* Identity zone */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 min-w-0">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border shrink-0 relative">
              <img 
                src={resolveServiceImageUrl(item.image || defaultImage)}
                alt={item.nameEn} 
                className="w-full h-full object-cover" 
              />
              {item.hasOffer && (
                <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                  {item.offerDiscountPct}% OFF
                </span>
              )}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* TYPE BADGE: [SERVICE] */}
                <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-md font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>SERVICE</span>
                </span>

                {/* Category badge */}
                <span className="text-[9px] bg-slate-100 text-neutral-600 px-2 py-0.5 rounded-md font-bold uppercase">
                  {isRtl 
                    ? (resolveItemCategory(item)?.labelAr || item.categoryAr || item.category || 'عام')
                    : (resolveItemCategory(item)?.labelEn || item.categoryEn || item.category || 'General')}
                </span>

                {/* Active/Inactive state */}
                <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${
                  item.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
                }`}>
                  {item.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                </span>

                {/* Gender availability */}
                <span className="text-[9px] bg-slate-100 text-neutral-600 px-2 py-0.5 rounded-md font-bold">
                  {item.targetGender === 'female' ? (isRtl ? 'للنساء' : 'Females') : item.targetGender === 'male' ? (isRtl ? 'للرجال' : 'Males') : (isRtl ? 'للجنسين' : 'Unisex')}
                </span>
              </div>

              <h3 className="text-sm font-black text-neutral-800 tracking-tight leading-tight line-clamp-1">
                {isRtl ? item.nameAr : item.nameEn}
              </h3>

              <p className="text-xs text-neutral-400 line-clamp-1">
                {isRtl ? (item.descriptionAr || 'لا يوجد وصف عربي متاح.') : (item.descriptionEn || 'No English description added.')}
              </p>
              
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-500 font-bold">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-indigo-500" />
                  <span>{item.duration} {isRtl ? 'دقيقة' : 'mins'}</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-neutral-300" />
                <span className="flex items-center gap-1">
                  <Users size={12} className="text-indigo-500" />
                  <span>{(item.employeeAssignments || []).length} {isRtl ? 'أخصائيات معتمدات' : 'specialists'}</span>
                </span>
                {Array.isArray(item.rawRecord?.resourceRequirements) && item.rawRecord.resourceRequirements.length > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-neutral-300" />
                    <span className="flex items-center gap-1 text-indigo-600" title={isRtl ? 'الموارد المطلوبة' : 'Required Resources'}>
                      <Boxes size={12} />
                      <span>
                        {item.rawRecord.resourceRequirements
                          .map((r: any) => `${isRtl ? r.resourceType?.name_ar || r.resourceType?.name_en || 'مورد' : r.resourceType?.name_en || r.resourceType?.name_ar || 'Resource'} × ${r.quantity}`)
                          .join(', ')}
                      </span>
                    </span>
                  </>
                )}
              </div>

              {/* Offer / Gift labels */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {item.hasOffer && (
                  <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                    <Tag size={10} />
                    <span>{isRtl ? item.offerDetailsAr : item.offerDetailsEn}</span>
                  </span>
                )}
                {item.hasGift && (
                  <span className="text-[9px] bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                    <Gift size={10} />
                    <span>{isRtl ? item.giftDetailsAr : item.giftDetailsEn}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Price and actions zone */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 w-full lg:w-48 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <div className="text-left lg:text-right">
              <span className="text-[9px] text-neutral-400 font-black uppercase block">{isRtl ? 'السعر النهائي' : 'Final Price'}</span>
              <div className="flex items-center gap-1.5 lg:justify-end">
                {item.hasOffer && (
                  <span className="text-xs text-neutral-400 line-through font-mono">
                    {item.price}
                  </span>
                )}
                <span className="text-base font-black text-indigo-600 font-mono">
                  {item.finalPrice} <span className="text-[10px]">{isRtl ? 'ر.س' : 'SAR'}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleToggleActiveStatus(item.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                  item.isActive 
                    ? 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100' 
                    : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {item.isActive ? (isRtl ? 'تعطيل' : 'Deactivate') : (isRtl ? 'تفعيل' : 'Activate')}
              </button>
              
              <button
                onClick={() => handleOpenEditForm(item.rawRecord)}
                className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all cursor-pointer"
                title={isRtl ? 'تعديل الخدمة' : 'Configure Service'}
              >
                <Edit size={13} />
              </button>
              
              <button
                onClick={() => handleDeleteService(item.id)}
                className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all cursor-pointer"
                title={isRtl ? 'حذف الخدمة' : 'Remove Service'}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. BUNDLE CARD PRESENTATION
    return (
      <div 
        key={`bundle-${item.id}`} 
        className="bg-white rounded-2xl border border-purple-200/80 p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between shadow-2xs hover:shadow-md transition-all relative group bg-gradient-to-r from-purple-50/20 via-transparent to-transparent"
      >
        {/* Identity zone */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 min-w-0">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-purple-100/70 border border-purple-200 shrink-0 relative flex items-center justify-center text-purple-600">
            {item.image ? (
              <img 
                src={resolveServiceImageUrl(item.image)}
                alt={item.nameEn} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.parentElement?.querySelector('.bundle-fallback-placeholder');
                  if (fb) fb.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`bundle-fallback-placeholder flex flex-col items-center justify-center p-2 text-center ${item.image ? 'hidden' : ''}`}>
              <Package size={28} className="text-purple-600 mb-1" />
              <span className="text-[9px] font-black text-purple-700 uppercase tracking-tighter">BUNDLE</span>
            </div>
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* TYPE BADGE: [BUNDLE] */}
              <span className="text-[9px] bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-md font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                <Package size={10} />
                <span>BUNDLE</span>
              </span>

              {/* Category badge */}
              <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-md font-bold uppercase">
                {isRtl 
                  ? (resolveItemCategory(item)?.labelAr || 'باقات العناية') 
                  : (resolveItemCategory(item)?.labelEn || 'Care Bundles')}
              </span>

              {/* Active/Inactive state */}
              <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${
                item.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
              }`}>
                {item.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
              </span>

              {/* Online booking status */}
              <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                item.allowOnlineBooking 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'bg-neutral-100 text-neutral-600'
              }`}>
                <Globe size={10} />
                <span>{item.allowOnlineBooking ? (isRtl ? 'أونلاين' : 'Online Booking') : (isRtl ? 'داخلي فقط' : 'In-store only')}</span>
              </span>

              {/* Gender availability */}
              <span className="text-[9px] bg-slate-100 text-neutral-600 px-2 py-0.5 rounded-md font-bold">
                {item.targetGender === 'female' ? (isRtl ? 'للنساء' : 'Females') : item.targetGender === 'male' ? (isRtl ? 'للرجال' : 'Males') : (isRtl ? 'للجنسين' : 'Unisex')}
              </span>
            </div>

            <h3 className="text-sm font-black text-purple-950 tracking-tight leading-tight line-clamp-1">
              {isRtl ? item.nameAr : item.nameEn}
            </h3>

            <p className="text-xs text-neutral-400 line-clamp-1">
              {isRtl ? (item.descriptionAr || 'باقة مجمعة من الخدمات المميزة.') : (item.descriptionEn || 'Combined bundle of premium services.')}
            </p>
            
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-600 font-bold">
              <span className="flex items-center gap-1 text-purple-700 font-black">
                <Layers size={12} className="text-purple-600" />
                <span>{item.itemsCount} {isRtl ? 'خدمات مدمجة' : 'included services'}</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-300" />
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-purple-600" />
                <span>{item.duration} {isRtl ? 'دقيقة إجمالية' : 'total mins'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Price and actions zone */}
        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 w-full lg:w-48 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-purple-100">
          <div className="text-left lg:text-right">
            <span className="text-[9px] text-purple-600 font-black uppercase block">{isRtl ? 'سعر الباقة الإجمالي' : 'Bundle Price'}</span>
            <div className="flex items-center gap-1.5 lg:justify-end">
              {item.totalPrice > item.price && (
                <span className="text-xs text-neutral-400 line-through font-mono">
                  {item.totalPrice}
                </span>
              )}
              <span className="text-base font-black text-purple-700 font-mono">
                {item.price} <span className="text-[10px]">{isRtl ? 'ر.س' : 'SAR'}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleToggleBundleStatus(item.id, item.isActive)}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                item.isActive 
                  ? 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100' 
                  : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {item.isActive ? (isRtl ? 'تعطيل' : 'Deactivate') : (isRtl ? 'تفعيل' : 'Activate')}
            </button>
            
            <button
              onClick={() => handleOpenEditBundle(item)}
              className="p-1.5 bg-purple-50 border border-purple-200 hover:bg-purple-100 hover:text-purple-800 rounded-xl text-purple-700 transition-all cursor-pointer"
              title={isRtl ? 'تعديل الباقة' : 'Edit Bundle'}
            >
              <Edit size={13} />
            </button>
            
            <button
              onClick={() => {
                setSelectedBundleForInfo(item);
                setIsBundleInfoModalOpen(true);
              }}
              className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 rounded-xl text-slate-600 transition-all cursor-pointer"
              title={isRtl ? 'تفاصيل الباقة' : 'Bundle details'}
            >
              <Package size={13} />
            </button>
            
            <button
              onClick={() => handleDeleteBundle(item.id)}
              className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all cursor-pointer"
              title={isRtl ? 'حذف الباقة' : 'Remove Bundle'}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

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
                  {/* Item Type Filter (Service / Bundle / All) */}
                  <select
                    value={itemTypeFilter}
                    onChange={e => setItemTypeFilter(e.target.value as any)}
                    className="bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200/80 rounded-xl px-2.5 py-2 text-xs font-black text-indigo-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{isRtl ? 'كل الأصناف (خدمات + باقات)' : 'All Items (Services & Bundles)'}</option>
                    <option value="service">{isRtl ? 'خدمات فقط (Services)' : 'Services Only'}</option>
                    <option value="bundle">{isRtl ? 'باقات فقط (Bundles)' : 'Bundles Only'}</option>
                  </select>

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

              {/* Add Menu Dropdown (Service / Bundle / Category) */}
              <div className="shrink-0 relative">
                <button
                  onClick={() => setIsAddMenuOpen(prev => !prev)}
                  disabled={isLimitReached}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shrink-0 ${
                    isLimitReached 
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 shadow-none cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/15'
                  }`}
                >
                  <Plus size={14} />
                  <span>{isRtl ? 'إضافة' : 'Add'}</span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isAddMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
                    <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-56 bg-white rounded-2xl border border-neutral-200 shadow-2xl py-2 z-50 space-y-0.5 animate-fade-in">
                      <button
                        onClick={() => { setIsAddMenuOpen(false); handleOpenAddService(); }}
                        className="w-full px-3.5 py-2.5 text-left rtl:text-right text-xs font-bold text-neutral-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Sparkles size={14} />
                        </div>
                        <div>
                          <span className="block font-black text-neutral-800">{isRtl ? 'خدمة فردية' : 'Service'}</span>
                          <span className="text-[10px] text-neutral-400 block font-normal">{isRtl ? 'إضافة خدمة مستقلة' : 'Add standalone service'}</span>
                        </div>
                      </button>

                      <button
                        onClick={() => { setIsAddMenuOpen(false); handleOpenAddBundle(); }}
                        className="w-full px-3.5 py-2.5 text-left rtl:text-right text-xs font-bold text-neutral-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <Package size={14} />
                        </div>
                        <div>
                          <span className="block font-black text-neutral-800">{isRtl ? 'باقة مجمعة (Bundle)' : 'Bundle'}</span>
                          <span className="text-[10px] text-neutral-400 block font-normal">{isRtl ? 'باقة تجمع عدة خدمات' : 'Package multiple services'}</span>
                        </div>
                      </button>

                      <div className="h-px bg-slate-100 my-1 mx-2" />

                      <button
                        onClick={() => { setIsAddMenuOpen(false); setIsCreateCategoryModalOpen(true); }}
                        className="w-full px-3.5 py-2.5 text-left rtl:text-right text-xs font-bold text-neutral-700 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <FolderPlus size={14} />
                        </div>
                        <div>
                          <span className="block font-black text-neutral-800">{isRtl ? 'فئة خدمات جديدة' : 'Category'}</span>
                          <span className="text-[10px] text-neutral-400 block font-normal">{isRtl ? 'إنشاء فئة مخصصة للصالون' : 'Create tenant category'}</span>
                        </div>
                      </button>
                    </div>
                  </>
                )}
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
            {unifiedItems.length === 0 && !isLoading ? (
              <div className="bg-white rounded-3xl p-12 border border-neutral-150 text-center space-y-3">
                <div className="w-16 h-16 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
                  <SlidersHorizontal size={24} />
                </div>
                <h3 className="text-sm font-black text-neutral-700">{isRtl ? 'لم يتم إضافة أي خدمات أو باقات بالكتالوج حتى الآن' : 'No Services or Bundles Found'}</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  {isRtl 
                    ? 'ابدأ بتهيئة أولى خدماتك أو باقاتك بالضغط على الزر العلوي "إضافة" للبدء بالبيع وتلقي الحجوزات.' 
                    : 'Get started by creating your very first service or bundle to activate the reservation catalog.'}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleOpenAddService}
                    className="px-4 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>{isRtl ? 'إضافة خدمة جديدة' : 'Add Service'}</span>
                  </button>
                  <button
                    onClick={() => setIsCreateCategoryModalOpen(true)}
                    className="px-4 py-2 bg-slate-100 text-neutral-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <FolderPlus size={13} />
                    <span>{isRtl ? 'إضافة فئة جديدة' : 'Add Category'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 2.6 Left Column: Category Navigation compact panel */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-white rounded-2xl border border-neutral-200/60 p-4 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-neutral-800 uppercase tracking-tight">
                          {isRtl ? 'فئات الخدمات (الصالون)' : 'Tenant Categories'}
                        </span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black">
                        {unifiedItems.length}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      {/* 1. All Categories Option */}
                      {(() => {
                        const allStats = getCategoryStats('all');
                        const active = selectedCategory === 'all';
                        return (
                          <button
                            key="cat-all"
                            onClick={() => setSelectedCategory('all')}
                            className={`flex flex-col px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left rtl:text-right ${
                              active 
                                ? 'bg-[#1D035F] text-white shadow-sm' 
                                : 'text-neutral-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-black truncate">
                                {isRtl ? 'جميع الفئات' : 'All Categories'}
                              </span>
                              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                                active ? 'bg-[#6537C0] text-white' : 'bg-slate-100 text-neutral-500'
                              }`}>
                                {allStats.total}
                              </span>
                            </div>
                            <div className={`text-[9px] font-medium mt-1 flex items-center gap-2 ${active ? 'text-purple-200' : 'text-neutral-400'}`}>
                              <span>{allStats.serviceCount} {isRtl ? 'خدمات' : 'Services'}</span>
                              <span>•</span>
                              <span>{allStats.bundleCount} {isRtl ? 'باقات' : 'Bundles'}</span>
                            </div>
                          </button>
                        );
                      })()}

                      {/* 2. Tenant-Owned Categories Only */}
                      {serviceCategories.map(cat => {
                        const active = selectedCategory === cat.id;
                        const stats = getCategoryStats(cat.id);
                        const tenantCatObj = cat;

                        return (
                          <div
                            key={cat.id}
                            className={`group relative rounded-xl transition-all ${
                              active 
                                ? 'bg-[#1D035F] text-white shadow-sm' 
                                : 'text-neutral-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                            }`}
                          >
                            <button
                              onClick={() => setSelectedCategory(cat.id)}
                              className="w-full flex flex-col px-3 py-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-xs font-bold truncate pr-6 rtl:pr-0 rtl:pl-6">
                                  {isRtl ? cat.labelAr : cat.labelEn}
                                </span>
                                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full shrink-0 ${
                                  active ? 'bg-[#6537C0] text-white' : 'bg-slate-100 text-neutral-500'
                                }`}>
                                  {stats.total}
                                </span>
                              </div>
                              <div className={`text-[9px] font-medium mt-1 flex items-center gap-2 ${active ? 'text-purple-200' : 'text-neutral-400'}`}>
                                <span>{stats.serviceCount} {isRtl ? 'خدمات' : 'Services'}</span>
                                <span>•</span>
                                <span>{stats.bundleCount} {isRtl ? 'باقات' : 'Bundles'}</span>
                              </div>
                            </button>

                            {/* Quick Category Action Menu */}
                            {tenantCatObj && (
                              <div className="absolute right-2 top-2 rtl:right-auto rtl:left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditCategory(tenantCatObj);
                                  }}
                                  className={`p-1 rounded-lg text-xs transition ${
                                    active 
                                      ? 'hover:bg-[#2E0B7A] text-white' 
                                      : 'hover:bg-slate-200 text-neutral-500'
                                  }`}
                                  title={isRtl ? 'تعديل الفئة' : 'Edit category'}
                                >
                                  <Edit size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 3. Uncategorized Items (if any exist) */}
                      {(() => {
                        const uncatStats = getCategoryStats('uncategorized');
                        if (uncatStats.total === 0) return null;
                        const active = selectedCategory === 'uncategorized';
                        return (
                          <button
                            key="cat-uncategorized"
                            onClick={() => setSelectedCategory('uncategorized')}
                            className={`flex flex-col px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left rtl:text-right border border-dashed ${
                              active 
                                ? 'bg-[#1D035F] text-white border-[#1D035F] shadow-sm' 
                                : 'text-neutral-500 hover:bg-amber-50/50 border-neutral-300'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-bold truncate">
                                {isRtl ? 'غير مصنفة' : 'Uncategorized'}
                              </span>
                              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                                active ? 'bg-[#6537C0] text-white' : 'bg-neutral-100 text-neutral-500'
                              }`}>
                                {uncatStats.total}
                              </span>
                            </div>
                            <div className={`text-[9px] font-medium mt-1 flex items-center gap-2 ${active ? 'text-purple-200' : 'text-neutral-400'}`}>
                              <span>{uncatStats.serviceCount} {isRtl ? 'خدمات' : 'Services'}</span>
                              <span>•</span>
                              <span>{uncatStats.bundleCount} {isRtl ? 'باقات' : 'Bundles'}</span>
                            </div>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Button to quickly add category from left column */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setIsCreateCategoryModalOpen(true)}
                        className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FolderPlus size={13} />
                        <span>{isRtl ? 'إضافة فئة جديدة' : 'Add Category'}</span>
                      </button>
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

                {/* 2.7 Right Column: Filtered catalog results main panel */}
                <div className="lg:col-span-9 space-y-4">
                  
                  {/* Results Panel Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/60 shadow-2xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <h2 className="text-xs font-black text-neutral-800 uppercase tracking-wide">
                        {selectedCategory === 'all' 
                          ? (isRtl ? 'جميع الأصناف (مقسمة حسب الفئات)' : 'All Catalog Items (Grouped by Category)')
                          : selectedCategory === 'uncategorized'
                          ? (isRtl ? 'غير مصنفة' : 'Uncategorized Items')
                          : (isRtl 
                              ? `فئة: ${serviceCategories.find(c => c.id === selectedCategory)?.labelAr || selectedCategory}` 
                              : `Category: ${serviceCategories.find(c => c.id === selectedCategory)?.labelEn || selectedCategory}`)}
                      </h2>
                      <span className="text-[10px] text-neutral-400 font-bold">
                        ({filteredServicesCount} {isRtl ? 'خدمات' : 'services'}, {filteredBundlesCount} {isRtl ? 'باقات' : 'bundles'})
                      </span>

                      {/* Item Type Indicator if filtered */}
                      {itemTypeFilter !== 'all' && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          itemTypeFilter === 'service' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {itemTypeFilter === 'service' ? (isRtl ? 'خدمات فقط' : 'Services Only') : (isRtl ? 'باقات فقط' : 'Bundles Only')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Category Action Buttons when specific tenant category is selected */}
                      {selectedCategory !== 'all' && selectedCategory !== 'uncategorized' && (() => {
                        const targetCat = serviceCategories.find(c => c.id === selectedCategory);
                        if (!targetCat) return null;
                        return (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditCategory(targetCat)}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-neutral-700 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                              title={isRtl ? 'تعديل بيانات هذه الفئة' : 'Edit this category'}
                            >
                              <Edit size={12} />
                              <span>{isRtl ? 'تعديل الفئة' : 'Edit Category'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(targetCat)}
                              className="p-1.5 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-neutral-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                              title={isRtl ? 'حذف هذه الفئة' : 'Delete this category'}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })()}

                      <button
                        onClick={handleRefreshCatalog}
                        disabled={isRefreshing}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-neutral-500 hover:text-indigo-600 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                        title={isRtl ? 'تحديث الكتالوج' : 'Refresh Catalog'}
                      >
                        <RotateCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>{isRtl ? 'مزامنة' : 'Sync'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 2.8 Unified Catalog results list stack */}
                  {filteredItems.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 border border-neutral-200/60 text-center space-y-3 shadow-2xs">
                      <div className="w-12 h-12 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
                        <Filter size={18} />
                      </div>
                      <h3 className="text-xs font-black text-neutral-700">{isRtl ? 'عذراً، لم نعثر على نتائج مطابقة' : 'No Matching Items'}</h3>
                      <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                        {isRtl 
                          ? 'يرجى تغيير الكلمات البحثية أو تصفية فئة الخدمات في اليسار للوصول إلى الخدمات أو الباقات المعتمدة.' 
                          : 'Try adjusting your filters, searching for alternate keywords, or choosing another category.'}
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('all');
                          setSelectedGender('all');
                          setStatusFilter('all');
                          setItemTypeFilter('all');
                          setOfferFilter(false);
                          setGiftFilter(false);
                        }}
                        className="px-3 py-1.5 bg-slate-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-all cursor-pointer border border-neutral-200"
                      >
                        {isRtl ? 'إعادة ضبط كل المرشحات' : 'Clear All Filters'}
                      </button>
                    </div>
                  ) : selectedCategory === 'all' ? (
                    <div className="space-y-8">
                      {groupedCategorySections.map(section => (
                        <div key={`section-${section.id}`} data-category-section={section.id} className="space-y-3">
                          {/* Section Header */}
                          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                              <h3 className="text-xs font-black text-neutral-800 uppercase tracking-wide">
                                {isRtl ? section.labelAr : section.labelEn}
                              </h3>
                              <span className="text-[10px] font-bold text-neutral-400">
                                ({section.servicesCount} {isRtl ? 'خدمات' : 'services'} • {section.bundlesCount} {isRtl ? 'باقات' : 'bundles'})
                              </span>
                            </div>

                            {section.category && (
                              <button
                                type="button"
                                onClick={() => setSelectedCategory(section.id)}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-1"
                                title={isRtl ? `تصفية حسب ${section.labelAr}` : `Filter by ${section.labelEn}`}
                              >
                                <span>{isRtl ? 'تصفية الفئة فقط' : 'View only'}</span>
                                {isRtl ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                              </button>
                            )}
                          </div>

                          {/* Render cards under this section */}
                          <div className="flex flex-col gap-4">
                            {section.items.map(item => renderCatalogItem(item))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {filteredItems.map(item => renderCatalogItem(item))}
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
                    : 'BarSpa AI Assistant is online. Select your active section and tap any AI help trigger for instant content enhancement.'}
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

                        {/* 4) Resource & Room Requirements (Phase 1C) */}
                        <ServiceResourceRequirementsSection
                          lang={lang}
                          requirements={formData.resourceRequirements || []}
                          onChange={(reqs) => setFormData(p => ({ ...p, resourceRequirements: reqs }))}
                          darkMode={false}
                        />

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

      {/* CREATE CATEGORY MODAL */}
      <AnimatePresence>
        {isCreateCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <FolderPlus size={16} />
                  </div>
                  <h3 className="text-sm font-black text-neutral-800">
                    {isRtl ? 'إنشاء فئة خدمات جديدة' : 'Create New Category'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateCategoryModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-neutral-400 hover:text-neutral-700 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {catFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                  {catFormError}
                </div>
              )}

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'اسم الفئة بالعربية *' : 'Category Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={catNameAr}
                    onChange={e => setCatNameAr(e.target.value)}
                    placeholder={isRtl ? 'مثال: باقات العرائس الملكية' : 'e.g. Bridal Packages'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'اسم الفئة بالإنجليزية *' : 'Category Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={catNameEn}
                    onChange={e => setCatNameEn(e.target.value)}
                    placeholder="e.g. Royal Bridal Packages"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'وصف الفئة بالعربية (اختياري)' : 'Arabic Description (Optional)'}
                  </label>
                  <textarea
                    value={catDescAr}
                    onChange={e => setCatDescAr(e.target.value)}
                    rows={2}
                    placeholder={isRtl ? 'اكتب نبذة مختصرة عن الخدمات والباقات التابعة لهذه الفئة...' : ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'وصف الفئة بالإنجليزية (اختياري)' : 'English Description (Optional)'}
                  </label>
                  <textarea
                    value={catDescEn}
                    onChange={e => setCatDescEn(e.target.value)}
                    rows={2}
                    placeholder="Short summary of items in this category..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'ترتيب العرض' : 'Sort Order'}
                  </label>
                  <input
                    type="number"
                    value={catSortOrder}
                    onChange={e => setCatSortOrder(parseInt(e.target.value) || 0)}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateCategoryModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-neutral-700 rounded-xl text-xs font-bold transition"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCat}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingCat ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء الفئة' : 'Create Category')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT CATEGORY MODAL */}
      <AnimatePresence>
        {isEditCategoryModalOpen && editingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Edit size={16} />
                  </div>
                  <h3 className="text-sm font-black text-neutral-800">
                    {isRtl ? 'تعديل فئة الخدمات' : 'Edit Category'}
                  </h3>
                </div>
                <button
                  onClick={() => { setIsEditCategoryModalOpen(false); setEditingCategory(null); }}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-neutral-400 hover:text-neutral-700 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {catFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                  {catFormError}
                </div>
              )}

              <form onSubmit={handleUpdateCategory} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'اسم الفئة بالعربية *' : 'Category Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={catNameAr}
                    onChange={e => setCatNameAr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'اسم الفئة بالإنجليزية *' : 'Category Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={catNameEn}
                    onChange={e => setCatNameEn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'الوصف بالعربية' : 'Arabic Description'}
                  </label>
                  <textarea
                    value={catDescAr}
                    onChange={e => setCatDescAr(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'الوصف بالإنجليزية' : 'English Description'}
                  </label>
                  <textarea
                    value={catDescEn}
                    onChange={e => setCatDescEn(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    {isRtl ? 'ترتيب العرض' : 'Sort Order'}
                  </label>
                  <input
                    type="number"
                    value={catSortOrder}
                    onChange={e => setCatSortOrder(parseInt(e.target.value) || 0)}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  {getCategoryStats(editingCategory.id).total === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(editingCategory.id)}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>{isRtl ? 'حذف الفئة' : 'Delete Category'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {isRtl ? 'تحتوي على خدمات/باقات (محمية من الحذف)' : 'Contains items (deletion protected)'}
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsEditCategoryModalOpen(false); setEditingCategory(null); }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-neutral-700 rounded-xl text-xs font-bold transition"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingCat}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm disabled:opacity-50"
                    >
                      {isSubmittingCat ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ التغييرات' : 'Save Changes')}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BUNDLE BUILDER PREVIEW / INFO MODAL (PHASE 4B ENTRY STUB) */}
      <AnimatePresence>
        {isBundleInfoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-purple-200 space-y-5"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shadow-xs">
                    <Package size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-neutral-900">
                      {selectedBundleForInfo 
                        ? (isRtl ? `تفاصيل الباقة: ${selectedBundleForInfo.nameAr}` : `Bundle: ${selectedBundleForInfo.nameEn}`)
                        : (isRtl ? 'منشئ الباقات — الخدمات' : 'Bundle Builder — Services')}
                    </h3>
                    <span className="text-[10px] text-purple-600 font-bold block">
                      {isRtl ? 'باقة مجمعة من عدة خدمات تحت فئة موحدة' : 'Multi-service bundled offering under unified category'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setIsBundleInfoModalOpen(false); setSelectedBundleForInfo(null); }}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {selectedBundleForInfo ? (
                <div className="space-y-3 text-xs">
                  <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500 font-bold">{isRtl ? 'السعر الإجمالي:' : 'Total Price:'}</span>
                      <span className="font-mono font-black text-purple-700 text-sm">{selectedBundleForInfo.finalPrice} SAR</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500 font-bold">{isRtl ? 'المدة الإجمالية:' : 'Total Duration:'}</span>
                      <span className="font-bold text-neutral-800">{selectedBundleForInfo.duration} {isRtl ? 'دقيقة' : 'mins'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500 font-bold">{isRtl ? 'حالة الحجز أونلاين:' : 'Online Booking:'}</span>
                      <span className={`font-bold ${selectedBundleForInfo.allowOnlineBooking ? 'text-emerald-600' : 'text-neutral-500'}`}>
                        {selectedBundleForInfo.allowOnlineBooking ? (isRtl ? 'متاح أونلاين' : 'Available Online') : (isRtl ? 'داخلي فقط' : 'In-Store Only')}
                      </span>
                    </div>
                  </div>

                  {Array.isArray(selectedBundleForInfo.items) && selectedBundleForInfo.items.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black uppercase text-neutral-700 tracking-wider block">
                        {isRtl ? 'الخدمات المضمنة في هذه الباقة:' : 'Included Services in Bundle:'}
                      </span>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {selectedBundleForInfo.items.map((it: any, idx: number) => (
                          <div key={idx} className="p-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-bold text-neutral-700">
                              {idx + 1}. {isRtl ? (it.service?.name_ar || it.service?.nameEn || 'خدمة') : (it.service?.name_en || it.service?.nameAr || 'Service')}
                            </span>
                            <span className="text-neutral-400 font-mono text-[10px]">
                              {it.service?.duration || 30} mins
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 text-purple-950 space-y-2">
                    <p className="font-bold leading-relaxed">
                      {isRtl 
                        ? 'في المرحلة 4B، سيتيح هذا المحرر بناء الباقات مباشرة وتحديد تسلسل الخدمات (على التوالي أو بالتوازي)، وتخصيص التسعير (مجموع أو خصم)، وربط الباقة بفئة خدمات مخصصة.'
                        : 'In Phase 4B, this builder will allow creating bundled service packages directly with sequenced/parallel scheduling, bundle pricing rules, and category assignment.'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 bg-white rounded-xl border border-purple-100 font-medium text-[11px]">
                        <span className="font-black text-purple-700 block mb-0.5">1. {isRtl ? 'البيانات الأساسية' : 'Basic Details'}</span>
                        <span className="text-neutral-500">{isRtl ? 'اسم الباقة، الفئة، الوصف، والغلاف' : 'Name, Category, Description, Image'}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-purple-100 font-medium text-[11px]">
                        <span className="font-black text-purple-700 block mb-0.5">2. {isRtl ? 'اختيار الخدمات' : 'Service Selection'}</span>
                        <span className="text-neutral-500">{isRtl ? 'تحديد الخدمات وترتيب تسلسلها' : 'Multi-select services with order'}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-purple-100 font-medium text-[11px]">
                        <span className="font-black text-purple-700 block mb-0.5">3. {isRtl ? 'نوع الجدولة' : 'Schedule Type'}</span>
                        <span className="text-neutral-500">{isRtl ? 'خدمات متتالية أو متوازية' : 'Sequenced vs Parallel appointments'}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-purple-100 font-medium text-[11px]">
                        <span className="font-black text-purple-700 block mb-0.5">4. {isRtl ? 'نموذج التسعير' : 'Pricing Model'}</span>
                        <span className="text-neutral-500">{isRtl ? 'مجموع تلقائي أو خصم مخصص' : 'Sum, custom, or discount price'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => { setIsBundleInfoModalOpen(false); setSelectedBundleForInfo(null); }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BUNDLE BUILDER MODAL (PHASE 4B) */}
      <BundleBuilderModal
        isOpen={isBundleBuilderOpen}
        onClose={() => {
          setIsBundleBuilderOpen(false);
          setBundleToEdit(null);
        }}
        lang={lang}
        serviceCategories={serviceCategories}
        services={services}
        bundleToEdit={bundleToEdit}
        onSaved={() => {
          fetchData();
          triggerToast(
            bundleToEdit ? 'Bundle updated successfully!' : 'Bundle created successfully!',
            bundleToEdit ? 'تم تحديث الباقة بنجاح!' : 'تم إنشاء الباقة بنجاح!',
            'success'
          );
        }}
      />
    </div>
  );
}
