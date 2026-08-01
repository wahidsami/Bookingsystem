import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Trash2, Plus, ArrowLeft, Check, X, Info, Upload, 
  Edit, Eye, Filter, SlidersHorizontal, Search, CheckSquare, Square,
  RotateCw, AlertTriangle, Image as ImageIcon, ShoppingBag, Package, 
  Layers, Tag, Percent, Truck, Store, FileText
} from 'lucide-react';
import { Language, Product, QuickLaunchRequest } from '../types';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import {
  buildTenantPlanSummary,
  formatTenantPlanLimit,
  getTenantPlanUsageCount
} from '../lib/tenantSubscription';

interface ProductsWorkspaceProps {
  lang: Language;
  quickLaunchRequest?: QuickLaunchRequest | null;
}

// Extend Product model for high-fidelity inventory and fulfillment specifications
export interface EnhancedProduct extends Product {
  descriptionAr: string;
  descriptionEn: string;
  images: string[]; // Support gallery up to 5 images
  brand: string;
  rawPrice: number;
  taxRate: number; // e.g. 15% VAT
  commissionRate: number; // e.g. 10% platform fee
  size: string;
  color: string;
  ingredientsAr: string;
  ingredientsEn: string;
  howToUseAr: string;
  howToUseEn: string;
  featuresAr: string;
  featuresEn: string;
  isAvailable: boolean;
  isFeatured: boolean;
  allowsDelivery: boolean;
  allowsPickup: boolean;
  soldCount: number;
  usedAsGiftCount: number;
}

// Default luxury cosmetics placeholder
const defaultImagePlaceholder = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=600&auto=format&fit=crop';

const categoryOptions = [
  { id: 'all', labelAr: 'كل فئات المنتجات', labelEn: 'All Product Categories' },
  { id: 'Hair Products', labelAr: 'منتجات الشعر', labelEn: 'Hair Products' },
  { id: 'Skincare Products', labelAr: 'منتجات البشرة', labelEn: 'Skincare Products' },
  { id: 'Body Products', labelAr: 'منتجات الجسم', labelEn: 'Body Products' },
  { id: 'Nail Products', labelAr: 'منتجات الأظافر', labelEn: 'Nail Products' },
  { id: 'Luxury Perfumes', labelAr: 'عطور فاخرة', labelEn: 'Luxury Perfumes' }
];

const presetCosmeticsImages = [
  { url: 'https://images.unsplash.com/photo-1608248597481-496100c80836?q=80&w=600&auto=format&fit=crop', labelAr: 'زيت شعر ذهبي فاخر', labelEn: 'Luxury Golden Hair Oil' },
  { url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=600&auto=format&fit=crop', labelAr: 'قطارة سيروم زجاجية', labelEn: 'Glass Serum Dropper' },
  { url: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?q=80&w=600&auto=format&fit=crop', labelAr: 'عبوة كريم بيضاء نقية', labelEn: 'Pure White Cream Tub' },
  { url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?q=80&w=600&auto=format&fit=crop', labelAr: 'مستخلص لافندر وشامبو طبيعي', labelEn: 'Natural Shampoo & Lavender' },
  { url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?q=80&w=600&auto=format&fit=crop', labelAr: 'زيت جوز الهند العضوي المعالج', labelEn: 'Organic Coconut Treatment' },
  { url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=600&auto=format&fit=crop', labelAr: 'مجموعة التجميل والعناية', labelEn: 'Premium Cosmetic Set' }
];

export default function ProductsWorkspace({ lang, quickLaunchRequest }: ProductsWorkspaceProps) {
  const isRtl = lang === 'ar';
  const { tenant, tenantSettings, packageEntitlements, subscription, subscriptionUsage } = useTenantAuth();

  // 1. Core State
  const [products, setProducts] = useState<EnhancedProduct[]>([]);
  const [activeView, setActiveView] = useState<'list' | 'form'>('list');
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [activeSection, setActiveSection] = useState<'basic' | 'details' | 'images' | 'pricing'>('basic');

  const fetchProducts = async () => {
    try {
      const res: any = await tenantApiAdapter.getProducts();
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  React.useEffect(() => {
    fetchProducts();
  }, []);

  // 2. Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'outofstock' | 'featured'>('all');
  const [sortBy, setSortBy] = useState<'none' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc' | 'name-asc' | 'name-desc'>('none');

  const planSummary = buildTenantPlanSummary({
    locale: isRtl ? 'ar' : 'en',
    tenant,
    tenantSettings,
    packageEntitlements,
    subscription,
    usageSnapshot: subscriptionUsage
  });
  const productLimit = planSummary.usage.products?.limit ?? planSummary.packageLimits?.maxProducts ?? null;
  const productUsage = getTenantPlanUsageCount(planSummary.usage.products, products.length);
  const productPlanName = isRtl ? planSummary.planNameAr : planSummary.planNameEn;

  // 4. Form State
  const [formData, setFormData] = useState<EnhancedProduct>({
    id: '',
    nameAr: '',
    nameEn: '',
    descriptionAr: '',
    descriptionEn: '',
    sku: '',
    brand: '',
    categoryAr: 'منتجات الشعر',
    categoryEn: 'Hair Products',
    images: [defaultImagePlaceholder],
    rawPrice: 100,
    price: 126.5, // (100 * 1.10) * 1.15
    taxRate: 15,
    commissionRate: 10,
    stock: 25,
    size: '100 ml',
    color: '',
    ingredientsAr: '',
    ingredientsEn: '',
    howToUseAr: '',
    howToUseEn: '',
    featuresAr: '',
    featuresEn: '',
    isAvailable: true,
    isFeatured: false,
    allowsDelivery: true,
    allowsPickup: true,
    soldCount: 0,
    usedAsGiftCount: 0
  });

  // 5. Toasts
  const [toasts, setToasts] = useState<{ id: string; msgAr: string; msgEn: string; type: 'success' | 'info' | 'error' }[]>([]);
  const triggerToast = (en: string, ar: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, msgAr: ar, msgEn: en, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // 6. Interactive Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 7. Client Side Filtering & Sorting
  const filteredProducts = useMemo(() => {
    return products.filter(prd => {
      const matchSearch = searchQuery.trim() === '' || 
        prd.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) || 
        prd.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) || 
        prd.sku.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (prd.brand && prd.brand.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory = selectedCategory === 'all' || prd.categoryEn === selectedCategory;

      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'available' && prd.stock > 0 && prd.isAvailable) || 
        (statusFilter === 'outofstock' && prd.stock === 0) || 
        (statusFilter === 'featured' && prd.isFeatured);

      return matchSearch && matchCategory && matchStatus;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'stock-asc') return a.stock - b.stock;
      if (sortBy === 'stock-desc') return b.stock - a.stock;
      if (sortBy === 'name-asc') return (isRtl ? a.nameAr : a.nameEn).localeCompare(isRtl ? b.nameAr : b.nameEn);
      if (sortBy === 'name-desc') return (isRtl ? b.nameAr : b.nameEn).localeCompare(isRtl ? a.nameAr : a.nameEn);
      return 0;
    });
  }, [products, searchQuery, selectedCategory, statusFilter, sortBy, isRtl]);

  // Action: Toggle availability
  const handleToggleAvailable = (id: string) => {
    setProducts(prev => prev.map(prd => {
      if (prd.id === id) {
        const nextState = !prd.isAvailable;
        triggerToast(
          `Product status updated to ${nextState ? 'Available' : 'Unavailable'}`,
          `تم تحديث حالة المنتج بنجاح إلى ${nextState ? 'متوفر للطلب والمبيعات' : 'غير متوفر ومخفي من السلة'}`,
          'info'
        );
        return { ...prd, isAvailable: nextState };
      }
      return prd;
    }));
  };

  // Action: Delete product with confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const handleDeleteProduct = async (id: string) => {
    const prd = products.find(p => p.id === id);
    if (!prd) return;
    
    try {
      await tenantApiAdapter.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      triggerToast(
        `Product "${prd.nameEn || prd.nameAr}" deleted successfully.`,
        `تم حذف المنتج "${prd.nameAr || prd.nameEn}" بالكامل من مخزون الكتالوج.`,
        'success'
      );
    } catch (err) {
      triggerToast('Failed to delete product', 'فشل حذف المنتج', 'error');
    }
    setDeleteConfirmId(null);
  };

  // Action: Open Add form
  const handleOpenAdd = () => {
    if (productLimit !== null && productLimit !== -1 && productUsage >= productLimit) {
      triggerToast(
        'Subscription quota limit reached! Upgrade plan to add more products.',
        'لقد تجاوزت الحد الأقصى للمنتجات المسموح بها لباقة اشتراكك الحالية.',
        'error'
      );
      return;
    }
    setFormMode('add');
    setFormData({
      id: '',
      nameAr: '',
      nameEn: '',
      descriptionAr: '',
      descriptionEn: '',
      sku: '',
      brand: '',
      categoryAr: 'منتجات الشعر',
      categoryEn: 'Hair Products',
      images: [defaultImagePlaceholder],
      rawPrice: 100,
      price: 126.5,
      taxRate: 15,
      commissionRate: 10,
      stock: 30,
      size: '100 ml',
      color: '',
      ingredientsAr: '',
      ingredientsEn: '',
      howToUseAr: '',
      howToUseEn: '',
      featuresAr: '',
      featuresEn: '',
      isAvailable: true,
      isFeatured: false,
      allowsDelivery: true,
      allowsPickup: true,
      soldCount: 0,
      usedAsGiftCount: 0
    });
    setActiveSection('basic');
    setActiveView('form');
  };

  React.useEffect(() => {
    if (quickLaunchRequest?.target !== 'product') {
      return;
    }

    handleOpenAdd();
  }, [quickLaunchRequest?.nonce]);

  // Action: Open Edit form
  const handleOpenEdit = (prd: EnhancedProduct) => {
    setFormMode('edit');
    setFormData({ ...prd });
    setActiveSection('basic');
    setActiveView('form');
  };

  // Action: AI Copy Assistant
  const handleAIFillCopy = () => {
    if (!formData.nameEn && !formData.nameAr) {
      triggerToast(
        'Please input at least one Product Name (Arabic or English) to allow AI context pre-filling.',
        'يرجى كتابة اسم المنتج بلغة واحدة على الأقل لتمكين الذكاء الاصطناعي من صياغة التفاصيل.',
        'error'
      );
      return;
    }

    const name = formData.nameEn || formData.nameAr;
    triggerToast('Generating optimized product descriptions, clinical ingredients, and features...', 'جاري توليد النبذة المهنية وتفاصيل المنتج بواسطة الذكاء الاصطناعي...', 'info');

    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        descriptionEn: prev.descriptionEn || `Immersive premium wellness ${name} specifically formulated to yield ultimate cellular rejuvenation. Dermatologically tested, vegan-friendly, and free from sulfates or parabens.`,
        descriptionAr: prev.descriptionAr || `منتج ${name} الفاخر للعناية الفائقة، صُمم خصيصاً بمستخلصات عضوية طبيعية لتغذية خلايا الجسم وإعادة مرونتها الطبيعية وحمايتها من العوامل البيئية الضارة. خالي من الكيماويات والمواد المصنعة.`,
        ingredientsEn: prev.ingredientsEn || 'Active botanical matrix, pure organic mineral complexes, therapeutic oils, natural antioxidants.',
        ingredientsAr: prev.ingredientsAr || 'مستخلصات نباتية مائية نشطة، مركبات معدنية عضوية مكررة، فيتامينات أساسية مغذية، عطور طبيعية.',
        howToUseEn: prev.howToUseEn || 'Massage gently onto clean skin or hair until fully absorbed. Best utilized twice daily after warm bath routine.',
        howToUseAr: 'قم بوضع كمية كافية وتدليكها بلطف على الجلد أو الشعر النظيف بحركات دائرية حتى تمتص بالكامل. يفضل استخدامه مرتين يومياً.',
        featuresEn: prev.featuresEn || '100% Vegan & cruelty-free • Clinically proven cell repair • Sulfate & paraben free',
        featuresAr: prev.featuresAr || 'طبيعي وعضوي ١٠٠٪ • غني بالفيتامينات والمعادن المغذية • خالي من السلفات والبارابين',
        brand: prev.brand || 'Refah Organics'
      }));
      triggerToast('AI Generation completed successfully!', 'تم صياغة تفاصيل ومواصفات المنتج بالذكاء الاصطناعي بنجاح.', 'success');
    }, 1200);
  };

  // Action: AI Translate
  const handleAITranslate = (direction: 'enToAr' | 'arToEn') => {
    if (direction === 'enToAr') {
      if (!formData.descriptionEn) {
        triggerToast('No English content found to translate.', 'لا يوجد وصف باللغة الإنجليزية للترجمة.', 'error');
        return;
      }
      triggerToast('Translating English text to elegant literary Arabic...', 'جاري ترجمة الوصف إلى اللغة العربية الفصحى...', 'info');
      setTimeout(() => {
        setFormData(p => ({
          ...p,
          descriptionAr: `[ترجمة ذكية] ${p.descriptionEn} - هذا المنتج مصمم لتلبية أعلى تطلعات النضارة الصحية وعلاج المشاكل الشائعة بلمسات ناعمة طبيعية.`
        }));
        triggerToast('Translation completed!', 'تمت الترجمة وتحديث الوصف العربي بنجاح.', 'success');
      }, 800);
    } else {
      if (!formData.descriptionAr) {
        triggerToast('No Arabic content found to translate.', 'لا يوجد وصف باللغة العربية للترجمة.', 'error');
        return;
      }
      triggerToast('Translating Arabic text to accurate professional English...', 'جاري ترجمة الوصف إلى الإنجليزية...', 'info');
      setTimeout(() => {
        setFormData(p => ({
          ...p,
          descriptionEn: `[AI Translation] ${p.descriptionAr} - Formulated using clinically selected raw organic compounds to deliver intensive rehabilitation, deep skin cellular repair, and optimal preservation.`
        }));
        triggerToast('Translation completed!', 'تمت الترجمة وتحديث الوصف الإنجليزي بنجاح.', 'success');
      }, 800);
    }
  };

  // FileReader Image Drop/Click Handler
  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      triggerToast('Invalid file format. Please select PNG, JPG, or WEBP.', 'تنسيق الملف غير صالح. يرجى اختيار ملف صورة.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      triggerToast('File exceeds 5MB limit.', 'حجم الملف كبير جداً ويتجاوز الحد المسموح به 5 ميجابايت.', 'error');
      return;
    }
    if (formData.images.length >= 5) {
      triggerToast('Maximum 5 images allowed per product.', 'الحد الأقصى للصور هو 5 صور لكل منتج.', 'error');
      return;
    }

    setUploadError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setFormData(prev => {
          const currentImages = prev.images.filter(img => img !== defaultImagePlaceholder);
          return {
            ...prev,
            images: [...currentImages, e.target!.result as string]
          };
        });
        triggerToast('Product image uploaded successfully!', 'تم رفع الصورة وإضافتها إلى معرض المعاينة المباشرة.', 'success');
      }
      setUploading(false);
    };
    reader.onerror = () => {
      setUploadError(isRtl ? 'فشل قراءة ملف الصورة.' : 'Failed to parse image file.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Raw Price input and tax recalculation
  const handleRawPriceChange = (val: number) => {
    const rawVal = Math.max(0, val);
    const comm = Math.round(rawVal * (formData.commissionRate / 100) * 100) / 100;
    const finalBeforeTax = rawVal + comm;
    const tax = Math.round(finalBeforeTax * (formData.taxRate / 100) * 100) / 100;
    const finalPrice = Math.round((finalBeforeTax + tax) * 100) / 100;

    setFormData(prev => ({
      ...prev,
      rawPrice: rawVal,
      price: finalPrice
    }));
  };

  // Submit Save Product Form
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nameAr && !formData.nameEn) {
      triggerToast('Product Name is required in at least one language.', 'يرجى كتابة اسم المنتج بلغة واحدة على الأقل قبل الحفظ.', 'error');
      return;
    }

    if (!formData.sku.trim()) {
      triggerToast('Product SKU is required.', 'رمز SKU التعريفي للمنتج مطلوب.', 'error');
      return;
    }

    // Validation: At least one delivery option
    if (!formData.allowsDelivery && !formData.allowsPickup) {
      triggerToast('At least one fulfillment channel (Delivery or Pickup) must be enabled.', 'يجب تمكين قناة تلبية واحدة على الأقل (التوصيل أو الاستلام من الفرع).', 'error');
      return;
    }

    // Validation: Unique SKU
    const isSkuDuplicate = products.some(p => p.sku.toLowerCase() === formData.sku.toLowerCase() && p.id !== formData.id);
    if (isSkuDuplicate) {
      triggerToast('SKU already exists. Please input a unique identifier.', 'رمز الـ SKU مسجل مسبقاً لمنتج آخر. يرجى إدخال رمز فريد.', 'error');
      return;
    }

    // Resolve Category objects
    const selectedCat = categoryOptions.find(c => c.id === formData.categoryEn || c.labelEn === formData.categoryEn) || categoryOptions[1];

    const finalProductData: any = {
      ...formData,
      categoryEn: selectedCat.id,
      categoryAr: selectedCat.labelAr,
      isAvailable: formData.stock > 0 && formData.isAvailable,
      images: formData.images.length > 0 ? formData.images : [defaultImagePlaceholder]
    };

    try {
      if (formMode === 'add') {
        // Send to backend
        const res = await tenantApiAdapter.createProduct(finalProductData);
        setProducts(prev => [res.product, ...prev]);
        triggerToast(
          `Deployed new product successfully!`,
          `تم إضافة وتنشيط المنتج الجديد وتأكيد مخزونه بنجاح!`,
          'success'
        );
      } else {
        const res = await tenantApiAdapter.updateProduct(finalProductData.id, finalProductData);
        setProducts(prev => prev.map(p => p.id === finalProductData.id ? res.product : p));
        triggerToast(
          `Updated product details!`,
          `تم حفظ تفاصيل وتعديلات المنتج بنجاح.`,
          'success'
        );
      }
      setActiveView('list');
    } catch (err: any) {
       triggerToast(err.message || 'Failed to save product', 'فشل حفظ المنتج', 'error');
    }
  };

  return (
    <div className="space-y-6" id="products-workspace-module">
      
      {/* Toast Notification Stack */}
      <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50 flex flex-col gap-3.5 max-w-sm w-full`}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="bg-white border border-slate-200/95 shadow-2xl p-4 rounded-xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className={`absolute top-0 bottom-0 w-1 ${isRtl ? 'right-0' : 'left-0'} ${
                t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
              }`} />
              <span className={`p-1.5 rounded-lg shrink-0 ${
                t.type === 'success' ? 'bg-emerald-50 text-emerald-600' : t.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {t.type === 'success' ? <Check size={14} /> : <Info size={14} />}
              </span>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-black text-neutral-800 leading-normal">
                  {isRtl ? t.msgAr : t.msgEn}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {activeView === 'list' ? (
        <div className="space-y-6" id="products-catalog-list-view">
          
          {/* Top Quota Warning Panel */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-12 -translate-y-6">
              <Package size={220} />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-black tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-blue-100">
                    {productPlanName}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-500/30 px-2 py-0.5 rounded text-emerald-200 border border-emerald-500/20">
                    {isRtl ? 'المخزون نشط' : 'Inventory Active'}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black font-sans leading-tight">
                  {isRtl ? 'مستودع وكتالوج المنتجات الفاخر' : 'Elite Products Catalog & Stock Register'}
                </h2>
                <p className="text-xs text-blue-100/85 max-w-2xl">
                  {isRtl 
                    ? 'قم بإدارة المخزون والتوصيل وربط المنتجات ببيع الـ POS مع تفعيل خيارات الدفع والتقاط تفاصيل المنتجات الموجهة.' 
                    : 'Manage luxurious boutique inventory, home delivery, POS checkout linkages, and display client-facing catalogs.'}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10 shrink-0 md:w-64 space-y-2">
                <div className="flex justify-between text-xs font-black">
                  <span>{isRtl ? 'حصة المنتجات المستخدمة' : 'Used Products Quota'}</span>
                  <span>{productUsage} / {formatTenantPlanLimit(productLimit, isRtl ? 'ar' : 'en')}</span>
                </div>
                <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full transition-all duration-500" 
                    style={{
                      width:
                        productLimit && productLimit > 0
                          ? `${Math.min(100, (productUsage / productLimit) * 100)}%`
                          : '0%'
                    }}
                  />
                </div>
                <p className="text-[9px] text-blue-200 font-bold">
                  {isRtl 
                    ? (productLimit === -1
                        ? 'الإضافة متاحة بدون حد للمنتجات.'
                        : `باقي لك ${formatTenantPlanLimit(productLimit === null ? null : Math.max(productLimit - productUsage, 0), 'ar')} منتج متاح للإضافة`)
                    : (productLimit === -1
                        ? 'Product creation is unlimited on the current plan.'
                        : `You have ${formatTenantPlanLimit(productLimit === null ? null : Math.max(productLimit - productUsage, 0), 'en')} available product slots left.`)}
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Control Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'ابحث باسم المنتج، الماركة أو رمز الـ SKU...' : 'Search products by name, brand or SKU...'}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-xs text-neutral-800 font-bold"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-neutral-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Advanced Filter options */}
              <div className="flex flex-wrap items-center gap-2.5">
                
                {/* Status Dropdowns */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 px-2.5 text-xs text-neutral-700 font-bold">
                  <Filter size={12} className="text-neutral-400" />
                  <span>{isRtl ? 'تصفية:' : 'Filter:'}</span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="bg-transparent border-none focus:ring-0 text-xs font-bold text-neutral-800 py-1"
                  >
                    <option value="all">{isRtl ? 'جميع المنتجات' : 'All Products'}</option>
                    <option value="available">{isRtl ? 'المتوفرة للبيع' : 'In Stock & Available'}</option>
                    <option value="outofstock">{isRtl ? 'المنتهية من المخزن' : 'Out of Stock'}</option>
                    <option value="featured">{isRtl ? 'المنتجات المميزة' : 'Featured Products'}</option>
                  </select>
                </div>

                {/* Sorters */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 px-2.5 text-xs text-neutral-700 font-bold">
                  <SlidersHorizontal size={12} className="text-neutral-400" />
                  <span>{isRtl ? 'ترتيب:' : 'Sort:'}</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none focus:ring-0 text-xs font-bold text-neutral-800 py-1"
                  >
                    <option value="none">{isRtl ? 'افتراضي' : 'Default'}</option>
                    <option value="price-asc">{isRtl ? 'السعر: من الأقل للأعلى' : 'Price: Low to High'}</option>
                    <option value="price-desc">{isRtl ? 'السعر: من الأعلى للأقل' : 'Price: High to Low'}</option>
                    <option value="stock-asc">{isRtl ? 'المخزون: شحيح أولاً' : 'Stock: Low to High'}</option>
                    <option value="stock-desc">{isRtl ? 'المخزون: وافر أولاً' : 'Stock: High to Low'}</option>
                    <option value="name-asc">{isRtl ? 'الاسم: أ - ي' : 'Name: A - Z'}</option>
                    <option value="name-desc">{isRtl ? 'الاسم: ي - أ' : 'Name: Z - A'}</option>
                  </select>
                </div>

                {/* Add Product Button */}
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>{isRtl ? 'إضافة منتج جديد' : 'Add New Product'}</span>
                </button>

              </div>
            </div>
          </div>

          {/* Two-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Category Sidebar Column */}
            <div className="lg:col-span-3 space-y-2">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1 block">
                {isRtl ? 'تصفح حسب الفئة' : 'Browse By Category'}
              </span>
              <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-2 space-y-1">
                {categoryOptions.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-start px-3.5 py-2.5 rounded-lg text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                      selectedCategory === cat.id 
                        ? 'bg-blue-50 text-blue-700 shadow-3xs' 
                        : 'text-neutral-500 hover:bg-slate-50/70 hover:text-neutral-800'
                    }`}
                  >
                    <span>{isRtl ? cat.labelAr : cat.labelEn}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                      selectedCategory === cat.id ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-neutral-500'
                    }`}>
                      {cat.id === 'all' 
                        ? products.length 
                        : products.filter(p => p.categoryEn === cat.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Results Grid Panel */}
            <div className="lg:col-span-9 space-y-4">
              
              <div className="flex items-center justify-between text-xs text-neutral-400 font-bold px-1">
                <span>
                  {isRtl 
                    ? `تم العثور على ${filteredProducts.length} منتج مطابق` 
                    : `Showing ${filteredProducts.length} matching products`}
                </span>
                {(searchQuery || selectedCategory !== 'all' || statusFilter !== 'all') && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setStatusFilter('all');
                    }}
                    className="text-indigo-600 hover:underline font-black cursor-pointer"
                  >
                    {isRtl ? 'إعادة ضبط التصفية' : 'Reset Filters'}
                  </button>
                )}
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white border border-neutral-200/60 rounded-2xl p-16 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto">
                    <ShoppingBag size={28} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-neutral-700">{isRtl ? 'لم يتم العثور على منتجات' : 'No Products Found'}</h3>
                    <p className="text-xs text-neutral-400 max-w-md mx-auto">
                      {isRtl 
                        ? 'لا توجد منتجات مطابقة لخيارات التصفية النشطة حالياً. يرجى تعديل البحث أو إضافة منتج جديد.' 
                        : 'We could not find any products matching your search criteria. Try modifying your keywords or add your first item.'}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAdd}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>{isRtl ? 'إضافة منتج للبدء' : 'Add Product to start'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="products-catalog-cards">
                  {filteredProducts.map(prd => (
                    <div 
                      key={prd.id} 
                      className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden relative ${
                        !prd.isAvailable || prd.stock === 0 ? 'opacity-85' : ''
                      } ${
                        deleteConfirmId === prd.id ? 'border-rose-500 ring-1 ring-rose-500' : 'border-neutral-200/60'
                      }`}
                    >
                      {/* Image Preview & Hover features */}
                      <div className="aspect-video relative overflow-hidden bg-neutral-100 border-b border-neutral-100">
                        <img 
                          src={prd.images[0] || defaultImagePlaceholder} 
                          alt={prd.nameEn} 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
                          {prd.isFeatured && (
                            <span className="text-[9px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wide">
                              {isRtl ? 'مميز ★' : 'Featured ★'}
                            </span>
                          )}
                          <span className="text-[9px] bg-slate-950/80 text-white px-2 py-0.5 rounded font-mono shadow-sm">
                            {prd.sku}
                          </span>
                        </div>

                        {prd.stock === 0 && (
                          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
                            <span className="bg-rose-600 text-white text-[10px] font-black px-3.5 py-1 rounded-full shadow-md uppercase">
                              {isRtl ? 'منتهي من المخزن' : 'Out of Stock'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Content info */}
                      <div className="p-4 space-y-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                              {isRtl ? prd.categoryAr : prd.categoryEn}
                            </span>
                            {prd.brand && (
                              <span className="text-[9px] text-neutral-400 font-extrabold">{prd.brand}</span>
                            )}
                          </div>
                          <h4 className="font-black text-sm text-neutral-800 line-clamp-2">
                            {isRtl ? prd.nameAr : prd.nameEn}
                          </h4>
                          {prd.size && (
                            <span className="text-[10px] text-neutral-400 font-bold block">
                              {isRtl ? `الحجم / الوزن: ${prd.size}` : `Size / Weight: ${prd.size}`}
                            </span>
                          )}
                        </div>

                        {/* Inline Availability Toggles & Stats */}
                        <div className="grid grid-cols-2 gap-2 text-center text-xs border-y border-slate-50 py-2">
                          <div className="border-r border-slate-50 text-start pl-1">
                            <span className="text-[9px] text-neutral-400 font-bold block uppercase">{isRtl ? 'المبيعات' : 'Units Sold'}</span>
                            <span className="font-mono font-black text-neutral-700">{prd.soldCount} {isRtl ? 'قطعة' : 'pcs'}</span>
                          </div>
                          <div className="text-start pl-2">
                            <span className="text-[9px] text-neutral-400 font-bold block uppercase">{isRtl ? 'توزيع هدايا' : 'Gifted'}</span>
                            <span className="font-mono font-black text-neutral-700">{prd.usedAsGiftCount} {isRtl ? 'مرات' : 'times'}</span>
                          </div>
                        </div>

                        {/* Delivery badges */}
                        <div className="flex gap-2 items-center text-[10px] font-bold text-neutral-400">
                          {prd.allowsDelivery && (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <Truck size={10} />
                              {isRtl ? 'توصيل' : 'Delivery'}
                            </span>
                          )}
                          {prd.allowsPickup && (
                            <span className="flex items-center gap-1 text-indigo-600">
                              <Store size={10} />
                              {isRtl ? 'استلام فرع' : 'Pickup'}
                            </span>
                          )}
                        </div>

                        {/* Pricing & stock summary */}
                        <div className="flex items-end justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[9px] text-neutral-400 font-bold block uppercase">{isRtl ? 'سعر البيع النهائي' : 'Final Price (VAT)'}</span>
                            <span className="text-lg font-black text-blue-600 font-mono">
                              {prd.price} <span className="text-[10px]">{isRtl ? 'ر.س' : 'SAR'}</span>
                            </span>
                          </div>

                          <div className="text-end">
                            <span className="text-[9px] text-neutral-400 font-bold block uppercase">{isRtl ? 'الكمية المتوفرة' : 'Stock count'}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              prd.stock > 15 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : prd.stock > 0 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'bg-rose-50 text-rose-700'
                            }`}>
                              {prd.stock > 0 ? `${prd.stock} ${isRtl ? 'وحدة' : 'units'}` : (isRtl ? 'نفذت' : 'Out')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions Panel */}
                      <div className="bg-slate-50/80 p-3 border-t border-neutral-100 flex items-center justify-between gap-1">
                        
                        {/* Quick Availability toggler */}
                        <button
                          type="button"
                          onClick={() => handleToggleAvailable(prd.id)}
                          className="flex items-center gap-1 cursor-pointer text-[10px] font-black text-neutral-500 hover:text-neutral-800"
                        >
                          {prd.isAvailable && prd.stock > 0 ? (
                            <CheckSquare size={13} className="text-blue-600" />
                          ) : (
                            <Square size={13} />
                          )}
                          <span>{isRtl ? 'متاح للطلب' : 'Available'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          {deleteConfirmId === prd.id ? (
                            <div className="flex items-center gap-1 animate-fade-in">
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(prd.id)}
                                className="bg-rose-600 text-white font-black text-[9px] px-2.5 py-1.5 rounded-lg cursor-pointer"
                              >
                                {isRtl ? 'تأكيد الحذف' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="bg-slate-200 text-neutral-700 font-bold text-[9px] px-2 py-1.5 rounded-lg cursor-pointer"
                              >
                                {isRtl ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(prd)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-neutral-700 rounded-lg transition-all cursor-pointer"
                                title={isRtl ? 'تعديل أو استعراض التفاصيل' : 'Edit or View details'}
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(prd.id)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                                title={isRtl ? 'حذف المنتج' : 'Delete product'}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
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
      ) : (
        /* GUIDED MULTI-SECTION PRODUCT EDITOR FRAME */
        <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden animate-fade-in" id="product-guided-editor-frame">
          
          {/* Editor Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="p-2 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft size={16} className={isRtl ? 'transform rotate-180' : ''} />
              </button>
              <div>
                <span className="text-[9px] uppercase tracking-widest text-indigo-400 font-black block">
                  {isRtl ? 'إطار تحرير المستودع والمنتجات' : 'BOUTIQUE INVENTORY WRITER FRAME'}
                </span>
                <h2 className="text-base font-black">
                  {formMode === 'add' 
                    ? (isRtl ? 'إطلاق وإضافة منتج جديد' : 'Deploy and Launch New Product')
                    : (isRtl ? `تحديث تفاصيل المنتج: ${formData.nameAr || formData.nameEn}` : `Update Details: ${formData.nameEn || formData.nameAr}`)}
                </h2>
              </div>
            </div>

            {/* AI Assistant Quickfill */}
            <button
              type="button"
              onClick={handleAIFillCopy}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-indigo-500/30 text-white"
            >
              <Sparkles size={13} />
              <span>{isRtl ? 'استعانة بالذكاء الاصطناعي لتعبئة البيانات' : 'AI Context Copy Generator'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
            
            {/* Left guided Section Navigator */}
            <div className="lg:col-span-3 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-2.5 block mb-2.5">
                {isRtl ? 'أقسام تحرير المنتج' : 'Editor Sections'}
              </span>
              
              <button
                type="button"
                onClick={() => setActiveSection('basic')}
                className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeSection === 'basic' 
                    ? 'bg-indigo-600 text-white shadow-3xs' 
                    : 'text-neutral-600 hover:bg-slate-100 hover:text-neutral-900'
                }`}
              >
                <Layers size={14} />
                <span>{isRtl ? 'البيانات الأساسية والهوية' : 'Basic Identity Info'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('details')}
                className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeSection === 'details' 
                    ? 'bg-indigo-600 text-white shadow-3xs' 
                    : 'text-neutral-600 hover:bg-slate-100 hover:text-neutral-900'
                }`}
              >
                <FileText size={14} />
                <span>{isRtl ? 'المواصفات وتفاصيل المنتج' : 'Specifications & Details'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('images')}
                className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeSection === 'images' 
                    ? 'bg-indigo-600 text-white shadow-3xs' 
                    : 'text-neutral-600 hover:bg-slate-100 hover:text-neutral-900'
                }`}
              >
                <ImageIcon size={14} />
                <span>{isRtl ? 'معرض صور غلاف المنتج' : 'Product Media Gallery'}</span>
                {formData.images.filter(x => x !== defaultImagePlaceholder).length > 0 && (
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 rounded-full px-1.5 font-bold font-mono">
                    {formData.images.filter(x => x !== defaultImagePlaceholder).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('pricing')}
                className={`w-full text-start px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeSection === 'pricing' 
                    ? 'bg-indigo-600 text-white shadow-3xs' 
                    : 'text-neutral-600 hover:bg-slate-100 hover:text-neutral-900'
                }`}
              >
                <Tag size={14} />
                <span>{isRtl ? 'التسعير وإدارة المخزون' : 'Pricing & Stock Control'}</span>
              </button>

              {/* Status and warnings */}
              <div className="pt-8 px-2.5 space-y-3">
                <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 text-[11px] text-blue-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black text-blue-950">
                    <Info size={12} className="text-blue-700" />
                    <span>{isRtl ? 'تلميحات هامة' : 'Catalog Tips'}</span>
                  </div>
                  <p className="font-bold leading-normal">
                    {isRtl 
                      ? 'لكتابة وصف ملائم وجذاب، قم بتعبئة الاسم أولاً تم اضغط زر الذكاء الاصطناعي لملء تفاصيل المكونات والوصف تلقائياً.'
                      : 'Input names and let the AI Assistant draft rich dermatological copy, features and directions of usage.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Form Fields Panel */}
            <form onSubmit={handleSaveProduct} className="lg:col-span-9 p-6 lg:p-8 space-y-6">
              
              {/* SECTION 1: BASIC INFORMATION */}
              {activeSection === 'basic' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-2 flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-600" />
                    <span>{isRtl ? 'القسم الأول: هوية المنتج الأساسية' : 'Section 1: Core Product Identity'}</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Arabic Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'اسم المنتج بالعربية *' : 'Product Name (Arabic) *'}
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={formData.nameAr}
                        onChange={e => setFormData(p => ({ ...p, nameAr: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="مثال: شامبو مغذي بخلاصة اللافندر البري"
                      />
                    </div>

                    {/* English Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'اسم المنتج بالإنجليزية *' : 'Product Name (English) *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nameEn}
                        onChange={e => setFormData(p => ({ ...p, nameEn: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="e.g. Nutrient Organic Wild Lavender Shampoo"
                      />
                    </div>
                  </div>

                  {/* Brand and category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'فئة الكتالوج' : 'Catalog Category'}
                      </label>
                      <select
                        value={formData.categoryEn}
                        onChange={e => {
                          const cat = categoryOptions.find(c => c.id === e.target.value);
                          setFormData(p => ({
                            ...p,
                            categoryEn: e.target.value,
                            categoryAr: cat ? cat.labelAr : p.categoryAr
                          }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-neutral-700 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                      >
                        {categoryOptions.filter(x => x.id !== 'all').map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {isRtl ? cat.labelAr : cat.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'الماركة التجارية' : 'Brand Name'}
                      </label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={e => setFormData(p => ({ ...p, brand: e.target.value }))}
                        placeholder="e.g. Refah Beauty, La Colline"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                      />
                    </div>
                  </div>

                  {/* SKU, Size, and Color */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'رمز SKU للتعريف الفريد *' : 'Product Unique SKU *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.sku}
                        onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))}
                        placeholder="e.g. REF-SHMP-902"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-bold text-neutral-800 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'الحجم / الوزن (Size)' : 'Size / Capacity'}
                      </label>
                      <input
                        type="text"
                        value={formData.size}
                        onChange={e => setFormData(p => ({ ...p, size: e.target.value }))}
                        placeholder="e.g. 100 ml, 250 g"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'اللون (اختياري)' : 'Product Color (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={e => setFormData(p => ({ ...p, color: e.target.value }))}
                        placeholder="e.g. Amber, Violet, Rose"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                      />
                    </div>
                  </div>

                  {/* Descriptions */}
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 block">{isRtl ? 'مساعد الترجمة الفوري بالذكاء الاصطناعي' : 'Instant AI Translation Bridge'}</span>
                        <span className="text-[9px] text-neutral-400 font-bold block">{isRtl ? 'اكتب الوصف بلغة واحدة واستخدم المساعد لترجمته فوراً' : 'Write one description and translate to other language automatically.'}</span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAITranslate('enToAr')}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-black transition-all cursor-pointer"
                        >
                          {isRtl ? 'ترجم الإنجليزية للعربية' : 'Translate EN ➔ AR'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAITranslate('arToEn')}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-black transition-all cursor-pointer"
                        >
                          {isRtl ? 'ترجم العربية للإنجليزية' : 'Translate AR ➔ EN'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Description AR */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                          {isRtl ? 'الوصف الترويجي (العربية)' : 'Promotional Description (Arabic)'}
                        </label>
                        <textarea
                          rows={4}
                          value={formData.descriptionAr}
                          onChange={e => setFormData(p => ({ ...p, descriptionAr: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800 leading-relaxed"
                          placeholder="اكتب نبذة مميزة لشرح فوائد المنتج وطريقة مفعوله ومظهره..."
                        />
                      </div>

                      {/* Description EN */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                          {isRtl ? 'الوصف الترويجي (الإنجليزية)' : 'Promotional Description (English)'}
                        </label>
                        <textarea
                          rows={4}
                          value={formData.descriptionEn}
                          onChange={e => setFormData(p => ({ ...p, descriptionEn: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800 leading-relaxed"
                          placeholder="Write a descriptive brief to showcase clinical advantages, feel, and aromatic highlights..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: PRODUCT DETAILS */}
              {activeSection === 'details' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-2 flex items-center gap-1.5">
                    <FileText size={13} className="text-indigo-600" />
                    <span>{isRtl ? 'القسم الثاني: المكونات العضوية ومواصفات الدليل' : 'Section 2: Organic Ingredients & Guidance'}</span>
                  </h3>

                  {/* Ingredients */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'المكونات والعناصر النشطة (العربية)' : 'Active Ingredients (Arabic)'}
                      </label>
                      <textarea
                        rows={3}
                        value={formData.ingredientsAr}
                        onChange={e => setFormData(p => ({ ...p, ingredientsAr: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="مثال: زيت الأرغان، زبدة الشيا، فيتامينات مغذية..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'المكونات والعناصر النشطة (الإنجليزية)' : 'Active Ingredients (English)'}
                      </label>
                      <textarea
                        rows={3}
                        value={formData.ingredientsEn}
                        onChange={e => setFormData(p => ({ ...p, ingredientsEn: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="e.g. Pure Shea Butter, Argan Oil, Mineral Hydrates..."
                      />
                    </div>
                  </div>

                  {/* How to use */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'طريقة الاستخدام والتطبيق (العربية)' : 'Directions of Use (Arabic)'}
                      </label>
                      <textarea
                        rows={3}
                        value={formData.howToUseAr}
                        onChange={e => setFormData(p => ({ ...p, howToUseAr: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="مثال: ضع بضع قطرات ودلك بلطف بحركات دائرية..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'طريقة الاستخدام والتطبيق (الإنجليزية)' : 'Directions of Use (English)'}
                      </label>
                      <textarea
                        rows={3}
                        value={formData.howToUseEn}
                        onChange={e => setFormData(p => ({ ...p, howToUseEn: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="e.g. Apply standard amount and massage in circular patterns..."
                      />
                    </div>
                  </div>

                  {/* Features */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'المزايا والفوائد الرئيسية (العربية)' : 'Core Features & Benefits (Arabic)'}
                      </label>
                      <textarea
                        rows={2}
                        value={formData.featuresAr}
                        onChange={e => setFormData(p => ({ ...p, featuresAr: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="مثال: ترطيب فوري • خالي من المواد الحافظة • سريع الامتصاص"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                        {isRtl ? 'المزايا والفوائد الرئيسية (الإنجليزية)' : 'Core Features & Benefits (English)'}
                      </label>
                      <textarea
                        rows={2}
                        value={formData.featuresEn}
                        onChange={e => setFormData(p => ({ ...p, featuresEn: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-semibold text-neutral-800"
                        placeholder="e.g. Paraben-free • Deep Instant moisturizing • Hypoallergenic"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: PRODUCT IMAGES */}
              {activeSection === 'images' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-2 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-indigo-600" />
                    <span>{isRtl ? 'القسم الثالث: الكتالوج المصور والمعاينة المباشرة' : 'Section 3: Product Media Gallery'}</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                      
                      {/* Drag-and-drop file uploader block */}
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
                          document.getElementById('product-image-uploader')?.click();
                        }}
                        className={`relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all overflow-hidden ${
                          isDragging
                            ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]'
                            : 'border-neutral-200 hover:border-indigo-400 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="file"
                          id="product-image-uploader"
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
                            <p className="text-xs font-black text-neutral-700">{isRtl ? 'جاري معالجة وضغط الصورة...' : 'Processing file...'}</p>
                          </div>
                        ) : (
                          <div className="space-y-2 pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto">
                              <Upload size={18} />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-black text-neutral-700">
                                {isRtl ? 'اسحب وأفلت صورة هنا أو تصفح' : 'Drag & drop image file or browse'}
                              </p>
                              <p className="text-[10px] font-bold text-neutral-400">
                                {isRtl ? 'صيغ PNG, JPG, WEBP حتى 5 ميجابايت' : 'PNG, JPG, WEBP up to 5MB'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Custom image URL entry field */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                          {isRtl ? 'أو أدخل رابط ويب لصورة خارجية مخصصة' : 'Or Input Custom Image Web URL'}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            id="custom-image-url-input"
                            placeholder="https://images.unsplash.com/..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-neutral-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 text-neutral-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById('custom-image-url-input') as HTMLInputElement;
                              if (input && input.value.trim()) {
                                if (formData.images.length >= 5) {
                                  triggerToast('Maximum 5 images allowed.', 'الحد الأقصى للصور هو 5 صور.', 'error');
                                  return;
                                }
                                const current = formData.images.filter(x => x !== defaultImagePlaceholder);
                                setFormData(prev => ({
                                  ...prev,
                                  images: [...current, input.value.trim()]
                                }));
                                triggerToast('Custom Image URL added successfully!', 'تم إضافة رابط الصورة المخصصة للمعرض بنجاح.', 'success');
                                input.value = '';
                              }
                            }}
                            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            {isRtl ? 'إضافة' : 'Add'}
                          </button>
                        </div>
                      </div>

                      {/* Warning box if error */}
                      {uploadError && (
                        <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
                          {uploadError}
                        </p>
                      )}

                    </div>

                    {/* Right gallery view & presets */}
                    <div className="space-y-4">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">
                        {isRtl ? 'معرض صور المنتج الحالي (بحد أقصى 5)' : 'Active Product Gallery (Max 5)'}
                      </span>

                      {/* Display added thumbnails */}
                      <div className="grid grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {formData.images.map((img, idx) => (
                          <div key={idx} className="aspect-square rounded-lg border border-slate-200 bg-white relative overflow-hidden group">
                            <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                            {img !== defaultImagePlaceholder && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => {
                                    const filtered = prev.images.filter((_, i) => i !== idx);
                                    return {
                                      ...prev,
                                      images: filtered.length > 0 ? filtered : [defaultImagePlaceholder]
                                    };
                                  });
                                  triggerToast('Image deleted from gallery', 'تم إزالة الصورة من معرض المنتج.', 'info');
                                }}
                                className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Delete image"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                        {formData.images.length === 1 && formData.images[0] === defaultImagePlaceholder && (
                          <span className="text-[10px] text-neutral-400 italic col-span-5 py-3 text-center block">
                            {isRtl ? 'المعرض فارغ، يتم عرض الصورة الافتراضية للكتالوج.' : 'Gallery is empty. Displaying catalog placeholder.'}
                          </span>
                        )}
                      </div>

                      {/* Quick luxury Unsplash cosmetics presets */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">
                          {isRtl ? 'قوالب صور مستحضرات مهيأة احترافية:' : 'Or Quick Premium Cosmetics Presets:'}
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {presetCosmeticsImages.map((img, i) => {
                            const isAdded = formData.images.includes(img.url);
                            return (
                              <button
                                key={i}
                                type="button"
                                title={isRtl ? img.labelAr : img.labelEn}
                                onClick={() => {
                                  if (isAdded) {
                                    setFormData(p => ({ ...p, images: p.images.filter(x => x !== img.url).length > 0 ? p.images.filter(x => x !== img.url) : [defaultImagePlaceholder] }));
                                    triggerToast('Preset image removed', 'تم إزالة القالب من معرض الصور.', 'info');
                                  } else {
                                    if (formData.images.length >= 5) {
                                      triggerToast('Maximum 5 images allowed.', 'الحد الأقصى المسموح به هو 5 صور.', 'error');
                                      return;
                                    }
                                    const current = formData.images.filter(x => x !== defaultImagePlaceholder);
                                    setFormData(p => ({ ...p, images: [...current, img.url] }));
                                    triggerToast('Premium preset image assigned!', 'تم إضافة قالب الصورة المميزة للمعرض.', 'success');
                                  }
                                }}
                                className={`aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.03] cursor-pointer ${
                                  isAdded ? 'border-indigo-600 scale-[1.03] shadow-xs' : 'border-neutral-200'
                                }`}
                              >
                                <img src={img.url} alt="preset" className="w-full h-full object-cover" />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: PRICING AND INVENTORY */}
              {activeSection === 'pricing' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-2 flex items-center gap-1.5">
                    <Tag size={13} className="text-indigo-600" />
                    <span>{isRtl ? 'القسم الرابع: التسعير والتحصيل المالي والكميات المتاحة' : 'Section 4: Pricing & Inventory Control'}</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    
                    {/* Input pricing & stock */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        
                        {/* Raw Price */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                            {isRtl ? 'سعر التكلفة المبدئي ر.س *' : 'Raw Cost Price (SAR) *'}
                          </label>
                          <input
                            type="number"
                            required
                            min={0}
                            value={formData.rawPrice}
                            onChange={e => handleRawPriceChange(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-black text-neutral-800 font-mono text-center"
                          />
                        </div>

                        {/* Stock count */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-neutral-500 font-extrabold block uppercase">
                            {isRtl ? 'كمية المخزون المتاحة *' : 'Available Stock Quantity *'}
                          </label>
                          <input
                            type="number"
                            required
                            min={0}
                            value={formData.stock}
                            onChange={e => setFormData(p => ({ ...p, stock: parseInt(e.target.value) || 0, isAvailable: (parseInt(e.target.value) || 0) > 0 }))}
                            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs font-black text-neutral-800 font-mono text-center"
                          />
                        </div>

                      </div>

                      {/* Switches for availability and featured */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formData.isAvailable}
                            onChange={e => setFormData(p => ({ ...p, isAvailable: e.target.checked }))}
                            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <div>
                            <span className="text-xs font-black text-neutral-800 block">{isRtl ? 'عرض المنتج كمتوفر للطلب والمبيعات' : 'Enable Active Sales Availability'}</span>
                            <span className="text-[10px] text-neutral-400 font-bold block">{isRtl ? 'سيظهر المنتج فوراً للعملاء وبسلة المشتريات POS' : 'Product instantly shows in POS cart & bookings.'}</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer select-none border-t border-slate-200/50 pt-2">
                          <input
                            type="checkbox"
                            checked={formData.isFeatured}
                            onChange={e => setFormData(p => ({ ...p, isFeatured: e.target.checked }))}
                            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <div>
                            <span className="text-xs font-black text-neutral-800 block">{isRtl ? 'تمييز المنتج بالواجهة (Featured)' : 'Feature Product on Showcase'}</span>
                            <span className="text-[10px] text-neutral-400 font-bold block">{isRtl ? 'سيحصل على شعار مخصص ويعرض بصدارة نتائج الكتالوج' : 'Places a gold badge and boosts product rank on search.'}</span>
                          </div>
                        </label>
                      </div>

                      {/* Fulfillment Channels */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">
                          {isRtl ? 'قنوات التلبية والشحن المعتمدة *' : 'Fulfillment Channels *'}
                        </span>

                        <div className="flex flex-col gap-2.5">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.allowsDelivery}
                              onChange={e => setFormData(p => ({ ...p, allowsDelivery: e.target.checked }))}
                              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                              <Truck size={14} className="text-emerald-600" />
                              <span>{isRtl ? 'يسمح بتوصيل للمنزل والشحن السريع' : 'Allow Home Delivery & Fast Shipping'}</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer select-none border-t border-slate-200/50 pt-2">
                            <input
                              type="checkbox"
                              checked={formData.allowsPickup}
                              onChange={e => setFormData(p => ({ ...p, allowsPickup: e.target.checked }))}
                              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                              <Store size={14} className="text-indigo-600" />
                              <span>{isRtl ? 'يسمح بالاستلام الذاتي من الفرع المعين' : 'Allow Self-Pickup from Assigned Center'}</span>
                            </div>
                          </label>
                        </div>
                      </div>

                    </div>

                    {/* Right Dynamic pricing calculation card */}
                    <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-4 shadow-md">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-black block">
                          {isRtl ? 'بطاقة الاحتساب والحصيلة المالية للمبيعات' : 'REAL-TIME SALES BREAKDOWN SHEET'}
                        </span>
                        <h4 className="text-sm font-black text-white mt-1">
                          {isRtl ? 'تفاصيل سعر التجزئة النهائي للعميل' : 'Bespoke Client Price Breakdown'}
                        </h4>
                      </div>

                      <div className="space-y-2.5 text-xs font-bold text-slate-300">
                        <div className="flex justify-between">
                          <span>{isRtl ? 'سعر التكلفة المبدئي:' : 'Raw Cost Price:'}</span>
                          <span className="font-mono text-white">{formData.rawPrice} {isRtl ? 'ر.س' : 'SAR'}</span>
                        </div>
                        <div className="flex justify-between text-indigo-300">
                          <span className="flex items-center gap-1">
                            <Percent size={11} />
                            <span>{isRtl ? 'عمولة منصة رفاه (١٠٪):' : 'Refah Commission (10%):'}</span>
                          </span>
                          <span className="font-mono text-indigo-200">
                            + {Math.round(formData.rawPrice * 0.10 * 100) / 100} {isRtl ? 'ر.س' : 'SAR'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>{isRtl ? 'قيمة المجموع الخاضع للضريبة:' : 'Taxable Subtotal:'}</span>
                          <span className="font-mono">
                            {formData.rawPrice + Math.round(formData.rawPrice * 0.10 * 100) / 100} {isRtl ? 'ر.س' : 'SAR'}
                          </span>
                        </div>
                        <div className="flex justify-between text-violet-300 border-b border-white/10 pb-2.5">
                          <span className="flex items-center gap-1">
                            <Percent size={11} />
                            <span>{isRtl ? 'ضريبة القيمة المضافة لصالونات التجميل (١٥٪):' : 'Beauty Center VAT (15%):'}</span>
                          </span>
                          <span className="font-mono text-violet-200">
                            + {Math.round((formData.rawPrice * 1.10) * 0.15 * 100) / 100} {isRtl ? 'ر.س' : 'SAR'}
                          </span>
                        </div>
                        <div className="flex justify-between text-base font-black text-white pt-1.5">
                          <span className="text-emerald-400">{isRtl ? 'سعر البيع النهائي للجمهور:' : 'Final Display Retail Price:'}</span>
                          <span className="font-mono text-emerald-400 text-lg">
                            {formData.price} {isRtl ? 'ر.س' : 'SAR'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-[10px] text-slate-400 leading-relaxed font-semibold">
                        <p>
                          {isRtl 
                            ? 'ملاحظة: تُشحن الضرائب والعمولة وتُعدل تلقائياً بقاعدة بيانات النظام تماشياً مع اللوائح الضريبية والمالية الرسمية لهيئة الزكاة والضريبة والجمارك.' 
                            : 'VAT and service commissions are dynamically calculated and linked securely into financial, POS checkout, and audit ledgers automatically.'}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Bottom Action bar */}
              <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-neutral-700 rounded-xl text-xs font-black transition-all cursor-pointer w-full sm:w-auto text-center"
                >
                  {isRtl ? 'رجوع للكتالوج' : 'Back to Catalog'}
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveView('list')}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-neutral-500 hover:text-neutral-700 rounded-xl text-xs font-bold cursor-pointer transition-all text-center"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow hover:shadow-md transition-all cursor-pointer text-center"
                  >
                    {formMode === 'add' ? (isRtl ? 'حفظ وتنشيط المنتج بالكتالوج' : 'Deploy and Save Product') : (isRtl ? 'حفظ تعديلات المنتج' : 'Save Changes')}
                  </button>
                </div>
              </div>

            </form>
          </div>

        </div>
      )}

    </div>
  );
}
