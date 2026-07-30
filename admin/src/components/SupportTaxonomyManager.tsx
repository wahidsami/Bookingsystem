"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/api";
import { useAppDialog } from "@/components/AppDialogProvider";
import {
  buildSupportCategoryTree,
  flattenSupportCategoryTree,
  getChildSupportCategories,
  getSupportCategoryLabel,
  type SupportTaxonomyNode,
} from "@/lib/supportTaxonomy";

type FormState = {
  nameEn: string;
  nameAr: string;
  icon: string;
  featureKey: string;
  featureRoute: string;
  sortOrder: string;
  isActive: boolean;
  parentId: string;
};

const emptyForm = (): FormState => ({
  nameEn: "",
  nameAr: "",
  icon: "",
  featureKey: "",
  featureRoute: "",
  sortOrder: "",
  isActive: true,
  parentId: "",
});

function TreeNode({
  node,
  level,
  expandedIds,
  onToggleExpanded,
  onAddChild,
  onEdit,
  onDelete,
  onToggleActive,
  onMove,
}: {
  node: SupportTaxonomyNode;
  level: number;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
  onAddChild: (parent: SupportTaxonomyNode) => void;
  onEdit: (category: SupportTaxonomyNode) => void;
  onDelete: (category: SupportTaxonomyNode) => void;
  onToggleActive: (category: SupportTaxonomyNode) => void;
  onMove: (category: SupportTaxonomyNode, direction: "up" | "down") => void;
}) {
  const children = Array.isArray(node.children) ? node.children : [];
  const isExpanded = expandedIds.has(node.id);
  const canExpand = children.length > 0;

  return (
    <div className="space-y-2">
      <div
        className="rounded-2xl border border-dark-700 bg-dark-900/80 p-4"
        style={{ marginInlineStart: `${level * 18}px` }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {canExpand ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(node.id)}
                  className="rounded-md border border-dark-700 px-2 py-1 text-xs text-dark-300 transition hover:border-dark-500 hover:text-white"
                >
                  {isExpanded ? "−" : "+"}
                </button>
              ) : (
                <span className="rounded-md border border-dark-700 px-2 py-1 text-xs text-dark-500">•</span>
              )}
              <span className="font-semibold text-white">{getSupportCategoryLabel(node, "en")}</span>
              <span className="text-xs text-dark-400">{getSupportCategoryLabel(node, "ar")}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${node.isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
                {node.isActive ? "Active" : "Disabled"}
              </span>
              {node.featureKey && (
                <span className="rounded-full border border-primary-500/30 bg-primary-500/10 px-2 py-0.5 text-[11px] text-primary-200">
                  {node.featureKey}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-dark-400">
              <span>Slug: {node.slug || "—"}</span>
              <span>Route: {node.featureRoute || "—"}</span>
              <span>Sort: {node.sortOrder ?? 0}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAddChild(node)}
              className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs text-primary-200 transition hover:border-primary-400 hover:text-white"
            >
              Add Sub Category
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 transition hover:border-dark-500 hover:text-white"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(node)}
              className="rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 transition hover:border-dark-500 hover:text-white"
            >
              {node.isActive ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              onClick={() => onMove(node, "up")}
              className="rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 transition hover:border-dark-500 hover:text-white"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(node, "down")}
              className="rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 transition hover:border-dark-500 hover:text-white"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onDelete(node)}
              className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-200 transition hover:border-rose-400 hover:text-white"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {canExpand && isExpanded && (
        <div className="space-y-2">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SupportTaxonomyManager() {
  const dialog = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<SupportTaxonomyNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SupportTaxonomyNode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const tree = useMemo(() => buildSupportCategoryTree(categories), [categories]);
  const flat = useMemo(() => flattenSupportCategoryTree(tree), [tree]);
  const moduleCount = tree.length;
  const featureCount = flat.filter((node) => Boolean(node.parentId)).length;

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getSupportCategories();
      if (response.success) {
        const source = (response.tree && response.tree.length > 0 ? response.tree : response.flatCategories || response.categories || []) as SupportTaxonomyNode[];
        setCategories(flattenSupportCategoryTree(buildSupportCategoryTree(source)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support taxonomy");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreate = (parent: SupportTaxonomyNode | null = null) => {
    setEditingCategory(null);
    setForm({
      ...emptyForm(),
      parentId: parent?.id || "",
    });
    setFormOpen(true);
  };

  const openEdit = (category: SupportTaxonomyNode) => {
    setEditingCategory(category);
    setForm({
      nameEn: category.name || "",
      nameAr: category.nameAr || "",
      icon: category.icon || "",
      featureKey: category.featureKey || "",
      featureRoute: category.featureRoute || "",
      sortOrder: String(category.sortOrder ?? 0),
      isActive: Boolean(category.isActive),
      parentId: category.parentId || "",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingCategory(null);
    setForm(emptyForm());
  };

  const submitForm = async () => {
    if (!form.nameEn.trim() || !form.nameAr.trim()) {
      await dialog.alert({
        title: "Validation",
        message: "Both English and Arabic names are required.",
        tone: "danger",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.nameEn.trim(),
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim(),
        icon: form.icon || undefined,
        featureKey: form.featureKey || undefined,
        featureRoute: form.featureRoute || undefined,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
        isActive: form.isActive,
        parentId: form.parentId || undefined,
        scope: "global",
      };

      if (editingCategory) {
        await adminApi.updateSupportCategory(editingCategory.id, payload);
      } else {
        await adminApi.createSupportCategory(payload);
      }

      await loadCategories();
      closeForm();
    } catch (err) {
      await dialog.alert({
        title: editingCategory ? "Update failed" : "Create failed",
        message: err instanceof Error ? err.message : "Failed to save support taxonomy",
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (category: SupportTaxonomyNode) => {
    try {
      await adminApi.updateSupportCategory(category.id, { isActive: !category.isActive });
      await loadCategories();
    } catch (err) {
      await dialog.alert({
        title: "Update failed",
        message: err instanceof Error ? err.message : "Failed to update support category",
        tone: "danger",
      });
    }
  };

  const deleteCategory = async (category: SupportTaxonomyNode) => {
    const confirmed = await dialog.confirm(`Delete "${getSupportCategoryLabel(category, "en")}"?`);
    if (!confirmed) return;
    try {
      await adminApi.deleteSupportCategory(category.id, true);
      await loadCategories();
    } catch (err) {
      await dialog.alert({
        title: "Delete failed",
        message: err instanceof Error ? err.message : "Failed to delete support category",
        tone: "danger",
      });
    }
  };

  const moveCategory = async (category: SupportTaxonomyNode, direction: "up" | "down") => {
    const siblings = category.parentId
      ? getChildSupportCategories(categories, category.parentId)
      : tree;
    const orderedSiblings = [...siblings].sort((left, right) => {
      if ((left.sortOrder || 0) !== (right.sortOrder || 0)) {
        return (left.sortOrder || 0) - (right.sortOrder || 0);
      }
      return getSupportCategoryLabel(left, "en").localeCompare(getSupportCategoryLabel(right, "en"));
    });
    const index = orderedSiblings.findIndex((item) => item.id === category.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedSiblings.length) {
      return;
    }
    const nextOrder = [...orderedSiblings];
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
    try {
      await adminApi.reorderSupportCategories(
        nextOrder.map((item, itemIndex) => ({
          id: item.id,
          sortOrder: itemIndex + 1,
          parentId: item.parentId || null,
        }))
      );
      await loadCategories();
    } catch (err) {
      await dialog.alert({
        title: "Reorder failed",
        message: err instanceof Error ? err.message : "Failed to reorder support categories",
        tone: "danger",
      });
    }
  };

  const expandAll = () => {
    setExpandedIds(new Set(flat.map((node) => node.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="card border border-primary-500/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary-300">Support Categories</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Platform taxonomy</h3>
            <p className="mt-2 text-sm text-dark-400">
              Main categories represent product modules, while sub categories map to the concrete features that support, AI, and knowledge workflows can reference.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={expandAll} className="btn btn-secondary btn-sm">Expand All</button>
            <button type="button" onClick={collapseAll} className="btn btn-secondary btn-sm">Collapse All</button>
            <button type="button" onClick={loadCategories} className="btn btn-secondary btn-sm">Refresh</button>
            <button type="button" onClick={() => openCreate(null)} className="btn btn-primary btn-sm">Create Main Category</button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-dark-700 bg-dark-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-dark-400">Main Categories</p>
            <p className="mt-2 text-2xl font-semibold text-white">{moduleCount}</p>
          </div>
          <div className="rounded-2xl border border-dark-700 bg-dark-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-dark-400">Features</p>
            <p className="mt-2 text-2xl font-semibold text-white">{featureCount}</p>
          </div>
          <div className="rounded-2xl border border-dark-700 bg-dark-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-dark-400">Active</p>
            <p className="mt-2 text-2xl font-semibold text-white">{flat.filter((item) => item.isActive).length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
            onAddChild={(parent) => openCreate(parent)}
            onEdit={openEdit}
            onDelete={deleteCategory}
            onToggleActive={toggleActive}
            onMove={moveCategory}
          />
        ))}
        {tree.length === 0 && (
          <div className="rounded-2xl border border-dark-700 bg-dark-900/70 p-8 text-center text-dark-400">
            No support categories found.
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-dark-700 bg-dark-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-dark-700 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary-300">
                  {editingCategory ? "Edit Support Category" : form.parentId ? "Create Sub Category" : "Create Main Category"}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {editingCategory ? getSupportCategoryLabel(editingCategory, "en") : "Define support taxonomy"}
                </h3>
              </div>
              <button type="button" onClick={closeForm} className="rounded-lg border border-dark-700 px-3 py-2 text-sm text-dark-200 transition hover:border-dark-500 hover:text-white">
                Close
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">English Name</span>
                <input className="input" value={form.nameEn} onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Arabic Name</span>
                <input className="input" value={form.nameAr} onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Icon</span>
                <input className="input" value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Feature Key</span>
                <input className="input" value={form.featureKey} onChange={(event) => setForm((current) => ({ ...current, featureKey: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Feature Route</span>
                <input className="input" value={form.featureRoute} onChange={(event) => setForm((current) => ({ ...current, featureRoute: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Sort Order</span>
                <input type="number" className="input" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Parent Category</span>
                <select className="select" value={form.parentId} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}>
                  <option value="">No parent (main category)</option>
                  {flat
                    .filter((item) => item.id !== editingCategory?.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {getSupportCategoryLabel(category, "ar")}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-center gap-3 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-dark-700 bg-dark-900"
                />
                <span className="text-sm text-dark-200">Active</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-dark-700 px-6 py-4">
              <button type="button" onClick={closeForm} className="btn btn-secondary" disabled={saving}>
                Cancel
              </button>
              <button type="button" onClick={submitForm} className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
