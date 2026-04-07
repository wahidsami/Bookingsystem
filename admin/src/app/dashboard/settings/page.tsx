"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";

type AdminSettingsState = {
  serviceCommissionRate: number;
  productCommissionRate: number;
  taxRate: number;
  invoiceSellerNameAr: string;
  invoiceSellerNameEn: string;
  invoiceVatNumber: string;
  invoiceCrNumber: string;
  invoiceAddressAr: string;
  invoiceAddressEn: string;
  invoiceCity: string;
  invoiceCountry: string;
  invoiceEmail: string;
  invoicePhone: string;
  invoicePrefix: string;
  invoiceFooterNoteAr: string;
  invoiceFooterNoteEn: string;
  invoiceLogoPath: string;
};

type SubscriptionPackage = {
  id: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  monthlyPrice?: number | string | null;
  sixMonthPrice?: number | string | null;
  annualPrice?: number | string | null;
  isActive?: boolean;
  isFeatured?: boolean;
};

type AdminProfile = {
  id: string;
  name?: string | null;
  email: string;
  role?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
};

const DEFAULT_SETTINGS: AdminSettingsState = {
  serviceCommissionRate: 10,
  productCommissionRate: 10,
  taxRate: 15,
  invoiceSellerNameAr: "رفاه",
  invoiceSellerNameEn: "Refah",
  invoiceVatNumber: "",
  invoiceCrNumber: "",
  invoiceAddressAr: "",
  invoiceAddressEn: "",
  invoiceCity: "Riyadh",
  invoiceCountry: "Saudi Arabia",
  invoiceEmail: "",
  invoicePhone: "",
  invoicePrefix: "INV",
  invoiceFooterNoteAr: "",
  invoiceFooterNoteEn: "",
  invoiceLogoPath: "",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState<AdminSettingsState>(DEFAULT_SETTINGS);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const [settingsResponse, packagesResponse, profileResponse] = await Promise.allSettled([
        adminApi.getSettings(),
        adminApi.getPackages(true),
        adminApi.getProfile()
      ]);

      if (settingsResponse.status === "fulfilled" && settingsResponse.value.success) {
        const response = settingsResponse.value;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...(response.settings || {}),
          invoiceSellerNameAr: response.settings?.invoiceSellerNameAr || "",
          invoiceSellerNameEn: response.settings?.invoiceSellerNameEn || "",
          invoiceVatNumber: response.settings?.invoiceVatNumber || "",
          invoiceCrNumber: response.settings?.invoiceCrNumber || "",
          invoiceAddressAr: response.settings?.invoiceAddressAr || "",
          invoiceAddressEn: response.settings?.invoiceAddressEn || "",
          invoiceCity: response.settings?.invoiceCity || "",
          invoiceCountry: response.settings?.invoiceCountry || "Saudi Arabia",
          invoiceEmail: response.settings?.invoiceEmail || "",
          invoicePhone: response.settings?.invoicePhone || "",
          invoicePrefix: response.settings?.invoicePrefix || "INV",
          invoiceFooterNoteAr: response.settings?.invoiceFooterNoteAr || "",
          invoiceFooterNoteEn: response.settings?.invoiceFooterNoteEn || "",
          invoiceLogoPath: response.settings?.invoiceLogoPath || "",
        });
      } else {
        const message = settingsResponse.status === "rejected"
          ? settingsResponse.reason?.message
          : "Failed to load settings";
        setError(message || "Failed to load settings");
      }

      if (packagesResponse.status === "fulfilled" && packagesResponse.value.success) {
        setPackages(packagesResponse.value.packages || []);
      } else {
        setPackages([]);
      }

      if (profileResponse.status === "fulfilled" && profileResponse.value.success) {
        setCurrentAdmin(profileResponse.value.admin || null);
      } else {
        setCurrentAdmin(null);
      }
    } catch (err: any) {
      console.error("Failed to load settings:", err);
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "number" ? Number.parseFloat(value) || 0 : value,
    }));
  };

  const formatMoney = (value?: number | string | null) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "Never";
    return new Date(value).toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await adminApi.updateSettings(settings);
      if (response.success) {
        setSuccess("Settings updated successfully!");
        setSettings(response.settings);
      } else {
        setError(response.message || "Failed to update settings");
      }
    } catch (err: any) {
      console.error("Failed to update settings:", err);
      setError(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading settings...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-dark-400 text-sm mt-1">
            Platform configuration and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Platform Settings */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Platform Settings</h3>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Invoice Seller Name
                </label>
                <input
                  type="text"
                  value={settings.invoiceSellerNameEn || "Refah"}
                  disabled
                  className="input opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={settings.invoicePrefix || "INV"}
                  disabled
                  className="input opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Invoice Country
                </label>
                <input
                  type="text"
                  value={settings.invoiceCountry || "Saudi Arabia"}
                  disabled
                  className="input opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Commission Settings */}
          <form onSubmit={handleSubmit}>
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">Commission & Tax Settings</h3>
              </div>
              <div className="card-body space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                    {success}
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-2">
                    Service Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    name="serviceCommissionRate"
                    value={settings.serviceCommissionRate}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    className="input"
                  />
                  <p className="text-dark-500 text-xs mt-1">
                    Platform commission percentage for services
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-2">
                    Product Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    name="productCommissionRate"
                    value={settings.productCommissionRate}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    className="input"
                  />
                  <p className="text-dark-500 text-xs mt-1">
                    Platform commission percentage for products
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-2">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    name="taxRate"
                    value={settings.taxRate}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    className="input"
                  />
                  <p className="text-dark-500 text-xs mt-1">
                    Global tax rate (VAT) applied to all services and products
                  </p>
                </div>

                <div className="pt-4 border-t border-dark-700">
                  <p className="text-sm font-semibold text-white">Official Invoice Identity</p>
                  <p className="text-xs text-dark-400 mt-1">
                    These values are copied into each newly issued Refah VAT invoice snapshot and QR metadata.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Seller Legal Name (Arabic)
                    </label>
                    <input
                      type="text"
                      name="invoiceSellerNameAr"
                      value={settings.invoiceSellerNameAr}
                      onChange={handleChange}
                      className="input"
                      placeholder="رفاه"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Seller Legal Name (English)
                    </label>
                    <input
                      type="text"
                      name="invoiceSellerNameEn"
                      value={settings.invoiceSellerNameEn}
                      onChange={handleChange}
                      className="input"
                      placeholder="Refah"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      VAT Number
                    </label>
                    <input
                      type="text"
                      name="invoiceVatNumber"
                      value={settings.invoiceVatNumber}
                      onChange={handleChange}
                      className="input"
                      placeholder="Enter VAT number when issued"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Commercial Registration No.
                    </label>
                    <input
                      type="text"
                      name="invoiceCrNumber"
                      value={settings.invoiceCrNumber}
                      onChange={handleChange}
                      className="input"
                      placeholder="CR number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice City
                    </label>
                    <input
                      type="text"
                      name="invoiceCity"
                      value={settings.invoiceCity}
                      onChange={handleChange}
                      className="input"
                      placeholder="Riyadh"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice Country
                    </label>
                    <input
                      type="text"
                      name="invoiceCountry"
                      value={settings.invoiceCountry}
                      onChange={handleChange}
                      className="input"
                      placeholder="Saudi Arabia"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice Email
                    </label>
                    <input
                      type="email"
                      name="invoiceEmail"
                      value={settings.invoiceEmail}
                      onChange={handleChange}
                      className="input"
                      placeholder="billing@refah.sa"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice Phone
                    </label>
                    <input
                      type="text"
                      name="invoicePhone"
                      value={settings.invoicePhone}
                      onChange={handleChange}
                      className="input"
                      placeholder="+966..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice Prefix
                    </label>
                    <input
                      type="text"
                      name="invoicePrefix"
                      value={settings.invoicePrefix}
                      onChange={handleChange}
                      className="input"
                      placeholder="INV"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice Logo Path
                    </label>
                    <input
                      type="text"
                      name="invoiceLogoPath"
                      value={settings.invoiceLogoPath}
                      onChange={handleChange}
                      className="input"
                      placeholder="/uploads/logo-white.png"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-2">
                    National Address (Arabic)
                  </label>
                  <textarea
                    name="invoiceAddressAr"
                    value={settings.invoiceAddressAr}
                    onChange={handleChange}
                    className="input min-h-[84px]"
                    placeholder="العنوان الوطني لشركة رفاه"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-2">
                    National Address (English)
                  </label>
                  <textarea
                    name="invoiceAddressEn"
                    value={settings.invoiceAddressEn}
                    onChange={handleChange}
                    className="input min-h-[84px]"
                    placeholder="Refah legal national address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice Footer Note (Arabic)
                    </label>
                    <textarea
                      name="invoiceFooterNoteAr"
                      value={settings.invoiceFooterNoteAr}
                      onChange={handleChange}
                      className="input min-h-[84px]"
                      placeholder="ملاحظة تظهر أسفل الفاتورة"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-400 mb-2">
                      Invoice Footer Note (English)
                    </label>
                    <textarea
                      name="invoiceFooterNoteEn"
                      value={settings.invoiceFooterNoteEn}
                      onChange={handleChange}
                      className="input min-h-[84px]"
                      placeholder="Footer note shown at the bottom of invoices"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary w-full"
                  >
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Pricing Plans */}
          <div className="card lg:col-span-2">
            <div className="card-header">
              <h3 className="font-semibold text-white">Subscription Plans</h3>
            </div>
            <div className="card-body">
              {packages.length === 0 ? (
                <div className="rounded-lg border border-dark-700 bg-dark-800/60 p-6 text-dark-300">
                  No subscription packages were returned from the API.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {packages.map((plan) => (
                    <div key={plan.id} className="bg-dark-700/50 rounded-lg p-4 border border-dark-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-white">{plan.name}</h4>
                          <p className="text-dark-400 text-xs mt-1">{plan.description || plan.description_ar || "No description"}</p>
                        </div>
                        <div className="flex gap-2">
                          {plan.isFeatured && (
                            <span className="badge badge-primary">Featured</span>
                          )}
                          <span className={`badge ${plan.isActive ? "badge-success" : "badge-warning"}`}>
                            {plan.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-dark-400">Monthly</span>
                          <span className="text-white font-medium">{formatMoney(plan.monthlyPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-dark-400">6 Months</span>
                          <span className="text-white font-medium">{formatMoney(plan.sixMonthPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-dark-400">Annual</span>
                          <span className="text-white font-medium">{formatMoney(plan.annualPrice)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Admin Users */}
          <div className="card lg:col-span-2">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-white">Admin Users</h3>
              <button className="btn btn-primary btn-sm" disabled>
                + Add Admin
              </button>
            </div>
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAdmin ? (
                      <tr>
                        <td className="text-white">{currentAdmin.name || "Admin"}</td>
                        <td className="text-dark-300">{currentAdmin.email}</td>
                        <td>
                          <span className="badge badge-primary">{currentAdmin.role || "super_admin"}</span>
                        </td>
                        <td>
                          <span className={`badge ${currentAdmin.isActive === false ? "badge-warning" : "badge-success"}`}>
                            {currentAdmin.isActive === false ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td className="text-dark-400">{formatDateTime(currentAdmin.lastLoginAt)}</td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-dark-400 text-center py-6">
                          Current admin profile could not be loaded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Note */}
        <div className="card p-6 border-primary-500/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
              <span className="text-xl">🚀</span>
            </div>
            <div>
              <h4 className="text-white font-semibold">Settings rollout status</h4>
              <p className="text-dark-400 text-sm mt-1">
                Commission, VAT, invoice identity, live package cards, and the current admin profile are now loaded from the API. Broader multi-admin management still needs dedicated backend support before this page can manage every administrator account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

