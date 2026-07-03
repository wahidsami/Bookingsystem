import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Send, Users, Sparkles, AlertCircle, RefreshCw, Layers, Eye, 
  CheckCircle2, History, Trash2, Calendar, ChevronDown, ChevronUp, 
  Search, Check, ShieldAlert, Code, Clock, Upload, ArrowRight, ArrowLeft,
  X, HelpCircle, Database, Smartphone, FileJson, Layers3, Flame
} from 'lucide-react';
import { mockCustomers, mockServices } from '../data/mockData';

interface PushNotificationsWorkspaceProps {
  lang: 'ar' | 'en';
  darkMode?: boolean;
}

interface NotificationHistoryItem {
  id: string;
  title: string;
  message: string;
  linkType: 'general' | 'service' | 'deal';
  serviceId: string | null;
  image: string | null;
  sendToAll: boolean;
  audienceType: 'All Customers' | 'Segmented';
  recipientCount: number;
  status: 'completed' | 'failed' | 'warning';
  createdAt: string;
  requestPayload: any;
  responsePayload: any;
  timestamps: {
    created: string;
    processed: string;
    completed: string;
  };
  counts: {
    sent: number;
    delivered: number;
    skipped: number;
    failed: number;
  };
  skippedReasons: Array<{
    customerId: string;
    name: string;
    reason: string;
  }>;
  recipientResults: Array<{
    customerId: string;
    name: string;
    phone: string;
    status: 'delivered' | 'failed' | 'skipped';
    deliveryToken: string | null;
    error?: string;
  }>;
}

interface UsageStats {
  limit: number;
  sent: number;
  remaining: number;
  deliverySuccessRate: number;
  lastAttempt: NotificationHistoryItem | null;
}

interface HotDeal {
  id: string;
  title_en: string;
  title_ar: string;
}

export default function CustomerPushNotificationsWorkspace({ lang, darkMode = false }: PushNotificationsWorkspaceProps) {
  const isRtl = lang === 'ar';

  // State Management
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats>({
    limit: 5000,
    sent: 0,
    remaining: 5000,
    deliverySuccessRate: 99.4,
    lastAttempt: null
  });
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [hotDeals, setHotDeals] = useState<HotDeal[]>([]);

  // Composer Form States
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [linkType, setLinkType] = useState<'general' | 'service' | 'deal'>('general');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [sendToAll, setSendToAll] = useState<boolean>(true);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  // Customer Selection Search and Toggle State
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerPanelExpanded, setCustomerPanelExpanded] = useState<boolean>(false);

  // Pagination State
  const [historyPage, setHistoryPage] = useState<number>(1);
  const itemsPerPage = 5;

  // Modals States
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<NotificationHistoryItem | null>(null);
  const [showRecipientsModal, setShowRecipientsModal] = useState<boolean>(false);
  const [showDebugModal, setShowDebugModal] = useState<boolean>(false);

  // File Upload states
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Presets
  const presets = [
    {
      title: isRtl ? "🌸 خصومات حصرية لعميلاتنا المخلصات" : "🌸 Exclusive VIP Loyalty Discounts!",
      message: isRtl 
        ? "استمتعي بخصم ٢٠٪ على جلسات العناية الملكية بالشعر هذا الأسبوع." 
        : "Enjoy 20% off on all royal hair care treatments this week.",
      linkType: 'general' as const,
      sendToAll: true
    },
    {
      title: isRtl ? "✨ دلال استثنائي للبشرة" : "✨ Ultimate Radiance Skincare Treat",
      message: isRtl 
        ? "أضيفي ماسك الكولاجين مجاناً عند حجز جلسة هيدرافيشال غداً." 
        : "Add a complimentary collagen mask with any Hydrafacial booked tomorrow.",
      linkType: 'service' as const,
      serviceId: 'SRV-002',
      sendToAll: false
    }
  ];

  // Fetch initial data from Backend
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Usage Stats
      const usageRes = await fetch('/api/v1/tenant/notifications/usage');
      if (!usageRes.ok) throw new Error("Could not load push usage statistics.");
      const usageData = await usageRes.json();
      setUsage(usageData);

      // Fetch History
      const historyRes = await fetch('/api/v1/tenant/notifications/history');
      if (!historyRes.ok) throw new Error("Could not load dispatch log history.");
      const historyData = await historyRes.json();
      setHistory(historyData);

      // Fetch Hot Deals (if any)
      try {
        const dealsRes = await fetch('/api/v1/tenant/hot-deals');
        if (dealsRes.ok) {
          const dealsData = await dealsRes.json();
          setHotDeals(dealsData);
        }
      } catch (e) {
        console.warn("Hot deals endpoint not fully accessible", e);
      }

    } catch (err: any) {
      setError(err.message || "Failed to synchronise data with push service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle preset application
  const applyPreset = (preset: typeof presets[0]) => {
    setTitle(preset.title);
    setMessage(preset.message);
    setLinkType(preset.linkType);
    setSendToAll(preset.sendToAll);
    if (preset.linkType === 'service' && preset.serviceId) {
      setSelectedServiceId(preset.serviceId);
    }
  };

  // Image upload handling
  const handleImageUpload = async (base64String: string) => {
    try {
      setUploadingImage(true);
      const res = await fetch('/api/v1/tenant/notifications/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64String })
      });
      if (!res.ok) throw new Error("Failed to process image upload on server.");
      const data = await res.json();
      setImageUrl(data.imageUrl);
    } catch (err: any) {
      alert(isRtl ? "فشل رفع الصورة: " + err.message : "Image upload failed: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert(isRtl ? "يرجى تحديد ملف صورة صالح." : "Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        handleImageUpload(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Select / Deselect customers logic
  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllCustomers = () => {
    if (selectedCustomerIds.length === mockCustomers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(mockCustomers.map(c => c.id));
    }
  };

  // Submit main composer notification
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert(isRtl ? "يرجى ملء حقول العنوان والرسالة." : "Please fill in both Title and Message fields.");
      return;
    }

    if (!sendToAll && selectedCustomerIds.length === 0) {
      alert(isRtl 
        ? "يرجى تحديد عميل واحد على الأقل أو تفعيل خيار الإرسال للجميع." 
        : "Please select at least one customer recipient or toggle 'Send to all'."
      );
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title,
        message,
        linkType,
        serviceId: linkType === 'service' ? selectedServiceId : null,
        dealId: linkType === 'deal' ? selectedDealId : null,
        image: imageUrl || null,
        sendToAll,
        customerIds: sendToAll ? [] : selectedCustomerIds
      };

      const response = await fetch('/api/v1/tenant/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to dispatch notification.");
      }

      const newLog = await response.json();

      // Reset Form fields
      setTitle('');
      setMessage('');
      setImageUrl('');
      setLinkType('general');
      setSelectedServiceId('');
      setSelectedDealId('');
      setSelectedCustomerIds([]);
      setCustomerPanelExpanded(false);

      // Refresh data
      await fetchData();

      // Show success toast/alert
      alert(isRtl ? "🎉 تم بث إشعار الدفع بنجاح للعملاء!" : "🎉 Push notification dispatched successfully!");

    } catch (err: any) {
      alert(err.message || "Failed to broadcast notification.");
    } finally {
      setLoading(false);
    }
  };

  // Customer Filtering Search
  const filteredCustomers = mockCustomers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // History Pagination
  const totalHistoryPages = Math.ceil(history.length / itemsPerPage) || 1;
  const paginatedHistory = history.slice(
    (historyPage - 1) * itemsPerPage,
    historyPage * itemsPerPage
  );

  return (
    <div className={`space-y-8 ${darkMode ? 'text-zinc-100' : 'text-neutral-800'}`}>
      
      {/* Simulation / Refresh HUD */}
      <div className={`p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between ${
        darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-neutral-50 border-neutral-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500"></span>
          </span>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isRtl ? 'بوابة إدارة الإشعارات الفورية' : 'Push Notification Dispatch Gateway'}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {isRtl ? 'متصل ومؤمن ومراقب بنظام بث ذكي لصالون رفاه.' : 'Connected, secured, and synced with REFAH enterprise push clusters.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 ${
              darkMode ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
            }`}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {isRtl ? 'تحديث البيانات' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
          <ShieldAlert size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-black text-rose-500">{isRtl ? 'حدث خطأ في الاتصال' : 'Connection Failure Detected'}</h4>
            <p className="text-[11px] text-rose-400 mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* 1. USAGE SUMMARY CARD */}
      <div className={`p-6 rounded-2xl border ${
        darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest block">
              {isRtl ? 'إحصائيات استهلاك الحصة الشهرية' : 'Monthly Usage Allocation'}
            </span>
            <h3 className="text-lg font-extrabold font-sans">
              {isRtl ? 'ملخص استخدام الباقة الحالية' : 'Push Subscription Status'}
            </h3>
            <p className="text-xs text-neutral-400">
              {isRtl 
                ? 'تتم إعادة تعيين حصتك الشهرية تلقائياً في اليوم الأول من كل شهر ميلادي.' 
                : 'Your broadcasting quota refreshes automatically on the 1st of each calendar month.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className={`p-3 rounded-xl border text-center min-w-[100px] ${darkMode ? 'bg-zinc-950 border-zinc-850' : 'bg-neutral-50 border-neutral-150'}`}>
              <span className="text-[10px] text-zinc-400 block">{isRtl ? 'معدل التسليم' : 'Delivery rate'}</span>
              <span className="text-base font-black text-emerald-500 font-mono mt-0.5 block">{usage.deliverySuccessRate}%</span>
            </div>
            <div className={`p-3 rounded-xl border text-center min-w-[100px] ${darkMode ? 'bg-zinc-950 border-zinc-850' : 'bg-neutral-50 border-neutral-150'}`}>
              <span className="text-[10px] text-zinc-400 block">{isRtl ? 'المتبقي' : 'Remaining'}</span>
              <span className="text-base font-black text-brand-500 font-mono mt-0.5 block">{usage.remaining.toLocaleString()}</span>
            </div>
            <div className={`p-3 rounded-xl border text-center min-w-[100px] ${darkMode ? 'bg-zinc-950 border-zinc-850' : 'bg-neutral-50 border-neutral-150'}`}>
              <span className="text-[10px] text-zinc-400 block">{isRtl ? 'المرسلة' : 'Sent'}</span>
              <span className="text-base font-black text-zinc-300 font-mono mt-0.5 block">{usage.sent.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>{isRtl ? `تم استخدام ${usage.sent.toLocaleString()} من أصل ${usage.limit.toLocaleString()}` : `${usage.sent.toLocaleString()} utilized out of ${usage.limit.toLocaleString()}`}</span>
            <span>{Math.round((usage.sent / usage.limit) * 100)}%</span>
          </div>
          <div className={`w-full h-2.5 rounded-full overflow-hidden ${darkMode ? 'bg-zinc-950' : 'bg-neutral-100'}`}>
            <div 
              className="h-full bg-brand-500 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(2, (usage.sent / usage.limit) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. MAIN COMPOSER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Composer Box */}
        <div className={`lg:col-span-7 p-6 rounded-2xl border space-y-6 ${
          darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
        }`}>
          <div className="border-b border-zinc-800/60 pb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-sm md:text-base flex items-center gap-2">
              <Send size={16} className="text-brand-500" />
              {isRtl ? 'إنشاء وإعداد حملة إشعار جديدة' : 'New Instant Push Composer'}
            </h3>
            
            <span className="text-[10px] bg-brand-500/10 text-brand-400 font-bold px-2 py-0.5 rounded-full border border-brand-500/20">
              {isRtl ? 'البث المباشر (FCM)' : 'FCM Live Mode'}
            </span>
          </div>

          {/* Quick Presets Bar */}
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-400 uppercase font-black block tracking-wider">
              {isRtl ? 'نماذج ومقترحات سريعة مسبقة:' : 'Apply Instant Composing Presets:'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`p-3 rounded-xl border text-start transition-all duration-200 hover:scale-102 cursor-pointer ${
                    darkMode ? 'border-zinc-800 hover:border-brand-500/40 bg-zinc-950/40' : 'border-neutral-200 hover:border-brand-300 bg-neutral-50/50'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 truncate">
                    <Sparkles size={11} className="text-brand-500" />
                    {p.title}
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate mt-1">{p.message}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSendNotification} className="space-y-4 text-xs">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-400 block">{isRtl ? 'عنوان الإشعار القصير' : 'Notification Title'}</label>
              <input
                type="text"
                required
                maxLength={60}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isRtl ? 'أدخل عنواناً جذاباً وواضحاً...' : 'Enter highly enticing title...'}
                className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold transition-all ${
                  darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                }`}
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-400 block">{isRtl ? 'نص الرسالة المباشرة' : 'Message Body Body'}</label>
              <textarea
                required
                maxLength={200}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isRtl ? 'اكتب نص التنبيه الفوري لعملائك...' : 'Compose instant lockscreen popup text...'}
                rows={3}
                className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden leading-relaxed transition-all ${
                  darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                }`}
              />
            </div>

            {/* Link Type & Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-400 block">{isRtl ? 'نوع الرابط / التوجيه' : 'Action Navigation Link'}</label>
                <select
                  value={linkType}
                  onChange={(e: any) => setLinkType(e.target.value)}
                  className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold cursor-pointer transition-all ${
                    darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                  }`}
                >
                  <option value="general">{isRtl ? 'عام (فتح التطبيق)' : 'General (Open Application)'}</option>
                  <option value="service">{isRtl ? 'ربط بخدمة صالون محددة' : 'Link to Salon Service'}</option>
                  <option value="deal">{isRtl ? 'ربط بعرض ساخن نشط' : 'Link to Hot Deal Page'}</option>
                </select>
              </div>

              {/* Service Selector conditional */}
              {linkType === 'service' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-brand-500 block">{isRtl ? 'اختر الخدمة المستهدفة' : 'Select Target Service'}</label>
                  <select
                    value={selectedServiceId}
                    required
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold cursor-pointer transition-all ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                    }`}
                  >
                    <option value="">{isRtl ? '-- اختر الخدمة --' : '-- Select Service --'}</option>
                    {mockServices.map(srv => (
                      <option key={srv.id} value={srv.id}>
                        {isRtl ? srv.nameAr : srv.nameEn} ({srv.price} {isRtl ? 'ر.س' : 'SAR'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Deal Selector conditional */}
              {linkType === 'deal' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-brand-500 block">{isRtl ? 'اختر العرض المستهدف' : 'Select Target Hot Deal'}</label>
                  <select
                    value={selectedDealId}
                    required
                    onChange={(e) => setSelectedDealId(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold cursor-pointer transition-all ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                    }`}
                  >
                    <option value="">{isRtl ? '-- اختر العرض الساخن --' : '-- Select Hot Deal --'}</option>
                    {hotDeals.length > 0 ? (
                      hotDeals.map(deal => (
                        <option key={deal.id} value={deal.id}>
                          {isRtl ? deal.title_ar : deal.title_en}
                        </option>
                      ))
                    ) : (
                      <option value="deal-royal-massage">{isRtl ? 'هروب الاسترخاء الملكي (مؤقت)' : 'Royal Relaxation Escape'}</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Image Upload Area */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-400 block">{isRtl ? 'صورة الإشعار الغنية (اختياري)' : 'Rich Push Image (Optional)'}</label>
              
              <div 
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                  dragActive ? 'border-brand-500 bg-brand-500/5' : darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-neutral-250 bg-neutral-50'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                {uploadingImage ? (
                  <div className="py-4 space-y-2">
                    <RefreshCw size={24} className="animate-spin text-brand-500 mx-auto" />
                    <span className="text-[11px] text-zinc-400 block">{isRtl ? 'يتم معالجة الصورة السحابية...' : 'Uploading resource payload...'}</span>
                  </div>
                ) : imageUrl ? (
                  <div className="relative inline-block group">
                    <img 
                      src={imageUrl} 
                      alt="Uploaded payload preview" 
                      className="h-28 object-cover rounded-lg border border-zinc-800 max-w-xs" 
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute -top-2 -right-2 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-all cursor-pointer shadow-md"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={20} className="mx-auto text-zinc-400" />
                    <p className="text-[11px] text-zinc-400">
                      {isRtl ? 'اسحب صورتك هنا أو ' : 'Drag and drop image files here, or '}
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-brand-500 hover:underline font-bold cursor-pointer"
                      >
                        {isRtl ? 'تصفح جهازك' : 'browse local system'}
                      </button>
                    </p>
                    <p className="text-[9px] text-zinc-500">
                      {isRtl ? 'التنسيقات المدعومة: PNG, JPG, GIF (بأبعاد مربعة ٢:١ يفضل)' : 'PNG, JPG, GIF supported. Optimized ratio 2:1'}
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Send to all toggle */}
            <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              darkMode ? 'bg-zinc-950 border-zinc-850' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="space-y-0.5">
                <span className="font-extrabold text-xs block">{isRtl ? 'إرسال لجميع المشتركين' : 'Broadcast to All Push Tokens'}</span>
                <span className="text-[10px] text-zinc-400 block">
                  {isRtl 
                    ? 'بث الرسالة بشكل فوري لكافة الهواتف المؤهلة بالنظام.' 
                    : 'Dispatch alerts directly to all registered client devices.'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={sendToAll} 
                  onChange={(e) => {
                    setSendToAll(e.target.checked);
                    if (e.target.checked) setSelectedCustomerIds([]);
                  }} 
                  className="sr-only peer" 
                />
                <div className="w-10 h-5 bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
              </label>
            </div>

            {/* Dispatch Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-600 text-white font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/10 text-xs md:text-sm"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {isRtl ? 'جاري بث التنبيه الفوري...' : 'Broadcasting Push Alarm...'}
                </>
              ) : (
                <>
                  <Send size={14} />
                  {isRtl ? 'بث الإشعار الفوري الآن' : 'Dispatch Push Broadcast Now'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* 3. CUSTOMER SELECTION PANEL */}
        <div className="lg:col-span-5 flex flex-col h-full justify-between">
          <div className={`p-6 rounded-2xl border space-y-4 h-full ${
            darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
          }`}>
            <div className="border-b border-zinc-800/60 pb-3 flex items-center justify-between">
              <h3 className="font-extrabold text-sm md:text-base flex items-center gap-2">
                <Users size={16} className="text-brand-500" />
                {isRtl ? 'تخصيص واختيار المستلمين' : 'Segment Recipient Registry'}
              </h3>
              
              <button
                type="button"
                onClick={() => setCustomerPanelExpanded(!customerPanelExpanded)}
                className={`p-1 rounded-md hover:bg-zinc-800 text-zinc-400 transition-all ${sendToAll ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={sendToAll}
              >
                {customerPanelExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {sendToAll ? (
              <div className="p-6 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
                <Smartphone size={28} className="mx-auto text-brand-500/60" />
                <h4 className="font-bold text-xs">{isRtl ? 'جميع المشتركين مؤهلون' : 'Omnichannel Active Broadcaster'}</h4>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  {isRtl 
                    ? 'لقد قمت بتفعيل "الإرسال للجميع". سيتم إرسال هذا التنبيه لـ ٥ عملاء نشطين بصفة فورية.' 
                    : 'You enabled send-to-all. Notification will reach all 5 registered luxury accounts.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search customers input */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      if (!customerPanelExpanded) setCustomerPanelExpanded(true);
                    }}
                    placeholder={isRtl ? 'ابحث عن العميل بالاسم أو الهاتف...' : 'Search customers by name, phone...'}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-xs focus:ring-1 focus:ring-brand-500 outline-hidden transition-all ${
                      darkMode ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-white border-neutral-200 text-neutral-800'
                    }`}
                  />
                </div>

                {/* Bulk Select Options */}
                <div className="flex justify-between items-center text-[10px] text-zinc-400 px-1">
                  <span>
                    {isRtl 
                      ? `تم تحديد ${selectedCustomerIds.length} من أصل ${mockCustomers.length}` 
                      : `${selectedCustomerIds.length} selected out of ${mockCustomers.length}`}
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAllCustomers}
                    className="text-brand-500 font-bold hover:underline cursor-pointer"
                  >
                    {selectedCustomerIds.length === mockCustomers.length 
                      ? (isRtl ? 'إلغاء تحديد الكل' : 'Deselect All') 
                      : (isRtl ? 'تحديد الكل' : 'Select All')}
                  </button>
                </div>

                {/* Collapsible Customer Checkboxes list */}
                {(!customerPanelExpanded && filteredCustomers.length > 3) ? (
                  <div className="text-center py-4 bg-zinc-950/20 rounded-xl border border-zinc-850">
                    <p className="text-[10px] text-zinc-400">{isRtl ? 'تم طي قائمة العملاء الإضافية.' : 'Customer directory list folded.'}</p>
                    <button
                      type="button"
                      onClick={() => setCustomerPanelExpanded(true)}
                      className="text-xs text-brand-500 font-bold mt-1 hover:underline cursor-pointer"
                    >
                      {isRtl ? 'عرض قائمة العملاء وتعديلها' : 'Expand full subscriber list'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {filteredCustomers.length === 0 ? (
                      <div className="py-6 text-center text-zinc-500">
                        <p>{isRtl ? 'لا يوجد عملاء يطابقون البحث.' : 'No subscribers match search.'}</p>
                      </div>
                    ) : (
                      filteredCustomers.map(c => {
                        const isChecked = selectedCustomerIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => toggleCustomer(c.id)}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isChecked 
                                ? darkMode ? 'bg-brand-500/5 border-brand-500/50' : 'bg-brand-50/40 border-brand-300'
                                : darkMode ? 'bg-zinc-950/40 border-zinc-850 hover:bg-zinc-950' : 'bg-neutral-50/50 border-neutral-150 hover:bg-neutral-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                isChecked ? 'bg-brand-500 border-brand-500 text-white' : 'border-zinc-400'
                              }`}>
                                {isChecked && <Check size={10} />}
                              </div>
                              <div className="text-start space-y-0.5">
                                <span className="font-extrabold block text-xs">{c.name}</span>
                                <span className="text-[9px] text-zinc-500 block font-mono">{c.phone} • {c.email}</span>
                              </div>
                            </div>

                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              c.appointmentsCount > 10 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                : 'bg-neutral-500/10 text-neutral-400'
                            }`}>
                              {c.appointmentsCount > 10 ? (isRtl ? 'متميز' : 'VIP') : (isRtl ? 'جديد' : 'Regular')}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. LAST ATTEMPT DEBUG SUMMARY */}
      {usage.lastAttempt && (
        <div className={`p-6 rounded-2xl border ${
          darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
        }`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800/60 pb-3 gap-4">
            <div className="flex items-center gap-2">
              <Database className="text-brand-500 shrink-0" size={16} />
              <div className="text-start">
                <h4 className="font-black text-xs uppercase tracking-wider">{isRtl ? 'سجل البث الفوري الأخير' : 'Last Campaign Telemetry Dispatch'}</h4>
                <p className="text-[10px] text-zinc-400">{isRtl ? `تاريخ الإرسال: ${new Date(usage.lastAttempt.createdAt).toLocaleString()}` : `Sent at: ${new Date(usage.lastAttempt.createdAt).toLocaleString()}`}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500">ID: {usage.lastAttempt.id}</span>
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full text-[9px] font-black uppercase">
                {isRtl ? 'مكتمل بنجاح' : 'Success'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
            
            <div className="md:col-span-2 space-y-2">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">{isRtl ? 'تفاصيل الإشعار الأخير' : 'Notification details'}</span>
              <div className={`p-3.5 rounded-xl text-start space-y-1 ${darkMode ? 'bg-zinc-950/80 border border-zinc-850' : 'bg-neutral-50/80 border border-neutral-200'}`}>
                <span className="font-extrabold text-xs block">{usage.lastAttempt.title}</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{usage.lastAttempt.message}</p>
                <div className="text-[9px] text-brand-500 font-bold font-mono mt-1 flex items-center gap-2">
                  <span>Link: {usage.lastAttempt.linkType}</span>
                  {usage.lastAttempt.serviceId && <span>• Target: {usage.lastAttempt.serviceId}</span>}
                </div>
              </div>
            </div>

            <div className="space-y-1 text-start">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">{isRtl ? 'إحصائيات الإرسال الموضعية' : 'Metrics summary'}</span>
              <div className="space-y-1.5 font-mono text-xs mt-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">{isRtl ? 'إرسال لـ' : 'Sent targeting:'}</span>
                  <span className="font-bold text-brand-500">{usage.lastAttempt.counts.sent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{isRtl ? 'تم التوصيل:' : 'Delivered success:'}</span>
                  <span className="font-bold text-emerald-500">{usage.lastAttempt.counts.delivered}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">{isRtl ? 'المستبعدين:' : 'Skipped:'}</span>
                  <span className="font-bold text-neutral-400">{usage.lastAttempt.counts.skipped}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedHistoryItem(usage.lastAttempt);
                  setShowRecipientsModal(true);
                }}
                className={`w-full py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  darkMode ? 'bg-zinc-950 hover:bg-zinc-850 border-zinc-800 text-zinc-200' : 'bg-white hover:bg-neutral-50 border-neutral-250 text-neutral-700'
                }`}
              >
                <Users size={12} />
                {isRtl ? 'عرض قائمة المستلمين' : 'Inspect Recipients'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedHistoryItem(usage.lastAttempt);
                  setShowDebugModal(true);
                }}
                className="w-full py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 text-xs font-bold rounded-lg border border-brand-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Code size={12} />
                {isRtl ? 'مستكشف الحمولة والمطور' : 'Inspect Debug Payload'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. PUSH HISTORY TABLE */}
      <div className={`p-6 rounded-2xl border space-y-4 ${
        darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-zinc-800/60 gap-4">
          <div className="flex items-center gap-2">
            <History className="text-brand-500" size={18} />
            <div className="text-start">
              <h3 className="font-extrabold text-sm md:text-base">{isRtl ? 'سجل المحفوظات والحملات المرسلة' : 'Sent Push History Logs'}</h3>
              <p className="text-[10px] text-zinc-400">{isRtl ? 'أرشيف تتبع الإشعارات السابقة وتحليل كفاءة الوصول.' : 'Audit logs of previously broadasted push campaigns and access latency.'}</p>
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-3">
            <Bell size={36} className="mx-auto text-zinc-700 animate-bounce" />
            <h4 className="font-bold text-xs">{isRtl ? 'سجل الإشعارات فارغ' : 'Push Dispatch Registry Empty'}</h4>
            <p className="text-[11px] text-zinc-400">{isRtl ? 'لم تقم ببث أي إشعار حتى الآن بالباقة.' : 'No push broadcasts registered on this tenant server.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-zinc-850">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className={`border-b border-zinc-850 text-neutral-400 ${darkMode ? 'bg-zinc-950/80' : 'bg-neutral-50/80'}`}>
                    <th className="p-3 text-start font-black">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</th>
                    <th className="p-3 text-start font-black">{isRtl ? 'العنوان' : 'Title'}</th>
                    <th className="p-3 text-start font-black">{isRtl ? 'نص الرسالة المفرط' : 'Message Text'}</th>
                    <th className="p-3 text-start font-black">{isRtl ? 'نوع الارتباط' : 'Link type'}</th>
                    <th className="p-3 text-start font-black">{isRtl ? 'نوع الجمهور' : 'Audience type'}</th>
                    <th className="p-3 text-start font-black text-center">{isRtl ? 'المستلمون' : 'Recipients'}</th>
                    <th className="p-3 text-center font-black">{isRtl ? 'العمليات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {paginatedHistory.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-zinc-800/10 transition-all ${
                        darkMode ? 'text-zinc-300' : 'text-neutral-700'
                      }`}
                    >
                      <td className="p-3 whitespace-nowrap font-mono text-[10px]">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-extrabold max-w-[150px] truncate">
                        {item.title}
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-zinc-400">
                        {item.message}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          item.linkType === 'deal' 
                            ? 'bg-amber-500/10 text-amber-500' 
                            : item.linkType === 'service' 
                              ? 'bg-brand-500/10 text-brand-400' 
                              : 'bg-neutral-500/10 text-zinc-400'
                        }`}>
                          {item.linkType}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="text-[10px] font-medium">{item.audienceType}</span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-center font-mono font-bold text-brand-500">
                        {item.recipientCount}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHistoryItem(item);
                              setShowRecipientsModal(true);
                            }}
                            className={`p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-brand-500 transition-colors cursor-pointer`}
                            title={isRtl ? 'عرض المستلمين' : 'Inspect Recipients'}
                          >
                            <Users size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHistoryItem(item);
                              setShowDebugModal(true);
                            }}
                            className={`p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-brand-500 transition-colors cursor-pointer`}
                            title={isRtl ? 'تفاصيل الحمولة والمطور' : 'Inspect Payload'}
                          >
                            <Code size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex justify-between items-center text-xs pt-2">
              <span className="text-zinc-400">
                {isRtl 
                  ? `عرض الصفحة ${historyPage} من أصل ${totalHistoryPages}` 
                  : `Showing Page ${historyPage} of ${totalHistoryPages}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                  className="px-2 py-1 bg-zinc-950 border border-zinc-850 hover:bg-zinc-800 disabled:opacity-30 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  {isRtl ? 'السابق' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={historyPage === totalHistoryPages}
                  onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
                  className="px-2 py-1 bg-zinc-950 border border-zinc-850 hover:bg-zinc-800 disabled:opacity-30 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {isRtl ? 'التالي' : 'Next'}
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* 6. RECIPIENTS MODAL */}
      {/* ========================================== */}
      {showRecipientsModal && selectedHistoryItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 space-y-4 max-h-[85vh] overflow-y-auto ${
            darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-200 text-neutral-800'
          }`}>
            <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <Users className="text-brand-500" size={18} />
                <div className="text-start">
                  <h3 className="font-extrabold text-sm md:text-base">{isRtl ? 'مستلمو إشعار الدفع' : 'Recipient Dispatch Logs'}</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">ID: {selectedHistoryItem.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRecipientsModal(false);
                  setSelectedHistoryItem(null);
                }}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className={`p-3.5 rounded-xl text-start text-xs leading-relaxed space-y-1 ${
              darkMode ? 'bg-zinc-900/60' : 'bg-neutral-50'
            }`}>
              <div className="font-bold">{selectedHistoryItem.title}</div>
              <div className="text-zinc-400 text-[11px]">{selectedHistoryItem.message}</div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-zinc-400 text-start">{isRtl ? 'قائمة تفصيل المستهدفين' : 'Individual Recipient Breakdown:'}</div>
              
              <div className="overflow-x-auto rounded-xl border border-zinc-850">
                <table className="w-full text-[11px] text-start">
                  <thead>
                    <tr className={`border-b border-zinc-850 text-zinc-400 ${darkMode ? 'bg-zinc-900' : 'bg-neutral-100'}`}>
                      <th className="p-2.5 text-start font-black">{isRtl ? 'العميل' : 'Customer Name'}</th>
                      <th className="p-2.5 text-start font-black">{isRtl ? 'رقم الهاتف' : 'Phone'}</th>
                      <th className="p-2.5 text-start font-black">{isRtl ? 'حالة البث' : 'Broadcast Status'}</th>
                      <th className="p-2.5 text-start font-black">{isRtl ? 'رمز التسجيل (Token)' : 'Delivery token'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 font-mono">
                    {/* Render delivered recipients */}
                    {selectedHistoryItem.recipientResults?.map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-900/40">
                        <td className="p-2.5 font-sans font-bold text-start">{r.name}</td>
                        <td className="p-2.5">{r.phone}</td>
                        <td className="p-2.5">
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold">
                            {isRtl ? 'تم التوصيل' : 'Delivered'}
                          </span>
                        </td>
                        <td className="p-2.5 text-zinc-500 max-w-[120px] truncate" title={r.deliveryToken || ''}>
                          {r.deliveryToken || '-'}
                        </td>
                      </tr>
                    ))}

                    {/* Render skipped recipients */}
                    {selectedHistoryItem.skippedReasons?.map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-900/40 opacity-60">
                        <td className="p-2.5 font-sans font-bold text-start">{r.name}</td>
                        <td className="p-2.5">-</td>
                        <td className="p-2.5">
                          <span className="text-[10px] bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 px-1.5 py-0.5 rounded-full font-bold">
                            {isRtl ? 'مستبعد' : 'Skipped'}
                          </span>
                        </td>
                        <td className="p-2.5 text-rose-500 text-[10px] font-sans truncate max-w-[120px]" title={r.reason}>
                          {r.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => {
                  setShowRecipientsModal(false);
                  setSelectedHistoryItem(null);
                }}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
              >
                {isRtl ? 'إغلاق النافذة' : 'Close Details'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 7. DEBUG MODAL */}
      {/* ========================================== */}
      {showDebugModal && selectedHistoryItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl rounded-2xl border p-6 space-y-4 max-h-[85vh] overflow-y-auto ${
            darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-200 text-neutral-800'
          }`}>
            <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <FileJson className="text-brand-500" size={18} />
                <div className="text-start">
                  <h3 className="font-extrabold text-sm md:text-base">{isRtl ? 'تفاصيل الحمولة والمطور (JSON payload debug)' : 'Developer Telemetry Payload Inspector'}</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">ID: {selectedHistoryItem.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDebugModal(false);
                  setSelectedHistoryItem(null);
                }}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Timestamps & general metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-neutral-50'}`}>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold">{isRtl ? 'حالة التوصيل' : 'Status'}</span>
                <span className="text-xs font-black text-emerald-500 block mt-1">{selectedHistoryItem.status}</span>
              </div>
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-neutral-50'}`}>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold">{isRtl ? 'إنشاء الطلب' : 'Created At'}</span>
                <span className="text-xs font-mono text-zinc-400 block mt-1 truncate" title={selectedHistoryItem.timestamps.created}>
                  {new Date(selectedHistoryItem.timestamps.created).toLocaleTimeString()}
                </span>
              </div>
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-neutral-50'}`}>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold">{isRtl ? 'اكتمل التوزيع' : 'Completed At'}</span>
                <span className="text-xs font-mono text-zinc-400 block mt-1 truncate" title={selectedHistoryItem.timestamps.completed}>
                  {new Date(selectedHistoryItem.timestamps.completed).toLocaleTimeString()}
                </span>
              </div>
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-neutral-50'}`}>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold">{isRtl ? 'إجمالي المستلمين' : 'Recipient match'}</span>
                <span className="text-xs font-black text-brand-500 block mt-1">{selectedHistoryItem.recipientCount} / {selectedHistoryItem.counts.sent}</span>
              </div>
            </div>

            {/* Split JSON view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start font-mono text-[10px]">
              
              <div className="space-y-1.5">
                <span className="text-zinc-400 uppercase font-black tracking-wider text-[9px] flex items-center gap-1.5">
                  <Database size={11} className="text-brand-500" />
                  {isRtl ? 'طلب البث (Request Payload)' : 'HTTP Request Payload (POST)'}
                </span>
                <pre className={`p-3 rounded-xl border overflow-auto max-h-[250px] leading-relaxed ${
                  darkMode ? 'bg-zinc-900 border-zinc-850 text-brand-400' : 'bg-neutral-950 border-neutral-800 text-emerald-400'
                }`}>
                  {JSON.stringify(selectedHistoryItem.requestPayload, null, 2)}
                </pre>
              </div>

              <div className="space-y-1.5">
                <span className="text-zinc-400 uppercase font-black tracking-wider text-[9px] flex items-center gap-1.5">
                  <Smartphone size={11} className="text-brand-500" />
                  {isRtl ? 'استجابة FCM (Response Payload)' : 'FCM Server Response (251)'}
                </span>
                <pre className={`p-3 rounded-xl border overflow-auto max-h-[250px] leading-relaxed ${
                  darkMode ? 'bg-zinc-900 border-zinc-850 text-brand-400' : 'bg-neutral-950 border-neutral-800 text-brand-400'
                }`}>
                  {JSON.stringify(selectedHistoryItem.responsePayload, null, 2)}
                </pre>
              </div>

            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => {
                  setShowDebugModal(false);
                  setSelectedHistoryItem(null);
                }}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
              >
                {isRtl ? 'إغلاق المتصفح المطور' : 'Close Developer Console'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
