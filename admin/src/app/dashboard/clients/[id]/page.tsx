"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, getImageUrl } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Tenant {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  businessType: string[] | string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  address: string;
  city: string;
  country: string;
  description: string;
  descriptionAr: string;
  logo: string;
  coverImage: string;
  status: string;
  plan: string;
  planStartDate: string;
  planEndDate: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  documents: {
    commercialRegister?: { url: string; verified: boolean };
    license?: { url: string; verified: boolean };
    ownerIdCard?: { url: string; verified: boolean };
  };
  settings: any;
  stats: {
    totalBookings: number;
    totalRevenue: number;
    totalCustomers: number;
    averageRating: number;
  };
  approvedAt: string;
  rejectionReason: string;
  suspensionReason: string;
  createdAt: string;
  Users?: any[];
}

interface Activity {
  id: string;
  action: string;
  performedByName: string;
  createdAt: string;
  details: any;
}

export default function ClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "activity" | "settings">("overview");
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    if (params.id) {
      loadTenantDetails();
    }
  }, [params.id]);

  const loadTenantDetails = async () => {
    try {
      const response = await adminApi.getTenantDetails(params.id as string);
      if (response.success) {
        setTenant(response.tenant);
        setActivities(response.activities || []);
      }
    } catch (error) {
      console.error("Failed to load tenant details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm("Are you sure you want to approve this client?")) return;

    setActionLoading(true);
    try {
      const response = await adminApi.approveTenant(tenant!.id);
      if (response.success) {
        setTenant({ ...tenant!, status: "approved", approvedAt: new Date().toISOString() });
        loadTenantDetails();
      }
    } catch (error) {
      console.error("Failed to approve tenant:", error);
      alert("Failed to approve tenant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return;

    setActionLoading(true);
    try {
      const response = await adminApi.suspendTenant(tenant!.id, suspendReason);
      if (response.success) {
        setTenant({ ...tenant!, status: "suspended", suspensionReason: suspendReason });
        setSuspendModal(false);
        setSuspendReason("");
        loadTenantDetails();
      }
    } catch (error) {
      console.error("Failed to suspend tenant:", error);
      alert("Failed to suspend tenant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!confirm("Are you sure you want to reactivate this client?")) return;

    setActionLoading(true);
    try {
      const response = await adminApi.activateTenant(tenant!.id);
      if (response.success) {
        setTenant({ ...tenant!, status: "approved", suspensionReason: "" });
        loadTenantDetails();
      }
    } catch (error) {
      console.error("Failed to activate tenant:", error);
      alert("Failed to activate tenant");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      pending: { class: "badge-warning", text: "Pending" },
      approved: { class: "badge-success", text: "Approved" },
      rejected: { class: "badge-danger", text: "Rejected" },
      suspended: { class: "badge-danger", text: "Suspended" },
    };
    return badges[status] || { class: "badge-info", text: status };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Removed formatCurrency - now using Currency component

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!tenant) {
    return (
      <AdminLayout>
        <div className="card p-8 text-center">
          <span className="text-4xl block mb-4">❌</span>
          <h3 className="text-xl font-semibold text-white mb-2">Client Not Found</h3>
          <Link href="/dashboard/clients" className="btn btn-primary mt-4">
            Back to Clients
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const statusBadge = getStatusBadge(tenant.status);

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary-500/20 rounded-xl flex items-center justify-center text-3xl">
              {(Array.isArray(tenant.businessType) ? tenant.businessType[0] : tenant.businessType) === "salon" && "💇"}
              {(Array.isArray(tenant.businessType) ? tenant.businessType[0] : tenant.businessType) === "spa" && "🧖"}
              {(Array.isArray(tenant.businessType) ? tenant.businessType[0] : tenant.businessType) === "barbershop" && "💈"}
              {(Array.isArray(tenant.businessType) ? tenant.businessType[0] : tenant.businessType) === "beauty_center" && "💅"}
              {!tenant.businessType || (Array.isArray(tenant.businessType) && tenant.businessType.length === 0) ? "🏢" : null}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{(tenant as any).name_en || tenant.name}</h1>
                <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
              </div>
              <p className="text-dark-400 mt-1 capitalize">
                {Array.isArray(tenant.businessType)
                  ? tenant.businessType.map(t => t.replace("_", " ")).join(", ")
                  : tenant.businessType?.replace("_", " ")} • {tenant.city || "Location not set"}
              </p>
              <p className="text-dark-500 text-sm mt-1">ID: {tenant.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/clients" className="btn btn-secondary">
              ← Back
            </Link>
            {tenant.status === "pending" && (
              <button onClick={handleApprove} disabled={actionLoading} className="btn btn-success">
                ✓ Approve
              </button>
            )}
            {tenant.status === "approved" && (
              <button
                onClick={() => setSuspendModal(true)}
                disabled={actionLoading}
                className="btn btn-danger"
              >
                Suspend
              </button>
            )}
            {tenant.status === "suspended" && (
              <button onClick={handleActivate} disabled={actionLoading} className="btn btn-success">
                Reactivate
              </button>
            )}
          </div>
        </div>

        {/* Alert Messages */}
        {tenant.status === "suspended" && tenant.suspensionReason && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <p className="text-danger font-medium">Suspended</p>
            <p className="text-dark-300 text-sm mt-1">Reason: {tenant.suspensionReason}</p>
          </div>
        )}

        {tenant.status === "rejected" && tenant.rejectionReason && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <p className="text-danger font-medium">Rejected</p>
            <p className="text-dark-300 text-sm mt-1">Reason: {tenant.rejectionReason}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Total Bookings</p>
            <p className="text-2xl font-bold text-white mt-1">{tenant.stats?.totalBookings || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-white mt-1">
              <Currency amount={tenant.stats?.totalRevenue || 0} />
            </p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Customers</p>
            <p className="text-2xl font-bold text-white mt-1">{tenant.stats?.totalCustomers || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-dark-400 text-xs font-medium">Rating</p>
            <p className="text-2xl font-bold text-white mt-1">
              {tenant.stats?.averageRating?.toFixed(1) || "N/A"} ⭐
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-dark-700">
          <div className="flex gap-6">
            {[
              { id: "overview", label: "Overview" },
              { id: "documents", label: "Documents" },
              { id: "activity", label: "Activity Log" },
              { id: "settings", label: "Settings" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 transition-colors ${activeTab === tab.id
                  ? "border-primary-500 text-primary-400"
                  : "border-transparent text-dark-400 hover:text-dark-200"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Business Info */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">Business Information</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-dark-400 text-xs">Business Name (English)</p>
                    <p className="text-white mt-1">{(tenant as any).name_en || tenant.name}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Name (Arabic)</p>
                    <p className="text-white mt-1">{(tenant as any).name_ar || tenant.nameAr || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Type</p>
                    <p className="text-white mt-1 capitalize">
                      {Array.isArray(tenant.businessType)
                        ? tenant.businessType.map(t => t.replace("_", " ")).join(", ")
                        : tenant.businessType?.replace("_", " ") || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Slug</p>
                    <p className="text-white mt-1">{tenant.slug}</p>
                  </div>
                </div>
                {tenant.logo && (
                  <div>
                    <p className="text-dark-400 text-xs mb-2">Business Logo</p>
                    <img
                      src={getImageUrl(tenant.logo)}
                      alt="Business Logo"
                      className="h-16 w-16 object-cover rounded-lg border border-dark-600"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext fill='%23666' font-size='14' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Logo%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">Contact Details</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-dark-400 text-xs">Email</p>
                    <p className="text-white mt-1">{tenant.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Phone</p>
                    <p className="text-white mt-1">{tenant.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Mobile</p>
                    <p className="text-white mt-1">{(tenant as any).mobile || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Website</p>
                    <p className="text-white mt-1">{tenant.website || "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Address</p>
                  <p className="text-white mt-1">
                    {[
                      (tenant as any).buildingNumber && `Building ${(tenant as any).buildingNumber}`,
                      (tenant as any).street,
                      (tenant as any).district,
                      tenant.city,
                      tenant.country
                    ].filter(Boolean).join(", ") || "-"}
                  </p>
                </div>
                {(tenant as any).googleMapLink && (
                  <div>
                    <p className="text-dark-400 text-xs">Google Maps</p>
                    <a
                      href={(tenant as any).googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:underline mt-1 text-sm"
                    >
                      View on Maps →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Owner Info */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">Business Owner</h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-dark-400 text-xs">Name (English)</p>
                    <p className="text-white mt-1">{(tenant as any).ownerNameEn || (tenant as any).ownerName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Name (Arabic)</p>
                    <p className="text-white mt-1">{(tenant as any).ownerNameAr || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Phone</p>
                    <p className="text-white mt-1">{(tenant as any).ownerPhone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Email</p>
                    <p className="text-white mt-1">{(tenant as any).ownerEmail || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-dark-400 text-xs">National ID / Iqama</p>
                    <p className="text-white mt-1">{(tenant as any).ownerNationalId || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Person Info */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">Contact Person</h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-dark-400 text-xs">Name (English)</p>
                    <p className="text-white mt-1">{(tenant as any).contactPersonNameEn || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Name (Arabic)</p>
                    <p className="text-white mt-1">{(tenant as any).contactPersonNameAr || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Mobile</p>
                    <p className="text-white mt-1">{(tenant as any).contactPersonMobile || "-"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Position</p>
                    <p className="text-white mt-1">{(tenant as any).contactPersonPosition || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-dark-400 text-xs">Email</p>
                    <p className="text-white mt-1">{(tenant as any).contactPersonEmail || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">Subscription</h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-dark-400 text-xs">Plan</p>
                    <p className="text-white mt-1 capitalize">
                      {(tenant as any).subscription?.package?.name
                        || tenant.plan?.replace("_", " ")
                        || "No plan"}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Subscription Status</p>
                    <p className="text-white mt-1 capitalize">
                      {(tenant as any).subscription?.status || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Billing Cycle</p>
                    <p className="text-white mt-1 capitalize">
                      {(tenant as any).subscription?.billingCycle?.replace("sixMonth", "6 Months") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Amount</p>
                    <p className="text-white mt-1">
                      {(tenant as any).subscription?.amount
                        ? <><Currency amount={parseFloat((tenant as any).subscription.amount)} /></>
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Period Start</p>
                    <p className="text-white mt-1">
                      {formatDate((tenant as any).subscription?.currentPeriodStart || tenant.planStartDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Period End</p>
                    <p className="text-white mt-1">
                      {formatDate((tenant as any).subscription?.currentPeriodEnd || tenant.planEndDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Registered</p>
                    <p className="text-white mt-1">{formatDate(tenant.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Approved</p>
                    <p className="text-white mt-1">{formatDate(tenant.approvedAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Business Documents</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    key: "crDocument",
                    label: "Commercial Registration",
                    number: (tenant as any).crNumber
                  },
                  {
                    key: "taxDocument",
                    label: "Tax Certificate",
                    number: (tenant as any).taxNumber
                  },
                  {
                    key: "licenseDocument",
                    label: "Business License",
                    number: (tenant as any).licenseNumber
                  },
                ].map((doc) => {
                  const documentPath = (tenant as any)[doc.key];
                  const hasDocument = !!documentPath;
                  return (
                    <div key={doc.key} className="bg-dark-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium text-white">{doc.label}</p>
                        {hasDocument ? (
                          <span className="badge badge-success">Uploaded</span>
                        ) : (
                          <span className="badge badge-warning">Missing</span>
                        )}
                      </div>
                      {doc.number && (
                        <p className="text-dark-400 text-xs mb-2">
                          Number: <span className="text-white">{doc.number}</span>
                        </p>
                      )}
                      {hasDocument ? (
                        <a
                          href={getImageUrl(documentPath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm w-full"
                        >
                          View Document →
                        </a>
                      ) : (
                        <p className="text-dark-400 text-sm">Not uploaded</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Activity Log</h3>
            </div>
            <div className="divide-y divide-dark-700">
              {activities.length === 0 ? (
                <div className="p-6 text-center text-dark-400">No activities recorded</div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-sm">
                      📋
                    </div>
                    <div className="flex-1">
                      <p className="text-dark-200">
                        <span className="font-medium text-white">
                          {activity.performedByName || "System"}
                        </span>{" "}
                        <span className="text-primary-400">{activity.action}</span> this client
                      </p>
                      {activity.details && Object.keys(activity.details).length > 0 && (
                        <p className="text-dark-400 text-xs mt-1">
                          {JSON.stringify(activity.details)}
                        </p>
                      )}
                      <p className="text-dark-500 text-xs mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Business Settings</h3>
            </div>
            <div className="card-body">
              <pre className="bg-dark-700/50 rounded-lg p-4 text-sm text-dark-200 overflow-x-auto">
                {JSON.stringify(tenant.settings, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Suspend Modal */}
        {suspendModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md">
              <div className="card-header">
                <h3 className="font-semibold text-white">Suspend Client</h3>
              </div>
              <div className="card-body space-y-4">
                <p className="text-dark-300 text-sm">
                  Please provide a reason for suspending this client.
                </p>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Enter suspension reason..."
                  rows={4}
                  className="input"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setSuspendModal(false);
                      setSuspendReason("");
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSuspend}
                    disabled={!suspendReason.trim() || actionLoading}
                    className="btn btn-danger"
                  >
                    {actionLoading ? "Processing..." : "Suspend Client"}
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

