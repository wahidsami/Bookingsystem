"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Clients", href: "/dashboard/clients", icon: "🏢" },
  { name: "Pending", href: "/dashboard/clients/pending", icon: "⏳", badge: true },
  { name: "Users", href: "/dashboard/users", icon: "👥" },
  { name: "Financial", href: "/dashboard/financial", icon: "💰" },
  { name: "Packages", href: "/dashboard/packages", icon: "📦" },
  { name: "Marketing", href: "/dashboard/marketing", icon: "🔥" },
  { name: "Clients Control", href: "/dashboard/clients-control", icon: "🎛️" },
  { name: "Activities", href: "/dashboard/activities", icon: "📋" },
  { name: "Settings", href: "/dashboard/settings", icon: "⚙️" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { admin, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch pending count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const token = sessionStorage.getItem("rifah_admin_token");
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/admin/tenants/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          setPendingCount(data.count);
        }
      } catch (error) {
        console.error("Failed to fetch pending count:", error);
      }
    };

    if (isAuthenticated) {
      fetchPendingCount();
    }
  }, [isAuthenticated]);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname?.startsWith(href);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Mobile header */}
      <header className="lg:hidden bg-dark-800 border-b border-dark-700 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-dark-300 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
            <span className="font-semibold text-white">Rifah Admin</span>
          </div>
          <div className="w-8" />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-dark-700 transform transition-transform duration-300
          lg:translate-x-0 lg:static lg:inset-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Sidebar Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-dark-700">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <div>
              <h2 className="font-bold text-white">Rifah Admin</h2>
              <p className="text-xs text-dark-400">Super Admin Panel</p>
            </div>
          </div>

          {/* Admin Info */}
          <div className="px-6 py-4 border-b border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
                <span className="text-primary-400 font-semibold">
                  {admin?.firstName?.[0] || "A"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {admin?.firstName} {admin?.lastName}
                </p>
                <p className="text-xs text-dark-400 truncate">{admin?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link ${isActive(item.href) ? "active" : ""}`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="flex-1">{item.name}</span>
                {item.badge && pendingCount > 0 && (
                  <span className="px-2 py-0.5 bg-warning text-dark-900 text-xs font-bold rounded-full">
                    {pendingCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="px-4 py-4 border-t border-dark-700">
            <button
              onClick={logout}
              className="sidebar-link w-full text-danger hover:bg-danger/10"
            >
              <span className="text-xl">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen lg:min-w-0">
          {/* Desktop Header */}
          <header className="hidden lg:block bg-dark-800/50 backdrop-blur-lg border-b border-dark-700 sticky top-0 z-30">
            <div className="px-6 py-4 flex items-center justify-between">
              <h1 className="text-xl font-semibold text-white">
                {navigation.find((item) => isActive(item.href))?.name || "Dashboard"}
              </h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-dark-400">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

