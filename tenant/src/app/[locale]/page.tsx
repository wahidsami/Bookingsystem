'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function TenantLandingPage() {
    const params = useParams();
    const locale = params?.locale as string || 'ar';
    const t = useTranslations('landing');
    const isRTL = locale === 'ar';

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background Image with Overlay */}
            <div 
                className="fixed inset-0 z-0"
                style={{
                    backgroundImage: 'url(/regbg.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-purple-800/85 to-pink-900/90"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 min-h-screen flex flex-col">
                {/* Header */}
                <header className="container mx-auto px-6 py-8">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <Image 
                                src="/rafahwhite.svg" 
                                alt="Rifah Logo" 
                                width={50} 
                                height={50}
                                className="w-12 h-12"
                            />
                            <div>
                                <h1 className="text-2xl font-bold text-white font-cairo">رفاه</h1>
                                <p className="text-xs text-purple-200">Rifah Platform</p>
                            </div>
                        </div>

                        {/* Language Switcher */}
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/ar`}
                                className={`px-4 py-2 rounded-lg transition ${
                                    locale === 'ar'
                                        ? 'bg-white text-purple-900 font-semibold'
                                        : 'text-white hover:bg-white/10'
                                }`}
                            >
                                العربية
                            </Link>
                            <Link
                                href={`/en`}
                                className={`px-4 py-2 rounded-lg transition ${
                                    locale === 'en'
                                        ? 'bg-white text-purple-900 font-semibold'
                                        : 'text-white hover:bg-white/10'
                                }`}
                            >
                                English
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Hero Section */}
                <main className="flex-1 container mx-auto px-6 flex items-center justify-center">
                    <div className="text-center max-w-4xl">
                        {/* Logo - Hero */}
                        <div className="flex justify-center mb-8">
                            <Image 
                                src="/rafahwhite.svg" 
                                alt="Rifah Logo" 
                                width={120} 
                                height={120}
                                className="w-28 h-28 md:w-32 md:h-32"
                            />
                        </div>

                        {/* Main Heading */}
                        <h1 
                            className="text-5xl md:text-7xl font-bold text-white mb-6 font-cairo leading-tight"
                            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                        >
                            {t('hero.title')}
                        </h1>

                        {/* Subheading */}
                        <p 
                            className="text-xl md:text-2xl text-purple-100 mb-8 leading-relaxed"
                            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                        >
                            {t('hero.subtitle')}
                        </p>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                                <div className="text-4xl mb-3">📅</div>
                                <h3 className="text-white font-semibold mb-2 font-cairo">
                                    {t('features.booking.title')}
                                </h3>
                                <p className="text-purple-200 text-sm">
                                    {t('features.booking.description')}
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                                <div className="text-4xl mb-3">👥</div>
                                <h3 className="text-white font-semibold mb-2 font-cairo">
                                    {t('features.staff.title')}
                                </h3>
                                <p className="text-purple-200 text-sm">
                                    {t('features.staff.description')}
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                                <div className="text-4xl mb-3">💰</div>
                                <h3 className="text-white font-semibold mb-2 font-cairo">
                                    {t('features.financial.title')}
                                </h3>
                                <p className="text-purple-200 text-sm">
                                    {t('features.financial.description')}
                                </p>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Link
                                href={`/${locale}/register`}
                                className="w-full sm:w-auto px-8 py-4 bg-white text-purple-900 rounded-xl font-bold text-lg hover:bg-purple-50 transition-all transform hover:scale-105 shadow-2xl"
                            >
                                {t('cta.register')} ✨
                            </Link>

                            <Link
                                href={`/${locale}/login`}
                                className="w-full sm:w-auto px-8 py-4 bg-transparent text-white border-2 border-white rounded-xl font-bold text-lg hover:bg-white hover:text-purple-900 transition-all transform hover:scale-105"
                            >
                                {t('cta.login')} 🚀
                            </Link>
                        </div>

                        {/* Trust Badges */}
                        <div className="mt-12 flex flex-wrap justify-center items-center gap-8 text-purple-200">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🔒</span>
                                <span className="text-sm">{t('trust.secure')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">⚡</span>
                                <span className="text-sm">{t('trust.fast')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🇸🇦</span>
                                <span className="text-sm">{t('trust.saudi')}</span>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="container mx-auto px-6 py-6 text-center">
                    <p className="text-purple-200 text-sm">
                        {t('footer.copyright')}
                    </p>
                </footer>
            </div>
        </div>
    );
}

