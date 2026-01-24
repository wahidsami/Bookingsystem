"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import Link from "next/link";

interface Tenant {
  id: string;
  name: string;
  nameAr?: string;
  businessType: string;
  email: string;
  phone: string;
  city: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  documents: {
    commercialRegister?: { url: string };
    license?: { url: string };
    ownerIdCard?: { url: string };
  };
  createdAt: string;
}

export default function PendingClientsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; tenantId: string | null }>({
    open: false,
    tenantId: null,
  });
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadPendingTenants();
  }, []);

  const loadPendingTenants = async () => {
    try {
      const response = await adminApi.getPendingTenants();
      if (response.success) {
        setTenants(response.tenants);
      }
    } catch (error) {
      console.error("Failed to load pending tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this client?")) return;

    setActionLoading(id);
    try {
      const response = await adminApi.approveTenant(id);
      if (response.success) {
        setTenants(tenants.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error("Failed to approve tenant:", error);
      alert("Failed to approve tenant");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.tenantId || !rejectReason.trim()) return;

    setActionLoading(rejectModal.tenantId);
    try {
      const response = await adminApi.rejectTenant(rejectModal.tenantId, rejectReason);
      if (response.success) {
        setTenants(tenants.filter((t) => t.id !== rejectModal.tenantId));
        setRejectModal({ open: false, tenantId: null });
        setRejectReason("");
      }
    } catch (error) {
      console.error("Failed to reject tenant:", error);
      alert("Failed to reject tenant");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return "Less than an hour ago";
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Pending Approvals</h1>
            <p className="text-dark-400 text-sm mt-1">
              {tenants.length} client{tenants.length !== 1 ? "s" : ""} waiting for review
            </p>
          </div>
          <Link href="/dashboard/clients" className="btn btn-secondary">
            ← All Clients
          </Link>
        </div>

        {/* Pending Cards */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner w-8 h-8"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="card p-12 text-center">
            <span className="text-6xl block mb-4">🎉</span>
            <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
            <p className="text-dark-400">No pending approvals at the moment</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="card">
                <div className="card-header flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-warning/20 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">
                        {tenant.businessType === "salon" && "💇"}
                        {tenant.businessType === "spa" && "🧖"}
                        {tenant.businessType === "barbershop" && "💈"}
                        {tenant.businessType === "beauty_center" && "💅"}
                        {!tenant.businessType && "🏢"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{tenant.name}</h3>
                      <p className="text-sm text-dark-400 capitalize">
                        {tenant.businessType?.replace("_", " ")} • {tenant.city || "Location not set"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-warning">Pending Review</span>
                    <p className="text-xs text-dark-500 mt-1">{getTimeAgo(tenant.createdAt)}</p>
                  </div>
                </div>

                <div className="card-body">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Contact Info */}
                    <div>
                      <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">
                        Business Contact
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-dark-200">
                          <span className="text-dark-400">Email:</span> {tenant.email || "-"}
                        </p>
                        <p className="text-dark-200">
                          <span className="text-dark-400">Phone:</span> {tenant.phone || "-"}
                        </p>
                      </div>
                    </div>

                    {/* Owner Info */}
                    <div>
                      <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">
                        Owner Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-dark-200">
                          <span className="text-dark-400">Name:</span> {tenant.ownerName || "-"}
                        </p>
                        <p className="text-dark-200">
                          <span className="text-dark-400">Phone:</span> {tenant.ownerPhone || "-"}
                        </p>
                        <p className="text-dark-200">
                          <span className="text-dark-400">Email:</span> {tenant.ownerEmail || "-"}
                        </p>
                      </div>
                    </div>

                    {/* Documents */}
                    <div>
                      <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">
                        Documents
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={tenant.documents?.commercialRegister ? "text-success" : "text-dark-500"}>
                            {tenant.documents?.commercialRegister ? "✓" : "○"}
                          </span>
                          <span className="text-sm text-dark-300">Commercial Register</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={tenant.documents?.license ? "text-success" : "text-dark-500"}>
                            {tenant.documents?.license ? "✓" : "○"}
                          </span>
                          <span className="text-sm text-dark-300">Business License</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={tenant.documents?.ownerIdCard ? "text-success" : "text-dark-500"}>
                            {tenant.documents?.ownerIdCard ? "✓" : "○"}
                          </span>
                          <span className="text-sm text-dark-300">Owner ID</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-6 border-t border-dark-700 flex items-center justify-between">
                    <div className="text-xs text-dark-500">
                      Applied on {formatDate(tenant.createdAt)}
                    </div>
                    <div className="flex gap-3">
                      <Link
                        href={`/dashboard/clients/${tenant.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => setRejectModal({ open: true, tenantId: tenant.id })}
                        disabled={actionLoading === tenant.id}
                        className="btn btn-danger btn-sm"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(tenant.id)}
                        disabled={actionLoading === tenant.id}
                        className="btn btn-success btn-sm"
                      >
                        {actionLoading === tenant.id ? (
                          <>
                            <div className="spinner w-4 h-4"></div>
                            Processing...
                          </>
                        ) : (
                          "✓ Approve"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reject Modal */}
        {rejectModal.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md">
              <div className="card-header">
                <h3 className="font-semibold text-white">Reject Application</h3>
              </div>
              <div className="card-body space-y-4">
                <p className="text-dark-300 text-sm">
                  Please provide a reason for rejecting this application. This will be shared with
                  the applicant.
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={4}
                  className="input"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setRejectModal({ open: false, tenantId: null });
                      setRejectReason("");
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || actionLoading !== null}
                    className="btn btn-danger"
                  >
                    {actionLoading ? "Rejecting..." : "Reject Application"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

