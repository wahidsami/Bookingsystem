'use client';

import Link from 'next/link';

export default function ReportsLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Reports</h1>
        <p className="text-dark-400">Generate and view financial reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/financial/reports/general"
          className="flex flex-col rounded-lg border border-dark-600 bg-dark-800 p-6 transition hover:border-dark-500"
        >
          <h2 className="text-lg font-semibold text-white">General Report</h2>
          <p className="mt-2 text-sm text-dark-400">
            Summary, revenue by type, monthly trend, commission by package, top tenants and employees. Export to CSV.
          </p>
          <span className="mt-4 text-sm font-medium text-primary-400">View report →</span>
        </Link>

        <Link
          href="/dashboard/financial/reports/detailed"
          className="flex flex-col rounded-lg border border-dark-600 bg-dark-800 p-6 transition hover:border-dark-500"
        >
          <h2 className="text-lg font-semibold text-white">Detailed Report</h2>
          <p className="mt-2 text-sm text-dark-400">
            Transaction ledger with filters by date, tenant, and type. Pagination and CSV export.
          </p>
          <span className="mt-4 text-sm font-medium text-primary-400">View report →</span>
        </Link>
      </div>
    </div>
  );
}
