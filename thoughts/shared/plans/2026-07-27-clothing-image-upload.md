---
date: 2026-07-27
planner: Joyce Ma
status: draft
research: thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md
decisions: thoughts/shared/decisions/2026-07-27-clothing-image-upload.md
git_commit: 6a7497c43cad344446b20c986f77a3a8e879ac1e
branch: main
---

# In-app Clothing Image Upload — Implementation Plan

## Overview

Upload a photo of a garment in the app; it becomes a transparent paper-doll cutout on a
standard canvas, stored in IndexedDB, merged into `getCloset()` reactively — shuffled,
re-rolled, saved into outfits, indistinguishable from the 34 hand-prepared PNGs. Two
supporting tools ship with it: automatic background removal (only for opaque photos) and
fully automatic sizing normalization.

## Current State Analysis

The architecture was built to accept this. `getCloset()` / `getItem()` are the only exports
of `closet.ts` (`closet.ts:243-249`), and the doc comment at `closet.ts:6-10` names this
exact feature as the reason. Shuffle is pure (the closet is always an argument). Saved
outfits reference items by id only, and `isOutfitValid` / `repairOutfit`
(`outfit.ts:57-126`) already degrade gracefully when an id vanishes.

Four gaps stand between that seam and a working feature:

1. **The closet source is static and non-reactive.** `CLOSET` is a module constant,
   `ITEMS_BY_ID` is built once at import (`closet.ts:237-241`), and all three consumers
   (`ShufflePage.tsx:29`, `OutfitActions.tsx:30`, `OutfitCard.tsx:35,90`) call
   `getCloset()` / `getItem()` inline with no subscription. A runtime mutation re-renders
   nothing.
2. **Module evaluation order defeats naive hydration.** `useShuffleStore` calls
   `freshOutfit()` → `getCloset()` at store-creation time (`useShuffleStore.ts:54`), and
   its persist `merge` validates the stored outfit against `getCloset()`
   (`useShuffleStore.ts:101-106`). ES imports are evaluated before the importing module's
   body, so an `await hydrate()` in `main.tsx`'s body runs **after** the shuffle store has
   already initialized. Decision 8 is only satisfiable if the app modules are not imported
   until hydration resolves.
3. **No image pipeline exists.** Confirmed by grep: no canvas, `FileReader`, file input,
   object-URL, or IndexedDB code anywhere in `src/`.
4. **Sizing is data, not CSS.** There are exactly two garment `<img>` sites
   (`Rail.tsx:154-159`, `OutfitCard.tsx:39-45`), both `object-contain`, both with zero
   per-item CSS. An item's on-screen size is encoded entirely in its PNG.

Baseline is green: 71 tests across 6 files, `tsc -b --noEmit` clean.

## Desired End State

From the `/closet` page, Joyce picks a photo, chooses a category (plus a subtype for tops),
sees the normalized cutout previewed at real rail scale, names it, and saves. The item
appears immediately on the shuffle rails without a reload, participates in shuffle, and can
be saved into outfits. Uploads can be renamed and deleted; built-ins are read-only.

Verified by: uploading a top and seeing it on the rail at a size consistent with its
neighbours; uploading a dress and watching all three dormant dress gates activate live;
reloading and finding the upload still there and still wearing correctly.

### Key Discoveries

- **The built-ins are not uniformly fill-normalized — they follow two conventions.** I
  measured every garment's alpha bounding box. Tanks are *width*-normalized (garment width
  0.579–0.601 of canvas, mean 0.587, across all 8); shirts are *height*-normalized (garment
  height 0.929–0.958, mean 0.944). This is why the research doc's "consistent garment-fill
  ratio" reads as a 0.58–0.96 spread in tops.
- **A single fit-box model reproduces both.** Scale the garment (preserving aspect) to fit
  inside `FILL_W × canvasW` by `FILL_H × canvasH`, then place it. Validated against all 34
  built-ins: 30 land within ±0.02 of their actual fill, worst case ±0.077 (skirt1).
- **The bottoms-canvas inference is safe.** Pants garment-aspect measures 0.525–0.689;
  shorts and skirts 1.254–1.584. A threshold at 1.0 sits in a wide empty gap.
- **`@imgly/background-removal` is AGPL-3.0** and pulls 42–168 MB of model plus 11–22 MB of
  onnxruntime wasm from `staticimgly.com`, whose chunks carry **no `cache-control` header**
  (ETag only), and the library makes no use of the Cache API. Rejected on both counts.
- **Transformers.js caches models properly.** Verified `caches.open` against a
  `transformers-cache` key in the v4.2.0 dist — models persist across sessions.
- **Horizontal centring is the one uncontested invariant**: garment centre-x averages 0.507
  across all 34 built-ins, max deviation 0.041.
- Every built-in is genuinely transparent: 37.5–75.9% of pixels have alpha 0, all four
  corners alpha 0 on all 34. Photos have 0% — so pre-cut detection has enormous margin.

## What We're NOT Doing

Carried from the decisions doc, plus two additions found while planning:

- Backend, accounts, cross-device sync (the interface pattern keeps the swap open).
- Editing, hiding, or deleting built-in manifest items; migrating built-ins into the store.
- Manual scale/nudge adjustment in the preview (Decision 5 names it as the future add).
- Recategorizing or re-subtyping an uploaded item — both would require re-normalizing onto
  a different canvas. Delete and re-upload instead.
- WebP storage optimization; HEIC decoding (iOS converts on upload).
- Tags / `jacketCompatible` metadata on uploads — fields stay reserved and unused.
- **Sub-grouping the closet page by subtype** (decided: sizing only; the page groups by the
  six categories).
- **An explicit pants/shorts/skirt picker** — Decision 6's inference plus a preview toggle
  stands, given the measured gap.

## Implementation Approach

Six phases, ordered to front-load architectural risk and back-load the heavy dependency.

Phase 2 proves the reactive seam with a seeded fake upload **before any image processing
exists** — that is where the real risk sits (module evaluation order, reactivity, blocking
hydration), and it is cheap to verify in isolation.

Phases 3–5 exploit Decision 3's split: because already-transparent uploads skip the remover
entirely, the pre-cut path is a complete feature on its own. So uploading works end-to-end
at the close of Phase 4, and the 44 MB dependency lands afterward and stays optional.

Everything testable under the existing `environment: "node"` setup stays in pure `.ts`
modules; canvas and WASM live behind small interfaces, consistent with `vite.config.ts:8-9`.

---

## Phase 1: Normalization Core (pure, node-testable)

### Overview

The sizing math and the measured constants, with no DOM dependency. This phase produces the
numbers the rest of the feature trusts, and locks them in with a regression test against the
built-ins' real measurements.

### Changes Required

#### 1. Upload-facing types

**File**: `src/features/uploads/types.ts` (new)

```ts
import type { ItemCategory } from "../closet/types";

/** Tops carry a subtype because the built-ins were prepped to two different sizing
 *  conventions — tanks are width-normalized, shirts height-normalized. Only used at
 *  upload time to pick the fill target; nothing downstream reads it to render. */
export type TopSubtype = "shirt" | "sweater" | "tank";

export interface UploadRecord {
  id: string; // crypto.randomUUID()
  name: string;
  category: ItemCategory;
  subtype?: TopSubtype; // tops only — provenance, for possible future re-normalization
  createdAt: string; // ISO
  image: Blob; // normalized PNG on a standard canvas
  width: number; // canvas dimensions, so the closet page lays out without decoding
  height: number;
}
```

#### 2. Measured placement constants

**File**: `src/features/uploads/pipeline/constants.ts` (new)

Every number below was measured from the built-in PNGs' alpha bounding boxes. The comment
block is load-bearing documentation — it is the only record of *why* these values.

```ts
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
  shirt: { canvas: SQUARE, fillW: 0.94, fillH: 0.94, anchor: { kind: "center" } },
  // n=1. Worst err 0.001.
  sweater: { canvas: SQUARE, fillW: 0.92, fillH: 0.92, anchor: { kind: "center" } },
  // n=8. fillH is a generous cap that only binds for an unusually long tank. Worst err 0.015.
  tank: { canvas: SQUARE, fillW: 0.59, fillH: 0.95, anchor: { kind: "center" } },
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
  // No built-in dresses exist (closet.ts:195), so this one is DERIVED, not measured:
  // a dress is a full-body garment like pants (tall canvas), and its rail passes no
  // align prop (ShufflePage.tsx:113), so it centres.
  dresses: { canvas: TALL, fillW: 0.92, fillH: 0.92, anchor: { kind: "center" } },
  // n=3. Worst err 0.017.
  jackets: { canvas: SQUARE, fillW: 0.91, fillH: 0.91, anchor: { kind: "center" } },
  // n=1. Worst err 0.001.
  shoes: { canvas: SQUARE, fillW: 0.9, fillH: 0.9, anchor: { kind: "center" } },
  // n=1. Worst err 0.003.
  accessories: { canvas: SQUARE, fillW: 0.81, fillH: 0.81, anchor: { kind: "center" } },
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
```

#### 3. Pure geometry

**File**: `src/features/uploads/pipeline/normalize.ts` (new)

```ts
import type { Placement } from "./constants";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Tightest box containing every pixel above `threshold`. Null when nothing is opaque
 *  enough — a fully transparent image, which the caller must reject. */
export function alphaBoundingBox(
  alpha: Uint8Array,
  width: number,
  height: number,
  threshold = 8,
): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x]! <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Where the trimmed garment lands on the standard canvas: contain-fit into the placement's
 * fill box, horizontally centred, vertically centred or waist-anchored. This is the whole
 * of "standardized sizing" — the PNG canvas IS the layout contract, since the two render
 * sites use object-contain with zero per-item CSS.
 */
export function fitBox(garment: { width: number; height: number }, placement: Placement): Box {
  const { canvas, fillW, fillH, anchor } = placement;
  const boxW = fillW * canvas.width;
  const boxH = fillH * canvas.height;

  const scale = Math.min(boxW / garment.width, boxH / garment.height);
  const width = garment.width * scale;
  const height = garment.height * scale;

  return {
    left: (canvas.width - width) / 2,
    top:
      anchor.kind === "top"
        ? anchor.margin * canvas.height
        : (canvas.height - height) / 2,
    width,
    height,
  };
}
```

#### 4. Detection helpers

**File**: `src/features/uploads/pipeline/detect.ts` (new)

```ts
/**
 * Does this upload already have a cut-out background (Decision 3)? Every built-in has
 * 37.5-75.9% fully-transparent pixels; a camera photo has 0%. The 5% threshold sits in
 * that gap with room to spare, and unlike a border-ring test it still works on an image
 * cropped tight to the garment.
 */
export function isPreCut(alpha: Uint8Array, threshold = 16, minFraction = 0.05): boolean {
  let clear = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i]! < threshold) clear++;
  return clear / alpha.length >= minFraction;
}

/**
 * Full-length bottoms take the tall canvas (Decision 6). Measured garment aspects:
 * pants 0.525-0.689, shorts/skirts 1.254-1.584 — a threshold of 1.0 (taller than wide)
 * sits in a wide empty gap, so the preview toggle should almost never be needed.
 */
export function isFullLength(garment: { width: number; height: number }): boolean {
  return garment.width / garment.height < 1;
}
```

#### 5. Regression test against the real measurements

**File**: `src/features/uploads/pipeline/normalize.test.ts` (new)

Node's test environment has no PNG decoder, so the measurements are embedded as a fixture
table rather than re-derived from `public/`. That is the point: the table is the record of
what the built-ins actually are, and the test fails if the constants drift away from them.

```ts
import { describe, expect, it } from "vitest";

import {
  BOTTOM_LONG, BOTTOM_SHORT, PLACEMENT, TOP_PLACEMENT, type Placement,
} from "./constants";
import { alphaBoundingBox, fitBox } from "./normalize";

const BY_NAME: Record<string, Placement> = {
  shirt: TOP_PLACEMENT.shirt,
  sweater: TOP_PLACEMENT.sweater,
  tank: TOP_PLACEMENT.tank,
  BOTTOM_LONG,
  BOTTOM_SHORT,
  jackets: PLACEMENT.jackets,
  shoes: PLACEMENT.shoes,
  accessories: PLACEMENT.accessories,
};

/**
 * Measured 2026-07-27 by decoding public/images/**.png and taking each garment's alpha
 * bounding box at threshold 8. This table is the only record of what the built-ins
 * actually are — the node test environment has no PNG decoder, so it cannot be re-derived
 * here. If a constant drifts away from the convention it was fitted to, this fails.
 *
 * [file, placement, canvasW, canvasH, bboxW, bboxH]
 * shirt1.png (1080x1480) is excluded: known outlier on a non-standard canvas.
 */
const BUILT_INS: [string, string, number, number, number, number][] = [
  ["bag1.png",    "accessories",  1080, 1080, 872, 819],
  ["pants1.png",  "BOTTOM_LONG",  1080, 2000, 1027, 1492],
  ["pants2.png",  "BOTTOM_LONG",  1080, 2000, 960, 1662],
  ["pants3.png",  "BOTTOM_LONG",  1080, 2000, 920, 1752],
  ["pants4.png",  "BOTTOM_LONG",  1080, 2000, 913, 1721],
  ["pants5.png",  "BOTTOM_LONG",  1080, 2000, 1048, 1633],
  ["pants6.png",  "BOTTOM_LONG",  1080, 2000, 1028, 1491],
  ["pants7.png",  "BOTTOM_LONG",  1080, 2000, 1019, 1569],
  ["shorts1.png", "BOTTOM_SHORT", 1080, 1080, 1017, 642],
  ["shorts2.png", "BOTTOM_SHORT", 1080, 1080, 903, 720],
  ["shorts3.png", "BOTTOM_SHORT", 1080, 1080, 912, 668],
  ["shorts4.png", "BOTTOM_SHORT", 1080, 1080, 944, 675],
  ["skirt1.png",  "BOTTOM_SHORT", 1080, 1080, 878, 601],
  ["skirt2.png",  "BOTTOM_SHORT", 1080, 1080, 996, 650],
  ["skirt3.png",  "BOTTOM_SHORT", 1080, 1080, 1025, 698],
  ["jacket1.png", "jackets",      1080, 1080, 664, 965],
  ["jacket2.png", "jackets",      1080, 1080, 762, 1001],
  ["jacket3.png", "jackets",      1080, 1080, 708, 988],
  ["shoes1.png",  "shoes",        1080, 1080, 971, 655],
  ["shirt2.png",  "shirt",        1080, 1080, 1011, 806],
  ["shirt3.png",  "shirt",        1080, 1080, 936, 1003],
  ["shirt4.png",  "shirt",        1080, 1080, 681, 1035],
  ["shirt5.png",  "shirt",        1080, 1080, 771, 1025],
  ["shirt6.png",  "shirt",        1080, 1080, 821, 1017],
  ["sweater1.png","sweater",      1080, 1080, 774, 992],
  ["tank1.png",   "tank",         1080, 1080, 626, 729],
  ["tank2.png",   "tank",         1080, 1080, 649, 764],
  ["tank3.png",   "tank",         1080, 1080, 636, 740],
  ["tank4.png",   "tank",         1080, 1080, 625, 804],
  ["tank5.png",   "tank",         1080, 1080, 628, 661],
  ["tank6.png",   "tank",         1080, 1080, 634, 850],
  ["tank7.png",   "tank",         1080, 1080, 634, 649],
  ["tank8.png",   "tank",         1080, 1080, 638, 953],
];

/** What fitBox would produce for this garment, as fractions of the canvas. */
function predictedFill(placementName: string, bboxW: number, bboxH: number) {
  const placement = BY_NAME[placementName]!;
  const box = fitBox({ width: bboxW, height: bboxH }, placement);
  return {
    w: box.width / placement.canvas.width,
    h: box.height / placement.canvas.height,
  };
}

const TIGHT = new Set(["shirt", "sweater", "tank", "jackets", "shoes", "accessories"]);

describe("fitBox reproduces the built-in sizing conventions", () => {
  it.each(BUILT_INS)(
    "%s lands within 0.08 of its measured fill",
    (_file, placement, canvasW, canvasH, bboxW, bboxH) => {
      const got = predictedFill(placement, bboxW, bboxH);
      expect(Math.abs(got.w - bboxW / canvasW)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(got.h - bboxH / canvasH)).toBeLessThanOrEqual(0.08);
    },
  );

  // Everything except bottoms was authored to a tight convention; bottoms spread wider
  // (worst 0.077 on skirt1), which is why the general bound above is looser.
  it.each(BUILT_INS.filter(([, placement]) => TIGHT.has(placement)))(
    "%s lands within 0.02 of its measured fill",
    (_file, placement, canvasW, canvasH, bboxW, bboxH) => {
      const got = predictedFill(placement, bboxW, bboxH);
      expect(Math.abs(got.w - bboxW / canvasW)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(got.h - bboxH / canvasH)).toBeLessThanOrEqual(0.02);
    },
  );

  it("keeps every tank at the measured 0.587 canvas width", () => {
    for (const [, placement, canvasW, , bboxW, bboxH] of BUILT_INS) {
      if (placement !== "tank") continue;
      expect(predictedFill(placement, bboxW, bboxH).w).toBeCloseTo(0.587, 2);
      expect(canvasW).toBe(1080);
    }
  });

  it("waist-anchors bottoms and centres everything else", () => {
    const long = fitBox({ width: 1000, height: 1800 }, BOTTOM_LONG);
    expect(long.top).toBeCloseTo(0.03 * 2000, 5);

    const top = fitBox({ width: 800, height: 900 }, TOP_PLACEMENT.shirt);
    expect(top.top).toBeCloseTo((1080 - top.height) / 2, 5);
  });

  it("horizontally centres every placement", () => {
    for (const [, placement, canvasW, , bboxW, bboxH] of BUILT_INS) {
      const box = fitBox({ width: bboxW, height: bboxH }, BY_NAME[placement]!);
      expect(box.left + box.width / 2).toBeCloseTo(canvasW / 2, 5);
    }
  });

  it("never lets a garment overflow its canvas", () => {
    for (const [, placement, canvasW, canvasH, bboxW, bboxH] of BUILT_INS) {
      const box = fitBox({ width: bboxW, height: bboxH }, BY_NAME[placement]!);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(canvasW);
      expect(box.top + box.height).toBeLessThanOrEqual(canvasH);
    }
  });

  it("preserves the garment's aspect ratio", () => {
    const box = fitBox({ width: 900, height: 300 }, TOP_PLACEMENT.shirt);
    expect(box.width / box.height).toBeCloseTo(3, 5);
  });
});

describe("alphaBoundingBox", () => {
  it("returns null for a fully transparent image", () => { /* ... */ });
  it("trims to the opaque region inclusive of edge pixels", () => { /* ... */ });
  it("returns the full canvas when every pixel is opaque", () => { /* ... */ });
});
```

One caveat the implementer should know: the "never overflow" assertion holds for the
measured built-ins but is not guaranteed in general — `BOTTOM_LONG`/`BOTTOM_SHORT` anchor at
a fixed top margin, so a garment whose fitted height exceeds `1 - margin` of the canvas
would run off the bottom. `fillH` is set below that bound for both (0.87 + 0.03 = 0.90;
0.88 + 0.08 = 0.96), so it cannot happen with these constants — but the invariant is worth a
clamp if the constants are ever retuned.

**File**: `src/features/uploads/pipeline/detect.test.ts` (new) — `isPreCut` on synthetic
alpha at 0%, 4%, 6% and 60% clear; `isFullLength` at the measured extremes (0.525, 0.689,
1.254, 1.584) and exactly at the 1.0 boundary.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] New pipeline tests are present and green (fixture table covers 33 standard-canvas built-ins)

#### Manual Verification

- [x] None — this phase is pure computation with no user-visible surface.

---

## Phase 2: Upload Store + Reactive Closet Seam

### Overview

Uploads can exist, persist, and flow into `getCloset()` reactively — with no image
processing anywhere. This is the architectural risk, isolated and provable.

### Changes Required

#### 1. Split the manifest out of the seam

**File**: `src/features/closet/manifest.ts` (new — receives the `CLOSET` constant verbatim
from `closet.ts:12-235`)

```ts
import type { Closet } from "./types";

/** The built-in closet. Adding an item = drop a PNG in `public/images/<category>/` and add
 *  one entry here. Read-only at runtime (Decision 1): uploads never mutate this. */
const MANIFEST: Closet = {
  /* ...unchanged from closet.ts... */
};

export function getManifest(): Closet {
  return MANIFEST;
}
```

Splitting the data out breaks what would otherwise be an import cycle: `closet.ts` needs the
store, the store needs the manifest, and the manifest must need neither.

#### 2. Pure merge logic

**File**: `src/features/closet/merge.ts` (new)

```ts
import type { Closet, ClosetItem, ItemCategory } from "./types";

const CATEGORIES: ItemCategory[] = [
  "tops", "bottoms", "dresses", "jackets", "shoes", "accessories",
];

/** Uploads append after the built-ins in their own category, so existing rail positions
 *  never shift under Joyce when she adds something. */
export function mergeCloset(manifest: Closet, uploads: ClosetItem[]): Closet {
  const merged = {} as Closet;
  for (const category of CATEGORIES) {
    const added = uploads.filter((item) => item.category === category);
    merged[category] = added.length === 0 ? manifest[category] : [...manifest[category], ...added];
  }
  return merged;
}

export function buildIndex(closet: Closet): Map<string, ClosetItem> {
  return new Map(Object.values(closet).flat().map((item) => [item.id, item]));
}
```

**File**: `src/features/closet/merge.test.ts` (new) — appends within category; preserves
built-in order; **the first uploaded dress makes `closet.dresses` non-empty** (the condition
all three dormant dress gates read); `buildIndex` finds both built-ins and uploads; an empty
upload list returns the manifest arrays untouched.

#### 3. The reactive closet store

**File**: `src/features/closet/useClosetStore.ts` (new)

```ts
import { create } from "zustand";

import { getManifest } from "./manifest";
import { buildIndex, mergeCloset } from "./merge";
import type { Closet, ClosetItem } from "./types";

interface ClosetState {
  uploads: ClosetItem[]; // hydrated: blobs already turned into object URLs
  closet: Closet;
  itemsById: Map<string, ClosetItem>;
  setUploads: (uploads: ClosetItem[]) => void;
}

function derive(uploads: ClosetItem[]) {
  const closet = mergeCloset(getManifest(), uploads);
  return { uploads, closet, itemsById: buildIndex(closet) };
}

/** The closet source. Deliberately no persist middleware — persistence is the UploadStore's
 *  job (same split as useOutfitsStore); this mirrors it into React. */
export const useClosetStore = create<ClosetState>()((set) => ({
  ...derive([]),
  setUploads: (uploads) => set(derive(uploads)),
}));
```

#### 4. The seam, now reactive but still synchronous

**File**: `src/features/closet/closet.ts` (rewritten — data moves out, delegation moves in)

```ts
import { useClosetStore } from "./useClosetStore";
import type { Closet, ClosetItem } from "./types";

/**
 * The closet as it stands right now: built-in manifest plus whatever has been uploaded.
 * Still synchronous — hydration completes before any of this module's consumers are
 * imported (see main.tsx) — but no longer a constant. Components that must re-render when
 * an upload lands should use the hooks below rather than calling these directly.
 */
export function getCloset(): Closet {
  return useClosetStore.getState().closet;
}

export function getItem(id: string): ClosetItem | undefined {
  return useClosetStore.getState().itemsById.get(id);
}

export function useCloset(): Closet {
  return useClosetStore((state) => state.closet);
}

export function useClosetItem(id: string | null): ClosetItem | undefined {
  return useClosetStore((state) => (id === null ? undefined : state.itemsById.get(id)));
}
```

#### 5. Subscribe the three inline consumers

- `src/features/shuffle/ShufflePage.tsx:29` — `const closet = getCloset()` → `useCloset()`
- `src/components/OutfitActions.tsx:30` — same swap (this is what makes the dress toggle
  appear the moment the first dress is uploaded)
- `src/features/outfits/OutfitCard.tsx:35,90` — `getItem(id)` → `useClosetItem(id)` in
  `Thumbnail`; `getCloset()` → `useCloset()` in `OutfitCard`

#### 6. Persistence behind an interface

**File**: `src/features/uploads/store.ts` (new)

```ts
import type { UploadRecord } from "./types";

/**
 * The only way uploads are persisted. Async because IndexedDB is — image blobs are far too
 * large for localStorage. Moving to a backend means one more implementation of this and
 * nothing else (same posture as OutfitStore).
 */
export interface UploadStore {
  list(): Promise<UploadRecord[]>;
  save(record: UploadRecord): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**File**: `src/features/uploads/indexedDbStore.ts` (new)

- DB name `joyces-closet:uploads:v1`, version 1, one object store `items` with `keyPath: "id"`,
  following the established `joyces-closet:<domain>:v1` key idiom.
- `createIndexedDbUploadStore(factory: IDBFactory = indexedDB): UploadStore`.
- **Reads never throw** (the `localStorageStore.ts:24-39` / `themeStorage.ts` idiom): a
  missing DB, a blocked upgrade, or a record of the wrong shape degrades to an empty list,
  filtering per entry via an `isUploadRecord` guard. Writes surface their error to the
  caller so the upload UI can report a quota failure honestly.

**File**: `src/features/uploads/memoryUploadStore.ts` (new) — an in-memory `UploadStore` for
tests and for the Phase 2 seeding harness.

**File**: `src/features/uploads/memoryUploadStore.test.ts` (new) — round-trip, replace-by-id,
delete-only-the-target, unknown-id delete is a no-op. Mirrors `localStorageStore.test.ts`.

> The IndexedDB implementation itself is **not** unit-tested: `vite.config.ts:9` pins
> `environment: "node"`, which has no IndexedDB, and the decisions doc scopes tests to
> injected adapters for exactly this reason. Its correctness is covered by the manual
> criteria below. The logic worth testing — merging and object-URL lifecycle — lives in
> pure modules that are tested.

#### 7. Hydration, and the module-order fix

**File**: `src/features/uploads/hydrate.ts` (new)

```ts
import { useClosetStore } from "../closet/useClosetStore";
import type { ClosetItem } from "../closet/types";
import type { UploadRecord } from "./types";
import { uploadStore } from "./uploadStore";

/** Object URLs are created here and live as long as the item does. Nothing persists an
 *  image path — outfits store ids only — so a URL that changes every session is safe. */
export function toClosetItem(record: UploadRecord): ClosetItem {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    image: URL.createObjectURL(record.image),
  };
}

export async function hydrateCloset(): Promise<void> {
  const records = await uploadStore.list();
  useClosetStore.getState().setUploads(records.map(toClosetItem));
}
```

**File**: `src/features/uploads/uploadStore.ts` (new)

```ts
import { createIndexedDbUploadStore } from "./indexedDbStore";
import type { UploadStore } from "./store";

// The one place that picks an implementation — the OutfitStore idiom (useOutfitsStore.ts:10).
export const uploadStore: UploadStore = createIndexedDbUploadStore();
```

**File**: `src/app.tsx` (new — the router and mount, moved out of `main.tsx`)

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import { Layout } from "./components/Layout";
import { ShufflePage } from "./features/shuffle/ShufflePage";
import { OutfitsPage } from "./features/outfits/OutfitsPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: ShufflePage },
      { path: "outfits", Component: OutfitsPage },
    ],
  },
]);

export function mountApp(): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element #root not found");
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
```

**File**: `src/main.tsx` (rewritten)

```tsx
import "./index.css";
import { hydrateCloset } from "./features/uploads/hydrate";

/**
 * Uploads must be in the closet before anything reads it (Decision 8). useShuffleStore
 * shuffles and re-validates the persisted outfit at module-init time
 * (useShuffleStore.ts:54,101-106) — and ES imports evaluate before the importing module's
 * body, so awaiting here is only sufficient because the app is imported dynamically
 * afterwards. A static `import { mountApp }` would defeat this entirely.
 *
 * Same correctness-before-first-paint posture as the theme script in index.html.
 */
void hydrateCloset()
  .catch(() => {
    // A failed hydration must not cost Joyce the app — she just sees built-ins only.
  })
  .then(async () => {
    const { mountApp } = await import("./app");
    mountApp();
  });
```

#### 8. Keep manifest tests pointed at the manifest

**File**: `src/features/closet/closet.test.ts`

The disk-existence and `/images/<category>/` assertions must keep applying to the **static
manifest only** — uploads use `blob:` URLs. Retarget the suite from `getCloset()` to
`getManifest()`. The `getItem` describe block stays on `getItem`, which still resolves every
manifest item (the store starts with an empty upload list in tests).

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass, including the 71 pre-existing: `npm test`
- [x] `merge.test.ts` proves an uploaded dress makes `closet.dresses` non-empty
- [x] Production build succeeds: `npm run build`

#### Manual Verification

Seed a fake upload with a temporary dev-only helper (fetch a built-in PNG as a blob, save it
through `uploadStore`) and confirm:

- [ ] The seeded item appears on its rail without a reload
- [ ] Shuffle All can select it; per-slot re-roll cycles through it
- [ ] Saving an outfit that wears it, then reloading, restores that outfit intact
- [ ] Seeding a **dress** activates all three gates live: the Top &amp; bottom / Dress toggle
      appears (`OutfitActions.tsx:76`), the merged dress rail renders
      (`ShufflePage.tsx:105-118`), and shuffle can pick a dress base (`shuffle.ts:43-59`)
- [ ] Deleting the seeded record from IndexedDB (devtools) and reloading degrades to
      "Some items are no longer in the closet" on affected cards rather than a broken image
- [ ] Existing behaviour is unchanged when no uploads exist

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation before proceeding. The seeding helper is scaffolding —
remove it before Phase 4 ships real uploads.

---

## Phase 3: Browser Image Pipeline (transparent inputs)

### Overview

Turn a chosen file into a normalized PNG blob on the standard canvas. No background removal
yet — this path serves the pre-cut PNGs Joyce already produces.

### Changes Required

#### 1. Canvas operations behind a narrow surface

**File**: `src/features/uploads/pipeline/canvas.ts` (new)

```ts
/** Browser-only half of the pipeline. Kept deliberately thin — every decision it makes
 *  lives in the pure modules (normalize.ts / detect.ts / constants.ts), which are the ones
 *  under test. `environment: "node"` (vite.config.ts:9) cannot reach any of this. */

/** `imageOrientation: "from-image"` applies EXIF rotation, so phone photos land upright. */
export async function decode(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export interface AlphaData {
  alpha: Uint8Array;
  width: number;
  height: number;
}

export function readAlpha(bitmap: ImageBitmap): AlphaData;

/** Draws `source`'s `crop` region into `dest` on a fresh canvas of `canvas` size and
 *  encodes PNG. High-quality downscaling matters: the crop is often ~1000px landing in a
 *  ~600px box. */
export function composite(
  source: ImageBitmap,
  crop: Box,
  dest: Box,
  canvas: CanvasSpec,
): Promise<Blob>;
```

#### 2. The orchestrator

**File**: `src/features/uploads/pipeline/normalizeUpload.ts` (new)

```ts
export interface NormalizeResult {
  blob: Blob;
  width: number;
  height: number;
  fullLength: boolean; // what the bottoms inference decided; the preview toggle can override
  wasPreCut: boolean;
}

export interface NormalizeOptions {
  category: ItemCategory;
  subtype?: TopSubtype;
  fullLength?: boolean; // set by the preview toggle; otherwise inferred
  removeBackground?: (bitmap: ImageBitmap) => Promise<ImageBitmap>; // injected in Phase 5
}

/**
 * decode -> (remove background if opaque) -> alpha bbox -> fit box -> composite -> PNG.
 * Throws a typed error when the image has no opaque pixels at all, which is the one input
 * the rest of the pipeline cannot represent.
 */
export async function normalizeUpload(
  file: Blob,
  options: NormalizeOptions,
): Promise<NormalizeResult>;
```

Background removal enters as an **injected function**, absent in this phase. That keeps
Phase 5 additive and lets the whole orchestration be exercised now.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] Production build succeeds: `npm run build`

#### Manual Verification

Via a temporary dev harness (a bare file input wired to `normalizeUpload`):

- [ ] Feeding a **built-in PNG back through the pipeline** returns a canvas of the expected
      standard size, and the round-tripped result renders at essentially the same rail size
      as the original — the strongest available check that the constants are right
- [ ] A tall bottoms cutout selects 1080×2000; a shorts/skirt cutout selects 1080×1080
- [ ] Output PNGs have genuinely transparent backgrounds (no white box over `bg-paper`)
- [ ] A photo shot in portrait on a phone is not sideways (EXIF handling works)
- [ ] A fully transparent input produces a clear error rather than a blank item

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: `/closet` Page + Upload Flow

### Overview

The first fully usable milestone: uploading works end-to-end for pre-cut PNGs, and the
closet page shows the whole wardrobe.

### Changes Required

#### 1. Routing and navigation

- `src/app.tsx` — a third child route `{ path: "closet", Component: ClosetPage }`.
  `vercel.json`'s SPA rewrite already covers it.
- `src/components/Layout.tsx` — a `closet` `NavLink` in **both** navs: the desktop sidebar
  (`Layout.tsx:40-47`) and the mobile header (`Layout.tsx:75-83`), reusing `navLinkClass`.

#### 2. Upload naming

**File**: `src/features/uploads/naming.ts` (new) + `naming.test.ts`

```ts
/** The name an upload gets when Joyce doesn't type one: "Tank · Jul 27". Mirrors
 *  defaultOutfitName's form (naming.ts:2), using the subtype when there is one. */
export function defaultItemName(
  category: ItemCategory,
  subtype: TopSubtype | undefined,
  date: Date,
): string;
```

#### 3. The closet page

**File**: `src/features/closet/ClosetPage.tsx` (new)

- Six category sections in manifest order, each labelled with its `--color-tint-<category>`
  watercolor dot (the `Rail.tsx:109-114` idiom).
- Every item renders as a tile; uploads carry management affordances (Phase 6), built-ins
  render read-only.
- A primary pill opens the upload flow. Accent stays the only action color.
- An empty-state for categories with no items, matching `OutfitsPage.tsx:39-48`'s tone.

#### 4. The upload flow

**File**: `src/features/uploads/UploadFlow.tsx` (new)

Multi-step, on-page rather than in a popover (Decision 4):

1. **Pick** — file input constrained to `image/png, image/jpeg, image/webp` (Decision 10).
2. **Category** — six choices, explicit (Decision 7); category tints may style the picker.
3. **Subtype** — tops only: shirt / sweater / tank. Copy explains it sets the size.
4. **Preview** — the normalized item rendered **at real rail scale**, inside a frame using
   the same size classes as `ShufflePage.tsx:10-17`, on `bg-paper`. For bottoms only, a
   "full-length" toggle overrides the inference and re-normalizes (Decision 6).
5. **Name** — pre-filled with `defaultItemName`, editable.
6. **Save** — `crypto.randomUUID()`, write through `uploadStore`, then push the new item
   into `useClosetStore` so it appears immediately.

Errors surface inline: an unreadable image, an all-transparent result, and a quota failure
each get their own message. A write failure must not leave the item in the store.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] `naming.test.ts` covers each category and subtype
- [x] Production build succeeds: `npm run build`

#### Manual Verification

- [ ] Uploading a pre-cut PNG top puts it on the rail at a size consistent with its
      neighbours — a tank sized like the built-in tanks, a shirt like the built-in shirts
- [ ] The preview matches what actually appears on the rail
- [ ] The bottoms full-length toggle re-normalizes onto the other canvas
- [ ] Uploading the first dress activates the dress toggle and rail live, without a reload
- [ ] Uploads survive a reload; a saved outfit wearing one restores correctly
- [ ] The closet page shows all 34 built-ins plus uploads, grouped by category
- [ ] `/closet` nav entry appears and highlights correctly in **both** desktop and mobile navs
- [ ] Deep-linking to `/closet` works on the deployed build (SPA rewrite)
- [ ] The page reads correctly in all five themes
- [ ] The flow is usable one-handed on a phone

**Implementation Note**: Pause for manual confirmation before proceeding. The scaffolding
from Phases 2–3 should be gone by now.

---

## Phase 5: Background Removal

### Overview

Opaque photos get a cutout. One new runtime dependency, lazy-loaded, in a worker, only when
an opaque image is actually uploaded.

### Engine (validated 2026-07-27)

`@huggingface/transformers` v4.2.0 (**Apache-2.0**, 545 KB minified) with
**`briaai/RMBG-1.4`**, `onnx/model_quantized.onnx` (**44.4 MB**).

Why not `@imgly/background-removal`, which the decisions doc named as the recommendation:
its `LICENSE.md` is **AGPL-3.0** — viral copyleft over a repo that is public and carries no
license file — and its assets are 42–168 MB of model plus 11–22 MB of onnxruntime served
from `staticimgly.com` with **no `cache-control` header**, against a library that makes no
use of the Cache API. Transformers.js caches into `transformers-cache` via the Cache API
(verified in its dist), so the download genuinely happens once. Decision 3's behavior
contract is what binds, and it is fully preserved.

RMBG-1.4's own weights are under Bria's non-commercial license, which a personal closet app
satisfies. Its `config.json` declares `model_type: "SegformerForSemanticSegmentation"` and
its `preprocessor_config.json` declares `ImageFeatureExtractor` (1024×1024, mean 0.5, std 1)
— both directly consumable by `AutoModel` / `AutoProcessor`.

### Changes Required

#### 1. Dependency

`npm install @huggingface/transformers` — a deliberate, accepted exception to the UI
projects' "no new dependencies" convention (Decision 3).

#### 2. Worker

**File**: `src/features/uploads/pipeline/removal.worker.ts` (new)

Runs the model off the main thread so the UI stays responsive during a multi-second
inference. Loads model and processor once and reuses them across uploads. Posts progress
messages during the first-run download.

```ts
// Shape to verify against the installed version at implementation time — the surface has
// moved between major versions of transformers.js.
const model = await AutoModel.from_pretrained("briaai/RMBG-1.4", { progress_callback });
const processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4");
const { pixel_values } = await processor(image);
const { output } = await model({ input: pixel_values });
// output is a single-channel mask; resize to the source dimensions and use it as alpha.
```

#### 3. Lazy entry point

**File**: `src/features/uploads/pipeline/backgroundRemoval.ts` (new)

- `removeBackground(bitmap, onProgress): Promise<ImageBitmap>` — dynamic `import()` so
  nothing loads for users who only upload pre-cut PNGs, and the main bundle is unaffected.
- Injected into `normalizeUpload` as the `removeBackground` option defined in Phase 3, so
  this phase adds no changes to the orchestrator.

#### 4. Download UX

Before the first opaque upload triggers a download, the flow states plainly that a one-time
~45 MB download is needed and that it is stored for next time, then shows determinate
progress from the `progress_callback`. A failed or offline download degrades to a clear
message pointing at the pre-cut PNG path — never a silent failure or a half-processed item.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] Production build succeeds: `npm run build`
- [x] The main bundle does not grow materially — confirm the model and library land in a
      lazily-loaded chunk by inspecting `dist/` output
      (entry `index.js` 15.83 → 15.99 kB; library in `removal.worker.js` 516 kB and
      `ort-wasm-simd-threaded.asyncify.wasm` 22 MB, both worker-only)

#### Manual Verification

- [ ] A pre-cut PNG upload triggers **no** model download at all (Decision 3's whole point)
- [ ] An opaque photo downloads once with visible progress, then produces a clean cutout
- [ ] A second opaque upload in a **new session** does not re-download (Cache API persistence)
- [ ] The cutout composites cleanly over `bg-paper` — no halo, no residual background — and
      overlaps correctly in a saved-outfit card
- [ ] The UI stays responsive during inference (worker is doing its job)
- [ ] Works in Safari on the phone, which is where photos actually come from
- [ ] Going offline mid-download produces a clear message, not a stuck spinner

**Implementation Note**: Pause for manual confirmation before proceeding. If the first-run
download proves unacceptable on mobile, everything in Phases 1–4 still stands and the
pre-cut path remains fully functional.

---

## Phase 6: Delete + Rename

### Overview

Decision 1's management affordances. Uploads only; built-ins stay read-only.

### Changes Required

- `src/features/closet/useClosetStore.ts` — `addUpload`, `removeUpload`, `renameUpload`,
  each writing through `uploadStore` then re-deriving (the `useOutfitsStore.ts:25-38`
  mirror-after-mutation pattern).
- **Revoke the object URL on delete** — `URL.revokeObjectURL(item.image)` — the one piece of
  lifecycle that leaks if forgotten.
- `ClosetPage.tsx` — a ghost delete button on upload tiles only, mirroring
  `OutfitCard.tsx:103-110` (hidden until hover on pointer-fine, always visible on touch),
  behind a `window.confirm` as at `OutfitsPage.tsx:30`. Rename via an inline editable name.
- No bespoke handling for uploads referenced by saved outfits (Decision 10): `isOutfitValid`
  / `repairOutfit` and the existing "Some items are no longer in the closet" caption
  (`OutfitCard.tsx:124-128`) already cover it.

**Why deletion is safe here**: `shuffleBase` throws on an empty base pool and `pickRequired`
throws on empty shoes (`shuffle.ts:24,47`), and `freshOutfit()` runs at store init
(`useShuffleStore.ts:54`). Because built-ins are never deletable, tops/bottoms/shoes can
never reach zero, so that crash site stays unreachable. This is the specific reason
Decision 1 drew the line at built-ins.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] Production build succeeds: `npm run build`

#### Manual Verification

- [ ] Deleting an upload removes it from rails and the closet page immediately
- [ ] It stays gone after a reload
- [ ] A saved outfit wearing a deleted upload shows the "no longer in the closet" caption and
      still loads (repaired), rather than breaking
- [ ] Deleting the only uploaded dress hides the dress toggle and rail again, and the app
      does not crash if a dress was being worn
- [ ] Renaming persists across a reload
- [ ] Built-ins expose no delete or rename affordance anywhere

---

## Testing Strategy

### Unit Tests (node environment, `.ts` only)

- `fitBox` against the 33-row measured fixture — the regression test on the constants.
- `alphaBoundingBox`: empty, single pixel, full-bleed, edge-inclusive.
- `isPreCut` at 0% / 4% / 6% / 60% clear; `isFullLength` at 0.525, 0.689, 1.0, 1.254, 1.584.
- `mergeCloset` / `buildIndex`: append order, first-dress activation, empty uploads.
- `memoryUploadStore`: round-trip, replace, delete, unknown-id.
- `defaultItemName` per category and subtype.

### Integration

No automated integration layer exists in this repo (no DOM, no Playwright), and adding one
is out of scope. The seam is instead verified by the Phase 2 seeding milestone, which
exercises store → merge → render end to end by hand.

### Manual Testing Steps

1. Upload a pre-cut PNG top of each subtype; compare each on the rail against the built-ins.
2. Upload an opaque phone photo; check the cutout over `bg-paper` and in a saved-outfit card.
3. Upload a full-length item and a short item as bottoms; confirm canvas selection and toggle.
4. Upload the first dress; confirm all three gates activate live.
5. Save an outfit wearing an upload; reload; confirm it restores.
6. Delete that upload; confirm graceful degradation on the saved card.
7. Repeat the core path on a phone, in Safari, on cellular.
8. Cycle all five themes on the closet page.

## Performance Considerations

- **Hydration blocks first paint** (Decision 8). Cost is one IndexedDB read plus one
  `createObjectURL` per upload — sub-millisecond at personal-closet scale. If the closet ever
  reached hundreds of items this would deserve re-measuring; it will not.
- **Storage**: normalized 1080-wide PNGs with alpha run roughly 0.5–2 MB each. IndexedDB
  quotas are generous; a quota failure surfaces as a user-facing message rather than a
  silent loss. WebP would roughly halve this and is the named future optimization
  (Decision 10 defers it — Safari cannot encode WebP from canvas).
- **Model download**: ~45 MB once, cached in the Cache API, and only ever triggered by an
  opaque upload. Pre-cut PNGs never pay it.
- **Inference**: multi-second on a phone, which is why it runs in a worker.
- **Bundle**: Transformers.js is dynamically imported, so the main bundle is unaffected —
  verify against `dist/` in Phase 5.

## Migration Notes

Nothing to migrate. The feature is purely additive: the manifest is untouched, no stored
format changes, and every existing key (`joyces-closet:theme:v1`,
`joyces-closet:saved-outfits:v1`, `joyces-closet:current-outfit`) keeps its meaning. A user
with no uploads gets byte-identical behavior through a differently-shaped code path.

The one refactor with blast radius is Phase 2's move of `CLOSET` from `closet.ts` into
`manifest.ts`, plus retargeting `closet.test.ts`. Both are mechanical, and `getCloset()` /
`getItem()` keep their signatures, so no consumer outside the three subscription swaps
changes.

## References

- Research: `thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md`
- Decisions: `thoughts/shared/decisions/2026-07-27-clothing-image-upload.md`
- Prior blueprint: `thoughts/shared/plans/2026-07-13-closet-rebuild.md` (Migration Notes ~line 458)
- The seam and its intent: `src/features/closet/closet.ts:6-10,243-249`
- Rendering contract: `src/components/Rail.tsx:154-159`, `src/features/outfits/OutfitCard.tsx:28-46`
- Frame sizes: `src/features/shuffle/ShufflePage.tsx:10-17`
- Patterns copied: `src/features/outfits/store.ts:15`, `localStorageStore.ts:24-39`,
  `useOutfitsStore.ts:10,18-21`, `themeStorage.ts`
- Test idiom: `src/features/outfits/localStorageStore.test.ts:10-18`

### Measured constants — provenance

Derived 2026-07-27 by decoding all 34 built-in PNGs and computing each garment's alpha
bounding box at threshold 8. Every PNG is 8-bit RGBA, non-interlaced, 1080 px wide, with all
four corners at alpha 0.

| placement | canvas | fillW | fillH | anchor | n | worst error |
|---|---|---|---|---|---|---|
| tops / shirt | 1080×1080 | 0.94 | 0.94 | center | 5 | 0.018 |
| tops / sweater | 1080×1080 | 0.92 | 0.92 | center | 1 | 0.001 |
| tops / tank | 1080×1080 | 0.59 | 0.95 | center | 8 | 0.015 |
| bottoms / full-length | 1080×2000 | 0.94 | 0.87 | top @ 0.03 | 7 | 0.042 |
| bottoms / short | 1080×1080 | 0.89 | 0.88 | top @ 0.08 | 7 | 0.077 |
| dresses | 1080×2000 | 0.92 | 0.92 | center | 0 | derived |
| jackets | 1080×1080 | 0.91 | 0.91 | center | 3 | 0.017 |
| shoes | 1080×1080 | 0.90 | 0.90 | center | 1 | 0.001 |
| accessories | 1080×1080 | 0.81 | 0.81 | center | 1 | 0.003 |

`shirt1.png` (1080×1480) is a known outlier on a non-standard canvas and is excluded from
the fixture. Horizontal centring holds across all 34: centre-x mean 0.507, range 0.487–0.541.
