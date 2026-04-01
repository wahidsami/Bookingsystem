"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";

interface ServiceCategory {
    id: string;
    name_en: string;
    name_ar: string;
    slug: string;
    icon: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

const TABS = [
    { id: "categories", label: "Service Categories", icon: "🏷️", active: true },
    { id: "feature-pricing", label: "Features Pricing", icon: "💰", active: true },
    { id: "coming-3", label: "Booking Rules", icon: "📋", active: false },
    { id: "coming-4", label: "Display Settings", icon: "🎨", active: false },
];

export default function ClientsControlPage() {
    const [activeTab, setActiveTab] = useState("categories");

    return (
        <AdminLayout>
            {/* Page Header */}
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Clients Control</h2>
                <p className="text-dark-400">
                    Manage dynamic settings that control how tenants configure their services and offerings.
                </p>
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-1 mb-6 bg-dark-800 rounded-xl p-1 overflow-x-auto">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => tab.active && setActiveTab(tab.id)}
                        className={`
              flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${activeTab === tab.id
                                ? "bg-primary-600 text-white shadow-lg"
                                : tab.active
                                    ? "text-dark-300 hover:text-white hover:bg-dark-700"
                                    : "text-dark-500 cursor-not-allowed opacity-60"
                            }
            `}
                        disabled={!tab.active}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                        {!tab.active && (
                            <span className="px-1.5 py-0.5 bg-dark-600 text-dark-400 text-xs rounded-full ml-1">
                                Soon
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === "categories" && <CategoriesTab />}
            {activeTab === "feature-pricing" && <FeaturePricingTab />}
            {activeTab !== "categories" && activeTab !== "feature-pricing" && (
                <div className="card flex flex-col items-center justify-center py-20">
                    <span className="text-6xl mb-4">🔒</span>
                    <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
                    <p className="text-dark-400 text-center max-w-md">
                        This section is under development. It will give you more control over how tenants manage their dashboard.
                    </p>
                </div>
            )}
        </AdminLayout>
    );
}

// ===============================
// Categories Tab Component
// ===============================
function CategoriesTab() {
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
    const [formData, setFormData] = useState({ name_en: "", name_ar: "", icon: "" });
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const response = await adminApi.getCategories(true); // Include hidden
            if (response.success) {
                setCategories(response.categories);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name_en.trim() || !formData.name_ar.trim()) {
            setError("Both English and Arabic names are required");
            return;
        }

        setFormLoading(true);
        setError("");

        try {
            if (editingCategory) {
                // Update
                const response = await adminApi.updateCategory(editingCategory.id, {
                    name_en: formData.name_en.trim(),
                    name_ar: formData.name_ar.trim(),
                    icon: formData.icon || undefined,
                });
                if (response.success) {
                    await loadCategories();
                    resetForm();
                }
            } else {
                // Create
                const response = await adminApi.createCategory({
                    name_en: formData.name_en.trim(),
                    name_ar: formData.name_ar.trim(),
                    icon: formData.icon || undefined,
                });
                if (response.success) {
                    await loadCategories();
                    resetForm();
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to save category");
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (category: ServiceCategory) => {
        setEditingCategory(category);
        setFormData({
            name_en: category.name_en,
            name_ar: category.name_ar,
            icon: category.icon || "",
        });
        setShowForm(true);
    };

    const handleToggleActive = async (category: ServiceCategory) => {
        try {
            await adminApi.updateCategory(category.id, { isActive: !category.isActive });
            await loadCategories();
        } catch (err: any) {
            setError(err.message || "Failed to update category");
        }
    };

    const handleDelete = async (category: ServiceCategory) => {
        if (!confirm(`Are you sure you want to permanently delete "${category.name_en}"?`)) return;

        try {
            await adminApi.deleteCategory(category.id, true);
            await loadCategories();
        } catch (err: any) {
            setError(err.message || "Failed to delete category");
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;
        const newCategories = [...categories];
        [newCategories[index - 1], newCategories[index]] = [newCategories[index], newCategories[index - 1]];
        const orderMap = newCategories.map((cat, idx) => ({ id: cat.id, sortOrder: idx + 1 }));
        try {
            await adminApi.reorderCategories(orderMap);
            await loadCategories();
        } catch (err: any) {
            setError(err.message || "Failed to reorder");
        }
    };

    const handleMoveDown = async (index: number) => {
        if (index === categories.length - 1) return;
        const newCategories = [...categories];
        [newCategories[index], newCategories[index + 1]] = [newCategories[index + 1], newCategories[index]];
        const orderMap = newCategories.map((cat, idx) => ({ id: cat.id, sortOrder: idx + 1 }));
        try {
            await adminApi.reorderCategories(orderMap);
            await loadCategories();
        } catch (err: any) {
            setError(err.message || "Failed to reorder");
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingCategory(null);
        setFormData({ name_en: "", name_ar: "", icon: "" });
        setError("");
    };

    if (loading) {
        return (
            <div className="card flex items-center justify-center py-16">
                <div className="spinner w-8 h-8"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* Header Row */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Service Categories</h3>
                    <p className="text-sm text-dark-400">{categories.length} categories total</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <span>+</span>
                    <span>Add Category</span>
                </button>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="card border border-primary-600/30">
                    <h4 className="text-lg font-semibold text-white mb-4">
                        {editingCategory ? "Edit Category" : "New Category"}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Name (English) *</label>
                            <input
                                type="text"
                                value={formData.name_en}
                                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                placeholder="e.g. Hair Services"
                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Name (Arabic) *</label>
                            <input
                                type="text"
                                value={formData.name_ar}
                                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                                placeholder="مثال: خدمات الشعر"
                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                style={{ direction: "rtl" }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Icon (Emoji)</label>
                            <input
                                type="text"
                                value={formData.icon}
                                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                placeholder="e.g. 💇"
                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSubmit}
                            disabled={formLoading}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            {formLoading ? (
                                <div className="spinner w-4 h-4"></div>
                            ) : (
                                <span>{editingCategory ? "Update" : "Create"}</span>
                            )}
                        </button>
                        <button
                            onClick={resetForm}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Categories Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-dark-700">
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Order</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Icon</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">English Name</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Arabic Name</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Slug</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Status</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-dark-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category, index) => (
                                <tr
                                    key={category.id}
                                    className={`border-b border-dark-700/50 hover:bg-dark-700/30 transition ${!category.isActive ? "opacity-50" : ""}`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleMoveUp(index)}
                                                disabled={index === 0}
                                                className="p-1 text-dark-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move up"
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => handleMoveDown(index)}
                                                disabled={index === categories.length - 1}
                                                className="p-1 text-dark-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move down"
                                            >
                                                ▼
                                            </button>
                                            <span className="text-dark-500 text-sm ml-1">{category.sortOrder}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-2xl">{category.icon || "—"}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-white font-medium">{category.name_en}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-white" style={{ direction: "rtl" }}>{category.name_ar}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <code className="text-xs bg-dark-700 px-2 py-0.5 rounded text-dark-300">{category.slug}</code>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleToggleActive(category)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${category.isActive
                                                ? "bg-green-500/20 text-green-400"
                                                : "bg-red-500/20 text-red-400"
                                                }`}
                                        >
                                            {category.isActive ? "Active" : "Hidden"}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(category)}
                                                className="p-1.5 text-dark-400 hover:text-primary-400 transition"
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category)}
                                                className="p-1.5 text-dark-400 hover:text-red-400 transition"
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {categories.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-dark-400">
                                        No categories found. Click "Add Category" to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ===============================
// Feature Pricing Tab Component
// ===============================
function FeaturePricingTab() {
    const [features, setFeatures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadFeatures();
    }, []);

    const loadFeatures = async () => {
        try {
            setLoading(true);
            const response = await adminApi.getFeaturePricing();
            if (response.success) {
                setFeatures(response.features);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load feature pricing");
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (feature: any) => {
        setEditingKey(feature.featureKey);
        setEditValue(parseFloat(feature.unitPrice).toFixed(6));
    };

    const handleCancelEdit = () => {
        setEditingKey(null);
        setEditValue("");
    };

    const handleSaveEdit = async (key: string) => {
        try {
            setSaving(true);
            setError("");

            const value = parseFloat(editValue);
            if (isNaN(value) || value < 0) {
                throw new Error("Please enter a valid positive number");
            }

            const response = await adminApi.updateFeaturePricing(key, value);

            if (response.success) {
                // Update local state to reflect change instantly without full reload
                setFeatures(features.map(f =>
                    f.featureKey === key ? { ...f, unitPrice: value, updatedAt: new Date().toISOString() } : f
                ));
                setEditingKey(null);
            }
        } catch (err: any) {
            setError(err.message || "Failed to update price");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="card flex items-center justify-center py-16">
                <div className="spinner w-8 h-8"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-white">Features Pricing Master List</h3>
                <p className="text-sm text-dark-400">
                    Set the baseline unit cost for all platform features. These prices are used in the Package Builder.
                </p>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* Pricing Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-dark-700 bg-dark-800/50">
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-300">Feature</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-300">Billed Unit</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-300">Unit Price (SAR)</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-dark-300">Last Updated</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-dark-300 w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((feature) => (
                                <tr key={feature.id} className="border-b border-dark-700/50 hover:bg-dark-700/30 transition">
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{feature.label}</span>
                                            <code className="text-xs text-dark-400">{feature.featureKey}</code>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-dark-700 text-dark-300 border border-dark-600">
                                            {feature.unitLabel}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        {editingKey === feature.featureKey ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-dark-400 text-sm">SAR</span>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    min="0"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-32 px-2 py-1 bg-dark-900 border border-primary-500 focus:ring-1 focus:ring-primary-500 rounded text-white text-sm"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(feature.featureKey);
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-white font-mono text-sm tracking-wider">
                                                SAR {parseFloat(feature.unitPrice).toFixed(6)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="text-xs text-dark-400">
                                            {new Date(feature.updatedAt).toLocaleDateString()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {editingKey === feature.featureKey ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleSaveEdit(feature.featureKey)}
                                                    disabled={saving}
                                                    className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition disabled:opacity-50"
                                                    title="Save"
                                                >
                                                    {saving ? <div className="spinner w-4 h-4" /> : "✓"}
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    disabled={saving}
                                                    className="p-1.5 bg-dark-600 text-dark-300 hover:text-white rounded transition disabled:opacity-50"
                                                    title="Cancel"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleEditClick(feature)}
                                                className="px-3 py-1.5 border border-dark-600 rounded text-sm text-dark-300 hover:text-white hover:border-dark-500 transition flex items-center gap-1.5 ml-auto cursor-pointer relative z-10 pointer-events-auto"
                                            >
                                                ✏️ Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {features.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-dark-400">
                                        No feature pricing found. Please run the database seeder.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
