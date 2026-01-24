"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import { Currency } from "@/components/Currency";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  walletBalance: number;
  loyaltyPoints: number;
  profileImage?: string;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    isVerified: "",
    page: 1,
  });

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: filters.page, limit: 15 };
      if (filters.search) params.search = filters.search;
      if (filters.isVerified) params.isVerified = filters.isVerified;

      const response = await adminApi.getUsers(params);
      if (response.success) {
        setUsers(response.users);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Removed formatCurrency - now using Currency component

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Users</h1>
          <p className="text-dark-400 text-sm mt-1">
            Manage end-users who book services
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
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
                  Verified
                </label>
                <select
                  value={filters.isVerified}
                  onChange={(e) =>
                    setFilters({ ...filters, isVerified: e.target.value, page: 1 })
                  }
                  className="select"
                >
                  <option value="">All Users</option>
                  <option value="true">Verified</option>
                  <option value="false">Not Verified</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() =>
                    setFilters({ search: "", isVerified: "", page: 1 })
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
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-dark-400">
              <span className="text-4xl block mb-2">👥</span>
              No users found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Contact</th>
                      <th>Verified</th>
                      <th>Wallet</th>
                      <th>Points</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                              {user.profileImage ? (
                                <img
                                  src={`http://localhost:5000${user.profileImage}`}
                                  alt=""
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-primary-400 font-semibold">
                                  {user.firstName?.[0] || "U"}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-xs text-dark-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="text-dark-200">{user.phone || "-"}</p>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span
                              className={`badge ${
                                user.emailVerified ? "badge-success" : "badge-warning"
                              }`}
                            >
                              {user.emailVerified ? "Email ✓" : "Email ✗"}
                            </span>
                            <span
                              className={`badge ${
                                user.phoneVerified ? "badge-success" : "badge-warning"
                              }`}
                            >
                              {user.phoneVerified ? "Phone ✓" : "Phone ✗"}
                            </span>
                          </div>
                        </td>
                        <td className="text-dark-200">
                          <Currency amount={user.walletBalance} />
                        </td>
                        <td className="text-dark-200">{user.loyaltyPoints || 0}</td>
                        <td className="text-dark-400 text-sm">
                          {formatDate(user.createdAt)}
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/users/${user.id}`}
                            className="btn btn-secondary btn-sm"
                          >
                            View
                          </Link>
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
      </div>
    </AdminLayout>
  );
}

