'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { TenantLayout } from '@/components/TenantLayout';
import { getImageUrl, tenantApi } from '@/lib/api';

type SectionToggles = {
  services: boolean;
  products: boolean;
  reviews: boolean;
  about: boolean;
};

export default function PageSetupPage() {
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sections, setSections] = useState<SectionToggles>({
    services: true,
    products: true,
    reviews: false,
    about: true,
  });

  const [aboutText, setAboutText] = useState('');
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([]);

  const [businessInfo, setBusinessInfo] = useState({
    coverImage: '',
    addressText: '',
    googleMapLink: '',
    phone: '',
    email: '',
    website: '',
    instagramUrl: '',
    twitterUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    linkedinUrl: '',
    snapchatUrl: '',
  });

  const galleryPreviews = useMemo(
    () => [
      ...existingGallery.map((item) => (item.startsWith('http') ? item : getImageUrl(item))),
      ...newGalleryFiles.map((file) => URL.createObjectURL(file)),
    ],
    [existingGallery, newGalleryFiles]
  );

  useEffect(() => {
    return () => {
      galleryPreviews.forEach((preview) => {
        if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
      });
    };
  }, [galleryPreviews]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [pageDataRes, settingsRes] = await Promise.all([
          tenantApi.getPublicPageData(),
          tenantApi.getSettings(),
        ]);

        const pageData = pageDataRes?.data || {};
        const sectionData = pageData?.generalSettings?.sections || {};
        const pageSetup = pageData?.generalSettings?.pageSetup || {};
        setSections({
          services: sectionData.services !== false,
          products: sectionData.products !== false,
          reviews: sectionData.reviews === true,
          about: sectionData.about !== false && sectionData.callToAction !== false,
        });

        const storyEn = pageData?.aboutUs?.storyEn || '';
        const storyAr = pageData?.aboutUs?.storyAr || '';
        setAboutText(storyEn || storyAr || '');
        setExistingGallery(Array.isArray(pageData?.aboutUs?.facilitiesImages) ? pageData.aboutUs.facilitiesImages : []);

        const business = settingsRes?.data?.business || {};
        const fallbackAddressText = [
          business?.buildingNumber,
          business?.street,
          business?.district,
          business?.city,
          business?.country,
        ]
          .filter(Boolean)
          .join(', ');

        setBusinessInfo({
          coverImage: business?.coverImage || '',
          addressText: pageSetup?.addressText || fallbackAddressText,
          googleMapLink: pageSetup?.googleMapLink || business?.googleMapLink || '',
          phone: pageSetup?.phone || business?.phone || business?.mobile || '',
          email: pageSetup?.email || business?.email || '',
          website: pageSetup?.website || business?.website || '',
          instagramUrl: pageSetup?.instagramUrl || business?.instagramUrl || '',
          twitterUrl: pageSetup?.twitterUrl || business?.twitterUrl || '',
          tiktokUrl: pageSetup?.tiktokUrl || business?.tiktokUrl || '',
          youtubeUrl: pageSetup?.youtubeUrl || business?.youtubeUrl || '',
          linkedinUrl: pageSetup?.linkedinUrl || business?.linkedinUrl || '',
          snapchatUrl: pageSetup?.snapchatUrl || business?.snapchatUrl || '',
        });
      } catch (err: any) {
        setError(err?.message || (locale === 'ar' ? 'فشل تحميل إعدادات الصفحة' : 'Failed to load page setup'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [locale]);

  const updateSection = (key: keyof SectionToggles) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const enabledCount = Object.values(next).filter(Boolean).length;
      if (enabledCount === 0) {
        setError(locale === 'ar' ? 'يجب إظهار تبويب واحد على الأقل' : 'At least one tab must stay visible');
        return prev;
      }
      setError(null);
      return next;
    });
  };

  const handleGalleryFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const total = existingGallery.length + newGalleryFiles.length + files.length;
    if (total > 10) {
      setError(locale === 'ar' ? 'الحد الأقصى 10 صور' : 'Maximum 10 images allowed');
      return;
    }
    setError(null);
    setNewGalleryFiles((prev) => [...prev, ...files]);
  };

  const removeExistingImage = (index: number) => {
    setExistingGallery((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewGalleryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const formData = new FormData();
      formData.append(
        'generalSettings',
        JSON.stringify({
          sections: {
            services: sections.services,
            products: sections.products,
            reviews: sections.reviews,
            about: sections.about,
            callToAction: sections.about,
          },
          pageSetup: {
            addressText: businessInfo.addressText,
            googleMapLink: businessInfo.googleMapLink,
            phone: businessInfo.phone,
            email: businessInfo.email,
            website: businessInfo.website,
            instagramUrl: businessInfo.instagramUrl,
            twitterUrl: businessInfo.twitterUrl,
            tiktokUrl: businessInfo.tiktokUrl,
            youtubeUrl: businessInfo.youtubeUrl,
            linkedinUrl: businessInfo.linkedinUrl,
            snapchatUrl: businessInfo.snapchatUrl,
          }
        })
      );

      // Single-language policy: mirror same content to both story fields for compatibility.
      formData.append('storyEn', aboutText);
      formData.append('storyAr', aboutText);
      formData.append('existingFacilitiesImages', JSON.stringify(existingGallery));
      newGalleryFiles.forEach((file) => formData.append('facilitiesImages', file));

      await tenantApi.updatePublicPageData(formData);

      await tenantApi.updateBusinessInfo({
        googleMapLink: businessInfo.googleMapLink,
        phone: businessInfo.phone,
        mobile: businessInfo.phone,
        email: businessInfo.email,
        website: businessInfo.website,
        instagramUrl: businessInfo.instagramUrl,
        twitterUrl: businessInfo.twitterUrl,
        tiktokUrl: businessInfo.tiktokUrl,
        youtubeUrl: businessInfo.youtubeUrl,
        linkedinUrl: businessInfo.linkedinUrl,
        snapchatUrl: businessInfo.snapchatUrl,
      });

      const refreshedPageData = await tenantApi.getPublicPageData();
      const nextFacilities = Array.isArray(refreshedPageData?.data?.aboutUs?.facilitiesImages)
        ? refreshedPageData.data.aboutUs.facilitiesImages
        : [];
      setExistingGallery(nextFacilities);
      setNewGalleryFiles([]);
      setMessage(locale === 'ar' ? 'تم حفظ إعدادات الصفحة بنجاح' : 'Page setup saved successfully');
    } catch (err: any) {
      setError(err?.message || (locale === 'ar' ? 'فشل حفظ إعدادات الصفحة' : 'Failed to save page setup'));
    } finally {
      setSaving(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverUploading(true);
      setMessage(null);
      setError(null);
      const response = await tenantApi.uploadCoverImage(file);
      const nextCover = response?.data?.coverImage || '';
      if (nextCover) {
        setBusinessInfo((prev) => ({ ...prev, coverImage: nextCover }));
      }
      setMessage(locale === 'ar' ? 'تم تحديث صورة الغلاف بنجاح' : 'Cover image updated successfully');
    } catch (err: any) {
      setError(err?.message || (locale === 'ar' ? 'فشل تحديث صورة الغلاف' : 'Failed to update cover image'));
    } finally {
      setCoverUploading(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{locale === 'ar' ? 'إعداد الصفحة' : 'Page Setup'}</h1>
          <p className="mt-1 text-gray-600">
            {locale === 'ar'
              ? 'تحكم بما يظهر في صفحة مركزك داخل تطبيق العميل'
              : 'Control what appears on your center page in the customer app'}
          </p>
        </div>

        {message ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">{message}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">{locale === 'ar' ? 'صورة الغلاف' : 'Tenant Cover Image'}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {locale === 'ar'
              ? 'تظهر هذه الصورة في أعلى صفحة المركز داخل تطبيق العميل.'
              : 'This image appears at the top of your center page in the customer app.'}
          </p>

          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {businessInfo.coverImage ? (
              <img
                src={businessInfo.coverImage.startsWith('http') ? businessInfo.coverImage : getImageUrl(businessInfo.coverImage)}
                className="h-52 w-full object-cover"
                alt={locale === 'ar' ? 'صورة الغلاف' : 'Cover image'}
              />
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-gray-500">
                {locale === 'ar' ? 'لا توجد صورة غلاف حالياً' : 'No cover image uploaded yet'}
              </div>
            )}
          </div>

          <label className="mt-4 inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90">
            {coverUploading
              ? (locale === 'ar' ? 'جارٍ الرفع...' : 'Uploading...')
              : (locale === 'ar' ? 'رفع / استبدال الغلاف' : 'Upload / Replace Cover')}
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
          </label>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">{locale === 'ar' ? 'إظهار التبويبات' : 'Tab Visibility'}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              ['services', locale === 'ar' ? 'الخدمات' : 'Services'],
              ['products', locale === 'ar' ? 'المنتجات' : 'Products'],
              ['reviews', locale === 'ar' ? 'التقييمات' : 'Reviews'],
              ['about', locale === 'ar' ? 'حول المركز' : 'About'],
            ] as Array<[keyof SectionToggles, string]>).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <span className="font-medium text-gray-800">{label}</span>
                <button
                  type="button"
                  onClick={() => updateSection(key)}
                  className={`h-7 w-12 rounded-full p-1 transition ${sections[key] ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`block h-5 w-5 rounded-full bg-white transition ${sections[key] ? 'translate-x-5' : ''}`} />
                </button>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">{locale === 'ar' ? 'محتوى قسم حول المركز' : 'About Section Content'}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {locale === 'ar'
              ? 'اكتب المحتوى باللغة التي تريدها (حقل واحد فقط).'
              : 'Use one text field only. You can write in any language.'}
          </p>
          <textarea
            value={aboutText}
            onChange={(event) => setAboutText(event.target.value)}
            rows={6}
            className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary focus:outline-none"
            placeholder={locale === 'ar' ? 'نبذة عن المركز...' : 'Tell customers about your center...'}
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">{locale === 'ar' ? 'صور المركز (المعرض)' : 'Center Gallery Images'}</h2>
          <p className="mt-1 text-sm text-gray-500">{locale === 'ar' ? 'حتى 10 صور' : 'Up to 10 images'}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {existingGallery.map((image, index) => (
              <div key={`existing-${index}`} className="relative overflow-hidden rounded-lg border">
                <img src={image.startsWith('http') ? image : getImageUrl(image)} className="h-28 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(index)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                >
                  {locale === 'ar' ? 'حذف' : 'Remove'}
                </button>
              </div>
            ))}
            {newGalleryFiles.map((_file, index) => (
              <div key={`new-${index}`} className="relative overflow-hidden rounded-lg border">
                <img src={galleryPreviews[existingGallery.length + index]} className="h-28 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewImage(index)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                >
                  {locale === 'ar' ? 'حذف' : 'Remove'}
                </button>
              </div>
            ))}
          </div>

          <label className="mt-4 inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90">
            {locale === 'ar' ? 'إضافة صور' : 'Add Images'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryFiles} />
          </label>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">{locale === 'ar' ? 'العنوان والتواصل' : 'Location & Contact'}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={businessInfo.addressText}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, addressText: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder={locale === 'ar' ? 'العنوان' : 'Address'}
            />
            <input
              value={businessInfo.googleMapLink}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, googleMapLink: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder={locale === 'ar' ? 'رابط خرائط Google' : 'Google Maps link'}
            />
            <input
              value={businessInfo.phone}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, phone: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder={locale === 'ar' ? 'الهاتف' : 'Phone'}
            />
            <input
              value={businessInfo.email}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, email: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder={locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
            />
            <input
              value={businessInfo.website}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, website: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder={locale === 'ar' ? 'الموقع الإلكتروني' : 'Website'}
            />
            <input
              value={businessInfo.instagramUrl}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, instagramUrl: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder="Instagram URL"
            />
            <input
              value={businessInfo.tiktokUrl}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, tiktokUrl: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder="TikTok URL"
            />
            <input
              value={businessInfo.twitterUrl}
              onChange={(event) => setBusinessInfo((prev) => ({ ...prev, twitterUrl: event.target.value }))}
              className="rounded-lg border border-gray-300 px-4 py-2"
              placeholder="X / Twitter URL"
            />
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>
    </TenantLayout>
  );
}
