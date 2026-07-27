import type { ItemCategory } from "./types";

/**
 * Paper-doll proportions (rebuild Decision 6), keyed by category so the shuffle rails and
 * the upload preview render an item at literally the same size. The preview's whole job is
 * to show a misfit before saving, which only works if "real rail scale" is one constant
 * rather than two that agree today.
 *
 * Tops and jackets render at equal scale; the small slots stay smaller. The bottoms frame
 * is tall enough for full-length pants, and RAIL_IMAGE_WIDTH caps square art (shorts,
 * skirts) so only the tall pieces use the extra height.
 */
export const RAIL_FRAME: Record<ItemCategory, string> = {
  tops: "h-52 sm:h-64",
  bottoms: "h-80 sm:h-96",
  dresses: "h-80 sm:h-96",
  jackets: "h-52 sm:h-64",
  shoes: "h-28 sm:h-32",
  accessories: "h-28 sm:h-32",
};

/** Width cap on the image itself, for rails mixing tall and square art. */
export const RAIL_IMAGE_WIDTH: Record<ItemCategory, string> = {
  tops: "max-w-full",
  bottoms: "max-w-[min(12rem,100%)] sm:max-w-[min(15rem,100%)]",
  dresses: "max-w-full",
  jackets: "max-w-full",
  shoes: "max-w-full",
  accessories: "max-w-full",
};

/** Bottoms hang from the frame's top edge — the waistline anchor the normalizer targets. */
export const RAIL_ALIGN: Record<ItemCategory, "center" | "top"> = {
  tops: "center",
  bottoms: "top",
  dresses: "center",
  jackets: "center",
  shoes: "center",
  accessories: "center",
};

/** The watercolor dot beside a category label (the Rail.tsx:109-114 idiom). */
export const CATEGORY_TINT: Record<ItemCategory, string> = {
  tops: "text-tint-tops",
  bottoms: "text-tint-bottoms",
  dresses: "text-tint-dresses",
  jackets: "text-tint-jackets",
  shoes: "text-tint-shoes",
  accessories: "text-tint-accessories",
};

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  jackets: "Jackets",
  shoes: "Shoes",
  accessories: "Accessories",
};

/** Manifest order — the order the closet page and the category picker present. */
export const CATEGORIES: ItemCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "jackets",
  "shoes",
  "accessories",
];
