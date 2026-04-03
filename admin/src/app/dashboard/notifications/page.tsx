"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import { humanizeValue } from "@/lib/display";

interface AdminNotification {
  id: string;
  type: string;
  severity: string;
  titleEn: string;
  messageEn: string;
  actionUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

const severityBadgeClasses: Record<string, string> = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
};

const notificationTypeOptions = [
  { value: "", label: "All Types" },
  { value: "tenant_registered", label: "New tenant registrations" },
  { value: "tenant_approved_invoice_created", label: "Approval invoices issued" },
  { value: "tenant_approved_free_active", label: "Free tenants activated" },
  { value: "tenant_bill_paid", label: "Tenant bill paid" },
  { value: "tenant_bill_expired", label: "Tenant bill expired" },
  { value: "tenant_subscription_upgraded", label: "Upgrade invoices requested" },
  { value: "tenant_subscription_renewed", label: "Renewal invoices requested" },
];

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAdminNotifications({
        page: 1,
        limit: 100,
        unreadOnly,
        type: typeFilter || undefined,
        severity: severityFilter || undefined,
      });
      if (response.success) {
        setNotifications(response.notifications || []);
        setUnreadCount(response.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to load admin notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [unreadOnly, typeFilter, severityFilter]);

  const formatDate = (dateValue: string) =>
    new Date(dateValue).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const openNotification = async (notification: AdminNotification) => {
    if (!notification.isRead) {
      try {
        await adminApi.markAdminNotificationRead(notification.id);
      } catch (error) {
        console.error("Failed to mark notification read:", error);
      }
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const markAllAsRead = async () => {
    try {
      await adminApi.markAllAdminNotificationsRead();
      await loadNotifications();
    } catch (error) {
      console.error("Failed to mark all notifications read:", error);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-dark-400 text-sm mt-1">
              Track tenant registrations, invoice creation, bill payments, and expiry alerts.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="select w-auto"
            >
              {notificationTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="select w-auto"
            >
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
            <button
              type="button"
              onClick={() => setUnreadOnly((current) => !current)}
              className={`btn ${unreadOnly ? "btn-primary" : "btn-secondary"}`}
            >
              {unreadOnly ? "Showing Unread" : "Show Unread Only"}
            </button>
            <button type="button" onClick={markAllAsRead} className="btn btn-success">
              Mark All Read
            </button>
            <button type="button" onClick={loadNotifications} className="btn btn-secondary">
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Visible Notifications</p>
            <p className="text-2xl font-bold text-white mt-1">{notifications.length}</p>
          </div>
          <div className="card p-4 border border-warning/20">
            <p className="text-dark-400 text-xs font-medium">Unread Notifications</p>
            <p className="text-2xl font-bold text-warning mt-1">{unreadCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Current Filter</p>
            <p className="text-lg font-semibold text-white mt-1">
              {typeFilter ? humanizeValue(typeFilter) : "All events"}
            </p>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="spinner w-8 h-8" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-dark-400">
              <span className="text-4xl block mb-3">🔔</span>
              No notifications found for the current filters.
            </div>
          ) : (
            <div className="divide-y divide-dark-700">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`w-full text-left p-6 hover:bg-dark-700/30 transition-colors ${
                    notification.isRead ? "opacity-75" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-xl">
                      {notification.severity === "success"
                        ? "✅"
                        : notification.severity === "warning"
                          ? "⚠️"
                          : notification.severity === "danger"
                            ? "⛔"
                            : "🔔"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-white">
                              {notification.titleEn}
                            </h2>
                            <span
                              className={`badge ${severityBadgeClasses[notification.severity] || "badge-info"}`}
                            >
                              {notification.severity}
                            </span>
                            {!notification.isRead && (
                              <span className="badge badge-warning">Unread</span>
                            )}
                          </div>
                          <p className="text-sm text-dark-300 mt-2">
                            {notification.messageEn}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-dark-500">
                            <span>Type: {humanizeValue(notification.type)}</span>
                            <span>Entity: {notification.entityType || "system"}</span>
                            {notification.entityId && (
                              <span>
                                Entity ID: <code className="text-dark-400">{notification.entityId}</code>
                              </span>
                            )}
                            {notification.actionUrl && (
                              <span className="text-primary-400">Click row to open record →</span>
                            )}
                          </div>
                        </div>
                        <div className="text-dark-500 text-sm md:text-right shrink-0">
                          <p>{formatDate(notification.createdAt)}</p>
                          <p className="text-xs mt-1">
                            {notification.isRead
                              ? `Read ${notification.readAt ? formatDate(notification.readAt) : ""}`
                              : "Not read yet"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
