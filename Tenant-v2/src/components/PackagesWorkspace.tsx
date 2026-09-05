import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, Plus, ArrowLeft, Trash2, Edit, Save, X, Image as ImageIcon,
  Clock, DollarSign, GripVertical
} from 'lucide-react';
import { Language, Employee, Product } from '../types';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import { resolveServiceImageUrl } from '../lib/serviceContract';

export interface PackagesWorkspaceProps {
  lang: Language;
}

export default function PackagesWorkspace({ lang }: PackagesWorkspaceProps) {
  const isRtl = lang === 'ar';
  const { tenant } = useTenantAuth();

  const [activeView, setActiveView] = useState<'list' | 'form'>('list');
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [packages, setPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  console.log("[ENTITLEMENT TRACE] PackagesWorkspace is rendering!");

  // Form State
  const [currentPackageId, setCurrentPackageId] = useState<string | null>(null);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [toasts, setToasts] = useState<{ id: string; msgAr: string; msgEn: string; type: 'success' | 'error' }[]>([]);

  const triggerToast = (en: string, ar: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msgAr: ar, msgEn: en, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pkgRes, srvRes, empRes] = await Promise.all([
        tenantApiAdapter.getPackages(),
        tenantApiAdapter.getServices(),
        tenantApiAdapter.getEmployees()
      ]);
      setPackages((pkgRes as any).packages || []);
      setServices((srvRes as any).services || []);
      setEmployees((empRes as any).employees || []);
    } catch (err) {
      console.error('Failed to fetch package data:', err);
      triggerToast('Failed to load packages', 'فشل تحميل الباقات', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openForm = (mode: 'add' | 'edit', pkg?: any) => {
    setFormMode(mode);
    if (mode === 'edit' && pkg) {
      setCurrentPackageId(pkg.id);
      setNameEn(pkg.name_en || '');
      setNameAr(pkg.name_ar || '');
      setImagePreview(pkg.image ? resolveServiceImageUrl(pkg.image) : null);
      setImageFile(null);
      setItems(pkg.items ? pkg.items.map((i: any) => ({
        serviceId: i.serviceId,
        variantId: i.variantId || '',
        defaultStaffId: i.defaultStaffId || '',
        sequenceOrder: i.sequenceOrder
      })) : []);
    } else {
      setCurrentPackageId(null);
      setNameEn('');
      setNameAr('');
      setItems([]);
      setImageFile(null);
      setImagePreview(null);
    }
    setActiveView('form');
  };

  const closeForm = () => {
    setActiveView('list');
  };

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

  const addItem = () => {
    setItems([...items, { serviceId: '', variantId: '', defaultStaffId: '', sequenceOrder: items.length }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newItems = [...items];
      const temp = newItems[index];
      newItems[index] = newItems[index - 1];
      newItems[index - 1] = temp;
      setItems(newItems);
    } else if (direction === 'down' && index < items.length - 1) {
      const newItems = [...items];
      const temp = newItems[index];
      newItems[index] = newItems[index + 1];
      newItems[index + 1] = temp;
      setItems(newItems);
    }
  };

  const savePackage = async () => {
    if (!nameEn || !nameAr || items.length === 0) {
      triggerToast('Please fill all required fields and add at least one service.', 'يرجى تعبئة جميع الحقول المطلوبة وإضافة خدمة واحدة على الأقل.', 'error');
      return;
    }
    
    // Ensure all items have a service selected
    for (const item of items) {
      if (!item.serviceId) {
        triggerToast('Please select a service for all package items.', 'يرجى تحديد خدمة لجميع عناصر الباقة.', 'error');
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append('name_en', nameEn);
      formData.append('name_ar', nameAr);
      
      // We append items sequentially or as JSON string
      items.forEach((item, index) => {
        formData.append(`items[${index}][serviceId]`, item.serviceId);
        if (item.variantId) formData.append(`items[${index}][variantId]`, item.variantId);
        if (item.defaultStaffId) formData.append(`items[${index}][defaultStaffId]`, item.defaultStaffId);
        formData.append(`items[${index}][sequenceOrder]`, String(index));
      });

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (formMode === 'add') {
        await tenantApiAdapter.createPackage(formData);
        triggerToast('Package created successfully', 'تم إنشاء الباقة بنجاح', 'success');
      } else if (currentPackageId) {
        await tenantApiAdapter.updatePackage(currentPackageId, formData);
        triggerToast('Package updated successfully', 'تم تحديث الباقة بنجاح', 'success');
      }
      fetchData();
      closeForm();
    } catch (err) {
      console.error('Failed to save package:', err);
      triggerToast('Failed to save package', 'فشل حفظ الباقة', 'error');
    }
  };

  const deletePackage = async (id: string) => {
    if (confirm(isRtl ? 'هل أنت متأكد أنك تريد حذف هذه الباقة؟' : 'Are you sure you want to delete this package?')) {
      try {
        await tenantApiAdapter.deletePackage(id);
        triggerToast('Package deleted successfully', 'تم حذف الباقة بنجاح', 'success');
        fetchData();
      } catch (err) {
        triggerToast('Failed to delete package', 'فشل حذف الباقة', 'error');
      }
    }
  };

  // ----------------------------------------------------
  // LIST VIEW
  // ----------------------------------------------------
  if (activeView === 'list') {
    return (
      <div className="flex flex-col h-full bg-slate-50 relative">
        <div className="p-6 sm:p-10 flex-1 overflow-y-auto max-w-[1400px] mx-auto w-full">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {isRtl ? 'باقات الخدمات' : 'Service Packages'}
              </h1>
              <p className="mt-2 text-slate-500 font-medium">
                {isRtl ? 'إدارة الباقات المجمعة لعملائك.' : 'Manage bundled service packages for your customers.'}
              </p>
            </div>
            <button
              onClick={() => openForm('add')}
              className="px-6 py-3 bg-zinc-950 text-white rounded-2xl font-bold shadow-lg shadow-zinc-950/30 hover:shadow-zinc-950/40 hover:-translate-y-0.5 transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>{isRtl ? 'إضافة باقة' : 'Add Package'}</span>
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-20 text-slate-400">Loading packages...</div>
          ) : packages.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700">{isRtl ? 'لا توجد باقات بعد' : 'No packages yet'}</h3>
              <p className="text-slate-500 mt-2">{isRtl ? 'قم بإنشاء أول باقة للبدء' : 'Create your first package to get started'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map(pkg => (
                <div key={pkg.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                  <div className="h-48 bg-slate-100 relative">
                    {pkg.image ? (
                      <img src={resolveServiceImageUrl(pkg.image)} alt="thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button onClick={() => openForm('edit', pkg)} className="p-2 bg-white/90 backdrop-blur rounded-full text-slate-600 hover:text-primary transition shadow-sm">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deletePackage(pkg.id)} className="p-2 bg-white/90 backdrop-blur rounded-full text-slate-600 hover:text-red-500 transition shadow-sm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-slate-900 mb-2 truncate">
                      {isRtl ? pkg.name_ar : pkg.name_en}
                    </h3>
                    <div className="flex justify-between items-center text-sm font-medium">
                      <div className="flex items-center gap-1.5 text-primary">
                        <DollarSign className="w-4 h-4" />
                        <span>{parseFloat(pkg.totalPrice || 0).toFixed(2)} {isRtl ? 'ر.س' : 'SAR'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-4 h-4" />
                        <span>{pkg.totalDuration} {isRtl ? 'دقيقة' : 'min'}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      {pkg.items?.length || 0} {isRtl ? 'خدمات مضمنة' : 'Included Services'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // FORM VIEW
  // ----------------------------------------------------
  return (
    <div className="pb-24">
      <div className="bg-white border-b border-slate-200 px-6 py-6 flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
          <h2 className="text-xl font-bold text-slate-900">
            {formMode === 'add' 
              ? (isRtl ? 'إنشاء باقة جديدة' : 'Create New Package') 
              : (isRtl ? 'تعديل الباقة' : 'Edit Package')}
          </h2>
        </div>
        <button onClick={savePackage} className="px-6 py-2.5 bg-zinc-950 text-white rounded-xl font-bold hover:bg-zinc-900 transition shadow-sm flex items-center gap-2">
          <Save className="w-4 h-4" />
          <span>{isRtl ? 'حفظ' : 'Save'}</span>
        </button>
      </div>

      <div className="px-6 sm:px-10 max-w-5xl mx-auto space-y-8">
          
          {/* Header Info */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {isRtl ? 'معلومات الباقة' : 'Package Information'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{isRtl ? 'اسم الباقة (إنجليزي)' : 'Package Name (English)'} *</label>
                <input 
                  type="text" 
                  value={nameEn} 
                  onChange={e => setNameEn(e.target.value)} 
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary transition outline-none"
                  placeholder="e.g. Bridal Glow Package"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{isRtl ? 'اسم الباقة (عربي)' : 'Package Name (Arabic)'} *</label>
                <input 
                  type="text" 
                  value={nameAr} 
                  onChange={e => setNameAr(e.target.value)} 
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary transition outline-none"
                  placeholder="مثال: باقة إشراقة العروس"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">{isRtl ? 'صورة الباقة' : 'Package Image'}</label>
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden relative group bg-slate-50 flex-shrink-0 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <div className="text-sm text-slate-500 font-medium">
                  {isRtl ? 'اضغط أو اسحب صورة لرفعها. يُنصح بصورة مربعة.' : 'Click or drag an image to upload. Square aspect ratio recommended.'}
                </div>
              </div>
            </div>
          </div>

          {/* Items Config */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {isRtl ? 'خدمات الباقة' : 'Package Services'}
              </h3>
              <button onClick={addItem} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>{isRtl ? 'إضافة خدمة' : 'Add Service'}</span>
              </button>
            </div>

            <div className="space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-sm font-semibold text-slate-500">
                    {isRtl ? 'لم يتم إضافة أي خدمات. هذه الباقة ستكون فارغة.' : 'No services added. This package will be empty.'}
                  </p>
                </div>
              ) : (
                items.map((item, index) => {
                  const selectedService = services.find(s => s.id === item.serviceId);
                  const hasVariants = selectedService && Array.isArray(selectedService.variants) && selectedService.variants.length > 0;

                  return (
                    <div key={index} className="flex gap-4 items-start bg-slate-50 p-4 rounded-2xl border border-slate-200 group">
                      <div className="flex flex-col gap-1 mt-2 text-slate-300 opacity-50 group-hover:opacity-100 transition">
                        <button onClick={() => moveItem(index, 'up')} disabled={index === 0} className="hover:text-primary disabled:opacity-30">▲</button>
                        <button onClick={() => moveItem(index, 'down')} disabled={index === items.length - 1} className="hover:text-primary disabled:opacity-30">▼</button>
                      </div>
                      
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{isRtl ? 'الخدمة' : 'Service'}</label>
                          <select 
                            value={item.serviceId} 
                            onChange={e => {
                              const newServiceId = e.target.value;
                              updateItem(index, 'serviceId', newServiceId);

                              // Clear staff if they are not valid for the new service
                              const newService = services.find(s => s.id === newServiceId);
                              if (newService && item.defaultStaffId) {
                                const allowedStaff = newService.employees
                                  ? newService.employees.map((e: any) => String(e.id))
                                  : (newService.employeeAssignments || []).map((id: any) => String(id));
                                if (!allowedStaff.includes(String(item.defaultStaffId))) {
                                  updateItem(index, 'defaultStaffId', '');
                                }
                              }
                            }}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-900"
                          >
                            <option className="bg-white text-slate-900" value="">{isRtl ? '-- اختر خدمة --' : '-- Select Service --'}</option>
                            {services.map(s => (
                              <option className="bg-white text-slate-900" key={s.id} value={s.id}>{isRtl ? s.name_ar : s.name_en}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className={`block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider ${!hasVariants ? 'opacity-50' : ''}`}>
                            {isRtl ? 'النوع (اختياري)' : 'Variant (Optional)'}
                          </label>
                          <select 
                            value={item.variantId} 
                            onChange={e => updateItem(index, 'variantId', e.target.value)}
                            disabled={!hasVariants}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-slate-100 disabled:opacity-60 text-slate-900"
                          >
                            <option className="bg-white text-slate-900" value="">{isRtl ? '-- أساسي --' : '-- Base --'}</option>
                            {hasVariants && selectedService.variants.map((v: any) => (
                              <option className="bg-white text-slate-900" key={v.id} value={v.id}>{isRtl ? v.name_ar : v.name_en}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{isRtl ? 'الموظف الافتراضي (اختياري)' : 'Default Staff (Optional)'}</label>
                          <select 
                            value={item.defaultStaffId} 
                            onChange={e => updateItem(index, 'defaultStaffId', e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-900"
                          >
                            <option className="bg-white text-slate-900" value="">{isRtl ? '-- أي موظف --' : '-- Any Staff --'}</option>
                            {employees.filter(emp => {
                              if (!selectedService) return false;
                              const allowedStaff = selectedService.employees
                                ? selectedService.employees.map((e: any) => String(e.id))
                                : (selectedService.employeeAssignments || []).map((id: any) => String(id));
                              return allowedStaff.includes(String(emp.id));
                            }).map(emp => (
                              <option className="bg-white text-slate-900" key={emp.id} value={emp.id}>{isRtl ? (emp.nameAr || emp.name_ar || emp.name) : (emp.nameEn || emp.name_en || emp.name)}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button onClick={() => removeItem(index)} className="mt-8 p-2 text-slate-400 hover:text-red-500 bg-white rounded-xl shadow-sm border border-slate-200 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4 p-4 rounded-xl bg-primary/5 text-primary text-sm font-semibold flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>
              {isRtl 
                ? 'ملاحظة: سيتم حجز هذه الخدمات للعميل بنفس الترتيب المحدد أعلاه تباعاً (أ ب ج).' 
                : 'Note: These services will be booked for the customer in the exact sequential order defined above (A B C).'}
            </div>
          </div>
        </div>


      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm text-white flex items-center gap-3 pointer-events-auto ${toast.type === 'error' ? 'bg-red-500' : 'bg-slate-900'}`}
            >
              <span>{isRtl ? toast.msgAr : toast.msgEn}</span>
              <button onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))} className="p-1 hover:bg-white/20 rounded-full transition">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}