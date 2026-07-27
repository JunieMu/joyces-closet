---
date: 2026-07-27
source: grill-to-decisions
input: thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md
status: decided
---

# Design Decisions: In-app clothing image upload

Feature: upload a photo of a piece of clothing in the app; it becomes a transparent paper-doll cutout living alongside the 34 built-in items — shuffled, re-rolled, saved into outfits, indistinguishable from the hand-prepared PNGs. Two supporting tools: automatic background removal and sizing standardization.

Architecture inherited from the closet-rebuild plan (treated as settled, re-confirmed here): IndexedDB store for metadata + image blobs, UUID ids via `crypto.randomUUID()`, `ClosetItem.image` stays a string carrying an object URL, uploaded items merge into `getCloset()`'s return value in one place (`src/features/closet/closet.ts:6-10` names this seam explicitly).

## Decision 1: Scope — add + manage uploads, built-ins untouchable

**Context**: Once adding exists, "that cutout looks bad, delete it" arrives immediately. Full management (hiding/deleting built-ins) pulls in empty-pool crash hazards (`shuffle.ts:24,47` throws; startup shuffle at `useShuffleStore.ts:54`).
**Options**: A — add-only MVP (bad uploads pile up) · B — add + delete/rename of uploaded items only · C — full management incl. built-ins (crash-hazard scope jump)
**Decision**: **B.** Uploads can be deleted and renamed; built-ins are read-only. Because built-ins guarantee tops/bottoms/shoes are never empty, the startup-crash hazard never materializes and existing repair machinery (`outfit.ts:86-126`) gracefully degrades saved outfits referencing deleted uploads. Recategorizing an upload is out of scope (it would require re-normalization onto a different canvas — delete and re-upload instead).

## Decision 2: Device-local persistence is accepted

**Context**: IndexedDB is per-browser — phone uploads won't appear on the laptop, same as saved outfits today.
**Options**: A — accept device-locality, consistent with the app's persistence stance · B — build a backend now for cross-device sync
**Decision**: **A.** Consistent with everything else in the app; the interface + injected-implementation pattern keeps the backend swap open as a future one-file change.

## Decision 3: Background removal — auto-detect, run only when needed

**Context**: All 34 built-ins are genuinely transparent RGBA cutouts; overlapping card boxes (`OutfitCard.tsx:53-84`) make transparency a correctness requirement. Joyce already has a pre-cut PNG workflow.
**Options**: A — always run the remover (re-processes already-transparent PNGs) · B — detect alpha, skip remover for transparent uploads, run it on opaque photos · C — manual toggle only
**Decision**: **B.** Inspect the upload's alpha channel; already-transparent images skip straight to normalization, opaque photos go through the remover. The preview step always shows the result before saving.

**Engine posture (binding)**: in-browser WASM/ONNX, lazy-loaded only when an opaque image is actually uploaded — no API, no backend. One new runtime dependency is a deliberate, accepted exception to the UI projects' "no new dependencies" convention. Recommended package: `@imgly/background-removal`; the planner validates it (bundle/model size, license, Safari support) and may substitute an equivalent in-browser lib if materially better — the behavior contract above is what's binding, not the package name.

## Decision 4: UI home — new third page, `/closet`

**Context**: The flow is multi-step (pick → cut out → normalize → preview → categorize → name → save); the anchored-popover pattern (`OutfitActions.tsx`) is too cramped. Routing today is two pages (`main.tsx:10-17`); nav links are duplicated across desktop sidebar and mobile header (`Layout.tsx:40-47`, `75-83`).
**Options**: A — new `/closet` page with nav entries in both navs · B — popover off the shuffle page
**Decision**: **A.** A Closet page hosts the upload flow and gives delete/rename a natural home. Nav entry added to **both** navs. Styling follows the semantic token system (`bg-paper`/`text-ink`/`text-accent`/`bg-wash`, category tints) and the established component vocabulary.

## Decision 5: Sizing normalization is fully automatic

**Context**: Rendered size is encoded entirely in the PNG (object-contain, height-driven frames, zero per-item CSS). Built-ins: 1080px wide always; 1:1 canvas for tops/jackets/shoes/accessories/shorts/skirts; 1080×2000 for full-length pants; horizontally centered; bottoms waist-anchored (rail uses `align="top"`, `ShufflePage.tsx:146-148`).
**Options**: A — fully auto: trim to alpha bbox → scale to per-category fill target → center (waist-anchor bottoms) → composite onto category canvas · B — auto + manual scale/nudge slider
**Decision**: **A.** Deterministic pipeline, no adjustment UI in this slice. Per-category fill/anchor constants are **derived by measuring the built-in PNGs' actual garment bounding boxes** (planner/implementation does the measuring and hardcodes the constants). The preview renders the normalized item **at real rail scale** so a misfit is obvious before saving. If auto misjudges real photos in practice, a nudge slider is a clean later addition.

## Decision 6: Bottoms canvas is inferred, with a preview toggle

**Context**: Bottoms are the one category with two canvases (1080×1080 shorts/skirts vs 1080×2000 pants). After cutout, the garment's own aspect ratio is known.
**Options**: A — infer from cutout aspect (tall → pants canvas) + a "full-length" toggle shown only for bottoms in the preview step · B — always ask a length question
**Decision**: **A.** Inference with the toggle as the recourse — the cheap safety valve given Decision 5 removed general manual adjustment.

## Decision 7: Category is explicitly user-chosen

**Context**: Everything downstream keys off `ItemCategory`; the normalization canvas depends on it. Inference from image shape is unreliable across categories (a 1:1 cutout could be five different things).
**Decision**: The user picks the category in the upload flow (category tint tokens may style the picker; accent remains the only action color). Only the bottoms length sub-question is inferred (Decision 6).

## Decision 8: Hydration blocks first render

**Context**: `useShuffleStore` validates the persisted current outfit against `getCloset()` synchronously at module init (`useShuffleStore.ts:101-106`, init at `:54`). If uploads hydrate async and the saved current outfit wears an uploaded item, startup would silently discard it and re-shuffle.
**Options**: A — await IndexedDB hydration (blobs → object URLs → merged closet) in `main.tsx` before mounting React; milliseconds of cost · B — pop-in with deferred re-validation (more moving parts, invisible gain)
**Decision**: **A.** Correctness-before-first-paint, same precedent as the theme system's pre-paint script. After hydration, `getCloset()`/`getItem()` remain synchronous for all consumers; the closet source becomes reactive (Zustand-backed) so adding/deleting uploads re-renders live — including flipping all three dress gates when the first dress is uploaded.

## Decision 9: The `/closet` page shows the whole wardrobe

**Options**: A — built-ins + uploads grouped by category; uploads get delete/rename affordances, built-ins render read-only · B — uploads only (a "closet" page hiding 34 of 37 items feels broken)
**Decision**: **A.** It becomes *the closet*, which is what the nav word promises.

## Decision 10: Minor calls (locked)

- **Stored format**: PNG blobs on the standard 1080-wide canvas (Safari can't encode WebP from canvas; personal-closet scale makes size a non-issue; WebP is a future optimization, not now).
- **Accepted inputs**: standard image types (`image/png`, `image/jpeg`, `image/webp`); no special HEIC handling — iOS auto-converts HEIC→JPEG on upload.
- **Naming**: uploads get an editable default name in the built-ins' style, matching the outfit auto-naming idiom (`defaultOutfitName`, date-suffixed); renameable later from the closet page (Decision 1).
- **Deletion semantics**: no bespoke handling for uploads referenced by saved outfits — existing validation/repair (`isOutfitValid`/`repairOutfit`) and the "Some items are no longer in the closet" caption (`OutfitCard.tsx:124-128`) already cover it.

## Codebase Findings

Full detail in `thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md`. The load-bearing facts for the planner:

- **The seam**: `getCloset()`/`getItem()` are the only exports (`closet.ts:243-249`); the doc comment at `closet.ts:6-10` names this feature. But `ITEMS_BY_ID` is built once at import (`closet.ts:237-241`) and `getCloset()` returns a non-reactive singleton — consumers (`ShufflePage.tsx:29`, `OutfitActions.tsx:30`, `OutfitCard.tsx`) call it inline with no subscription. The merge must be reactive.
- **Three dress gates** must flip live on first uploaded dress: shuffle probability (`shuffle.ts:43-59`), toggle visibility (`OutfitActions.tsx:59,76`), dress rail (`ShufflePage.tsx:103-119`). `dresses: []` today (`closet.ts:193-195`).
- **Rendering contract**: two `<img>` sites only (`Rail.tsx:154-159`, `OutfitCard.tsx:28-46`), both `object-contain`, zero per-item CSS. Frame sizes at `ShufflePage.tsx:10-17`; bottoms width cap + `align="top"`.
- **Built-in measurements**: 34 PNGs, all 1080 wide, all genuinely transparent RGBA. 1:1 except pants (1080×2000, all 7) and one tolerated outlier (`shirt1.png` 1080×1480).
- **Patterns to copy**: `OutfitStore` interface + one-line implementation selection (`store.ts:15`, `useOutfitsStore.ts:10`); never-throw validated reads (`localStorageStore.ts:24-39`, `themeStorage.ts`); store mirrors persistence by re-reading after mutations (no persist middleware for collections); key idiom `joyces-closet:<domain>:v1`.
- **Tests**: Vitest `environment: "node"`, glob `src/**/*.test.ts` (`.ts` only — vite.config.ts:5-13). No DOM/IndexedDB/canvas in tests: keep pipeline math and store logic in pure `.ts` modules behind injected adapters (mirror `StorageLike` + `fakeStorage()` in `localStorageStore.test.ts:10-18`). `closet.test.ts:36-48` disk-existence assertions must stay scoped to the static manifest, not the merged closet.

## Left to the planner

- Validate `@imgly/background-removal` (size, license, Safari/WASM support, model download UX — progress indication while the model fetches) or pick the equivalent; behavior contract in Decision 3 is binding.
- Measure built-ins' garment bounding boxes → derive and hardcode per-category fill/anchor constants (Decision 5).
- Exact upload-flow step ordering/UI, closet-page layout, IndexedDB schema and DB/store naming (follow the `joyces-closet:` idiom), object-URL lifecycle details (create on hydrate, revoke on delete).
- Inference threshold for the bottoms canvas (Decision 6).

## Out of Scope

- Backend, accounts, cross-device sync (interface pattern keeps the swap open).
- Editing, hiding, or deleting built-in manifest items; migrating built-ins into the upload store.
- Manual scale/nudge adjustment in the preview (named as the future add if auto-normalization misjudges).
- Recategorizing an uploaded item (delete + re-upload instead).
- WebP storage optimization; HEIC decoding.
- Tags / `jacketCompatible` metadata on uploads (fields stay reserved, unused — same as built-ins).
