---
date: 2026-07-31
source: grill-to-decisions
input: Raw brief — the shuffle page's aura is well liked; give the other three pages (week, outfits, closet) an aura too, each looking different so the pages don't share one background.
status: decided
---

# Design Decisions: Page auras — one light, four rooms

## Decision 1: The auras are wayfinding, not atmosphere

**Context**: Two readings of the brief. Either the aura's job off the Today page is to keep the app from feeling bare (atmosphere — subtle variations of one wash), or to make each page recognizable before you read a word (identity — strong differentiation, per-page signature color).
**Options**: atmosphere — safer, guaranteed harmonious, but the pages read samey and the aura earns nothing · identity — the differences do work.
**Decision**: **Identity.** The codebase already committed to per-page identity: the ribbon family gives each page its own weave and its own accent thread, "no accent is ever spent twice" (`Ribbon.tsx:50-70`). Auras that echo that produce one legible language instead of two decorative ones, and give a non-arbitrary rule for choosing colors. Each page should be recognizable from its light alone.

## Decision 2: The thread law — where each page's aura color comes from

**Context**: Every theme defines `--color-aura-1/2/3`, six category tints, and four accents (`index.css:153-250`), so any of them works across all five themes for free. The question is which each page draws on.
**Options**: everything stays on the aura trio and only composition differs (safe, tuned for blur, but samey) · each page washes in its own ribbon thread (reinforces the existing wayfinding system).
**Decision**: **The thread law.** Today keeps the pure aura trio — `aura-1/2/3` stay its signature. Every other page washes in its own ribbon thread:

- **week** → `--color-accent-4` (the polka thread) traversing to `aura-1`
- **outfits** → `--color-accent-3` (the stripe thread) with `aura-3`
- **closet** → `--color-accent-2` (the gingham thread) in its header pool, then its six category tints below (Decision 10)

**Binding constraint**: accents are tuned for line work at full opacity, not for wide washes at low opacity. Each page's aura is its thread **mixed with an aura token**, never the raw accent alone. No new hex values are introduced anywhere — everything derives from existing theme tokens, so all five presets work without additional authoring.

## Decision 3: Every page breathes, but only Today is loud — this supersedes the "only ambient motion" rule

**Context**: `thoughts/shared/decisions/2026-07-17-ui-artistic-polish.md:56` states the aura is "the ambient centerpiece and **the only ambient motion in the app**," and Decision 1 of that doc frames the aesthetic as "one living element, not decoration everywhere." Auras on four pages ends that as written.
**Options**: keep Today as the only moving aura and let the others sit perfectly still (preserves the old rule literally) · all four breathe, at a deliberate hierarchy.
**Decision**: **All four breathe, slower and quieter than Today.** The app's rule is now an **ambient motion ladder**, not a single living element: Today is the centerpiece and stays strictly the loudest; every other page's aura is audibly subordinate. Per project convention, `2026-07-17-ui-artistic-polish.md` is **not edited** — `thoughts/` docs are historical snapshots (CLAUDE.md). This decision supersedes its "only ambient motion" clause; the surrounding aesthetic (one centerpiece, no particles, no sparkles, reduced-motion respected) still stands.

## Decision 4: Today's aura is the only one that answers an event

**Context**: Today's aura re-blooms when Shuffle All bumps the cascade tick, via a keyed remount (`ShufflePage.tsx:99-104`). The other pages each have a candidate event: paging ±7 days, saving/deleting an outfit, an upload landing.
**Options**: give each page a signature reactive event (livelier) · keep reactivity unique to shuffle.
**Decision**: **Shuffle stays the only reactive aura.** The re-bloom is a *reward* — the app applauding the dice roll. If everything re-blooms, nothing does, and three pages would gain store subscriptions purely for decoration. The closet's would also fire mid-scroll, far from the element that moved. Consequence: the new work is almost entirely `index.css` plus markup, with **no new store subscriptions and no data-derived conditions in any decorative layer**.

## Decision 5: All four auras bloom on page entry

**Context**: React Router remounts page components on navigation, so the existing `aura-bloom` keyframe (`index.css:460-469`) plays for free on mount.
**Options**: only Today blooms · all four bloom on entry.
**Decision**: **All four bloom on entry**, sharing one entrance animation and curve. Arriving on a page reads as the light coming up on it. Today's distinction is therefore the **re**-bloom mid-page (Decision 4), not the entrance — which is the right place for the distinction to live, and leaves one entrance to tune rather than four.

## Decision 6: Auras stop at the sidebar; "content column" means the full width right of it

**Context**: The sidebar is `sticky z-30` with **no background** (`Layout.tsx:31`) — transparent over the body's paper. Anything viewport-fixed would push color behind the quote, the nav, and the theme dots by default. Separately, `main` is `max-w-5xl` centered (`Layout.tsx:94-97`), so a 1512px screen leaves roughly 110px of unused margin on each side of the content box.
**Options**: full-window wash including the sidebar · clipped to the `max-w-5xl` content box · full width right of the sidebar.
**Decision**: **Content column only, all four pages** — the sidebar is chrome, and chrome holding still is what lets the page underneath change character. `.quote-wash` (`index.css:321-333`) remains the only color over there. **"Content column" means the full page area to the right of the sidebar, not the `max-w-5xl` box**: the aura spills into those side margins, which is where the genuinely open space is (see Decision 7). Clipping to the text measure would give the aura hard vertical edges and read as a rectangle rather than light.

## Decision 7: Cards stay opaque — the aura is light *around* the content

**Context**: The Today page is the only one whose content is transparent (cut-out PNGs floating on nothing), which is exactly why its aura reads so well. Every other page's content is opaque white: `DayBox.tsx:73-74` (`bg-white`, `gap-2`), `OutfitCard.tsx:186` (`bg-white`, `gap-5`), `ClosetPage.tsx:77` (`bg-white`, `gap-3`). An aura behind those grids is visible only in the gutters.
**Options**: soften cards to ~`bg-white/70` so the aura tints through (much more aura, but changes the established card look on three pages and degrades cut-out photos, which need a clean white ground) · leave cards opaque and compose the aura around them.
**Decision**: **Cards stay opaque paper.** Paper being opaque is the sketchbook conceit, and `paper-card` grain plus `card-wash` (`index.css:337-371`) already handle card-level color deliberately. The aura therefore lives in the **page margins, the vertical gaps between sections, and behind headers and empty states**. This is a compositional constraint on all three new auras, not an afterthought: place them where they will actually be seen.

## Decision 8: Week — a surround horizon, and it does not mark today

**Context**: The original sketch was a wide band behind the seven-column grid. Under Decision 7 that band would be almost entirely covered by seven opaque boxes with 8px gutters. Separately, `DayBox.tsx:74` already marks today with `border-accent/40 bg-wash/40`.
**Options**: band behind the grid (mostly hidden) · band as surround light · band that also brightens under today's column.
**Decision**: **A surround horizon.** A wide, low field centered on the grid but extending well above and below it, so it reads behind the header, in the side margins, and under the grid's bottom edge — the grid floats *in* the light rather than covering it. Color traverses `accent-4` → `aura-1` across the width, so the week has direction, like a landscape strip rather than a spotlight. Breathing is horizontal — the band stretches and relaxes rather than scaling, so it reads as weather crossing a landscape, not a pulse. **The band must not encode today**: that is already encoded properly at `DayBox.tsx:74`, and decoration duplicating a data encoding drifts out of sync the moment either changes.

## Decision 9: Outfits — a viewport-fixed gallery wall

**Context**: A grid of opaque cards on a page that can grow long.
**Decision**: **Two blobs only** (not three), anchored into opposite corners — top-left and bottom-right — so the composition is diagonal and the middle of the grid stays clean. Larger radius and softer falloff than Today, in `accent-3` with `aura-3`. **Fixed to the viewport**, so scrolling a long grid feels like panning across a wall while the light stays put. Breathing amplitude here is the smallest of the four — barely perceptible, which is the point at that apparent distance.

## Decision 10: Closet — a gingham header pool, then six scrolling tint pools

**Context**: `CATEGORIES.map` renders six real `<section>` elements, each a header row (`CategoryShape` + label + `RunningStitch`) over a tile grid (`ClosetPage.tsx:303-343`). The page header above them — title, gingham ribbon, item count, add button, backup controls (`ClosetPage.tsx:281-302`) — would otherwise sit on bare paper while everything below it carried color, giving the app's longest page a conspicuously cold opening.
**Options**: section pools only (leaves the header cold, and makes closet the one page with no thread) · a header pool plus the section pools.
**Decision**: **Both.** A single pool behind the title/ribbon in `accent-2`, the gingham thread — so all four pages open in their own thread, and closet alone then continues into a **tint progression**: each section gets a pool in its own `--color-tint-*`, bleeding out from under the header row and fading before the tiles. Scrolling the closet moves through a color story keyed to the category system rather than one flat wash. **The closet's pools scroll with their sections** — a pool that identifies the tops section must travel with it — which is the deliberate counterpart to the outfits aura being fixed (Decision 9), and makes the two long pages feel different rather than same-but-recolored. Weight: header pool ≈ the sidebar's `.quote-wash`; section pools quieter still.

## Decision 11: Empty sections and empty states always get their aura

**Context**: All six closet sections render even when empty, showing "Nothing here yet!" (`ClosetPage.tsx:322-325`). `NothingToWear` returns before the canvas wrapper (`ShufflePage.tsx:66-67`), so a brand-new user's very first screen currently has **no aura at all**. Outfits has its own "nothing saved yet" state.
**Options**: color as a reward for having content (page visibly recolors as you upload) · aura unconditional.
**Decision**: **Unconditional — an aura is a property of the page, not of its data.** Empty closet sections keep their pools; because a pool is anchored to its section, an empty section is short and gets a small pool for free, so emptiness solves itself geometrically with no conditional. `NothingToWear` gains the stage aura, which fixes the emptiest screen in the app — the one every new user sees first and the one currently selling the aesthetic worst. This also follows from Decision 4: no data-derived conditions in decorative layers.

## Decision 12: Softness comes from gradient falloff, not from blur

**Context**: Today's blobs are `filter: blur(56px)` (`index.css:419-424`), the expensive part. The closet would carry a header pool plus six section pools on a scrolling page — large-radius blur on seven layers is where phones would complain. The codebase already has the cheaper idiom: `.card-wash::before` (`index.css:359-371`) uses **no** filter at all and `.quote-wash::before` (`index.css:321-333`) only `blur(14px)`; both read soft because the *gradient falloff* is long (`2026-07-30 Decision 8` deliberately lengthened it).
**Options**: match Today's blur everywhere for consistency and eat the cost · derive softness from falloff.
**Decision**: **Long-falloff gradients with little or no filter on all three new auras**; Today keeps its `blur(56px)` cloud untouched. One element per pool, `transform`/`opacity` animated only, blur always static. This is simultaneously the performance answer and a differentiation axis: Today is a blurred cloud, the other pages are washes with soft edges — related, not copies.

## Decision 13: One composition per page, at every viewport

**Context**: Below `lg` the week grid wraps to 2–3 columns (`WeekPage.tsx:62-63`), so a Monday→Sunday left-to-right traverse stops mapping to days on a phone.
**Options**: fork compositions by breakpoint (vertical wash on mobile, horizon on desktop; fewer layers on phones) · one composition everywhere.
**Decision**: **One composition per page, all viewports.** The traverse is a colour gesture, not a data encoding — nobody decodes it, and it looks good wrapped or not. Forking would double the tuning surface permanently, across five themes. Phones get the same auras; performance is handled by the layer/blur budget (Decision 12), not by breakpoint forks.

## Decision 14: Each page renders its own aura, and Today's CSS is not modified

**Context**: `2026-07-30-ui-refinement-ribbons-and-shapes.md:69` records "the aura — untouched, Joyce likes it as-is." Centralizing in `Layout` is not viable regardless: the closet's pools must live inside each `<section>`, and Today's must live inside the canvas wrapper to receive the cascade tick. `Layout` already switches on `pathname` twice (`Layout.tsx:16-21`), a pattern not to grow.
**Options**: fully generalize into one parameterized aura with Today as a config of it (cleaner on paper, risks visual drift on the one thing that must not change) · additive variants.
**Decision**: **Additive.** Today's existing rules (`.aura`, `.aura > div`, `.aura-blob-1/2/3`, both keyframes — `index.css:409-469`) are **not edited, renamed, or restructured**; new variants are sibling classes. A small `<Aura variant>` component may centralize the *markup* so there is one DOM shape, with the "stage" variant emitting Today's existing markup verbatim — but zero changes to Today's CSS, and Today must be visually identical after this slice. Pages render their own aura; nothing is routed through `Layout`.

## Decision 15: The loudness ladder is binding; the numbers are not

**Context**: Exact opacities, cycle lengths and falloff stops depend on how five themes actually render at low opacity, which is an eyeball call.
**Options**: pin exact values here · fix the law and leave values to implementation.
**Decision**: **Fix the law.** Binding, in order:

1. Today rests strictly loudest; no other page exceeds **half** Today's resting opacity.
2. Non-Today breathing amplitude ≤ **0.08** opacity delta, on cycles ≥ **40s**.
3. No two closet section pools may breathe in phase — stagger with negative delays, as Today's blobs already do (`index.css:431-447`).
4. Nothing may reduce text contrast anywhere, on any of the five themes.
5. Reduced motion freezes **every** aura at its resting opacity — the existing kill switch (`index.css:268-283`) targets `.aura`/`.aura > div` and must be extended to cover all new variants, not left to the global `0.01ms` clamp (which would leave `infinite alternate` looping frantically).

Exact hexes, percentages and durations are implementation-time craft under those constraints.

## Codebase Findings

- **The existing aura**: `.aura` + three blobs at `index.css:409-469` — `blur(56px)`, resting `opacity: 0.6`, breathing 19/23/27s with staggered negative delays; rendered at `ShufflePage.tsx:96-104` inside a `relative isolate` wrapper, keyed on `useCascade`'s tick so Shuffle All remounts and replays `aura-bloom`.
- **The per-page accent law already exists**: `Ribbon.tsx:56-70` — plaid→`accent`, gingham→`accent-2`, stripe→`accent-3`, polka→`accent-4`, with "no accent is ever spent twice." Decision 2 extends this system rather than inventing one.
- **All non-Today content is opaque**: `DayBox.tsx:73-74`, `OutfitCard.tsx:186`, `ClosetPage.tsx:77` — all `bg-white`, with gutters of 8–20px. This is the single most design-relevant fact in the slice (Decision 7).
- **Today is already marked** on the week: `DayBox.tsx:74` (`border-accent/40 bg-wash/40`).
- **Closet sections are real, always-rendered DOM**: `ClosetPage.tsx:303-343`, six of them from `CATEGORIES.map`, each with a header row and grid, empty ones included.
- **Layout geometry**: `main` is `mx-auto w-full px-4 py-8 md:px-10` at `max-w-5xl`, or `max-w-7xl` on the week (`Layout.tsx:94-97`). The sidebar is `sticky top-0 z-30` with **no background** (`Layout.tsx:31`) — and its comment records that being a stacking context is load-bearing for the save popover, so it must not be disturbed.
- **`position: fixed` viability** (needed by Decision 9): no ancestor of `main` sets `transform`/`filter`/`contain`, so a fixed child positions against the viewport as expected. It will need explicit insetting on `md+` to honour Decision 6, since fixed positioning otherwise ignores the sidebar's grid column entirely.
- **Cheaper wash idioms to copy**: `.quote-wash::before` (`index.css:321-333`, long falloff + `blur(14px)`) and `.card-wash::before` (`index.css:359-371`, gradient only, no filter).
- **Theme coverage is free**: all five presets define `aura-1/2/3`, all six tints, and `accent-2/3/4` (`index.css:153-250`). No new colour authoring is required by any decision here.
- **Tests**: Vitest runs `environment: "node"` over `src/**/*.test.ts` only — domain logic, no DOM or component tests, by design (CLAUDE.md). This slice is CSS and markup, so it is expected to add **no** tests; verification is `npm run typecheck`, `npm run lint`, and looking at all four pages across all five themes plus reduced motion.
- **Decision numbering restarts per doc** — refer to these elsewhere as "2026-07-31 page-auras Decision N".

## Out of Scope

- **Editing `2026-07-17-ui-artistic-polish.md`** — superseded in place by Decision 3, never rewritten; `thoughts/` docs are historical snapshots.
- **Any change to Today's aura** — CSS, markup, timings, colors, and the Shuffle All re-bloom all stay exactly as they are (Decision 14).
- **Card translucency** on any page (Decision 7), and any change to `paper-card` / `card-wash` / `.quote-wash`.
- **Aura in the sidebar or behind it** (Decision 6).
- **Reactive auras** on week/outfits/closet — no store subscriptions, no keyed remounts, no data-derived conditions (Decision 4).
- **The week band marking today** or otherwise encoding plan data (Decision 8).
- **Breakpoint-forked compositions and per-device aura budgets** (Decision 13).
- **Routing auras through `Layout`** or growing its `pathname` switching (Decision 14).
- **New color tokens or theme presets** — everything derives from existing tokens (Decision 2).
- **Particles, sparkles, gradient meshes, scroll-linked parallax** — still out, per the 2026-07-17 aesthetic that otherwise stands.
