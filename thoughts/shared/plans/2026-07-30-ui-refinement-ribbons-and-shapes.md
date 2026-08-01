# UI Refinement — Ribbons, Shape Markers, Pattern Detailing — Implementation Plan

## Overview

Execute the eight decisions in
`thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md`: replace the
pixelated `#sketchy` title underline with a code-generated **ribbon family** (wavy plaid /
gingham / candy-stripe, one per page), replace the 8px watercolor dots with a **fixed
category shape iconography** (sun / moon / star / cloud / sparkle / heart), give the theme
picker a uniform **5-petal flower** swatch, add **`--color-accent-2` / `--color-accent-3`**
to every theme, trail a **running-stitch hairline** off the closet section headers, and
soften the **quote-wash** edge. Everything is inline SVG + CSS gradients — no image assets,
no `feDisplacementMap` (Decision 2). The sketchbook base (aura, grain, card washes) is
untouched.

User decisions made during planning:

- **The upload flow's category picker is in scope.** `UploadFlow.tsx:287` is a fourth
  `.watercolor-dot` consumer the decisions doc missed; it gets the same shape markers, so
  "same category, same shape" holds everywhere and `.watercolor-dot` can be deleted.
- **Mock-first.** Phase 1 builds a throwaway single-file HTML preview (published as an
  artifact) of every new visual across all five themes; nothing lands in app code until
  Joyce signs off on silhouettes, patterns, and the ten new hexes.

## Current State Analysis

- **Title underline** (Today only): two stroked paths run through
  `filter: url(#sketchy)` — `src/features/shuffle/ShufflePage.tsx:77-99`. The filter def
  (`feTurbulence` + `feDisplacementMap`) lives at `src/components/Layout.tsx:22-32` and has
  **no other consumer** (verified by grep). Displacement is a raster op — the jaggedness is
  structural (Decision 2), so the whole mechanism goes, not its tuning.
- **`.watercolor-dot`** (`src/index.css:200-214`): a CSS radial-gradient paint dab tinted by
  `currentColor`. Four consumers:
  - `src/components/Rail.tsx:227-232` — via the `tintClass` prop (`Rail.tsx:18`,
    `:124`), fed by `ShufflePage.tsx` as `tintClass="text-tint-tops"` etc. on all six rails.
  - `src/features/closet/ClosetPage.tsx:214-218` — via `CATEGORY_TINT[category]`.
  - `src/features/uploads/UploadFlow.tsx:285-288` — via `CATEGORY_TINT[option]` (the
    consumer the decisions doc missed).
  - `src/features/theme/ThemePicker.tsx:40-44` and `:63-67` — `text-accent`, with the
    `data-theme={preset.id}` re-scope trick on the picker row.
- **Theme tokens**: `@theme` defaults `src/index.css:3-24`; the five complete preset blocks
  `src/index.css:114-196` (unlayered on purpose — they must beat the `@layer theme`
  defaults, and the picker's re-scope depends on it). No secondary accents exist.
- **Closet section headers** (`ClosetPage.tsx:213-222`): `flex items-center gap-2` row of
  dot + uppercase h2. Nothing trails to the row edge.
- **Quote blob**: `.quote-wash::before` (`src/index.css:281-292`) — `inset: -1rem -0.75rem`,
  radial-gradient with a 45% color-mix stop falling to `transparent 70%`, `blur(6px)`. The
  short falloff is the harsh edge Joyce saw.
- **Page titles to hang ribbons under**: `ShufflePage.tsx:72-74` (underline exists),
  `ClosetPage.tsx:186-188` and `OutfitsPage.tsx:35-37` (nothing there today).
- **Working tree**: the uncommitted shuffle-rail slide-animation work already touches
  `Rail.tsx`, `ShufflePage.tsx`, `ClosetPage.tsx`, `index.css`. This plan builds on that
  tree; nothing here conflicts with it.

## Desired End State

Every page h1 wears its ribbon: Today a wavy plaid (accent-dominant, the hero), Closet a
gingham (accent-2-dominant), Outfits a candy-stripe (accent-3-dominant) — each a gently wavy
band with an axis-aligned pattern fill and solid-color curled ends, crisp at any DPI, redyed
live by the theme picker. Every category label (six shuffle rails, six closet headers, six
upload-flow choices) shows its fixed ~12px shape in its category tint. All five theme
swatches are the same 5-petal flower, each painting its own theme's accent. Closet headers
trail a faint wobbly running stitch to the row edge. The quote blob melts into the paper.
`#sketchy` and `.watercolor-dot` no longer exist in the codebase.

Verified by: `npm run typecheck && npm run lint && npm test && npm run build` all green with
the test suite **unmodified**, `grep -rn "sketchy\|watercolor-dot" src` returning nothing,
and the manual checklists below across all five themes.

### Key Discoveries

- **Inline SVG resolves CSS custom properties only via the CSS `fill` *property*** (a
  `style` attribute or class), not reliably via the `fill` presentation attribute. Every
  theme-tinted pattern rect must use `style={{ fill: "var(--color-accent-2)" }}` — and
  data-URI SVG backgrounds can't do this at all (decisions doc; why ribbons are inline).
- **`currentColor` + the `data-theme` re-scope already compose**: the preset blocks are
  unlayered and match any element (`index.css:106-112`), so an inline SVG filled with
  `currentColor` under `className="text-accent"` inside `data-theme={preset.id}` paints that
  preset's accent — the flower inherits the trick unchanged.
- **SVG `url(#id)` references resolve document-wide**, so repeated inline defs (the shape
  highlight gradient, ribbon pattern tiles) must mint unique ids with React's `useId()` —
  duplicate ids would silently all resolve to the first instance in the DOM.
- **SVG `<pattern>` tiles fill in user space** — the pattern stays axis-aligned while the
  ribbon body path waves over it, which is exactly the hand-sewn look Decision 3 wants;
  tight curls would shear against the straight weave, so the wave stays gentle and the curls
  live only in the solid-color end paths.
- **Tailwind v4 auto-generates utilities from `@theme` tokens**: adding
  `--color-accent-2/-3` makes `text-accent-2` etc. available for free, but the preset
  blocks are plain CSS — each of the five must repeat the two new tokens by hand (Rosewood's
  block deliberately duplicates the defaults, `index.css:110-112`).
- **`Rail` already imports from the closet feature** (`ClosetItem`, `Rail.tsx:3`), so
  swapping its `tintClass?: string` prop for `category?: ItemCategory` follows the existing
  dependency direction; the tint lookup moves inside the shape component, which is what
  makes Decision 4's "fixed mapping" a single source of truth.
- **The stitch must not stretch**: `preserveAspectRatio="none"` would elongate dashes on
  wide rows. A fixed-scale viewBox wider than any real row (1200 user units at 5xl max
  width) with `preserveAspectRatio="xMinYMid slice"` keeps the dash rhythm true and simply
  crops at the row's edge.
- **Prettier ignores `thoughts/`** and vitest picks up only `src/**/*.test.ts` node-env
  domain logic — nothing in this plan is unit-testable by design; verification is
  automated-gates + manual checklists, per house convention.

## What We're NOT Doing

- The aura, paper grain, card washes, `.paper-card`, `.btn-painterly` — untouched.
- Any detailing on outfit cards, closet tiles, buttons, or the paper-doll stage (deferred).
- Direction B (full textile identity), per Decision 1.
- Theme-picker behavior/interaction changes — only the swatch visual.
- New theme presets — only the two new tokens within the existing five.
- Touching `--texture-grain` (`index.css:220`) — its raster noise is intentional and exempt
  from the no-displacement rule.
- Any store, shuffle logic, upload pipeline, or test changes.
- Dark mode, new dependencies, image assets.

## Implementation Approach

Mock first, then land in dependency order: tokens → markers → ribbons → finishing. The mock
(Phase 1) is where all path geometry and the ten hexes get authored and approved; Phases 2–5
carry the approved geometry into the app **verbatim** rather than redesigning it in place.
Two new shared components (`CategoryShape`, `Ribbon`) live in `src/components/`; the flower
stays local to `ThemePicker.tsx` (its only consumer file). Each phase leaves the app
shippable, and the test suite must pass unmodified throughout — the proof that this is
UI-only.

## Phase 1: Mock & sign-off

### Overview

One throwaway, self-contained HTML file previewing every new visual across all five themes.
No app code changes. This is the approval gate for: ribbon silhouettes and patterns, the six
shape paths, the flower, the stitch, the quote-wash softening, and the ten proposed hexes.

### Changes Required:

#### 1. The mock file

**File**: `<session scratchpad>/ui-refinement-mock.html` (throwaway — never enters the
repo), published via the Artifact tool for review.
**Contents**:

- The five theme palettes copied from `index.css:114-196` as `[data-theme]` blocks, plus
  the **proposed** `--color-accent-2` / `--color-accent-3` values (table below). A theme
  switcher row re-scopes one wrapper `data-theme` attribute. Paper background + the
  `--texture-grain` data-URI copied over for fidelity. (Fonts fall back to system
  serif/sans — the artifact CSP blocks Google Fonts; nothing being judged depends on
  Fraunces.)
- **Three ribbons** at real size (~192–224 × 20–24px) under fake page h1s:
  - *Today — wavy plaid*: body path waving ±3px over a `<pattern>` weaving horizontal +
    vertical bands of accent, accent-2, accent-3 at partial opacity on a paper-light
    ground; soft downward-curled solid ends.
  - *Closet — gingham*: same body geometry, even two-tone grid of accent-2 over paper
    (rows + columns at ~40% opacity, overlaps reading darker); small folded notch ends.
  - *Outfits — candy-stripe*: diagonal accent-3/paper stripes; upward-curled solid ends.
  - Each ribbon's colorway dominance per Decision 3: accent / accent-2 / accent-3
    respectively.
- **Six category shapes** at 12px: sun (tops), crescent moon (bottoms), star (dresses),
  cloud (jackets), 4-point sparkle (shoes), heart (accessories) — solid category-tint
  fill + a soft white radial highlight at 32%/30% (the dot's highlight, translated to an
  SVG gradient). Shown both in a bare row and in context: a fake rail label row and a fake
  closet header row **with the running stitch** trailing to the edge.
- **The 5-petal flower** at 16px, once per theme accent (the five swatches side by side).
- **Quote-wash before/after**: the current gradient/blur values next to the softened ones.

The mock's SVG path data and pattern tiles are the deliverable — Phases 3–5 copy them
verbatim.

#### 2. Proposed secondary accents (starting values, finalized by this sign-off)

Constraint (Decision 6): must weave a lively-but-soft plaid and harmonize with that theme's
paper and ink.

| Theme | `--color-accent-2` | `--color-accent-3` | Reasoning |
| --- | --- | --- | --- |
| rosewood | `#c9ab6a` warm gold | `#93ab8c` sage | aura trio deepened to thread weight |
| lavender | `#d4b878` butter | `#8fa0c9` periwinkle | the butter pop the doc asks for + aura periwinkle deepened |
| garden | `#c9a55e` gold | `#ad6d8a` berry | the berry pop the doc asks for |
| seaglass | `#c2a982` sand | `#c69b94` shell pink | the warm counterweights the doc asks for |
| marmalade | `#8ba7bd` soft blue | `#c3a668` gold | the soft blue the doc asks for + aura gold deepened |

### Success Criteria:

#### Automated Verification:

- [x] None — no app code is touched in this phase. `git status` shows no `src/` changes.
      (The four modified `src/` files are the pre-existing slide-animation work this plan
      builds on; `git diff --stat` is unchanged from the plan's starting tree.)

#### Manual Verification:

- [ ] Every visual renders in all five themes with no hex hard-coded where a var belongs
      (switching theme redyes everything).
- [ ] Ribbon patterns stay axis-aligned under the wavy body; nothing reads warped or jagged
      at 2x zoom.
- [ ] Shapes are recognizable at 12px; the highlight reads as watercolor, not gloss.
- [ ] Joyce approves silhouettes, patterns, shapes, flower, stitch, quote-wash values, and
      all ten hexes — iterating on the mock (redeploying the same artifact) until she does.

**Implementation Note**: hard gate — do not start Phase 2 until sign-off. Approved values
and path data flow into Phases 2–5 verbatim; if sign-off adjusts a hex or a curve, the mock
is the source of truth, not this document's proposals.

---

## Phase 2: Theme tokens

### Overview

Add the two approved secondary accents to the `@theme` defaults and all five preset blocks.
Purely additive — nothing consumes them yet.

### Changes Required:

#### 1. `@theme` defaults

**File**: `src/index.css`
**Changes**: after `--color-wash` (`index.css:9`), with the Rosewood values (the defaults
block is Rosewood, per the existing convention):

```css
  /* Secondary accents (2026-07-30 Decision 6): the plaid/gingham/stripe threads the
     ribbons weave alongside --color-accent; future trims may draw on them too. */
  --color-accent-2: #c9ab6a;
  --color-accent-3: #93ab8c;
```

#### 2. All five preset blocks

**File**: `src/index.css` (`:114-196`)
**Changes**: add the pair to each `[data-theme]` block after its `--color-wash`, using the
Phase-1-approved values. Rosewood repeats the defaults on purpose (same reason its block
exists at all, `index.css:110-112`).

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Tests pass unmodified: `npm test` (193 tests, 12 files)
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff
- [x] All six blocks carry both tokens: `grep -c "color-accent-2\|color-accent-3" src/index.css` → `12`

#### Manual Verification:

- [ ] App renders identically to before (tokens are unconsumed).

---

## Phase 3: Shape markers & flower swatches

### Overview

The fixed category iconography lands at all four dot sites, the picker gets its flower, and
`.watercolor-dot` is deleted.

### Changes Required:

#### 1. The shape component

**File**: `src/components/CategoryShape.tsx` (new)
**Changes**: the fixed mapping and the shared highlight, with path data from the mock:

```tsx
import { useId } from "react";

import { CATEGORY_TINT } from "../features/closet/railScale";
import type { ItemCategory } from "../features/closet/types";

/** Fixed mapping (Decision 4): the same category always shows the same shape, everywhere
    a category is labelled — shuffle rails, closet headers, the upload category picker. */
const SHAPE_PATH: Record<ItemCategory, string> = {
  tops: "…", // sun
  bottoms: "…", // crescent moon
  dresses: "…", // star
  jackets: "…", // cloud
  shoes: "…", // 4-point sparkle
  accessories: "…", // heart
};

/** A ~12px solid watercolor-tinted shape marker: the category's tint with the soft white
    highlight the old dots had. Pattern fills can't read at this size (Decision 4). */
export function CategoryShape({
  category,
  className = "",
}: {
  category: ItemCategory;
  className?: string;
}) {
  // Ids resolve document-wide; every instance needs its own highlight gradient.
  const highlightId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 ${CATEGORY_TINT[category]} ${className}`}
    >
      <defs>
        <radialGradient id={highlightId} cx="0.32" cy="0.3" r="0.5">
          <stop offset="0" stopColor="white" stopOpacity="0.5" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={SHAPE_PATH[category]} fill="currentColor" />
      <path d={SHAPE_PATH[category]} fill={`url(#${highlightId})`} />
    </svg>
  );
}
```

(Exact `d` strings come from the approved mock. If a mock shape used multiple subpaths,
merge them into one `d` per category — the two-layer fill+highlight idiom depends on it.)

#### 2. Rail

**File**: `src/components/Rail.tsx`
**Changes**: the prop is the category now, not a tint class — the mapping lives in one
place.

- `RailProps` (`:18`): `tintClass?: string` → `category?: ItemCategory` (comment: "fixed
  category shape beside the label (pure decoration)"); import `ItemCategory` beside the
  existing `ClosetItem` import.
- Destructuring (`:124`): `tintClass` → `category`.
- The dot span (`:227-232`) becomes:

```tsx
        {category && <CategoryShape category={category} />}
```

#### 3. ShufflePage

**File**: `src/features/shuffle/ShufflePage.tsx`
**Changes**: all six rails: `tintClass="text-tint-tops"` → `category="tops"`, and likewise
`dresses`, `jackets`, `bottoms`, `shoes`, `accessories` (`:134`, `:153`, `:171`, `:189`,
`:206`, `:222`).

#### 4. ClosetPage section headers

**File**: `src/features/closet/ClosetPage.tsx`
**Changes**: the dot span (`:214-218`) becomes `<CategoryShape category={category} />`;
drop `CATEGORY_TINT` from the `railScale` import if nothing else in the file uses it.

#### 5. UploadFlow category picker

**File**: `src/features/uploads/UploadFlow.tsx`
**Changes**: the dot span (`:285-288`) becomes `<CategoryShape category={option} />`; prune
the `CATEGORY_TINT` import likewise.

#### 6. The flower swatch

**File**: `src/features/theme/ThemePicker.tsx`
**Changes**: a local component (both consumers live in this file), geometry from the mock:

```tsx
/** One uniform 5-petal flower for every swatch (Decision 5): color IS the information, so
    the shape never varies — and it stays visually distinct from the category shape set. */
function FlowerSwatch(props: { "data-theme"?: string }) {
  const highlightId = useId();
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="text-accent h-4 w-4"
    >
      {/* five petals + center, all currentColor so the silhouette reads as one bloom;
          highlight gradient overlaid as in CategoryShape */}
      …
    </svg>
  );
}
```

- Picker row (`:40-44`): the span becomes `<FlowerSwatch data-theme={preset.id} />` — the
  re-scope attribute moves onto the svg itself; `[data-theme]` matches any element, so the
  swatch keeps painting its own theme's accent under any active theme.
- `ThemePickerButton` (`:63-67`): the span becomes `<FlowerSwatch />` (no `data-theme`:
  shows the active theme's accent, as today).

#### 7. Delete the dot

**File**: `src/index.css`
**Changes**: remove `.watercolor-dot` (`:200-214`) — all four consumers are gone. Update
the stale cross-reference in `railScale.ts:42` ("the watercolor dot beside a category
label" → the CategoryShape idiom).

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Tests pass unmodified: `npm test` (193 tests, 12 files)
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff
- [x] The dot is gone: `grep -rn "watercolor-dot\|tintClass" src` → no matches

#### Manual Verification:

- [ ] Shuffle rails: sun/cloud/moon/sparkle/heart (and star on a dress base) sit beside the
      labels at ~12px in the right tints; the label row's vertical rhythm didn't jump.
- [ ] Closet headers and the upload flow's category picker show the identical shapes — same
      category, same shape, all three surfaces.
- [ ] Theme picker: five identical flowers, each painting its own theme's accent regardless
      of the active theme; the ring on the active swatch still reads; the mobile button's
      flower shows the active accent and the popover works unchanged.
- [ ] Across all five themes: no shape goes muddy against its paper.

**Implementation Note**: pause for manual confirmation before Phase 4.

---

## Phase 4: Ribbon family

### Overview

The hero of the pass: three ribbons under three page titles, and the death of `#sketchy`.

### Changes Required:

#### 1. The ribbon component

**File**: `src/components/Ribbon.tsx` (new)
**Changes**: one component, three variants, geometry and pattern tiles from the approved
mock:

```tsx
import { useId } from "react";

export type RibbonVariant = "plaid" | "gingham" | "stripe";

/**
 * The title ribbons (Decision 3): a gently wavy band filled with an axis-aligned pattern —
 * SVG patterns tile in straight user space, so a soft wave over a straight weave reads
 * hand-sewn — plus solid-color curled ends drawn as separate paths (the "reverse side of
 * the ribbon" trick). Frilliness lives in the silhouette, never in warping the pattern
 * (no displacement filters, Decision 2). All fills are CSS-var styles: inline SVG resolves
 * var() through the fill *property*, not the presentation attribute.
 */
export function Ribbon({
  variant,
  className = "",
}: {
  variant: RibbonVariant;
  className?: string;
}) {
  const patternId = useId();
  …
}
```

Per-variant spec (from the mock; dominance per Decision 3):

- **`plaid`** (Today, the hero): pattern tile weaving `var(--color-accent)` +
  `var(--color-accent-2)` + `var(--color-accent-3)` bands at partial opacity; soft
  downward-curled ends in solid accent.
- **`gingham`** (Closet): two-tone accent-2-over-paper grid; folded notch ends in solid
  accent-2.
- **`stripe`** (Outfits): diagonal accent-3/paper candy stripes; upward-curled ends in
  solid accent-3.

The svg carries `aria-hidden="true"` and no fixed text color — every fill is an explicit
`style={{ fill: "var(--color-…)" }}`, so the ribbon redyes with the theme.

#### 2. Today: replace the paint stroke

**File**: `src/features/shuffle/ShufflePage.tsx`
**Changes**: the underline svg and its comment (`:75-99`) become:

```tsx
        {/* The wavy plaid ribbon — the hero of the ribbon family (Decision 3). */}
        <Ribbon variant="plaid" className="mx-auto mt-3 h-5 w-48 sm:h-6 sm:w-56" />
```

(The `filter: url(#sketchy)` reference dies here.)

#### 3. Closet: add the gingham

**File**: `src/features/closet/ClosetPage.tsx`
**Changes**: directly after the h1 (`:186-188`), inside the existing header:

```tsx
        <Ribbon variant="gingham" className="-mt-1 h-5 w-44 sm:h-6 sm:w-52" />
```

(The header's `gap-4` plus a small negative margin keeps the ribbon snug under the title —
exact spacing per the mock.)

#### 4. Outfits: add the candy-stripe

**File**: `src/features/outfits/OutfitsPage.tsx`
**Changes**: wrap the bare h1 (`:35-37`) in a centered header so the ribbon can hang under
it:

```tsx
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          saved outfits
        </h1>
        <Ribbon variant="stripe" className="h-5 w-44 sm:h-6 sm:w-52" />
      </header>
```

#### 5. Remove `#sketchy`

**File**: `src/components/Layout.tsx`
**Changes**: delete the filter svg and its comment (`:20-32`) — the underline was its only
consumer, and displacement on small elements is banned (Decision 2).

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Tests pass unmodified: `npm test` (193 tests, 12 files)
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff
- [x] The filter is gone: `grep -rn "sketchy" src` → no matches

#### Manual Verification:

- [ ] Today: the plaid ribbon sits where the paint stroke was — crisp edges at every zoom
      level and on a retina display (the whole point of the pass); the date line below
      didn't shift awkwardly.
- [ ] Closet and Outfits: gingham and candy-stripe hang under their titles; the empty
      Outfits state ("nothing saved yet") still lays out correctly under the new header.
- [ ] Each ribbon's pattern stays straight while the band waves; curls read as the ribbon's
      reverse side.
- [ ] Theme picker redyes all three ribbons live; check all five themes — the plaid must
      stay lively-but-soft on each paper (the Phase 1 constraint, now in situ).
- [ ] The Today empty state ("your closet is waiting") is unchanged — it never had the
      underline.
- [ ] Nothing else on the pages regressed (aura, cascade, rails — the slide-animation work
      shares these files).

**Implementation Note**: pause for manual confirmation before Phase 5.

---

## Phase 5: Finishing stitches

### Overview

The two small closers: the running-stitch hairline on closet headers, and the quote-wash
softening.

### Changes Required:

#### 1. Running stitch

**File**: `src/components/CategoryShape.tsx` (or a sibling; implementer's call — it's
closet-header-only today but is generic trim)
**Changes**: a `RunningStitch` component — path from the mock:

```tsx
/** A faint hand-sewn hairline (Decision 7): dashed, slightly wobbly, cropped at the row's
    edge. Fixed-scale viewBox + slice keeps the dash rhythm true at any row width —
    preserveAspectRatio="none" would stretch the stitches. */
export function RunningStitch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 8"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      className={`text-ink/10 h-2 min-w-0 flex-1 ${className}`}
    >
      <path
        d="M0 4 C 100 2.5, 200 5.5, 300 4 S 500 2.5, 600 4 S 800 5.5, 900 4 S 1100 2.5, 1200 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="7 6"
      />
    </svg>
  );
}
```

**File**: `src/features/closet/ClosetPage.tsx`
**Changes**: append `<RunningStitch />` inside the header row (`:213-222`), after the h2 —
the row is already `flex items-center gap-2`, so `flex-1` carries it to the edge.

#### 2. Quote-wash softening

**File**: `src/index.css`
**Changes**: `.quote-wash::before` (`:281-292`) — longer falloff, more blur, and a touch
more inset so the blur has room (starting values; final ones from the mock's
before/after):

```css
.quote-wash::before {
  content: "";
  position: absolute;
  inset: -1.25rem -1rem;
  z-index: -1;
  background: radial-gradient(
    ellipse at 30% 25%,
    color-mix(in srgb, var(--color-aura-1) 40%, transparent),
    transparent 85%
  );
  filter: blur(12px);
}
```

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Tests pass unmodified: `npm test` (193 tests, 12 files)
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff

#### Manual Verification:

- [ ] Closet headers: the stitch trails from each label to the row's right edge at hairline
      faintness — visible when looked for, invisible when reading; dash length identical at
      mobile and desktop widths.
- [ ] Empty categories ("Nothing here yet!") show the stitch too — the header row is the
      same either way.
- [ ] The quote blob has no discernible edge on any of the five papers; the quote text is
      still comfortably readable over it (Rosewood's aura-1 is the strongest — check there
      first).
- [ ] Sidebar spacing around the quote didn't shift (the ::before is absolutely
      positioned; only its bleed grew).

---

## Testing Strategy

### Unit Tests

None to add, none to change. Vitest is node-env, `src/**/*.test.ts` only — domain logic by
design (`CLAUDE.md`). Every change here is presentational SVG/CSS with no extractable pure
function. The existing suite passing **unmodified** in every phase is the regression guard
that no store, shuffle, or pipeline logic moved.

### Manual Testing Steps

1. Run each phase's manual checklist at its gate (Phases 1, 3, 4 pause for confirmation).
2. Full-app pass at the end, per theme (all five): Today with a full outfit and with an
   empty closet, Closet with items and empty, Outfits with saves and empty, the upload flow
   through the category step, the mobile theme-picker popover.
3. Retina/zoom check on the Today ribbon specifically — it replaces the artifact Joyce
   originally flagged, so it must be crisp at 100%/200% zoom on a 2x display.
4. Mobile width: ribbons under titles don't overflow; the closet stitch still reaches the
   edge; rail labels with 12px shapes don't wrap.
5. Reduced motion: nothing in this plan animates, but confirm no accidental animation
   sneaked in (the global clamp at `index.css:232-247` would flag it by freezing).

## Performance Considerations

All additions are static inline SVG — no filters at render time except the one `blur` the
quote wash already had (now 12px on the same single ::before; blur cost is per-element and
this one is small and static). The removed `#sketchy` `feDisplacementMap` was the most
expensive paint effect on the Today page — net win. `useId`-keyed defs add a handful of DOM
nodes per marker (≤ 18 markers on the closet page — trivial). No bundle-size change beyond
~2–3 KB of component source; no new dependencies.

## Migration Notes

Nothing persisted changes — no storage keys, no store shapes, no theme ids. A user's saved
theme simply gains two tokens on next load. Rollback is reverting the commits; each phase
is independently revertible except Phase 3/4's dependence on Phase 2's tokens (reverting
Phase 2 alone would leave ribbons weaving `var()`s that resolve to nothing — revert
forward-to-back).

## References

- Design decisions (source of truth):
  `thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md`
- Underline + filter to remove: `src/features/shuffle/ShufflePage.tsx:77-99`,
  `src/components/Layout.tsx:22-32`
- `.watercolor-dot` + four consumers: `src/index.css:200-214`; `src/components/Rail.tsx:227-232`,
  `src/features/closet/ClosetPage.tsx:214-218`, `src/features/uploads/UploadFlow.tsx:285-288`,
  `src/features/theme/ThemePicker.tsx:40-44` + `:63-67`
- Theme token blocks: `src/index.css:3-24` (defaults), `:114-196` (presets, unlayered)
- Quote blob: `src/index.css:277-292`
- Category plumbing: `src/features/closet/railScale.ts` (`CATEGORY_TINT`, `CATEGORIES`,
  `CATEGORY_LABEL`), `src/features/closet/types.ts` (`ItemCategory`)
- Sibling plan sharing these files (uncommitted work):
  `thoughts/shared/plans/2026-07-30-shuffle-rail-slide-animation.md`
- User decisions during planning: UploadFlow's picker **in scope**; **mock-first** with a
  hard sign-off gate before any app code
