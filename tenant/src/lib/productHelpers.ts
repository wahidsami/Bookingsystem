export type ProductFilterMode =
  | "all"
  | "available"
  | "unavailable"
  | "featured"
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "az"
  | "za"
  | "newest"
  | "oldest";

export const DEFAULT_PRODUCT_CATEGORIES = [
  "Hair Care",
  "Skin Care",
  "Makeup",
  "Fragrance",
  "Tools & Accessories",
  "General"
] as const;

export const getProductStockTone = (stock: number) => {
  if (stock > 10) return "text-green-600";
  if (stock > 0) return "text-yellow-600";
  return "text-red-600";
};

