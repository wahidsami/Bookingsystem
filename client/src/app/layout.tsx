import type { Metadata } from "next";
import { BRANDING } from "@/config/branding";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PWAInstaller } from "@/components/PWAInstaller";
import { defaultLocale, localeDirection } from "@/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
    title: `${BRANDING.name} - ${BRANDING.tagline}`,
    description: "Multi-tenant booking platform for salons and spas",
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: BRANDING.name,
    },
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang={defaultLocale} suppressHydrationWarning>
            <head>
                {/* Set direction immediately before React hydration to prevent flash */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    const savedLocale = localStorage.getItem('rifah_locale');
                                    const direction = savedLocale === 'ar' ? 'rtl' : 'ltr';
                                    // Set both attribute and property
                                    document.documentElement.setAttribute('dir', direction);
                                    document.documentElement.dir = direction;
                                    document.documentElement.setAttribute('lang', savedLocale || 'en');
                                    document.documentElement.lang = savedLocale || 'en';
                                } catch (e) {
                                    document.documentElement.dir = 'ltr';
                                    document.documentElement.lang = 'en';
                                }
                            })();
                        `,
                    }}
                />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                {/* Cairo font - supports both English and Arabic beautifully */}
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
                
                {/* PWA Meta Tags */}
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#8B5CF6" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="Rifah" />
                <link rel="apple-touch-icon" href="/icon-192.png" />
            </head>
            <body className="font-sans antialiased">
                <LanguageProvider>
                    <AuthProvider>
                        {children}
                        <PWAInstaller />
                    </AuthProvider>
                </LanguageProvider>
            </body>
        </html>
    );
}
