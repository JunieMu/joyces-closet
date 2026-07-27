---
date: 2026-07-27T13:12:55-05:00
researcher: Joyce Ma
git_commit: 6a7497c43cad344446b20c986f77a3a8e879ac1e
branch: main
repository: joyces-closet
topic: "In-app clothing image upload — with standardized sizing and background removal"
tags: [research, codebase, closet, upload, image-pipeline, background-removal, indexeddb, rendering]
status: complete
last_updated: 2026-07-27
last_updated_by: Joyce Ma
---

# Research: In-app clothing image upload (with standardized sizing + background removal)

**Date**: 2026-07-27 13:12 CDT
**Researcher**: Joyce Ma
**Git Commit**: `6a7497c43cad344446b20c986f77a3a8e879ac1e`
**Branch**: main
**Repository**: joyces-closet

## Research Question

Implement a new feature where clothing images can be uploaded directly through the app. Research the codebase to see how that will plug in — including two supporting tools: (1) standardizing sizing so uploads render correctly on the page, and (2) a background-remover tool.

## Summary

**The architecture was deliberately built to accept this feature.** The closet-rebuild plan ([thoughts/shared/plans/2026-07-13-closet-rebuild.md](../plans/2026-07-13-closet-rebuild.md), Migration Notes ~line 458) names in-app upload as the planned next feature and pre-decides most of the design: uploaded items live in an **IndexedDB store (metadata + image blobs — localStorage is explicitly too small for images)**, get **UUID ids** via `crypto.randomUUID()`, keep `ClosetItem.image` as a plain string (**object URLs for blobs**), and **merge into `getCloset()`'s return value in one place** so shuffle, rails, outfit validation, and saved outfits work unchanged. The plan even pre-identifies the open problem as exactly the two tools requested here: *"the paper-doll look depends on transparent-background cutouts, so uploads need either pre-cut PNGs, client-side background removal (WASM libs run in-browser, fits the no-backend constraint), or a different rendering style."*

Three workstreams fall out of the code:

1. **Make the closet source dynamic + reactive.** `getCloset()`/`getItem()` ([closet.ts:243-249](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L243-L249)) are the designed seam, but today `CLOSET` is a module constant, `ITEMS_BY_ID` is built once at import, and React components call `getCloset()` inline with no subscription — a runtime mutation would never re-render. Uploaded items need a Zustand-backed closet source, and the app's startup shuffle (which **throws** on an undressable closet) must stay safe.
2. **Standardize uploads to the implicit rendering contract.** Rendering uses `object-contain` in height-driven frames with **no per-item CSS** — so an item's on-screen size is encoded entirely in its PNG: canvas **width 1080**, category-specific aspect ratio (1:1 for most; 1080×2000 for full-length pants), **genuinely transparent RGBA background** (all 34 built-ins verified), consistent garment-fill ratio, horizontal centering, and top/waist anchoring for bottoms. The sizing-standardization tool = client-side canvas pipeline that trims to the garment's bounding box, then pads/centers onto the right category canvas.
3. **Background removal is required, not optional.** Every built-in PNG is a transparent cutout; garments composite over paper texture and overlap in saved-outfit cards. Client-side WASM background removal is the pre-identified approach that fits the no-backend constraint (a deliberate exception to the "no new dependencies" UI convention).

Persistence and UI both have exact templates to copy: the `OutfitStore` interface + injected-implementation pattern, `joyces-closet:<domain>:v1` key naming, never-throw storage reads, a third route in `main.tsx` plus nav links in **both** navs in `Layout.tsx`, and the semantic theme tokens (`bg-paper` / `text-accent` / `bg-wash`) with the pill/soft-rectangle/popover component vocabulary.

## Detailed Findings

### 1. The designed integration seam — closet data model

- `ClosetItem` — [src/features/closet/types.ts:4-12](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/types.ts#L4-L12): `{ id, name, category, image: string, tags?, jacketCompatible? }`. `image` is a plain string consumed verbatim as `<img src>` — **any valid `src` works, including `blob:` object URLs**; nothing requires the path to live under `public/`.
- `ItemCategory` — [types.ts:1-2](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/types.ts#L1-L2): `"tops" | "bottoms" | "dresses" | "jackets" | "shoes" | "accessories"`. `Closet` = `Record<ItemCategory, ClosetItem[]>` ([types.ts:14](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/types.ts#L14)).
- The manifest `CLOSET` ([closet.ts:12-235](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L12-L235)) and lookup map `ITEMS_BY_ID` ([closet.ts:237-241](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L237-L241)) are **not exported**. Only `getCloset()` and `getItem(id)` are ([closet.ts:243-249](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L243-L249)). The doc comment at [closet.ts:6-10](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L6-L10) explicitly calls this "the seam for the planned in-app-upload feature: uploaded items merge into `getCloset()`'s return value in one place."
- Shuffle logic ([src/features/shuffle/shuffle.ts](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/shuffle/shuffle.ts)) is **pure** — the closet is always passed in as an argument, never fetched. Merged uploads flow through automatically.
- Saved outfits reference items **by id only** ([src/features/shuffle/outfit.ts:4-13](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/shuffle/outfit.ts#L4-L13)), never by image path. UUID ids for uploads (same `crypto.randomUUID()` pattern as saved outfits, [useOutfitsStore.ts:27](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/outfits/useOutfitsStore.ts#L27)) can't collide with the hand-authored `top-shirt-1`-style ids.
- Validation/repair already handles items disappearing: `isOutfitValid` ([outfit.ts:57-76](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/shuffle/outfit.ts#L57-L76)) and `repairOutfit` ([outfit.ts:86-108](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/shuffle/outfit.ts#L86-L108)) substitute or drop missing ids. **Deleting an uploaded item later reuses this machinery for free** — a saved outfit referencing it degrades gracefully instead of showing a broken image.

### 2. Runtime-dynamism gaps the feature must close

These are the concrete places where "static manifest" assumptions live:

| Gap | Location | Why it matters |
|---|---|---|
| `ITEMS_BY_ID` built once at import | [closet.ts:237-241](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L237-L241) | `getItem()` would return `undefined` for uploads → OutfitCard thumbnails and shuffle-store rehydration miss them |
| `getCloset()` returns a non-reactive singleton | [closet.ts:243-245](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L243-L245) | `ShufflePage.tsx:29`, `OutfitActions.tsx:30`, `OutfitCard.tsx` call it inline during render with no subscription — adding an item would not re-render anything. Uploads need a Zustand-backed closet source (or a closet-version subscription) |
| Startup shuffle can throw | `freshOutfit()` at [useShuffleStore.ts:22-24](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/shuffle/useShuffleStore.ts#L22-L24) runs at store init (line 54); `shuffleBase` throws on empty base pool, `pickRequired` throws on empty shoes ([shuffle.ts:24,47](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/shuffle/shuffle.ts#L24)) | Safe today (manifest guarantees tops/bottoms/shoes); stays safe as long as uploads only **add**. If item deletion is ever in scope, this is the crash site |
| Async IndexedDB vs. synchronous closet | All consumers assume `getCloset()` is synchronous at module load | Uploaded items must be hydrated (blobs → object URLs) before or gracefully after first render; the merged closet must be available synchronously once hydrated |
| Dresses activate via three independent gates | Shuffle probability ([shuffle.ts:43-59](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/shuffle/shuffle.ts#L43-L59)); toggle visibility `hasDresses` ([OutfitActions.tsx:59,76](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/components/OutfitActions.tsx#L59)); dress rail render (`ShufflePage.tsx:103-119`) | Uploading the **first dress** ever is the real reactivity test — all three must flip live. `dresses: []` today ([closet.ts:193-195](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/closet/closet.ts#L193-L195)) |
| Manifest integrity tests assume disk files | `closet.test.ts:36-48` asserts every `image` starts with `/images/<category>/` and exists on disk | Tests must keep applying to the **static manifest only**, not the merged closet — uploads use `blob:` URLs |
| Rail hides when empty | `positions.length === 0 → return null` ([Rail.tsx:71-72](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/components/Rail.tsx#L71-L72)) | Benign for additive uploads; relevant if deletion ships |

### 3. The rendering contract — what "standardized sizing" must produce

There are exactly **two** garment `<img>` sites, both `object-contain`, both with **zero per-item CSS**:

- **Rails** ([Rail.tsx:154-159](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/components/Rail.tsx#L154-L159)): `max-h-full object-contain` inside a height-driven frame. Frame heights from `ShufflePage.tsx:10-17` — tops/jackets `h-52 sm:h-64`, bottoms `h-80 sm:h-96` (+ width cap `max-w-[min(12rem,100%)] sm:max-w-[min(15rem,100%)]` + `align="top"` waist anchor), dresses `h-80 sm:h-96`, shoes/accessories `h-28 sm:h-32`. On-screen width = frame height × (imgW/imgH).
- **Saved-outfit cards** ([OutfitCard.tsx:28-46](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/outfits/OutfitCard.tsx#L28-L46)): absolutely-positioned percentage boxes inside an `aspect-3/4` mini paper doll (e.g. top `top-0 right-0 h-[46%] w-[58%]`, bottom `top-[42%] ... w-[64%]`) — garments **overlap**, so opaque backgrounds would occlude neighbors.

**Consequence:** an item's rendered size/position is encoded entirely in its PNG — aspect ratio, how much of the canvas the garment fills, and where it sits on the canvas. That's the spec for the standardization tool:

| Property | Standard (measured from all 34 built-ins) |
|---|---|
| Canvas width | **1080 px, always** |
| Aspect ratio | 1:1 (1080×1080) for tops, jackets, shoes, accessories, shorts, skirts; **1080×2000** for full-length pants; one tolerated outlier (`shirt1.png` 1080×1480) shows minor variance is survivable |
| Format | PNG, RGBA (color-type 6), 8-bit |
| Background | **Genuinely transparent** — sampled corners alpha=0 on every category (34/34 have alpha) |
| Garment placement | Horizontally centered; consistent fill ratio; bottoms anchored to top edge (waistline) since the rail uses `align="top"` |

**Standardization pipeline implied by the data:** decode upload → remove background → compute garment alpha bounding box → trim → scale to a target fill ratio → composite centered (top-anchored for bottoms) onto the category's standard canvas (1080×1080 or 1080×2000) → export PNG blob. Without fill-ratio normalization, a garment photographed small-in-frame renders visibly smaller than its rail-mates even at identical canvas size.

- No global CSS touches `img` (`src/index.css` has no image rules beyond Preflight); `.paper-doll` grid ([index.css:203-225](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/index.css#L203-L225)) positions rails with column ratios tuned to these aspect ratios.
- **No canvas, FileReader, file input, object-URL, or IndexedDB code exists anywhere in `src/` today** (confirmed by exhaustive grep) — the pipeline is greenfield.

### 4. Background removal — required, and pre-scoped

- Every built-in is a transparent cutout; the "paper-doll" aesthetic and the overlapping card boxes depend on it. A raw photo with background would render as an opaque rectangle over the paper texture and occlude neighbors in cards.
- The closet-rebuild plan (Migration Notes, `thoughts/shared/plans/2026-07-13-closet-rebuild.md:458`) already names the options: pre-cut PNGs, **client-side background removal (WASM, in-browser — fits the no-backend/static-Vercel constraint)**, or a different rendering style for raw photos. Client-side WASM (e.g. an ONNX-based segmentation lib) is the only option that delivers "upload any photo" without a backend.
- Theme caveat: `thoughts/shared/decisions/2026-07-17-ui-artistic-polish.md:48` notes garment PNGs assume **light backgrounds** — all five themes are light presets, so cutouts composite fine, but the remover's output (soft edges/halos) should be previewed against `bg-paper`/tints before saving.
- Prior UI projects enforced "no new dependencies" — a background-removal WASM lib is a deliberate, justified exception (it's a feature project, not a UI polish project; all three prior docs scoped themselves as "UI-only, no closet-content changes").

### 5. Persistence — where uploaded images live

- **Pre-decided: IndexedDB, not localStorage** — "localStorage is too small for images" (plan `:458`). Metadata + image `Blob`s in IndexedDB; at hydration, blobs become object URLs assigned to `ClosetItem.image` (which stays `string`).
- **Pattern to copy** — the interface + injected-implementation idiom:
  - `OutfitStore` interface (`list`/`save`/`delete`) at [store.ts:15](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/outfits/store.ts#L15) with one implementation-selection line ([useOutfitsStore.ts:10](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/outfits/useOutfitsStore.ts#L10)).
  - Never-throw reads that validate & filter per entry ([localStorageStore.ts:24-39](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/outfits/localStorageStore.ts#L24-L39)); the theme module ([themeStorage.ts](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/features/theme/themeStorage.ts)) is the minimal template.
  - Zustand store mirrors the storage into React by re-reading after each mutation — **no persist middleware for stored collections** (comment at `useOutfitsStore.ts:18-21`).
  - Key naming: `joyces-closet:<domain>:v1` (existing keys: `joyces-closet:theme:v1`, `joyces-closet:saved-outfits:v1`, `joyces-closet:current-outfit`).
- Existing stores: `useShuffleStore` (persist middleware, current outfit only), `useOutfitsStore`, `useThemeStore`, `useCascade` (ephemeral). The upload feature adds a fifth — an uploaded-items store that the closet seam consumes.

### 6. UI integration points

- **Routing** ([src/main.tsx:10-17](https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/src/main.tsx#L10-L17)): two routes today (`/` ShufflePage, `/outfits` OutfitsPage). An add-clothes page slots in as a third child under `Layout`; `vercel.json`'s SPA rewrite already covers it.
- **Nav is duplicated** — desktop sidebar (`Layout.tsx:40-47`) and mobile header (`Layout.tsx:75-83`) both hardcode links; a new entry must be added to **both** (shared styling via `navLinkClass`, `Layout.tsx:7`).
- **Design system (current, theme-aware era)**: use semantic tokens only — `bg-paper`, `text-ink`, `text-accent`, `bg-wash`, per-category `--color-tint-<category>` — never literal color names (the rosewood-era names were renamed). Component vocabulary: primary/secondary pills, `rounded-2xl` hairline-border surfaces, ghost icon buttons, `paper-card`, `sketchy-slot`, `animate-pop-in`. The anchored-popover pattern in `OutfitActions.tsx` (canvas never reflows) is the precedent for lightweight dialogs; a multi-step upload flow (pick file → remove background → preview/adjust → categorize → save) likely warrants the new page instead.
- Accent remains the **only** action color; category tints can distinguish the category picker.

### 7. Testing implications

- Vitest runs in **`environment: "node"`** with an `src/**/*.test.ts` glob (`vite.config.ts:5-13`) — no DOM, no IndexedDB, `.ts` only. So: keep the image-pipeline math (bounding-box, scaling, canvas-target selection) and store logic in pure `.ts` modules; test the IndexedDB store through an injected adapter interface (mirroring `StorageLike` at `localStorageStore.ts:6` and the `fakeStorage()` pattern in `localStorageStore.test.ts:10-18`). Canvas/WASM steps won't be unit-testable in this environment — isolate them behind small interfaces.
- `closet.test.ts` deliberately never asserts item counts ("adding clothes must never churn tests") — uploads preserve that property since they don't touch the manifest.

## Code References

- `src/features/closet/types.ts:4-12` — `ClosetItem` (id, name, category, image string, reserved `tags`/`jacketCompatible`)
- `src/features/closet/closet.ts:6-10` — doc comment naming this exact feature and the seam
- `src/features/closet/closet.ts:237-249` — `ITEMS_BY_ID` (static, must become merge-aware) + `getCloset()`/`getItem()`
- `src/features/shuffle/shuffle.ts:23-27,43-59` — empty-pool throw + pool-proportional dress math
- `src/features/shuffle/useShuffleStore.ts:22-24,54,101-106` — startup shuffle at store init; rehydration validation
- `src/features/shuffle/outfit.ts:57-76,86-126` — `isOutfitValid` / `repairOutfit` (id-based, reusable for upload deletion)
- `src/components/Rail.tsx:56-57,71-72,138-159` — height-driven `object-contain` rendering, empty-rail hiding
- `src/features/shuffle/ShufflePage.tsx:6-17` — per-category frame sizes + bottoms width cap/top anchor
- `src/features/outfits/OutfitCard.tsx:28-46,53-84` — overlapping % boxes (why transparency is mandatory)
- `src/features/outfits/store.ts:15` + `localStorageStore.ts:4,24-39` — interface + never-throw storage template
- `src/features/theme/themeStorage.ts` + `useThemeStore.ts` — minimal storage-module + store idiom
- `src/main.tsx:10-17`, `src/components/Layout.tsx:40-47,75-83` — routing + duplicated navs
- `src/index.css:203-225` — `.paper-doll` grid tuned to built-in aspect ratios
- Permalink base: `https://github.com/JunieMu/joyces-closet/blob/6a7497c43cad344446b20c986f77a3a8e879ac1e/`

## Architecture Insights

1. **The seam is real but only half-built.** Encapsulation (`getCloset()`/`getItem()`, unexported manifest) makes the merge a one-file change, but the module is static and non-reactive — the actual work is making the closet source **reactive** (Zustand-backed merged closet) without breaking the synchronous access every consumer assumes.
2. **Sizing is data, not CSS.** The app has no per-item styling; the PNG canvas *is* the layout contract (1080-wide, category aspect, fill ratio, anchoring). "Standardized sizing" is therefore an upload-time canvas-normalization step, not a rendering change.
3. **Transparency is load-bearing.** Overlapping card boxes + paper-texture compositing make background removal a correctness requirement, not a nice-to-have.
4. **Ids are the contract, images are ephemeral.** Outfits store ids only; validation/repair already tolerates vanished items. Object URLs (which change every session) are safe because nothing persists an image path — only ids.
5. **Every needed pattern has an in-repo template**: interface + injected impl (`OutfitStore`), never-throw storage (`themeStorage`), store-mirror (`useOutfitsStore`), key naming, injected fakes for tests, dormant-until-content UI (the dress toggle — which uploading the first dress will finally activate).

## Historical Context (from thoughts/)

- `thoughts/shared/decisions/2026-07-13-closet-rebuild.md` — Decision 1: "In-app photo upload is explicitly a later feature"; Decision 3: manifest chosen for v1, "item model designed so B [in-app upload] is purely additive later"; Decision 6: closet items deliberately *not* behind the storage interface (static manifest), saved outfits behind `OutfitStore`.
- `thoughts/shared/plans/2026-07-13-closet-rebuild.md` — line ~235: the `getCloset()` seam design; **line ~458 (Migration Notes): the blueprint for this feature** — IndexedDB blobs, object URLs, UUID ids, merge into `getCloset()`, and image prep (transparent cutouts via in-browser WASM background removal) flagged as the one open design question.
- `thoughts/shared/decisions/2026-07-13-ui-redesign.md` + plan — component vocabulary (pills, `rounded-2xl` surfaces, ghost icons, anchored popover that never reflows the canvas), sidebar/bottom-bar action shell, CSS-only animation.
- `thoughts/shared/decisions/2026-07-17-ui-artistic-polish.md` + plan — semantic token rename (`paper`/`ink`/`accent`/`wash` + category tints); accent is the sole action color; five light themes; garment PNGs assume light backgrounds; "no new dependencies" scoped to UI projects; all three UI projects explicitly excluded "garment image re-processing or closet content changes" — this feature is the first to cross that line, as its own additive `src/features/` module.

## Related Research

None — this is the first document in `thoughts/shared/research/`.

## Open Questions

1. **Background-removal engine choice**: in-browser WASM/ONNX lib (e.g. `@imgly/background-removal`) vs. "require pre-cut PNGs" fallback vs. an external API (conflicts with no-backend). Bundle size and first-run model download (tens of MB) need weighing; lazy-load only on the upload page.
2. **Fill-ratio normalization targets**: what per-category fill percentage and margins match the built-ins? (Measure the built-ins' garment bounding boxes to derive targets.) Should users get a manual scale/nudge step after auto-normalization?
3. **Category detection**: user picks the category explicitly (simplest, matches manifest semantics) — or infer from aspect ratio? Pants vs. shorts changes the target canvas (1080×2000 vs 1080×1080).
4. **Scope: add-only or full closet management?** Deletion/editing of uploaded items pulls in the empty-pool hazards (§2) — repair machinery exists, but the startup-shuffle throw and disappearing rails need guards if the last shoe can be deleted.
5. **Object URL lifecycle**: recreate from blobs at each app start (hydration step), revoke on delete; does hydration need a loading state before the first `getCloset()` call, or is a "static first, uploads pop in" render acceptable?
6. **Input formats**: iPhone HEIC support? EXIF orientation? (Canvas `drawImage` handles orientation in modern browsers via `createImageBitmap` options.)
7. **Storage pressure**: normalized 1080-wide PNGs with alpha run ~0.5–2 MB each; IndexedDB quotas are generous but not infinite — compress (e.g. re-encode at capped dimensions) and surface storage errors via the never-throw idiom.
