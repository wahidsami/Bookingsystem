"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState({
    serviceCommissionRate: 10.00,
    productCommissionRate: 10.00,
    taxRate: 15.00
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getSettings();
      if (response.success) {
        setSettings(response.settings);
      }
    } catch (err: any) {
      console.error("Failed to load settings:", err);
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
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
                management, and platform configuration will be available in the next update.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

