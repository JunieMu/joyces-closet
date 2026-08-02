---
date: 2026-08-02
source: grill-to-decisions
input: thoughts/shared/research/2026-08-02-bags-category-split.md
status: decided
---

# Design Decisions: bags category split

Splitting `bags` out of `accessories` into a seventh category with its own shuffle rail under
jackets, and enlarging the jacket and bag slots relative to accessories.

The functional goal: today the shuffle deals one "accessory", and since that bucket is mostly bags
you get *either* a bag *or* a hair clip. After this, the shuffle dresses the way Joyce actually
dresses — a bag on one hand, and separately a hat/clip/scarf if the day calls for it. `accessories`
becomes genuinely general (hair clips, hats, scarves).

---

## Decision 1: `bags` is a seventh category AND a full optional outfit slot

**Context**: The request is for a rail on the shuffle page, which means `bags` cannot be a
closet-only category — it has to enter the `Outfit` shape and be persisted.

**Options**: Closet category only (browsable, uploadable, no rail) — half the work, but doesn't
deliver the request · Full slot — adds `bagId` to `Outfit` and cascades through the persistence
layer.

**Decision**: Full slot. `Outfit` gains `bagId: string | null`, following the `jacketId` /
`accessoryId` pattern exactly: optional, filled by `pickOptional` with uniform `1/(n+1)` none-odds
(the convention confirmed 2026-07-13, `shuffle.ts:29-36`), `emptyLabel="no bag"`, and a real
browsable "none" frame on the rail. `SlotName` gains `"bag"`, `EditableSlot` gains `"bag"`.
`MissingCategory` is unchanged — bags are optional, so the closet can still dress without them.

**Accepted behavioral change**: two independent optional slots means P(bag) and P(accessory) roll
separately. Bare-flank outfits get rarer (`1/((a+1)(b+1))` instead of `1/(a+b+1)`), and each
individual bag appears far more often since it competes against the other bags rather than against
every accessory. This is the point of the feature, not a side effect.

---

## Decision 2: `bags` gets its own placement constants; existing items are not migrated

**Context**: Joyce has exactly **one** bag uploaded, currently filed as `category: "accessories"`.
`PLACEMENT.accessories` (`SQUARE`, `fillW/fillH: 0.81`) was measured from a single image —
`bag1.png` — so it is empirically the bag number
(`src/features/uploads/pipeline/normalize.test.ts:33`).

**Options**: **A** — bags inherits `0.81`, making recategorization a pure metadata rewrite, plus a
"move to Bags" control on the closet tile · **B** — bags gets its own tighter fill; existing bags
keep accessory scale forever (the original upload isn't retained, only the composited PNG), so they
must be deleted and re-uploaded.

**Decision**: **B**, with `fillW/fillH: 0.90`. With one bag to re-upload the mixed-scale downside
evaporates, and fill is the *only* size lever that reaches the closet-page tile and the outfit-card
thumbnail, where `RAIL_FRAME` does not apply.

```ts
bags: { canvas: SQUARE, fillW: 0.9, fillH: 0.9, anchor: { kind: "center" } },
```

Mark it DERIVED, not measured — same status as `dresses`. The `bag1.png` fixture row **stays under
`accessories`**, so `BY_NAME` and `TIGHT` in `normalize.test.ts` need no change and `accessories`
keeps its measured backing. No migration path, no recategorize control (see Out of Scope).

---

## Decision 3: Desktop — bag fills the empty cell under jacket

**Context**: The md+ template at `src/index.css:328-336` is
`"jacket top accessory" / ". bottom shoes"` — the cell directly beneath `jacket` is a literal `.`.

**Decision**: `.` → `bag`. This is exactly the requested position and produces a clean mirror:
jacket ↔ accessory flank the top row, bag ↔ shoes flank the bottom row. The bag wrapper gets
`md:self-center`, mirroring shoes across that row (row height is set by the 384px bottoms rail, so
there is room).

---

## Decision 4: Mobile — bag gets its own full-width row, and is allowed to outrank the jacket

**Context**: Mobile is two equal columns with `bottom` spanning both, so six rails need three rows
and every arrangement leaves a hole. Critically, **every half-column rail is clamped to the same
~101px window** regardless of frame height — which is why the jacket (92px of garment) and an
accessory (82px) are already nearly the same size on a phone. The spanning row is the only slot
whose size is actually controllable there.

**Options**: **A** — `"bag ."` under the jacket; mirrors desktop but bags can never be visibly
bigger than an accessory on a phone · **B** — `"bag bag"` full-width row · **C** — bag pairs with
shoes, abandoning "under jackets" on mobile.

**Decision**: **B**.

```css
grid-template-areas:
  "jacket top"
  "bag    bag"
  "bottom bottom"
  "shoes  accessory";
```

And the bag is allowed to be the **mobile hero**: `RAIL_FRAME.bags: "h-32 sm:h-48"` puts it at
~115px against the jacket's 92px and an accessory's 82px. Desktop keeps jacket > bag; mobile flips
to bag > jacket. The inconsistency across breakpoints is accepted deliberately — each reads
correctly on its own screen, a bag genuinely is a hero object, and shrinking the bag to tuck under
the jacket's fixed 92px would leave it only ~5% larger than an accessory, i.e. spending a full-width
row for a difference nobody can see.

---

## Decision 5: The size numbers

**Context**: `garment px = fill × min(frameHeight, windowWidth)`, where `windowWidth = grid column −
72px` (two `h-9 w-9` arrows, no gap, `Rail.tsx:242-259`). **Jackets are width-bound at every
viewport ≥768px** — the window peaks at 245.8px against a 256px frame — so raising
`RAIL_FRAME.jackets` alone changes nothing visible. The column ratio is the real lever.

**Decision**: widen only the jacket column, and raise the frame so it doesn't immediately re-cap.

```css
grid-template-columns: 1.3fr 1.15fr 0.85fr;   /* was 1.15fr 1.15fr 1fr */
```
```ts
jackets: "h-56 sm:h-72",   // was "h-52 sm:h-64"
bags:    "h-32 sm:h-48",   // new
```

Resulting garment sizes at 944px content (viewport ≥1296px):

| slot | now | after |
|---|---|---|
| top | 231px | 231px — unchanged |
| jacket | 224px | **261px** (+17%) |
| bag | — | **173px** |
| shoes | 115px | 115px — unchanged |
| accessory | 104px | 104px — unchanged |

Only the jacket column moves; tops, shoes and accessories are arithmetically untouched. This also
gives the save popover *more* landing room (it opens from the sidebar into the jacket column,
`thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md:113-125`), so it is
strictly safer than the status quo.

**This reverses documented tops/jackets parity** (`railScale.ts:3-12`, `index.css:332-333`).
Intentional — update those comments rather than leaving them contradicting the code.

---

## Decision 6: `RAIL_FRAME.accessories` is untouched

**Context**: The request was for jackets and bags to be larger, not for accessories to be smaller.

**Decision**: Leave `accessories: "h-28 sm:h-32"` alone. Shrinking it risks hats and clips becoming
genuinely hard to identify, and would push accessories below shoes in the same md column where the
difference is directly visible. The hierarchy is achieved by raising jackets and adding bags.

---

## Decision 7: Outfit card — bag bottom-left, accessory directly above it

**Context**: `OutfitPreview` (`src/features/outfits/OutfitCard.tsx:84-127`) is five
absolutely-positioned boxes in an `aspect-3/4` card; both lower corners are taken (shoes right,
accessory left). It is reused by the week page at cells as small as 80px wide.

**Options**: bag in the free mid-left gap, accessory stays bottom-left · **swap them** — bag takes
bottom-left, accessory moves up.

**Decision**: **Swap.** Bag at `bottom-0 left-0` (~`h-[24%] w-[34%]`), accessory just above at
~`top-[48%] left-0` (~`h-[20%] w-[26%]`), shoes unchanged at `right-0 bottom-0`. Semantically right
— hats and clips ride high on the body, a bag hangs at hip level — and it makes the bag the larger
of the two, matching the rail hierarchy. Percentages are indicative; tune against the real card.

Empty optional slots already render nothing (`OutfitCard.tsx:64-82`), so an outfit with no bag
simply has a gap. No placeholder needed.

---

## Decision 8: Identity — teardrop silhouette, muted dusty blue tint

**Context**: Every category has a fixed 12px silhouette (2026-07-30 ribbons-and-shapes Decision 4)
and one hand-picked tint hex per theme × 6 themes (2026-07-17 ui-artistic-polish Decisions 2 & 5).
There are no spare tokens.

**Decision**:
- **Shape: teardrop.** Must be a single merged subpath centred on (12,12) — the fill + radial
  highlight idiom at `CategoryShape.tsx:70-71` depends on one `d`. Reads solid at 12px and does not
  blur against sun / moon / star / cloud / sparkle / heart, or the theme-picker flower.
- **Tint: a muted dusty blue**, ~`#8b9bb5` for the `@theme` default and rosewood. Blue is the one
  region of the wheel the six existing tints don't occupy.
- **Caveat the planner must honor**: re-derive per theme rather than copying the hex.
  **Seaglass already uses a dusty blue for tops (`#8fa9b8`)** — bags needs a different hue in that
  preset. All six values must stay in the "heavily muted watercolor" register.
- `CATEGORY_LABEL.bags = "Bags"`, `CATEGORY_NOUN.bags = "Bag"` (singular — it names one garment).
- `.aura-pool-bags` needs a 7th `animation-delay`; the existing ladder is −4s/−11s/−18s/−25s/−32s/
  −39s against a 48s cycle, so **−46s** continues it. No two pools may breathe in phase.

---

## Decision 9: Cascade ladder extends to six rails

**Context**: `CASCADE_MS` (`ShufflePage.tsx:14-20`) is a 70ms step in body order — top → jacket →
bottom → shoes → accessory, finishing touches last. 2026-07-30 shuffle-rail-slide-animation
Decision 3 locked the stagger as "preserved exactly"; a sixth rail necessarily extends it.

**Decision**: keep the 70ms step and insert `bag` before `accessory` (a carried finishing touch):
`top 0, jacket 70, bottom 140, shoes 210, bag 280, accessory 350`. The last rail now settles at
750ms instead of 680ms.

---

## Decision 10: Manifest order — bags after jackets

**Context**: `CATEGORIES` (`railScale.ts:62-69`) drives both the closet page section order and the
upload category picker.

**Decision**: `tops, bottoms, dresses, jackets, bags, shoes, accessories`. Mirrors the shuffle
page's left column (jacket above bag) and preserves the big→small gradient.

---

## Decision 11: Legacy outfits gain `bagId` by normalizing before validating

**Context**: The highest-risk item in the change. Every stored outfit lacks `bagId`, so
`outfit.bagId` is `undefined`. `isOutfitShape`'s `optionalOk` is
`field === null || typeof field === "string"` (`outfit.ts:41-42`) — `undefined` fails both branches.
And `localStorageStore` reads-filters-writes the whole array (`localStorageStore.ts:48-62`), so
anything the guard rejects is **permanently deleted** on the next save or delete. The same
`undefined` hazard would make `isOutfitValid` mark every legacy outfit invalid.

**Options**: **A** — loosen `optionalOk` to accept `undefined`. One line, but it loosens
`jacketId`/`accessoryId` too and leaves `bagId` genuinely `undefined` while TypeScript insists it is
`string | null` · **B** — normalize before validating.

**Decision**: **B**. A small pure `withBagDefault` filling `bagId ?? null`, applied at the three
read boundaries: `localStorageStore.read`, backup import (`backup.ts:100-110`), and the zustand
`merge` (`useShuffleStore.ts:105-118`). `isOutfitShape` stays strict, the type stays sound, the
in-progress current outfit survives the upgrade instead of silently re-rolling, and the helper is a
pure function so it tests cleanly in the node-only vitest setup.

`isOutfitShape` is also the gate for backup files, which are permanent artifacts on disk — so it
must tolerate a missing `bagId` **forever**, not just through this release.

---

## Decision 12: Backup file stays at `version: 1`

**Context**: The gate rejects only `file.version > BACKUP_VERSION` (`backup.ts:153-157`). Bumping to
2 makes an older cached bundle reject the *entire* file — items, outfits and plans — rather than
just the bags.

**Decision**: stay at version 1, following the precedent set for `plans` (2026-07-31 week-planning
Decision 8). An old build then drops bag items into its `skipped` count instead of refusing
everything.

---

## Decision 13: One source of truth for the category list

**Context**: The six category strings are hardcoded in **four** separate places, none checked for
completeness: `railScale.ts:62`, `merge.ts:3`, `indexedDbStore.ts:7`, `backup.ts:18` (plus
`merge.test.ts:6`). Missing the IndexedDB one means bags save fine, display for the whole session,
then vanish on reload — with the error swallowed by `list()`'s catch. Missing `merge.ts` means
`closet.bags` is `undefined` and `inCategory` throws. These are the only silent-data-loss risks in
the entire change.

**Options**: **A** — add `"bags"` to all four by hand; smaller diff, landmine stays armed ·
**B** — derive everything from one `as const` array.

**Decision**: **B**. One `CATEGORIES` array in `types.ts` with
`export type ItemCategory = (typeof CATEGORIES)[number]`; the two validators become
`CATEGORIES.includes(...)`; `merge.ts` and `railScale.ts` import rather than redeclare. ~20 lines,
and it converts every future category from "four ways to lose data" into a compile error. Note the
array is also the manifest **order** (Decision 10), so the single definition must be ordered, not
alphabetized.

---

## Codebase Findings

- **`outfitUsesItem` (`outfit.ts:83-95`) will NOT produce a compile error** and must be updated by
  hand to include `bagId`. It drives the closet delete confirmation's "worn in N outfits" count, so
  a miss under-reports the blast radius of a delete.
- **Compile-time safety net for the slot**: `repairOutfit` (`outfit.ts:105-127`) and `shuffleOutfit`
  (`shuffle.ts:94-103`) both build complete object literals, and the `shuffleSlot` /`applySlot`
  switches are exhaustive under `noFallthroughCasesInSwitch` — all four will error until updated.
- **Nine `Record<ItemCategory, X>` maps** will error and need a `bags` entry: `RAIL_FRAME`,
  `RAIL_IMAGE_WIDTH` (`"max-w-full"`), `RAIL_ALIGN` (`"center"`), `CATEGORY_TINT`, `CATEGORY_LABEL`
  (`railScale.ts:13-52`), `CATEGORY_NOUN` (`uploads/naming.ts:5`), `SHAPE_PATH`
  (`CategoryShape.tsx:12`), `POOL_TINT` (`Aura.tsx:4`), `PLACEMENT`
  (`pipeline/constants.ts:73`). Plus the `Closet` literal in `shuffle.test.ts:28-36` and the
  assertions in `merge.test.ts:6-24` / `closet.test.ts:24-26`.
- **`--color-tint-bags` must be registered in the `@theme` block** (`index.css:19-25`) or Tailwind
  never generates `text-tint-bags` and `CategoryShape` renders colourless. Five preset blocks follow
  at lines 161, 181, 201, 221, 241.
- **`RAIL_FRAME` is shared with the upload preview by explicit contract**
  (`UploadFlow.tsx:336-344`, copy: *"This is exactly how it will hang on the rail"*). The jacket and
  bag changes move the preview too, which is correct.
- **Breakpoint mismatch**: `RAIL_FRAME` switches at `sm:` (640px) while `.paper-doll` switches at
  768px. Checked for the new bag row — in the 640–767px band the bag renders ~173px against the
  jacket's 233px, so no inversion. Fine as-is, but any retuning must re-check that band.
- **Pre-existing md cliff**: at exactly 768px the 272px sidebar appears *and* the 3-column grid kicks
  in simultaneously, collapsing the jacket window from 256px to ~79px. Decision 5's wider jacket
  column improves this by ~28% but does not fix it. Out of scope; noted so it isn't mistaken for a
  regression.
- **Pre-existing mobile gap**: in dress mode the bottoms rail doesn't render and its md-only row
  span doesn't apply below 768px, so the mobile `bottom` row collapses to zero height while keeping
  both row gaps — a stray ~3rem gap. The new 4-row mobile grid inherits it.
- **The upload category picker is `grid-cols-2 sm:grid-cols-3`** (`UploadFlow.tsx:276`); seven
  buttons leave a ragged last row. Cosmetic, planner's call.
- `src/features/week/` is entirely category-free — no changes there beyond whatever
  `OutfitPreview` inherits.

## Out of Scope

- **Migrating existing uploads out of `accessories`.** No `recategorizeUpload`, no "move to Bags"
  control. Joyce deletes and re-uploads her one bag. (`renameUpload` at `useClosetStore.ts:59-77`
  remains the precedent if this is ever wanted.)
- **Shrinking `RAIL_FRAME.accessories`** — Decision 6.
- **Touching `.wash-*` / `WASH_CLASSES`** (`index.css:373-388`, `OutfitCard.tsx:22-37`). It is a
  6-entry hash palette for scrapbook variety, unrelated to an outfit's contents; adding a 7th
  changes the modulo and recolors every existing saved card.
- **Bumping the IndexedDB version.** No schema migration is needed, and a v2 bump risks `onblocked`
  rejecting into an empty closet in a second tab.
- **Fixing the 768px size cliff** and the **dress-mode mobile row gap** — both pre-existing.
