"use client";

import { AdminLayout } from "@/components/AdminLayout";
import { SupportOperationsConsole } from "@/components/SupportOperationsConsole";

export default function SupportTicketPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      <SupportOperationsConsole initialTicketId={params.id} />
    </AdminLayout>
  );
}
