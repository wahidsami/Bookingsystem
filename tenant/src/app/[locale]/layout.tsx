import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { TenantAuthProvider } from '@/contexts/TenantAuthContext';
import "../globals.css";
import "@/styles/print.css";

export const metadata: Metadata = {
  title: "رفاه - لوحة تحكم الصالون | Rifah - Salon Dashboard",
  description: "لوحة تحكم شاملة لإدارة الصالونات والسبا | Comprehensive dashboard for managing salons and spas",
  icons: {
    icon: '/refahlogo.svg',
  },
};

const locales = ['ar', 'en'];

export default async function RootLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) notFound();

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        {/* Cairo Font for Arabic */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <TenantAuthProvider>
            {children}
          </TenantAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

