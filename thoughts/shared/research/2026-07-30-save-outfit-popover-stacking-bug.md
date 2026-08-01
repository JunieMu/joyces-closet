---
date: 2026-07-30T22:07:05-05:00
researcher: Joyce Ma
git_commit: 1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c
branch: main
repository: joyces-closet
topic: "Save Outfit button doesn't save; naming popover renders under the jacket rail's carousel arrow"
tags: [research, codebase, outfits, layout, z-index, stacking-context, OutfitActions, Layout, Rail]
status: complete
last_updated: 2026-07-30
last_updated_by: Joyce Ma
---

# Research: Save Outfit button doesn't save; popover overlapped by the jacket carousel arrow

**Date**: 2026-07-30T22:07:05-05:00 (CDT)
**Researcher**: Joyce Ma
**Git Commit**: `1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c` (working tree dirty)
**Branch**: `main`
**Repository**: joyces-closet

## Research Question

The Save Outfit button is broken — it doesn't save. The naming popup also renders overlapped by the
jacket rail's carousel arrow. Diagnose the cause and the fix.

## Summary

**These are not two bugs. They are one bug, and the overlap is the cause of the save failure.**

The save *logic* is fine — `handleSave` → `useOutfitsStore.saveOutfit` → `localStorageStore.save`
is correct end to end and round-trips cleanly through `isOutfitShape`. Nothing on that path is
broken.

What is broken is **paint order**, and because hit-testing follows paint order, the click on
**Save** never reaches the Save button at all. It is swallowed by the jacket rail sitting on top
of the popover.

The root cause is a single class on one line:

> `src/components/Layout.tsx:21` — `<aside className="... sticky top-0 ...">`

`position: sticky` **creates a stacking context**. That traps the popover's `z-20`
(`OutfitActions.tsx:125`) *inside the sidebar*, where it can only outrank the sidebar's own
children. Meanwhile the shuffle canvas is wrapped in `relative isolate`
(`ShufflePage.tsx:93`), which is its own stacking context, positioned, at `z-index: auto`, and
**later in DOM order than the `<aside>`**. Two sibling stacking contexts both at `z-index: auto`
paint in tree order — so the entire canvas, jacket rail included, paints above the entire sidebar,
`z-20` and all.

The popover opens with `left-full ml-4 w-72`, deliberately floating right *over* the canvas
(Decision 10). So it lands in the jacket column — which the desktop grid puts leftmost, directly
against the sidebar — and lands *underneath* it. Clicks on Save hit the jacket frame instead:
a dead click, because the frame's only pointer handler is a 40px swipe threshold that a tap never
crosses. Nothing happens, nothing saves, no error.

**The fix is one class**: give the `<aside>` a z-index so its stacking context outranks the canvas.

**Desktop only.** The mobile bottom bar is `position: fixed` *after* `<main>` in DOM order, so it
already paints above the canvas and its popover works.

## Detailed Findings

### The save path is correct — rule it out first

Every link in the chain checks out:

- `OutfitActions.tsx:54-59` — `handleSave` guards `outfit === null`, calls `saveOutfit(name, outfit)`,
  closes the popover, sets `justSaved`.
- `useOutfitsStore.ts:27-35` — mints `crypto.randomUUID()`, falls back to `defaultOutfitName` on an
  empty name, persists first and *then* mirrors into the store — exactly the ordering CLAUDE.md
  prescribes.
- `localStorageStore.ts:48-58` — upsert by id, writes JSON.
- `localStorageStore.ts:8-17` + `outfit.ts:28-50` — the read-back filter. Worth checking explicitly,
  because a `save` that writes but fails to read back would look identical to "doesn't save".
  It doesn't: an `Outfit` carries `base`, `jacketId`, `shoesId`, `accessoryId`; `isOutfitShape`
  accepts `null` for the optional slots via `optionalOk`; JSON preserves `null`. Round-trip is clean.

So the data layer is not the problem. The click never arrives.

### Why `z-20` doesn't work: the sticky sidebar traps it

```
<div class="min-h-screen md:grid md:grid-cols-[17rem_1fr]">   ← root stacking context
  <aside class="sticky top-0 ...">                            ← STACKING CONTEXT (sticky), z-index: auto
    └─ OutfitActions → <form class="absolute z-20 ...">       ← z-20 scoped to the aside. Dead end.
  <header class="md:hidden">                                  ← mobile only
  <main>                                                      ← NOT positioned
    └─ ShufflePage → <div class="relative isolate w-full">    ← STACKING CONTEXT, z-index: auto
         └─ .paper-doll → jacket Rail → ‹ / frame / ›
  <div class="fixed inset-x-0 bottom-0 md:hidden">            ← mobile bar, last in DOM
```

Per CSS painting order, two positioned siblings both at `z-index: auto` paint in **tree order**.
`<aside>` comes before `<main>`, so the canvas's stacking context paints last — on top of the
sidebar as an atomic unit. Because the aside is itself a stacking context, the popover's `z-20`
is confined inside it and cannot lift the popover out.

The decisive detail is that **`position: sticky` creates a stacking context even at
`z-index: auto`** (unlike `relative`/`absolute`, which only do so with an explicit z-index). Remove
the sticky and `z-20` would work; `sticky` is the specific culprit.

**The control case in this same codebase proves it.** The theme picker popover uses `z-30`
(`ThemePicker.tsx:100`) and works fine — because its ancestor chain (`<header>` → `div.relative`
at `z-auto`) creates *no* stacking context, so its `z-30` reaches the root context and clears the
canvas. Same pattern, different ancestor, opposite outcome.

Confirmed by grep: `src/components/Layout.tsx:21` is the only `sticky` in the app, and no z-index
is set on the `<aside>` anywhere.

### Why it's specifically the *jacket* arrow

The desktop paper-doll grid puts the jacket in the **leftmost column** — the one nearest the
sidebar (`src/index.css:259-269`):

```css
@media (min-width: 768px) {
  .paper-doll {
    grid-template-areas:
      "jacket top accessory"
      ".      bottom shoes";
    grid-template-columns: 1.15fr 1.15fr 1fr;
  }
}
```

A popover opening rightward out of a 17rem sidebar has nowhere to land *but* the jacket column.

### Geometry: which control eats which click

At a 1440px viewport (sidebar 272px; `main` is `max-w-5xl mx-auto md:px-10`):

| Element | Horizontal span |
|---|---|
| Popover (`left-full ml-4 w-72`) | **264 → 552** |
| `main` content box | 384 → 1328 |
| Jacket column (1.15fr of 912px free) | 384 → 702 |
| Jacket `‹` arrow (`h-9 w-9`) | **384 → 420** |
| Jacket frame window (`flex-1`) | **420 → 666** |
| Popover's **Save** button (`justify-end`, ~75px) | **461 → 536** |
| Popover's **Cancel** button (~80px) | 373 → 453 |

Vertically the popover sits roughly y≈300–450 (anchored `top-0` to the Save Outfit button), and the
jacket rail's frame spans roughly y≈264–520 with its arrows centered near y≈392. They overlap.

So at typical desktop widths:

- **Save (461–536) lands on the jacket frame window.** The frame has no `onClick` — only
  `onPointerDown`/`onPointerUp` swipe handlers gated on `SWIPE_THRESHOLD_PX = 40`
  (`Rail.tsx:23, 211-219`). A tap moves ~0px, so it is discarded. **A completely silent dead click** —
  which is exactly what "the button does nothing" looks like.
- **The name input and Cancel overlap the `‹` arrow (384–420)**, whose `onClick={() => step(-1)}`
  fires `setSlot("jacket", …)`. So clicking into the name field can silently step the jacket
  backwards instead.

Which control eats which click shifts with viewport width (at 1280px the whole map slides ~72px
left), which is why the failure can feel intermittent rather than deterministic.

### Confirming test (5 seconds, no code change)

Open the popover and press **Enter** in the name field instead of clicking Save.

Enter submits the `<form>` via the keyboard, bypassing hit-testing entirely — so **it will save**,
the button will flip to "Saved ✓", and the outfit will appear on /outfits. Click fails, keyboard
succeeds ⇒ the bug is pointer interception, not save logic. (Second tell: watch the jacket rail
while clicking around the popover — you'll see it slide.)

### This is pre-existing, not from the uncommitted work

`git diff` on the working tree touches `Layout.tsx` only to delete an unrelated SVG filter block;
the `<aside>`, the popover, and the `.paper-doll` grid are untouched. `relative isolate` has been in
`ShufflePage.tsx` since `a05f040`, and `sticky top-0` has been on the aside since the same commit.
The bug is latent at `HEAD` and equally present in the working tree — the current ribbons/shapes
work neither caused nor worsened it.

## Recommended Fix

### Primary — one line, fixes both symptoms

`src/components/Layout.tsx:21`

```diff
-<aside className="border-ink/10 sticky top-0 hidden h-screen flex-col border-r px-6 py-8 md:flex">
+<aside className="border-ink/10 sticky top-0 z-30 hidden h-screen flex-col border-r px-6 py-8 md:flex">
```

The aside's stacking context now sits at `z-index: 30` in the root context, above the canvas's
`z-auto`. The popover's existing `z-20` then does its job *within* the aside, and paints — and
hit-tests — above the jacket rail. Save works; the overlap inverts to the intended direction.

`z-30` matches the tier the theme popover already uses (`ThemePicker.tsx:100`); the two are never
visible at once (aside is `hidden md:flex`, the theme button is mobile-only), so there is no
conflict. No visual risk: the aside occupies its own grid column and its only child that overflows
that column is the popover itself.

### Optional hardening — stop floating over the canvas at all

If you'd rather the popup never cover the jacket rail visually, drop the sidebar variant downward
inside the sidebar instead of rightward over the canvas (`OutfitActions.tsx:126-128`):

```diff
-  ? "top-0 left-full ml-4 w-72"
+  ? "top-full mt-3 w-full"
```

This removes the dependency on z-index ordering across columns entirely and still honors Decision 10
("the canvas never reflows") — it's absolutely positioned, so the sidebar doesn't reflow either.
It stays clickable over the quote block below it because `.quote-wash` is `position: relative;
isolation: isolate` at `z-auto` (`index.css:274-277`) and the popover's `z-20` outranks it inside
the aside. Trade-off: 224px wide instead of 288px.

The two fixes are independent; the first is the correctness fix and is sufficient on its own.

### Rejected: portal

`createPortal` to `document.body` would escape every stacking context permanently, but it needs a
ref, `getBoundingClientRect`, and scroll/resize repositioning. Not worth it for a one-class root cause.

## Adjacent gaps found (not the reported bug)

- **`write()` is unguarded.** `localStorageStore.ts:41-43` — `read()` degrades gracefully on any
  failure, but `write()` can throw (Safari private mode, quota) and `handleSave` doesn't catch it.
  The exception would propagate out of the click handler with the popover still open and no
  "Saved ✓". Not the current cause — but it presents identically, so it's worth a `try/catch` with
  visible feedback while you're in here.
- **No dismiss affordance.** The popover closes only via Cancel or a successful save — no Escape
  key, no click-outside.

## Code References

- `src/components/Layout.tsx:21` — **root cause**: `sticky top-0` with no z-index
- `src/components/OutfitActions.tsx:125-129` — the trapped `absolute z-20` popover and its
  `top-0 left-full ml-4 w-72` sidebar placement
- `src/components/OutfitActions.tsx:54-59` — `handleSave`, correct but unreachable by click
- `src/features/shuffle/ShufflePage.tsx:93` — `relative isolate` canvas stacking context, later in DOM
- `src/features/shuffle/ShufflePage.tsx:141-155` — the jacket rail, leftmost grid area
- `src/components/Rail.tsx:243-249, 291-298` — the `‹` / `›` arrow buttons that intercept clicks
- `src/components/Rail.tsx:23, 211-219, 254-259` — the frame window and its 40px swipe threshold,
  which turns an intercepted tap into a silent no-op
- `src/index.css:259-269` — desktop paper-doll grid placing jacket leftmost
- `src/features/theme/ThemePicker.tsx:100` — the working control case: `z-30` with no stacking-context ancestor
- `src/features/outfits/useOutfitsStore.ts:27-35` — save path (verified correct)
- `src/features/outfits/localStorageStore.ts:8-17, 41-58` — persistence + read-back filter (verified correct)
- `src/features/shuffle/outfit.ts:28-50` — `isOutfitShape`, accepts the saved shape (verified correct)

GitHub permalinks (line numbers at `1fcae0e`, which differs from the dirty working tree for
`Layout.tsx` and `ShufflePage.tsx`):

- [Layout.tsx#L35](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/components/Layout.tsx#L35) — the sticky aside
- [OutfitActions.tsx#L125-L129](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/components/OutfitActions.tsx#L125-L129) — the popover (unchanged in working tree)
- [ShufflePage.tsx#L111](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/features/shuffle/ShufflePage.tsx#L111) — the isolate wrapper

## Architecture Insights

- **The app has no z-index scale.** Values in use are ad hoc: `z-10` (card delete buttons),
  `z-20` (save popover), `z-30` (theme popover), `z-index: -1` (aura, quote wash). Nothing documents
  which layer floats above which, and nothing records that the sidebar is a stacking context. A
  three-tier convention — canvas / floating / overlay — plus a comment on the aside would prevent
  a recurrence.
- **`isolate` was added for a local reason with a non-local effect.** The comment at
  `ShufflePage.tsx:91-92` explains it correctly for its purpose (containing the `z-index: -1` aura),
  but creating that stacking context is also what lifted the whole canvas above the sidebar. The two
  halves of this bug were introduced for unrelated reasons and only interact at runtime.
- **Silent interception is the worst failure mode here.** Because the intercepting element is a
  swipe-gated frame rather than a button, the wrong-target click produces no feedback at all. Had it
  landed on the arrow every time, the jacket visibly changing would have pointed straight at the
  cause.
- The layered-storage architecture did its job: it took only a few minutes to *exonerate* the whole
  persistence stack, because `OutfitStore` has one implementation and one call site.

## Historical Context (from thoughts/)

- `thoughts/shared/decisions/2026-07-13-ui-redesign.md` — **Decision 10 (Save flow)**: chose
  "popover anchored to the Save button — in the sidebar on desktop, rising from the bottom action
  bar on mobile. The canvas never reflows," over a centered modal. The float-over-the-canvas
  behavior is intentional; being *under* the canvas is the bug. Both fixes above preserve the decision.
- Same doc, **Decision 4**: the persistent left sidebar (brand → nav → action block → quote footer)
  — the layout the popover has to escape.
- Same doc, **Decision 9**: `rounded-2xl` + hairline borders + soft shadows for surfaces including
  the popover — cosmetics only, no bearing here.
- No prior doc discusses z-index or stacking contexts anywhere in `thoughts/`.

## Related Research

- `thoughts/shared/research/2026-07-30-shuffle-carousel-animation-options.md` — the rail slide
  animation work that produced the current `Rail.tsx` frame/window structure

## Open Questions

- Should the app adopt an explicit z-index scale (Tailwind theme tokens) rather than continuing with
  ad hoc values? Small app, but this bug is exactly the class of failure a scale prevents.
- Is `w-72` still the right popover width if it moves inside the 17rem sidebar (→ 224px usable)?
</content>
</invoke>
