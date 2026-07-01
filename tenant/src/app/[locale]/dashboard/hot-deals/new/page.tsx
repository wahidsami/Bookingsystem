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
            <div className="space-y-6 bg-slate-950 text-slate-100" dir={isRTL ? 'rtl' : 'ltr'}>
                <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-[0_28px_100px_rgba(2,6,23,0.45)] lg:p-8">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                    >
                        <span>{isRTL ? '→' : '←'}</span>
                        <span>{t('backToList')}</span>
                    </button>
                    <div className="mt-5 flex flex-col gap-3">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                            {isEditing ? t('editDeal') : t('createDeal')}
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">
                            {isEditing ? t('editDeal') : t('createDeal')}
                        </h1>
                        <p className="max-w-2xl text-sm leading-6 text-slate-300">
                            {isEditing ? t('editSubtitle') : t('createSubtitle')}
                        </p>
                    </div>
                </section>

                {loadingDeal && isEditing ? (
                    <div className="flex justify-center rounded-[28px] border border-white/10 bg-slate-900 py-20">
                        <div className="h-11 w-11 animate-spin rounded-full border-2 border-fuchsia-400/20 border-t-fuchsia-400" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                            <h2 className="mb-4 text-xl font-bold text-white">{t('form.image')}</h2>
                            <p className="mb-4 text-sm text-slate-400">{t('form.imageHint')}</p>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`cursor-pointer rounded-[24px] border-2 border-dashed p-6 transition ${
                                    imagePreview ? 'border-fuchsia-400/40 bg-white/5' : 'border-white/10 bg-slate-950/70 hover:border-fuchsia-400/40'
                                }`}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />

                                {imagePreview ? (
                                    <div className="space-y-4">
                                        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
                                            <img src={imagePreview} alt="Preview" className="h-64 w-full object-cover" />
                                        </div>
                                        <p className="text-sm font-semibold text-fuchsia-300">{t('form.changeImage')}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 text-center">
                                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-4xl">
                                            📸
                                        </div>
                                        <p className="text-sm font-semibold text-white">
                                            <span className="text-fuchsia-300">{t('form.clickToUpload')}</span> {t('form.dragDrop')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                            <h2 className="mb-5 text-xl font-bold text-white">{t('form.service')}</h2>
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                {t('form.selectService')}
                            </label>
                            <select
                                required
                                value={formData.serviceId}
                                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                            >
                                <option value="">{t('form.chooseService')}</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {isRTL ? service.name_ar : service.name_en} - {service.finalPrice ?? service.rawPrice ?? service.basePrice} SAR
                                    </option>
                                ))}
                            </select>
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                            <h2 className="mb-5 text-xl font-bold text-white">{t('form.dealInfo')}</h2>
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.titleEn')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title_en}
                                        onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                        placeholder="e.g., Summer Special"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.titleAr')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title_ar}
                                        onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                        dir="rtl"
                                        placeholder="مثال: عرض الصيف الخاص"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.descEn')}</label>
                                    <textarea
                                        value={formData.description_en}
                                        onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                                        rows={4}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                        dir="ltr"
                                        placeholder="Brief description of your offer"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.descAr')}</label>
                                    <textarea
                                        value={formData.description_ar}
                                        onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                                        rows={4}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                        dir="rtl"
                                        placeholder="وصف موجز لعرضك"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                            <h2 className="mb-5 text-xl font-bold text-white">{t('form.discountSettings')}</h2>
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.discountType')}</label>
                                    <select
                                        value={formData.discountType}
                                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                    >
                                        <option value="percentage">{t('form.perc')}</option>
                                        <option value="fixed_amount">{t('form.fixed')}</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.discountValue')}</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        value={formData.discountValue}
                                        onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                        placeholder={formData.discountType === 'percentage' ? '20' : '50'}
                                    />
                                    <p className="text-xs text-slate-400">{t('form.maxDiscountHint')}</p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                            <h2 className="mb-5 text-xl font-bold text-white">{t('form.validity')}</h2>
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.validFrom')}</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.validFrom}
                                        onChange={(e) => handleDateChange('validFrom', e.target.value)}
                                        className={`w-full rounded-2xl border bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20 [color-scheme:dark] ${
                                            isInvalidDateRange ? 'border-rose-500' : 'border-white/10'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.validUntil')}</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.validUntil}
                                        onChange={(e) => handleDateChange('validUntil', e.target.value)}
                                        className={`w-full rounded-2xl border bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20 [color-scheme:dark] ${
                                            isInvalidDateRange ? 'border-rose-500' : 'border-white/10'
                                        }`}
                                    />
                                </div>
                                {dateRangeError && (
                                    <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 md:col-span-2">
                                        {dateRangeError}
                                    </p>
                                )}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300">{t('form.maxRedemptions')}</label>
                                    <input
                                        type="number"
                                        value={formData.maxRedemptions}
                                        onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                                        placeholder="50"
                                    />
                                    <p className="text-xs text-slate-400">{t('form.maxRedemptionsHint')}</p>
                                </div>
                            </div>
                        </section>

                        <div className="flex flex-col gap-3 pb-12 pt-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                            >
                                {t('form.cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={loading || isInvalidDateRange}
                                className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
