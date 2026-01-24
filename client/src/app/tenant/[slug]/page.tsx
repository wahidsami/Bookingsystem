"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/**
 * Tenant Detail Page - Unified Implementation
 * 
 * This page redirects to the PublicPage app (port 3004) which serves as
 * the single source of truth for all tenant public pages.
 * 
 * Benefits:
 * - Single implementation to maintain
 * - All features available (cart, booking, multiple pages)
 * - Consistent experience everywhere
 * - No code duplication
 */
export default function TenantDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    if (!slug) return;

    // Redirect to PublicPage (the unified tenant page)
    // PublicPage runs on port 3004 and has all features
    const publicPageUrl = `http://localhost:3004/t/${slug}`;
    
    // Small delay to show loading state, then redirect
    const timer = setTimeout(() => {
      window.location.href = publicPageUrl;
    }, 100);

    return () => clearTimeout(timer);
  }, [slug]);

  if (!slug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Invalid tenant URL</p>
          <Link
            href="/tenants"
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Browse Salons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Salon Page</h2>
        <p className="text-gray-600 mb-4">
          Redirecting to the salon's website...
        </p>
        <div className="text-sm text-gray-500">
          <p>If you're not redirected automatically,</p>
          <a
            href={`http://localhost:3004/t/${slug}`}
            className="text-primary hover:underline font-medium"
          >
            click here to continue
          </a>
        </div>
      </div>
    </div>
  );
}
