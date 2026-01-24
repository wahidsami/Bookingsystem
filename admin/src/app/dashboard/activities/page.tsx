"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";

interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedByType: string;
  performedById: string;
  performedByName: string;
  details: any;
  previousValue: any;
  newValue: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadActivities();
  }, [limit]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getRecentActivities(limit);
      if (response.success) {
        setActivities(response.activities);
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      created: "text-info",
      updated: "text-primary-400",
      deleted: "text-danger",
      approved: "text-success",
      rejected: "text-danger",
      suspended: "text-danger",
      activated: "text-success",
      login: "text-primary-400",
      logout: "text-dark-400",
      password_change: "text-warning",
    };
    return colors[action] || "text-dark-300";
  };

  const getEntityIcon = (entityType: string) => {
    const icons: Record<string, string> = {
      tenant: "🏢",
      platform_user: "👤",
      super_admin: "🔐",
      appointment: "📅",
      transaction: "💳",
      system: "⚙️",
    };
    return icons[entityType] || "📋";
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Activity Log</h1>
            <p className="text-dark-400 text-sm mt-1">
              Platform-wide activity and audit trail
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="select w-auto"
            >
              <option value="25">Last 25</option>
              <option value="50">Last 50</option>
              <option value="100">Last 100</option>
              <option value="200">Last 200</option>
            </select>
            <button onClick={loadActivities} className="btn btn-secondary">
              Refresh
            </button>
          </div>
        </div>

        {/* Activity List */}
        <div className="card">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-dark-400">
              <span className="text-4xl block mb-2">📋</span>
              No activities recorded
            </div>
          ) : (
            <div className="divide-y divide-dark-700">
              {activities.map((activity) => (
                <div key={activity.id} className="p-6 hover:bg-dark-700/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-xl">
                      {getEntityIcon(activity.entityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-dark-200">
                            <span className="font-medium text-white">
                              {activity.performedByName || activity.performedByType || "System"}
                            </span>{" "}
                            <span className={getActionColor(activity.action)}>
                              {activity.action}
                            </span>{" "}
                            a{" "}
                            <span className="text-dark-300">
                              {activity.entityType.replace("_", " ")}
                            </span>
                          </p>
                          {activity.details && Object.keys(activity.details).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-dark-500 cursor-pointer hover:text-dark-300">
                                View details
                              </summary>
                              <pre className="mt-2 p-2 bg-dark-800 rounded text-xs text-dark-300 overflow-x-auto">
                                {JSON.stringify(activity.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-dark-500 text-sm">{formatDate(activity.createdAt)}</p>
                          {activity.ipAddress && (
                            <p className="text-dark-600 text-xs mt-1">{activity.ipAddress}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <span className="text-dark-500">
                          Entity ID:{" "}
                          <code className="text-dark-400">{activity.entityId || "N/A"}</code>
                        </span>
                        <span className="text-dark-500">
                          Performed by:{" "}
                          <code className="text-dark-400">{activity.performedByType}</code>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

