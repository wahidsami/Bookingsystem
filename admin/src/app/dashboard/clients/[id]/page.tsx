"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, getImageUrl } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { humanizeValue } from "@/lib/display";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppDialog } from "@/components/AppDialogProvider";

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

interface Bill {
  id: string;
  billNumber: string;
  type: string;
  status: string;
  amount: number | string;
  subtotalAmount?: number | string | null;
  vatAmount?: number | string | null;
  totalAmount?: number | string | null;
  currency?: string;
  dueDate?: string | null;
  paidAt?: string | null;
  invoiceIssuedAt?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentProvider?: string | null;
  paymentCapturedAmount?: number | string | null;
  paymentAttempts?: Array<{
    id: string;
    source: string;
    status: string;
    paymentProvider?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    gatewayStatus?: string | null;
    capturedAmount?: number | string | null;
    failureReason?: string | null;
    performedByType?: string | null;
    performedByName?: string | null;
    processedAt?: string | null;
    notes?: string | null;
  }>;
  planSnapshot?: {
    packageName?: string;
    packageNameAr?: string;
    billingCycle?: string;
  };
  lineItemsSnapshot?: Array<{
    labelAr?: string;
    labelEn?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    quantity?: number;
    total?: number;
    totalAmount?: number;
  }>;
}

const BILL_STATUS_BADGES: Record<string, { className: string; text: string }> = {
  DRAFT: { className: "badge-info", text: "Draft" },
  UNPAID: { className: "badge-warning", text: "Unpaid" },
  FAILED: { className: "badge-danger", text: "Failed" },
  PAID: { className: "badge-success", text: "Paid" },
  EXPIRED: { className: "badge-danger", text: "Expired" },
  VOID: { className: "badge-info", text: "Void" },
};

const BILL_TYPE_LABELS: Record<string, string> = {
  initial: "Initial Subscription Invoice",
  renewal: "Renewal Invoice",
  upgrade: "Upgrade Invoice",
  subscription: "Subscription Invoice",
};

export default function ClientDetailsPage() {
    const dialog = useAppDialog();
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tenantBills, setTenantBills] = useState<Bill[]>([]);
  const [billingSummary, setBillingSummary] = useState<any>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billDocumentLoading, setBillDocumentLoading] = useState<string | null>(null);
  const [voidingBillId, setVoidingBillId] = useState<string | null>(null);
  const [resendingPaymentEmailBillId, setResendingPaymentEmailBillId] = useState<string | null>(null);
  const [resendEmailModalBill, setResendEmailModalBill] = useState<Bill | null>(null);
  const [resendCcEnabled, setResendCcEnabled] = useState(false);
  const [resendCcEmail, setResendCcEmail] = useState("wahidsami@gmail.com");
  const [reconcileModalBill, setReconcileModalBill] = useState<Bill | null>(null);
  const [reconcileForm, setReconcileForm] = useState({
    paymentProvider: "manual_bank_transfer",
    paymentReference: "",
    paymentMethod: "bank_transfer",
    checkoutSessionId: "",
    gatewayStatus: "admin_reconciled",
    notes: "",
  });
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "billing" | "documents" | "activity" | "settings">("overview");
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    if (params.id) {
      loadTenantDetails();
    }
  }, [params.id]);

  const loadTenantDetails = async () => {
    try {
      const tenantId = params.id as string;
      const [response, billsResponse] = await Promise.all([
        adminApi.getTenantDetails(tenantId),
        adminApi.getTenantBills(tenantId),
      ]);
      if (response.success) {
        setTenant(response.tenant);
        setActivities(response.activities || []);
      }
      if (billsResponse.success) {
        setTenantBills(billsResponse.bills || []);
        setBillingSummary(billsResponse.summary || null);
      }
    } catch (error) {
      console.error("Failed to load tenant details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!(await dialog.confirm("Are you sure you want to approve this client?"))) return;

    setActionLoading(true);
    try {
      const response = await adminApi.approveTenant(tenant!.id);
      if (response.success) {
        setTenant({ ...tenant!, status: "payment_pending", approvedAt: new Date().toISOString() });
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
    if (!(await dialog.confirm("Are you sure you want to reactivate this client?"))) return;

    setActionLoading(true);
    try {
      const response = await adminApi.activateTenant(tenant!.id);
      if (response.success) {
        setTenant({ ...tenant!, status: "active", suspensionReason: "" });
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
      pending_approval: { class: "badge-warning", text: "Pending Approval" },
      more_info_required: { class: "badge-warning", text: "More Info Required" },
      payment_pending: { class: "badge-warning", text: "Payment Pending" },
      active: { class: "badge-success", text: "Active" },
      approved: { class: "badge-success", text: "Approved" },
      rejected: { class: "badge-danger", text: "Rejected" },
      suspended: { class: "badge-danger", text: "Suspended" },
      inactive: { class: "badge-danger", text: "Inactive" },
      payment_failed: { class: "badge-danger", text: "Payment Failed" },
      payment_expired: { class: "badge-danger", text: "Payment Expired" },
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

  const formatBillingCycle = (billingCycle?: string) => {
    if (!billingCycle) return "—";
    if (billingCycle === "sixMonth") return "6 Months";
    return billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1);
  };

  const formatBillType = (type?: string) => {
    if (!type) return "—";
    return BILL_TYPE_LABELS[type] || humanizeValue(type);
  };

  const getBillStatusBadge = (status: string) => (
    BILL_STATUS_BADGES[status] || { className: "badge-info", text: status || "—" }
  );

  const canVoidBill = (bill: Bill) =>
    bill.status === "DRAFT" ||
    bill.status === "UNPAID" ||
    bill.status === "FAILED" ||
    bill.status === "EXPIRED";

  const canResendPaymentEmail = (bill: Bill) =>
    bill.status === "UNPAID" ||
    bill.status === "FAILED" ||
    bill.status === "EXPIRED";

  const openBillDocument = async (bill: Bill, type: "invoice" | "receipt") => {
    setBillDocumentLoading(`${bill.id}-${type}`);
    try {
      const response = type === "invoice"
        ? await adminApi.downloadBillInvoicePdf(bill.id)
        : await adminApi.downloadBillReceiptPdf(bill.id);
      const fileUrl = URL.createObjectURL(response.blob);
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 30000);
    } catch (error) {
      console.error(`Failed to open ${type} PDF:`, error);
      alert(error instanceof Error ? error.message : `Failed to open ${type} PDF`);
    } finally {
      setBillDocumentLoading(null);
    }
  };

  const openReconcileModal = (bill: Bill) => {
    setReconcileModalBill(bill);
    setReconcileForm({
      paymentProvider: bill.paymentProvider || "manual_bank_transfer",
      paymentReference: bill.paymentReference || `${bill.billNumber}-MANUAL`,
      paymentMethod: bill.paymentMethod || "bank_transfer",
      checkoutSessionId: "",
      gatewayStatus: "admin_reconciled",
      notes: "",
    });
  };

  const openResendPaymentEmailModal = (bill: Bill) => {
    setResendEmailModalBill(bill);
    setResendCcEnabled(false);
    setResendCcEmail("wahidsami@gmail.com");
  };

  const handleResendPaymentEmail = async (bill: Bill) => {
    setResendingPaymentEmailBillId(bill.id);
    try {
      const response = await adminApi.resendTenantPaymentEmail(
        tenant!.id,
        bill.id,
        resendCcEnabled ? resendCcEmail.trim() : undefined
      );
      if (response.success) {
        if (response.bill && selectedBill?.id === bill.id) {
          setSelectedBill(response.bill as Bill);
        }
        await loadTenantDetails();
        await dialog.alert({
          title: "Payment Email Sent",
          message: response.message || `Payment email resent to ${tenant?.email || "the tenant"}.`,
          tone: "success",
          confirmText: "OK",
        });
      }
    } catch (error) {
      console.error("Failed to resend payment email:", error);
      await dialog.alert({
        title: "Failed to Resend Email",
        message: error instanceof Error ? error.message : "Failed to resend payment email",
        tone: "danger",
      });
    } finally {
      setResendingPaymentEmailBillId(null);
    }
  };

  const submitResendPaymentEmail = async () => {
    if (!resendEmailModalBill) return;

    if (resendCcEnabled && !resendCcEmail.trim()) {
      await dialog.alert({
        title: "Missing CC Email",
        message: "Please enter a CC email address or turn off the CC option.",
        tone: "danger",
      });
      return;
    }

    await handleResendPaymentEmail(resendEmailModalBill);
    setResendEmailModalBill(null);
  };

  const handleReconcilePayment = async () => {
    if (!reconcileModalBill) return;
    if (!reconcileForm.paymentProvider.trim() || !reconcileForm.paymentReference.trim() || !reconcileForm.paymentMethod.trim()) {
      alert("Payment provider, reference, and method are required.");
      return;
    }

    setReconcileLoading(true);
    try {
      const response = await adminApi.reconcileBillPayment(reconcileModalBill.id, {
        paymentProvider: reconcileForm.paymentProvider.trim(),
        paymentReference: reconcileForm.paymentReference.trim(),
        paymentMethod: reconcileForm.paymentMethod.trim(),
        checkoutSessionId: reconcileForm.checkoutSessionId.trim() || undefined,
        gatewayStatus: reconcileForm.gatewayStatus.trim() || "admin_reconciled",
        notes: reconcileForm.notes.trim() || undefined,
        idempotencyKey: `admin_manual_reconciliation:${reconcileModalBill.id}:${reconcileForm.paymentReference.trim()}`,
      });

      if (response.success) {
        if (response.bill) {
          setSelectedBill(response.bill as Bill);
        }
        setReconcileModalBill(null);
        await loadTenantDetails();
      }
    } catch (error) {
      console.error("Failed to reconcile payment:", error);
      alert(error instanceof Error ? error.message : "Failed to reconcile payment");
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleVoidBill = async (bill: Bill) => {
    const reason = await dialog.prompt({
      title: "Void Invoice",
      message: `This will mark ${bill.billNumber} as void and remove it from the tenant's active bills list. Add an optional reason for the audit trail.`,
      confirmText: "Void Invoice",
      cancelText: "Cancel",
      tone: "danger",
      defaultValue:
        bill.status === "UNPAID" ? "Superseded by a newer invoice" : "Admin cleanup",
      placeholder: "Reason for voiding this invoice",
    });

    if (reason === null) return;

    setVoidingBillId(bill.id);
    try {
      const response = await adminApi.voidBill(bill.id, {
        reason: reason.trim() || undefined,
      });

      if (response.success) {
        if (selectedBill?.id === bill.id && response.bill) {
          setSelectedBill(response.bill as Bill);
        }
        await loadTenantDetails();
      }
    } catch (error) {
      console.error("Failed to void invoice:", error);
      alert(error instanceof Error ? error.message : "Failed to void invoice");
    } finally {
      setVoidingBillId(null);
    }
  };

  const latestBill = tenantBills[0];

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
                {humanizeValue(tenant.businessType)} • {tenant.city || "Location not set"}
              </p>
              <p className="text-dark-500 text-sm mt-1">ID: {tenant.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/clients" className="btn btn-secondary">
              ← Back
            </Link>
            {tenant.status === "pending_approval" && (
              <button onClick={handleApprove} disabled={actionLoading} className="btn btn-success">
                ✓ Approve
              </button>
            )}
            {tenant.status === "active" && (
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
              { id: "billing", label: "Billing" },
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
                      {humanizeValue(tenant.businessType)}
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
                        || humanizeValue(tenant.plan, "No plan")}
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
                      {String((tenant as any).subscription?.billingCycle || "—").replace("sixMonth", "6 Months")}
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
                  <div>
                    <p className="text-dark-400 text-xs">Latest Invoice</p>
                    <p className="text-white mt-1">{latestBill?.billNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Latest Payment</p>
                    <p className="text-white mt-1">{latestBill?.paidAt ? formatDate(latestBill.paidAt) : "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-dark-400 text-xs font-medium">Total Invoices</p>
                <p className="text-2xl font-bold text-white mt-1">{tenantBills.length}</p>
              </div>
              <div className="card p-4 border border-warning/20">
                <p className="text-dark-400 text-xs font-medium">Open / Failed Amount</p>
                <p className="text-2xl font-bold text-warning mt-1">
                  <Currency
                    amount={(billingSummary?.unpaidTotal || 0) + (billingSummary?.failedTotal || 0)}
                  />
                </p>
              </div>
              <div className="card p-4 border border-success/20">
                <p className="text-dark-400 text-xs font-medium">Paid Amount</p>
                <p className="text-2xl font-bold text-success mt-1">
                  <Currency amount={billingSummary?.paidTotal || 0} />
                </p>
              </div>
              <div className="card p-4">
                <p className="text-dark-400 text-xs font-medium">Latest Invoice Status</p>
                <div className="mt-2">
                  {latestBill ? (
                    <span className={`badge ${getBillStatusBadge(latestBill.status).className}`}>
                      {getBillStatusBadge(latestBill.status).text}
                    </span>
                  ) : (
                    <span className="text-white">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-white">Tenant Invoices</h3>
                {latestBill?.status === "PAID" && (
                  <span className="badge badge-success">Latest bill paid</span>
                )}
              </div>
              <div className="card-body space-y-4">
                {tenantBills.length === 0 ? (
                  <div className="text-center py-12 text-dark-400">No invoices generated yet.</div>
                ) : (
                  tenantBills.map((bill) => {
                    const billStatusBadge = getBillStatusBadge(bill.status);
                    const totalAmount = bill.totalAmount ?? bill.amount;
                    const invoiceLoading = billDocumentLoading === `${bill.id}-invoice`;
                    const receiptLoading = billDocumentLoading === `${bill.id}-receipt`;
                    const isVoiding = voidingBillId === bill.id;

                    return (
                      <div
                        key={bill.id}
                        className="rounded-2xl bg-dark-700/40 border border-dark-700 p-5"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h4 className="text-lg font-bold text-white">{bill.billNumber}</h4>
                              <span className={`badge ${billStatusBadge.className}`}>
                                {billStatusBadge.text}
                              </span>
                            </div>
                            <p className="text-sm text-primary-300 mt-2">
                              {formatBillType(bill.type)}
                            </p>
                            <p className="text-white font-medium mt-1">
                              {bill.planSnapshot?.packageName || bill.planSnapshot?.packageNameAr || "—"}
                              {bill.planSnapshot?.billingCycle
                                ? ` • ${formatBillingCycle(bill.planSnapshot.billingCycle)}`
                                : ""}
                            </p>
                            <p className="text-dark-300 text-sm mt-2">
                              Payment: {[bill.paymentProvider, bill.paymentMethod, bill.paymentReference]
                                .filter(Boolean)
                                .join(" • ") || "—"}
                            </p>
                          </div>

                          <div className="lg:text-right">
                            <p className="text-dark-400 text-xs">Grand Total</p>
                            <p className="text-2xl font-bold text-white mt-1">
                              <Currency amount={Number(totalAmount) || 0} />
                            </p>
                            <p className="text-dark-300 text-xs mt-1">
                              Subtotal <Currency amount={Number(bill.subtotalAmount) || 0} /> • VAT{" "}
                              <Currency amount={Number(bill.vatAmount) || 0} />
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                          <div className="rounded-xl bg-dark-800/50 p-3">
                            <p className="text-dark-400 text-xs">Issued</p>
                            <p className="text-white text-sm mt-1">
                              {formatDate(bill.invoiceIssuedAt || "")}
                            </p>
                          </div>
                          <div className="rounded-xl bg-dark-800/50 p-3">
                            <p className="text-dark-400 text-xs">Due Date</p>
                            <p className="text-white text-sm mt-1">
                              {formatDate(bill.dueDate || "")}
                            </p>
                          </div>
                          <div className="rounded-xl bg-dark-800/50 p-3">
                            <p className="text-dark-400 text-xs">Paid Date</p>
                            <p className="text-white text-sm mt-1">
                              {formatDate(bill.paidAt || "")}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 mt-4">
                          {(bill.status === "UNPAID" || bill.status === "FAILED") && (
                            <button
                              type="button"
                              onClick={() => openReconcileModal(bill)}
                              className="btn btn-primary btn-sm"
                            >
                              Reconcile Payment
                            </button>
                          )}
                          {canResendPaymentEmail(bill) && (
                            <button
                              type="button"
                              onClick={() => openResendPaymentEmailModal(bill)}
                              disabled={resendingPaymentEmailBillId === bill.id}
                              className="btn btn-secondary btn-sm"
                            >
                              {resendingPaymentEmailBillId === bill.id
                                ? "Resending..."
                                : bill.status === "EXPIRED"
                                  ? "Reopen & Resend Email"
                                  : "Resend Payment Email"}
                            </button>
                          )}
                          {canVoidBill(bill) && (
                            <button
                              type="button"
                              onClick={() => handleVoidBill(bill)}
                              disabled={isVoiding}
                              className="btn btn-danger btn-sm"
                            >
                              {isVoiding ? "Voiding..." : "Void Invoice"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedBill(bill)}
                            className="btn btn-secondary btn-sm"
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openBillDocument(bill, "invoice")}
                            disabled={invoiceLoading}
                            className="btn btn-secondary btn-sm"
                          >
                            {invoiceLoading ? "Opening Invoice..." : "Open Invoice PDF"}
                          </button>
                          {bill.status === "PAID" && (
                            <button
                              type="button"
                              onClick={() => openBillDocument(bill, "receipt")}
                              disabled={receiptLoading}
                              className="btn btn-success btn-sm"
                            >
                              {receiptLoading ? "Opening Receipt..." : "Open Paid Receipt"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
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

        {selectedBill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="card-header flex items-start justify-between gap-4">
                <div>
                  <p className="text-primary-300 text-sm font-medium">Invoice Details</p>
                  <h3 className="font-semibold text-white text-xl mt-1">{selectedBill.billNumber}</h3>
                  <p className="text-dark-400 text-sm mt-1">
                    {formatBillType(selectedBill.type)} •{" "}
                    {selectedBill.planSnapshot?.packageName ||
                      selectedBill.planSnapshot?.packageNameAr ||
                      "—"}{" "}
                    • {formatBillingCycle(selectedBill.planSnapshot?.billingCycle)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBill(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Close
                </button>
              </div>

              <div className="card-body space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-dark-700/40 p-4">
                    <p className="text-dark-400 text-xs">Status</p>
                    <p className="text-white font-semibold mt-1">
                      {getBillStatusBadge(selectedBill.status).text}
                    </p>
                  </div>
                  <div className="rounded-xl bg-dark-700/40 p-4">
                    <p className="text-dark-400 text-xs">Issued</p>
                    <p className="text-white font-semibold mt-1">
                      {formatDate(selectedBill.invoiceIssuedAt || "")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-dark-700/40 p-4">
                    <p className="text-dark-400 text-xs">Due Date</p>
                    <p className="text-white font-semibold mt-1">
                      {formatDate(selectedBill.dueDate || "")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-dark-700/40 p-4">
                    <p className="text-dark-400 text-xs">Paid Date</p>
                    <p className="text-white font-semibold mt-1">
                      {formatDate(selectedBill.paidAt || "")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
                  <div className="rounded-2xl bg-dark-700/40 border border-dark-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-dark-700">
                      <h4 className="font-semibold text-white">Line Items</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-dark-800/40">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-dark-400">
                              Item
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-dark-400">
                              Qty
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-dark-400">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedBill.lineItemsSnapshot || []).length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-4 py-5 text-center text-dark-400">
                                No invoice line items found.
                              </td>
                            </tr>
                          ) : (
                            selectedBill.lineItemsSnapshot?.map((item, index) => (
                              <tr
                                key={`${selectedBill.id}-${index}`}
                                className="border-t border-dark-700"
                              >
                                <td className="px-4 py-3 text-white text-sm">
                                  {item.descriptionEn ||
                                    item.descriptionAr ||
                                    item.labelEn ||
                                    item.labelAr ||
                                    "—"}
                                </td>
                                <td className="px-4 py-3 text-dark-200 text-sm">
                                  {item.quantity ?? 1}
                                </td>
                                <td className="px-4 py-3 text-white text-sm font-semibold">
                                  <Currency amount={Number(item.totalAmount ?? item.total) || 0} />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-dark-700/40 border border-dark-700 p-5 space-y-4">
                    <div>
                      <p className="text-dark-400 text-xs">Payment Provider</p>
                      <p className="text-white font-semibold mt-1">
                        {selectedBill.paymentProvider || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Payment Method</p>
                      <p className="text-white font-semibold mt-1">
                        {selectedBill.paymentMethod || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Payment Reference</p>
                      <p className="text-white font-semibold mt-1 break-all">
                        {selectedBill.paymentReference || "—"}
                      </p>
                    </div>
                    <div className="border-t border-dark-700 pt-4 space-y-2">
                      <div className="flex justify-between text-sm text-dark-300">
                        <span>Subtotal</span>
                        <span>
                          <Currency amount={Number(selectedBill.subtotalAmount) || 0} />
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-dark-300">
                        <span>VAT</span>
                        <span>
                          <Currency amount={Number(selectedBill.vatAmount) || 0} />
                        </span>
                      </div>
                      <div className="flex justify-between text-base text-white font-bold pt-2 border-t border-dark-700">
                        <span>Grand Total</span>
                        <span>
                          <Currency
                            amount={Number(selectedBill.totalAmount ?? selectedBill.amount) || 0}
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-dark-700/40 border border-dark-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
                    <h4 className="font-semibold text-white">Payment Attempts / Reconciliation Trail</h4>
                    <span className="text-xs text-dark-400">
                      {(selectedBill.paymentAttempts || []).length} event(s)
                    </span>
                  </div>
                  <div className="divide-y divide-dark-700">
                    {(selectedBill.paymentAttempts || []).length === 0 ? (
                      <div className="px-4 py-5 text-center text-dark-400 text-sm">
                        No payment attempts have been recorded for this invoice yet.
                      </div>
                    ) : (
                      selectedBill.paymentAttempts?.map((attempt) => (
                        <div key={attempt.id} className="px-4 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`badge ${getBillStatusBadge(attempt.status === "succeeded" || attempt.status === "already_paid" ? "PAID" : attempt.status === "failed" ? "FAILED" : attempt.status === "expired" ? "EXPIRED" : "UNPAID").className}`}>
                                {humanizeValue(attempt.status)}
                              </span>
                              <p className="text-white font-semibold">
                                {attempt.paymentProvider || "—"} • {attempt.paymentMethod || "—"}
                              </p>
                            </div>
                            <p className="text-sm text-dark-300 mt-2 break-all">
                              Ref: {attempt.paymentReference || "—"} • Source: {humanizeValue(attempt.source)} • Gateway: {attempt.gatewayStatus || "—"}
                            </p>
                            {attempt.failureReason && (
                              <p className="text-sm text-danger mt-2">{attempt.failureReason}</p>
                            )}
                            {attempt.notes && (
                              <p className="text-xs text-dark-400 mt-2">Notes: {attempt.notes}</p>
                            )}
                          </div>
                          <div className="lg:text-right text-sm text-dark-300">
                            <p>
                              By {attempt.performedByName || humanizeValue(attempt.performedByType || "system")}
                            </p>
                            <p className="mt-1">{formatDate(attempt.processedAt || "")}</p>
                            <p className="mt-1 font-semibold text-white">
                              <Currency amount={Number(attempt.capturedAmount) || 0} />
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  {(selectedBill.status === "UNPAID" || selectedBill.status === "FAILED") && (
                    <button
                      type="button"
                      onClick={() => openReconcileModal(selectedBill)}
                      className="btn btn-primary"
                    >
                      Reconcile Payment
                    </button>
                  )}
                  {canResendPaymentEmail(selectedBill) && (
                    <button
                      type="button"
                      onClick={() => openResendPaymentEmailModal(selectedBill)}
                      disabled={resendingPaymentEmailBillId === selectedBill.id}
                      className="btn btn-secondary"
                    >
                      {resendingPaymentEmailBillId === selectedBill.id
                        ? "Resending..."
                        : selectedBill.status === "EXPIRED"
                          ? "Reopen & Resend Email"
                          : "Resend Payment Email"}
                    </button>
                  )}
                  {canVoidBill(selectedBill) && (
                    <button
                      type="button"
                      onClick={() => handleVoidBill(selectedBill)}
                      disabled={voidingBillId === selectedBill.id}
                      className="btn btn-danger"
                    >
                      {voidingBillId === selectedBill.id ? "Voiding..." : "Void Invoice"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openBillDocument(selectedBill, "invoice")}
                    disabled={billDocumentLoading === `${selectedBill.id}-invoice`}
                    className="btn btn-secondary"
                  >
                    {billDocumentLoading === `${selectedBill.id}-invoice`
                      ? "Opening Invoice..."
                      : "Open Invoice PDF"}
                  </button>
                  {selectedBill.status === "PAID" && (
                    <button
                      type="button"
                      onClick={() => openBillDocument(selectedBill, "receipt")}
                      disabled={billDocumentLoading === `${selectedBill.id}-receipt`}
                      className="btn btn-success"
                    >
                      {billDocumentLoading === `${selectedBill.id}-receipt`
                        ? "Opening Receipt..."
                        : "Open Paid Receipt"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {reconcileModalBill && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-xl">
              <div className="card-header flex items-start justify-between gap-4">
                <div>
                  <p className="text-primary-300 text-sm font-medium">Manual Payment Reconciliation</p>
                  <h3 className="font-semibold text-white text-xl mt-1">
                    {reconcileModalBill.billNumber}
                  </h3>
                  <p className="text-dark-400 text-sm mt-1">
                    Use this only when an external payment provider confirms payment but the invoice still appears unpaid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReconcileModalBill(null)}
                  className="btn btn-secondary btn-sm"
                  disabled={reconcileLoading}
                >
                  Close
                </button>
              </div>

              <div className="card-body space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Payment Provider</label>
                    <input
                      className="form-input"
                      value={reconcileForm.paymentProvider}
                      onChange={(e) => setReconcileForm({ ...reconcileForm, paymentProvider: e.target.value })}
                      placeholder="manual_bank_transfer"
                    />
                  </div>
                  <div>
                    <label className="form-label">Payment Method</label>
                    <input
                      className="form-input"
                      value={reconcileForm.paymentMethod}
                      onChange={(e) => setReconcileForm({ ...reconcileForm, paymentMethod: e.target.value })}
                      placeholder="bank_transfer / card / mada"
                    />
                  </div>
                  <div>
                    <label className="form-label">Payment Reference</label>
                    <input
                      className="form-input"
                      value={reconcileForm.paymentReference}
                      onChange={(e) => setReconcileForm({ ...reconcileForm, paymentReference: e.target.value })}
                      placeholder="Gateway transaction/reference ID"
                    />
                  </div>
                  <div>
                    <label className="form-label">Checkout / Session ID</label>
                    <input
                      className="form-input"
                      value={reconcileForm.checkoutSessionId}
                      onChange={(e) => setReconcileForm({ ...reconcileForm, checkoutSessionId: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="form-label">Gateway Status</label>
                    <input
                      className="form-input"
                      value={reconcileForm.gatewayStatus}
                      onChange={(e) => setReconcileForm({ ...reconcileForm, gatewayStatus: e.target.value })}
                      placeholder="admin_reconciled / captured / settled"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="form-label">Admin Notes</label>
                    <textarea
                      className="form-input min-h-[100px]"
                      value={reconcileForm.notes}
                      onChange={(e) => setReconcileForm({ ...reconcileForm, notes: e.target.value })}
                      placeholder="Explain the evidence used to manually reconcile this payment."
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 text-sm text-warning">
                  This action will mark the invoice as paid, activate/update the tenant subscription, generate a paid receipt PDF, notify admin, and send the tenant payment success email.
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReconcileModalBill(null)}
                    className="btn btn-secondary"
                    disabled={reconcileLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReconcilePayment}
                    className="btn btn-success"
                    disabled={reconcileLoading}
                  >
                    {reconcileLoading ? "Reconciling..." : "Mark Invoice as Paid"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {resendEmailModalBill && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-xl">
              <div className="card-header flex items-start justify-between gap-4">
                <div>
                  <p className="text-primary-300 text-sm font-medium">Resend Payment Email</p>
                  <h3 className="font-semibold text-white text-xl mt-1">
                    {resendEmailModalBill.billNumber}
                  </h3>
                  <p className="text-dark-400 text-sm mt-1">
                    Send the payment email again to the tenant. You can optionally CC a second address as a temporary check.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResendEmailModalBill(null)}
                  className="btn btn-secondary btn-sm"
                  disabled={resendingPaymentEmailBillId === resendEmailModalBill.id}
                >
                  Close
                </button>
              </div>

              <div className="card-body space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-dark-600 bg-dark-700/40 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={resendCcEnabled}
                    onChange={(e) => setResendCcEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-dark-500"
                  />
                  <span className="text-sm text-white">Send CC copy to a second email</span>
                </label>

                {resendCcEnabled && (
                  <div>
                    <label className="form-label">CC Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={resendCcEmail}
                      onChange={(e) => setResendCcEmail(e.target.value)}
                      placeholder="wahidsami@gmail.com"
                    />
                  </div>
                )}
              </div>

              <div className="card-footer flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResendEmailModalBill(null)}
                  className="btn btn-secondary"
                  disabled={resendingPaymentEmailBillId === resendEmailModalBill.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitResendPaymentEmail}
                  className="btn btn-primary"
                  disabled={resendingPaymentEmailBillId === resendEmailModalBill.id}
                >
                  {resendingPaymentEmailBillId === resendEmailModalBill.id ? "Sending..." : "Send Email"}
                </button>
              </div>
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
