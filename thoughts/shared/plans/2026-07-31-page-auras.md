# Page Auras — One Light, Four Rooms: Implementation Plan

## Overview

Give the week, outfits and closet pages their own aura, so each page is recognizable from its
light alone. Today's aura is the centerpiece and does not change; the three new ones are
sibling variants that draw on each page's ribbon thread, breathe more quietly, and derive
their softness from gradient falloff rather than blur.

Design decisions: `thoughts/shared/decisions/2026-07-31-page-auras.md`. Referred to below as
"Decision N".

## Current State Analysis

**What exists.** Exactly one aura, on Today (`src/index.css:409-469`): a `.aura` container
holding three blobs at `filter: blur(56px)`, resting `opacity: 0.6`, breathing on 19/23/27s
cycles with staggered negative delays. It is rendered inside a `relative isolate` wrapper and
keyed on the cascade tick so Shuffle All remounts it and replays `aura-bloom`
(`ShufflePage.tsx:96-104`). Every other page opens on bare paper.

**What the codebase already gives us for free:**

- **Per-page threads.** `Ribbon.tsx:52-60` assigns each page an accent — plaid→`accent`,
  gingham→`accent-2`, stripe→`accent-3`, polka→`accent-4` — under the rule that no accent is
  ever spent twice. Decision 2 extends that system to the auras rather than inventing one.
- **Five themes at no cost.** Every preset defines `aura-1/2/3`, all six `tint-*`, and
  `accent-2/3/4` (`index.css:153-250`). No new color authoring anywhere.
- **Cheap wash idioms.** `.quote-wash::before` (`index.css:321-333`, long falloff +
  `blur(14px)`) and `.card-wash::before` (`index.css:359-371`, gradient only, no filter) are
  the models for Decision 12.
- **Entry blooms for free.** Each page is a route `Component` (`app.tsx:16-20`), so
  navigation genuinely remounts it and `aura-bloom` plays on mount (Decision 5).
- **Real anchors already in the DOM.** The week grid (`WeekPage.tsx:126`), the closet
  `<header>` (`ClosetPage.tsx:278`) and its six always-rendered `<section>`s
  (`ClosetPage.tsx:309`), and `NothingToWear` (`ShufflePage.tsx:40`).

**The constraints discovered:**

- **All non-Today content is opaque** — `DayBox.tsx:73-74`, `OutfitCard.tsx:186`,
  `ClosetPage.tsx:77` are all `bg-white` with 8–20px gutters. An aura behind those grids is
  invisible. Every composition below therefore lives in margins, vertical gaps, headers and
  empty states (Decision 7).
- **The column, not the text measure.** `main` is `mx-auto w-full max-w-5xl` (`max-w-7xl` on
  week) inside a `[17rem_1fr]` grid (`Layout.tsx:94-97`), so on a 1512px screen ~110px of
  margin sits unused on each side. Because `main` is centered in the column, anything
  centered on `main` is centered on the column too — which is what makes "full width right of
  the sidebar" expressible without touching `Layout` (Decision 6, Decision 14).
- **The sidebar has no background** (`Layout.tsx:31`) and its stacking context is load-bearing
  for the save popover. Nothing here goes near it.
- **`position: fixed` is viable** for the outfits wall — no ancestor of `main` sets
  `transform`/`filter`/`contain`. It ignores the grid column, so it needs explicit insetting
  on `md+`.
- **The reduced-motion kill switch names `.aura` explicitly** (`index.css:279-282`). The
  global `0.01ms` clamp is not enough — it would leave `infinite alternate` looping
  frantically — so every new variant root must be added to that list (Decision 15 #5).

## Desired End State

Four pages, four distinguishable auras:

| Page    | Color                          | Composition                        | Anchored to        |
| ------- | ------------------------------ | ---------------------------------- | ------------------ |
| today   | `aura-1/2/3` (unchanged)       | three blurred blobs                | the canvas wrapper |
| week    | `accent-4` → `aura-1` traverse | one wide surround horizon          | the grid           |
| outfits | `accent-3` + `aura-3`          | two corner blobs, viewport-fixed   | the viewport       |
| closet  | `accent-2`, then six `tint-*`  | a header pool + six scrolling ones | header + sections  |

Verified by: Today is pixel-identical; each new page blooms on entry and breathes audibly
more quietly than Today; reduced motion freezes all four; text contrast is unharmed on all
five presets; no horizontal scrollbar at any width.

### Key Discoveries

- **`relative` without `isolate` is the right anchor for the new auras.** ShufflePage's
  canvas uses `relative isolate` deliberately — the comment at `ShufflePage.tsx:96-97` and
  Layout's at `Layout.tsx:27-30` both depend on that isolation. The new auras need the
  opposite: a `z-index: -1` child of a `position: relative` element that is *not* a stacking
  context drops into the **root** stacking context's negative layer, which paints after the
  page's paper background but before all in-flow content. That is precisely what lets the
  week band read behind its own header text (Decision 8) and the closet pools bleed out from
  under their section header rows (Decision 10). Isolating would paint them *over* that text.
- **Absolutely-positioned children are not flex or grid items**, so dropping an aura as the
  first child of `flex flex-col gap-N` containers (the closet header, its sections, the
  NothingToWear column) adds no phantom gap.
- **Auto inline margins center an over-constrained absolute box.** With `left: 0; right: 0;
  width: var(--column-width); margin-inline: auto`, the margins resolve equal and negative —
  the aura centers on `main`, and therefore on the column, at every width, with no transform
  (leaving `transform` free for the breathing animation).

  > **Corrected in implementation — this is false.** Equal auto margins are only used while
  > they come out non-negative; CSS 2.1 §10.3.7 says that when centring would require
  > negative margins, `margin-left` is set to 0 in ltr and the whole remainder goes on the
  > right. Measured in Chrome against the plan's own geometry: the aura landed at
  > 148px–1388px instead of centred on the 0–1240px column — left-aligned to `main` and
  > bleeding out one side only, which loses Decision 6's symmetric bleed. Shipped instead as
  > `left: 50%; width: var(--column-width); margin-left: calc(var(--column-width) / -2)`,
  > which is exact at every width and still leaves `transform` free for `aura-bloom`.
  > Verified against the built CSS with the real layout classes: the pool measures exactly
  > 272px–1512px on a 1512px viewport (the full column), with no horizontal overflow.
- **`100vw` includes the scrollbar** on platforms with classic scrollbars, so a full-column
  layer would overflow right and add a sideways scroll. `body { overflow-x: clip }` is the
  guard; `clip` rather than `hidden` because it does not create a scroll container, so the
  sticky sidebar keeps sticking to the viewport.

## What We're NOT Doing

Straight from the decisions doc's Out of Scope, plus what falls out of it:

- **Any change to Today's aura** — `.aura`, `.aura > div`, `.aura-blob-1/2/3` and both
  keyframes (`index.css:409-469`) are not edited, renamed, or restructured. Today must be
  visually identical after this slice (Decision 14).
- **Editing `2026-07-17-ui-artistic-polish.md`** — its "only ambient motion" clause is
  superseded in place by Decision 3, never rewritten. `thoughts/` docs are historical
  snapshots.
- **Card translucency** anywhere, and any change to `paper-card` / `card-wash` /
  `.quote-wash` (Decision 7).
- **Aura in or behind the sidebar** (Decision 6).
- **Reactive auras** on week/outfits/closet — no store subscriptions, no keyed remounts, no
  data-derived conditions in any decorative layer (Decision 4). Shuffle All's re-bloom stays
  unique to Today.
- **The week band marking today** or otherwise encoding plan data (Decision 8) — that is
  already encoded at `DayBox.tsx:74`.
- **Breakpoint-forked compositions** or per-device aura budgets (Decision 13).
- **Routing auras through `Layout`** or growing its `pathname` switching (Decision 14).
- **New color tokens or theme presets** (Decision 2).
- **Particles, sparkles, gradient meshes, scroll-linked parallax** (2026-07-17 aesthetic,
  otherwise standing).
- **New tests.** Vitest is `environment: "node"` over `src/**/*.test.ts` — domain logic only,
  by design (CLAUDE.md). This slice is CSS and markup and adds none.

## Implementation Approach

One `<Aura variant>` component owns the markup so there is a single DOM shape, and all four
variants share it: **the container positions and blooms, the children carry color and
breathe.** That split is lifted from Today (`.aura` blooms, `.aura > div` breathes), and it is
what makes the reduced-motion rule a mechanical two-selectors-per-variant addition.

The three new variants diverge from Today on exactly one axis, deliberately: softness comes
from long gradient falloff with no filter, not from `blur(56px)` (Decision 12). Today is a
blurred cloud; the other pages are washes with soft edges — related, not copies. It is also
the performance answer, since the closet carries seven pools on a scrolling page.

Numbers below (opacities, cycle lengths, gradient stops) satisfy Decision 15's binding
ladder — resting opacity ≤ 0.3 (half of Today's 0.6), amplitude ≤ 0.08, cycles ≥ 40s, no two
closet pools in phase — but the exact values are implementation-time craft and expected to be
nudged by eye in Phase 5.

---

## Phase 1: Scaffolding — the `<Aura>` component, shared CSS, and the emptiest screen

### Overview

Create the component and the shared CSS scaffolding, move Today onto it with zero visual
change, and give `NothingToWear` the stage aura (Decision 11) — the screen every new user
sees first, and currently the only one in the app with no aura at all.

### Changes Required

#### 1. The bleed variable and the scrollbar guard

**File**: `src/index.css`
**Changes**: Add `--column-width` to `:root` and `overflow-x: clip` to `body`.

```css
:root {
  /* ...existing --texture-grain... */

  /* The page area right of the sidebar — what "content column" means for the auras
     (2026-07-31 page-auras Decision 6). The 17rem duplicates Layout.tsx's grid track, which
     only exists at md+; the two must move together. */
  --column-width: 100vw;
}

@media (min-width: 768px) {
  :root {
    --column-width: calc(100vw - 17rem);
  }
}

body {
  /* ...existing rules... */

  /* --column-width is expressed in vw, which on a platform with classic scrollbars is wider
     than the content box by the scrollbar's width. Clip rather than let a decorative layer
     add a sideways scroll. `clip`, not `hidden`: it does not create a scroll container, so
     the viewport stays the scrollport and the sticky sidebar is unaffected. */
  overflow-x: clip;
}
```

#### 2. The reduced-motion kill switch

**File**: `src/index.css` (the `prefers-reduced-motion` block, currently lines 268-283)
**Changes**: Extend the existing selector list to name all four variant roots. Left to the
global `0.01ms` clamp, `infinite alternate` would loop frantically instead of stopping.

> **Deviation, found in implementation**: extending the selector list is not sufficient. This
> block sits near the top of the file, and every aura rule is defined later at the same
> specificity (`.aura` is `0,1,0` in both places), so a plain `animation: none` here loses the
> cascade on source order alone — the kill switch was already a no-op for Today before this
> slice, leaving the blobs to flicker under the `!important` 0.01ms clamp. Shipped as
> `animation: none !important`, matching the global clamp directly above it, which also makes
> the rule immune to a future variant being added further down the file. Today's own
> `.aura` block is still byte-identical (Decision 14); only its reduced-motion behaviour
> changes, and it changes to what the block's existing comment already claimed.

```css
/* The global 0.01ms clamp would leave `infinite alternate` looping frantically, so kill the
   aura animations outright: bloom's `both` fill is skipped and every layer rests at the
   opacity declared as a property. Each variant is named because there is no shared class —
   Today's markup is emitted verbatim (page-auras Decision 14), so it carries `.aura` alone. */
.aura,
.aura > div,
.aura-horizon,
.aura-horizon > div,
.aura-gallery,
.aura-gallery > div,
.aura-pool,
.aura-pool > div {
  animation: none;
}
```

#### 3. Shared entrance for the new variants

**File**: `src/index.css`, appended after Today's block (which stays untouched)
**Changes**: One rule giving the three new roots the shared bloom, depth and inertness.
Decision 5: all four bloom on entry, sharing one curve; Today's distinction is the *re*-bloom.

```css
/* ---- Page auras (2026-07-31 page-auras) -----------------------------------------
   Today's `.aura` above is the centerpiece and is not touched (Decision 14). The variants
   below are its siblings: same DOM shape — container positions and blooms, children carry
   colour and breathe — but softness comes from long gradient falloff rather than
   blur(56px) (Decision 12). That is the performance answer for the closet's seven pools and
   a differentiation axis at once: Today is a blurred cloud, the rest are washes.

   All three sit at z-index -1 under a `position: relative` parent that is deliberately NOT
   isolated, unlike Today's canvas. Without a stacking context in between they land in the
   root's negative layer — after the paper background, before all in-flow content — which is
   what lets them read behind their page's own header text (Decisions 8 and 10). */
.aura-horizon,
.aura-gallery,
.aura-pool {
  z-index: -1;
  pointer-events: none;
  animation: aura-bloom 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Full-column bleed (Decision 6): `main` is mx-auto inside the column, so a box centred on
   its containing block is centred on the column too. Auto inline margins on an
   over-constrained absolute box resolve equal — and negative — which is the centring, and
   it leaves `transform` free for the breathing. */
.aura-horizon,
.aura-pool {
  position: absolute;
  left: 0;
  right: 0;
  width: var(--column-width);
  margin-inline: auto;
}
```

#### 4. The component

**File**: `src/components/Aura.tsx` (new)
**Changes**: One DOM shape for all four auras.

```tsx
import type { ItemCategory } from "../features/closet/types";

/** The closet's six section pools, each in its own category tint (page-auras Decision 10). */
const POOL_TINT: Record<ItemCategory, string> = {
  tops: "aura-pool-tops",
  bottoms: "aura-pool-bottoms",
  dresses: "aura-pool-dresses",
  jackets: "aura-pool-jackets",
  shoes: "aura-pool-shoes",
  accessories: "aura-pool-accessories",
};

/**
 * `category` belongs to the pool variant alone; `?: never` on the others makes passing it
 * anywhere else a type error rather than a silently ignored prop.
 */
type AuraProps =
  | { variant: "stage" | "horizon" | "gallery"; category?: never }
  | { variant: "pool"; category?: ItemCategory };

/**
 * Each page's light (2026-07-31 page-auras). One DOM shape across all four variants — the
 * container positions and blooms, the children carry colour and breathe — so the auras stay
 * one family and the reduced-motion kill switch stays two selectors per variant.
 *
 * `stage` emits Today's existing markup VERBATIM (Decision 14): Today's CSS is not touched
 * by this slice and its aura must be pixel-identical afterwards. ShufflePage keys this
 * component on the cascade tick, which remounts it and replays aura-bloom on Shuffle All —
 * the one reactive aura in the app (Decision 4).
 *
 * Every variant is pure decoration and stays out of the accessibility tree. None of them
 * reads from a store or takes a data-derived condition: an aura is a property of the page,
 * not of its data (Decision 11).
 */
export function Aura(props: AuraProps) {
  if (props.variant === "stage")
    return (
      <div className="aura" aria-hidden="true">
        <div className="aura-blob-1" />
        <div className="aura-blob-2" />
        <div className="aura-blob-3" />
      </div>
    );

  if (props.variant === "horizon")
    return (
      <div className="aura-horizon" aria-hidden="true">
        <div />
      </div>
    );

  if (props.variant === "gallery")
    return (
      <div className="aura-gallery" aria-hidden="true">
        <div className="aura-gallery-1" />
        <div className="aura-gallery-2" />
      </div>
    );

  // No category = the closet's own header pool, in the gingham thread.
  return (
    <div
      className={`aura-pool ${
        props.category ? POOL_TINT[props.category] : "aura-pool-header"
      }`}
      aria-hidden="true"
    >
      <div />
    </div>
  );
}
```

#### 5. Today moves onto the component — no visual change

**File**: `src/features/shuffle/ShufflePage.tsx`
**Changes**: Replace the three inline divs with `<Aura>`, keeping the key and both comments.

```tsx
      {/* `isolate` keeps the z-index:-1 aura inside this stacking context — behind the rails
          but above the page background. */}
      <div className="relative isolate w-full">
        {/* Re-blooms on Shuffle All: the tick remounts the aura, replaying aura-bloom. */}
        <Aura key={tick} variant="stage" />
```

#### 6. The emptiest screen gets its aura

**File**: `src/features/shuffle/ShufflePage.tsx`, in `NothingToWear`
**Changes**: Add the canvas idiom and the stage aura. Decision 11: `NothingToWear` returns
before the canvas wrapper, so a brand-new closet's very first screen currently has no aura at
all — the screen selling the aesthetic worst.

```tsx
function NothingToWear({ missing }: { missing: MissingCategory[] }) {
  return (
    // Same `relative isolate` canvas as the shuffle page proper — this early return is why the
    // app's first screen had no aura at all (page-auras Decision 11). Unconditional: an aura
    // is a property of the page, not of its data.
    <div className="relative isolate flex flex-col items-center gap-5 py-20 text-center">
      <Aura variant="stage" />
      {/* ...existing heading, copy and link... */}
    </div>
  );
}
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`
- [x] Tests still pass: `npm test`
- [x] Production build succeeds: `npm run build`
- [x] Today's aura block is byte-identical. Snapshot it **before** touching the file —
      `sed -n '409,469p' src/index.css > "$SCRATCH/aura-before.css"` — and at the end of the
      phase `sed -n '/^\.aura {/,$p' src/index.css | head -61 | diff - "$SCRATCH/aura-before.css"`
      must be empty. (A plain `git diff` will not do: `src/index.css` already carries
      unrelated uncommitted work, though none of it inside this block.)

#### Manual Verification

- [ ] Today looks identical to before — same blobs, same blur, same breathing
- [ ] Shuffle All still re-blooms the aura
- [ ] A closet with nothing in it (or with no shoes) shows the aura behind "your closet is
      waiting", and the heading and button are fully legible over it
- [ ] No horizontal scrollbar on any page at any window width
- [ ] The sidebar still sticks while the page scrolls, and the save popover still opens above
      the shuffle canvas (the `overflow-x: clip` guard's two risk areas)

**Implementation Note**: Pause here for confirmation that Today is unchanged before building
anything on top of this scaffolding.

---

## Phase 2: Week — a surround horizon

### Overview

A wide, low field centered on the grid but overhanging it top and bottom, so it reads behind
the header, in the side margins, and under the grid's bottom edge — the grid floats *in* the
light rather than covering it (Decision 8). Color traverses `accent-4` (the polka thread) →
`aura-1` across the width, so the week has direction, like a landscape strip rather than a
spotlight. Breathing is horizontal: the band stretches and relaxes rather than scaling, so it
reads as weather crossing a landscape.

### Changes Required

#### 1. The horizon

**File**: `src/index.css`, in the page-auras block

```css
/* Week (Decision 8): overhangs the grid top and bottom so the seven opaque boxes float in the
   light instead of covering it. Two overlapping ellipses rather than a masked linear
   gradient: the traverse comes out of their overlap, and each one's own falloff gives the
   band its soft vertical edges for free — no filter anywhere.

   The band deliberately does NOT mark today: DayBox.tsx:74 already encodes that, and
   decoration duplicating a data encoding drifts out of sync the moment either changes. */
.aura-horizon {
  top: -7rem;
  bottom: -4rem;
}
.aura-horizon > div {
  position: absolute;
  inset: 0;
  opacity: 0.28; /* resting value — also the reduced-motion static state */
  background:
    radial-gradient(
      56% 50% at 20% 50%,
      color-mix(in srgb, var(--color-accent-4) 34%, transparent),
      color-mix(in srgb, var(--color-accent-4) 12%, transparent) 48%,
      transparent 78%
    ),
    radial-gradient(
      58% 50% at 76% 50%,
      color-mix(in srgb, var(--color-aura-1) 40%, transparent),
      color-mix(in srgb, var(--color-aura-1) 14%, transparent) 48%,
      transparent 78%
    );
  animation: aura-horizon-breathe 52s ease-in-out infinite alternate;
}

/* Horizontal only: the band widens and relaxes rather than pulsing. */
@keyframes aura-horizon-breathe {
  from {
    opacity: 0.24;
    transform: scaleX(1);
  }
  to {
    opacity: 0.3;
    transform: scaleX(1.06);
  }
}
```

#### 2. Mounting it

**File**: `src/features/week/WeekPage.tsx`
**Changes**: Wrap the grid so the band has something grid-shaped to be centered on.

```tsx
        {/* The band is anchored to the grid, not to the page, so opening the assign panel
            below cannot move or resize it. `relative` WITHOUT `isolate`, deliberately: the
            band has to reach up behind the header (page-auras Decision 8), which a stacking
            context here would paint it over instead of under. */}
        <div className="relative">
          <Aura variant="horizon" />
          <div className={GRID}>{/* ...unchanged... */}</div>
        </div>
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`

#### Manual Verification

- [ ] The band reads behind "the week", its polka ribbon and the week-range arrows, and none
      of that text loses contrast
- [ ] Color visibly travels left-to-right across the band
- [ ] It reaches into the side margins past the grid, with no hard vertical edge
- [ ] Breathing is a horizontal stretch, clearly quieter and slower than Today's
- [ ] Opening and closing the assign panel does not move or resize the band
- [ ] Today's box is marked only by its border and wash — the band does nothing special under
      it
- [ ] The wrapped 2-column phone layout and 3-column `sm` layout still look right

**Implementation Note**: Pause for confirmation before the next page.

---

## Phase 3: Outfits — a viewport-fixed gallery wall

### Overview

Two blobs anchored into opposite corners — top-left and bottom-right — so the composition is
diagonal and the middle of the grid stays clean. Fixed to the viewport, so scrolling a long
grid feels like panning across a wall while the light stays put. Breathing amplitude is the
smallest of the four — barely perceptible, which is the point at that apparent distance
(Decision 9).

### Changes Required

#### 1. The gallery wall

**File**: `src/index.css`, in the page-auras block

```css
/* Outfits (Decision 9): fixed, so scrolling a long grid pans across a wall while the light
   holds still — the deliberate counterpart to the closet's pools travelling with their
   sections. Fixed positioning ignores the grid column entirely, hence the explicit md+ inset
   to keep the wash off the sidebar (Decision 6). Larger radius and softer falloff than
   Today, in the stripe thread with aura-3. */
.aura-gallery {
  position: fixed;
  inset: 0;
}
@media (min-width: 768px) {
  .aura-gallery {
    left: 17rem;
  }
}
.aura-gallery > div {
  position: absolute;
  opacity: 0.22; /* resting value — also the reduced-motion static state */
}
.aura-gallery-1 {
  top: -12%;
  left: -8%;
  width: 64%;
  height: 62%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--color-accent-3) 40%, transparent),
    color-mix(in srgb, var(--color-accent-3) 15%, transparent) 50%,
    transparent 86%
  );
  animation: aura-gallery-breathe 64s ease-in-out infinite alternate;
}
.aura-gallery-2 {
  right: -10%;
  bottom: -14%;
  width: 68%;
  height: 64%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--color-aura-3) 44%, transparent),
    color-mix(in srgb, var(--color-aura-3) 16%, transparent) 50%,
    transparent 86%
  );
  animation: aura-gallery-breathe 71s ease-in-out -23s infinite alternate;
}

/* The smallest amplitude of the four — at this apparent distance, barely perceptible is the
   brief. The negative delay above keeps the two corners off each other's phase. */
@keyframes aura-gallery-breathe {
  from {
    opacity: 0.19;
    transform: scale(1);
  }
  to {
    opacity: 0.22;
    transform: scale(1.04);
  }
}
```

#### 2. Mounting it

**File**: `src/features/outfits/OutfitsPage.tsx`
**Changes**: One line at the top of the page's root. No wrapper is needed — the layer is
viewport-fixed, and at `z-index: -1` with no isolating ancestor it lands in the root stacking
context's negative layer, behind every card.

```tsx
    <div className="flex flex-col gap-6">
      {/* Fixed to the viewport, so scrolling a long grid pans across it (page-auras
          Decision 9). Absolutely positioned, so it is not a flex item and adds no gap. */}
      <Aura variant="gallery" />

      <header className="flex flex-col items-center gap-3 text-center">
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`

#### Manual Verification

- [ ] Two blobs, top-left and bottom-right; the middle of the grid stays clean
- [ ] Scrolling a long grid leaves the light where it is
- [ ] Nothing bleeds left of the sidebar on desktop
- [ ] The "nothing saved yet" empty state carries the same aura (Decision 11)
- [ ] Breathing is the quietest of the four — noticeable only if watched for
- [ ] Card hover lift, the ghost ×, and the delete confirmation all still paint above it

**Implementation Note**: Pause for confirmation before the closet.

---

## Phase 4: Closet — a gingham header pool, then six scrolling tint pools

### Overview

A single pool behind the title and gingham ribbon in `accent-2`, so all four pages open in
their own thread; then each of the six sections gets a pool in its own `--color-tint-*`,
bleeding out from under its header row and fading before the tiles. Scrolling the closet moves
through a color story keyed to the category system rather than one flat wash (Decision 10).
The pools travel with their sections — a pool that identifies the tops section has to move
with it — which is the deliberate counterpart to the outfits wall being fixed.

### Changes Required

#### 1. The pools

**File**: `src/index.css`, in the page-auras block

```css
/* Closet (Decision 10): pools that scroll WITH their sections. Because a pool is anchored to
   its section, an empty section is short and gets a small pool for free — emptiness solves
   itself geometrically, with no conditional anywhere (Decision 11).

   Weight: the header pool lands near the sidebar's .quote-wash, the section pools quieter
   still. Both bleed the full column width, so the colour reaches the page margins rather
   than stopping at the tile grid's edge (Decision 6). */
.aura-pool {
  top: -2rem;
  height: 9rem;
}
.aura-pool-header {
  --aura-pool: var(--color-accent-2); /* the gingham thread */
  top: -2.5rem;
  height: 15rem;
}
.aura-pool > div {
  position: absolute;
  inset: 0;
  opacity: 0.2; /* resting value — also the reduced-motion static state */
  background: radial-gradient(
    54% 58% at 32% 34%,
    color-mix(in srgb, var(--aura-pool) 32%, transparent),
    color-mix(in srgb, var(--aura-pool) 12%, transparent) 50%,
    transparent 84%
  );
  animation: aura-pool-breathe 48s ease-in-out infinite alternate;
}
.aura-pool-header > div {
  opacity: 0.26;
}

/* One tint per category, mirroring the .wash-* idiom above. The delay lives here rather than
   on the shared rule because no two pools may breathe in phase (Decision 15 #3) and these
   sit in six different parents, so nth-child cannot reach them. Seven distinct phases against
   one 48s cycle. */
.aura-pool-tops {
  --aura-pool: var(--color-tint-tops);
}
.aura-pool-tops > div {
  animation-delay: -4s;
}
.aura-pool-bottoms {
  --aura-pool: var(--color-tint-bottoms);
}
.aura-pool-bottoms > div {
  animation-delay: -11s;
}
.aura-pool-dresses {
  --aura-pool: var(--color-tint-dresses);
}
.aura-pool-dresses > div {
  animation-delay: -18s;
}
.aura-pool-jackets {
  --aura-pool: var(--color-tint-jackets);
}
.aura-pool-jackets > div {
  animation-delay: -25s;
}
.aura-pool-shoes {
  --aura-pool: var(--color-tint-shoes);
}
.aura-pool-shoes > div {
  animation-delay: -32s;
}
.aura-pool-accessories {
  --aura-pool: var(--color-tint-accessories);
}
.aura-pool-accessories > div {
  animation-delay: -39s;
}

@keyframes aura-pool-breathe {
  from {
    opacity: 0.17;
    transform: scale(1);
  }
  to {
    opacity: 0.22;
    transform: scale(1.04);
  }
}
```

#### 2. Mounting them

**File**: `src/features/closet/ClosetPage.tsx`
**Changes**: `relative` on the header and on each section, plus one `<Aura>` in each. Both are
`relative` without `isolate`, so the pools sit under their own header text rather than over
it — and neither is a flex item, so the `gap-4` / `gap-3` columns are unaffected.

```tsx
      {/* The page's longest scroll would otherwise open cold, on bare paper, while everything
          below it carried colour (page-auras Decision 10). */}
      <header className="relative flex flex-col items-center gap-4 text-center">
        <Aura variant="pool" />
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
```

```tsx
          <section key={category} className="relative flex flex-col gap-3">
            {/* Anchored to the section, so the pool travels with it — a pool that identifies
                the tops section has to move with the tops. An empty section is short and gets
                a small pool for free (Decision 11). */}
            <Aura variant="pool" category={category} />

            <div className="flex items-center gap-2">
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`

#### Manual Verification

- [ ] The header pool sits behind the title, gingham ribbon and item count without dulling
      them, and reads at roughly the sidebar quote's weight
- [ ] Scrolling the full closet moves through six distinguishable tints, and the pools scroll
      with their sections
- [ ] Each pool fades before the tiles begin rather than sitting behind the grid
- [ ] No two pools are visibly breathing together
- [ ] A closet with several empty sections still reads well — empty sections get small pools,
      "Nothing here yet!" is legible over them
- [ ] Scrolling stays smooth on a phone with a full closet
- [ ] The upload flow, tile rename field and delete confirmation all still work and paint
      above the pools

**Implementation Note**: Pause for confirmation before the final sweep.

---

## Phase 5: The sweep — five themes, four pages, one ladder

### Overview

No new features. Walk the whole matrix against Decision 15's binding constraints and tune the
numbers, which is where they were always going to be settled.

### Changes Required

Adjustments to the values added in Phases 2–4 only: gradient stops, `color-mix` percentages,
resting opacities, cycle lengths, and the two horizon insets. No structural or markup changes.

> **What the tuning actually turned out to be.** As written, Phases 2–4 diluted twice —
> `color-mix`ing the gradient colour down to 32–44% *and* setting the layer's `opacity` to
> 0.20–0.28 — which multiplies out to an effective peak alpha of 0.07–0.10, roughly a sixth
> of Today's 0.6 and a third of the 0.3 ceiling Decision 15 #1 actually allows. Rendered, all
> three new auras were invisible. Corrected to Today's own idiom: the gradient carries the
> colour at **full strength**, `opacity` is the **single** loudness knob, and softness comes
> from a long mid-stop falloff (the `.quote-wash` three-stop shape). Effective peaks are now
> 0.28 week / 0.25 outfits / 0.26 closet header / 0.20 closet sections — all under the ceiling
> with Today strictly loudest. Two consequences worth noting:
>
> - Raising the colour to full strength made Decision 2's binding constraint bite for real
>   ("each page's aura is its thread **mixed with an aura token**, never the raw accent
>   alone"), which the diluted version had made moot. The near end of the week horizon is now
>   `accent-4` 70% + `aura-1`, the outfits' near blob `accent-3` 65% + `aura-3`, and the
>   closet header pool `accent-2` 60% + `aura-2`. The six section pools keep their raw
>   `--color-tint-*`: tints are not accents, they are already the muted watercolour tones the
>   category system is built on, and tempering them would blur the apart-ness Decision 10 is
>   about.
> - Outfits went to 0.25 rather than matching the closet's 0.20 — it is mostly open wall, and
>   the value that reads as a pool behind a section header disappears across a whole viewport.
>
> **Then the closet pools needed their edges softened.** They were reading as rectangular
> bands, because the ending shape (`54% 58% at 32% 34%`, transparent at 84%) reached −13.4%
> horizontally and −14.7% vertically — the ellipse overhung the element box and got clipped
> mid-falloff, painting a straight line along the top and left edges. Refitted to
> `44% 38% at 44% 40%` with the transparent stop at 100%, which lands inside the box on every
> side, plus a front-loaded four-stop ramp so the outer fade gets ~47px instead of ~15px in a
> box this short, plus taller boxes (13rem sections / 19rem header). No filter was needed,
> so Decision 12's blur budget still holds. Weight was raised to 0.25 / 0.29 to compensate:
> the front-loaded ramp spends most of its radius near-transparent, so the old number read as
> a haze with the new ramp.
>
> **And that surfaced a real bug**: `.aura-pool-header > div { opacity }` never applied while
> animating, because the shared `aura-pool-breathe` keyframes animate `opacity` and a running
> animation overrides the property. The header pool had been rendering at exactly the section
> pools' weight, visible only under reduced motion — silently contradicting Decision 10's
> "header ≈ quote-wash, sections quieter still". Fixed with its own
> `aura-pool-header-breathe` keyframes.

Binding, in order (Decision 15):

1. Today rests strictly loudest; no other page exceeds **half** Today's resting opacity
   (0.6 → 0.3 ceiling).
2. Non-Today breathing amplitude ≤ **0.08** opacity delta, on cycles ≥ **40s**.
3. No two closet section pools breathe in phase.
4. Nothing reduces text contrast anywhere, on any of the five themes.
5. Reduced motion freezes **every** aura at its resting opacity.

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`
- [x] Tests pass: `npm test`
- [x] Production build succeeds: `npm run build`
- [x] Today's aura block still matches the Phase 1 snapshot — the same `diff` against
      `aura-before.css` is empty (Decision 14)
- [x] Ladder constraints 1–3 and 5 audited against the built CSS: resting opacities
      0.28/0.22/0.20/0.26 all ≤ 0.3, amplitudes 0.06/0.03/0.05 all ≤ 0.08, cycles
      52/64/71/48s all ≥ 40s, the seven closet phases distinct mod the 96s alternate period,
      and the kill switch names all eight selectors

#### Manual Verification

- [ ] All four pages, all five themes (rosewood, lavender, garden, seaglass, marmalade): each
      page is recognizable from its light alone, and no theme produces a muddy or garish one
- [ ] Text contrast holds everywhere — headings, muted `text-ink/45` labels, the italic empty
      states, and the closet's uppercase category labels over their pools
- [ ] With OS reduced motion on: every aura is completely still on all four pages, at a
      sensible resting brightness, and none flickers
- [ ] Today is still audibly the loudest — walking today → week → outfits → closet reads as a
      descent in volume, not four peers
- [ ] Phone (narrow, wrapped layouts) and a wide desktop both look composed
- [ ] No horizontal scrollbar at any width on any page

---

## Testing Strategy

### Unit Tests

None. Vitest runs `environment: "node"` over `src/**/*.test.ts` — domain logic only, no DOM
or component tests, by design (CLAUDE.md). This slice is CSS and markup and adds no testable
logic. The existing suite must keep passing as a regression check on the untouched files.

### Manual Testing Steps

1. `npm run dev`, then walk today → week → outfits → closet and confirm each page's light
   arrives as you land on it (Decision 5's entry bloom).
2. On Today, hit Shuffle All and confirm the aura re-blooms — the only reactive one.
3. On week, open and close an assign panel; the band must not move.
4. On outfits with enough cards to scroll, scroll to the bottom; the light must stay put.
5. On closet with items in several categories, scroll the full page; the pools must travel
   with their sections.
6. Empty every state you can reach — a fresh closet (`NothingToWear`), an empty outfits page,
   empty closet sections — and confirm each still has its aura.
7. Cycle all five themes on each page via the picker dots.
8. Turn on System Settings → Accessibility → Display → Reduce motion, reload, and re-walk all
   four pages.
9. Resize from ~360px to full width on each page, watching the bottom edge for a horizontal
   scrollbar.

## Performance Considerations

The closet carries seven pools on the app's longest scrolling page, which is exactly why
Decision 12 rules out blur on the new variants: they are plain gradients with long falloff and
no `filter`, so they cost a paint and nothing more. Only `transform` and `opacity` are
animated, both compositor-friendly. Today keeps its `blur(56px)` cloud, unchanged, on a page
that has one.

The outfits wall is `position: fixed`, which promotes one layer that never invalidates while
the grid scrolls — the cheaper option of the two, not just the nicer-looking one.

## Migration Notes

None — no data, storage, or state shape is touched. The only global change is
`body { overflow-x: clip }`, whose two risk areas (the sticky sidebar and the save popover)
are called out in Phase 1's manual checks.

## References

- Design decisions: `thoughts/shared/decisions/2026-07-31-page-auras.md`
- Superseded in place, not edited: `thoughts/shared/decisions/2026-07-17-ui-artistic-polish.md`
  (Decision 7's "only ambient motion in the app")
- The per-page thread law this extends: `src/components/Ribbon.tsx:52-60`
- Today's aura, untouched: `src/index.css:409-469`, `src/features/shuffle/ShufflePage.tsx:96-104`
- Cheaper wash idioms copied: `src/index.css:321-333` (`.quote-wash`), `src/index.css:359-371`
  (`.card-wash`)
- Layout geometry the bleed depends on: `src/components/Layout.tsx:25-31`, `94-97`
