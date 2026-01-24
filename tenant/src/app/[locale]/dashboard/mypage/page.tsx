'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { TenantLayout } from '@/components/TenantLayout';
import {
  Cog6ToothIcon,
  HomeIcon,
  InformationCircleIcon,
  StarIcon,
  ArrowTopRightOnSquareIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { AboutUsTab } from '@/components/AboutUsTab';
import { HeroSliderTab } from '@/components/HeroSliderTab';
import { GeneralSettingsTab } from '@/components/GeneralSettingsTab';
import { PagesBannersTab } from '@/components/PagesBannersTab';
import { tenantApi } from '@/lib/api';

export default function MyPagePage() {
  const t = useTranslations('MyPage');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [activeTab, setActiveTab] = useState('general');
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loadingSlug, setLoadingSlug] = useState(true);

  useEffect(() => {
    loadTenantSlug();
  }, []);

  const loadTenantSlug = async () => {
    try {
      setLoadingSlug(true);
      const response = await tenantApi.getSettings();
      if (response.success && response.data?.business?.slug) {
        setTenantSlug(response.data.business.slug);
      }
    } catch (error) {
      console.error('Failed to load tenant slug:', error);
    } finally {
      setLoadingSlug(false);
    }
  };

  const handleViewPage = () => {
    if (tenantSlug) {
      // Open public page in new tab
      // PublicPage runs on port 3004
      const publicPageUrl = `http://localhost:3004/t/${tenantSlug}`;
      window.open(publicPageUrl, '_blank');
    }
  };

  const tabs = [
    { id: 'general', icon: Cog6ToothIcon, label: t('generalSettings') },
    { id: 'heroSlider', icon: HomeIcon, label: t('heroSlider') },
    { id: 'pagesBanners', icon: RectangleStackIcon, label: t('pagesBanners') },
    { id: 'about', icon: InformationCircleIcon, label: t('aboutUs') },
    { id: 'reviews', icon: StarIcon, label: t('reviews') },
  ];

  return (
    <TenantLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('title')}
            </h1>
            <p className="text-gray-500 mt-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('subtitle')}
            </p>
          </div>
          {tenantSlug && (
            <button
              onClick={handleViewPage}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              <span>{t('viewPage')}</span>
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tabs */}
          <div className="lg:w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {/* General Settings Tab */}
            {activeTab === 'general' && <GeneralSettingsTab />}

            {/* Hero Slider Tab */}
            {activeTab === 'heroSlider' && <HeroSliderTab />}

            {/* Pages Banners Tab */}
            {activeTab === 'pagesBanners' && <PagesBannersTab />}

            {/* About Us Tab */}
            {activeTab === 'about' && <AboutUsTab />}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('reviews')}
                </h2>
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🚧</div>
                    <p className="text-gray-500 text-lg">{t('comingSoon')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}

