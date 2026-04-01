"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, getImageUrl } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useParams, useRouter } from "next/navigation";
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
  dateOfBirth?: string;
  gender?: string;
  preferredLanguage: string;
  notificationPreferences: any;
  createdAt: string;
}

interface Booking {
  id: string;
  startTime: string;
  status: string;
  price: number;
  Service?: { name_en: string; name_ar: string };
  Staff?: { name: string };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function UserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState<{
    open: boolean;
    type: "wallet" | "loyalty" | null;
  }>({ open: false, type: null });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadUserDetails();
    }
  }, [params.id]);

  const loadUserDetails = async () => {
    try {
      const response = await adminApi.getUserDetails(params.id as string);
      if (response.success) {
        setUser(response.user);
        setBookings(response.bookings || []);
        setTransactions(response.transactions || []);
        setStats(response.stats);
      }
    } catch (error) {
      console.error("Failed to load user details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustModal.type || !adjustAmount || !adjustReason.trim()) return;

    setActionLoading(true);
    try {
      await adminApi.adjustUserBalance(
        user!.id,
        adjustModal.type,
        parseFloat(adjustAmount),
        adjustReason
      );
      setAdjustModal({ open: false, type: null });
      setAdjustAmount("");
      setAdjustReason("");
      loadUserDetails();
    } catch (error) {
      console.error("Failed to adjust balance:", error);
      alert("Failed to adjust balance");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Removed formatCurrency - now using Currency component

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: "badge-warning",
      confirmed: "badge-info",
      completed: "badge-success",
      cancelled: "badge-danger",
    };
    return badges[status] || "badge-info";
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

  if (!user) {
    return (
      <AdminLayout>
        <div className="card p-8 text-center">
          <span className="text-4xl block mb-4">❌</span>
          <h3 className="text-xl font-semibold text-white mb-2">User Not Found</h3>
          <Link href="/dashboard/users" className="btn btn-primary mt-4">
            Back to Users
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center text-3xl">
              {user.profileImage ? (
                <img
                  src={getImageUrl(user.profileImage)}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-primary-400 font-bold">
                  {user.firstName?.[0] || "U"}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-dark-400 mt-1">{user.email}</p>
              <p className="text-dark-500 text-sm mt-1">ID: {user.id}</p>
            </div>
          </div>
          <Link href="/dashboard/users" className="btn btn-secondary">
            ← Back to Users
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Total Bookings</p>
            <p className="text-2xl font-bold text-white mt-1">{stats?.totalBookings || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Completed</p>
            <p className="text-2xl font-bold text-success mt-1">{stats?.completedBookings || 0}</p>
          </div>
          <div className="card p-4 cursor-pointer hover:border-primary-500/50" 
               onClick={() => setAdjustModal({ open: true, type: "wallet" })}>
            <p className="text-dark-400 text-xs font-medium">Wallet Balance</p>
            <p className="text-2xl font-bold text-white mt-1">
              <Currency amount={user.walletBalance} />
            </p>
            <p className="text-xs text-primary-400 mt-1">Click to adjust</p>
          </div>
          <div className="card p-4 cursor-pointer hover:border-primary-500/50"
               onClick={() => setAdjustModal({ open: true, type: "loyalty" })}>
            <p className="text-dark-400 text-xs font-medium">Loyalty Points</p>
            <p className="text-2xl font-bold text-white mt-1">{user.loyaltyPoints || 0}</p>
            <p className="text-xs text-primary-400 mt-1">Click to adjust</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">User Information</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-dark-400 text-xs">Email</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-white">{user.email}</p>
                    <span className={`badge ${user.emailVerified ? "badge-success" : "badge-warning"}`}>
                      {user.emailVerified ? "Verified" : "Not Verified"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Phone</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-white">{user.phone || "-"}</p>
                    <span className={`badge ${user.phoneVerified ? "badge-success" : "badge-warning"}`}>
                      {user.phoneVerified ? "Verified" : "Not Verified"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Date of Birth</p>
                  <p className="text-white mt-1">{formatDate(user.dateOfBirth || "")}</p>
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Gender</p>
                  <p className="text-white mt-1 capitalize">{user.gender || "-"}</p>
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Preferred Language</p>
                  <p className="text-white mt-1 uppercase">{user.preferredLanguage || "en"}</p>
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Joined</p>
                  <p className="text-white mt-1">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Notification Preferences</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-4">
                {user.notificationPreferences &&
                  Object.entries(user.notificationPreferences).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={value ? "text-success" : "text-dark-500"}>
                        {value ? "✓" : "✗"}
                      </span>
                      <span className="text-dark-200 capitalize">{key}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-white">Recent Bookings</h3>
          </div>
          {bookings.length === 0 ? (
            <div className="p-6 text-center text-dark-400">No bookings yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Staff</th>
                    <th>Date</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 10).map((booking) => (
                    <tr key={booking.id}>
                      <td className="text-white">
                        {booking.Service?.name_en || "Service"}
                      </td>
                      <td className="text-dark-300">{booking.Staff?.name || "-"}</td>
                      <td className="text-dark-300">{formatDateTime(booking.startTime)}</td>
                      <td className="text-white"><Currency amount={booking.price} /></td>
                      <td>
                        <span className={`badge ${getStatusBadge(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-white">Recent Transactions</h3>
          </div>
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-dark-400">No transactions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id}>
                      <td className="text-white capitalize">{tx.type?.replace("_", " ")}</td>
                      <td className={tx.type === "refund" ? "text-success" : "text-white"}>
                        {tx.type === "refund" ? "+" : "-"}
                        <Currency amount={parseFloat(tx.amount.toString())} />
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(tx.status)}`}>{tx.status}</span>
                      </td>
                      <td className="text-dark-300">{formatDateTime(tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Adjust Balance Modal */}
        {adjustModal.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md">
              <div className="card-header">
                <h3 className="font-semibold text-white">
                  Adjust {adjustModal.type === "wallet" ? "Wallet Balance" : "Loyalty Points"}
                </h3>
              </div>
              <div className="card-body space-y-4">
                <p className="text-dark-300 text-sm">
                  Current {adjustModal.type === "wallet" ? "balance" : "points"}:{" "}
                  <span className="font-bold text-white">
                    {adjustModal.type === "wallet"
                      ? <Currency amount={user.walletBalance} />
                      : user.loyaltyPoints}
                  </span>
                </p>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-2">
                    Amount (use negative for deduction)
                  </label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder={adjustModal.type === "wallet" ? "100.00 or -50.00" : "100 or -50"}
                    className="input"
                    step={adjustModal.type === "wallet" ? "0.01" : "1"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-2">
                    Reason
                  </label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Enter reason for adjustment..."
                    rows={3}
                    className="input"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setAdjustModal({ open: false, type: null });
                      setAdjustAmount("");
                      setAdjustReason("");
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdjustBalance}
                    disabled={!adjustAmount || !adjustReason.trim() || actionLoading}
                    className="btn btn-primary"
                  >
                    {actionLoading ? "Processing..." : "Confirm Adjustment"}
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

