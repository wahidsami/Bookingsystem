"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyNewAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";

  useEffect(() => {
    router.replace(`/${locale}/dashboard/appointments`);
  }, [locale, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-slate-500">
      Redirecting to the appointments board...
    </div>
  );
}
