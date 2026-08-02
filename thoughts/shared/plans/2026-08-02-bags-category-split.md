---
date: 2026-08-02
git_commit: 7214a06751cc67eece5e89412ac1f61cf9d76b49
branch: main
repository: joyces-closet
topic: "Bags category split: a seventh category, its own shuffle rail under jackets, larger jacket/bag rendering"
status: ready
decisions: thoughts/shared/decisions/2026-08-02-bags-category-split.md
research: thoughts/shared/research/2026-08-02-bags-category-split.md
---

# Bags Category Split Implementation Plan

## Overview

Split `bags` out of `accessories` into a seventh category with its own shuffle rail beneath
jackets, and enlarge the jacket and bag slots relative to accessories.

Today the shuffle deals one "accessory", and since that bucket is mostly bags you get *either* a
bag *or* a hair clip. After this, the shuffle dresses the way Joyce actually dresses — a bag on one
hand, and separately a hat/clip/scarf if the day calls for it. `accessories` becomes genuinely
general.

## Current State Analysis

Six categories fan out through the codebase via **two channels with opposite ergonomics**:

- **Nine `Record<ItemCategory, X>` maps** fail loudly at compile time — `RAIL_FRAME`,
  `RAIL_IMAGE_WIDTH`, `RAIL_ALIGN`, `CATEGORY_TINT`, `CATEGORY_LABEL` (`railScale.ts:13-59`),
  `CATEGORY_NOUN` (`uploads/naming.ts:5`), `SHAPE_PATH` (`CategoryShape.tsx:12`), `POOL_TINT`
  (`Aura.tsx:4`), `PLACEMENT` (`pipeline/constants.ts:73`).
- **Four bare `string[]`/`Set` allowlists** fail *silently* at runtime — `railScale.ts:62`,
  `merge.ts:3`, `indexedDbStore.ts:7`, `backup.ts:18`. Every genuine data-loss risk in this change
  lives here. Miss `indexedDbStore.ts` and bags save, display for the whole session, then vanish on
  reload with the error swallowed by `list()`'s catch (`indexedDbStore.ts:112`). Miss `merge.ts` and
  `closet.bags` is `undefined`, so `inCategory` throws.

The `Outfit` shape (`shuffle/outfit.ts:8-13`) is base + `jacketId` + `shoesId` + `accessoryId`.
Adding `bagId` is safe at compile time for `repairOutfit`, `shuffleOutfit`, and the two exhaustive
switches, but **not** for `outfitUsesItem` (`outfit.ts:83-95`) or for stored data.

An item's on-screen size is a three-factor product:

```
garment px = fill fraction × min(frame height, window width)
             └ baked into    └ RAIL_FRAME   └ grid column − 72px (two h-9 w-9 arrows, no gap)
               the PNG
```

Jackets are **width-bound at every viewport ≥768px** — the jacket window peaks at 245.8px against a
256px frame — so `RAIL_FRAME.jackets` is currently inert and raising it alone changes nothing. The
`grid-template-columns` ratio is the real lever.

## Desired End State

- `bags` is a seventh category everywhere: closet section, upload picker, backup, IndexedDB.
- The shuffle page has a bags rail — beneath the jacket on desktop, in its own full-width row on
  mobile — with a browsable "no bag" frame.
- Jacket renders ~17% larger at wide viewports; bag renders between jacket and accessory; tops,
  shoes and accessories are untouched at ≥1272px content.
- **Every existing saved outfit, week plan and closet item survives**, and every existing backup
  file on disk still imports.

Verified by: `npm run typecheck && npm run lint && npm test` clean, plus the manual checks in each
phase.

### Key Discoveries

- `src/index.css:333` — the md+ template's second row starts with a literal `.`, the exact cell
  bags should occupy. One-word change.
- `outfit.ts:41-42` — `optionalOk` is `field === null || typeof field === "string"`. A stored outfit
  has no `bagId` key, so `outfit.bagId` is `undefined` and fails **both** branches. Add
  `optionalOk(outfit.bagId)` naively and every saved outfit fails the guard — which is deletion, not
  a display bug, because `localStorageStore.ts:48-62` read-filter-writes the whole array on every
  save and delete.
- `outfit.ts:83-95` `outfitUsesItem` produces **no compile error** and drives the closet delete
  confirmation's "worn in N outfits" count.
- `index.css:738-739` — the aura-pool ladder comment already says "Seven distinct phases" (six
  section pools plus the header pool at delay 0). A seventh section pool makes it eight.
- `normalize.test.ts:33` — the `bag1.png` fixture row is `accessories`' only measured backing, which
  is why Decision 2 leaves it there.
- `Rail.tsx` has **zero per-category branching** — `category` feeds only the decorative
  `CategoryShape` at line 228. A bags rail is a copy of the accessories rail.
- `railScale.ts:3-12` and `index.css:334-335` both document deliberate tops/jackets parity. Decision
  5 reverses it; the comments must move with the code.

## What We're NOT Doing

- **Migrating existing uploads out of `accessories`.** No `recategorizeUpload`, no "move to Bags"
  control. Joyce deletes and re-uploads her one bag (Decision 2 / Out of Scope).
- **Shrinking `RAIL_FRAME.accessories`** (Decision 6).
- **Touching `.wash-*` / `WASH_CLASSES`** (`index.css:372-388`, `OutfitCard.tsx:23-30`). It is a
  6-entry hash palette for scrapbook variety, unrelated to an outfit's contents; a 7th entry changes
  the modulo and recolors every existing saved card.
- **Bumping the IndexedDB version** (no schema migration needed; a v2 bump risks `onblocked`
  rejecting into an empty closet in a second tab) or the **backup version** (Decision 12).
- **Reflowing the upload category picker.** `grid-cols-2 sm:grid-cols-3` (`UploadFlow.tsx:276`)
  leaves seven buttons ragged in the last row. Cosmetic; a transient picker; left alone.
- **Fixing the 768px size cliff** or the **dress-mode mobile row gap** — both pre-existing.

## Implementation Approach

Four phases, ordered so the riskiest thing is verified in isolation:

1. **The category** — collapse four allowlists onto one `as const` array, add `bags`, fill the nine
   maps and the CSS tokens. Bags become uploadable and browsable; the shuffle page is untouched.
2. **The outfit slot** — `bagId` end to end, including the legacy-outfit normalization. Nothing
   renders yet, so the manual check is purely "is my data still here".
3. **The shuffle page** — the rail, the grid areas, the size constants.
4. **The outfit card** — the sixth thumbnail.

---

## Phase 1: The seventh category

### Overview

One source of truth for the category list, then `bags` filled into every per-category map, CSS token
and silhouette. At the end of this phase a bag can be uploaded, appears in its own closet section
with its own shape/tint/aura, and round-trips through IndexedDB and backup.

### Changes Required

#### 1. One source of truth

**File**: `src/features/closet/types.ts`
**Changes**: `CATEGORIES` becomes the definition and `ItemCategory` derives from it. This converts
every future category from "four ways to lose data" into a compile error (Decision 13). The array is
also the manifest **order** (Decision 10), so it must stay ordered, not alphabetized.

```ts
/**
 * The category set, and the manifest ORDER the closet page and the upload picker present
 * (2026-08-02 Decision 10: bags sits under jackets, mirroring the shuffle page's left column
 * and preserving the big→small gradient).
 *
 * Single source of truth (Decision 13). The union below derives from this array, and so do the
 * runtime allowlists in uploads/indexedDbStore.ts and uploads/backup.ts — those used to be
 * hand-maintained Sets, and a category missing from either one saved fine, displayed for a whole
 * session, then vanished on reload with the error swallowed. Adding a category is one edit here
 * plus whatever Record<ItemCategory, X> maps the compiler then points at.
 */
export const CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "jackets",
  "bags",
  "shoes",
  "accessories",
] as const;

export type ItemCategory = (typeof CATEGORIES)[number];

/** The runtime half of the union, for validating untrusted data off disk. */
export function isItemCategory(value: unknown): value is ItemCategory {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}
```

**File**: `src/features/closet/railScale.ts`
**Changes**: delete the local `CATEGORIES` array (lines 62-69) entirely.

**File**: `src/features/closet/merge.ts`
**Changes**: delete the local `CATEGORIES` (lines 3-10); `import { CATEGORIES } from "./types"`.
Update the "six category arrays" wording in the `toCloset` doc comment to "seven".

**File**: `src/features/closet/ClosetPage.tsx` (line 14) and `src/features/uploads/UploadFlow.tsx`
(lines 4-10)
**Changes**: move `CATEGORIES` out of the `railScale` import and into the `types` import.

**File**: `src/features/uploads/indexedDbStore.ts`
**Changes**: delete the `Set` (lines 7-14); use the shared guard.

```ts
import { isItemCategory } from "../closet/types";
// ...
    typeof candidate.name === "string" &&
    isItemCategory(candidate.category) &&
    typeof candidate.createdAt === "string" &&
```

**File**: `src/features/uploads/backup.ts`
**Changes**: delete the `Set` (lines 18-25); `isBackupItem` uses `isItemCategory(item.category)`.
Keep `SUBTYPES` as it is. **`BACKUP_VERSION` stays `1`** (Decision 12) — bumping it makes an older
cached bundle reject the *entire* file (items, outfits and plans) rather than just the bags. Extend
the existing comment above `BACKUP_VERSION` to say bags is the second field added under this rule.

#### 2. The nine per-category maps

**File**: `src/features/closet/railScale.ts`

```ts
export const RAIL_FRAME: Record<ItemCategory, string> = {
  tops: "h-52 sm:h-64",
  bottoms: "h-80 sm:h-96",
  dresses: "h-80 sm:h-96",
  jackets: "h-56 sm:h-72",   // 224 / 288px — see Phase 3
  bags: "h-32 sm:h-48",      // 128 / 192px
  shoes: "h-28 sm:h-32",
  accessories: "h-28 sm:h-32",
};
```

`RAIL_IMAGE_WIDTH.bags = "max-w-full"`, `RAIL_ALIGN.bags = "center"`,
`CATEGORY_TINT.bags = "text-tint-bags"`, `CATEGORY_LABEL.bags = "Bags"`.

The `RAIL_FRAME` change and the header comment rewrite belong to **Phase 3** — listed here only so
the map is filled in one place. Phase 1 may land `jackets` unchanged and `bags: "h-32 sm:h-48"`.

**File**: `src/features/uploads/naming.ts` — `bags: "Bag"` (singular; it names one garment).

**File**: `src/features/uploads/pipeline/constants.ts`

```ts
  // DERIVED, not measured — same status as dresses. The one measured accessory sample was
  // bag1.png, but its 0.81 is retained by `accessories` (2026-08-02 Decision 2) rather than
  // moving here, so `accessories` keeps its provenance and its regression fixture. Bags get a
  // tighter 0.90 because fill is the only size lever that reaches the closet tile and the
  // outfit-card thumbnail, where RAIL_FRAME does not apply. Existing bags filed under
  // accessories keep accessory scale forever — the original upload is not retained — which is
  // why they are deleted and re-uploaded rather than migrated.
  bags: { canvas: SQUARE, fillW: 0.9, fillH: 0.9, anchor: { kind: "center" } },
```

Placed between `jackets` and `shoes`, matching manifest order. `normalize.test.ts` needs **no
change**: `BY_NAME` and `TIGHT` both key off `accessories`, which keeps `bag1.png`.

**File**: `src/components/CategoryShape.tsx` — a teardrop, one merged subpath centred on (12,12).
Spans x 4.6→19.4 and y 2→22, so both midpoints land on 12. The two side curves leave the bulb
vertically, matching the circle's tangent there, so the join is smooth at any size.

```ts
  // teardrop — a point at the top over a round bulb, the inverse silhouette of the heart
  bags:
    "M12 2 C10.4 5.5 4.6 11 4.6 14.6 A7.4 7.4 0 0 0 19.4 14.6 " +
    "C19.4 11 13.6 5.5 12 2 Z",
```

**File**: `src/components/Aura.tsx` — `bags: "aura-pool-bags"`. Update the "six section pools"
comment to seven.

#### 3. CSS tokens

**File**: `src/index.css`

`--color-tint-bags` in the `@theme` block (after `--color-tint-jackets`, matching manifest order)
**and in all five preset blocks** — without the `@theme` entry Tailwind never generates
`text-tint-bags` and `CategoryShape` renders colourless.

| block | line | value | rationale |
|---|---|---|---|
| `@theme` | ~23 | `#8b9bb5` | Decision 8's muted dusty blue; blue is the one region the six existing tints leave empty |
| `rosewood` | ~164 | `#8b9bb5` | same — `@theme` holds the rosewood default |
| `lavender` | ~184 | `#8fae9b` | **diverges.** Bottoms is already `#8f9dbb`, a dusty blue. The one wide gap in this preset is gold→teal, so bags takes a muted sage-mint |
| `garden` | ~204 | `#8598b8` | dusty blue reads as water/sky here; 55° off the sea-green accessories |
| `seaglass` | ~224 | `#ab8fa4` | **diverges.** Tops is already `#8fa9b8`, a dusty blue (Decision 8's stated caveat). The empty region is violet→clay, so bags takes a muted mauve-rose, ~60° clear of both neighbours |
| `marmalade` | ~244 | `#8298b5` | dusty blue; 84° off the sage accessories |

Both divergences follow the existing precedent that a category's tint is re-derived per theme rather
than fixed — seaglass already swings tops from the rose family to blue.

The aura pool, after `.aura-pool-accessories`:

```css
.aura-pool-bags {
  --aura-pool: var(--color-tint-bags);
}
.aura-pool-bags > div {
  animation-delay: -46s;
}
```

Continues the −4/−11/−18/−25/−32/−39 ladder against the 48s cycle. Update the comment above the
ladder (line ~738) from "Seven distinct phases" to "Eight distinct phases" — it counts the header
pool at delay 0.

#### 4. Tests

**File**: `src/features/closet/merge.test.ts` (line 6) and `src/features/closet/closet.test.ts`
(line 25) — add `"bags"` to the hand-written lists. Keep them hand-written **on purpose**: they are
independent canaries, so a future category added without thinking fails a test instead of losing
data. Add a comment saying so.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [x] `grep -rn '"accessories"' src --include="*.ts" --include="*.tsx"` returns only `railScale.ts`,
      `naming.ts`, `constants.ts`, `Aura.tsx`, `CategoryShape.tsx`, `outfit.ts`, `shuffle.ts`,
      `ShufflePage.tsx` and test files — **no surviving hand-maintained category list**
      (actual: `types.ts` — the new single source of truth — plus `outfit.ts`, `ShufflePage.tsx`
      and test files; the maps key on `accessories:` unquoted so they don't match)

#### Manual Verification

- [ ] The closet page shows a **Bags** section between Jackets and Shoes, with a teardrop marker and
      its own aura pool, reading "Nothing here yet!"
- [ ] The upload picker offers a seventh **Bags** button with the teardrop
- [ ] Upload a bag: preview renders at rail scale, saves, appears in the Bags section
- [ ] **Reload the page — the bag is still there.** (This is the `indexedDbStore` allowlist check;
      failure looks like a mystery disappearance, not an error.)
- [ ] Export a backup, reload, re-import: the bag comes back and `skipped` is 0
- [ ] Switch through all six themes: the teardrop is tinted in every one, is distinct from the other
      six markers, and stays in the muted watercolor register
- [ ] The bags aura pool does not visibly breathe in phase with its neighbours

**Implementation Note**: pause here for manual confirmation before Phase 2.

---

## Phase 2: The `bagId` outfit slot

### Overview

`bags` becomes a full optional outfit slot (Decision 1), and stored outfits are normalized at the
read boundary so nothing is lost. **This is the highest-risk phase in the change** and it lands with
no visible UI, so the manual check is purely about data survival.

### Changes Required

#### 1. The shape and the migration helper

**File**: `src/features/shuffle/outfit.ts`

```ts
export interface Outfit {
  base: OutfitBase;
  jacketId: string | null; // optional slot
  bagId: string | null; // optional slot
  shoesId: string; // required slot
  accessoryId: string | null; // optional slot
}
```

```ts
/**
 * Fills in `bagId` on outfits stored before bags existed (2026-08-02 Decision 11).
 *
 * `isOutfitShape` stays STRICT — `undefined` is not `null`, and loosening `optionalOk` would
 * loosen jacketId and accessoryId too while leaving bagId genuinely undefined behind a type
 * that promises `string | null`. So every read boundary normalizes first instead. There are
 * three: localStorage, backup import, and the persisted current outfit.
 *
 * Getting this wrong is deletion, not a display bug: localStorageStore reads, filters and
 * rewrites the whole array on every save and delete, so an outfit the guard rejects is gone on
 * the next mutation.
 *
 * Backup files on disk are permanent artifacts, so this must keep working FOREVER — not just
 * through this release.
 */
export function withBagDefault(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const outfit = value as Record<string, unknown>;
  if (outfit.bagId !== undefined) return value;
  return { ...outfit, bagId: null };
}

/** The SavedOutfit wrapper around it — the form both storage seams actually read. */
export function withSavedBagDefault(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const saved = value as Record<string, unknown>;
  return { ...saved, outfit: withBagDefault(saved.outfit) };
}
```

Both stay in `outfit.ts` (which owns the `Outfit` shape and this migration concern) and take
`unknown`, so no new imports are needed and they test cleanly in the node-only vitest setup.

Then, in the same file:

- `isOutfitShape` — add `optionalOk(outfit.bagId)` to the return expression.
- `isOutfitValid` — add `bagValid`, mirroring `jacketValid`:
  ```ts
  const bagValid = outfit.bagId === null || inCategory(closet, "bags", outfit.bagId);
  ```
- `outfitUsesItem` — **add `outfit.bagId === id`.** No compile error will point here; a miss
  under-reports the blast radius on the closet delete confirmation.
- `repairOutfit` — add the `bagId` branch, mirroring `jacketId`:
  ```ts
    bagId:
      outfit.bagId !== null && inCategory(closet, "bags", outfit.bagId)
        ? outfit.bagId
        : null,
  ```

#### 2. Shuffle

**File**: `src/features/shuffle/shuffle.ts`

- `SlotName` gains `"bag"`.
- `shuffleOutfit` gains `bagId: pickOptional(closet.bags, rng)?.id ?? null` — placed **after**
  `jacketId` and before `shoesId`, so the rng consumption order matches the slot order in the type.
- `shuffleSlot` gains a `case "bag":` returning
  `{ ...outfit, bagId: pickOptional(closet.bags, rng)?.id ?? null }`.
- `MissingCategory` is **unchanged** — bags are optional, so the closet can still dress without them.

Record the behavioral change as a comment near `pickOptional`: two independent optional slots roll
separately, so bare-flank outfits get rarer — `1/((a+1)(b+1))` instead of `1/(a+b+1)` — and each
individual bag appears far more often, since it now competes against the other bags rather than
against every accessory. **This is the point of the feature, not a side effect** (Decision 1).

**File**: `src/features/shuffle/useShuffleStore.ts`

- `EditableSlot` gains `"bag"`; `applySlot` gains `case "bag": return { ...outfit, bagId: itemId };`
  (alongside `jacket`, since both accept `null`).
- The persist `merge` normalizes before validating:
  ```ts
  merge: (persisted, current) => {
    const stored = withBagDefault(
      (persisted as { outfit?: unknown } | undefined)?.outfit,
    );
    const usable = isOutfitShape(stored) && isOutfitValid(stored, getCloset());
    return { ...current, outfit: usable ? stored : current.outfit };
  },
  ```
  This is what lets the in-progress current outfit survive the upgrade instead of silently
  re-rolling. **Do not bump the persist `version`.**

#### 3. The other two read boundaries

**File**: `src/features/outfits/localStorageStore.ts` — in `read()`:

```ts
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map(withSavedBagDefault).filter(isSavedOutfit)
        : [];
```

**File**: `src/features/uploads/backup.ts` — in `decodeBackup()`:

```ts
  const outfits = rawOutfits.map(withSavedBagDefault).filter(isSavedOutfit);
```

`skipped` still computes from `rawOutfits.length - outfits.length`, so it stays correct.

#### 4. Tests

**File**: `src/features/shuffle/shuffle.test.ts`

- `fixture()` gains `bags: items("bags", counts.bags ?? 0)`.
- Every hand-built `Outfit` literal gains `bagId` (lines ~65, ~150, ~294, ~347, ~421, ~437) — the
  compiler will point at each.
- Add: with `bags: 1` a scripted rng of `0.0` picks `bags-1` and `0.99` picks none, mirroring the
  existing accessory table.
- Add: `repairOutfit` drops a `bagId` whose item is gone (extend the existing case at ~356).

**File**: `src/features/shuffle/outfit.test.ts`

- Both fixtures gain `bagId`; give `dressed` a real `bag-1` so `outfitUsesItem` covers it.
- Add `expect(outfitUsesItem(dressed, "bag-1")).toBe(true)` and an empty-slot negative case.
- **New `describe("withBagDefault")`**, the regression net for Decision 11:
  - a legacy outfit with no `bagId` key gains `bagId: null` and passes `isOutfitShape`
  - the same object *without* normalization **fails** `isOutfitShape` (pins why this exists)
  - an outfit that already has `bagId` is returned unchanged (identity, not a copy)
  - `null`, a string, and a number pass through untouched
  - `withSavedBagDefault` normalizes the nested `outfit` and preserves `id`/`name`/`createdAt`

**File**: `src/features/outfits/localStorageStore.test.ts`

- The `outfit` fixture gains `bagId: null`.
- **New test**: seed the fake storage with a raw JSON array whose outfit has **no `bagId` key**;
  assert `list()` returns it with `bagId: null`; then `save()` a second outfit and assert the legacy
  one is **still present** — the read-filter-write deletion path, pinned.

**File**: `src/features/uploads/backup.test.ts`

- The `outfit` fixture gains `bagId: null`.
- **New test**: `decodeBackup` on a file whose outfit predates bags returns it with `bagId: null` and
  `skipped: 0`.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] The new `withBagDefault` suite passes:
      `npx vitest run src/features/shuffle/outfit.test.ts`
- [x] The legacy-survival test passes:
      `npx vitest run src/features/outfits/localStorageStore.test.ts`

#### Manual Verification

Do this against a browser profile that **already has saved outfits** from before the change.

- [ ] The saved-outfits page still lists every outfit that was there before
- [ ] No outfit shows "Some items are no longer in the closet" that did not show it before
- [ ] Save a new outfit, then reload: **the old outfits are still there** (this is the
      read-filter-write path — if the guard were rejecting them, this is the moment they vanish)
- [ ] Delete one outfit, reload: the others are still there
- [ ] The shuffle page's in-progress outfit survived the reload rather than silently re-rolling
- [ ] The week page still shows its planned outfits
- [ ] Import a backup **exported before this change**: outfits come back, `skipped` is 0

**Implementation Note**: pause here for manual confirmation before Phase 3.

---

## Phase 3: The shuffle page

### Overview

The bags rail, its grid position at both breakpoints, and the size constants that make jackets and
bags read larger than accessories.

### Changes Required

#### 1. The rail

**File**: `src/features/shuffle/ShufflePage.tsx`

Cascade ladder (Decision 9) — keep the 70ms step and insert `bag` before `accessory` as a carried
finishing touch. The last rail now settles at 750ms instead of 680ms.

```ts
const CASCADE_MS = {
  top: 0,
  jacket: 70,
  bottom: 140,
  shoes: 210,
  bag: 280,
  accessory: 350,
};
```

New rail block, placed in the JSX **immediately after the jacket block** — that matches the mobile
reading order (jacket/top → bag → bottom → shoes/accessory) and so keeps tab order sensible:

```tsx
{/* Beneath the jacket, sharing its wide column: a bag is a hero object, not a trinket. */}
<div className="[grid-area:bag] md:self-center">
  <Rail
    label="Bags"
    items={closet.bags}
    activeId={outfit.bagId}
    allowNone
    emptyLabel="no bag"
    onChange={(id) => setSlot("bag", id)}
    onShuffle={() => shuffleSlot("bag")}
    className={RAIL_FRAME.bags}
    cascadeTick={tick}
    cascadeDelayMs={CASCADE_MS.bag}
    category="bags"
  />
</div>
```

`md:self-center` mirrors the shoes across that row; row height is set by the 384px bottoms rail, so
there is room.

#### 2. Grid areas

**File**: `src/index.css:317-339`

Mobile (Decision 4) — six rails in two columns with `bottom` spanning both means every arrangement
leaves a hole, and **every half-column rail is clamped to the same ~101px window** regardless of
frame height. The spanning row is the only slot whose size is actually controllable on a phone, so
the bag takes one:

```css
.paper-doll {
  display: grid;
  grid-template-areas:
    "jacket top"
    "bag    bag"
    "bottom bottom"
    "shoes  accessory";
  grid-template-columns: 1fr 1fr;
  column-gap: 0.75rem;
  row-gap: 1.5rem;
  align-items: end;
}
```

Desktop (Decision 3) — the `.` becomes `bag`, producing a clean mirror: jacket ↔ accessory flank the
top row, bag ↔ shoes flank the bottom row.

```css
@media (min-width: 768px) {
  .paper-doll {
    grid-template-areas:
      "jacket top accessory"
      "bag    bottom shoes";
    grid-template-columns: 1.3fr 1.15fr 0.85fr;
    column-gap: 1rem;
  }
}
```

Replace the comment above `grid-template-columns` (currently lines 334-335, asserting jacket/centre
parity) with:

```css
    /* The jacket column is the widest (2026-08-02 Decision 5), reversing the tops/jackets
       parity this comment used to assert. Jackets are width-bound at every viewport ≥768px —
       the window peaks at 245.8px against a 256px frame — so RAIL_FRAME.jackets alone is inert
       and the column ratio is the only lever. Bags share the column beneath it.

       Below ~1272px viewport the three columns cannot all be full size (they want
       288+256+128 of frame plus 3×72 of arrows plus gaps ≈ 920px of content), and the small
       column is what gives up the room. */
```

The dress rail's `md:[grid-row:top-start_/_bottom-end]` (`ShufflePage.tsx:129`) still spans the two
md rows correctly and needs no change.

#### 3. Size constants

**File**: `src/features/closet/railScale.ts`

`RAIL_FRAME.jackets` `"h-52 sm:h-64"` → `"h-56 sm:h-72"`, so the wider column is not immediately
re-capped by the old 256px height.

`RAIL_FRAME.bags` was `"h-32 sm:h-48"` in Phase 1; **raised to `"h-40 sm:h-64"` after review
(2026-08-02, post-implementation)** — the planned 173px still read as small on the shuffle page.
Bags are HEIGHT-bound at every breakpoint (frame 192px against a ~287px jacket-column window and a
~286px mobile full-width-row window), so unlike jackets this frame is a direct lever and the change
is retroactive across existing uploads. The ceiling is the jacket column itself: at `sm:h-72` the
bag goes width-bound at ~287px and renders level with the jacket, so 256px sits deliberately just
under it.

Rewrite the map's doc comment (lines 3-12), which currently states tops/jackets parity:

```ts
/**
 * Paper-doll proportions (rebuild Decision 6), keyed by category so the shuffle rails and
 * the upload preview render an item at literally the same size. The preview's whole job is
 * to show a misfit before saving, which only works if "real rail scale" is one constant
 * rather than two that agree today.
 *
 * Jackets now render LARGER than tops (2026-08-02 Decision 5), reversing the parity this
 * comment used to document: a jacket is the outer layer and reads as one, with bags beneath
 * it in the same wide column and the small slots staying small. Note that a frame height is
 * only a CAP — a square garment renders at min(frameHeight, windowWidth) — so tops and
 * jackets are width-bound at every desktop width and these two numbers do nothing on their
 * own without the grid-template-columns ratio in index.css.
 *
 * The bottoms frame is tall enough for full-length pants, and RAIL_IMAGE_WIDTH caps square
 * art (shorts, skirts) so only the tall pieces use the extra height.
 */
```

Resulting garment sizes at 944px content (viewport ≥1296px):

| slot | now | after |
|---|---|---|
| top | 231px | 231px — unchanged |
| jacket | 224px | **261px** (+17%) |
| bag | — | **230px** (`sm:h-64`; was planned at 173px) |
| shoes | 115px | 115px — unchanged |
| accessory | 104px | 104px — unchanged |

At 390px mobile the bag goes from a planned 115px to **144px**, against the jacket's 92px.

This also gives the save popover *more* landing room — it opens from the sidebar into the jacket
column (`thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md:113-125`) — so it is
strictly safer than the status quo.

**Accepted consequence (confirmed 2026-08-02):** below ~1272px viewport the three columns cannot all
be full size, and `0.85fr` makes the small column absorb the squeeze. At a 1024px-wide window shoes
and accessories render ~84px and ~75px against today's ~110px and ~99px, while the jacket grows 19%.
Shoes and accessories shrink *together* — they share the column — so Decision 6's actual concern
(accessories dropping below shoes in the same column) does not arise, and the requested hierarchy
reads strongest exactly where the page is most cramped.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] Build succeeds: `npm run build` (verified in the emitted CSS: the `[grid-area:bag]`
      utility, `text-tint-bags`, and all six `--color-tint-bags` values are present)

#### Manual Verification

- [ ] Desktop ≥1296px: the bags rail sits directly beneath the jacket; jacket ↔ accessory flank the
      top row and bag ↔ shoes flank the bottom row
- [ ] Desktop: jacket is visibly larger than the top; bag is clearly between jacket and accessory;
      shoes and accessories look exactly as they did before
- [ ] Mobile (390px): the bag has its own full-width row between jacket/top and bottoms, and is
      visibly the largest of the small slots — larger than the jacket beside it, which is the
      deliberate breakpoint inversion (Decision 4)
- [ ] 640–767px band: bag and jacket now render at roughly the same size (~230px vs ~233px), where
      the original `sm:h-48` left a clear step. **Revised expectation, not a regression** — this
      band runs the `sm:` frames against the MOBILE grid, and Decision 4 already grants the bag
      hero status there. Check it doesn't read as an accident: if it does, `sm:h-60` restores a
      visible step (216px) at the cost of 14px on desktop
- [ ] Shuffle All cascades top → jacket → bottom → shoes → **bag** → accessory, and the stagger still
      reads as one motion
- [ ] Browsing the bags rail reaches a real "no bag" frame that slides like any other
- [ ] The bags rail's ⇄ re-rolls only the bag
- [ ] Save-outfit popover still opens cleanly over the jacket column and is not clipped
- [ ] Flip to a dress: the dress rail still spans both md rows and the bag rail is unaffected
- [ ] With an empty bags category the page still shuffles — "no bag" is the only frame

**Implementation Note**: pause here for manual confirmation before Phase 4.

---

## Phase 4: The outfit card

### Overview

A sixth thumbnail on the mini paper doll. Both lower corners were taken, so bag takes bottom-left and
the accessory moves up (Decision 7): hats and clips ride high on the body, a bag hangs at hip level,
and it makes the bag the larger of the two — matching the rail hierarchy.

### Changes Required

**File**: `src/features/outfits/OutfitCard.tsx`

```tsx
export function OutfitPreview({ saved }: { saved: SavedOutfit }) {
  const { base, jacketId, bagId, shoesId, accessoryId } = saved.outfit;
```

Replace the two lower-corner thumbnails (lines 123-124) with three:

```tsx
      <Thumbnail id={shoesId} className="right-0 bottom-0 h-[18%] w-[38%]" />
      {/* Bag and accessory swapped places when bags split out (2026-08-02 Decision 7): a bag
          hangs at hip level and is the bigger object, so it takes the bottom corner and the
          accessory rides up the body. Both stay clear of the bottoms boxes above — object-contain
          centres each garment in its box, so the few percent of overlap with a full-length leg
          never shows. */}
      <Thumbnail id={bagId} className="bottom-0 left-0 h-[24%] w-[32%]" />
      <Thumbnail
        id={accessoryId}
        className="top-[46%] left-0 h-[19%] w-[25%]"
      />
```

Update the component doc comment (lines 84-88) — "the two small slots in the lower corners" is no
longer true.

Empty optional slots already render nothing (`Thumbnail` returns `null` when the item is missing),
so an outfit with no bag simply has a gap. No placeholder needed.

Geometry check against the existing boxes: jacket occupies y 0–46%, so the accessory at y 46–65%
abuts it without overlapping; the bag at y 76–100% clears the accessory by 11%. The long-bottom box
(`top-[38%] … w-[42%]`, x 29–71%) overlaps the bag's x 0–32% by three points, the same tolerance the
current accessory box already has. Reused by the week page at cells as small as 80px wide, where the
bag lands at ~26px and the accessory at ~20px — comparable to today's shoes at ~30px.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] All tests pass: `npm test`
- [x] Build succeeds: `npm run build`

#### Manual Verification

- [ ] Save an outfit with a bag and an accessory: bag sits bottom-left, accessory directly above it,
      shoes bottom-right, and none of the four overlap badly
- [ ] Save an outfit with a bag and **no** accessory: just a gap, no placeholder, nothing shifts
- [ ] Save a dress outfit with a bag: the dress does not collide with the bag
- [ ] A full-length-trousers outfit with a bag: the leg and the bag read as separate objects
- [ ] The week page's day rows and the assign picker both render the bag legibly at their smallest
      size (80px cell) — this is the cell that decides whether the percentages need retuning
- [ ] Delete a bag from the closet: the confirmation's "worn in N outfits" count includes outfits
      that wear it (the `outfitUsesItem` check), and the saved cards then show "Some items are no
      longer in the closet"

---

## Testing Strategy

### Unit Tests

Everything new is a pure function or an injected-storage seam, which is what keeps it testable in
the node-only vitest setup.

- **`withBagDefault` / `withSavedBagDefault`** — the regression net for the one deletion risk.
  Crucially, one test asserts the *unnormalized* legacy object **fails** `isOutfitShape`, so the
  reason the helper exists is pinned rather than assumed.
- **`shuffleSlot("bag")` / `shuffleOutfit`** — the `1/(n+1)` none-odds hold for the new slot, and
  rng consumption order is stable.
- **`repairOutfit`** — a `bagId` pointing at a deleted item drops to `null`.
- **`outfitUsesItem`** — covers `bagId`, since no compile error will.
- **`localStorageStore`** — a legacy array survives a subsequent `save()`, which is the exact
  read-filter-write path that would delete it.
- **`decodeBackup`** — a pre-bags backup file imports with `skipped: 0`.
- **`toCloset` / `getCloset`** — the hand-written category lists in `merge.test.ts` and
  `closet.test.ts` stay hand-written as deliberate canaries.

### Manual Testing Steps

1. Before starting, **export a backup** from the current build — it is both the safety net and the
   Phase 2 legacy-import fixture.
2. Phase 1: upload a bag, reload, confirm it survives; export/import round-trip.
3. Phase 2: against a profile with pre-existing saved outfits, save one and delete one, reloading
   between each, confirming the originals persist.
4. Phase 3: check the shuffle page at 390px, 700px, 1024px, 1280px and 1440px.
5. Phase 4: check the saved-outfits page and the week page, including the 80px assign-picker cells.
6. Delete the old bag from `accessories` and re-upload it under `Bags` (Decision 2 — there is no
   migration path, deliberately), then confirm it renders at the new 0.90 fill.

## Performance Considerations

None material. One more rail is one more `Rail` instance and one more aura pool on the closet page;
the IndexedDB and localStorage payloads grow by one nullable id per outfit.

## Migration Notes

- **Saved outfits, the current outfit, and backup files** migrate transparently via
  `withBagDefault` at all three read boundaries. Nothing is rewritten on disk until the next save —
  and when it is, `bagId: null` is already present.
- **Week plans** need no change: a `PlanEntry` carries only a `SavedOutfit` id, no category and no
  slot (`week/plan.ts:16-18`).
- **Backup files stay at `version: 1`** (Decision 12), so an older cached bundle drops bag *items*
  into its `skipped` count instead of refusing the entire file.
- **The IndexedDB version stays at 1** — no schema change is needed, and a v2 bump risks `onblocked`
  rejecting into an empty closet in a second tab.
- **Existing bags are not migrated.** Joyce's one bag is deleted and re-uploaded under Bags. The
  stored blob is a composited PNG with the accessories fill baked in and the original upload is not
  retained, so a metadata-only recategorize would leave it permanently at accessory scale.

## Known Follow-ups (out of scope, recorded so they aren't mistaken for regressions)

- The 768px cliff: the 272px sidebar and the 3-column grid arrive at the same breakpoint, collapsing
  the jacket window from 256px to ~79px. The wider jacket column improves it ~28% but does not fix
  it.
- Dress mode on mobile: the bottoms rail does not render and its md-only row span does not apply
  below 768px, so the `bottom` row collapses to zero height while keeping both row gaps — a stray
  ~3rem gap. The new 4-row mobile grid inherits it.
- The upload category picker's ragged seventh button.
- `accessories` keeps `bag1.png` as its only measured fill sample, so its 0.81 no longer describes
  what the category actually holds. Re-measure once there are real hats and clips.

## References

- Design decisions: `thoughts/shared/decisions/2026-08-02-bags-category-split.md`
- Research: `thoughts/shared/research/2026-08-02-bags-category-split.md`
- `thoughts/shared/decisions/2026-07-13-closet-rebuild.md` — Decision 7, the slot model and the
  `1/(n+1)` none-odds
- `thoughts/shared/decisions/2026-07-17-ui-artistic-polish.md` — Decisions 2 & 5, per-category tints
  re-derived per theme
- `thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md` — Decision 4, the fixed
  shape iconography and its single-subpath constraint
- `thoughts/shared/plans/2026-07-30-shuffle-rail-slide-animation.md` — Decision 2 ("none" is a real
  frame that slides), Decision 3 (the stagger)
- `thoughts/shared/decisions/2026-07-31-week-planning.md` — Decision 8, the backup-stays-at-version-1
  precedent
- `thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md:113-125` — the jacket
  column geometry the popover lands in
