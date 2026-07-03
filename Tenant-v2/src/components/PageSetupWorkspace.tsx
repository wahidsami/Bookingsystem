import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, Image, Plus, Check, Save, AlertCircle, RefreshCw, Trash2, 
  Layout, Palette, Eye, EyeOff, MapPin, Phone, Mail, Link as LinkIcon, 
  Instagram, Twitter, Youtube, Linkedin, Sparkles, Upload, Map, ExternalLink,
  ChevronLeft, ChevronRight, FileText, CheckCircle, Smartphone, HelpCircle
} from 'lucide-react';

interface PageSetupWorkspaceProps {
  lang: 'ar' | 'en';
  darkMode?: boolean;
}

interface SectionsVisibility {
  services: boolean;
  products: boolean;
  reviews: boolean;
  about: boolean;
}

interface PublicPageData {
  coverImage: string;
  sectionsVisibility: SectionsVisibility;
  aboutTitleAr: string;
  aboutTitleEn: string;
  aboutTextAr: string;
  aboutTextEn: string;
  gallery: string[];
}

interface BusinessSettings {
  address: string;
  googleMapLink: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  twitter: string;
  tiktok: string;
  youtube: string;
  linkedin: string;
  snapchat: string;
}

export default function PageSetupWorkspace({ lang, darkMode = false }: PageSetupWorkspaceProps) {
  const isRtl = lang === 'ar';

  // State management
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states matching public-page schema
  const [coverImage, setCoverImage] = useState<string>('');
  const [sectionsVisibility, setSectionsVisibility] = useState<SectionsVisibility>({
    services: true,
    products: true,
    reviews: true,
    about: true
  });
  const [aboutTitleAr, setAboutTitleAr] = useState<string>('');
  const [aboutTitleEn, setAboutTitleEn] = useState<string>('');
  const [aboutTextAr, setAboutTextAr] = useState<string>('');
  const [aboutTextEn, setAboutTextEn] = useState<string>('');
  const [gallery, setGallery] = useState<string[]>([]);

  // Form states matching business settings schema
  const [contact, setContact] = useState<BusinessSettings>({
    address: '',
    googleMapLink: '',
    phone: '',
    email: '',
    website: '',
    instagram: '',
    twitter: '',
    tiktok: '',
    youtube: '',
    linkedin: '',
    snapchat: ''
  });

  // UI / Drag and Drop state
  const [dragActiveCover, setDragActiveCover] = useState<boolean>(false);
  const [dragActiveGallery, setDragActiveGallery] = useState<boolean>(false);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState<number | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('mobile');

  // Input refs for manual trigger
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Preset gorgeous Cover Images
  const coverPresets = [
    { url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80", label: isRtl ? "صالون عصري" : "Modern Salon" },
    { url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80", label: isRtl ? "قص وتصفيف" : "Hair Styling" },
    { url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80", label: isRtl ? "عناية مسمار" : "Nail Suite" },
    { url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80", label: isRtl ? "استرخاء ومساج" : "Spa Zen" }
  ];

  // Preset Gallery Images
  const galleryPresets = [
    "https://images.unsplash.com/photo-1600948836101-f9ffdb5237e2?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=600&q=80"
  ];

  // Fetch initial page content and settings
  const loadPageSetupAndSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch public page setup
      const pageRes = await fetch('/api/v1/tenant/public-page');
      if (!pageRes.ok) throw new Error(isRtl ? 'فشل جلب إعدادات الصفحة العامة من الخادم.' : 'Failed to retrieve public page setup.');
      const pageData: PublicPageData = await pageRes.json();

      // Fetch settings
      const settingsRes = await fetch('/api/v1/tenant/settings');
      if (!settingsRes.ok) throw new Error(isRtl ? 'فشل جلب إعدادات الاتصال والأعمال من الخادم.' : 'Failed to retrieve settings details.');
      const settingsData = await settingsRes.json();

      // Apply to states
      setCoverImage(pageData.coverImage || '');
      setSectionsVisibility(pageData.sectionsVisibility || {
        services: true,
        products: true,
        reviews: true,
        about: true
      });
      setAboutTitleAr(pageData.aboutTitleAr || '');
      setAboutTitleEn(pageData.aboutTitleEn || '');
      setAboutTextAr(pageData.aboutTextAr || '');
      setAboutTextEn(pageData.aboutTextEn || '');
      setGallery(pageData.gallery || []);

      if (settingsData.business) {
        setContact(settingsData.business);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading settings data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageSetupAndSettings();
  }, []);

  // Section Visibility toggle validator
  const handleSectionToggle = (section: keyof SectionsVisibility) => {
    const nextVal = !sectionsVisibility[section];
    
    // Rule: At least one section must remain visible
    const activeCount = Object.entries(sectionsVisibility)
      .filter(([key, val]) => (key === section ? nextVal : val) === true)
      .length;

    if (activeCount === 0) {
      const warning = isRtl 
        ? '⚠️ تنبيه: يجب إبقاء قسم واحد نشط على الأقل للمظهر العام للموقع.' 
        : '⚠️ Rule violation: At least one section must remain visible on the public page.';
      alert(warning);
      return;
    }

    setSectionsVisibility(prev => ({ ...prev, [section]: nextVal }));
  };

  // Drag and drop for Cover Image
  const handleCoverDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveCover(true);
    } else if (e.type === "dragleave") {
      setDragActiveCover(false);
    }
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveCover(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readAndSetCover(file);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readAndSetCover(e.target.files[0]);
    }
  };

  const readAndSetCover = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert(isRtl ? 'عذراً، يرجى رفع ملف صورة صحيح فقط.' : 'Please upload a valid image file only.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCoverImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop for Gallery
  const handleGalleryDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveGallery(true);
    } else if (e.type === "dragleave") {
      setDragActiveGallery(false);
    }
  };

  const handleGalleryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveGallery(false);

    if (e.dataTransfer.files) {
      handleGalleryFiles(e.dataTransfer.files);
    }
  };

  const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleGalleryFiles(e.target.files);
    }
  };

  const handleGalleryFiles = (files: FileList) => {
    const currentCount = gallery.length;
    const filesToLoad = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (currentCount + filesToLoad.length > 10) {
      alert(isRtl 
        ? `⚠️ الحد الأقصى لمعرض الصور هو 10 صور فقط. لديك حالياً ${currentCount} صور.` 
        : `⚠️ Maximum limit of 10 gallery images exceeded. You currently have ${currentCount} images.`);
      return;
    }

    setGalleryUploadProgress(10);
    const loadedImages: string[] = [];

    filesToLoad.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          loadedImages.push(event.target.result as string);
          setGalleryUploadProgress(Math.round(((index + 1) / filesToLoad.length) * 100));

          if (loadedImages.length === filesToLoad.length) {
            setGallery(prev => [...prev, ...loadedImages].slice(0, 10));
            setGalleryUploadProgress(null);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddGalleryPreset = (url: string) => {
    if (gallery.length >= 10) {
      alert(isRtl 
        ? '⚠️ الحد الأقصى لمعرض الصور هو 10 صور فقط.' 
        : '⚠️ Maximum limit of 10 gallery images reached.');
      return;
    }
    if (gallery.includes(url)) return;
    setGallery(prev => [...prev, url]);
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    setGallery(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Contact change handler
  const handleContactChange = (field: keyof BusinessSettings, value: string) => {
    setContact(prev => ({ ...prev, [field]: value }));
  };

  // SAVE FLOW
  // 1. Save public page content (PUT /api/v1/tenant/public-page)
  // 2. Save business info (PUT /api/v1/tenant/settings/business)
  // 3. Refresh gallery state
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      // Validate: At least one section must remain visible
      const visibleCount = Object.values(sectionsVisibility).filter(v => v === true).length;
      if (visibleCount === 0) {
        throw new Error(isRtl 
          ? 'يجب إبقاء قسم واحد على الأقل مرئياً للعامة.' 
          : 'At least one section must remain visible.');
      }

      // 1. Save public page content
      const publicPagePayload: PublicPageData = {
        coverImage,
        sectionsVisibility,
        aboutTitleAr,
        aboutTitleEn,
        aboutTextAr,
        aboutTextEn,
        gallery
      };

      const pageRes = await fetch('/api/v1/tenant/public-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publicPagePayload)
      });

      if (!pageRes.ok) {
        const errJson = await pageRes.json();
        throw new Error(errJson.error || (isRtl ? 'فشل في حفظ إعدادات الصفحة العامة.' : 'Failed to save public page content.'));
      }

      // 2. Save business info
      const settingsRes = await fetch('/api/v1/tenant/settings/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact)
      });

      if (!settingsRes.ok) {
        const errJson = await settingsRes.json();
        throw new Error(errJson.error || (isRtl ? 'فشل في حفظ تفاصيل الاتصال والأعمال.' : 'Failed to save business settings.'));
      }

      // 3. Refresh gallery state (by refetching latest server state to confirm sync)
      await loadPageSetupAndSettings();

      setSuccessMsg(isRtl 
        ? '✨ تم حفظ وتطبيق تحديثات صفحة الهبوط ومعلومات الأعمال بنجاح!' 
        : '✨ Landing page content and business information saved successfully!');
      
      // Auto-dismiss success message
      setTimeout(() => setSuccessMsg(null), 5000);

    } catch (err: any) {
      setError(err.message || 'An error occurred during the save process.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-8 ${darkMode ? 'text-zinc-100' : 'text-neutral-800'}`}>
      
      {/* HUD CONTROL FOR PAGE STATUS */}
      <div className={`p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between ${
        darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-neutral-50 border-neutral-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="text-start">
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Layout size={14} className="text-brand-500 animate-pulse" />
              {isRtl ? 'منصة إدارة المحتوى والعرض الذكي' : 'REFAH Smart Content Management Engine'}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {isRtl 
                ? 'تحكم في المظهر البصري لصفحة الهبوط العامة، وتفاصيل العنوان ومعلومات وسائل التواصل الاجتماعي.' 
                : 'Configure guest landing, cover graphics, public columns visibility, and contact links.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadPageSetupAndSettings}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 ${
              darkMode ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
            }`}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {isRtl ? 'تحديث البيانات' : 'Sync Latest'}
          </button>
        </div>
      </div>

      {/* ERROR FEEDBACK */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-start animate-fade-in">
          <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-black text-rose-500">{isRtl ? 'خطأ في حفظ وتحديث البيانات' : 'Save Operations Interrupted'}</h4>
            <p className="text-[11px] text-rose-400 mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* SUCCESS FEEDBACK */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-start animate-fade-in">
          <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-black text-emerald-500">{isRtl ? 'تمت العملية بنجاح' : 'Changes Deployed'}</h4>
            <p className="text-[11px] text-emerald-400 mt-1 leading-relaxed">{successMsg}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-20 text-center space-y-4">
          <RefreshCw size={36} className="animate-spin text-brand-500 mx-auto" />
          <p className="text-xs text-zinc-400">{isRtl ? 'جاري قراءة وتوليد إعدادات صفحة الهبوط الفاخرة...' : 'Synchronizing content engines with REFAH public gateway...'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: CONTENT MANAGEMENT CONTROLS (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* 1. COVER IMAGE PANEL */}
            <div className={`p-6 rounded-2xl border text-start space-y-5 ${
              darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
            }`} id="cover-image-panel">
              <div className="flex items-center gap-2 border-b border-zinc-800/40 pb-3">
                <Image className="text-brand-500" size={16} />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">{isRtl ? '١. صورة الغلاف والبانر الرئيسي' : '1. Cover Image & Welcome Banner'}</h3>
              </div>

              {/* Cover Preview */}
              {coverImage ? (
                <div className="relative h-44 rounded-xl overflow-hidden border border-zinc-800 group">
                  <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCoverImage('')}
                      className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors cursor-pointer"
                      title={isRtl ? 'حذف الصورة الحالية' : 'Delete current cover'}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="p-2 bg-brand-500 text-white rounded-full hover:bg-brand-600 transition-colors cursor-pointer"
                      title={isRtl ? 'استبدال الصورة' : 'Replace cover'}
                    >
                      <Upload size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Drag & Drop uploader for Cover Image */
                <div
                  onDragEnter={handleCoverDrag}
                  onDragOver={handleCoverDrag}
                  onDragLeave={handleCoverDrag}
                  onDrop={handleCoverDrop}
                  onClick={() => coverInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    dragActiveCover 
                      ? 'border-brand-500 bg-brand-500/5' 
                      : darkMode ? 'border-zinc-800 hover:border-zinc-750 bg-zinc-950/10' : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50/50'
                  }`}
                >
                  <Upload size={28} className="mx-auto text-zinc-400 mb-2.5 animate-bounce" />
                  <p className="text-xs font-bold">{isRtl ? 'اسحب وأفلت صورة الغلاف هنا، أو انقر للتصفح والرفع' : 'Drag & drop a cover image here, or click to browse'}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{isRtl ? 'يدعم صيغ JPG, PNG, WEBP حتى حجم ٥ ميجابايت' : 'Supports JPG, PNG, WEBP files up to 5MB'}</p>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverFileChange}
                className="hidden"
              />

              {/* URL Input */}
              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-zinc-400 block">{isRtl ? 'رابط مخصص لصورة الغلاف' : 'Or enter custom Cover Image URL'}</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    placeholder="https://example.com/salon-hero.jpg"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-medium ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                    }`}
                  />
                </div>
              </div>

              {/* Presets Grid */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-zinc-500 block">{isRtl ? '💡 صور غلاف فخمة جاهزة ومقترحة:' : '💡 Preset gorgeous visual cover options:'}</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {coverPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCoverImage(preset.url)}
                      className={`relative h-14 rounded-lg overflow-hidden border transition-all text-start cursor-pointer group ${
                        coverImage === preset.url 
                          ? 'border-brand-500 ring-1 ring-brand-500' 
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <img src={preset.url} alt={preset.label} className="w-full h-full object-cover brightness-60 group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1 left-2 right-2 text-[9px] font-bold text-white truncate drop-shadow-md">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. SECTION VISIBILITY PANEL */}
            <div className={`p-6 rounded-2xl border text-start space-y-5 ${
              darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
            }`} id="sections-visibility-panel">
              <div className="flex items-center gap-2 border-b border-zinc-800/40 pb-3">
                <Eye className="text-brand-500" size={16} />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">{isRtl ? '٢. إظهار وإخفاء أقسام صفحة الهبوط العامة' : '2. Section Visibility & Public Hierarchy'}</h3>
              </div>
              <p className="text-[10px] text-zinc-400">
                {isRtl 
                  ? 'اختر الأقسام التي تود تفعيلها وعرضها لجمهورك على الصفحة الخارجية. يتطلب المظهر إبقاء قسم واحد على الأقل.' 
                  : 'Toggle visible sections for guests. Outgoing portal forces at least 1 module to stay rendered.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                {/* Services Toggle */}
                <button
                  type="button"
                  onClick={() => handleSectionToggle('services')}
                  className={`p-4 rounded-xl border flex items-center justify-between text-start transition-all cursor-pointer ${
                    sectionsVisibility.services 
                      ? 'bg-brand-500/5 border-brand-500/30 text-white' 
                      : 'bg-zinc-950/20 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div>
                    <span className={`font-black text-xs block ${sectionsVisibility.services ? 'text-brand-400' : 'text-zinc-500'}`}>
                      {isRtl ? 'قسم الخدمات الرئيسية' : 'Services Block'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">{isRtl ? 'عرض باقات التدليك والعناية' : 'Displays beauty treatments catalog'}</span>
                  </div>
                  {sectionsVisibility.services ? <Check className="text-brand-500" size={16} /> : <EyeOff size={16} />}
                </button>

                {/* Products Toggle */}
                <button
                  type="button"
                  onClick={() => handleSectionToggle('products')}
                  className={`p-4 rounded-xl border flex items-center justify-between text-start transition-all cursor-pointer ${
                    sectionsVisibility.products 
                      ? 'bg-brand-500/5 border-brand-500/30 text-white' 
                      : 'bg-zinc-950/20 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div>
                    <span className={`font-black text-xs block ${sectionsVisibility.products ? 'text-brand-400' : 'text-zinc-500'}`}>
                      {isRtl ? 'قسم منتجات العناية والبيع' : 'Retail Products Block'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">{isRtl ? 'عرض مستحضرات التجميل الراقية' : 'Displays purchaseable skin & hair inventory'}</span>
                  </div>
                  {sectionsVisibility.products ? <Check className="text-brand-500" size={16} /> : <EyeOff size={16} />}
                </button>

                {/* Reviews Toggle */}
                <button
                  type="button"
                  onClick={() => handleSectionToggle('reviews')}
                  className={`p-4 rounded-xl border flex items-center justify-between text-start transition-all cursor-pointer ${
                    sectionsVisibility.reviews 
                      ? 'bg-brand-500/5 border-brand-500/30 text-white' 
                      : 'bg-zinc-950/20 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div>
                    <span className={`font-black text-xs block ${sectionsVisibility.reviews ? 'text-brand-400' : 'text-zinc-500'}`}>
                      {isRtl ? 'قسم مراجعات وتقييمات الضيوف' : 'Guest Feedbacks Block'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">{isRtl ? 'نشر آراء العملاء الإيجابية المعتمدة' : 'Renders selected client rating streams'}</span>
                  </div>
                  {sectionsVisibility.reviews ? <Check className="text-brand-500" size={16} /> : <EyeOff size={16} />}
                </button>

                {/* About Toggle */}
                <button
                  type="button"
                  onClick={() => handleSectionToggle('about')}
                  className={`p-4 rounded-xl border flex items-center justify-between text-start transition-all cursor-pointer ${
                    sectionsVisibility.about 
                      ? 'bg-brand-500/5 border-brand-500/30 text-white' 
                      : 'bg-zinc-950/20 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div>
                    <span className={`font-black text-xs block ${sectionsVisibility.about ? 'text-brand-400' : 'text-zinc-500'}`}>
                      {isRtl ? 'قسم قصة صالون رفاه' : 'About Story Block'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">{isRtl ? 'شرح رؤية الصالون وتاريخه الفخم' : 'Prints premium brand heritage details'}</span>
                  </div>
                  {sectionsVisibility.about ? <Check className="text-brand-500" size={16} /> : <EyeOff size={16} />}
                </button>

              </div>
            </div>

            {/* 3. ABOUT CONTENT PANEL */}
            <div className={`p-6 rounded-2xl border text-start space-y-4 ${
              darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
            }`} id="about-content-panel">
              <div className="flex items-center gap-2 border-b border-zinc-800/40 pb-3">
                <FileText className="text-brand-500" size={16} />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">{isRtl ? '٣. محتوى ومقالات قصة وتاريخ صالون رفاه' : '3. Brand Story & About Content'}</h3>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Arabic Title */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-400 block">{isRtl ? 'العنوان التعريفي (العربية)' : 'Story Heading (Arabic)'}</label>
                    <input
                      type="text"
                      required
                      value={aboutTitleAr}
                      onChange={(e) => setAboutTitleAr(e.target.value)}
                      placeholder="عنوان قصة صالون رفاه..."
                      className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold ${
                        darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                      }`}
                    />
                  </div>

                  {/* English Title */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-400 block">{isRtl ? 'العنوان التعريفي (بالإنجليزية)' : 'Story Heading (English)'}</label>
                    <input
                      type="text"
                      required
                      value={aboutTitleEn}
                      onChange={(e) => setAboutTitleEn(e.target.value)}
                      placeholder="Story of REFAH..."
                      className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold ${
                        darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-855'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Arabic Text */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-400 block">{isRtl ? 'النص والمقال التعريفي (العربية)' : 'About Story Text (Arabic)'}</label>
                    <textarea
                      required
                      value={aboutTextAr}
                      onChange={(e) => setAboutTextAr(e.target.value)}
                      placeholder="اكتب سيرة موجزة وتفاصيل فخمة عن الصالون بالعربية..."
                      rows={5}
                      className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-medium leading-relaxed ${
                        darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                      }`}
                    />
                  </div>

                  {/* English Text */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-400 block">{isRtl ? 'النص والمقال التعريفي (بالإنجليزية)' : 'About Story Text (English)'}</label>
                    <textarea
                      required
                      value={aboutTextEn}
                      onChange={(e) => setAboutTextEn(e.target.value)}
                      placeholder="Write premium historical summary of the salon in English..."
                      rows={5}
                      className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-medium leading-relaxed ${
                        darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-855'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. GALLERY IMAGES PANEL */}
            <div className={`p-6 rounded-2xl border text-start space-y-4 ${
              darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
            }`} id="gallery-panel">
              <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Image className="text-brand-500" size={16} />
                  <h3 className="font-extrabold text-sm uppercase tracking-wider">{isRtl ? '٤. معرض الصور العام لصالون رفاه' : '4. REFAH Public Photo Gallery'}</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                  gallery.length >= 10 ? 'bg-rose-500/10 text-rose-400' : 'bg-brand-500/10 text-brand-500'
                }`}>
                  {isRtl ? `العدد: ${gallery.length} / ١٠` : `Total: ${gallery.length} / 10 max`}
                </span>
              </div>

              {/* Gallery Grid of current images */}
              {gallery.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {gallery.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 group bg-zinc-950">
                      <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(idx)}
                          className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors cursor-pointer"
                          title={isRtl ? 'إزالة الصورة من المعرض' : 'Delete photo'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <span className="absolute bottom-1 right-2 bg-black/70 px-1 py-0.5 rounded text-[8px] font-mono text-zinc-300 font-bold">#{idx + 1}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/5">
                  <p className="text-xs">{isRtl ? 'لا توجد صور مضافة بمعرض الصالون حالياً.' : 'Your guest photo gallery is empty.'}</p>
                </div>
              )}

              {/* Drag and drop zone for Gallery */}
              <div
                onDragEnter={handleGalleryDrag}
                onDragOver={handleGalleryDrag}
                onDragLeave={handleGalleryDrag}
                onDrop={handleGalleryDrop}
                onClick={() => galleryInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragActiveGallery 
                    ? 'border-brand-500 bg-brand-500/5' 
                    : darkMode ? 'border-zinc-800 hover:border-zinc-750 bg-zinc-950/10' : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50/50'
                }`}
              >
                <Upload size={24} className="mx-auto text-zinc-400 mb-2" />
                <p className="text-xs font-bold">{isRtl ? 'اسحب وأفلت صور إضافية هنا، أو انقر للتصفح والرفع' : 'Drag & drop photos here, or click to browse files'}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{isRtl ? 'بحد أقصى ١٠ صور للمعرض الكامل للجمهور' : 'Up to 10 images total for the public client feed'}</p>
              </div>

              {/* Upload Progress Bar if active */}
              {galleryUploadProgress !== null && (
                <div className="w-full bg-zinc-950 border border-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-brand-500 h-full transition-all duration-300" 
                    style={{ width: `${galleryUploadProgress}%` }}
                  />
                </div>
              )}

              {/* Hidden file input for gallery */}
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleGalleryFileChange}
                className="hidden"
              />

              {/* Gallery Image suggestions */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-zinc-500 block">{isRtl ? '💡 صور جاهزة لمعرض الخدمات الراقية لصالون رفاه:' : '💡 Add instant premium preset photos:'}</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {galleryPresets.map((preset, idx) => {
                    const isAdded = gallery.includes(preset);
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAdded || gallery.length >= 10}
                        onClick={() => handleAddGalleryPreset(preset)}
                        className={`relative h-12 rounded-lg overflow-hidden border transition-all text-start cursor-pointer group ${
                          isAdded 
                            ? 'opacity-40 border-emerald-500/30' 
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover brightness-60" />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                          {isAdded ? (isRtl ? 'مضاف' : 'Added') : (isRtl ? '+ إضافة' : '+ Add')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. CONTACT INFORMATION PANEL */}
            <div className={`p-6 rounded-2xl border text-start space-y-4 ${
              darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
            }`} id="contact-info-panel">
              <div className="flex items-center gap-2 border-b border-zinc-800/40 pb-3">
                <MapPin className="text-brand-500" size={16} />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">{isRtl ? '٥. معلومات وتفاصيل الاتصال والأعمال' : '5. Contact & Business Information'}</h3>
              </div>
              <p className="text-[10px] text-zinc-400">
                {isRtl 
                  ? 'يرجى كتابة تفاصيل الاتصال، موقع الخريطة والروابط الرسمية لوسائل التواصل الاجتماعي للفرع.' 
                  : 'Enter direct address, Google Maps link, and official social media parameters for your public footer.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                {/* Address */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <MapPin size={12} className="text-zinc-500" />
                    {isRtl ? 'العنوان الجغرافي التفصيلي' : 'Business Address'}
                  </label>
                  <input
                    type="text"
                    value={contact.address}
                    onChange={(e) => handleContactChange('address', e.target.value)}
                    placeholder={isRtl ? 'مثال: طريق التخصصي، حي المعذر، الرياض، المملكة العربية السعودية' : 'e.g. Al Takhassusi St, Riyadh, Saudi Arabia'}
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-medium ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                    }`}
                  />
                </div>

                {/* Google Map Link */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Map size={12} className="text-zinc-500" />
                    {isRtl ? 'رابط خريطة جوجل' : 'Google Map Link'}
                  </label>
                  <input
                    type="url"
                    value={contact.googleMapLink}
                    onChange={(e) => handleContactChange('googleMapLink', e.target.value)}
                    placeholder="https://maps.google.com/?q=..."
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-mono text-[11px] ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                    }`}
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Phone size={12} className="text-zinc-500" />
                    {isRtl ? 'هاتف التواصل الرئيسي' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) => handleContactChange('phone', e.target.value)}
                    placeholder="+966 11 488 2323"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                    }`}
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Mail size={12} className="text-zinc-500" />
                    {isRtl ? 'البريد الإلكتروني الرسمي' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => handleContactChange('email', e.target.value)}
                    placeholder="prestige@refahsalon.com"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Globe size={12} className="text-zinc-500" />
                    {isRtl ? 'رابط الموقع الإلكتروني' : 'Website'}
                  </label>
                  <input
                    type="url"
                    value={contact.website}
                    onChange={(e) => handleContactChange('website', e.target.value)}
                    placeholder="https://refahsalon.com"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-mono ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

                {/* Instagram */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Instagram size={12} className="text-zinc-500" />
                    {isRtl ? 'انستغرام' : 'Instagram'}
                  </label>
                  <input
                    type="text"
                    value={contact.instagram}
                    onChange={(e) => handleContactChange('instagram', e.target.value)}
                    placeholder="@refah.salon"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

                {/* Twitter */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Twitter size={12} className="text-zinc-500" />
                    {isRtl ? 'تويتر (X)' : 'Twitter (X)'}
                  </label>
                  <input
                    type="text"
                    value={contact.twitter}
                    onChange={(e) => handleContactChange('twitter', e.target.value)}
                    placeholder="@refah_salon"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

                {/* Tiktok */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <LinkIcon size={12} className="text-zinc-500" />
                    {isRtl ? 'تيك توك' : 'TikTok'}
                  </label>
                  <input
                    type="text"
                    value={contact.tiktok}
                    onChange={(e) => handleContactChange('tiktok', e.target.value)}
                    placeholder="@refah.tiktok"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

                {/* Youtube */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Youtube size={12} className="text-zinc-500" />
                    {isRtl ? 'يوتيوب' : 'YouTube'}
                  </label>
                  <input
                    type="text"
                    value={contact.youtube}
                    onChange={(e) => handleContactChange('youtube', e.target.value)}
                    placeholder="https://youtube.com/..."
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

                {/* Linkedin */}
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Linkedin size={12} className="text-zinc-500" />
                    {isRtl ? 'لينكد إن' : 'LinkedIn'}
                  </label>
                  <input
                    type="text"
                    value={contact.linkedin}
                    onChange={(e) => handleContactChange('linkedin', e.target.value)}
                    placeholder="company/refah"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

                {/* Snapchat */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-bold text-zinc-400 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-zinc-500" />
                    {isRtl ? 'سناب شات' : 'Snapchat'}
                  </label>
                  <input
                    type="text"
                    value={contact.snapchat}
                    onChange={(e) => handleContactChange('snapchat', e.target.value)}
                    placeholder="@refah.snap"
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>

              </div>
            </div>

            {/* 6. SAVE BUTTON BAR */}
            <div className={`p-4 rounded-xl border flex justify-end gap-3 items-center ${
              darkMode ? 'bg-zinc-950/40 border-zinc-800' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <button
                type="button"
                onClick={loadPageSetupAndSettings}
                className={`px-4 py-2.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  darkMode ? 'border-zinc-800 text-zinc-400 hover:text-white' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {isRtl ? 'إلغاء التغييرات' : 'Discard Changes'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAll}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-600 text-white text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-500/10 hover:scale-101"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {isRtl ? 'حفظ ونشر التعديلات الحية' : 'Save & Publish Live Changes'}
              </button>
            </div>

          </div>

          {/* RIGHT: INTERACTIVE LIVE PUBLIC PAGE PREVIEW (5 cols) */}
          <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
            
            <div className={`p-4 rounded-2xl border text-start space-y-4 ${
              darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-neutral-150 shadow-xs'
            }`}>
              <div className="flex justify-between items-center border-b border-zinc-850 pb-2.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Smartphone size={13} className="text-brand-500 animate-pulse" />
                  {isRtl ? 'معاينة الشاشات الخارجية للعملاء' : 'Live Guest Landing Preview'}
                </span>
                
                {/* Device switches */}
                <div className="flex bg-zinc-950 border border-zinc-850 p-0.5 rounded-lg">
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold cursor-pointer transition-all ${
                      previewDevice === 'mobile' ? 'bg-brand-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {isRtl ? 'جوال' : 'Mobile'}
                  </button>
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold cursor-pointer transition-all ${
                      previewDevice === 'desktop' ? 'bg-brand-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {isRtl ? 'حاسوب' : 'Desktop'}
                  </button>
                </div>
              </div>

              {/* Simulated browser window wrapper */}
              <div className={`mx-auto border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative bg-zinc-950 font-sans transition-all duration-500 ${
                previewDevice === 'mobile' ? 'max-w-[340px] h-[580px]' : 'w-full h-[520px]'
              }`}>
                
                {/* Top browser address bar */}
                <div className="p-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 select-none">
                  <div className="flex gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="bg-zinc-950 border border-zinc-850/80 rounded-md py-0.5 px-3 text-center truncate flex-1 flex items-center justify-center gap-1 font-mono text-[8px]">
                    <Globe size={9} className="text-zinc-600" />
                    <span>refah.salon.com/live</span>
                  </div>
                </div>

                {/* Simulated device screen body */}
                <div className="h-full overflow-y-auto pb-16 bg-neutral-950 text-white text-xs scrollbar-thin text-start">
                  
                  {/* Public Hero / Cover section */}
                  <div className="relative h-44 bg-zinc-900 flex flex-col justify-end">
                    {coverImage ? (
                      <img src={coverImage} alt="Cover Preview" className="absolute inset-0 w-full h-full object-cover brightness-40" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-tr from-brand-950 to-neutral-950 brightness-50" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
                    
                    <div className="relative p-4 space-y-1">
                      <span className="bg-brand-500/80 text-[8px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase inline-block">
                        {isRtl ? 'فرع الرياض الفاخر' : 'Riyadh Luxury Branch'}
                      </span>
                      <h4 className="text-sm font-black text-white leading-tight font-serif drop-shadow-md">
                        {isRtl ? 'صالون رفاه - تجربة تفوق الخيال' : 'REFAH - Luxury Beyond Expectations'}
                      </h4>
                      <p className="text-[9px] text-zinc-300">
                        {isRtl ? 'المعذر، الرياض • احجز موعدك بنقرة واحدة' : 'Al Ma\'ather, Riyadh • Instant Booking'}
                      </p>
                    </div>
                  </div>

                  {/* NAV / HEADING SIMULATOR */}
                  <div className="bg-zinc-900/80 backdrop-blur-md p-2.5 sticky top-0 z-20 border-b border-zinc-850 flex justify-between items-center text-[10px] font-bold">
                    <span className="text-brand-400 tracking-wider font-extrabold">REFAH PRESTIGE</span>
                    <button className="bg-brand-500 text-white text-[9px] px-2.5 py-1 rounded-md font-black">
                      {isRtl ? 'احجز الآن' : 'Book Session'}
                    </button>
                  </div>

                  {/* Body Content with simulated visibility sections */}
                  <div className="p-4 space-y-6">
                    
                    {/* ABOUT story SECTION */}
                    {sectionsVisibility.about && (
                      <div className="space-y-2 border-s-2 border-brand-500 pl-3 py-1">
                        <span className="text-[8px] font-bold text-brand-400 uppercase tracking-wider block">
                          {isRtl ? 'من نحن' : 'Our Story'}
                        </span>
                        <h5 className="font-extrabold text-xs text-white">
                          {isRtl ? aboutTitleAr || 'قصة صالون رفاه' : aboutTitleEn || 'The Story of REFAH'}
                        </h5>
                        <p className="text-[10px] text-zinc-400 leading-relaxed text-justify">
                          {isRtl 
                            ? aboutTextAr || 'مرحباً بكم في أفخم وجهات الاسترخاء والجمال بالرياض...' 
                            : aboutTextEn || 'Welcome to the premier luxury relaxation and beauty destination...'}
                        </p>
                      </div>
                    )}

                    {/* SERVICES SECTION */}
                    {sectionsVisibility.services && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-bold text-brand-400 uppercase tracking-wider">
                            {isRtl ? 'قائمة الخدمات الفاخرة' : 'Prestigious Services'}
                          </span>
                          <span className="text-[8px] text-zinc-500">{isRtl ? 'عرض الكل' : 'View all'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
                            <p className="font-extrabold text-zinc-200">{isRtl ? 'مساج الأحجار الساخنة' : 'Hot Stone Massage'}</p>
                            <span className="text-brand-400 block mt-0.5 font-bold">350 SAR</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
                            <p className="font-extrabold text-zinc-200">{isRtl ? 'تصفيف وقص احترافي' : 'Premium Styling'}</p>
                            <span className="text-brand-400 block mt-0.5 font-bold">220 SAR</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PRODUCTS SECTION */}
                    {sectionsVisibility.products && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-bold text-brand-400 uppercase tracking-wider">
                            {isRtl ? 'مستحضرات التجميل الراقية للبيع' : 'Featured Care Products'}
                          </span>
                          <span className="text-[8px] text-zinc-500">{isRtl ? 'تسوق' : 'Shop'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 text-center">
                            <div className="h-14 bg-zinc-800 rounded-md mb-1.5 flex items-center justify-center text-zinc-600 text-lg">🧴</div>
                            <p className="font-bold text-zinc-300 truncate">{isRtl ? 'كريم الكولاجين الفاخر' : 'Luxury Collagen Cream'}</p>
                            <span className="text-brand-400 font-bold block mt-0.5">450 SAR</span>
                          </div>
                          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 text-center">
                            <div className="h-14 bg-zinc-800 rounded-md mb-1.5 flex items-center justify-center text-zinc-600 text-lg">🧪</div>
                            <p className="font-bold text-zinc-300 truncate">{isRtl ? 'سيروم حمض الهيالورونيك' : 'Hyaluronic Serum'}</p>
                            <span className="text-brand-400 font-bold block mt-0.5">290 SAR</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* REVIEWS SECTION */}
                    {sectionsVisibility.reviews && (
                      <div className="space-y-3">
                        <span className="text-[8px] font-bold text-brand-400 uppercase tracking-wider block">
                          {isRtl ? 'تقييمات وآراء الضيوف' : 'Guest Reviews & Feedbacks'}
                        </span>
                        <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-850 space-y-1.5">
                          <div className="flex justify-between items-center text-[8px]">
                            <span className="font-extrabold text-zinc-300">{isRtl ? 'هيا البنيان' : 'Haya Al-Bunyan'}</span>
                            <span className="text-amber-500 font-bold">★★★★★</span>
                          </div>
                          <p className="text-[9px] text-zinc-400 italic">
                            {isRtl ? '"تجربة استثنائية بكل المعايير! الفرع غاية في الفخامة والروعة..."' : '"An exceptional experience by all standards! The branch is extremely luxurious..."'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* PHOTO GALLERY SECTION */}
                    {gallery.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[8px] font-bold text-brand-400 uppercase tracking-wider block">
                          {isRtl ? 'ألبوم صور من داخل الفرع' : 'Photo Album Gallery'}
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {gallery.slice(0, 4).map((img, index) => (
                            <div key={index} className="aspect-square rounded-md overflow-hidden bg-zinc-900 border border-zinc-850">
                              <img src={img} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* FOOTER & CONTACT DETAILS */}
                    <div className="pt-6 border-t border-zinc-850 space-y-4 text-[9px] text-zinc-400">
                      
                      <div className="space-y-2">
                        <span className="text-[8px] font-bold text-brand-400 uppercase tracking-wider block">
                          {isRtl ? 'تواصل معنا' : 'Contact Details'}
                        </span>
                        
                        {contact.address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin size={10} className="text-zinc-500 shrink-0 mt-0.5" />
                            <span className="leading-normal">{contact.address}</span>
                          </div>
                        )}

                        {contact.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={10} className="text-zinc-500" />
                            <span>{contact.phone}</span>
                          </div>
                        )}

                        {contact.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail size={10} className="text-zinc-500" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}

                        {contact.website && (
                          <div className="flex items-center gap-1.5">
                            <Globe size={10} className="text-zinc-500" />
                            <span className="truncate text-brand-400">{contact.website}</span>
                          </div>
                        )}
                      </div>

                      {/* SOCIAL MEDIA BAR */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-900">
                        {contact.instagram && (
                          <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-850 flex items-center gap-1 text-[8px] text-zinc-300">
                            <Instagram size={8} />
                            <span>Insta</span>
                          </span>
                        )}
                        {contact.twitter && (
                          <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-850 flex items-center gap-1 text-[8px] text-zinc-300">
                            <Twitter size={8} />
                            <span>X</span>
                          </span>
                        )}
                        {contact.tiktok && (
                          <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-850 flex items-center gap-1 text-[8px] text-zinc-300">
                            <LinkIcon size={8} />
                            <span>TikTok</span>
                          </span>
                        )}
                        {contact.youtube && (
                          <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-850 flex items-center gap-1 text-[8px] text-zinc-300">
                            <Youtube size={8} />
                            <span>YouTube</span>
                          </span>
                        )}
                        {contact.snapchat && (
                          <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-850 flex items-center gap-1 text-[8px] text-zinc-300">
                            <Sparkles size={8} />
                            <span>Snap</span>
                          </span>
                        )}
                      </div>

                    </div>

                  </div>
                </div>

                {/* Bottom navigation helper indicator */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-zinc-700 rounded-full" />

              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
