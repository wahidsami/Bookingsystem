'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
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
import { PUBLIC_PAGE_URL, tenantApi } from '@/lib/api';

interface ReviewItem {
  id: string;
  customerName: string | null;
  rating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: string;
  staff?: { id: string; name: string } | null;
}

export default function MyPagePage() {
  const t = useTranslations('MyPage');
  const locale = useLocale();
  const router = useRouter();
  const isRTL = locale === 'ar';

  const [activeTab, setActiveTab] = useState('general');
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loadingSlug, setLoadingSlug] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    loadTenantSlug();
  }, []);

  useEffect(() => {
    if (activeTab === 'reviews') loadReviews();
  }, [activeTab]);

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

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      const res = await tenantApi.getReviews();
      if (res.success && res.data?.reviews) {
        setReviews(res.data.reviews);
      } else {
        setReviews([]);
      }
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleViewPage = () => {
    if (tenantSlug) {
      // Open public page in new tab
      // PublicPage runs on port 3004
      const publicPageUrl = `${PUBLIC_PAGE_URL}/t/${tenantSlug}`;
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
                <div className="flex items-center justify-between" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('reviews')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/dashboard/reviews`)}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    {locale === 'ar' ? 'عرض الكل ←' : 'View all →'}
                  </button>
                </div>
                {reviewsLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">⭐</div>
                    <p className="text-gray-500">{locale === 'ar' ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</p>
                    <p className="text-gray-400 text-sm mt-1">{locale === 'ar' ? 'ستظهر تقييمات العملاء هنا' : 'Customer reviews will appear here.'}</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {reviews.slice(0, 10).map((r) => (
                      <li key={r.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-start gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {(r.customerName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{r.customerName || (locale === 'ar' ? 'عميل' : 'Customer')}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <span key={i} className={i <= r.rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                              ))}
                              <span className="text-xs text-gray-500 ml-1">{new Date(r.createdAt).toLocaleDateString(locale)}</span>
                            </div>
                            {r.comment && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{r.comment}</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}

