'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi, getImageUrl } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function NewHotDealPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = (params?.locale as string) || 'ar';
    const t = useTranslations('hotDeals');
    const isRTL = locale === 'ar';
    const dealId = searchParams.get('dealId');
    const isEditing = Boolean(dealId);

    const [loading, setLoading] = useState(false);
    const [loadingDeal, setLoadingDeal] = useState(isEditing);
    const [services, setServices] = useState<any[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [dateRangeError, setDateRangeError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        serviceId: '',
        title_en: '',
        title_ar: '',
        description_en: '',
        description_ar: '',
        discountType: 'percentage',
        discountValue: '',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        maxRedemptions: '50'
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const isInvalidDateRange = Boolean(
        formData.validFrom &&
        formData.validUntil &&
        formData.validUntil <= formData.validFrom
    );

    const handleDateChange = (field: 'validFrom' | 'validUntil', value: string) => {
        setFormData((current) => ({ ...current, [field]: value }));

        const nextValidFrom = field === 'validFrom' ? value : formData.validFrom;
        const nextValidUntil = field === 'validUntil' ? value : formData.validUntil;

        if (nextValidFrom && nextValidUntil && nextValidUntil <= nextValidFrom) {
            setDateRangeError(isRTL
                ? 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية.'
                : 'The end date must be after the start date.');
            return;
        }

        setDateRangeError('');
    };

    const fetchServices = async () => {
        try {
            const response = await tenantApi.getServices();
            setServices(response.services || []);
        } catch (error: any) {
            console.error('Error fetching services:', error);
        }
    };

    const fetchDeal = async () => {
        if (!dealId) {
            setLoadingDeal(false);
            return;
        }

        try {
            const response = await tenantApi.getHotDeal(dealId);
            const hotDeal = response.deal;

            if (hotDeal) {
                setFormData({
                    serviceId: hotDeal.serviceId || '',
                    title_en: hotDeal.title_en || '',
                    title_ar: hotDeal.title_ar || '',
                    description_en: hotDeal.description_en || '',
                    description_ar: hotDeal.description_ar || '',
                    discountType: hotDeal.discountType || 'percentage',
                    discountValue: String(hotDeal.discountValue ?? ''),
                    validFrom: hotDeal.validFrom ? new Date(hotDeal.validFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    validUntil: hotDeal.validUntil ? new Date(hotDeal.validUntil).toISOString().split('T')[0] : '',
                    maxRedemptions: String(hotDeal.maxRedemptions ?? '50')
                });
                setImagePreview(hotDeal.image ? getImageUrl(hotDeal.image) : null);
            }
        } catch (error: any) {
            console.error('Error fetching deal for edit:', error);
            alert(error.message || (isRTL ? 'تعذر تحميل العرض للتعديل.' : 'Failed to load hot deal for editing.'));
        } finally {
            setLoadingDeal(false);
        }
    };

    useEffect(() => {
        fetchServices();
        if (isEditing) {
            fetchDeal();
        } else {
            setLoadingDeal(false);
        }
    }, [dealId]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert(t('alerts.sizeErr'));
                return;
            }
            if (!file.type.startsWith('image/')) {
                alert(t('alerts.typeErr'));
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isInvalidDateRange) {
            setDateRangeError(isRTL
                ? 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية.'
                : 'The end date must be after the start date.');
            return;
        }

        setLoading(true);

        try {
            const submitData = new FormData();
            submitData.append('serviceId', formData.serviceId);
            submitData.append('title_en', formData.title_en);
            submitData.append('title_ar', formData.title_ar);
            submitData.append('description_en', formData.description_en);
            submitData.append('description_ar', formData.description_ar);
            submitData.append('discountType', formData.discountType);
            submitData.append('discountValue', formData.discountValue);
            submitData.append('validFrom', formData.validFrom);
            submitData.append('validUntil', formData.validUntil);
            submitData.append('maxRedemptions', formData.maxRedemptions);

            if (selectedFile) {
                submitData.append('image', selectedFile);
            }

            if (isEditing && dealId) {
                const response = await tenantApi.updateHotDeal(dealId, submitData);
                alert(response?.message || t('alerts.updateSuccess'));
                router.push(`/${locale}/dashboard/hot-deals/${dealId}`);
            } else {
                const response = await tenantApi.createHotDeal(submitData);
                alert(response?.autoApproved ? t('alerts.successAutoApproved') : t('alerts.success'));
                router.push(`/${locale}/dashboard/hot-deals`);
            }
        } catch (error: any) {
            alert(error.message || t('alerts.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <TenantLayout>
            <div className={`p-6 max-w-4xl animate-fade-in ${isRTL ? 'text-right' : 'text-left'}`}>
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="text-dark-400 hover:text-white mb-4 flex items-center gap-2 transition-colors"
                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                    >
                        <span>{isRTL ? '→' : '←'}</span>
                        <span>{t('backToList')}</span>
                    </button>
                    <h1 className="text-2xl font-bold text-white">{isEditing ? t('editDeal') : t('createDeal')}</h1>
                    <p className="text-dark-300 mt-1">{isEditing ? t('editSubtitle') : t('createSubtitle')}</p>
                </div>

                {(loadingDeal && isEditing) ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                    </div>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>

                    {/* Image Upload Section */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700 hover:border-dark-600 transition-colors">
                        <h2 className="text-lg font-semibold text-white mb-4">{t('form.image')}</h2>
                        <div className="space-y-4">
                            <p className="text-sm font-medium text-dark-300 mb-1">{t('form.imageHint')}</p>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed border-dark-600 rounded-lg p-8 cursor-pointer hover:border-purple-500 transition-colors
                                  ${imagePreview ? 'bg-dark-900 border-purple-500/50' : 'bg-dark-800'}`}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />

                                {imagePreview ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-full h-48 rounded-lg overflow-hidden mb-4 bg-dark-950">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span className="text-purple-400 font-medium hover:text-purple-300">
                                            {t('form.changeImage')}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-dark-400">
                                        <span className="text-4xl mb-4">📸</span>
                                        <p className="font-medium text-white mb-1"><span className="text-purple-500">{t('form.clickToUpload')}</span> {t('form.dragDrop')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Service Selection */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700 hover:border-dark-600 transition-colors">
                        <h2 className="text-lg font-semibold text-white mb-4">{t('form.service')}</h2>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                {t('form.selectService')}
                            </label>
                            <select
                                required
                                value={formData.serviceId}
                                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                                className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow transition-colors"
                            >
                                <option value="">{t('form.chooseService')}</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {isRTL ? service.name_ar : service.name_en} - {service.finalPrice ?? service.rawPrice ?? service.basePrice} SAR
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Deal Information */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700 hover:border-dark-600 transition-colors">
                        <h2 className="text-lg font-semibold text-white mb-4">{t('form.dealInfo')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.titleEn')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title_en}
                                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow"
                                    placeholder="e.g., Summer Special"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.titleAr')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title_ar}
                                    onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow"
                                    dir="rtl"
                                    placeholder="مثال: عرض الصيف الخاص"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.descEn')}
                                </label>
                                <textarea
                                    value={formData.description_en}
                                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow resize-none"
                                    dir="ltr"
                                    placeholder="Brief description of your offer"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.descAr')}
                                </label>
                                <textarea
                                    value={formData.description_ar}
                                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow resize-none"
                                    dir="rtl"
                                    placeholder="وصف موجز لعرضك"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Discount Settings */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700 hover:border-dark-600 transition-colors">
                        <h2 className="text-lg font-semibold text-white mb-4">{t('form.discountSettings')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.discountType')}
                                </label>
                                <select
                                    value={formData.discountType}
                                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow"
                                >
                                    <option value="percentage">{t('form.perc')}</option>
                                    <option value="fixed_amount">{t('form.fixed')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.discountValue')}
                                </label>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    value={formData.discountValue}
                                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow"
                                    placeholder={formData.discountType === 'percentage' ? '20' : '50'}
                                />
                                <p className="text-xs text-dark-400 mt-2">
                                    {t('form.maxDiscountHint')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Validity Period */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700 hover:border-dark-600 transition-colors">
                        <h2 className="text-lg font-semibold text-white mb-4">{t('form.validity')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.validFrom')}
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.validFrom}
                                    onChange={(e) => handleDateChange('validFrom', e.target.value)}
                                    className={`w-full px-4 py-3 bg-dark-900 border rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow [color-scheme:dark] ${
                                        isInvalidDateRange ? 'border-red-500' : 'border-dark-600'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.validUntil')}
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.validUntil}
                                    onChange={(e) => handleDateChange('validUntil', e.target.value)}
                                    className={`w-full px-4 py-3 bg-dark-900 border rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow [color-scheme:dark] ${
                                        isInvalidDateRange ? 'border-red-500' : 'border-dark-600'
                                    }`}
                                />
                            </div>
                            {dateRangeError && (
                                <p className="md:col-span-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                                    {dateRangeError}
                                </p>
                            )}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    {t('form.maxRedemptions')}
                                </label>
                                <input
                                    type="number"
                                    value={formData.maxRedemptions}
                                    onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 transition-shadow"
                                    placeholder="50"
                                />
                                <p className="text-xs text-dark-400 mt-2">
                                    {t('form.maxRedemptionsHint')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-4 pt-4 pb-12">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-8 py-3 bg-dark-800 border-2 border-dark-700 rounded-lg text-dark-300 font-semibold hover:bg-dark-700 hover:text-white transition-colors"
                        >
                            {t('form.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isInvalidDateRange}
                            className="flex-1 px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-900/20"
                        >
                            {loading ? t('form.creating') : (isEditing ? t('form.updateBtn') : t('form.createBtn'))}
                        </button>
                    </div>
                </form>
                )}
            </div>
        </TenantLayout>
    );
}
