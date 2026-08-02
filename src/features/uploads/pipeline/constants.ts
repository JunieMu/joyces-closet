import type { ItemCategory } from "../../closet/types";
import type { TopSubtype } from "../types";

export interface CanvasSpec {
  width: number;
  height: number;
}

/** Vertical placement. Bottoms hang from the waistline because the rail renders them with
 *  align="top" (ShufflePage.tsx:148); everything else is centred. */
export type Anchor = { kind: "center" } | { kind: "top"; margin: number };

export interface Placement {
  canvas: CanvasSpec;
  fillW: number; // garment width limit, as a fraction of canvas width
  fillH: number; // garment height limit, as a fraction of canvas height
  anchor: Anchor;
}

export const SQUARE: CanvasSpec = { width: 1080, height: 1080 };
export const TALL: CanvasSpec = { width: 1080, height: 2000 };

/**
 * Derived by measuring all 34 built-in PNGs (2026-07-27). The garment is contain-fit into
 * (fillW x canvas.width) by (fillH x canvas.height), then placed per `anchor`, always
 * horizontally centred (built-in centre-x averages 0.507, max deviation 0.041).
 *
 * Tops split into two authoring conventions and so take a subtype:
 *   - tanks are WIDTH-normalized: all 8 sit at 0.579-0.601 canvas width (mean 0.587)
 *   - shirts are HEIGHT-normalized: 0.929-0.958 canvas height (mean 0.944)
 * A single fill number for tops cannot express both, which is why the picker exists.
 */
export const TOP_PLACEMENT: Record<TopSubtype, Placement> = {
  // n=5 on the standard canvas (shirt1 lives on a non-standard 1080x1480). Worst err 0.018.
  shirt: {
    canvas: SQUARE,
    fillW: 0.94,
    fillH: 0.94,
    anchor: { kind: "center" },
  },
  // n=1. Worst err 0.001.
  sweater: {
    canvas: SQUARE,
    fillW: 0.92,
    fillH: 0.92,
    anchor: { kind: "center" },
  },
  // n=8. fillH is a generous cap that only binds for an unusually long tank. Worst err 0.015.
  tank: {
    canvas: SQUARE,
    fillW: 0.59,
    fillH: 0.95,
    anchor: { kind: "center" },
  },
};

/** Bottoms take two canvases (Decision 6); which one is inferred from the cutout's aspect. */
// n=7 pants. Worst err 0.042. Measured top margin 0.024-0.043.
export const BOTTOM_LONG: Placement = {
  canvas: TALL,
  fillW: 0.94,
  fillH: 0.87,
  anchor: { kind: "top", margin: 0.03 },
};
// n=7 shorts+skirts. Worst err 0.077 — the loosest group. Measured top margin 0.038-0.116.
export const BOTTOM_SHORT: Placement = {
  canvas: SQUARE,
  fillW: 0.89,
  fillH: 0.88,
  anchor: { kind: "top", margin: 0.08 },
};

export const PLACEMENT: Record<
  Exclude<ItemCategory, "tops" | "bottoms">,
  Placement
> = {
  // The set that was measured held no dresses, so this one is DERIVED, not measured:
  // a dress is a full-body garment like pants (tall canvas), and its rail passes no
  // align prop (ShufflePage.tsx:138-149), so it centres.
  dresses: {
    canvas: TALL,
    fillW: 0.92,
    fillH: 0.92,
    anchor: { kind: "center" },
  },
  // n=3. Worst err 0.017.
  jackets: {
    canvas: SQUARE,
    fillW: 0.91,
    fillH: 0.91,
    anchor: { kind: "center" },
  },
  // DERIVED, not measured — same status as dresses. The one measured accessory sample was
  // bag1.png, but its 0.81 is retained by `accessories` (2026-08-02 Decision 2) rather than
  // moving here, so `accessories` keeps its provenance and its regression fixture. Bags get a
  // tighter 0.90 because fill is the only size lever that reaches the closet tile and the
  // outfit-card thumbnail, where RAIL_FRAME does not apply. Existing bags filed under
  // accessories keep accessory scale forever — the original upload is not retained — which is
  // why they are deleted and re-uploaded rather than migrated.
  bags: { canvas: SQUARE, fillW: 0.9, fillH: 0.9, anchor: { kind: "center" } },
  // n=1. Worst err 0.001.
  shoes: { canvas: SQUARE, fillW: 0.9, fillH: 0.9, anchor: { kind: "center" } },
  // n=1. Worst err 0.003.
  accessories: {
    canvas: SQUARE,
    fillW: 0.81,
    fillH: 0.81,
    anchor: { kind: "center" },
  },
};

export function placementFor(
  category: ItemCategory,
  options: { subtype?: TopSubtype; fullLength?: boolean } = {},
): Placement {
  if (category === "tops") return TOP_PLACEMENT[options.subtype ?? "shirt"];
  if (category === "bottoms")
    return options.fullLength ? BOTTOM_LONG : BOTTOM_SHORT;
  return PLACEMENT[category];
}
