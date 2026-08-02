import type { ItemCategory } from "./types";

/**
 * Paper-doll proportions (rebuild Decision 6), keyed by category so the shuffle rails and
 * the upload preview render an item at literally the same size. The preview's whole job is
 * to show a misfit before saving, which only works if "real rail scale" is one constant
 * rather than two that agree today.
 *
 * Jackets now render LARGER than tops (2026-08-02 Decision 5), reversing the parity this
 * comment used to document: a jacket is the outer layer and reads as one, with bags beneath
 * it in the same wide column and the small slots staying small.
 *
 * A frame height is only a CAP — a square garment renders at min(frameHeight, windowWidth),
 * where windowWidth is the grid column minus 72px of arrows — and which of the two binds
 * differs by category, which is the whole reason these numbers are not comparable to each
 * other by eye:
 *   - tops and jackets are WIDTH-bound at every viewport ≥768px, so their frames are inert
 *     on their own and the grid-template-columns ratio in index.css is the only lever;
 *   - bags, shoes and accessories are HEIGHT-bound, so their frames work directly.
 * That is why bags share the jacket's wide column yet still need their own frame bump to
 * grow. The bag's ceiling is that column: at h-72 it would go width-bound at ~287px and
 * render level with the jacket, so 256px is deliberately just under it.
 *
 * The bottoms frame is tall enough for full-length pants, and RAIL_IMAGE_WIDTH caps square
 * art (shorts, skirts) so only the tall pieces use the extra height.
 */
export const RAIL_FRAME: Record<ItemCategory, string> = {
  tops: "h-52 sm:h-64",
  bottoms: "h-80 sm:h-96",
  dresses: "h-80 sm:h-96",
  jackets: "h-56 sm:h-72", // 224 / 288px
  bags: "h-40 sm:h-64", // 160 / 256px
  shoes: "h-28 sm:h-32",
  accessories: "h-28 sm:h-32",
};

/** Width cap on the image itself, for rails mixing tall and square art. */
export const RAIL_IMAGE_WIDTH: Record<ItemCategory, string> = {
  tops: "max-w-full",
  bottoms: "max-w-[min(12rem,100%)] sm:max-w-[min(15rem,100%)]",
  dresses: "max-w-full",
  jackets: "max-w-full",
  bags: "max-w-full",
  shoes: "max-w-full",
  accessories: "max-w-full",
};

/** Bottoms hang from the frame's top edge — the waistline anchor the normalizer targets. */
export const RAIL_ALIGN: Record<ItemCategory, "center" | "top"> = {
  tops: "center",
  bottoms: "top",
  dresses: "center",
  jackets: "center",
  bags: "center",
  shoes: "center",
  accessories: "center",
};

/** Tints the category shape marker beside a label (see components/CategoryShape.tsx). */
export const CATEGORY_TINT: Record<ItemCategory, string> = {
  tops: "text-tint-tops",
  bottoms: "text-tint-bottoms",
  dresses: "text-tint-dresses",
  jackets: "text-tint-jackets",
  bags: "text-tint-bags",
  shoes: "text-tint-shoes",
  accessories: "text-tint-accessories",
};

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  jackets: "Jackets",
  bags: "Bags",
  shoes: "Shoes",
  accessories: "Accessories",
};
