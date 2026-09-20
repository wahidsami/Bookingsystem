import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, X, Plus, Trash2, ArrowUp, ArrowDown, Clock, DollarSign,
  Sparkles, Layers, Image as ImageIcon, Check, Search, Filter,
  AlertCircle, ChevronRight, CheckSquare, Square, Eye, Users, Percent
} from 'lucide-react';
import { Language } from '../../types';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import { resolveServiceImageUrl, type ServiceRecord } from '../../lib/serviceContract';
import { TenantCategoryOption, UnifiedBundleItem } from '../Services2Workspace';

export interface BundleBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  serviceCategories: TenantCategoryOption[];
  services: ServiceRecord[];
  bundleToEdit?: UnifiedBundleItem | null;
  onSaved: (savedBundle: any) => void;
}

export interface SelectedBundleServiceItem {
  uid: string; // unique local ID for React list key (enables duplicate services)
  serviceId: string;
  service: ServiceRecord;
  variantId?: string | null;
  sequenceOrder: number;
}

export default function BundleBuilderModal({
  isOpen,
  onClose,
  lang,
  serviceCategories,
  services,
  bundleToEdit,
  onSaved
}: BundleBuilderModalProps) {
  const isRtl = lang === 'ar';
  const isEdit = Boolean(bundleToEdit);

  // Form State
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [tenantServiceCategoryId, setTenantServiceCategoryId] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'sequence' | 'parallel'>('sequence');
  const [pricingType, setPricingType] = useState<'service' | 'custom' | 'discount' | 'free'>('service');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('15');
  const [allowOnlineBooking, setAllowOnlineBooking] = useState<boolean>(true);
  const [targetGender, setTargetGender] = useState<'all' | 'female' | 'male'>('all');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Included Services
  const [selectedItems, setSelectedItems] = useState<SelectedBundleServiceItem[]>([]);

  // Multi-select service picker modal
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<string>('all');
  const [pickerCheckedIds, setPickerCheckedIds] = useState<string[]>([]);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form when modal opens or bundleToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (bundleToEdit) {
      setNameAr(bundleToEdit.nameAr || '');
      setNameEn(bundleToEdit.nameEn || '');
      setDescriptionAr(bundleToEdit.descriptionAr || '');
      setDescriptionEn(bundleToEdit.descriptionEn || '');
      setTenantServiceCategoryId(bundleToEdit.tenantServiceCategoryId || '');
      setScheduleType((bundleToEdit.rawRecord?.scheduleType as any) || 'sequence');
      setPricingType((bundleToEdit.rawRecord?.pricingType as any) || 'service');
      setCustomPrice(bundleToEdit.rawRecord?.customPrice !== null && bundleToEdit.rawRecord?.customPrice !== undefined ? String(bundleToEdit.rawRecord.customPrice) : '');
      setDiscountPercentage(bundleToEdit.rawRecord?.discountPercentage !== null && bundleToEdit.rawRecord?.discountPercentage !== undefined ? String(bundleToEdit.rawRecord.discountPercentage) : '15');
      setAllowOnlineBooking(bundleToEdit.allowOnlineBooking !== false);
      setTargetGender(bundleToEdit.targetGender || 'all');
      setImageFile(null);
      setImagePreview(bundleToEdit.image ? resolveServiceImageUrl(bundleToEdit.image) : null);

      // Populate items
      const rawItems = Array.isArray(bundleToEdit.items) ? bundleToEdit.items : [];
      const mapped: SelectedBundleServiceItem[] = rawItems.map((it: any, idx: number) => {
        const foundSrv = services.find(s => s.id === it.serviceId) || it.service || {
          id: it.serviceId,
          nameEn: it.service?.name_en || it.service?.nameEn || 'Service',
          nameAr: it.service?.name_ar || it.service?.nameAr || 'خدمة',
          duration: it.service?.duration || 30,
          price: parseFloat(it.service?.finalPrice || it.service?.price || 0)
        };
        return {
          uid: `${it.serviceId}-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          serviceId: it.serviceId,
          service: foundSrv,
          variantId: it.variantId || null,
          sequenceOrder: it.sequenceOrder !== undefined ? it.sequenceOrder : idx
        };
      });
      setSelectedItems(mapped);
    } else {
      // Default new bundle
      setNameAr('');
      setNameEn('');
      setDescriptionAr('');
      setDescriptionEn('');
      setTenantServiceCategoryId(serviceCategories[0]?.id || '');
      setScheduleType('sequence');
      setPricingType('service');
      setCustomPrice('');
      setDiscountPercentage('15');
      setAllowOnlineBooking(true);
      setTargetGender('all');
      setImageFile(null);
      setImagePreview(null);
      setSelectedItems([]);
    }
    setErrors({});
    setIsPickerOpen(false);
  }, [isOpen, bundleToEdit, serviceCategories, services]);

  // Derived Calculations
  const baseServiceSum = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const price = parseFloat(String(item.service?.finalPrice ?? item.service?.price ?? 0));
      return sum + (isNaN(price) ? 0 : price);
    }, 0);
  }, [selectedItems]);

  const totalDurationMinutes = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const dur = parseInt(String(item.service?.duration ?? 0), 10);
      return sum + (isNaN(dur) ? 0 : dur);
    }, 0);
  }, [selectedItems]);

  const effectiveFinalPrice = useMemo(() => {
    if (pricingType === 'custom') {
      const val = parseFloat(customPrice);
      return isNaN(val) ? 0 : Math.max(0, val);
    }
    if (pricingType === 'discount') {
      const pct = parseFloat(discountPercentage);
      const validPct = isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
      return Math.max(0, Math.round(baseServiceSum * (1 - validPct / 100) * 100) / 100);
    }
    if (pricingType === 'free') {
      return 0;
    }
    // 'service' sum
    return Math.round(baseServiceSum * 100) / 100;
  }, [pricingType, baseServiceSum, customPrice, discountPercentage]);

  // Image Upload handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Reordering selected services
  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const next = [...selectedItems];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      next.forEach((item, idx) => { item.sequenceOrder = idx; });
      setSelectedItems(next);
    } else if (direction === 'down' && index < selectedItems.length - 1) {
      const next = [...selectedItems];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      next.forEach((item, idx) => { item.sequenceOrder = idx; });
      setSelectedItems(next);
    }
  };

  const removeItem = (index: number) => {
    const next = selectedItems.filter((_, idx) => idx !== index);
    next.forEach((item, idx) => { item.sequenceOrder = idx; });
    setSelectedItems(next);
  };

  // Multi-Select Service Picker Handlers
  const handleOpenPicker = () => {
    setPickerCheckedIds([]);
    setPickerSearch('');
    setPickerCategory('all');
    setIsPickerOpen(true);
  };

  const handleTogglePickerService = (srvId: string) => {
    setPickerCheckedIds(prev =>
      prev.includes(srvId) ? prev.filter(id => id !== srvId) : [...prev, srvId]
    );
  };

  const handleConfirmAddSelectedServices = () => {
    if (pickerCheckedIds.length === 0) {
      setIsPickerOpen(false);
      return;
    }

    const newItems: SelectedBundleServiceItem[] = pickerCheckedIds.map((id, offset) => {
      const srv = services.find(s => s.id === id)!;
      return {
        uid: `${id}-${Date.now()}-${offset}-${Math.random().toString(36).substr(2, 5)}`,
        serviceId: id,
        service: srv,
        sequenceOrder: selectedItems.length + offset
      };
    });

    setSelectedItems(prev => [...prev, ...newItems]);
    setIsPickerOpen(false);
    setPickerCheckedIds([]);
  };

  // Filter available services for picker
  const filteredPickerServices = useMemo(() => {
    return services.filter(srv => {
      const query = pickerSearch.toLowerCase().trim();
      const matchSearch = !query ||
        (srv.nameAr && srv.nameAr.toLowerCase().includes(query)) ||
        (srv.nameEn && srv.nameEn.toLowerCase().includes(query)) ||
        (srv.descriptionAr && srv.descriptionAr.toLowerCase().includes(query)) ||
        (srv.descriptionEn && srv.descriptionEn.toLowerCase().includes(query));

      const matchCat = pickerCategory === 'all' ||
        (srv as any).tenantServiceCategoryId === pickerCategory ||
        (srv as any).categoryId === pickerCategory ||
        srv.category === pickerCategory;

      return matchSearch && matchCat;
    });
  }, [services, pickerSearch, pickerCategory]);

  // Form Validation & Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!nameAr.trim()) {
      nextErrors.nameAr = isRtl ? 'اسم الباقة بالعربية مطلوب' : 'Arabic bundle name is required';
    }
    if (!nameEn.trim()) {
      nextErrors.nameEn = isRtl ? 'اسم الباقة بالإنجليزية مطلوب' : 'English bundle name is required';
    }
    if (selectedItems.length === 0) {
      nextErrors.services = isRtl ? 'يرجى إضافة خدمة واحدة على الأقل للباقة' : 'Please include at least one service in the bundle';
    }
    if (pricingType === 'custom') {
      const priceVal = parseFloat(customPrice);
      if (isNaN(priceVal) || priceVal < 0) {
        nextErrors.customPrice = isRtl ? 'يرجى إدخال سعر مخصص صحيح' : 'Please provide a valid custom price';
      }
    }
    if (pricingType === 'discount') {
      const discountVal = parseFloat(discountPercentage);
      if (isNaN(discountVal) || discountVal < 0 || discountVal > 100) {
        nextErrors.discountPercentage = isRtl ? 'نسبة الخصم يجب أن تكون بين 0 و 100' : 'Discount percentage must be between 0 and 100';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const itemsPayload = selectedItems.map((item, idx) => ({
        serviceId: item.serviceId,
        variantId: item.variantId || null,
        sequenceOrder: idx
      }));

      const formData = new FormData();
      formData.append('name_en', nameEn.trim());
      formData.append('name_ar', nameAr.trim());
      if (descriptionEn.trim()) formData.append('description_en', descriptionEn.trim());
      if (descriptionAr.trim()) formData.append('description_ar', descriptionAr.trim());
      if (tenantServiceCategoryId) formData.append('tenantServiceCategoryId', tenantServiceCategoryId);
      formData.append('scheduleType', scheduleType);
      formData.append('pricingType', pricingType);
      if (pricingType === 'custom') formData.append('customPrice', customPrice);
      if (pricingType === 'discount') formData.append('discountPercentage', discountPercentage);
      formData.append('allowOnlineBooking', String(allowOnlineBooking));
      formData.append('targetGender', targetGender);
      formData.append('items', JSON.stringify(itemsPayload));

      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imagePreview === null && bundleToEdit?.image) {
        // Explicitly cleared existing image
        formData.append('image', '');
      }

      let res: any;
      if (isEdit && bundleToEdit?.id) {
        res = await tenantApiAdapter.updateServices2Bundle(bundleToEdit.id, formData);
      } else {
        res = await tenantApiAdapter.createServices2Bundle(formData);
      }

      if (res && res.success && res.bundle) {
        onSaved(res.bundle);
        onClose();
      } else {
        throw new Error(res?.message || 'Failed to save bundle');
      }
    } catch (err: any) {
      console.error('Error saving Services 2 bundle:', err);
      setErrors({ form: err.message || (isRtl ? 'حدث خطأ أثناء حفظ الباقة' : 'Failed to save bundle') });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-3xl max-w-4xl w-full my-auto shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {isEdit
                  ? (isRtl ? `تعديل الباقة: ${bundleToEdit?.nameAr || bundleToEdit?.nameEn}` : `Edit Bundle: ${bundleToEdit?.nameEn || bundleToEdit?.nameAr}`)
                  : (isRtl ? 'إنشاء باقة خدمات جديدة' : 'Create New Service Bundle')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isRtl ? 'باقة مجمعة من عدة خدمات تحت فئة موحدة وقواعد تسعير مرنة' : 'Package multiple salon services with custom pricing and sequencing'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL SCROLLABLE BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          {errors.form && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-3">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* SECTION 1: BASIC DETAILS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 pb-2 border-b border-slate-100">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">1</span>
              <span>{isRtl ? 'البيانات الأساسية للباقة' : 'Basic Bundle Information'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name AR */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? 'اسم الباقة (بالعربية) *' : 'Bundle Name (Arabic) *'}
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={e => setNameAr(e.target.value)}
                  placeholder={isRtl ? 'مثال: باقة العروس الملكية' : 'e.g. باقة العناية الشاملة'}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold transition focus:ring-2 focus:ring-purple-500/20 focus:outline-none ${
                    errors.nameAr ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 focus:border-purple-500'
                  }`}
                  dir="rtl"
                />
                {errors.nameAr && <span className="text-[11px] text-rose-500 font-bold mt-1 block">{errors.nameAr}</span>}
              </div>

              {/* Name EN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? 'اسم الباقة (بالإنجليزية) *' : 'Bundle Name (English) *'}
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value)}
                  placeholder="e.g. Royal Bridal Experience"
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold transition focus:ring-2 focus:ring-purple-500/20 focus:outline-none ${
                    errors.nameEn ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 focus:border-purple-500'
                  }`}
                  dir="ltr"
                />
                {errors.nameEn && <span className="text-[11px] text-rose-500 font-bold mt-1 block">{errors.nameEn}</span>}
              </div>

              {/* Tenant Category Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? 'فئة الخدمات التابعة لها *' : 'Tenant Service Category *'}
                </label>
                <select
                  value={tenantServiceCategoryId}
                  onChange={e => setTenantServiceCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition bg-white"
                >
                  <option value="">{isRtl ? '— بدون فئة (غير مصنف) —' : '— Uncategorized —'}</option>
                  {serviceCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {isRtl ? (cat.labelAr || cat.labelEn) : (cat.labelEn || cat.labelAr)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Audience Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? 'الجمهور المستهدف' : 'Target Audience Gender'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'female', 'male'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setTargetGender(g)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        targetGender === g
                          ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Users size={13} />
                      <span>
                        {g === 'all' ? (isRtl ? 'الجميع' : 'All') : g === 'female' ? (isRtl ? 'سيدات' : 'Female') : (isRtl ? 'رجال' : 'Male')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? 'الوصف بالعربية' : 'Description (Arabic)'}
                </label>
                <textarea
                  rows={2}
                  value={descriptionAr}
                  onChange={e => setDescriptionAr(e.target.value)}
                  placeholder={isRtl ? 'نبذة توضيحية عن الخدمات والفوائد التي يحصل عليها العميل...' : 'Arabic description...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition resize-none"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? 'الوصف بالإنجليزية' : 'Description (English)'}
                </label>
                <textarea
                  rows={2}
                  value={descriptionEn}
                  onChange={e => setDescriptionEn(e.target.value)}
                  placeholder="Comprehensive bundle description and perks..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition resize-none"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isRtl ? 'غلاف الباقة' : 'Bundle Thumbnail Image'}
              </label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-purple-200 shadow-xs group">
                    <img
                      src={imagePreview}
                      alt="Bundle preview"
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImagePreview(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon size={20} />
                    <span className="text-[9px] font-bold mt-1">{isRtl ? 'بدون صورة' : 'No image'}</span>
                  </div>
                )}
                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">
                    <ImageIcon size={14} />
                    <span>{isRtl ? 'اختيار صورة...' : 'Upload Image...'}</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isRtl ? 'صيغ PNG أو JPG بحجم أقصى 5 ميجابايت' : 'PNG or JPG up to 5MB'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: SERVICES & SEQUENCING */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">2</span>
                <span>{isRtl ? 'الخدمات المضمنة في الباقة' : 'Included Services & Order'}</span>
                <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-bold">
                  {selectedItems.length} {isRtl ? 'خدمات' : 'services'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenPicker}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>{isRtl ? 'إضافة خدمات' : 'Add Services'}</span>
              </button>
            </div>

            {errors.services && (
              <span className="text-xs text-rose-500 font-bold block">{errors.services}</span>
            )}

            {/* Selected items list */}
            {selectedItems.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-2 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
                  <Layers size={22} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  {isRtl ? 'لم يتم اختيار خدمات بعد' : 'No services included yet'}
                </h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  {isRtl
                    ? 'انقر على "إضافة خدمات" لفتح نافذة الاختيار المتعدد وتحديد الخدمات المكونة للباقة.'
                    : 'Click "Add Services" to open the multi-select popup and select the services for this bundle.'}
                </p>
                <button
                  type="button"
                  onClick={handleOpenPicker}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>{isRtl ? 'اختيار الخدمات الآن' : 'Choose Services Now'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedItems.map((item, index) => {
                  const srvName = isRtl
                    ? (item.service?.nameAr || item.service?.nameEn || 'خدمة')
                    : (item.service?.nameEn || item.service?.nameAr || 'Service');
                  const srvPrice = parseFloat(String(item.service?.finalPrice ?? item.service?.price ?? 0));
                  const srvDur = item.service?.duration || 30;

                  return (
                    <div
                      key={item.uid}
                      className="p-3 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-500 text-[11px] font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-800 truncate">{srvName}</h4>
                          <div className="flex items-center gap-2.5 text-[10px] text-slate-500 font-bold mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock size={11} className="text-purple-600" />
                              {srvDur} {isRtl ? 'د' : 'mins'}
                            </span>
                            <span>•</span>
                            <span className="text-slate-700 font-mono">
                              {srvPrice.toFixed(2)} SAR
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Up button */}
                        <button
                          type="button"
                          onClick={() => moveItem(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                          title={isRtl ? 'تقديم في الترتيب' : 'Move up'}
                        >
                          <ArrowUp size={14} />
                        </button>
                        {/* Down button */}
                        <button
                          type="button"
                          onClick={() => moveItem(index, 'down')}
                          disabled={index === selectedItems.length - 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                          title={isRtl ? 'تأخير في الترتيب' : 'Move down'}
                        >
                          <ArrowDown size={14} />
                        </button>
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                          title={isRtl ? 'إزالة من الباقة' : 'Remove from bundle'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: SCHEDULE TYPE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 pb-2 border-b border-slate-100">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">3</span>
              <span>{isRtl ? 'طريقة الجدولة في الحجوزات' : 'Booking Schedule Execution'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setScheduleType('sequence')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                  scheduleType === 'sequence'
                    ? 'border-purple-600 bg-purple-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`mt-0.5 p-2 rounded-xl ${scheduleType === 'sequence' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    {isRtl ? 'حجز متتالي (على التوالي)' : 'Booked in sequence'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {isRtl
                      ? 'تنفذ الخدمات واحدة تلو الأخرى بالترتيب المحدد أعلاه (مثلاً 10:00 - 11:00 ثم 11:00 - 12:00).'
                      : 'Services take place one after another in the exact sequence specified above.'}
                  </p>
                </div>
              </div>

              <div
                onClick={() => setScheduleType('parallel')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                  scheduleType === 'parallel'
                    ? 'border-purple-600 bg-purple-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`mt-0.5 p-2 rounded-xl ${scheduleType === 'parallel' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Layers size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    {isRtl ? 'حجز متزامن (بالتوازي)' : 'Booked in parallel'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {isRtl
                      ? 'تنفذ الخدمات في نفس الوقت مع عدة أخصائيين (مثلاً عناية شعر وعناية أظافر في نفس الساعة).'
                      : 'Services take place at the same time with multiple specialists.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: FRESHA-INSPIRED PRICING MODEL */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">4</span>
                <span>{isRtl ? 'نموذج تسعير الباقة' : 'Bundle Pricing Model'}</span>
              </div>
              <div className="text-xs font-bold text-slate-500">
                {isRtl ? 'مجموع أسعار الخدمات:' : 'Original services sum:'}{' '}
                <span className="font-mono text-slate-800">{baseServiceSum.toFixed(2)} SAR</span>
              </div>
            </div>

            {/* 4 Pricing Modes Segmented Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'service', labelAr: 'مجموع الخدمات', labelEn: 'Service pricing', icon: DollarSign },
                { id: 'custom', labelAr: 'سعر مخصص', labelEn: 'Custom pricing', icon: Sparkles },
                { id: 'discount', labelAr: 'نسبة خصم %', labelEn: 'Percentage discount', icon: Percent },
                { id: 'free', labelAr: 'مجانية', labelEn: 'Free', icon: Check }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPricingType(opt.id as any)}
                  className={`p-3 rounded-2xl border text-xs font-black transition cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center ${
                    pricingType === opt.id
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <opt.icon size={16} />
                  <span>{isRtl ? opt.labelAr : opt.labelEn}</span>
                </button>
              ))}
            </div>

            {/* Conditional input controls based on pricingType */}
            <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-3">
              {pricingType === 'service' && (
                <p className="text-xs text-purple-950 font-bold leading-relaxed">
                  {isRtl
                    ? `يتم احتساب سعر الباقة تلقائياً كمجموع أسعار الخدمات المكونة لها (${baseServiceSum.toFixed(2)} ر.س).`
                    : `Bundle price is automatically calculated from the combined sum of included services (${baseServiceSum.toFixed(2)} SAR).`}
                </p>
              )}

              {pricingType === 'custom' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    {isRtl ? 'أدخل السعر الإجمالي الثابت للباقة (ر.س) *' : 'Enter Fixed Bundle Price (SAR) *'}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)}
                      placeholder={baseServiceSum ? String(baseServiceSum * 0.85) : '150'}
                      className="w-48 px-4 py-2 bg-white rounded-xl border border-purple-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-xs text-purple-700 font-bold">SAR</span>
                    {baseServiceSum > 0 && parseFloat(customPrice) > 0 && (
                      <span className="text-xs font-bold text-emerald-600">
                        {isRtl ? 'وفر العميل:' : 'Customer saves:'}{' '}
                        {Math.max(0, baseServiceSum - parseFloat(customPrice)).toFixed(2)} SAR
                      </span>
                    )}
                  </div>
                  {errors.customPrice && (
                    <span className="text-xs text-rose-500 font-bold block">{errors.customPrice}</span>
                  )}
                </div>
              )}

              {pricingType === 'discount' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    {isRtl ? 'أدخل نسبة الخصم المطبقة على مجموع الخدمات (%) *' : 'Discount percentage on combined services value (%) *'}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={discountPercentage}
                      onChange={e => setDiscountPercentage(e.target.value)}
                      placeholder="15"
                      className="w-32 px-4 py-2 bg-white rounded-xl border border-purple-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-xs text-purple-700 font-bold">%</span>
                    <span className="text-xs text-slate-600 font-medium">
                      {isRtl ? 'السعر الأصلي:' : 'Original:'}{' '}
                      <span className="line-through">{baseServiceSum.toFixed(2)} SAR</span>
                      {' → '}
                      <span className="font-bold text-purple-700">{effectiveFinalPrice.toFixed(2)} SAR</span>
                    </span>
                  </div>
                  {errors.discountPercentage && (
                    <span className="text-xs text-rose-500 font-bold block">{errors.discountPercentage}</span>
                  )}
                </div>
              )}

              {pricingType === 'free' && (
                <p className="text-xs text-emerald-700 font-bold leading-relaxed">
                  {isRtl
                    ? 'هذه الباقة مجانية بالكامل للعميل (0.00 ر.س). مفيدة للعروض الترويجية أو باقات الولاء.'
                    : 'This bundle is completely free (0.00 SAR). Suitable for promotional giveaways or loyalty rewards.'}
                </p>
              )}
            </div>
          </div>

          {/* SECTION 5: ONLINE BOOKING TOGGLE */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-black text-slate-900">
                {isRtl ? 'إتاحة الحجز أونلاين عبر التطبيق والموقع' : 'Enable Online Booking Visibility'}
              </h4>
              <p className="text-[11px] text-slate-500">
                {isRtl
                  ? 'عند التفعيل، يمكن للعملاء رؤية الباقة وحجزها مباشرة عبر الإنترنت'
                  : 'When enabled, customers can discover and book this bundle online'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowOnlineBooking(!allowOnlineBooking)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                allowOnlineBooking ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  allowOnlineBooking ? (isRtl ? '-translate-x-6' : 'translate-x-6') : (isRtl ? '-translate-x-0.5' : 'translate-x-0.5')
                }`}
              />
            </button>
          </div>
        </form>

        {/* MODAL FOOTER BAR */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-xs">
              <span className="text-slate-400 font-medium block">{isRtl ? 'المدة الإجمالية' : 'Total Duration'}</span>
              <span className="font-bold text-slate-800">{totalDurationMinutes} {isRtl ? 'دقيقة' : 'mins'}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-xs">
              <span className="text-slate-400 font-medium block">{isRtl ? 'السعر النهائي' : 'Effective Price'}</span>
              <span className="text-sm font-black text-purple-700 font-mono">{effectiveFinalPrice.toFixed(2)} SAR</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isEdit ? (isRtl ? 'حفظ التعديلات' : 'Save Changes') : (isRtl ? 'إنشاء الباقة' : 'Create Bundle')}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* MULTI-SELECT SERVICE PICKER POPUP */}
      <AnimatePresence>
        {isPickerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {isRtl ? 'اختيار الخدمات للباقة (تحديد متعدد)' : 'Select Services for Bundle (Multi-Select)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isRtl ? 'حدد كل الخدمات المراد إضافتها دفعة واحدة' : 'Check all services you want to include in one batch'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Picker Search and Category Filter */}
              <div className="py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute top-3 left-3 text-slate-400" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder={isRtl ? 'بحث في الخدمات...' : 'Search services...'}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
                <div>
                  <select
                    value={pickerCategory}
                    onChange={e => setPickerCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  >
                    <option value="all">{isRtl ? 'كل الفئات' : 'All Categories'}</option>
                    {serviceCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {isRtl ? (cat.labelAr || cat.labelEn) : (cat.labelEn || cat.labelAr)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Service list */}
              <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
                {filteredPickerServices.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-medium">
                    {isRtl ? 'لا توجد خدمات مطابقة' : 'No matching services found'}
                  </div>
                ) : (
                  filteredPickerServices.map(srv => {
                    const isChecked = pickerCheckedIds.includes(srv.id);
                    const srvName = isRtl ? (srv.nameAr || srv.nameEn) : (srv.nameEn || srv.nameAr);
                    const srvPrice = parseFloat(String(srv.finalPrice ?? srv.price ?? 0));

                    return (
                      <div
                        key={srv.id}
                        onClick={() => handleTogglePickerService(srv.id)}
                        className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'bg-purple-50/60 border-purple-400 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                            isChecked ? 'bg-purple-600 text-white' : 'border border-slate-300 bg-white'
                          }`}>
                            {isChecked && <Check size={13} />}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800">{srvName}</h4>
                            <span className="text-[10px] text-slate-500 font-bold">
                              {srv.duration} {isRtl ? 'دقيقة' : 'mins'}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-xs text-slate-900">
                          {srvPrice.toFixed(2)} SAR
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Picker Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-purple-700">
                  {isRtl
                    ? `تم تحديد (${pickerCheckedIds.length}) خدمات`
                    : `Selected (${pickerCheckedIds.length}) services`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddSelectedServices}
                    disabled={pickerCheckedIds.length === 0}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer disabled:opacity-40"
                  >
                    {isRtl ? `إضافة المحددة (${pickerCheckedIds.length})` : `Add Selected (${pickerCheckedIds.length})`}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
