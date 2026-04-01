'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getImageUrl, tenantApi } from '@/lib/api';

interface PageBanners {
  services?: string | null;
  products?: string | null;
  about?: string | null;
  contact?: string | null;
}

export function PagesBannersTab() {
  const t = useTranslations('MyPage.PagesBanners');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [banners, setBanners] = useState<PageBanners>({
    services: null,
    products: null,
    about: null,
    contact: null,
  });

  // File states for each banner
  const [servicesBannerFile, setServicesBannerFile] = useState<File | null>(null);
  const [servicesBannerPreview, setServicesBannerPreview] = useState<string | null>(null);
  const [productsBannerFile, setProductsBannerFile] = useState<File | null>(null);
  const [productsBannerPreview, setProductsBannerPreview] = useState<string | null>(null);
  const [aboutBannerFile, setAboutBannerFile] = useState<File | null>(null);
  const [aboutBannerPreview, setAboutBannerPreview] = useState<string | null>(null);
  const [contactBannerFile, setContactBannerFile] = useState<File | null>(null);
  const [contactBannerPreview, setContactBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getPublicPageData();
      if (response.success && response.data) {
        // Get page banners from dedicated field (not from generalSettings)
        const pageBanners = response.data.pageBanners || {};

        setBanners({
          services: pageBanners.services || null,
          products: pageBanners.products || null,
          about: pageBanners.about || null,
          contact: pageBanners.contact || null,
        });

        // Set previews for existing banners
        if (pageBanners.services) {
          setServicesBannerPreview(getImageUrl(pageBanners.services));
        } else {
          setServicesBannerPreview(null);
        }
        if (pageBanners.products) {
          setProductsBannerPreview(getImageUrl(pageBanners.products ?? ''));
        } else {
          setProductsBannerPreview(null);
        }
        if (pageBanners.about) {
          setAboutBannerPreview(getImageUrl(pageBanners.about ?? ''));
        } else {
          setAboutBannerPreview(null);
        }
        if (pageBanners.contact) {
          setContactBannerPreview(getImageUrl(pageBanners.contact));
        } else {
          setContactBannerPreview(null);
        }
      }
    } catch (err: any) {
      console.error('Failed to load page banners:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (
    file: File | null,
    setFile: (file: File | null) => void,
    setPreview: (preview: string | null) => void
  ) => {
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBanner = (
    page: 'services' | 'products' | 'about' | 'contact',
    setFile: (file: File | null) => void,
    setPreview: (preview: string | null) => void
  ) => {
    setFile(null);
    setPreview(null);
    setBanners((prev) => ({ ...prev, [page]: null }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const formData = new FormData();

      // Append banner files
      if (servicesBannerFile) {
        formData.append('servicesBanner', servicesBannerFile);
      } else if (banners.services) {
        formData.append('existingServicesBanner', banners.services);
      }

      if (productsBannerFile) {
        formData.append('productsBanner', productsBannerFile);
      } else if (banners.products) {
        formData.append('existingProductsBanner', banners.products);
      }

      if (aboutBannerFile) {
        formData.append('aboutBanner', aboutBannerFile);
      } else if (banners.about) {
        formData.append('existingAboutBanner', banners.about);
      }

      if (contactBannerFile) {
        formData.append('contactBanner', contactBannerFile);
      } else if (banners.contact) {
        formData.append('existingContactBanner', banners.contact);
      }

      // IMPORTANT: Only send pageBanners JSON for banners that:
      // 1. Don't have a new file being uploaded
      // 2. Have an existing value to preserve
      // This prevents null values from overwriting existing banners
      const pageBannersData: any = {};
      if (!servicesBannerFile && banners.services) {
        pageBannersData.services = banners.services;
      }
      if (!productsBannerFile && banners.products) {
        pageBannersData.products = banners.products;
      }
      if (!aboutBannerFile && banners.about) {
        pageBannersData.about = banners.about;
      }
      if (!contactBannerFile && banners.contact) {
        pageBannersData.contact = banners.contact;
      }

      // Only append pageBanners if there's data to send
      // This prevents sending empty object or null values that could overwrite existing banners
      if (Object.keys(pageBannersData).length > 0) {
        formData.append('pageBanners', JSON.stringify(pageBannersData));
      }

      await tenantApi.updatePublicPageData(formData);
      setSuccess(t('saved'));
      setTimeout(() => setSuccess(null), 3000);

      // Reload to get updated paths
      await loadBanners();

      // Clear file states
      setServicesBannerFile(null);
      setProductsBannerFile(null);
      setAboutBannerFile(null);
      setContactBannerFile(null);
    } catch (err: any) {
      setError(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const renderBannerUpload = (
    page: 'services' | 'products' | 'about' | 'contact',
    title: string,
    description: string,
    file: File | null,
    setFile: (file: File | null) => void,
    preview: string | null,
    setPreview: (preview: string | null) => void,
    existingBanner: string | null
  ) => {
    const fieldName = `${page}Banner`;
    const hasBanner = preview || existingBanner;

    return (
      <div className="p-6 border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {title}
          </h3>
          <p className="text-sm text-gray-600 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {description}
          </p>
        </div>

        <div className="space-y-4">
          {hasBanner ? (
            <div className="relative">
              <img
                src={preview || (existingBanner ? getImageUrl(existingBanner) : '')}
                alt={`${title} banner`}
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => handleRemoveBanner(page, setFile, setPreview)}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                style={{ [isRTL ? 'left' : 'right']: '0.5rem' }}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <PhotoIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-4">{t('noBanner')}</p>
              <label className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors">
                <PhotoIcon className="w-5 h-5 mr-2" style={{ marginRight: isRTL ? '0' : '0.5rem', marginLeft: isRTL ? '0.5rem' : '0' }} />
                <span>{t('uploadBanner')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] || null;
                    handleFileChange(selectedFile, setFile, setPreview);
                  }}
                />
              </label>
            </div>
          )}

          {hasBanner && (
            <label className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
              <PhotoIcon className="w-5 h-5 mr-2" style={{ marginRight: isRTL ? '0' : '0.5rem', marginLeft: isRTL ? '0.5rem' : '0' }} />
              <span>{t('changeBanner')}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] || null;
                  handleFileChange(selectedFile, setFile, setPreview);
                  if (selectedFile) {
                    setBanners((prev) => ({ ...prev, [page]: 'pending' }));
                  }
                }}
              />
            </label>
          )}

          <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('bannerHint')}
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('title')}
        </h2>
        <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('description')}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {success}
        </div>
      )}

      <div className="space-y-6">
        {renderBannerUpload(
          'services',
          t('servicesBanner'),
          t('servicesBannerDescription'),
          servicesBannerFile,
          setServicesBannerFile,
          servicesBannerPreview,
          setServicesBannerPreview,
          banners.services || null
        )}

        {renderBannerUpload(
          'products',
          t('productsBanner'),
          t('productsBannerDescription'),
          productsBannerFile,
          setProductsBannerFile,
          productsBannerPreview,
          setProductsBannerPreview,
          banners.products || null
        )}

        {renderBannerUpload(
          'about',
          t('aboutBanner'),
          t('aboutBannerDescription'),
          aboutBannerFile,
          setAboutBannerFile,
          aboutBannerPreview,
          setAboutBannerPreview,
          banners.about || null
        )}

        {renderBannerUpload(
          'contact',
          t('contactBanner'),
          t('contactBannerDescription'),
          contactBannerFile,
          setContactBannerFile,
          contactBannerPreview,
          setContactBannerPreview,
          banners.contact || null
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}

