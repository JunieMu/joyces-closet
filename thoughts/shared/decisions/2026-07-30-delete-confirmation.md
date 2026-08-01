---
date: 2026-07-30
source: grill-to-decisions
input: Raw brief — replace the `window.confirm` that fires when deleting a saved outfit with an aesthetic in-app confirmation; brainstorm cute treatments (border/trim on the card, ombre, etc.)
status: decided
---

# Design Decisions: In-app delete confirmation

The OS `window.confirm` box is the last piece of unstyled browser chrome in the app, and it fires
at the one moment the user is about to lose something. It gets replaced with a confirmation the
card performs on itself.

## Decision 1: A confirmation, not an undo

**Context**: `src/features/outfits/OutfitsPage.tsx:31` guards deletion with `window.confirm`. The
alternative end behavior is no confirmation at all — delete instantly, offer an "undo" ribbon for a
few seconds.
**Options**: A — confirm before deleting (a deliberate beat, costs a click, but is a real surface to
decorate and is honest for the irreversible case) · B — delete + undo (frictionless, but the "cute
popup" evaporates, and undo for a *closet item* would mean re-writing an image blob and re-minting
an object URL — a real change to the one lifecycle in this codebase that leaks if mishandled).
**Decision**: **A.** One confirm component serves both delete sites, and the closet-item delete
genuinely warrants an "are you sure." Undo remains available as a future addition, not a
replacement.

## Decision 2: Both delete sites, not just outfits

**Context**: There are exactly two `window.confirm` calls in the app —
`src/features/outfits/OutfitsPage.tsx:31` (saved outfit) and
`src/features/closet/ClosetPage.tsx:29` (closet item). They are the same jarring break, but not the
same stakes: deleting a saved outfit drops a small localStorage record; deleting a closet item
destroys the image blob in IndexedDB and revokes its object URL, with no recovery.
**Decision**: Both. One visual language for "destroy something," both `window.confirm` calls gone
when this lands. The differing stakes show up in **copy** (Decision 4) and **size** (Decision 9),
not in two separate components.

## Decision 3: The card confirms itself — nothing floats, nothing is modal

**Context**: The candidate forms were an in-card transformation, a popover anchored to the `×`
(matching `OutfitActions.tsx:125` and `ThemePicker.tsx:100`), or a centered modal with a scrim.
**Options**: in-card (zero stacking risk, connects the question to *which* item, on-theme) ·
anchored popover (consistent with existing popovers, but it is exactly the shape that caused the
save-outfit stacking bug, and on the outfits grid every later sibling card would paint over it) ·
centered modal (unmissable, but the heaviest, and prior Decision 10 already rejected a centered
modal for the save flow).
**Decision**: **The card confirms itself.** The confirm layer is absolutely positioned `inset-0`
inside the card's own `relative` box — it never escapes the card, so no z-index negotiation with
sibling cards, the sticky sidebar, or the shuffle canvas is required. This is both the cutest
option and the structurally safest one, and it is the only one that keeps the item visible behind
the question.

## Decision 4: Charming frame, honest verb — and no name echo

**Context**: Current copy is `Delete "Tuesday's outfit"?`. App voice is lowercase and friendly
("nothing saved yet.", "your closet is waiting", "put an outfit together").
**Options**: A — wardrobe language with truthful verbs, differing per surface · B — uniform plain
"delete this?" everywhere.
**Decision**: **A.**

- **Outfit card**: question **"forget this outfit?"**, actions `keep` / `forget it`. Accurate — the
  record disappears, the clothes do not.
- **Closet tile**: question **"remove this from the closet?"**, actions `keep` / `remove`, plus a
  quiet second line when it applies: **"worn in 3 saved outfits"** (omitted at zero). Euphemism is
  avoided here specifically because this delete is irreversible.

**The item's name is deliberately NOT repeated in the question.** `window.confirm` had to quote it
because the dialog floats away from the card; in-card, the name is already directly below the
question, and re-quoting it wraps badly at closet-tile width. The trigger's existing `aria-label`
(`Delete ${name}`) continues to carry the name for screen readers.

## Decision 5: Accent only — and `keep` carries the visual weight

**Context**: `src/index.css:8` documents `--color-accent` as "the single ACTION color." There is no
danger/alarm token in any of the five themes.
**Options**: use `--color-accent` · add a per-theme `--color-alarm` across all five themes (the way
Decision 6 of the ribbons pass added `accent-2`/`accent-3`) · use the card's own assigned tint.
**Decision**: **`--color-accent`, no new token.** The tone we chose is "put it away," not "danger,"
and a red that harmonizes with Sea Glass *and* Marmalade *and* Lavender is five new palette fights
for one small surface. The card's own scrapbook tint is not used — it reads decorative, and this
moment is an action.

**Consequence, and it is binding**: because both buttons are then accent-family, the destructive one
must not be the loud one. **`keep` is the filled accent pill and holds initial focus; `forget it` /
`remove` is quiet ghost text (`ink/55`, going accent on hover).** This is the inverse of the usual
primary/secondary reflex, on purpose — the safe choice is where both the eye and the Enter key
land.

## Decision 6: Behavior while a card is confirming

**Context**: The outfit card's entire surface is a "wear this outfit" button
(`OutfitCard.tsx:139-144`) whose click loads the outfit and navigates to `/`.
**Decision**: All of the following:

- **The card's load-on-click is suppressed** while confirming. Without this, a near-miss click
  navigates the user off the page instead of answering the question.
- **Escape closes** the confirm.
- **Click-outside closes** the confirm.
- **Only one card confirms at a time** — opening a second closes the first.

## Decision 7: A minimal exit animation on confirm

**Options**: A — the card fades and scales to ~0.96 over ~200ms, then the delete fires · B — delete
immediately and let the grid reflow.
**Decision**: **A.** This is the single moment that most sells "designed app, not browser dialog,"
and it costs one local `leaving` flag plus an `onAnimationEnd` handler. No reduced-motion
special-casing is needed: the global clamp at `src/index.css:229-236` collapses animation durations
to `0.01ms` rather than removing the animation, so `onAnimationEnd` still fires and the delete still
happens.

## Decision 8: Visual anatomy — the card blushes, and gets basted

**Decision**: The confirm layer is `absolute inset-0 rounded-2xl` inside the card, composed of:

- **The wash.** The *same* top-down gradient the card already wears (`.card-wash::before`,
  `src/index.css:320-332`) — deepened, flooding the full card height instead of the top `2.75rem`,
  and in `--color-accent` instead of the card's assigned tint. It should read as the card's own wash
  intensifying, not as a foreign panel dropped on top.
- **The ghosted item.** The preview stays visible at roughly 20–25% opacity behind a soft
  `bg-paper/75` veil, so the user can see *which* item they are about to lose. This is the thing a
  centered modal structurally cannot do.
- **The basting stitch.** An inset rounded-rect SVG path stroked in accent using the *exact* dash
  rhythm and cap of `RunningStitch.tsx:24` — `strokeDasharray="7 6"`, `strokeLinecap="round"` — so
  it reads as the same needle that stitches the closet section headers. Like the card has been
  basted for taking apart.
  **Not** a CSS `border-dashed`: that is a machine dash with square ends and a different rhythm, and
  it would not match the stitch already in the app. The SVG is ~10 lines, resolution-independent,
  and theme-aware via `currentColor`.
- **The question** in `font-display` (the serif — the app's voice for headings), with the
  `keep` / `forget it` pair below it.
- **One flourish**: a small stripe `<Ribbon>` (~64px wide, the outfits page's own variant) tucked
  under the question, tying the confirm into the ribbon family. Text is **not** set on top of a
  woven ribbon — legibility at that size was considered and rejected.

Exact opacity/stop values are implementation-time choices under one constraint: **the ghosted item
must stay recognizable, and the question must clear text-contrast at 12–14px over the wash.**

## Decision 9: A `compact` variant for closet tiles

**Context**: Closet tiles are small — `grid-cols-3` on mobile up to `lg:grid-cols-6`
(`ClosetPage.tsx:233`), roughly 110–160px wide. The full question, two buttons, and the "worn in N
saved outfits" note do not fit.
**Options**: A — one component with an explicit `compact` variant · B — let the closet tile float a
popover instead (reintroduces the stacking hazard on the surface with the most siblings).
**Decision**: **A, driven by an explicit prop — not a container query.** Compact drops the ribbon
flourish, shortens the question to **"remove?"**, keeps the note as a tiny `worn in 3 outfits` line
(omitted at zero), and sets the two buttons side by side as small pills. Same wash, same stitch,
just less of it. The two sizes are known and named; auto-adapting magic would be harder to reason
about than a boolean.

## Decision 10: State placement and component shape

**Decision**:

- **Which card is confirming**: a single **`confirmingId: string | null` held in the page
  component** — `OutfitsPage` and `ClosetPage` both already map over their items. Plain React, no
  new store, no context, and the one-at-a-time rule from Decision 6 falls out for free.
- **The exit animation**: a **card-local `leaving` flag** → `onAnimationEnd` → fire the delete.
  Nothing else needs to know.
- **Dismissal**: a small **`useDismiss(ref, onDismiss)` hook in `src/components/`** covering Escape
  and click-outside. There is precedent for a hook living there (`src/components/useCascade.ts`),
  and isolating it is what makes retrofitting the save popover cheap later.
- **The component**: a presentational **`src/components/ConfirmDelete.tsx`** taking `question`,
  `note`, `confirmLabel`, `onConfirm`, `onCancel`, `compact`. It renders the wash, the stitch, the
  ribbon, and the buttons, and knows nothing about outfits or closet items.
- **No store changes.** `useOutfitsStore.deleteOutfit` and `useClosetStore.removeUpload` are called
  exactly as they are today; the persist-then-update ordering is untouched.

## Decision 11: Accessibility

**Context**: This replaces a native dialog that screen readers announced for free.
**Decision**: The confirm layer is **`role="alertdialog"` labelled by the question's id**. Focus
moves to `keep` when it opens and returns to the `×` trigger on cancel. **No focus trap** — the
panel is not modal, and Escape plus click-outside are already the exits; trapping focus in a
non-modal in-card panel causes more problems than it solves.

## Codebase Findings

- **The two delete sites**: `src/features/outfits/OutfitsPage.tsx:30-32` (`handleDelete`, passed to
  `OutfitCard` as `onDelete`) and `src/features/closet/ClosetPage.tsx:28-30` (`handleDelete` inside
  `Tile`). These are the only `window.confirm` / `alert` calls in `src/`.
- **The triggers** are already styled and can stay as they are:
  `OutfitCard.tsx:130-137` and `ClosetPage.tsx:36-43` — ghost `×` buttons, hidden until hover on
  mouse-driven desktops, always visible on touch.
- **The card's full-surface load button**: `OutfitCard.tsx:139-144` — this is what Decision 6
  suppresses.
- **Nothing clips.** No `overflow-hidden` exists on the outfit cards, the closet tiles, or either
  grid, so an `inset-0` layer inside a card renders unclipped.
- **Cards are `relative` with no z-index** (`OutfitCard.tsx:126`, `ClosetPage.tsx:33`) — which is
  precisely why a *floating* popover would have painted under later sibling cards, and why
  Decision 3 stays inside the card box.
- **The stacking bug is already fixed**: `src/components/Layout.tsx:25` carries `z-30` on the sticky
  aside, with an explanatory comment. Nothing in this work depends on or disturbs it.
- **Reusable pieces**: `.card-wash::before` gradient (`src/index.css:320-332`), `RunningStitch`
  dash rhythm (`src/components/RunningStitch.tsx:18-25`), `Ribbon` variants
  (`src/components/Ribbon.tsx:50-57` — outfits page uses `stripe`, closet uses `gingham`),
  `--animate-pop-in` (`src/index.css:49, 99-108`), the reduced-motion clamp
  (`src/index.css:229-236`).
- **The one new testable unit**: counting saved outfits that reference a closet item (Decision 4's
  note line) wants a pure `outfitUsesItem(outfit, id)` helper in
  `src/features/shuffle/outfit.ts`, alongside `isOutfitValid` (`outfit.ts:57-76`). It is pure, takes
  no DOM, and fits the node-env vitest setup exactly. The count itself reads from
  `useOutfitsStore`'s `saved` array — no store change needed.
- **Existing popovers have no dismiss affordance** — neither `OutfitActions.tsx:123-164` nor
  `ThemePicker.tsx:100` handles Escape or click-outside. Noted as prior art for the `useDismiss`
  hook, not as work to do here.

## Out of Scope

- **Undo / soft-delete of any kind.** Considered and deferred in Decision 1.
- **Retrofitting Escape + click-outside onto the save-outfit and theme popovers.** The `useDismiss`
  hook should be written so this is cheap later, but the retrofit itself is not this pass.
- **A `--color-alarm` / danger token in the five themes.** Rejected in Decision 5.
- **Any other detailing on outfit cards or closet tiles.** The ribbons-and-shapes pass
  (`thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md`) explicitly deferred
  card detailing; this confirm layer is the one exception, and it is not license to decorate the
  resting state of the card.
- **The `write()` error-handling gap** in `localStorageStore.ts:41-43` flagged by the save-popover
  research doc. Real, adjacent, not this.
- **An app-wide z-index scale.** Left open by the stacking research doc; Decision 3 sidesteps the
  need for it here.

## Deliberately Left to `/create_plan`

- Exact gradient stops, opacity values, blur, and stitch inset — constrained by Decision 8 but not
  pinned.
- Whether the `×` trigger toggles the confirm closed or only opens it.
- Whether the card's hover lift (`hover:-translate-y-0.5 hover:shadow-painterly`,
  `OutfitCard.tsx:126`) is suppressed while confirming.
- Precise compact-variant breakpoint behavior at the narrowest closet-tile width.
