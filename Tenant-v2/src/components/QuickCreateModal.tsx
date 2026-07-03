import React, { useState, useEffect } from 'react';
import { X, Check, Sparkles, Calendar, Users, Briefcase, Package, UserCheck, Gift } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';
import { mockEmployees, mockServices } from '../data/mockData';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  defaultType?: 'appointment' | 'customer' | 'service' | 'product' | 'employee' | 'giftcard';
  onSuccess: (messageAr: string, messageEn: string) => void;
}

export default function QuickCreateModal({
  isOpen,
  onClose,
  lang,
  defaultType = 'appointment',
  onSuccess,
}: QuickCreateModalProps) {
  const t = translations[lang];
  const [activeType, setActiveType] = useState<
    'appointment' | 'customer' | 'service' | 'product' | 'employee' | 'giftcard'
  >(defaultType);

  useEffect(() => {
    if (isOpen) {
      setActiveType(defaultType);
    }
  }, [isOpen, defaultType]);

  // Form states
  const [appointmentForm, setAppointmentForm] = useState({
    customerName: '',
    customerPhone: '',
    serviceId: '',
    employeeId: '',
    date: '2026-06-27',
    time: '14:30',
  });

  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    vip: false,
  });

  const [serviceForm, setServiceForm] = useState({
    nameAr: '',
    nameEn: '',
    duration: '60',
    price: '',
    category: 'hair',
  });

  const [productForm, setProductForm] = useState({
    nameAr: '',
    nameEn: '',
    sku: 'REF-PRD-' + Math.floor(100 + Math.random() * 900),
    price: '',
    stock: '20',
  });

  const [employeeForm, setEmployeeForm] = useState({
    nameAr: '',
    nameEn: '',
    roleAr: '',
    roleEn: '',
    status: 'active',
  });

  const [giftcardForm, setGiftcardForm] = useState({
    sender: '',
    recipient: '',
    amount: '500',
    code: 'REF-GFT-' + Math.floor(1000 + Math.random() * 9000) + '-SA',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construct nice dynamic success messages
    let msgAr = '';
    let msgEn = '';

    if (activeType === 'appointment') {
      msgAr = `تم تأكيد موعد جديد للعميل ${appointmentForm.customerName || 'مجهول'} بنجاح!`;
      msgEn = `New appointment for ${appointmentForm.customerName || 'Guest'} confirmed successfully!`;
    } else if (activeType === 'customer') {
      msgAr = `تم تسجيل العميل ${customerForm.name || 'الجديد'} في قاعدة البيانات الفاخرة لـ رفاه.`;
      msgEn = `Customer ${customerForm.name || 'New'} registered in REFAH registry.`;
    } else if (activeType === 'service') {
      msgAr = `تمت إضافة خدمة "${serviceForm.nameAr || serviceForm.nameEn}" بقيمة ${serviceForm.price} ر.س.`;
      msgEn = `Added service "${serviceForm.nameEn || serviceForm.nameAr}" for ${serviceForm.price} SAR.`;
    } else if (activeType === 'product') {
      msgAr = `تم إدراج منتج جديد بالمخزون: "${productForm.nameAr || productForm.nameEn}".`;
      msgEn = `Added new product to inventory: "${productForm.nameEn || productForm.nameAr}".`;
    } else if (activeType === 'employee') {
      msgAr = `تم تعيين الموظف الجديد: "${employeeForm.nameAr || employeeForm.nameEn}" كأخصائي محترف.`;
      msgEn = `Assigned new employee: "${employeeForm.nameEn || employeeForm.nameAr}" as a specialist.`;
    } else if (activeType === 'giftcard') {
      msgAr = `تم إصدار بطاقة هدايا بقيمة ${giftcardForm.amount} ر.س برمز الحماية: ${giftcardForm.code}.`;
      msgEn = `Issued gift card of ${giftcardForm.amount} SAR with code: ${giftcardForm.code}.`;
    }

    onSuccess(msgAr, msgEn);
    onClose();

    // Reset forms
    setAppointmentForm({ customerName: '', customerPhone: '', serviceId: '', employeeId: '', date: '2026-06-27', time: '14:30' });
    setCustomerForm({ name: '', phone: '', email: '', vip: false });
    setServiceForm({ nameAr: '', nameEn: '', duration: '60', price: '', category: 'hair' });
    setProductForm({ nameAr: '', nameEn: '', sku: 'REF-PRD-' + Math.floor(100 + Math.random() * 900), price: '', stock: '20' });
    setEmployeeForm({ nameAr: '', nameEn: '', roleAr: '', roleEn: '', status: 'active' });
    setGiftcardForm({ sender: '', recipient: '', amount: '500', code: 'REF-GFT-' + Math.floor(1000 + Math.random() * 9000) + '-SA' });
  };

  const typesConfig = [
    { id: 'appointment', labelAr: 'موعد جديد', labelEn: 'New Appointment', icon: Calendar, color: 'text-brand-600 bg-brand-50 border-brand-200' },
    { id: 'customer', labelAr: 'إضافة عميل', labelEn: 'New Customer', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'service', labelAr: 'إضافة خدمة', labelEn: 'New Service', icon: Sparkles, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'product', labelAr: 'إضافة منتج', labelEn: 'New Product', icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'employee', labelAr: 'تعيين موظف', labelEn: 'New Employee', icon: UserCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'giftcard', labelAr: 'بطاقة هدايا', labelEn: 'New Gift Card', icon: Gift, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
      />

      {/* Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left Side: Type Selector (or Right Side in RTL) */}
        <div className="w-full md:w-56 bg-neutral-50/80 p-5 border-b md:border-b-0 md:border-e border-neutral-100 shrink-0">
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-4">
            {lang === 'ar' ? 'نوع الإجراء السريع' : 'QUICK ACTION TYPE'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
            {typesConfig.map((item) => {
              const Icon = item.icon;
              const isSelected = activeType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveType(item.id as any)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all text-start border ${
                    isSelected
                      ? 'bg-white text-brand-950 border-neutral-200/80 shadow-sm font-bold scale-[1.02]'
                      : 'bg-transparent text-neutral-500 hover:text-neutral-800 border-transparent hover:bg-neutral-100/60'
                  }`}
                >
                  <span className={`p-1.5 rounded-lg shrink-0 ${isSelected ? item.color : 'bg-neutral-200/50 text-neutral-500'}`}>
                    <Icon size={14} />
                  </span>
                  <span className="truncate">{lang === 'ar' ? item.labelAr : item.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Dynamic Form */}
        <div className="flex-1 p-6 md:p-8 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg md:text-xl font-extrabold text-neutral-900 tracking-wide font-sans">
                {lang === 'ar' 
                  ? typesConfig.find(t => t.id === activeType)?.labelAr 
                  : typesConfig.find(t => t.id === activeType)?.labelEn}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                {lang === 'ar' 
                  ? 'يرجى تعبئة الحقول المطلوبة لتسجيل العملية السريعة.' 
                  : 'Fill out the mandatory fields to register the quick action.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 flex-1">
            
            {/* New Appointment Form */}
            {activeType === 'appointment' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم العميل' : 'Customer Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      placeholder={lang === 'ar' ? 'مثال: سارة محمد' : 'e.g. Sarah Mohamed'}
                      value={appointmentForm.customerName}
                      onChange={e => setAppointmentForm({ ...appointmentForm, customerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'رقم الجوال السعودي' : 'Saudi Mobile Number'} *
                    </label>
                    <input
                      type="tel"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-start font-mono transition-all"
                      placeholder="+966 5x xxx xxxx"
                      value={appointmentForm.customerPhone}
                      onChange={e => setAppointmentForm({ ...appointmentForm, customerPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'الخدمة الفاخرة المطلوبة' : 'Requested Premium Service'} *
                    </label>
                    <select
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white transition-all"
                      value={appointmentForm.serviceId}
                      onChange={e => setAppointmentForm({ ...appointmentForm, serviceId: e.target.value })}
                    >
                      <option value="">{lang === 'ar' ? '-- اختر الخدمة --' : '-- Choose Service --'}</option>
                      {mockServices.map(srv => (
                        <option key={srv.id} value={srv.id}>
                          {lang === 'ar' ? srv.nameAr : srv.nameEn} ({srv.price} {lang === 'ar' ? 'ر.س' : 'SAR'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'الأخصائي المعالج' : 'Assigned Specialist'} *
                    </label>
                    <select
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white transition-all"
                      value={appointmentForm.employeeId}
                      onChange={e => setAppointmentForm({ ...appointmentForm, employeeId: e.target.value })}
                    >
                      <option value="">{lang === 'ar' ? '-- اختر المعالج --' : '-- Choose Specialist --'}</option>
                      {mockEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {lang === 'ar' ? emp.nameAr : emp.nameEn} ({lang === 'ar' ? emp.roleAr : emp.roleEn})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'التاريخ' : 'Date'} *
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono transition-all"
                      value={appointmentForm.date}
                      onChange={e => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'الوقت' : 'Time'} *
                    </label>
                    <input
                      type="time"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono transition-all"
                      value={appointmentForm.time}
                      onChange={e => setAppointmentForm({ ...appointmentForm, time: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* New Customer Form */}
            {activeType === 'customer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    {lang === 'ar' ? 'اسم العميل بالكامل' : 'Full Customer Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    placeholder={lang === 'ar' ? 'مثال: نورة عبد العزيز السديري' : 'e.g. Noura Abdulaziz Al-Sudairi'}
                    value={customerForm.name}
                    onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'} *
                    </label>
                    <input
                      type="tel"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-start font-mono transition-all"
                      placeholder="+966 5x xxx xxxx"
                      value={customerForm.phone}
                      onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-start font-mono transition-all"
                      placeholder="name@domain.sa"
                      value={customerForm.email}
                      onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="vip-customer"
                    className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 w-4 h-4 accent-brand-600"
                    checked={customerForm.vip}
                    onChange={e => setCustomerForm({ ...customerForm, vip: e.target.checked })}
                  />
                  <label htmlFor="vip-customer" className="text-xs font-bold text-brand-900 cursor-pointer select-none">
                    {lang === 'ar' ? 'تصنيف كعميل كبار شخصيات VIP فئة ماسية' : 'Classify as VIP Diamond Elite customer'}
                  </label>
                </div>
              </div>
            )}

            {/* New Service Form */}
            {activeType === 'service' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم الخدمة بالعربية' : 'Service Name (Arabic)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      placeholder="مثال: جلسة مساج ريفلكسولوجي فاخرة"
                      value={serviceForm.nameAr}
                      onChange={e => setServiceForm({ ...serviceForm, nameAr: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم الخدمة بالإنجليزية' : 'Service Name (English)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-start transition-all"
                      placeholder="e.g. Premium Reflexology Treatment"
                      value={serviceForm.nameEn}
                      onChange={e => setServiceForm({ ...serviceForm, nameEn: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'مدة الخدمة (دقائق)' : 'Duration (minutes)'} *
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      value={serviceForm.duration}
                      onChange={e => setServiceForm({ ...serviceForm, duration: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'السعر (ر.س شاملاً الضريبة)' : 'Price (SAR incl. VAT)'} *
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono transition-all"
                      placeholder="350"
                      value={serviceForm.price}
                      onChange={e => setServiceForm({ ...serviceForm, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'التصنيف الرئيسي' : 'Category'}
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white transition-all"
                      value={serviceForm.category}
                      onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
                    >
                      <option value="massage">{lang === 'ar' ? 'علاجات ومساج' : 'Massage & Therapy'}</option>
                      <option value="skincare">{lang === 'ar' ? 'عناية بالبشرة' : 'Skincare'}</option>
                      <option value="hair">{lang === 'ar' ? 'العناية بالشعر' : 'Hair Care'}</option>
                      <option value="nail">{lang === 'ar' ? 'عناية بالأظافر' : 'Nail Care'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* New Product Form */}
            {activeType === 'product' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم المنتج بالعربية' : 'Product Name (Arabic)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      placeholder="مثال: سيروم الورد الطبيعي النقي"
                      value={productForm.nameAr}
                      onChange={e => setProductForm({ ...productForm, nameAr: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم المنتج بالإنجليزية' : 'Product Name (English)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-start transition-all"
                      placeholder="e.g. Pure Organic Rose Serum"
                      value={productForm.nameEn}
                      onChange={e => setProductForm({ ...productForm, nameEn: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'رمز التخزين SKU' : 'SKU Code'}
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-start transition-all"
                      value={productForm.sku}
                      onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'سعر البيع (ر.س)' : 'Selling Price (SAR)'} *
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono transition-all"
                      placeholder="180"
                      value={productForm.price}
                      onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'الكمية الافتتاحية' : 'Initial Stock'}
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono transition-all"
                      value={productForm.stock}
                      onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* New Employee Form */}
            {activeType === 'employee' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم الموظف بالعربية' : 'Employee Name (Arabic)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      placeholder="مثال: دلال الحربي"
                      value={employeeForm.nameAr}
                      onChange={e => setEmployeeForm({ ...employeeForm, nameAr: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم الموظف بالإنجليزية' : 'Employee Name (English)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-start transition-all"
                      placeholder="e.g. Dalal Al-Harbi"
                      value={employeeForm.nameEn}
                      onChange={e => setEmployeeForm({ ...employeeForm, nameEn: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'المسمى الوظيفي بالعربية' : 'Job Role (Arabic)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      placeholder="مثال: أخصائية تصفيف شعر درجة أولى"
                      value={employeeForm.roleAr}
                      onChange={e => setEmployeeForm({ ...employeeForm, roleAr: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'المسمى الوظيفي بالإنجليزية' : 'Job Role (English)'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-start transition-all"
                      placeholder="e.g. Senior Hairstylist Specialist"
                      value={employeeForm.roleEn}
                      onChange={e => setEmployeeForm({ ...employeeForm, roleEn: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* New Gift Card Form */}
            {activeType === 'giftcard' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم المشتري (المرسل)' : 'Sender Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      placeholder={lang === 'ar' ? 'مثال: نورة السديري' : 'e.g. Noura Al-Sudairi'}
                      value={giftcardForm.sender}
                      onChange={e => setGiftcardForm({ ...giftcardForm, sender: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم المستلم المهدى إليه' : 'Recipient Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      placeholder={lang === 'ar' ? 'مثال: مشاعل آل سعود' : 'e.g. Mashael Al-Saud'}
                      value={giftcardForm.recipient}
                      onChange={e => setGiftcardForm({ ...giftcardForm, recipient: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'قيمة الرصيد المهدى' : 'Gift Card Amount'} *
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white transition-all"
                      value={giftcardForm.amount}
                      onChange={e => setGiftcardForm({ ...giftcardForm, amount: e.target.value })}
                    >
                      <option value="150">150 {lang === 'ar' ? 'ر.س' : 'SAR'}</option>
                      <option value="300">300 {lang === 'ar' ? 'ر.س' : 'SAR'}</option>
                      <option value="500">500 {lang === 'ar' ? 'ر.س' : 'SAR'}</option>
                      <option value="1000">1000 {lang === 'ar' ? 'ر.س' : 'SAR'}</option>
                      <option value="2500">2500 {lang === 'ar' ? 'ر.س' : 'SAR'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'رمز حماية البطاقة التلقائي' : 'Generated Security Code'}
                    </label>
                    <input
                      type="text"
                      readOnly
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-mono text-start bg-neutral-100/80 text-neutral-600 focus:outline-none"
                      value={giftcardForm.code}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-6 border-t border-neutral-100 flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs md:text-sm text-neutral-600 font-semibold hover:bg-neutral-50 transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white font-bold text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
              >
                <Check size={16} />
                <span>{lang === 'ar' ? 'حفظ وإدراج العملية' : 'Save & Register Action'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
