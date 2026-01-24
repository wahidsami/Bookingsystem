"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import { Currency } from "@/components/Currency";
import Link from "next/link";

interface Stats {
  tenants: {
    total: number;
    pending: number;
    approved: number;
    suspended: number;
    newThisMonth: number;
    growth: number;
  };
  users: {
    total: number;
    newThisMonth: number;
    growth: number;
  };
  bookings: {
    total: number;
    thisMonth: number;
    growth: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    growth: number;
  };
  breakdowns: {
    tenantsByType: { type: string; count: number }[];
    tenantsByPlan: { plan: string; count: number }[];
  };
}

interface Activity {
  id: string;
  entityType: string;
  action: string;
  performedByName: string;
  createdAt: string;
  details: any;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);
      const [statsRes, activitiesRes] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getRecentActivities(10),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (activitiesRes.success) setActivities(activitiesRes.activities);
    } catch (error: any) {
      console.error("Failed to load dashboard:", error);
      setError(
        error.message || "Failed to connect to the server. Please ensure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // Removed formatCurrency - now using Currency component

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-success";
    if (growth < 0) return "text-danger";
    return "text-dark-400";
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return "↑";
    if (growth < 0) return "↓";
    return "→";
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "approved": return "text-success";
      case "rejected":
      case "suspended": return "text-danger";
      case "created": return "text-info";
      case "login": return "text-primary-400";
      default: return "text-dark-300";
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6 animate-fade-in">
          <div className="card border border-danger/20 bg-danger/10">
            <div className="card-body text-center py-12">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Connection Error</h3>
              <p className="text-dark-300 mb-6">{error}</p>
              <div className="space-y-4">
                <div className="text-sm text-dark-400 space-y-2">
                  <p>Please ensure:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Docker Desktop is running</li>
                    <li>PostgreSQL container is started: <code className="bg-dark-800 px-2 py-1 rounded">docker-compose up -d</code></li>
                    <li>Backend server is running: <code className="bg-dark-800 px-2 py-1 rounded">cd server && npm run dev</code></li>
                  </ul>
                </div>
                <button
                  onClick={loadData}
                  className="btn btn-primary"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Quick Alert for Pending */}
        {stats && stats.tenants.pending > 0 && (
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-warning">
                  {stats.tenants.pending} Pending Approval{stats.tenants.pending > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-dark-400">
                  New clients waiting for review
                </p>
              </div>
            </div>
            <Link href="/dashboard/clients/pending" className="btn btn-warning btn-sm">
              Review Now
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Total Clients */}
          <div className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-dark-400 text-sm font-medium">Total Clients</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {formatNumber(stats?.tenants.total || 0)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-sm font-medium ${getGrowthColor(stats?.tenants.growth || 0)}`}>
                    {getGrowthIcon(stats?.tenants.growth || 0)} {Math.abs(stats?.tenants.growth || 0)}%
                  </span>
                  <span className="text-dark-500 text-xs">vs last month</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🏢</span>
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-dark-400 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {formatNumber(stats?.users.total || 0)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-sm font-medium ${getGrowthColor(stats?.users.growth || 0)}`}>
                    {getGrowthIcon(stats?.users.growth || 0)} {Math.abs(stats?.users.growth || 0)}%
                  </span>
                  <span className="text-dark-500 text-xs">vs last month</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-info/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>

          {/* Total Bookings */}
          <div className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-dark-400 text-sm font-medium">Total Bookings</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {formatNumber(stats?.bookings.total || 0)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-sm font-medium ${getGrowthColor(stats?.bookings.growth || 0)}`}>
                    {getGrowthIcon(stats?.bookings.growth || 0)} {Math.abs(stats?.bookings.growth || 0)}%
                  </span>
                  <span className="text-dark-500 text-xs">vs last month</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-success/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📅</span>
              </div>
            </div>
          </div>

          {/* Platform Revenue */}
          <div className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-dark-400 text-sm font-medium">Platform Revenue</p>
                <p className="text-3xl font-bold text-white mt-2">
                  <Currency amount={stats?.revenue.total || 0} />
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-sm font-medium ${getGrowthColor(stats?.revenue.growth || 0)}`}>
                    {getGrowthIcon(stats?.revenue.growth || 0)} {Math.abs(stats?.revenue.growth || 0)}%
                  </span>
                  <span className="text-dark-500 text-xs">vs last month</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-warning/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Approved</p>
            <p className="text-xl font-bold text-success mt-1">{stats?.tenants.approved || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Pending</p>
            <p className="text-xl font-bold text-warning mt-1">{stats?.tenants.pending || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Suspended</p>
            <p className="text-xl font-bold text-danger mt-1">{stats?.tenants.suspended || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">This Month</p>
            <p className="text-xl font-bold text-primary-400 mt-1">
              {stats?.tenants.newThisMonth || 0} new
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent Activities */}
          <div className="xl:col-span-2 card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-white">Recent Activities</h3>
              <Link href="/dashboard/activities" className="text-sm text-primary-400 hover:text-primary-300">
                View All
              </Link>
            </div>
            <div className="divide-y divide-dark-700">
              {activities.length === 0 ? (
                <div className="p-6 text-center text-dark-400">
                  No recent activities
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-sm">
                      {activity.entityType === "tenant" && "🏢"}
                      {activity.entityType === "platform_user" && "👤"}
                      {activity.entityType === "super_admin" && "🔐"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-200">
                        <span className="font-medium text-white">
                          {activity.performedByName || "System"}
                        </span>{" "}
                        <span className={getActionColor(activity.action)}>{activity.action}</span>{" "}
                        a {activity.entityType.replace("_", " ")}
                      </p>
                      <p className="text-xs text-dark-500 mt-1">
                        {formatTimeAgo(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Breakdown */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Clients by Type</h3>
            </div>
            <div className="card-body space-y-4">
              {stats?.breakdowns.tenantsByType.length === 0 ? (
                <p className="text-dark-400 text-sm">No data available</p>
              ) : (
                stats?.breakdowns.tenantsByType.map((item) => (
                  <div key={item.type}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-dark-300 capitalize">
                        {item.type?.replace("_", " ") || "Unknown"}
                      </span>
                      <span className="text-white font-medium">{item.count}</span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{
                          width: `${(item.count / (stats?.tenants.approved || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}

              <div className="pt-4 border-t border-dark-700">
                <h4 className="font-semibold text-white mb-4">By Plan</h4>
                {stats?.breakdowns.tenantsByPlan.map((item) => (
                  <div key={item.plan} className="flex items-center justify-between py-2">
                    <span className="text-dark-300 capitalize">{item.plan?.replace("_", " ")}</span>
                    <span className="badge badge-primary">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-white">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/dashboard/clients/pending"
                className="p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors text-center"
              >
                <span className="text-2xl block mb-2">⏳</span>
                <span className="text-sm text-dark-200">Review Pending</span>
              </Link>
              <Link
                href="/dashboard/clients"
                className="p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors text-center"
              >
                <span className="text-2xl block mb-2">🏢</span>
                <span className="text-sm text-dark-200">All Clients</span>
              </Link>
              <Link
                href="/dashboard/users"
                className="p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors text-center"
              >
                <span className="text-2xl block mb-2">👥</span>
                <span className="text-sm text-dark-200">Manage Users</span>
              </Link>
              <Link
                href="/dashboard/financial"
                className="p-4 bg-dark-700/50 rounded-lg hover:bg-dark-700 transition-colors text-center"
              >
                <span className="text-2xl block mb-2">📊</span>
                <span className="text-sm text-dark-200">Financial Reports</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

