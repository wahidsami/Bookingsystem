"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import Link from "next/link";

interface Tenant {
  id: string;
  name: string;
  nameAr?: string;
  businessType: string[] | string;
  email: string;
  phone: string;
  city: string;
  status: string;
  plan: string;
  ownerName: string;
  createdAt: string;
  stats?: {
    totalBookings: number;
    totalRevenue: number;
  };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ClientsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; tenant: Tenant | null }>({ open: false, tenant: null });
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    businessType: "",
    plan: "",
    search: "",
    page: 1,
  });

  useEffect(() => {
    loadTenants();
  }, [filters]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: filters.page, limit: 15 };
      if (filters.status) params.status = filters.status;
      if (filters.businessType) params.businessType = filters.businessType;
      if (filters.plan) params.plan = filters.plan;
      if (filters.search) params.search = filters.search;

      const response = await adminApi.getTenants(params);
      if (response.success) {
        setTenants(response.tenants);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error("Failed to load tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: "badge-warning",
      approved: "badge-success",
      rejected: "badge-danger",
      suspended: "badge-danger",
      inactive: "badge-info",
    };
    return badges[status] || "badge-info";
  };

  const getPlanBadge = (plan: string) => {
    const badges: Record<string, string> = {
      free_trial: "badge-info",
      basic: "badge-primary",
      pro: "badge-success",
      enterprise: "badge-warning",
    };
    return badges[plan] || "badge-info";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDeleteTenant = async () => {
    const tenant = deleteModal.tenant;
    if (!tenant) return;
    setDeleting(true);
    try {
      await adminApi.deleteTenant(tenant.id);
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      setDeleteModal({ open: false, tenant: null });
    } catch (error) {
      console.error("Failed to delete tenant:", error);
      setDeleteModal({ open: false, tenant: null });
      alert("Failed to delete tenant. You may need the 'delete' permission on tenants.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">All Clients</h1>
            <p className="text-dark-400 text-sm mt-1">
              Manage salons, spas, and barbershops
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/clients/pending" className="btn btn-warning btn-sm">
              ⏳ Pending Approvals
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Name, email, phone..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value, page: 1 })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value, page: 1 })
                  }
                  className="select"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Business Type
                </label>
                <select
                  value={filters.businessType}
                  onChange={(e) =>
                    setFilters({ ...filters, businessType: e.target.value, page: 1 })
                  }
                  className="select"
                >
                  <option value="">All Types</option>
                  <option value="salon">Salon</option>
                  <option value="spa">Spa</option>
                  <option value="barbershop">Barbershop</option>
                  <option value="beauty_center">Beauty Center</option>
                  <option value="nail_studio">Nail Studio</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Plan
                </label>
                <select
                  value={filters.plan}
                  onChange={(e) =>
                    setFilters({ ...filters, plan: e.target.value, page: 1 })
                  }
                  className="select"
                >
                  <option value="">All Plans</option>
                  <option value="free_trial">Free Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() =>
                    setFilters({
                      status: "",
                      businessType: "",
                      plan: "",
                      search: "",
                      page: 1,
                    })
                  }
                  className="btn btn-secondary w-full"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-10 text-center">
              <span className="text-5xl block mb-4" aria-hidden>🏢</span>
              <h3 className="text-lg font-semibold text-white mb-1">No clients yet</h3>
              <p className="text-dark-400 text-sm max-w-sm mx-auto mb-4">
                {filters.status || filters.businessType || filters.plan || filters.search
                  ? "No clients match your filters. Try clearing filters to see all clients."
                  : "When businesses register, they will appear here. You can review pending sign-ups in Pending Approvals."}
              </p>
              {filters.status || filters.businessType || filters.plan || filters.search ? (
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      status: "",
                      businessType: "",
                      plan: "",
                      search: "",
                      page: 1,
                    })
                  }
                  className="btn btn-primary btn-sm"
                >
                  Clear filters
                </button>
              ) : (
                <Link href="/dashboard/clients/pending" className="btn btn-primary btn-sm">
                  View pending approvals
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Type</th>
                      <th>Owner</th>
                      <th>City</th>
                      <th>Status</th>
                      <th>Plan</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <td>
                          <div>
                            <p className="font-medium text-white">{tenant.name}</p>
                            <p className="text-xs text-dark-400">{tenant.email}</p>
                          </div>
                        </td>
                        <td>
                          <span className="capitalize text-dark-300">
                            {Array.isArray(tenant.businessType)
                              ? tenant.businessType.map(t => t.replace("_", " ")).join(", ")
                              : tenant.businessType?.replace("_", " ") || "-"}
                          </span>
                        </td>
                        <td>
                          <div>
                            <p className="text-dark-200">{tenant.ownerName || "-"}</p>
                            <p className="text-xs text-dark-400">{tenant.phone}</p>
                          </div>
                        </td>
                        <td className="text-dark-300">{tenant.city || "-"}</td>
                        <td>
                          <span className={`badge ${getStatusBadge(tenant.status)}`}>
                            {tenant.status}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getPlanBadge(tenant.plan)}`}>
                            {tenant.plan?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="text-dark-400 text-sm">
                          {formatDate(tenant.createdAt)}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/clients/${tenant.id}`}
                              className="btn btn-secondary btn-sm"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeleteModal({ open: true, tenant })}
                              className="btn btn-danger btn-sm"
                              title="Delete tenant and all related data"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-between">
                  <p className="text-sm text-dark-400">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} results
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setFilters({ ...filters, page: filters.page - 1 })
                      }
                      disabled={pagination.page === 1}
                      className="btn btn-secondary btn-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setFilters({ ...filters, page: filters.page + 1 })
                      }
                      disabled={pagination.page === pagination.totalPages}
                      className="btn btn-secondary btn-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deleteModal.open && deleteModal.tenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="card max-w-md w-full mx-4">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-white">Delete client</h3>
                <p className="text-dark-300 mt-2">
                  Are you sure you want to delete <strong className="text-white">{(deleteModal.tenant as any).name_en || deleteModal.tenant.name}</strong>?
                  This will permanently remove the tenant and all related data (subscriptions, bills, appointments, orders, staff, services, products, etc.).
                </p>
                <p className="text-danger text-sm mt-2">This action cannot be undone.</p>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ open: false, tenant: null })}
                    className="btn btn-secondary"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteTenant}
                    className="btn btn-danger"
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete permanently"}
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

