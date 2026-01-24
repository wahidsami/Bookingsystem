'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

// Step 1: Entity Details Component
const Step1EntityDetails = ({ formData, handleChange, handleFileChange, errors }: any) => {
    const t = useTranslations('register');
    const params = useParams();
    const locale = params?.locale as string || 'ar';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('step1.title')}</h2>
                <p className="text-gray-600">{t('step1.description')}</p>
            </div>

            {/* Business Names */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.nameArabic')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="name_ar"
                        value={formData.name_ar}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.name_ar && <p className="text-red-500 text-sm mt-1">{errors.name_ar}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.nameEnglish')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="name_en"
                        value={formData.name_en}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.name_en && <p className="text-red-500 text-sm mt-1">{errors.name_en}</p>}
                </div>
            </div>

            {/* Business Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step1.businessType')} <span className="text-red-500">*</span>
                </label>
                <select
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                >
                    <option value="">{t('step1.selectBusinessType')}</option>
                    <option value="spa">{t('step1.types.spa')}</option>
                    <option value="salon">{t('step1.types.salon')}</option>
                    <option value="beauty_center">{t('step1.types.beautyCenter')}</option>
                    <option value="barbershop">{t('step1.types.barbershop')}</option>
                    <option value="clinic">{t('step1.types.clinic')}</option>
                </select>
                {errors.businessType && <p className="text-red-500 text-sm mt-1">{errors.businessType}</p>}
            </div>

            {/* Logo Upload */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step1.logo')}
                </label>
                <input
                    type="file"
                    name="logo"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">{t('step1.logoHint')}</p>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.phone')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.mobile')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.mobile && <p className="text-red-500 text-sm mt-1">{errors.mobile}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.email')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.website')}
                    </label>
                    <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="https://"
                    />
                </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.password')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        minLength={8}
                    />
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                    <p className="text-sm text-gray-500 mt-1">{t('step1.passwordHint')}</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.confirmPassword')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        minLength={8}
                    />
                    {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.buildingNumber')}
                    </label>
                    <input
                        type="text"
                        name="buildingNumber"
                        value={formData.buildingNumber}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.district')}
                    </label>
                    <input
                        type="text"
                        name="district"
                        value={formData.district}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.street')}
                    </label>
                    <input
                        type="text"
                        name="street"
                        value={formData.street}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.city')}
                    </label>
                    <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step1.country')}
                    </label>
                    <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50"
                        disabled
                    />
                </div>
            </div>

            {/* Google Maps Link */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step1.googleMapLink')}
                </label>
                <input
                    type="url"
                    name="googleMapLink"
                    value={formData.googleMapLink}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="https://maps.google.com/..."
                />
                <p className="text-sm text-gray-500 mt-1">{t('step1.googleMapHint')}</p>
            </div>
        </div>
    );
};

// Step 2: Official Documentation Component
const Step2Documentation = ({ formData, handleChange, handleFileChange, errors }: any) => {
    const t = useTranslations('register');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('step2.title')}</h2>
                <p className="text-gray-600">{t('step2.description')}</p>
            </div>

            {/* Commercial Registration */}
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('step2.cr.title')}</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step2.cr.number')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="crNumber"
                        value={formData.crNumber}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.crNumber && <p className="text-red-500 text-sm mt-1">{errors.crNumber}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step2.cr.upload')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="file"
                        name="crDocument"
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    <p className="text-sm text-gray-500 mt-1">{t('step2.fileHint')}</p>
                </div>
            </div>

            {/* Tax Certificate */}
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('step2.tax.title')}</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step2.tax.number')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="taxNumber"
                        value={formData.taxNumber}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.taxNumber && <p className="text-red-500 text-sm mt-1">{errors.taxNumber}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step2.tax.upload')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="file"
                        name="taxDocument"
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    <p className="text-sm text-gray-500 mt-1">{t('step2.fileHint')}</p>
                </div>
            </div>

            {/* Business License */}
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('step2.license.title')}</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step2.license.number')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.licenseNumber && <p className="text-red-500 text-sm mt-1">{errors.licenseNumber}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step2.license.upload')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="file"
                        name="licenseDocument"
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    <p className="text-sm text-gray-500 mt-1">{t('step2.fileHint')}</p>
                </div>
            </div>
        </div>
    );
};

// Step 3: Contact Person Component
const Step3ContactPerson = ({ formData, handleChange, errors }: any) => {
    const t = useTranslations('register');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('step3.title')}</h2>
                <p className="text-gray-600">{t('step3.description')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step3.nameArabic')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="contactPersonNameAr"
                        value={formData.contactPersonNameAr}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step3.nameEnglish')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="contactPersonNameEn"
                        value={formData.contactPersonNameEn}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step3.email')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        name="contactPersonEmail"
                        value={formData.contactPersonEmail}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step3.mobile')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="tel"
                        name="contactPersonMobile"
                        value={formData.contactPersonMobile}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step3.position')} <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    name="contactPersonPosition"
                    value={formData.contactPersonPosition}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                    placeholder={t('step3.positionPlaceholder')}
                />
            </div>
        </div>
    );
};

// Step 4: Owner Details Component
const Step4OwnerDetails = ({ formData, handleChange, errors }: any) => {
    const t = useTranslations('register');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('step4.title')}</h2>
                <p className="text-gray-600">{t('step4.description')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step4.nameArabic')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="ownerNameAr"
                        value={formData.ownerNameAr}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.ownerNameAr && <p className="text-red-500 text-sm mt-1">{errors.ownerNameAr}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step4.nameEnglish')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="ownerNameEn"
                        value={formData.ownerNameEn}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.ownerNameEn && <p className="text-red-500 text-sm mt-1">{errors.ownerNameEn}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step4.phone')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="tel"
                        name="ownerPhone"
                        value={formData.ownerPhone}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.ownerPhone && <p className="text-red-500 text-sm mt-1">{errors.ownerPhone}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('step4.email')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        name="ownerEmail"
                        value={formData.ownerEmail}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                    />
                    {errors.ownerEmail && <p className="text-red-500 text-sm mt-1">{errors.ownerEmail}</p>}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step4.nationalId')} <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    name="ownerNationalId"
                    value={formData.ownerNationalId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                    placeholder={t('step4.nationalIdPlaceholder')}
                />
                {errors.ownerNationalId && <p className="text-red-500 text-sm mt-1">{errors.ownerNationalId}</p>}
            </div>
        </div>
    );
};

// Step 5: Business Details Component
const Step5BusinessDetails = ({ formData, setFormData, handleChange, errors }: any) => {
    const t = useTranslations('register');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('step5.title')}</h2>
                <p className="text-gray-600">{t('step5.description')}</p>
            </div>

            {/* Yes/No Questions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">
                        {t('step5.homeServices')}
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="providesHomeServices"
                                value="true"
                                checked={formData.providesHomeServices === true}
                                onChange={() => setFormData(prev => ({ ...prev, providesHomeServices: true }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.yes')}</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="providesHomeServices"
                                value="false"
                                checked={formData.providesHomeServices === false}
                                onChange={() => setFormData(prev => ({ ...prev, providesHomeServices: false }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.no')}</span>
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">
                        {t('step5.sellProducts')}
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="sellsProducts"
                                value="true"
                                checked={formData.sellsProducts === true}
                                onChange={() => setFormData(prev => ({ ...prev, sellsProducts: true }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.yes')}</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="sellsProducts"
                                value="false"
                                checked={formData.sellsProducts === false}
                                onChange={() => setFormData(prev => ({ ...prev, sellsProducts: false }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.no')}</span>
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">
                        {t('step5.paymentGateway')}
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="hasOwnPaymentGateway"
                                value="true"
                                checked={formData.hasOwnPaymentGateway === true}
                                onChange={() => setFormData(prev => ({ ...prev, hasOwnPaymentGateway: true }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.yes')}</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="hasOwnPaymentGateway"
                                value="false"
                                checked={formData.hasOwnPaymentGateway === false}
                                onChange={() => setFormData(prev => ({ ...prev, hasOwnPaymentGateway: false }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.no')}</span>
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">
                        {t('step5.socialMedia')}
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="advertiseOnSocialMedia"
                                value="true"
                                checked={formData.advertiseOnSocialMedia === true}
                                onChange={() => setFormData(prev => ({ ...prev, advertiseOnSocialMedia: true }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.yes')}</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="advertiseOnSocialMedia"
                                value="false"
                                checked={formData.advertiseOnSocialMedia === false}
                                onChange={() => setFormData(prev => ({ ...prev, advertiseOnSocialMedia: false }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.no')}</span>
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">
                        {t('step5.rifahPromotion')}
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="wantsRifahPromotion"
                                value="true"
                                checked={formData.wantsRifahPromotion === true}
                                onChange={() => setFormData(prev => ({ ...prev, wantsRifahPromotion: true }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.yes')}</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="wantsRifahPromotion"
                                value="false"
                                checked={formData.wantsRifahPromotion === false}
                                onChange={() => setFormData(prev => ({ ...prev, wantsRifahPromotion: false }))}
                                className="w-4 h-4 text-purple-600"
                            />
                            <span className="ml-2 text-sm">{t('step5.no')}</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Other Fields */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step5.staffCount')}
                </label>
                <input
                    type="number"
                    name="staffCount"
                    value={formData.staffCount}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="0"
                    placeholder="0"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step5.mainService')}
                </label>
                <textarea
                    name="mainService"
                    value={formData.mainService}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder={t('step5.mainServicePlaceholder')}
                />
            </div>

            {/* Service Ranking */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('step5.serviceRanking')}
                </label>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => handleChange({
                                target: { name: 'serviceRanking', value: star }
                            } as any)}
                            className={`text-3xl ${
                                star <= formData.serviceRanking
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                            }`}
                        >
                            ★
                        </button>
                    ))}
                </div>
                <p className="text-sm text-gray-500 mt-1">{t('step5.rankingHint')}</p>
            </div>
        </div>
    );
};

// Step 6: Subscription Package Selection Component
const Step6SubscriptionPackage = ({ formData, setFormData, errors }: any) => {
    const t = useTranslations('register');
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState<'monthly' | 'sixMonth' | 'annual'>('monthly');

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/v1/subscriptions/packages');
            const data = await response.json();
            if (data.success) {
                setPackages(data.packages.filter((pkg: any) => pkg.isActive));
            }
        } catch (error) {
            console.error('Failed to fetch packages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePackageSelect = (packageId: string, billingPeriod: string) => {
        setFormData((prev: any) => ({
            ...prev,
            selectedPackageId: packageId,
            selectedBillingPeriod: billingPeriod
        }));
    };

    const getPrice = (pkg: any) => {
        let price = 0;
        if (selectedTab === 'monthly') price = pkg.monthlyPrice;
        else if (selectedTab === 'sixMonth') price = pkg.sixMonthPrice;
        else price = pkg.annualPrice;
        return parseFloat(price) || 0;
    };

    const getSavings = (pkg: any) => {
        if (selectedTab === 'monthly') return 0;
        const monthlyPrice = parseFloat(pkg.monthlyPrice) || 0;
        const sixMonthPrice = parseFloat(pkg.sixMonthPrice) || 0;
        const annualPrice = parseFloat(pkg.annualPrice) || 0;
        if (selectedTab === 'sixMonth') return (monthlyPrice * 6) - sixMonthPrice;
        return (monthlyPrice * 12) - annualPrice;
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Subscription Plan</h2>
                <p className="text-gray-600">Select a subscription package that fits your business needs</p>
            </div>

            {/* Billing Period Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
                <button
                    type="button"
                    onClick={() => setSelectedTab('monthly')}
                    className={`px-6 py-3 font-medium transition ${
                        selectedTab === 'monthly'
                            ? 'text-purple-600 border-b-2 border-purple-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Monthly
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('sixMonth')}
                    className={`px-6 py-3 font-medium transition ${
                        selectedTab === 'sixMonth'
                            ? 'text-purple-600 border-b-2 border-purple-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    6 Months
                    <span className="ml-2 text-xs text-green-600 font-semibold">Save 10%</span>
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('annual')}
                    className={`px-6 py-3 font-medium transition ${
                        selectedTab === 'annual'
                            ? 'text-purple-600 border-b-2 border-purple-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Annual
                    <span className="ml-2 text-xs text-green-600 font-semibold">Save 17%</span>
                </button>
            </div>

            {/* Package Cards */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="text-gray-500 mt-4">Loading packages...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {packages.map((pkg) => {
                        const isSelected = formData.selectedPackageId === pkg.id && formData.selectedBillingPeriod === selectedTab;
                        const price = getPrice(pkg);
                        const savings = getSavings(pkg);

                        return (
                            <div
                                key={pkg.id}
                                className={`relative border-2 rounded-lg p-6 cursor-pointer transition ${
                                    isSelected
                                        ? 'border-purple-600 bg-purple-50'
                                        : 'border-gray-200 hover:border-purple-300'
                                } ${pkg.isFeatured ? 'ring-2 ring-purple-500' : ''}`}
                                onClick={() => handlePackageSelect(pkg.id, selectedTab)}
                            >
                                {pkg.isFeatured && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-xs font-bold">
                                        Most Popular
                                    </div>
                                )}

                                <div className="text-center mb-4">
                                    <h3 className="text-xl font-bold text-gray-900">{pkg.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{pkg.description || ''}</p>
                                </div>

                                <div className="text-center mb-4">
                                    <div className="text-3xl font-bold text-gray-900">
                                        <span className="riyal-symbol">﷼</span> {price.toFixed(2)}
                                    </div>
                                    <div className="text-sm text-gray-500">per month</div>
                                    {savings > 0 && (
                                        <div className="text-sm text-green-600 font-semibold mt-1">
                                            Save <span className="riyal-symbol">﷼</span> {savings.toFixed(2)}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="text-xs font-semibold text-gray-700">KEY LIMITS:</div>
                                    <ul className="space-y-1 text-sm text-gray-600">
                                        <li>• Bookings: {pkg.limits.maxBookingsPerMonth === -1 ? 'Unlimited' : `${pkg.limits.maxBookingsPerMonth}/mo`}</li>
                                        <li>• Staff: {pkg.limits.maxStaff === -1 ? 'Unlimited' : pkg.limits.maxStaff}</li>
                                        <li>• Services: {pkg.limits.maxServices === -1 ? 'Unlimited' : pkg.limits.maxServices}</li>
                                        <li>• Commission: {pkg.platformCommission}%</li>
                                    </ul>
                                </div>

                                {isSelected && (
                                    <div className="absolute top-4 right-4">
                                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {errors.selectedPackageId && (
                <p className="text-red-500 text-sm">{errors.selectedPackageId}</p>
            )}
        </div>
    );
};

// Step 7: Service Agreement Component
const Step7ServiceAgreement = ({ formData, handleChange, errors }: any) => {
    const t = useTranslations('register');
    const params = useParams();
    const locale = params?.locale as string || 'ar';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('step7.title')}</h2>
                <p className="text-gray-600">{t('step7.description')}</p>
            </div>

            {/* Service Agreement Content */}
            <div className="border border-gray-300 rounded-lg p-6 max-h-96 overflow-y-auto bg-gray-50">
                <div className="prose prose-sm max-w-none">
                    <h3 className="text-lg font-bold mb-4">{t('step7.agreementTitle')}</h3>
                    
                    <div className="space-y-4 text-gray-700">
                        <p>{t('step7.section1.title')}</p>
                        <p>{t('step7.section1.content')}</p>

                        <p>{t('step7.section2.title')}</p>
                        <p>{t('step7.section2.content')}</p>

                        <p>{t('step7.section3.title')}</p>
                        <p>{t('step7.section3.content')}</p>

                        <p>{t('step7.section4.title')}</p>
                        <p>{t('step7.section4.content')}</p>

                        <p>{t('step7.section5.title')}</p>
                        <p>{t('step7.section5.content')}</p>

                        <p className="text-sm text-gray-500 mt-6">
                            {t('step7.lastUpdated')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Agreement Checkbox */}
            <div className="flex items-start gap-3 p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
                <input
                    type="checkbox"
                    name="acceptedServiceAgreement"
                    checked={formData.acceptedServiceAgreement}
                    onChange={handleChange}
                    className="w-5 h-5 text-purple-600 mt-1"
                    required
                />
                <label className="text-sm text-gray-700">
                    {t('step7.acceptCheckbox')}{' '}
                    <span className="text-red-500">*</span>
                </label>
            </div>

            {errors.agreement && (
                <p className="text-red-500 text-sm">{errors.agreement}</p>
            )}
        </div>
    );
};

export default function RegisterPage() {
    const router = useRouter();
    const t = useTranslations('register');
    const params = useParams();
    const locale = params?.locale as string || 'ar';
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState<any>({});

    const [formData, setFormData] = useState({
        // Step 1: Entity Details
        name_en: '',
        name_ar: '',
        businessType: '',
        phone: '',
        mobile: '',
        email: '',
        website: '',
        password: '',
        confirmPassword: '',
        buildingNumber: '',
        district: '',
        street: '',
        city: '',
        country: 'Saudi Arabia',
        googleMapLink: '',
        
        // Step 2: Official Documentation
        crNumber: '',
        taxNumber: '',
        licenseNumber: '',
        
        // Step 3: Contact Person
        contactPersonNameAr: '',
        contactPersonNameEn: '',
        contactPersonEmail: '',
        contactPersonMobile: '',
        contactPersonPosition: '',
        
        // Step 4: Owner Details
        ownerNameAr: '',
        ownerNameEn: '',
        ownerPhone: '',
        ownerEmail: '',
        ownerNationalId: '',
        
        // Step 5: Business Details
        providesHomeServices: false,
        staffCount: '',
        mainService: '',
        sellsProducts: false,
        hasOwnPaymentGateway: false,
        serviceRanking: 0,
        advertiseOnSocialMedia: false,
        wantsRifahPromotion: false,
        
        // Step 6: Subscription Package
        selectedPackageId: '',
        selectedBillingPeriod: 'monthly',
        
        // Step 7: Service Agreement
        acceptedServiceAgreement: false
    });

    const [files, setFiles] = useState<any>({
        logo: null,
        crDocument: null,
        taxDocument: null,
        licenseDocument: null
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear error for this field
        if (errors[name]) {
            setErrors((prev: any) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: fileList } = e.target;
        if (fileList && fileList[0]) {
            setFiles((prev: any) => ({
                ...prev,
                [name]: fileList[0]
            }));
        }
    };

    const validateStep = (step: number) => {
        const newErrors: any = {};

        if (step === 1) {
            if (!formData.name_en) newErrors.name_en = t('step1.errors.nameEnRequired');
            if (!formData.name_ar) newErrors.name_ar = t('step1.errors.nameArRequired');
            if (!formData.businessType) newErrors.businessType = t('step1.errors.businessTypeRequired');
            if (!formData.email) newErrors.email = t('step1.errors.emailRequired');
            if (!formData.phone) newErrors.phone = t('step1.errors.phoneRequired');
            if (!formData.mobile) newErrors.mobile = t('step1.errors.mobileRequired');
            if (!formData.password) newErrors.password = t('step1.errors.passwordRequired');
            if (formData.password && formData.password.length < 8) {
                newErrors.password = t('step1.errors.passwordMinLength');
            }
            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = t('step1.errors.passwordMismatch');
            }
        }

        if (step === 2) {
            if (!formData.crNumber) newErrors.crNumber = t('step2.errors.crRequired');
            if (!formData.taxNumber) newErrors.taxNumber = t('step2.errors.taxRequired');
            if (!formData.licenseNumber) newErrors.licenseNumber = t('step2.errors.licenseRequired');
            if (!files.crDocument) newErrors.crDocument = t('step2.errors.crFileRequired');
            if (!files.taxDocument) newErrors.taxDocument = t('step2.errors.taxFileRequired');
            if (!files.licenseDocument) newErrors.licenseDocument = t('step2.errors.licenseFileRequired');
        }

        if (step === 4) {
            if (!formData.ownerNameAr) newErrors.ownerNameAr = 'Owner name in Arabic is required';
            if (!formData.ownerNameEn) newErrors.ownerNameEn = 'Owner name in English is required';
            if (!formData.ownerPhone) newErrors.ownerPhone = 'Owner phone is required';
            if (!formData.ownerEmail) newErrors.ownerEmail = 'Owner email is required';
            if (!formData.ownerNationalId) newErrors.ownerNationalId = 'National ID / Iqama is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 7));
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateStep(currentStep)) {
            return;
        }

        if (currentStep < 7) {
            nextStep();
            return;
        }

        // Final submission
        if (!formData.acceptedServiceAgreement) {
            setError(t('step7.errors.agreementRequired'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Create FormData for file upload
            const submitData = new FormData();

            // Append all form fields with proper type handling
            Object.entries(formData).forEach(([key, value]) => {
                if (key !== 'confirmPassword') {
                    // Convert booleans to 'true'/'false' strings for FormData
                    // but preserve numeric strings for staff count
                    if (typeof value === 'boolean') {
                        submitData.append(key, value ? 'true' : 'false');
                    } else if (value !== null && value !== undefined) {
                        submitData.append(key, String(value));
                    }
                }
            });

            // Append files
            Object.entries(files).forEach(([key, file]) => {
                if (file) {
                    submitData.append(key, file);
                }
            });

            submitData.append('preferredLanguage', locale);

            const response = await fetch('http://localhost:5000/api/v1/auth/tenant/register', {
                method: 'POST',
                body: submitData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || t('errors.registrationFailed'));
            }

            // Store token
            if (data.accessToken) {
                localStorage.setItem('tenant_token', data.accessToken);
            }

            // Redirect to dashboard with success message
            router.push(`/${locale}/dashboard?registered=true`);

        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || t('errors.somethingWrong'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative py-12 px-4">
            {/* Background Image - No Overlay */}
            <div 
                className="fixed inset-0 z-0"
                style={{
                    backgroundImage: 'url(/regbg.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            ></div>

            {/* Back to Home Button */}
            <Link 
                href={`/${locale}`}
                className="fixed top-6 left-6 z-20 bg-white/90 backdrop-blur-sm text-purple-900 hover:bg-white px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-lg font-semibold"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {locale === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </Link>

            <div className="relative z-10 max-w-4xl mx-auto">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="bg-white rounded-full p-4 shadow-xl">
                            <Image 
                                src="/refahlogo.svg" 
                                alt="Rifah Logo" 
                                width={80} 
                                height={80}
                                className="w-20 h-20"
                            />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-purple-900 mb-2 font-cairo">
                        {t('title')}
                    </h1>
                    <p className="text-gray-700 font-medium text-lg">{t('subtitle')}</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8 bg-white rounded-xl p-6 shadow-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                        {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                            <div key={step} className="flex-1">
                                <div className="flex items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                            step <= currentStep
                                                ? 'bg-purple-600 text-white shadow-lg'
                                                : 'bg-gray-200 text-gray-600'
                                        }`}
                                    >
                                        {step}
                                    </div>
                                    {step < 7 && (
                                        <div
                                            className={`flex-1 h-1 mx-2 rounded ${
                                                step < currentStep ? 'bg-purple-600' : 'bg-gray-300'
                                            }`}
                                        />
                                    )}
                                </div>
                                <div className={`text-xs text-center mt-2 font-semibold ${
                                    step <= currentStep ? 'text-purple-900' : 'text-gray-600'
                                }`}>
                                    {t(`steps.step${step}`)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form */}
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-white/20">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {currentStep === 1 && (
                            <Step1EntityDetails
                                formData={formData}
                                handleChange={handleChange}
                                handleFileChange={handleFileChange}
                                errors={errors}
                            />
                        )}

                        {currentStep === 2 && (
                            <Step2Documentation
                                formData={formData}
                                handleChange={handleChange}
                                handleFileChange={handleFileChange}
                                errors={errors}
                            />
                        )}

                        {currentStep === 3 && (
                            <Step3ContactPerson
                                formData={formData}
                                handleChange={handleChange}
                                errors={errors}
                            />
                        )}

                        {currentStep === 4 && (
                            <Step4OwnerDetails
                                formData={formData}
                                handleChange={handleChange}
                                errors={errors}
                            />
                        )}

                        {currentStep === 5 && (
                            <Step5BusinessDetails
                                formData={formData}
                                setFormData={setFormData}
                                handleChange={handleChange}
                                errors={errors}
                            />
                        )}

                        {currentStep === 6 && (
                            <Step6SubscriptionPackage
                                formData={formData}
                                setFormData={setFormData}
                                errors={errors}
                            />
                        )}

                        {currentStep === 7 && (
                            <Step7ServiceAgreement
                                formData={formData}
                                handleChange={handleChange}
                                errors={errors}
                            />
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-8 pt-6 border-t">
                            {currentStep > 1 && (
                                <button
                                    type="button"
                                    onClick={prevStep}
                                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                                >
                                    {t('buttons.previous')}
                                </button>
                            )}

                            {currentStep < 7 ? (
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition ml-auto"
                                >
                                    {t('buttons.next')}
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading || !formData.acceptedServiceAgreement}
                                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                                >
                                    {loading ? t('buttons.submitting') : t('buttons.submit')}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Login Link */}
                <div className="text-center mt-6">
                    <div className="bg-white rounded-lg p-4 shadow-lg border border-gray-200">
                        <p className="text-gray-700 font-medium">
                            {t('alreadyHaveAccount')}{' '}
                            <Link href={`/${locale}/login`} className="text-purple-600 hover:text-purple-700 font-bold underline">
                                {t('loginLink')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

