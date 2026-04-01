"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function SubscriptionPayCompatibilityPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || "ar";
  const token = searchParams?.get("token");

  useEffect(() => {
    const nextUrl = token
      ? `/${locale}/payment?token=${encodeURIComponent(token)}`
      : `/${locale}/payment`;

    router.replace(nextUrl);
  }, [locale, router, token]);

  return null;
}
