'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

const tabs = [
  { name: 'Overview', href: '/dashboard/financial' },
  { name: 'Tenants', href: '/dashboard/financial/tenants' },
  { name: 'Reports', href: '/dashboard/financial/reports' },
];

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <nav className="flex gap-2 border-b border-dark-700 pb-2">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/dashboard/financial'
                ? pathname === '/dashboard/financial'
                : pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-t px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border border-b-0 border-dark-600 bg-dark-800 text-white'
                    : 'text-dark-400 hover:bg-dark-800 hover:text-white'
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </AdminLayout>
  );
}
