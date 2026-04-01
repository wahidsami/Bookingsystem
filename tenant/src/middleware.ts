import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'always'
});

export default function middleware(request: NextRequest) {
  // Payment link from email may open without locale (e.g. /payment?token=xxx) — redirect to default locale
  const pathname = request.nextUrl.pathname;
  if (pathname === '/payment' || pathname.startsWith('/payment/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/payment/, '/ar/payment');
    return NextResponse.redirect(url);
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*', '/payment', '/payment/:path*']
};

