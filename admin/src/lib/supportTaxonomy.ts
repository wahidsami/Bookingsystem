"use client";

export type SupportTaxonomyNode = {
  id: string;
  tenantId?: string | null;
  parentId?: string | null;
  slug?: string | null;
  scope?: string | null;
  name?: string | null;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  icon?: string | null;
  color?: string | null;
  featureKey?: string | null;
  featureRoute?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  children?: SupportTaxonomyNode[];
};

export type SupportTaxonomySelection = {
  moduleId: string;
  featureId: string;
};

const normalizeValue = (value: string | null | undefined) => `${value || ""}`.trim().toLowerCase();

const stripRouteParams = (route?: string | null) => {
  const normalized = `${route || ""}`.trim();
  if (!normalized) return "";
  return normalized
    .replace(/\/\[[^\]]+\]/g, "")
    .replace(/\/:([A-Za-z0-9_]+)/g, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
};

export function buildSupportCategoryTree(categories: SupportTaxonomyNode[] = []) {
  const nodes = categories
    .map((category) => ({ ...category, children: [] as SupportTaxonomyNode[] }))
    .sort((left, right) => {
      const leftParent = left.parentId || "";
      const rightParent = right.parentId || "";
      if (leftParent !== rightParent) {
        return leftParent.localeCompare(rightParent);
      }

      if ((left.sortOrder || 0) !== (right.sortOrder || 0)) {
        return (left.sortOrder || 0) - (right.sortOrder || 0);
      }

      return normalizeValue(left.name).localeCompare(normalizeValue(right.name));
    });

  const nodeMap = new Map<string, SupportTaxonomyNode>();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  const roots: SupportTaxonomyNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children?.push(node);
      return;
    }
    roots.push(node);
  });

  const sortRecursive = (items: SupportTaxonomyNode[]): SupportTaxonomyNode[] => items
    .sort((left, right) => {
      if ((left.sortOrder || 0) !== (right.sortOrder || 0)) {
        return (left.sortOrder || 0) - (right.sortOrder || 0);
      }
      return normalizeValue(left.name).localeCompare(normalizeValue(right.name));
    })
    .map((item) => ({
      ...item,
      children: sortRecursive(item.children || []),
    }));

  return sortRecursive(roots);
}

export function flattenSupportCategoryTree(nodes: SupportTaxonomyNode[] = [], bucket: SupportTaxonomyNode[] = []) {
  for (const node of nodes) {
    bucket.push(node);
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenSupportCategoryTree(node.children, bucket);
    }
  }
  return bucket;
}

export function getSupportCategoryById(categories: SupportTaxonomyNode[] = [], id?: string | null) {
  if (!id) return null;
  return flattenSupportCategoryTree(categories).find((category) => category.id === id) || null;
}

export function getRootSupportCategories(categories: SupportTaxonomyNode[] = []) {
  return categories.filter((category) => !category.parentId);
}

export function getChildSupportCategories(categories: SupportTaxonomyNode[] = [], parentId?: string | null) {
  if (!parentId) return [];
  return categories.filter((category) => category.parentId === parentId);
}

export function getSupportCategoryLabel(category?: SupportTaxonomyNode | null, locale: "ar" | "en" = "en") {
  if (!category) return "Uncategorized";
  if (locale === "ar") return category.nameAr || category.name || category.slug || "Uncategorized";
  return category.name || category.nameAr || category.slug || "Uncategorized";
}

export function getSupportTaxonomySelectionFromRoute(
  pathname: string,
  tree: SupportTaxonomyNode[]
): SupportTaxonomySelection | null {
  const normalizedPath = normalizeValue(pathname);
  if (!normalizedPath) return null;

  const flattened = flattenSupportCategoryTree(tree);
  const matched = flattened
    .filter((node) => {
      const route = stripRouteParams(node.featureRoute);
      return Boolean(route) && (normalizedPath === route || normalizedPath.startsWith(`${route}/`) || normalizedPath.includes(route));
    })
    .sort((left, right) => {
      const leftRoute = stripRouteParams(left.featureRoute);
      const rightRoute = stripRouteParams(right.featureRoute);
      return rightRoute.length - leftRoute.length;
    })[0];

  if (!matched) {
    return null;
  }

  const byId = new Map(flattened.map((node) => [node.id, node] as const));
  const chain: SupportTaxonomyNode[] = [];
  let current: SupportTaxonomyNode | undefined | null = matched;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : null;
  }

  const moduleNode = chain[0] || matched;
  const featureNode = chain[chain.length - 1] || matched;

  return {
    moduleId: moduleNode?.id || "",
    featureId: featureNode?.id || moduleNode?.id || ""
  };
}
