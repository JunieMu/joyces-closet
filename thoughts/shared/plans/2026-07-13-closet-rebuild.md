# Joyce's Closet — From-Scratch Rebuild Implementation Plan

## Overview

Rebuild the static HTML/Bootstrap closet-shuffle app as a React + Vite + TypeScript SPA with two routes — `/` (paper-doll shuffle with browsable rails) and `/outfits` (saved outfit cards) — keeping the existing pastel visual identity as a Tailwind v4 token set. All design decisions come from `thoughts/shared/decisions/2026-07-13-closet-rebuild.md`; this plan turns them into buildable phases.

## Current State Analysis

The entire app is 3 files at the repo root, no build system:

- `index.html` — 5 hardcoded Bootstrap carousels (tops, jackets, bottoms, accessories, shoes); jacket optionality hacked via `images/none.png` as carousel slot 1 of 4 (`index.html:123-125`)
- `index.js` — 4 shuffle functions that set `data-bs-slide-to` to a random index
- `styles.css` — palette + fonts worth preserving as tokens (`styles.css:1-69`)

**Image inventory** (excluding `none.png`, `*test.png`, `.DS_Store`):

| Category | Files | Count |
|---|---|---|
| tops | shirt1–6, tank1–8, sweater1 | 15 |
| bottoms | pants1–7, skirt1–3, shorts1–4 | 14 |
| jackets | jacket1–3 | 3 |
| shoes | shoes1 | 1 |
| accessories | bag1 | 1 |
| dresses | — | 0 |

**Visual identity to preserve as tokens** (from `styles.css`):
- Pink `#facfcf` (header bg), `#ffe8e8` (button fill), accent `#cf7878` (button border/text, nav links)
- Blue `#8ba9e0` (h1, carousel arrows), `#d2dae9` (secondary blue), yellow `#fef0d6`
- Playfair Display (headings, weight 500), Montserrat (body/buttons)

**Environment**: Node 25.5 / npm 11.8 installed. Git repo on `main`; old files are preserved in history after deletion.

## Desired End State

A Vite SPA at the repo root where:

- `npm run dev` serves the app; `/` shows a mobile-first paper-doll stack with per-slot browsable rails, per-slot shuffle, and Shuffle All
- Saving an outfit (optional name, defaulting to e.g. "Outfit · Jul 13") makes it appear on `/outfits` as a card with a mini stacked preview; tapping loads it back into the shuffle view; delete works; everything survives reload
- `npm test` passes Vitest suites covering shuffle rules, slot model, manifest integrity, and the outfit store
- `npm run build`, `lint`, `typecheck` all pass; the `dist/` output is a standard Vite SPA deployable to Vercel with zero extra ceremony

### Key Discoveries & Decisions Carried In

- Old jacket shuffle gave "no jacket" uniform 1-in-(N+1) odds (`none.png` as a slot). **User confirmed 2026-07-13**: keep this — optional slots (jacket, accessory) shuffle uniformly over `items + none`. No sentinel images; "none" lives in the model.
- Dress support (Decision 7/8) is fully modeled and unit-tested, but with 0 dress images the dress/separates toggle stays hidden in v1 UI. Adding one PNG + one manifest entry activates it.
- Zustand `persist` middleware handles the *current outfit* only. *Saved outfits* go exclusively through the `OutfitStore` interface (Decision 6) — persist middleware never touches them, so a future backend swap touches one file.

## What We're NOT Doing

(From the decisions doc's Out of Scope — restated to prevent creep)

- In-app upload / closet-management UI (item model must not block it; it doesn't — items are plain data)
- Jacket-compatibility-weighted shuffle (schema reserves `jacketCompatible?` room; no logic)
- Calendar planning
- Cross-device sync / backend / auth
- Tags or notes on saved outfits
- Component/E2E tests — Vitest covers domain logic only
- Actually deploying to Vercel (configured for it; deployment itself is not a v1 blocker)

## Implementation Approach

Four phases, each independently verifiable: scaffold boots → domain tests pass → shuffle page works in browser → outfits round-trip. Domain logic (shuffle, slot model, store) is plain TS with injected RNG/storage so it's testable without a DOM and survives future UI changes (Decision 12).

**Target file layout** (established in Phase 1, filled in by later phases):

```
public/images/<category>/*.png     # moved from images/, minus none.png & *test.png
src/
  main.tsx                         # router + entry
  index.css                        # Tailwind v4 import + @theme tokens
  components/
    Layout.tsx                     # pink header, nav (Home / Outfits), <Outlet/>
    Rail.tsx                       # arrow+swipe rail (Phase 3)
  features/
    closet/
      types.ts                     # ItemCategory, ClosetItem
      closet.ts                    # typed manifest + lookup helpers
      closet.test.ts               # manifest integrity
    shuffle/
      outfit.ts                    # Outfit slot model (discriminated union)
      shuffle.ts                   # shuffleOutfit / shuffleSlot, injected RNG
      shuffle.test.ts
      useShuffleStore.ts           # Zustand + persist (current outfit only)
      ShufflePage.tsx              # (Phase 3)
    outfits/
      store.ts                     # SavedOutfit, OutfitStore interface
      localStorageStore.ts         # v1 implementation (injectable Storage)
      localStorageStore.test.ts
      useOutfitsStore.ts           # Zustand view over OutfitStore
      OutfitsPage.tsx              # (Phase 4)
      OutfitCard.tsx               # (Phase 4)
  lib/
    rng.ts                         # Rng type + default
vercel.json                        # SPA rewrite for react-router
```

---

## Phase 1: Scaffold, Tokens, Router Shell

### Overview

Replace the static app with a booting Vite + React + TS skeleton at the repo root: Tailwind v4 tokens carrying the pastel identity, react-router with both routes rendering placeholder pages inside the pink-header layout, ESLint/Prettier/Vitest wired, images migrated to `public/`.

### Changes Required:

#### 1. Remove old app, migrate images

```bash
git rm index.html index.js styles.css
git mv images public/images
git rm public/images/none.png public/images/tops/toptest.png \
  public/images/bottoms/bottomstest.png public/images/jackets/jackettest.png \
  public/images/shoes/shoestest.png
find public/images -name .DS_Store -delete
```

Add a `.gitignore` (node_modules, dist, .DS_Store — also stop tracking the root `.DS_Store`).

#### 2. Project scaffold

**File**: `package.json`
**Changes**: New — dependencies: `react`, `react-dom`, `react-router`, `zustand`; dev: `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `eslint` (flat config) + `typescript-eslint` + `eslint-plugin-react-hooks`, `prettier`. Scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc -b --noEmit"
  }
}
```

**File**: `vite.config.ts` — `@vitejs/plugin-react` + `@tailwindcss/vite`; inline Vitest config (`test: { environment: 'node' }` — domain tests need no DOM; storage is injected).

**File**: `tsconfig.json` — strict mode on (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`), standard Vite React project references setup.

**Files**: `eslint.config.js`, `.prettierrc` — typescript-eslint recommended + react-hooks; Prettier defaults.

#### 3. Design tokens (Tailwind v4 CSS-first)

**File**: `src/index.css`

```css
@import "tailwindcss";

@theme {
  --color-blush: #facfcf;        /* header bg */
  --color-blush-light: #ffe8e8;  /* button fill */
  --color-rose: #cf7878;         /* accent: borders, button text, nav */
  --color-periwinkle: #8ba9e0;   /* headings, rail arrows */
  --color-mist: #d2dae9;         /* secondary blue */
  --color-cream: #fef0d6;
  --font-display: "Playfair Display", serif;
  --font-body: "Montserrat", sans-serif;
}
```

**File**: `index.html` — Vite entry; keep the Google Fonts `<link>`s for Playfair Display + Montserrat (same as old app); title "Joyce's Closet"; `<div id="root">`.

#### 4. Router shell

**File**: `src/main.tsx` — `createBrowserRouter`: `Layout` route wrapping `/` → `ShufflePage` (placeholder `<h1>What am I wearing today?</h1>`) and `/outfits` → `OutfitsPage` (placeholder).

**File**: `src/components/Layout.tsx` — pink (`bg-blush`) header bar: "Joyce's Closet" brand left, nav links (Home, Outfits) in `text-rose font-body`; `<Outlet />` below. Mobile-first: links fit a small screen without wrapping awkwardly.

#### 5. Vercel readiness

**File**: `vercel.json`

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Success Criteria:

#### Automated Verification:

- [x] `npm run build` passes (tsc + vite build)
- [x] `npm run lint` passes
- [x] `npm run typecheck` passes
- [x] `npm test` passes (no tests yet — exits clean, `--passWithNoTests` if needed)
- [x] Old files gone, images present: `test ! -f index.js && test -f public/images/tops/shirt1.png && test ! -f public/images/none.png`

#### Manual Verification:

- [ ] `npm run dev` → `/` shows pink header + Playfair "What am I wearing today?" in periwinkle
- [ ] Nav switches between `/` and `/outfits`; browser back/forward work
- [ ] Fonts visibly load (serif heading, Montserrat nav)

**Implementation Note**: Pause after this phase for manual confirmation before proceeding.

---

## Phase 2: Domain — Manifest, Slot Model, Shuffle, OutfitStore

### Overview

All the logic, no UI: typed closet manifest (34 items), outfit slot model, pool-proportional shuffle with none-as-slot optionals, and the `OutfitStore` interface with its localStorage implementation. Everything unit-tested.

### Changes Required:

#### 1. Item types + manifest

**File**: `src/features/closet/types.ts`

```ts
export type ItemCategory =
  | "tops" | "bottoms" | "dresses" | "jackets" | "shoes" | "accessories";

export interface ClosetItem {
  id: string;              // e.g. "top-shirt-1"
  name: string;            // e.g. "Shirt 1"
  category: ItemCategory;
  image: string;           // "/images/tops/shirt1.png"
  // Reserved for future features (Decisions 3 & 7) — no logic reads these in v1:
  tags?: { colors?: string[]; seasons?: string[]; occasions?: string[] };
  jacketCompatible?: boolean;   // tops/dresses only
}
```

**File**: `src/features/closet/closet.ts` — the handwritten manifest: 15 tops, 14 bottoms, 3 jackets, 1 shoe, 1 accessory, and an **empty but present** `dresses` list. Ids follow `<singular-category>-<subtype>-<n>` (`top-tank-3`, `bottom-skirt-2`); names humanized from filenames ("Tank 3"). Export:

```ts
export function getCloset(): Record<ItemCategory, ClosetItem[]>; // v1: returns the static manifest
export function getItem(id: string): ClosetItem | undefined;
```

The manifest constant itself is **not exported** — UI, stores, and domain code go through `getCloset()`/`getItem()` only. This is the seam for the planned in-app-upload feature: uploaded items (IndexedDB) merge into `getCloset()`'s return value in one place, and everything downstream (shuffle, rails, outfit validity, previews) works unchanged because it already consumes `ClosetItem[]` and ids.

Adding an item stays "drop a PNG + add one entry" (Decision 3).

**File**: `src/features/closet/closet.test.ts` — manifest integrity: all ids unique; every `image` starts with `/images/<category>/`; every image file exists on disk (`fs.existsSync(join('public', item.image))` — Vitest runs in node); `closet.shoes.length >= 1` (shoes are a required slot).

#### 2. Outfit slot model

**File**: `src/features/shuffle/outfit.ts`

```ts
export type OutfitBase =
  | { kind: "separates"; topId: string; bottomId: string }
  | { kind: "dress"; dressId: string };

export interface Outfit {
  base: OutfitBase;
  jacketId: string | null;     // optional slot
  shoesId: string;             // required slot
  accessoryId: string | null;  // optional slot
}
```

Plus `isOutfitValid(outfit, closet)` — every referenced id exists in the right category (used to sanity-check persisted/loaded outfits).

#### 3. Shuffle logic

**File**: `src/lib/rng.ts` — `export type Rng = () => number;` (Math.random-compatible, injected for deterministic tests).

**File**: `src/features/shuffle/shuffle.ts`

```ts
export function shuffleOutfit(closet: Closet, rng: Rng): Outfit;
export type SlotName = "base" | "top" | "bottom" | "jacket" | "shoes" | "accessory";
export function shuffleSlot(outfit: Outfit, slot: SlotName, closet: Closet, rng: Rng): Outfit;
```

Rules (Decisions 7, 8 + user's 2026-07-13 confirmation):

- **Base (shuffle-all / merged slot)** — pool-proportional: `total = tops×bottoms + dresses`; roll `r ∈ [0, total)`; `r < tops×bottoms` → separates (top and bottom each uniform), else dress uniform. Empty dresses ⇒ dress probability exactly 0.
- **Jacket** — uniform over `jackets.length + 1` options; the extra option is `null`. (3 jackets ⇒ 25% no jacket, matching old app.)
- **Accessory** — same: uniform over `accessories.length + 1`.
- **Shoes** — uniform over shoes; never null (manifest test guarantees ≥1).
- **Per-slot** — `"top"`/`"bottom"` re-pick only within separates mode (no-op guard if base is a dress); `"base"` re-rolls pool-proportionally (can flip separates↔dress); `"jacket"`/`"shoes"`/`"accessory"` re-pick just that slot. All other slots untouched — return a new object, never mutate.

**File**: `src/features/shuffle/shuffle.test.ts` — with a seeded/scripted `Rng` and small fixture closets (fixtures, not the real manifest, so tests don't churn when Joyce adds clothes):
- Base distribution: fixture with 2 tops × 2 bottoms + 1 dress → dress picked iff roll lands in final 1/5 of range
- Zero dresses → never a dress; `kind` always `"separates"`
- Jacket none-odds: 3 jackets → `null` iff roll lands in final quarter
- `shuffleSlot("jacket", …)` changes only `jacketId`; `shuffleSlot("top", …)` on a dress base is a no-op
- Every produced outfit passes `isOutfitValid`

#### 4. OutfitStore interface + localStorage implementation

**File**: `src/features/outfits/store.ts`

```ts
export interface SavedOutfit {
  id: string;          // crypto.randomUUID()
  name: string;
  createdAt: string;   // ISO
  outfit: Outfit;
}

export interface OutfitStore {
  list(): SavedOutfit[];
  save(outfit: SavedOutfit): void;
  delete(id: string): void;
}
```

**File**: `src/features/outfits/localStorageStore.ts` — `createLocalStorageOutfitStore(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = window.localStorage)`, key `joyces-closet:saved-outfits:v1`. Corrupt/missing JSON ⇒ `[]` (never throws on read). UI never imports `localStorage` directly — only this module names it (Decision 6; backend swap = new implementation of `OutfitStore`).

**File**: `src/features/outfits/localStorageStore.test.ts` — Map-backed fake Storage: save→list round-trip; delete removes only the target; corrupted JSON in the key ⇒ `list()` returns `[]`; saves persist across store re-creation over the same fake.

### Success Criteria:

#### Automated Verification:

- [x] `npm test` passes: shuffle, outfit-validity, manifest-integrity, store suites
- [x] `npm run typecheck` and `npm run lint` pass
- [x] Manifest matches the Current State inventory table (one-time visual check during implementation — no counts assertion in the test, so adding clothes later stays a two-step change: drop PNG + add manifest entry)

#### Manual Verification:

- [ ] None — this phase is domain-only; the tests are the verification. Proceed directly to Phase 3.

---

## Phase 3: Shuffle Page — Rail, Paper-Doll Layout, Zustand

### Overview

The interactive heart: a lightweight rail component (arrows + swipe, wrap-around), mobile-first paper-doll layout, Zustand store persisting the current outfit, Shuffle All + per-slot shuffle.

### Changes Required:

#### 1. Current-outfit store

**File**: `src/features/shuffle/useShuffleStore.ts` — Zustand + `persist` (name `joyces-closet:current-outfit`, item ids only). State: `outfit: Outfit`; actions: `shuffleAll()`, `shuffleSlot(slot)` (delegate to domain fns with `Math.random`), `setSlot(slot, itemId | null)` (manual rail browsing), `loadOutfit(outfit)` (used by Phase 4). Initial state and rehydration: if persisted outfit is missing or fails `isOutfitValid` (item deleted from manifest) → fresh `shuffleOutfit`. That check runs in `onRehydrateStorage`/merge so a stale saved id can never render a broken image.

#### 2. Rail component

**File**: `src/components/Rail.tsx`

```ts
interface RailProps {
  label: string;                     // "Tops" — for aria, not necessarily visible
  items: ClosetItem[];
  activeId: string | null;          // null = the "none" position
  allowNone: boolean;               // jacket/accessory rails
  onChange(id: string | null): void;
  onShuffle(): void;                // per-slot shuffle button
  className?: string;               // per-slot sizing
}
```

- Position list = `allowNone ? [none, ...items] : items`; "none" renders as a dashed-outline empty placeholder (no `none.png` — Decision 7)
- Prev/next arrow buttons: `‹` `›` in `text-periwinkle`, styled like the old carousel arrows; wrap-around at both ends
- Swipe: pointer events — record `pointerdown` x, on `pointerup` if `|Δx| > 40px` go prev/next; no library
- Per-slot shuffle: small `bg-blush-light border-rose text-rose` button beneath the rail
- Single-item rails (shoes, accessories) still render arrows (wrap to self is fine — cheap, and behavior upgrades automatically as items are added)

#### 3. Shuffle page

**File**: `src/features/shuffle/ShufflePage.tsx`

- Playfair heading "What am I wearing today?" in periwinkle
- Prominent **Shuffle All** button (old `#shuffleAll` styling: `bg-blush-light`, `border-2 border-rose`, `text-rose font-body`)
- Mobile-first vertical paper-doll stack (Decision 9): top rail → bottom rail → shoes rail, with jacket and accessory rails alongside (on mobile: jacket directly below top, accessory below shoes; on `sm:`+ two-column: jacket beside top, accessory beside shoes — mirroring the old layout's proportions: tops/jackets widest, bottoms next, shoes/accessories smallest)
- **Dress merge (dormant in v1)**: when `outfit.base.kind === "dress"`, top+bottom rails are replaced by a single dress rail; a separates↔dress toggle renders only if `closet.dresses.length > 0`. With 0 dresses nothing shows — logic ships tested, UI activates when the first dress PNG lands
- **Save Outfit** button — wired in Phase 4; render disabled or omit until then (implementer's choice, note in commit)

### Success Criteria:

#### Automated Verification:

- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass

#### Manual Verification:

- [ ] Shuffle All randomizes every slot; jacket/accessory sometimes land on the empty "none" placeholder
- [ ] Per-slot shuffle changes only that slot
- [ ] Arrows browse each rail with wrap-around; jacket/accessory rails include a browsable "none" position
- [ ] Swipe works in a mobile viewport (DevTools device mode)
- [ ] Layout is clean at 375px wide and at desktop width
- [ ] Reloading the page restores the same outfit (persist middleware)

**Implementation Note**: Pause after this phase for manual confirmation before proceeding.

---

## Phase 4: Saved Outfits — Save Flow, /outfits Grid, Load-Back, Delete

### Overview

Complete v1: capture the current outfit with an optional name, show saved outfits as preview cards, load them back into the shuffle view, delete per card.

### Changes Required:

#### 1. Outfits store (Zustand view over OutfitStore)

**File**: `src/features/outfits/useOutfitsStore.ts` — holds `saved: SavedOutfit[]`, hydrated from `outfitStore.list()` at creation. Actions `saveOutfit(name, outfit)` / `deleteOutfit(id)` call the `OutfitStore` then refresh state. **No persist middleware here** — persistence is the `OutfitStore`'s job (Decision 6).

Default name helper: `defaultOutfitName(date)` → `"Outfit · " + date.toLocaleDateString("en-US", { month: "short", day: "numeric" })` → "Outfit · Jul 13". Tiny pure fn, one Vitest case.

#### 2. Save flow on shuffle page

**File**: `src/features/shuffle/ShufflePage.tsx` — enable **Save Outfit**: opens a small inline dialog/popover with a text input prefilled with the default name; Save / Cancel. Save → `saveOutfit(name, outfit)` → brief confirmation (e.g. button flashes "Saved ✓"), dialog closes.

#### 3. Outfits page

**File**: `src/features/outfits/OutfitCard.tsx` — card: mini stacked preview (small overlapped images: jacket behind top — or dress — above bottom, shoes at foot; absolutely-positioned thumbnails in a fixed-aspect box), name in Montserrat, created date small, delete `×` button (rose) with a lightweight confirm (two-tap or `window.confirm`).

**File**: `src/features/outfits/OutfitsPage.tsx` — responsive grid (2 cols mobile / 3–4 desktop) of `OutfitCard`s, newest first. Empty state: friendly message + link to `/`. Tap card → `useShuffleStore.loadOutfit(saved.outfit)` → navigate to `/`. If the saved outfit fails `isOutfitValid` (item since removed from manifest), show the card with a "missing items" hint and skip the invalid ids on load rather than crashing.

### Success Criteria:

#### Automated Verification:

- [x] `npm test` passes (existing suites + `defaultOutfitName`)
- [x] `npm run typecheck`, `npm run lint`, `npm run build` pass

#### Manual Verification:

- [ ] Save with the default name → card appears on `/outfits` with a recognizable mini preview
- [ ] Save with a custom name → name shows on the card
- [ ] Hard reload → saved outfits still there (localStorage)
- [ ] Tap a card → lands on `/` with exactly that outfit loaded (including "none" jacket if saved that way)
- [ ] Delete removes the card and survives reload
- [ ] Grid looks right at 375px and desktop; empty state shows before first save

**Implementation Note**: Pause here for final manual acceptance — this completes v1.

---

## Testing Strategy

### Unit Tests (Vitest, domain only — Decision 11):

- **Shuffle** (`shuffle.test.ts`): pool-proportional base selection incl. zero-dress case; none-odds for jacket (1/(N+1)) and accessory; per-slot isolation; dress-base guards; output validity. Deterministic via injected `Rng`.
- **Manifest** (`closet.test.ts`): unique ids, category/path agreement, files exist on disk, ≥1 shoe. Shape checks only — no item counts, so adding clothes never requires a test edit.
- **Store** (`localStorageStore.test.ts`): round-trip, delete, corrupt-JSON resilience, persistence across instances — all against a fake `Storage`.
- **Naming**: `defaultOutfitName` format.

### Manual Testing Steps:

1. Shuffle All ~10×: verify variety, occasional empty jacket/accessory, never a broken image
2. Browse every rail end-to-end with arrows; verify wrap-around and the "none" position on jacket/accessory
3. Device-mode 375px: swipe rails, full save→view→load→delete loop
4. Reload mid-session: current outfit and saved outfits both restored

### Explicitly no component/E2E tests (Decision 11).

## Performance Considerations

34 small PNGs served statically — no optimization needed in v1. Rails render only the active image (position swap, not a scrolling strip), so nothing to virtualize. `loading="lazy"` on `/outfits` card thumbnails is the only nicety worth adding.

## Migration Notes

- Old app files (`index.html`, `index.js`, `styles.css`) are deleted in Phase 1; git history retains them. `none.png` and `*test.png` do not carry over (Decision 7 / Codebase Findings).
- No user data to migrate — the old app persisted nothing.
- Future migrations enabled, not performed: backend `OutfitStore` implementation (interface in `store.ts`), dresses (add PNG + manifest entry), calendar (consumes `SavedOutfit`).
- **In-app upload (planned "soon" per user, 2026-07-13)** — additive on top of this architecture: an IndexedDB-backed uploaded-items store (metadata + image blobs; localStorage is too small for images), merged into `getCloset()` alongside the static manifest. `ClosetItem.image` stays a string (object URLs for blobs). Uploaded items get UUID ids, so `getItem`/`isOutfitValid`/saved outfits work unchanged. The genuinely open design question for that feature is image prep, not storage: the paper-doll look depends on transparent-background cutouts, so uploads need either pre-cut PNGs, client-side background removal (WASM libs run in-browser, fits the no-backend constraint), or a different rendering style for raw photos.

## References

- Design decisions: `thoughts/shared/decisions/2026-07-13-closet-rebuild.md`
- Palette/typography source: old `styles.css:1-69` (deleted in Phase 1; see token table in Phase 1 here)
- Old optional-jacket behavior being preserved: old `index.html:123-125`
- User confirmations (2026-07-13, this planning session): none-as-pool-slot shuffle odds; 4-phase structure; manifest test does shape checks only (no counts assertion) so adding items stays a two-step change
