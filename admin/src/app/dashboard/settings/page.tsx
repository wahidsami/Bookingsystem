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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getSettings();
      if (response.success) {
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
                  Platform Name
                </label>
                <input
                  type="text"
                  value="Rifah"
                  disabled
                  className="input opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Default Currency
                </label>
                <input
                  type="text"
                  value="SAR (Saudi Riyal)"
                  disabled
                  className="input opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-2">
                  Default Timezone
                </label>
                <input
                  type="text"
                  value="Asia/Riyadh"
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { name: "Free Trial", price: "0", duration: "30 days", features: ["Basic features", "Up to 50 bookings"] },
                  { name: "Basic", price: "199", duration: "month", features: ["All basic features", "Up to 200 bookings", "Email support"] },
                  { name: "Pro", price: "499", duration: "month", features: ["All features", "Unlimited bookings", "Priority support", "Analytics"] },
                  { name: "Enterprise", price: "Custom", duration: "Custom", features: ["Custom solutions", "Dedicated support", "API access", "White label"] },
                ].map((plan) => (
                  <div key={plan.name} className="bg-dark-700/50 rounded-lg p-4">
                    <h4 className="font-semibold text-white">{plan.name}</h4>
                    <p className="text-2xl font-bold text-primary-400 mt-2">
                      {plan.price === "Custom" ? plan.price : `${plan.price} SAR`}
                    </p>
                    <p className="text-dark-500 text-xs">per {plan.duration}</p>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="text-dark-300 text-sm flex items-center gap-2">
                          <span className="text-success">✓</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
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
                    <tr>
                      <td className="text-white">Super Admin</td>
                      <td className="text-dark-300">admin@rifah.sa</td>
                      <td>
                        <span className="badge badge-primary">Super Admin</span>
                      </td>
                      <td>
                        <span className="badge badge-success">Active</span>
                      </td>
                      <td className="text-dark-400">Just now</td>
                    </tr>
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
              <h4 className="text-white font-semibold">Settings Management Coming Soon</h4>
              <p className="text-dark-400 text-sm mt-1">
                Full settings management including pricing plans, commission rates, admin user
                management, and platform configuration is being rolled out progressively. Invoice identity and VAT fields are now configurable for new invoice snapshots.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

