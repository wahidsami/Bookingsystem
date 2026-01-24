'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { PhotoIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { tenantApi } from '@/lib/api';

interface HeroSlider {
  id: string;
  backgroundImage: string | null;
  taglineEn: string;
  taglineAr: string;
  heroTitleEn: string;
  heroTitleAr: string;
  heroTitleColor: string;
  subtitleEn: string;
  subtitleAr: string;
  subtitleColor: string;
  ctaButtonTextEn: string;
  ctaButtonTextAr: string;
  ctaButtonType: 'service' | 'product' | '';
  ctaButtonItemId: string;
  textAlignment: 'left' | 'center' | 'right';
  order: number;
}

export function HeroSliderTab() {
  const t = useTranslations('MyPage.HeroSlider');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sliders, setSliders] = useState<HeroSlider[]>([]);
  const [editingSlider, setEditingSlider] = useState<HeroSlider | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Services and Products for CTA dropdowns
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState<HeroSlider>({
    id: '',
    backgroundImage: null,
    taglineEn: '',
    taglineAr: '',
    heroTitleEn: '',
    heroTitleAr: '',
    heroTitleColor: '#FFFFFF',
    subtitleEn: '',
    subtitleAr: '',
    subtitleColor: '#FFFFFF',
    ctaButtonTextEn: '',
    ctaButtonTextAr: '',
    ctaButtonType: '',
    ctaButtonItemId: '',
    textAlignment: 'center',
    order: 0
  });

  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);

  useEffect(() => {
    loadHeroSliders();
    loadServicesAndProducts();
  }, []);

  const loadHeroSliders = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await tenantApi.getPublicPageData();
      console.log('Hero sliders full response:', JSON.stringify(response, null, 2));
      if (response.success && response.data) {
        // heroSliders is at the root level of data, not nested
        const heroSliders = response.data.heroSliders || [];
        console.log('Hero sliders from response:', heroSliders);
        console.log('Hero sliders length:', heroSliders.length);
        // Fix image paths to include /uploads/ prefix
        const fixedSliders = heroSliders.map((slider: HeroSlider) => ({
          ...slider,
          backgroundImage: slider.backgroundImage 
            ? (slider.backgroundImage.startsWith('http') 
                ? slider.backgroundImage 
                : slider.backgroundImage.startsWith('/uploads/')
                  ? `http://localhost:5000${slider.backgroundImage}`
                  : `http://localhost:5000/uploads/${slider.backgroundImage}`)
            : null
        }));
        console.log('Fixed sliders:', fixedSliders);
        setSliders(fixedSliders);
      } else {
        console.error('Failed to load hero sliders - response not successful:', response);
        setError('Failed to load hero sliders');
      }
    } catch (err: any) {
      console.error('Failed to load hero sliders:', err);
      setError(err.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const loadServicesAndProducts = async () => {
    try {
      const [servicesRes, productsRes] = await Promise.all([
        tenantApi.getServices({ isActive: true }),
        tenantApi.getProducts({ isAvailable: true })
      ]);
      if (servicesRes.success) {
        setServices(servicesRes.services || []);
      }
      if (productsRes.success) {
        setProducts(productsRes.products || []);
      }
    } catch (err) {
      console.error('Failed to load services/products:', err);
    }
  };

  const handleBackgroundImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackgroundImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNew = () => {
    setEditingSlider(null);
    setFormData({
      id: Date.now().toString(),
      backgroundImage: null,
      taglineEn: '',
      taglineAr: '',
      heroTitleEn: '',
      heroTitleAr: '',
      heroTitleColor: '#FFFFFF',
      subtitleEn: '',
      subtitleAr: '',
      subtitleColor: '#FFFFFF',
      ctaButtonTextEn: '',
      ctaButtonTextAr: '',
      ctaButtonType: '',
      ctaButtonItemId: '',
      textAlignment: 'center',
      order: sliders.length
    });
    setBackgroundImageFile(null);
    setBackgroundImagePreview(null);
    setShowForm(true);
  };

  const handleEdit = (slider: HeroSlider) => {
      setEditingSlider(slider);
      setFormData({ ...slider });
      if (slider.backgroundImage) {
        setBackgroundImagePreview(slider.backgroundImage.startsWith('http') ? slider.backgroundImage : `http://localhost:5000/uploads/${slider.backgroundImage}`);
      } else {
        setBackgroundImagePreview(null);
      }
    setBackgroundImageFile(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    
    const updatedSliders = sliders.filter(s => s.id !== id);
    await saveSliders(updatedSliders);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSlider(null);
    setFormData({
      id: '',
      backgroundImage: null,
      taglineEn: '',
      taglineAr: '',
      heroTitleEn: '',
      heroTitleAr: '',
      heroTitleColor: '#FFFFFF',
      subtitleEn: '',
      subtitleAr: '',
      subtitleColor: '#FFFFFF',
      ctaButtonTextEn: '',
      ctaButtonTextAr: '',
      ctaButtonType: '',
      ctaButtonItemId: '',
      textAlignment: 'center',
      order: 0
    });
    setBackgroundImageFile(null);
    setBackgroundImagePreview(null);
  };

  const handleSaveSlider = async () => {
    try {
      setSaving(true);
      setError(null);

      const formDataToSend = new FormData();
      
      // If editing, include slider ID
      if (editingSlider) {
        formDataToSend.append('sliderId', formData.id);
        // Keep existing image if no new file
        if (!backgroundImageFile && formData.backgroundImage) {
          // Extract just the path part (remove http://localhost:5000/uploads/ if present)
          let imagePath = formData.backgroundImage;
          if (imagePath.includes('/uploads/')) {
            imagePath = imagePath.split('/uploads/')[1];
          } else if (imagePath.startsWith('http://localhost:5000')) {
            imagePath = imagePath.replace('http://localhost:5000', '');
          }
          formDataToSend.append('existingBackgroundImage', imagePath);
        }
      }

      // Background image
      if (backgroundImageFile) {
        formDataToSend.append('backgroundImage', backgroundImageFile);
      }

      // Form fields
      formDataToSend.append('taglineEn', formData.taglineEn);
      formDataToSend.append('taglineAr', formData.taglineAr);
      formDataToSend.append('heroTitleEn', formData.heroTitleEn);
      formDataToSend.append('heroTitleAr', formData.heroTitleAr);
      formDataToSend.append('heroTitleColor', formData.heroTitleColor);
      formDataToSend.append('subtitleEn', formData.subtitleEn);
      formDataToSend.append('subtitleAr', formData.subtitleAr);
      formDataToSend.append('subtitleColor', formData.subtitleColor);
      formDataToSend.append('ctaButtonTextEn', formData.ctaButtonTextEn);
      formDataToSend.append('ctaButtonTextAr', formData.ctaButtonTextAr);
      formDataToSend.append('ctaButtonType', formData.ctaButtonType);
      formDataToSend.append('ctaButtonItemId', formData.ctaButtonItemId);
      formDataToSend.append('textAlignment', formData.textAlignment);
      formDataToSend.append('order', formData.order.toString());

      const response = await tenantApi.updateHeroSlider(formDataToSend);
      console.log('Save hero slider response:', response);
      
      if (response.success) {
        setSuccess(t('saved'));
        // Reload sliders immediately without showing loading state
        try {
          const reloadResponse = await tenantApi.getPublicPageData();
          console.log('Reload response:', reloadResponse);
          if (reloadResponse.success && reloadResponse.data) {
            const heroSliders = reloadResponse.data.heroSliders || [];
            console.log('Hero sliders from reload:', heroSliders);
            // Fix image paths to include /uploads/ prefix
            const fixedSliders = heroSliders.map((slider: HeroSlider) => ({
              ...slider,
              backgroundImage: slider.backgroundImage 
                ? (slider.backgroundImage.startsWith('http') 
                    ? slider.backgroundImage 
                    : slider.backgroundImage.startsWith('/uploads/')
                      ? `http://localhost:5000${slider.backgroundImage}`
                      : `http://localhost:5000/uploads/${slider.backgroundImage}`)
                : null
            }));
            console.log('Fixed sliders to set:', fixedSliders);
            setSliders(fixedSliders);
            // Close the form immediately after setting sliders and reset form state
            setShowForm(false);
            setEditingSlider(null);
            setFormData({
              id: '',
              backgroundImage: null,
              taglineEn: '',
              taglineAr: '',
              heroTitleEn: '',
              heroTitleAr: '',
              heroTitleColor: '#FFFFFF',
              subtitleEn: '',
              subtitleAr: '',
              subtitleColor: '#FFFFFF',
              ctaButtonTextEn: '',
              ctaButtonTextAr: '',
              ctaButtonType: '',
              ctaButtonItemId: '',
              textAlignment: 'center',
              order: 0
            });
            setBackgroundImageFile(null);
            setBackgroundImagePreview(null);
          } else {
            console.error('Reload response not successful:', reloadResponse);
          }
        } catch (reloadErr) {
          console.error('Failed to reload sliders:', reloadErr);
          // Still reload using the normal function as fallback
          await loadHeroSliders(false);
        }
        setTimeout(() => {
          setSuccess(null);
        }, 2000);
      } else {
        throw new Error(response.message || t('saveError'));
      }
    } catch (err: any) {
      setError(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const saveSliders = async (updatedSliders: HeroSlider[]) => {
    try {
      setSaving(true);
      const formDataToSend = new FormData();
      formDataToSend.append('heroSliders', JSON.stringify(updatedSliders));
      await tenantApi.updatePublicPageData(formDataToSend);
      setSliders(updatedSliders);
      setSuccess(t('deleted'));
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message || t('deleteError'));
    } finally {
      setSaving(false);
    }
  };

  const getAvailableItems = () => {
    if (formData.ctaButtonType === 'service') {
      return services;
    } else if (formData.ctaButtonType === 'product') {
      return products;
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('title')}
        </h2>
        {!showForm && (
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <PlusIcon className="w-5 h-5" />
            {t('addNew')}
          </button>
        )}
      </div>

      {/* Sliders Grid/List */}
      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">{t('loading') || 'Loading...'}</p>
            </div>
          ) : sliders.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {t('noSliders')}
            </div>
          ) : (
            sliders.map((slider) => (
              <div key={slider.id} className="relative border border-gray-200 rounded-lg overflow-hidden group">
                {/* Thumbnail */}
                <div className="relative h-48 bg-gray-100">
                  {slider.backgroundImage ? (
                    <img
                      src={slider.backgroundImage.startsWith('http') ? slider.backgroundImage : `http://localhost:5000/uploads/${slider.backgroundImage}`}
                      alt="Hero Slider"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  {/* Overlay with text preview */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
                    <div className="text-white text-center" style={{ textAlign: slider.textAlignment }}>
                      {slider.taglineEn && (
                        <p className="text-xs mb-1">{slider.taglineEn}</p>
                      )}
                      <h3 className="text-lg font-bold mb-1" style={{ color: slider.heroTitleColor }}>
                        {slider.heroTitleEn || slider.heroTitleAr}
                      </h3>
                      {slider.subtitleEn && (
                        <p className="text-xs" style={{ color: slider.subtitleColor }}>
                          {slider.subtitleEn}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="p-3 bg-white flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {t('slider')} #{sliders.indexOf(slider) + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(slider)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title={t('edit')}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(slider.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title={t('delete')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="space-y-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {editingSlider ? t('editSlider') : t('addNewSlider')}
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-600 hover:text-gray-800"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Background Image */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('backgroundImage')} ({t('recommendedSize')})
            </label>
            <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {backgroundImagePreview && (
                <div className="relative w-64 h-32 rounded-lg overflow-hidden border border-gray-300">
                  <img src={backgroundImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setBackgroundImagePreview(null);
                      setBackgroundImageFile(null);
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
              <label className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                {backgroundImagePreview ? t('changeImage') : t('uploadImage')}
                <input type="file" accept="image/*" onChange={handleBackgroundImageChange} className="hidden" />
              </label>
            </div>
          </div>

          {/* Tagline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('taglineEn')} ({t('optional')})
              </label>
              <input
                type="text"
                value={formData.taglineEn}
                onChange={(e) => setFormData({ ...formData, taglineEn: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
                placeholder={t('taglineEnPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('taglineAr')} ({t('optional')})
              </label>
              <input
                type="text"
                value={formData.taglineAr}
                onChange={(e) => setFormData({ ...formData, taglineAr: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                style={{ textAlign: 'right' }}
                placeholder={t('taglineArPlaceholder')}
              />
            </div>
          </div>

          {/* Hero Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('heroTitleEn')} *
              </label>
              <input
                type="text"
                value={formData.heroTitleEn}
                onChange={(e) => setFormData({ ...formData, heroTitleEn: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('heroTitleAr')} *
              </label>
              <input
                type="text"
                value={formData.heroTitleAr}
                onChange={(e) => setFormData({ ...formData, heroTitleAr: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                style={{ textAlign: 'right' }}
                required
              />
            </div>
          </div>

          {/* Hero Title Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('heroTitleColor')}
            </label>
            <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <input
                type="color"
                value={formData.heroTitleColor}
                onChange={(e) => setFormData({ ...formData, heroTitleColor: e.target.value })}
                className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={formData.heroTitleColor}
                onChange={(e) => setFormData({ ...formData, heroTitleColor: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          {/* Subtitle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('subtitleEn')} ({t('optional')})
              </label>
              <textarea
                value={formData.subtitleEn}
                onChange={(e) => setFormData({ ...formData, subtitleEn: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
                placeholder={t('subtitleEnPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('subtitleAr')} ({t('optional')})
              </label>
              <textarea
                value={formData.subtitleAr}
                onChange={(e) => setFormData({ ...formData, subtitleAr: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                style={{ textAlign: 'right' }}
                placeholder={t('subtitleArPlaceholder')}
              />
            </div>
          </div>

          {/* Subtitle Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('subtitleColor')}
            </label>
            <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <input
                type="color"
                value={formData.subtitleColor}
                onChange={(e) => setFormData({ ...formData, subtitleColor: e.target.value })}
                className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={formData.subtitleColor}
                onChange={(e) => setFormData({ ...formData, subtitleColor: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          {/* CTA Button */}
          <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('ctaButton')}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('ctaButtonTextEn')} *
                </label>
                <input
                  type="text"
                  value={formData.ctaButtonTextEn}
                  onChange={(e) => setFormData({ ...formData, ctaButtonTextEn: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('ctaButtonTextAr')} *
                </label>
                <input
                  type="text"
                  value={formData.ctaButtonTextAr}
                  onChange={(e) => setFormData({ ...formData, ctaButtonTextAr: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  style={{ textAlign: 'right' }}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('ctaButtonType')} *
                </label>
                <select
                  value={formData.ctaButtonType}
                  onChange={(e) => {
                    setFormData({ ...formData, ctaButtonType: e.target.value as 'service' | 'product' | '', ctaButtonItemId: '' });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">{t('selectType')}</option>
                  <option value="service">{t('service')}</option>
                  <option value="product">{t('product')}</option>
                </select>
              </div>
              {formData.ctaButtonType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('selectItem')} *
                  </label>
                  <select
                    value={formData.ctaButtonItemId}
                    onChange={(e) => setFormData({ ...formData, ctaButtonItemId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">{t('selectItem')}</option>
                    {getAvailableItems().map((item) => (
                      <option key={item.id} value={item.id}>
                        {locale === 'ar' ? (item.name_ar || item.name_en) : (item.name_en || item.name_ar)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Text Alignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('textAlignment')}
            </label>
            <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {(['left', 'center', 'right'] as const).map((align) => (
                <label key={align} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="textAlignment"
                    value={align}
                    checked={formData.textAlignment === align}
                    onChange={(e) => setFormData({ ...formData, textAlignment: e.target.value as 'left' | 'center' | 'right' })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">{t(`alignment.${align}`)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSaveSlider}
              disabled={saving || !formData.heroTitleEn || !formData.heroTitleAr || !formData.ctaButtonTextEn || !formData.ctaButtonTextAr || !formData.ctaButtonType || !formData.ctaButtonItemId}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

