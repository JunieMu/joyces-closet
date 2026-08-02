---
date: 2026-08-02T09:45:19-05:00
researcher: Joyce Ma
git_commit: 7214a06751cc67eece5e89412ac1f61cf9d76b49
branch: main
repository: joyces-closet
topic: "Splitting bags out of accessories: a seventh category, its own shuffle rail under jackets, and larger jacket/bag rendering"
tags: [research, codebase, categories, shuffle, rail-sizing, paper-doll, persistence, migration]
status: complete
last_updated: 2026-08-02
last_updated_by: Joyce Ma
---

# Research: splitting `bags` out of `accessories`

**Date**: 2026-08-02T09:45:19-05:00
**Researcher**: Joyce Ma
**Git Commit**: `7214a06`
**Branch**: main
**Repository**: joyces-closet

## Research Question

Split `bags` out of `accessories` into its own category: its own section on the shuffle page,
positioned underneath jackets. `accessories` keeps everything else (hair clips, hats, scarves).
Jackets and bags should render a little larger than they do now, and larger than accessories.
How is everything currently rendered, and where else in the app does the new category land?

## Summary

Four findings drive this change.

**1. The desktop grid already has an empty cell exactly where bags should go.** The md+ paper-doll
template is `"jacket top accessory" / ". bottom shoes"` ([src/index.css:328-336](src/index.css#L328))
— the cell directly beneath `jacket` is a literal `.`. Replacing it with `bag` gives the exact
layout requested, and produces a pleasing symmetry: jacket ↔ accessory flank the top row, bag ↔
shoes flank the bottom row. **Mobile has no free cell** and is the one genuine design decision this
change forces (§3.2).

**2. Raising `RAIL_FRAME.jackets` will not make jackets bigger. Not on any screen.** Rail frames are
height caps, but a square garment renders at `min(frameHeight, windowWidth)`, and the jacket
window is narrower than its 256px frame at *every* viewport from 768px up. The jacket rail is
width-bound everywhere; its frame height is currently dead weight. The real lever is the
`grid-template-columns` ratio (§4). On mobile the effect is starker still: every square rail
renders at the same ~101px column width, so a jacket and an accessory are already almost the same
size on a phone (92px vs 82px of garment) regardless of their very different frame heights. That
is very likely what prompted this request.

**3. There are two independent size levers, and only one is retroactive.** `RAIL_FRAME` is
render-time CSS — change it and every existing item resizes. The pipeline's `fillW`/`fillH`
constants are baked into the PNG at upload time — change them and only *future* uploads move
([src/features/uploads/pipeline/constants.ts:73-102](src/features/uploads/pipeline/constants.ts#L73)).
Use `RAIL_FRAME` for the "render bigger" half of this request.

**4. Existing bags are stored as `category: "accessories"` and nothing moves them automatically.**
But the migration is cheaper than the design docs suggest: `PLACEMENT.accessories` (`SQUARE`,
`fillW/fillH: 0.81`) was measured from exactly one PNG — `bag1.png` — so it *is* the bag placement.
If `bags` inherits those numbers, recategorizing is a pure metadata rewrite with no
re-normalization, and `renameUpload`
([src/features/closet/useClosetStore.ts:59-77](src/features/closet/useClosetStore.ts#L59)) is the
exact working precedent for it. That retires the standing "recategorizing is out of scope"
decision for this case specifically.

One trap dominates the risk profile: **tightening `isOutfitShape` to require `bagId` silently
deletes every saved outfit** (§6.2). It must accept `undefined`.

---

## 1. How an item's on-screen size is actually determined

Three multiplied factors, in order:

```
garment pixels  =  fill fraction  ×  min(frame height, window width)
                   └─ baked into    └─ RAIL_FRAME    └─ grid column − 72px
                      the PNG
```

### 1.1 Fill fraction — baked into the PNG at upload

[src/features/uploads/pipeline/constants.ts:73-102](src/features/uploads/pipeline/constants.ts#L73):

```ts
export const PLACEMENT: Record<Exclude<ItemCategory, "tops" | "bottoms">, Placement> = {
  dresses:     { canvas: TALL,   fillW: 0.92, fillH: 0.92, anchor: { kind: "center" } },
  jackets:     { canvas: SQUARE, fillW: 0.91, fillH: 0.91, anchor: { kind: "center" } },  // n=3
  shoes:       { canvas: SQUARE, fillW: 0.9,  fillH: 0.9,  anchor: { kind: "center" } },  // n=1
  accessories: { canvas: SQUARE, fillW: 0.81, fillH: 0.81, anchor: { kind: "center" } },  // n=1
};
```

The garment is composited onto a 1080×1080 canvas occupying `fill` of it; the rest is transparent
padding that is nonetheless part of the `<img>`'s intrinsic box. So an accessory is already 11%
smaller than a jacket at identical frame size, purely from padding.

### 1.2 Frame height — `RAIL_FRAME`, a *cap*

[src/features/closet/railScale.ts:13-20](src/features/closet/railScale.ts#L13):

```ts
export const RAIL_FRAME: Record<ItemCategory, string> = {
  tops: "h-52 sm:h-64",      // 208 / 256px
  bottoms: "h-80 sm:h-96",   // 320 / 384px
  dresses: "h-80 sm:h-96",
  jackets: "h-52 sm:h-64",   // 208 / 256px — equal to tops, by design
  shoes: "h-28 sm:h-32",     // 112 / 128px
  accessories: "h-28 sm:h-32",
};
```

Applied at [src/components/Rail.tsx:256](src/components/Rail.tsx#L256) as the filmstrip window's
class; the `<img>` gets only `max-h-full object-contain` plus `RAIL_IMAGE_WIDTH`
([Rail.tsx:68-75](src/components/Rail.tsx#L68)).

`RAIL_FRAME` is shared with the upload preview by explicit contract
([UploadFlow.tsx:336-344](src/features/uploads/UploadFlow.tsx#L336), copy: *"This is exactly how it
will hang on the rail"*), so any change here moves the preview too — which is correct and desirable.

### 1.3 Window width — the grid column minus 72px

The rail row is `flex w-full`, holding two `shrink-0` `h-9 w-9` arrows with **no gap** and a
`flex-1` window ([Rail.tsx:25-28, 242-259](src/components/Rail.tsx#L242)):

> **window width = grid column width − 72px**

Page geometry: `md:grid-cols-[17rem_1fr]` sidebar, `main` is `max-w-5xl` + `md:px-10`
([Layout.tsx:25, 94-97](src/components/Layout.tsx#L94)).

| viewport | main content | jacket/top col (1.15fr) | jacket window | small col (1fr) | small window |
|---|---|---|---|---|---|
| ≥1296px | 944px | 317.8 | **245.8** | 276.4 | 204.4 |
| 1280px | 928px | 312.3 | 240.3 | 271.6 | 199.6 |
| 1024px | 672px | 223.0 | **151.0** | 193.9 | 121.9 |
| 768px  | 416px | 133.8 | **61.8** | 116.4 | 44.4 |

### 1.4 The consequence: jackets are width-bound at every desktop width

Square art renders at `min(frameHeight, windowWidth)`:

| | frame | window @944 | rendered | bound by |
|---|---|---|---|---|
| jacket | 256 | 245.8 | 245.8 | **width** |
| top (shirt) | 256 | 245.8 | 245.8 | **width** |
| shoes / accessory | 128 | 204.4 | 128 | height |

The jacket window peaks at 245.8px and the frame is 256px — so **`RAIL_FRAME.jackets` never binds
on desktop.** Bumping `h-64` to `h-72` changes nothing visible. Shoes and accessories, by contrast,
*are* height-bound, so their frame heights do work.

Garment pixels at 1440px viewport: jacket `0.91 × 245.8 = 224px`, accessory `0.81 × 128 = 104px` —
a 2.15× ratio.

### 1.5 Mobile: every square rail is the same size

Mobile is 2 equal columns, `column-gap: 0.75rem`, no sidebar:

| viewport | content | column | **window (all rails)** |
|---|---|---|---|
| 390px | 358 | 173 | **101** |
| 430px | 398 | 193 | **121** |

At 390px a jacket (frame 208) and an accessory (frame 112) *both* render at 101px, because both
are width-bound by the same column. Garment pixels: jacket `0.91 × 101 = 92px`, accessory
`0.81 × 101 = 82px` — a **1.12× ratio**. On a phone the two slots are effectively the same size
today, and no `RAIL_FRAME` edit can change that. Only a column/span change can.

(Bottoms escape this because `"bottom bottom"` spans both columns → window 286px.)

**Breakpoint mismatch worth noting:** `RAIL_FRAME` switches at `sm:` (640px) while `.paper-doll`
switches at 768px, so 640–767px runs desktop frame heights against the mobile 2-column grid.

---

## 2. Everything that must change (inventory)

### 2.1 Compile errors — TypeScript will find these for you

Adding `"bags"` to `ItemCategory`
([src/features/closet/types.ts:1-2](src/features/closet/types.ts#L1)) breaks nine exhaustive maps:

| File:line | Map | Suggested `bags` value |
|---|---|---|
| [railScale.ts:13](src/features/closet/railScale.ts#L13) | `RAIL_FRAME` | larger than accessories — see §4 |
| [railScale.ts:23](src/features/closet/railScale.ts#L23) | `RAIL_IMAGE_WIDTH` | `"max-w-full"` |
| [railScale.ts:33](src/features/closet/railScale.ts#L33) | `RAIL_ALIGN` | `"center"` |
| [railScale.ts:43](src/features/closet/railScale.ts#L43) | `CATEGORY_TINT` | `"text-tint-bags"` → needs 6 new CSS hexes |
| [railScale.ts:52](src/features/closet/railScale.ts#L52) | `CATEGORY_LABEL` | `"Bags"` |
| [uploads/naming.ts:5](src/features/uploads/naming.ts#L5) | `CATEGORY_NOUN` | `"Bag"` (singular) |
| [CategoryShape.tsx:12](src/components/CategoryShape.tsx#L12) | `SHAPE_PATH` | a 7th hand-drawn silhouette |
| [Aura.tsx:4](src/components/Aura.tsx#L4) | `POOL_TINT` | `"aura-pool-bags"` → needs new CSS |
| [pipeline/constants.ts:73](src/features/uploads/pipeline/constants.ts#L73) | `PLACEMENT` | `SQUARE, 0.81, center` — see §5 |

Plus `Closet = Record<ItemCategory, ClosetItem[]>`
([types.ts:21](src/features/closet/types.ts#L21)) and the one hand-built `Closet` literal, the test
fixture at [shuffle.test.ts:28-36](src/features/shuffle/shuffle.test.ts#L28).

### 2.2 Silent runtime failures — nothing will find these for you

**This is where the data loss lives.** The six category strings are hardcoded in four separate
places, none of them type-checked for completeness:

| File:line | What | If forgotten |
|---|---|---|
| [railScale.ts:62-69](src/features/closet/railScale.ts#L62) `CATEGORIES` | manifest order, iterated by ClosetPage + UploadFlow | bags never appear as a closet section and can never be picked at upload |
| [closet/merge.ts:3-10](src/features/closet/merge.ts#L3) `CATEGORIES` | `toCloset` builds the `Closet` record from this list | `closet.bags` is `undefined` → `closet[category].some(...)` **throws** |
| [uploads/indexedDbStore.ts:7-14](src/features/uploads/indexedDbStore.ts#L7) `Set` | `isUploadRecord` guard, applied on `list()` | bags save fine, show all session, then **vanish on reload** — `list()` swallows errors, so it looks like a mystery bug |
| [uploads/backup.ts:18-25](src/features/uploads/backup.ts#L18) `Set` | `isBackupItem` guard on import | bags silently dropped from backups, counted only as `skipped` |

The worst compound path: update `backup.ts` but not `indexedDbStore.ts`, and an import reports
`skipped: 0`, shows the bags, then loses them on refresh.

**Worth doing as part of this change:** collapse all four onto one `as const` array in `types.ts`
and derive `ItemCategory` from it, so the union and the runtime lists cannot drift again.

### 2.3 CSS — also silent

- **`--color-tint-bags` × 6** — the `@theme` default ([index.css:19-25](src/index.css#L19)) plus
  five theme presets (lines 161, 181, 201, 221, 241). Without the `@theme` entry Tailwind never
  generates `text-tint-bags` and `CategoryShape` renders colourless. Constraint from
  `2026-07-17-ui-artistic-polish.md` Decision 2: *"muted enough to avoid a sticker-chart look."*
- **`.aura-pool-bags`** ([index.css:740-775](src/index.css#L740)) — a 7th block with a distinct
  `animation-delay`; the ladder is −4s/−11s/−18s/−25s/−32s/−39s against a 48s cycle, so −46s fits.
  The comment above it is explicit that no two pools may breathe in phase.
- **`.paper-doll` grid areas** ([index.css:316-339](src/index.css#L316)) — §3.
- **`.wash-*`** ([index.css:373-388](src/index.css#L373)) — do **not** touch. `OutfitCard`'s
  `WASH_CLASSES` is a 6-entry hash palette for scrapbook variety, unrelated to an outfit's actual
  contents. Adding a 7th changes the modulo and recolors every existing saved card.

### 2.4 The 7th `CategoryShape`

Current mapping (2026-07-30 ribbons-and-shapes Decision 4): tops = sun, bottoms = crescent moon,
dresses = star, jackets = cloud, shoes = 4-point sparkle, accessories = heart. A bags shape must be
**one merged subpath** centred on (12,12) — the fill + radial-highlight idiom at
[CategoryShape.tsx:70-71](src/components/CategoryShape.tsx#L70) depends on a single `d` — must read
solid at 12px, and must stay distinct from all six above *and* from the theme-picker flower
(Decision 5). A rounded diamond, a teardrop, or a leaf are the easiest single-subpath candidates.

---

## 3. Shuffle page layout

### 3.1 Desktop — a one-word change

[src/index.css:328-336](src/index.css#L328):

```css
@media (min-width: 768px) {
  .paper-doll {
    grid-template-areas:
      "jacket top accessory"
      ".      bottom shoes";
    grid-template-columns: 1.15fr 1.15fr 1fr;
    column-gap: 1rem;
  }
}
```

`.` → `bag`. The result mirrors cleanly — jacket ↔ accessory on the top row, bag ↔ shoes on the
bottom row — and bags inherit the jacket column's generous width, which is what makes them able to
render large.

Alignment: jacket, shoes and accessory each carry `md:self-center`
([ShufflePage.tsx:147, 183, 198](src/features/shuffle/ShufflePage.tsx#L147)) against the grid's base
`align-items: end`. Giving bags `md:self-center` mirrors shoes; `md:self-start` would tuck it
directly under the jacket instead. Row 2's height is set by the bottoms rail (384px), so there is
room for either.

One caveat: the jacket column is the documented landing zone for the save popover
(`thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md:113-125`). Changing its
width re-opens that geometry table.

### 3.2 Mobile — the one real design decision

[src/index.css:317-326](src/index.css#L317):

```css
grid-template-areas:
  "jacket top"
  "bottom bottom"
  "shoes accessory";
grid-template-columns: 1fr 1fr;
```

Six rails must fit two columns, and `bottom` spans both — so five rails need three rows, which
means one cell is left over however it is arranged. Three viable shapes:

**A — bag under jacket, hole under top**
```
"jacket top"
"bag    ."
"bottom bottom"
"shoes  accessory"
```
Literally matches the request and mirrors desktop. But bags stays in a half column, so it renders
at the same ~101px as everything else — it cannot be visibly larger than accessories on a phone.

**B — bag gets its own full-width row** *(recommended)*
```
"jacket top"
"bag    bag"
"bottom bottom"
"shoes  accessory"
```
Window becomes 286px instead of 101px, so a bag at `h-40` renders `0.81 × 160 = 130px` against an
accessory's 82px — the size hierarchy the request asks for actually survives on mobile. Costs one
full-width row of vertical space for one small item, and breaks the paired-row rhythm.

**C — bag pairs with shoes, accessory orphaned**
```
"jacket    top"
"bottom    bottom"
"bag       shoes"
"accessory ."
```
Keeps the paired rhythm but abandons "bags under jackets" on mobile.

**Also**: in dress mode the bottoms rail is not rendered
([ShufflePage.tsx:163](src/features/shuffle/ShufflePage.tsx#L163)) and its md-only row span does not
apply below 768px, so the mobile `bottom` row already collapses to zero height while keeping both
its row gaps — a pre-existing ~3rem stray gap that any new row arrangement will inherit.

### 3.3 The rail itself

`Rail.tsx` has **zero per-category branching** — `category` is used only for the decorative
`CategoryShape` ([Rail.tsx:228](src/components/Rail.tsx#L228)). A bags rail is a copy of the
accessories rail at [ShufflePage.tsx:198-212](src/features/shuffle/ShufflePage.tsx#L198) with
`allowNone`, `emptyLabel="no bag"`, `RAIL_FRAME.bags`, `category="bags"`.

`CASCADE_MS` ([ShufflePage.tsx:14-20](src/features/shuffle/ShufflePage.tsx#L14)) is a 5-entry ladder
in 70ms steps ending at `accessory: 280`; a `bag` phase slots in — cascade order should follow
visual top-to-bottom, so probably between `bottom: 140` and `shoes: 210`, which means renumbering.
2026-07-30 shuffle-rail-slide-animation Decision 3 locked the stagger as "preserved exactly", so
this is worth a deliberate note rather than a silent renumber.

---

## 4. Making jackets and bags render larger

Because jackets are width-bound (§1.4), the frame height is the wrong knob on its own. Both knobs
must move together:

1. **Widen the jacket column** in `grid-template-columns`, taking from the small-slot column
   (which should get relatively smaller anyway, since accessories are meant to shrink in the
   hierarchy).
2. **Raise `RAIL_FRAME.jackets`** so the new width isn't immediately re-capped by the old 256px
   height.

Worked illustration with `1.3fr 1.2fr 0.85fr` at 944px content and `RAIL_FRAME.jackets = "h-56 sm:h-72"`:

| slot | column | window | frame | rendered | garment | vs today |
|---|---|---|---|---|---|---|
| jacket | 353.9 | 281.9 | 288 | 281.9 | **256px** | 224 → +14% |
| top | 326.7 | 254.7 | 256 | 254.7 | 239px | 231 → +3% |
| bag | 353.9 | 281.9 | *192 (`h-48`)* | 192 | **156px** | new |
| shoes | 231.4 | 159.4 | 128 | 128 | 115px | unchanged |
| accessory | 231.4 | 159.4 | 128 | 128 | **104px** | unchanged |

That yields jacket 256 > bag 156 > accessory 104 — the requested hierarchy, with accessories
untouched. Numbers are illustrative; the plan should tune them.

Note the shared-scale contract this touches: `railScale.ts:3-12` documents *"Tops and jackets render
at equal scale"*, and the CSS comment at [index.css:332-333](src/index.css#L332) says the jacket
column was sized to match the centre for exactly that reason. Making jackets larger than tops is a
deliberate reversal of a documented decision (originally jackets were planned *smaller* than tops,
`h-40 sm:h-52`, before being raised to parity) and should be recorded as such.

If accessories should also visibly shrink, the cheaper lever is `RAIL_FRAME.accessories` (they are
height-bound, so it works directly) — e.g. `h-24 sm:h-28`.

---

## 5. The upload pipeline, and why bags should inherit 0.81

The `accessories` placement was derived from measuring the built-in PNGs on 2026-07-27, and the
sample size was **one image: `bag1.png`**. Still visible in the fixture table at
[normalize.test.ts:33](src/features/uploads/pipeline/normalize.test.ts#L33):

```ts
["bag1.png", "accessories", 1080, 1080, 872, 819],
```

Two consequences:

1. **`bags: { canvas: SQUARE, fillW: 0.81, fillH: 0.81, anchor: center }` carries real provenance.**
   Whatever remains under `accessories` (hats, clips, scarves) then has *zero* measured backing —
   the same "DERIVED, not measured" status the plan already flags for dresses. Worth a comment.
2. **Identical placement makes migration free** (§6.1). If bags instead get a different fill,
   every already-uploaded bag keeps accessory scale forever — the original upload is not retained,
   only the composited PNG — so migrated and newly-uploaded bags would render at visibly different
   sizes in the same rail.

The regression test pins these: `TIGHT` at
[normalize.test.ts:78-85](src/features/uploads/pipeline/normalize.test.ts#L78) requires measured
fills within 0.02, and `BY_NAME` maps fixtures to placements. Since the built-in PNGs were removed
when the closet became uploads-only, **this fixture table is now the only surviving record of the
measurements** — moving `bag1.png`'s row to `bags` leaves `accessories` with no fixture at all.

---

## 6. Persistence and data migration

### 6.1 Existing bags are filed as `accessories`

`UploadRecord` stores `category` verbatim
([uploads/types.ts:8-17](src/features/uploads/types.ts#L8)); the IndexedDB is
`joyces-closet:uploads:v1` at version literal `1` with an upgrade handler that only creates the
object store ([indexedDbStore.ts:55-62](src/features/uploads/indexedDbStore.ts#L55)) — no migration
hook, and it does not capture `request.transaction`, which an in-upgrade rewrite would need.

Nothing in the app can tell a bag from a scarf: `name` is free text and `subtype` is tops-only.
So recategorizing has to be user-driven or a one-shot script.

`2026-07-27-clothing-image-upload.md` Decision 1 says *"Recategorizing an upload is out of scope
(it would require re-normalization onto a different canvas — delete and re-upload instead)."*
**That reasoning does not apply here**, provided bags share the accessories placement: same canvas,
same fill, same anchor means the stored blob is already correct and only the `category` string
changes. And there is a working precedent for exactly that edit — `renameUpload`
([useClosetStore.ts:59-77](src/features/closet/useClosetStore.ts#L59)):

```ts
// Re-saving the whole record keeps the blob intact; only the name differs. The object
// URL is untouched, so the rendered image never flickers.
await uploadStore.save({ ...record, name: trimmed });
```

A `recategorizeUpload(id, category)` is the same five lines. A small "move to Bags" affordance on
the closet tile is the cheapest complete answer, and avoids IndexedDB version bumps entirely —
worth noting that bumping to v2 has its own hazard: `onblocked` rejects hard
([indexedDbStore.ts:66-67](src/features/uploads/indexedDbStore.ts#L66)) and `list()` swallows the
rejection into `[]`, so a second open tab would see an empty closet.

### 6.2 The `bagId` trap — highest risk in the change

Adding `bagId: string | null` to `Outfit`
([shuffle/outfit.ts:8-13](src/features/shuffle/outfit.ts#L8)) is the right shape (optional slot,
matching `jacketId`/`accessoryId`). But `isOutfitShape`
([outfit.ts:28-50](src/features/shuffle/outfit.ts#L28)) is the read gate for saved outfits, and:

```ts
const optionalOk = (field: unknown) => field === null || typeof field === "string";
```

An outfit stored before this change has **no `bagId` key**, so `outfit.bagId` is `undefined`, which
fails both branches. Add `optionalOk(outfit.bagId)` naively and every saved outfit fails the guard.
That is not a display bug — it is deletion, because every mutation is read-filter-write-the-whole-array
([localStorageStore.ts:48-62](src/features/outfits/localStorageStore.ts#L48)). The next save or
delete persists the filtered array and the outfit history is gone.

The same `undefined` hazard applies to `isOutfitValid`
([outfit.ts:57-76](src/features/shuffle/outfit.ts#L57)): a clause mirroring the accessory one would
evaluate `undefined === null` → `false`, then `inCategory(closet, "bags", undefined)` → `false`,
marking **every legacy outfit invalid**. That flows into `OutfitCard`'s "some items are no longer
in the closet" caption and `useShuffleStore`'s repair decision.

**Fix:** normalize a missing `bagId` to `null` at the read boundary, or accept `undefined` in the
guard. `isOutfitShape` is also reused by backup import
([backup.ts:100-110](src/features/uploads/backup.ts#L100)), and backup files on disk are permanent
artifacts — so this validator must stay permissive about a missing `bagId` **forever**.

### 6.3 The rest of the persistence surface

| Store | Key | Impact |
|---|---|---|
| Current outfit (zustand `persist`) | `joyces-closet:current-outfit`, version defaults to `0` | Low stakes. Its `merge` ([useShuffleStore.ts:105-118](src/features/shuffle/useShuffleStore.ts#L105)) discards anything failing the guards and falls back to a fresh shuffle. Bumping `version` with no `migrate` is a clean deliberate reset (one `console.error`). |
| Saved outfits | `joyces-closet:saved-outfits:v1` | §6.2. No in-value version field — the `:v1` is key-name only, so changing it orphans rather than migrates. |
| Week plan | `joyces-closet:plan:v1` | **No change.** Plan entries carry only a `SavedOutfit` id, no category, no slot ([plan.ts:16-18](src/features/week/plan.ts#L16)). |
| Backup file | `version: 1`, gate is `>` only | Keep at version 1 (the precedent set for `plans` in week-planning Decision 8). Old builds then drop bags per-item into `skipped` rather than rejecting the whole file. |

Compile-time safety net for the slot addition: `repairOutfit` ([outfit.ts:105-127](src/features/shuffle/outfit.ts#L105))
and `shuffleOutfit` ([shuffle.ts:94-103](src/features/shuffle/shuffle.ts#L94)) both build complete
object literals, so TypeScript forces both. The two exhaustive switches — `SlotName`/`shuffleSlot`
([shuffle.ts:112-154](src/features/shuffle/shuffle.ts#L112)) and `EditableSlot`/`applySlot`
([useShuffleStore.ts:38-55](src/features/shuffle/useShuffleStore.ts#L38)) — error under
`noFallthroughCasesInSwitch` once the unions widen. `outfitUsesItem`
([outfit.ts:83-95](src/features/shuffle/outfit.ts#L83)) will **not** error and must be updated by
hand — it drives the delete-confirmation's "worn in N outfits" count.

---

## 7. Other surfaces the new category touches

### 7.1 Free — no work needed

`ClosetPage` iterates `CATEGORIES` and gets a bags section, header, tint marker and aura pool
automatically ([ClosetPage.tsx:309-347](src/features/closet/ClosetPage.tsx#L309)). `UploadFlow`'s
picker likewise gets a seventh button ([UploadFlow.tsx:271-291](src/features/uploads/UploadFlow.tsx#L271))
— though the grid is `grid-cols-2 sm:grid-cols-3`, so seven items leaves a ragged last row. The
whole of `src/features/week/` is category-free. `merge.ts:buildIndex`, `useClosetStore`,
`toClosetItem`, `hydrate`, and every pipeline stage except `constants.ts` are category-opaque.

Note `ClosetPage`'s tile is a uniform `aspect-square` with no per-category sizing
([ClosetPage.tsx:102-108](src/features/closet/ClosetPage.tsx#L102)) — it does not read `railScale.ts`
at all, so nothing there needs touching.

### 7.2 `OutfitCard` — the one place with no free space

The mini paper doll ([OutfitCard.tsx:84-127](src/features/outfits/OutfitCard.tsx#L84)) is five
absolutely-positioned boxes in an `aspect-3/4` card, and both lower corners are taken:

```tsx
<Thumbnail id={shoesId}     className="right-0 bottom-0 h-[18%] w-[38%]" />
<Thumbnail id={accessoryId} className="bottom-0 left-0  h-[22%] w-[30%]" />
```

A sixth thumbnail needs a position that does not collide with jacket (`top-0 left-0 h-[46%] w-[58%]`)
or the bottoms boxes (`top-[38%]`/`top-[42%]`, centred). The gap is mid-left, roughly
`top-[46%] left-0`. This component is reused by the week page for both day rows and the assign
picker ([DayBox.tsx:104-130](src/features/week/DayBox.tsx#L104),
[AssignPanel.tsx:142-158](src/features/week/AssignPanel.tsx#L142)), where cells are as small as
80px wide — a 6th thumbnail there is ~15px tall. Worth checking whether bags belong on the card at
all, or only on the shuffle rail.

Optional slots render nothing when empty here ([OutfitCard.tsx:64-82](src/features/outfits/OutfitCard.tsx#L64)),
so an outfit with no bag simply has a gap — no placeholder needed.

### 7.3 Shuffle probability changes

`pickOptional` gives each optional slot a uniform `1/(n+1)` chance of "none" — confirmed by the user
on 2026-07-13 to match the old app's `none.png` odds
([shuffle.ts:29-36](src/features/shuffle/shuffle.ts#L29)). Splitting one optional slot into two
changes the arithmetic: with `a` bags and `b` other accessories, P(no bag) = `1/(a+1)` and
P(no accessory) = `1/(b+1)` independently. So **bare-flank outfits get rarer** (`1/((a+1)(b+1))`
instead of `1/(a+b+1)`) and **each individual bag appears far more often**. Probably desirable —
a bag is worn most days — but it is a real behavior change, not a side effect.

`MissingCategory` ([shuffle.ts:62](src/features/shuffle/shuffle.ts#L62)) needs no change: bags are
optional, so the closet can still dress without them.

---

## Code References

- `src/features/closet/types.ts:1-21` — `ItemCategory`, `Closet`
- `src/features/closet/railScale.ts:13-69` — all five per-category maps plus `CATEGORIES`
- `src/features/closet/merge.ts:3-10` — duplicate `CATEGORIES`, load-bearing for `toCloset`
- `src/features/closet/useClosetStore.ts:59-77` — `renameUpload`, the recategorize precedent
- `src/features/shuffle/outfit.ts:28-50` — `isOutfitShape`, the data-loss trap
- `src/features/shuffle/outfit.ts:57-127` — `isOutfitValid`, `outfitUsesItem`, `repairOutfit`
- `src/features/shuffle/shuffle.ts:29-36` — `pickOptional`, the 1/(n+1) none convention
- `src/features/shuffle/ShufflePage.tsx:14-20` — `CASCADE_MS`
- `src/features/shuffle/ShufflePage.tsx:147-212` — jacket / shoes / accessory rails
- `src/components/Rail.tsx:242-259` — the arrows-plus-window row that sets effective width
- `src/components/CategoryShape.tsx:12-39` — the six silhouettes
- `src/index.css:316-339` — `.paper-doll` at both breakpoints
- `src/index.css:19-25, 161-246` — 36 category tint hexes
- `src/index.css:740-775` — the six aura pools
- `src/features/uploads/pipeline/constants.ts:73-102` — `PLACEMENT`
- `src/features/uploads/pipeline/normalize.test.ts:33` — the `bag1.png` fixture row
- `src/features/uploads/indexedDbStore.ts:7-29` — the silent read-side allowlist
- `src/features/uploads/backup.ts:18-27, 81-98` — the silent import-side allowlist
- `src/features/outfits/OutfitCard.tsx:84-127` — the mini paper doll
- `src/features/outfits/localStorageStore.ts:24-62` — read-filter-write-whole-array

## Architecture Insights

- **The category set fans out through two channels with opposite ergonomics.** `Record<ItemCategory, X>`
  maps fail loudly at compile time (9 of them); bare `string[]`/`Set` allowlists fail silently at
  runtime (4 of them). Every genuine data-loss risk in this change lives in the second group.
- **Size is a three-factor product across two lifecycles.** Fill fraction is baked at upload and is
  not retroactive; frame height and column width are render-time and are. Any "make X bigger"
  request should be answered with render-time levers unless a re-upload is acceptable.
- **`min(frameHeight, windowWidth)` means half the `RAIL_FRAME` map is inert.** Tops and jackets are
  width-bound at every viewport; only shoes, accessories and bottoms are actually governed by their
  frame heights. This is not documented anywhere and is the most surprising finding here.
- **`accessories` has always been the bag category wearing a general name.** Its only measured
  sample and the legacy app's only accessory image were both `bag1.png`. The split is arguably a
  renaming plus a new genuinely-general category, not a subdivision.
- **The mobile paper-doll has no slack.** Six rails, two columns, one full-width span — every
  arrangement leaves a hole. That is the structural reason mobile needs a decision that desktop
  does not.

## Historical Context (from thoughts/)

- `thoughts/shared/decisions/2026-07-13-closet-rebuild.md` — Decision 7 fixes the slot model and the
  six categories; the codebase-findings section records the legacy inventory as *"1 accessory (bag)"*.
  Decision 9 makes mobile-first binding.
- `thoughts/shared/decisions/2026-07-13-ui-redesign.md` — Decision 6, the paper-doll composition:
  *"jacket flanks the top, accessory sits near the shoes."*
- `thoughts/shared/plans/2026-07-13-closet-rebuild.md:44` — the user's 2026-07-13 confirmation that
  optional slots keep uniform `1/(n+1)` none-odds.
- `thoughts/shared/plans/2026-07-13-ui-redesign-warm-editorial-boutique.md:550-558` — jackets were
  originally planned *smaller* than tops (`h-40 sm:h-52`) before being raised to parity.
- `thoughts/shared/decisions/2026-07-17-ui-artistic-polish.md` — Decisions 2 and 5: per-category
  tints, muted, re-derived per theme. No spare tokens exist.
- `thoughts/shared/decisions/2026-07-27-clothing-image-upload.md` — Decision 1 (recategorizing out of
  scope), Decision 5 (fill constants measured, preview at real rail scale).
- `thoughts/shared/plans/2026-07-27-clothing-image-upload.md:1226-1245` — the provenance table;
  accessories n=1, worst err 0.003.
- `thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md` — Decision 4, the fixed
  shape iconography and its drawing constraints.
- `thoughts/shared/plans/2026-07-30-shuffle-rail-slide-animation.md` — Decision 2 ("none" is a real
  frame that slides), Decision 3 (stagger preserved exactly).
- `thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md:113-139` — the jacket
  column geometry table; the save popover lands in that column.
- `thoughts/shared/decisions/2026-07-31-week-planning.md` — Decision 8 (add backup fields, stay at
  version 1), Decision 10 (the precedent for expanding a closed token set by hand-authoring into
  `@theme` plus all five presets).
- `thoughts/shared/decisions/2026-07-31-page-auras.md` — Decisions 2, 10, 11: six tints, six pools,
  pools are unconditional so an empty bags section still gets one.

## Related Research

- `thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md` — rail frame heights and the
  `height × aspect` sizing model
- `thoughts/shared/research/2026-07-30-shuffle-carousel-animation-options.md` — rail frame heights
  and the dress-flip gotcha
- `thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md` — desktop column geometry

## Open Questions

1. **Mobile grid arrangement** (§3.2) — A, B, C, or something else. Option B is the only one where
   bags can visibly outrank accessories on a phone.
2. **Does bags belong on `OutfitCard`?** There is no free corner, and the week page renders the same
   component at 80px wide. Omitting it there is defensible.
3. **How do existing bags move out of `accessories`?** A `recategorizeUpload` affordance in the
   closet (cheap, precedented) versus delete-and-re-upload (zero code, real user cost).
4. **Should jackets now exceed tops?** `railScale.ts:3-12` and `index.css:332-333` both document
   deliberate tops/jackets parity. Making jackets larger reverses it.
5. **Should accessories also shrink?** They are height-bound, so `RAIL_FRAME.accessories` works
   directly — the cheapest way to widen the hierarchy without touching anything else.
6. **Cascade position for the bags rail** — inserting `bag` renumbers a stagger that a prior
   decision locked as "preserved exactly".
7. **Which measured fill does `accessories` keep?** After bags takes `bag1.png`'s 0.81 provenance,
   the residual category has no measured sample — same status as dresses.
