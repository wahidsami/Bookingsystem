'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getImageUrl, tenantApi } from '@/lib/api';
import { SwatchIcon, PaintBrushIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface GeneralSettings {
  template: 'template1' | 'template2' | 'template3';
  theme: {
    primaryColor: string;
    secondaryColor: string;
    helperColor: string;
  };
  sections: {
    heroSlider: boolean;
    services: boolean;
    products: boolean;
    callToAction: boolean;
  };
  logo?: string;
}

const TEMPLATE_OPTIONS = [
  { id: 'template1', name: 'Template 1', description: 'Modern layout with sidebar navigation' },
  { id: 'template2', name: 'Template 2', description: 'Classic layout with top navigation' },
  { id: 'template3', name: 'Template 3', description: 'Minimal layout with centered content' },
];

export function GeneralSettingsTab() {
  const t = useTranslations('MyPage.GeneralSettings');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [settings, setSettings] = useState<GeneralSettings>({
    template: 'template1',
    theme: {
      primaryColor: '#3B82F6',
      secondaryColor: '#8B5CF6',
      helperColor: '#10B981',
    },
    sections: {
      heroSlider: true,
      services: true,
      products: true,
      callToAction: true,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getPublicPageData();
      if (response.success && response.data) {
        const generalSettings = response.data.generalSettings || {};
        
        setSettings({
          template: generalSettings.template || 'template1',
          theme: {
            primaryColor: generalSettings.theme?.primaryColor || '#3B82F6',
            secondaryColor: generalSettings.theme?.secondaryColor || '#8B5CF6',
            helperColor: generalSettings.theme?.helperColor || '#10B981',
          },
          sections: {
            heroSlider: generalSettings.sections?.heroSlider !== false, // Default true
            services: generalSettings.sections?.services !== false, // Default true
            products: generalSettings.sections?.products !== false, // Default true
            callToAction: generalSettings.sections?.callToAction !== false, // Default true
          },
          logo: generalSettings.logo,
        });
        
        // Set logo preview if logo exists
        if (generalSettings.logo) {
          setLogoPreview(generalSettings.logo.startsWith('http') 
            ? generalSettings.logo 
            : getImageUrl(generalSettings.logo));
        }
      }
    } catch (err: any) {
      console.error('Failed to load general settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const formData = new FormData();
      
      // Add logo file if selected
      if (logoFile) {
        formData.append('publicPageLogo', logoFile);
      } else if (settings.logo) {
        // Keep existing logo if no new file selected
        formData.append('existingPublicPageLogo', settings.logo);
      }
      
      // Create settings object without logo (logo is handled separately)
      const { logo, ...settingsWithoutLogo } = settings;
      formData.append('generalSettings', JSON.stringify(settingsWithoutLogo));

      await tenantApi.updatePublicPageData(formData);
      
      // Update logo in settings if file was uploaded
      if (logoFile) {
        // Logo path will be returned from backend, but for now we'll reload
        await loadSettings();
      }
      
      setLogoFile(null);
      setSuccess(t('saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTemplateChange = (templateId: 'template1' | 'template2' | 'template3') => {
    setSettings(prev => ({ ...prev, template: templateId }));
  };

  const handleColorChange = (colorType: 'primaryColor' | 'secondaryColor' | 'helperColor', value: string) => {
    setSettings(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        [colorType]: value,
      },
    }));
  };

  const handleSectionToggle = (section: keyof GeneralSettings['sections']) => {
    setSettings(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: !prev.sections[section],
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      {/* Public Page Logo */}
      <div className="p-6 border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center gap-3 mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">{t('publicPageLogo')}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('publicPageLogoDescription')}
        </p>
        
        <div className="flex items-center gap-6" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {/* Logo Preview */}
          <div className="flex-shrink-0">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="w-32 h-32 object-contain border border-gray-200 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Upload Button */}
          <div className="flex-1">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {logoPreview ? t('changeLogo') : t('uploadLogo')}
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('logoUploadHint')}
            </p>
          </div>
        </div>
      </div>

      {/* Website Template Selection */}
      <div className="p-6 border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center gap-3 mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <SwatchIcon className="w-6 h-6 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('websiteTemplate')}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('templateDescription')}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TEMPLATE_OPTIONS.map((template) => (
            <div
              key={template.id}
              onClick={() => handleTemplateChange(template.id as 'template1' | 'template2' | 'template3')}
              className={`relative p-6 border-2 rounded-lg cursor-pointer transition-all ${
                settings.template === template.id
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {settings.template === template.id && (
                <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="mb-3">
                <h4 className="font-semibold text-gray-900 mb-1">{template.name}</h4>
                <p className="text-sm text-gray-600">{template.description}</p>
              </div>
              {/* Template Preview Placeholder */}
              <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded border border-gray-300 flex items-center justify-center">
                <span className="text-xs text-gray-500">{t('preview')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Page Theme */}
      <div className="p-6 border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center gap-3 mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <PaintBrushIcon className="w-6 h-6 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('pageTheme')}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('themeDescription')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Primary Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('primaryColor')}
            </label>
            <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <input
                type="color"
                value={settings.theme.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="w-16 h-12 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.theme.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="#3B82F6"
              />
            </div>
            <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('primaryColorHint')}
            </p>
          </div>

          {/* Secondary Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('secondaryColor')}
            </label>
            <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <input
                type="color"
                value={settings.theme.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="w-16 h-12 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.theme.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="#8B5CF6"
              />
            </div>
            <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('secondaryColorHint')}
            </p>
          </div>

          {/* Helper Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('helperColor')}
            </label>
            <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <input
                type="color"
                value={settings.theme.helperColor}
                onChange={(e) => handleColorChange('helperColor', e.target.value)}
                className="w-16 h-12 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.theme.helperColor}
                onChange={(e) => handleColorChange('helperColor', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="#10B981"
              />
            </div>
            <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('helperColorHint')}
            </p>
          </div>
        </div>

        {/* Color Preview */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('colorPreview')}
          </p>
          <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div
              className="w-12 h-12 rounded-lg border-2 border-gray-300"
              style={{ backgroundColor: settings.theme.primaryColor }}
              title={t('primaryColor')}
            ></div>
            <div
              className="w-12 h-12 rounded-lg border-2 border-gray-300"
              style={{ backgroundColor: settings.theme.secondaryColor }}
              title={t('secondaryColor')}
            ></div>
            <div
              className="w-12 h-12 rounded-lg border-2 border-gray-300"
              style={{ backgroundColor: settings.theme.helperColor }}
              title={t('helperColor')}
            ></div>
          </div>
        </div>
      </div>

      {/* Section Visibility Toggles */}
      <div className="p-6 border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center gap-3 mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <EyeIcon className="w-6 h-6 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('sectionVisibility')}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('sectionVisibilityDescription')}
        </p>

        <div className="space-y-4">
          {/* Hero Slider Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <SwatchIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <h4 className="font-medium text-gray-900">{t('heroSlider')}</h4>
                <p className="text-sm text-gray-600">{t('heroSliderDescription')}</p>
              </div>
            </div>
            <button
              onClick={() => handleSectionToggle('heroSlider')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.sections.heroSlider ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.sections.heroSlider ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Services Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <h4 className="font-medium text-gray-900">{t('services')}</h4>
                <p className="text-sm text-gray-600">{t('servicesDescription')}</p>
              </div>
            </div>
            <button
              onClick={() => handleSectionToggle('services')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.sections.services ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.sections.services ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Products Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <h4 className="font-medium text-gray-900">{t('products')}</h4>
                <p className="text-sm text-gray-600">{t('productsDescription')}</p>
              </div>
            </div>
            <button
              onClick={() => handleSectionToggle('products')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.sections.products ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.sections.products ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Call to Action Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <h4 className="font-medium text-gray-900">{t('callToAction')}</h4>
                <p className="text-sm text-gray-600">{t('callToActionDescription')}</p>
              </div>
            </div>
            <button
              onClick={() => handleSectionToggle('callToAction')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.sections.callToAction ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.sections.callToAction ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {t('saving')}
            </>
          ) : (
            t('save')
          )}
        </button>
      </div>
    </div>
  );
}

