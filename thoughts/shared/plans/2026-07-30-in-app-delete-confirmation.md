# In-app Delete Confirmation Implementation Plan

## Overview

Replace both `window.confirm` calls with a confirmation the card performs on itself: an
`absolute inset-0` layer inside the card that washes it in the accent color, ghosts the item
behind a paper veil, bastes it with a running stitch, and asks a question in the app's own voice.
Nothing floats, nothing is modal, and no z-index negotiation is required.

Source of truth for the design: `thoughts/shared/decisions/2026-07-30-delete-confirmation.md`.

## Current State Analysis

Two sites guard deletion with the OS dialog, and they are the only `window.confirm` / `alert`
calls in `src/`:

- `src/features/outfits/OutfitsPage.tsx:30-32` — `handleDelete`, passed to `OutfitCard` as
  `onDelete`. Drops a localStorage record.
- `src/features/closet/ClosetPage.tsx:28-30` — `handleDelete` inside `Tile`. Destroys an
  IndexedDB blob and revokes its object URL. Irreversible.

Both triggers are already-styled ghost `×` buttons (`OutfitCard.tsx:130-137`,
`ClosetPage.tsx:36-43`) carrying `z-10`, hidden until hover on mouse-driven desktops and always
visible on touch.

Constraints confirmed by reading the code:

- **Nothing clips.** No `overflow-hidden` on the outfit cards, the closet tiles, or either grid,
  so an `inset-0` layer inside a card renders unclipped.
- **Cards are `relative` with no z-index** (`OutfitCard.tsx:126`, `ClosetPage.tsx:33`). The `×`
  carries `z-10`, so a confirm layer with auto z-index paints *below* the `×` — the trigger stays
  visible and clickable while confirming, which is what forces the toggle behavior below.
- `.card-wash::before` (`index.css:320-332`) is a `::before`, i.e. the card's first child, so a
  later-sibling confirm layer paints above it without any stacking work.
- The outfit card's entire surface is a "wear this" button (`OutfitCard.tsx:139-144`).
- `--animate-pop-in` (`index.css:49, 99-108`) and the reduced-motion clamp
  (`index.css:229-236`) both exist as the decisions doc describes.

### Key Discoveries

- **The dismiss listener must be `pointerdown`, not `click`.** React dispatches its synthetic
  click at the root container, which sits *below* `document`. With a document-level `click`
  listener, opening card B while card A is confirming would run `setConfirmingId(B)` first and
  the outside-click handler second, nulling it — card B would never open. `pointerdown` fires
  before both, so the sequence comes out closed-then-opened. It also means the interaction that
  *opened* the panel cannot dismiss it, because the listener does not exist yet when that
  `pointerdown` fires.
- **`onAnimationEnd` bubbles.** The card's exit handler will also receive `animationend` from the
  confirm layer's own `animate-pop-in`. Without an `event.target === event.currentTarget` guard,
  the delete fires the instant the confirmation *opens*.
- **Dismissal must be disabled once `leaving` is true.** Otherwise a stray click during the 200ms
  exit unmounts the confirm layer out from under an animation that is about to fire the delete.
- **The basting stitch needs `vector-effect="non-scaling-stroke"`.** A rounded rect must stretch
  to a card of unknown aspect, and `preserveAspectRatio="none"` would stretch the dashes with it —
  exactly what Decision 8 forbids. `non-scaling-stroke` performs stroking in screen space, so
  `strokeWidth="1.6"` and `strokeDasharray="7 6"` land as those values in CSS pixels at any card
  size. That matches `RunningStitch` on screen, whose 1200×8 viewBox at `h-2` makes one user unit
  ≈ one CSS pixel. Only the corner radius goes slightly elliptical, which is invisible at this
  size.
- **`.confirm-wash` must set `background-image`, not the `background` shorthand** — the shorthand
  would blow away the `bg-paper/70` veil the layer sets alongside it.
- **`outfitUsesItem` is the only new testable unit.** Vitest runs `environment: "node"` and picks
  up `src/**/*.test.ts` only; there is no DOM or component testing by design. `outfit.test.ts`
  does not exist yet.

## Desired End State

- Neither `window.confirm` nor `alert` appears anywhere in `src/`.
- Clicking `×` on a saved outfit card washes that card in accent, ghosts the preview, bastes the
  edge, and asks **"forget this outfit?"** with `keep` / `forget it`.
- Clicking `×` on a closet tile does the same in compact form: **"remove?"** with `keep` /
  `remove`, plus `worn in N outfits` when N > 0.
- `keep` is the filled accent pill and holds focus; the destructive verb is quiet ghost text.
- Confirming fades and scales the card to 0.96 over 200ms, then deletes.
- Escape, click-outside, and a second click on `×` all cancel. Only one card confirms at a time.
- The card's load-on-click and hover lift are both suppressed while confirming.

Verified by `npm test`, `npm run typecheck`, `npm run lint`, plus the manual steps in each phase.

## What We're NOT Doing

Carried straight from the decisions doc's Out of Scope, plus one addition:

- Undo / soft-delete of any kind.
- Retrofitting Escape + click-outside onto the save-outfit (`OutfitActions.tsx:123-164`) and theme
  (`ThemePicker.tsx:100`) popovers. `useDismiss` is written so this is cheap later; the retrofit
  is not this pass.
- A `--color-alarm` / danger token in the five themes.
- Any other detailing on outfit cards or closet tiles.
- The `write()` error-handling gap in `localStorageStore.ts:41-43`.
- An app-wide z-index scale.
- **No component or DOM tests.** The vitest setup is node-env and domain-logic-only by design;
  adding jsdom for this would be a larger architectural change than the feature. Everything but
  `outfitUsesItem` is verified manually.

## Implementation Approach

Three phases, each independently verifiable. Foundations first (they are pure and testable), then
the component wired to the roomier outfits surface so the visuals can be judged, then the compact
variant squeezed into the 110px closet tile.

The one-at-a-time rule and the exit animation are split deliberately: **which** card is confirming
is page state (`confirmingId`), **whether** a card is leaving is card-local (`leaving`). Nothing
else needs to know either.

---

## Phase 1: Foundations

### Overview

The three pieces the component depends on, none of which touch the UI: the dismissal hook, the
pure usage helper plus its test, and two CSS additions.

### Changes Required

#### 1. The dismissal hook

**File**: `src/components/useDismiss.ts` (new)
**Changes**: Escape + click-outside, disabled by passing `null`.

```ts
import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Escape + click-outside for a transient panel. Passing `null` attaches nothing — that is what
 * lets a card keep its confirmation mounted through the exit animation without a stray click
 * cancelling a delete that is already in flight.
 *
 * The pointer listener is `pointerdown`, deliberately, not `click`. React dispatches its
 * synthetic click at the root container, which is BELOW document, so a document-level click
 * listener runs AFTER the handler that opened the next panel and would immediately close it
 * again — a second card could never take over from the first. `pointerdown` runs before both,
 * so the handover comes out closed-then-opened. It also means the interaction that opened a
 * panel cannot dismiss it, since this listener does not exist yet when that pointerdown fires.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: (() => void) | null,
): void {
  useEffect(() => {
    if (onDismiss === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) return;
      onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, onDismiss]);
}
```

Callers pass an inline closure, so the effect re-attaches on every render of the confirming card.
That is two `addEventListener` calls on one element and is not worth memoizing; listeners are only
ever attached while a panel is open.

#### 2. The usage helper

**File**: `src/features/shuffle/outfit.ts`
**Changes**: add `outfitUsesItem`, exported alongside `isOutfitValid`.

```ts
/**
 * Whether an outfit wears a particular closet item. Deleting from the closet is the one
 * irreversible action in the app, so the confirmation says how many saved outfits it will
 * leave with a hole in them (2026-07-30 Decision 4).
 */
export function outfitUsesItem(outfit: Outfit, id: string): boolean {
  const baseUses =
    outfit.base.kind === "separates"
      ? outfit.base.topId === id || outfit.base.bottomId === id
      : outfit.base.dressId === id;

  return (
    baseUses ||
    outfit.shoesId === id ||
    outfit.jacketId === id ||
    outfit.accessoryId === id
  );
}
```

#### 3. Its test

**File**: `src/features/shuffle/outfit.test.ts` (new)
**Changes**: cover both base kinds, both optional slots, the required slot, and a miss.

```ts
import { describe, expect, it } from "vitest";

import type { Outfit } from "./outfit";
import { outfitUsesItem } from "./outfit";

const separates: Outfit = {
  base: { kind: "separates", topId: "top-1", bottomId: "bottom-1" },
  jacketId: "jacket-1",
  shoesId: "shoes-1",
  accessoryId: null,
};

const dressed: Outfit = {
  base: { kind: "dress", dressId: "dress-1" },
  jacketId: null,
  shoesId: "shoes-1",
  accessoryId: "accessory-1",
};

describe("outfitUsesItem", () => {
  it("finds both halves of a separates base", () => {
    expect(outfitUsesItem(separates, "top-1")).toBe(true);
    expect(outfitUsesItem(separates, "bottom-1")).toBe(true);
  });

  it("finds a dress base", () => {
    expect(outfitUsesItem(dressed, "dress-1")).toBe(true);
  });

  it("finds the required and optional slots", () => {
    expect(outfitUsesItem(separates, "shoes-1")).toBe(true);
    expect(outfitUsesItem(separates, "jacket-1")).toBe(true);
    expect(outfitUsesItem(dressed, "accessory-1")).toBe(true);
  });

  it("is false for an item the outfit does not wear", () => {
    expect(outfitUsesItem(separates, "dress-1")).toBe(false);
    expect(outfitUsesItem(dressed, "top-1")).toBe(false);
  });

  it("does not match an empty optional slot", () => {
    expect(outfitUsesItem(separates, "accessory-1")).toBe(false);
    expect(outfitUsesItem(dressed, "jacket-1")).toBe(false);
  });
});
```

That last case is the one worth having: `accessoryId` is `null`, and a naive implementation
comparing against a nullable id would still be correct here, but the test pins it.

#### 4. The exit animation token

**File**: `src/index.css`
**Changes**: add inside the existing `@theme` block, after `--animate-pop-in` (line 49), and the
keyframes after `pop-in` (line 108).

```css
  /* A card being taken apart (2026-07-30 Decision 7): a confirmed delete plays out on the card
     itself before the grid reflows. The reduced-motion clamp at the bottom of this file
     collapses this to 0.01ms rather than removing it, so animationend still fires and the
     delete still happens. */
  --animate-card-leave: card-leave 0.2s ease-in both;
```

```css
  @keyframes card-leave {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.96);
    }
  }
```

#### 5. The confirm wash

**File**: `src/index.css`
**Changes**: add immediately after the `.card-wash::before` rule (line 332), where the card
gradients live.

```css
/* The delete confirmation's wash (2026-07-30 Decision 8): the card's own top-down gradient
   deepened, flooding the full height instead of the top 2.75rem, and in the action color rather
   than the card's decorative tint — this moment is an action, not decoration. It should read as
   the card's own wash intensifying, not as a foreign panel dropped on top.

   `background-image` rather than the `background` shorthand on purpose: the shorthand would
   reset the bg-paper/70 veil the layer sets alongside it, and the veil is what keeps the ghosted
   item at the ~20-25% the decision calls for. */
.confirm-wash {
  background-image: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--color-accent) 30%, transparent),
    color-mix(in srgb, var(--color-accent) 14%, transparent) 60%,
    color-mix(in srgb, var(--color-accent) 8%, transparent)
  );
}
```

The 30%/8% pair against a `bg-paper/70` veil leaves the item at roughly 21% at the card's top edge
and 27% at the bottom — inside Decision 8's 20–25% band, biased slightly light at the bottom where
the buttons are not.

### Success Criteria

#### Automated Verification

- [x] Tests pass, including the new file: `npm test`
- [x] The new test file specifically: `npx vitest run src/features/shuffle/outfit.test.ts`
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`

#### Manual Verification

- [ ] Nothing visible changed — no component consumes any of this yet. `npm run dev` still boots
      and the app renders as before.

---

## Phase 2: `ConfirmDelete` and the outfit card

### Overview

Build the presentational component and wire it through `OutfitsPage` → `OutfitCard`, removing the
first `window.confirm`. This is the surface where the full-size visuals get judged.

### Changes Required

#### 1. The component

**File**: `src/components/ConfirmDelete.tsx` (new)
**Changes**: the whole thing. It knows nothing about outfits or closet items — it takes copy and
two callbacks. The dismissal hook is *not* called here: the region that counts as "inside" is the
whole card, not this layer, which is what lets the `×` toggle without fighting the outside-click
handler.

```tsx
import { useId } from "react";

import { Ribbon } from "./Ribbon";

interface ConfirmDeleteProps {
  question: string;
  /** A quiet second line — omitted entirely when there is nothing to say. */
  note?: string;
  /** The honest verb, never a euphemism: "forget it" / "remove". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Closet-tile sizing (Decision 9): explicit, not a container query. */
  compact?: boolean;
}

/**
 * The basting stitch (Decision 8): the card looks basted for taking apart. Same needle as the
 * closet section headers — RunningStitch.tsx:24's exact `7 6` rhythm and round cap — rather than
 * a CSS `border-dashed`, which is a machine dash with square ends and a different rhythm.
 *
 * The rect has to stretch to a card of unknown aspect, and `preserveAspectRatio="none"` would
 * ordinarily stretch the dashes with it. `vector-effect="non-scaling-stroke"` moves stroking into
 * screen space, so the 1.6 width and the 7/6 rhythm stay in CSS pixels at any card size — the
 * same on-screen values RunningStitch produces at its natural scale, where its 1200x8 viewBox at
 * h-2 makes one user unit about one pixel. Only the corner radius goes slightly elliptical, which
 * is invisible at this size and reads as hand-sewn anyway.
 */
function BastingStitch({ compact }: { compact: boolean }) {
  const inset = compact ? 4 : 2.5;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="text-accent/45 pointer-events-none absolute inset-0 h-full w-full"
    >
      <rect
        x={inset}
        y={inset}
        width={100 - inset * 2}
        height={100 - inset * 2}
        rx="4"
        ry="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="7 6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The card confirming itself (2026-07-30 Decision 3). Absolutely positioned inside the card's own
 * relative box, so it never escapes it: no z-index negotiation with sibling cards, the sticky
 * sidebar, or the shuffle canvas, and the item stays visible behind the question — the one thing
 * a centered modal structurally cannot do.
 *
 * Not modal and deliberately not focus-trapped (Decision 11): Escape and click-outside are the
 * exits, and trapping focus in a non-modal in-card panel causes more problems than it solves.
 */
export function ConfirmDelete({
  question,
  note,
  confirmLabel,
  onConfirm,
  onCancel,
  compact = false,
}: ConfirmDeleteProps) {
  const questionId = useId();
  const noteId = useId();

  return (
    <div
      role="alertdialog"
      aria-labelledby={questionId}
      aria-describedby={note ? noteId : undefined}
      className={`confirm-wash bg-paper/70 animate-pop-in absolute inset-0 flex flex-col items-center justify-center rounded-2xl text-center backdrop-blur-[2px] ${
        compact ? "gap-1 px-1" : "gap-2 px-3"
      }`}
    >
      <BastingStitch compact={compact} />

      {/* No name echo (Decision 4): window.confirm had to quote the item because the dialog
          floated away from the card. In-card the name is already directly below, and re-quoting
          it wraps badly at closet-tile width. The trigger's aria-label still carries it. */}
      <p
        id={questionId}
        className={`font-display text-ink ${compact ? "text-xs" : "text-sm"}`}
      >
        {question}
      </p>

      {/* One flourish, and the text is beside it rather than on it — legibility over a woven
          band at this size was considered and rejected (Decision 8). */}
      {!compact && <Ribbon variant="stripe" className="h-2.5 w-16" />}

      {note && (
        <p
          id={noteId}
          className={`font-body text-ink/55 ${compact ? "text-[10px]" : "text-xs"}`}
        >
          {note}
        </p>
      )}

      {/* `keep` is the filled pill and holds initial focus; the destructive verb is quiet ghost
          text. This inverts the usual primary/secondary reflex on purpose (Decision 5): with no
          alarm token in any theme both buttons are accent-family, so the safe choice is where
          both the eye and the Enter key land.

          flex-wrap is the safety valve at the narrowest closet-tile width (~110px on a phone at
          grid-cols-3), where two pills side by side are just about the limit. */}
      <div
        className={`flex flex-wrap items-center justify-center ${compact ? "gap-1" : "gap-2"}`}
      >
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className={`btn-painterly bg-accent text-paper font-body hover:bg-accent/90 cursor-pointer rounded-full font-medium shadow-sm transition active:scale-[0.98] ${
            compact ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-sm"
          }`}
        >
          keep
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`font-body text-ink/55 hover:text-accent cursor-pointer rounded-full transition ${
            compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-sm"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
```

`autoFocus` mirrors the existing pattern at `OutfitActions.tsx:143`.

#### 2. The outfit card

**File**: `src/features/outfits/OutfitCard.tsx`
**Changes**: new props, a card ref, the `leaving` flag, the guarded animation-end handler, and the
layer.

Imports to add:

```tsx
import { useRef, useState } from "react";

import { ConfirmDelete } from "../../components/ConfirmDelete";
import { useDismiss } from "../../components/useDismiss";
```

Props:

```tsx
interface OutfitCardProps {
  saved: SavedOutfit;
  /** Page state (Decision 10) — one id at a time, so opening a second closes the first. */
  confirming: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
}
```

Body, replacing the current `OutfitCard` internals:

```tsx
export function OutfitCard({
  saved,
  confirming,
  onLoad,
  onDelete,
  onRequestConfirm,
  onCancelConfirm,
}: OutfitCardProps) {
  const closet = useCloset();
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);

  const complete = isOutfitValid(saved.outfit, closet);
  const created = new Date(saved.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const cancel = () => {
    onCancelConfirm();
    triggerRef.current?.focus();
  };

  // The dismissal region is the whole CARD, not the confirm layer: the × sits above the layer
  // (it carries z-10, the layer does not), so if it were "outside" then clicking it would close
  // via this hook and immediately reopen via its own handler. Inside the card, the × is simply
  // a toggle and the two never fight.
  //
  // Switched off once `leaving` is true — a stray click during the 200ms exit must not unmount
  // the layer out from under an animation that is about to fire the delete.
  useDismiss(cardRef, confirming && !leaving ? cancel : null);

  // animationend BUBBLES: without the target guard, the confirm layer's own pop-in would fire
  // the delete the instant the confirmation opens.
  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (leaving) onDelete();
  };

  return (
    <div
      ref={cardRef}
      onAnimationEnd={handleAnimationEnd}
      className={`group border-ink/10 paper-card card-wash ${washClass(saved.id)} relative rounded-2xl border bg-white p-3 shadow-sm transition ${
        leaving ? "animate-card-leave" : ""
      } ${confirming ? "" : "hover:-translate-y-0.5 hover:shadow-painterly"}`}
    >
      {/* Ghost delete. Hidden until hover/focus on a mouse-driven desktop; on any touch screen
          (including a tablet past the md breakpoint) it stays visible — there is no hover there.
          While confirming it becomes the close button: it is painted above the layer, so leaving
          it inert would read as broken. `md:focus:` joins `md:focus-visible:` because cancelling
          with the mouse returns focus here programmatically, which does not match focus-visible. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={confirming ? cancel : onRequestConfirm}
        aria-label={`Delete ${saved.name}`}
        aria-expanded={confirming}
        className="text-ink/35 hover:bg-wash/60 hover:text-accent absolute top-2 right-2 z-10 h-7 w-7 cursor-pointer rounded-full text-lg leading-none transition md:pointer-fine:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100"
      >
        ×
      </button>

      {/* Disabled while confirming (Decision 6): the layer already blocks the pointer, but a
          near-miss Enter on a tabbed-to card would otherwise navigate away from the question. */}
      <button
        type="button"
        onClick={onLoad}
        disabled={confirming}
        className="block w-full cursor-pointer text-left"
        aria-label={`Wear ${saved.name}`}
      >
        <Preview saved={saved} />

        <p className="font-body text-ink mt-2 truncate text-sm font-medium">
          {saved.name}
        </p>
        <p className="font-body text-ink/45 text-xs">{created}</p>
        {!complete && (
          <p className="font-body text-accent/70 mt-1 text-xs italic">
            Some items are no longer in the closet
          </p>
        )}
      </button>

      {confirming && (
        <ConfirmDelete
          question="forget this outfit?"
          confirmLabel="forget it"
          onConfirm={() => setLeaving(true)}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
```

The copy is accurate on purpose: the record disappears, the clothes do not.

#### 3. The outfits page

**File**: `src/features/outfits/OutfitsPage.tsx`
**Changes**: hold `confirmingId`, drop `window.confirm`.

```tsx
import { useState } from "react";
```

```tsx
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // The confirmation now lives on the card (2026-07-30 Decision 3), so this just deletes.
  const handleDelete = (outfit: SavedOutfit) => {
    deleteOutfit(outfit.id);
    setConfirmingId(null);
  };
```

```tsx
            <OutfitCard
              key={outfit.id}
              saved={outfit}
              confirming={confirmingId === outfit.id}
              onLoad={() => handleLoad(outfit)}
              onDelete={() => handleDelete(outfit)}
              onRequestConfirm={() => setConfirmingId(outfit.id)}
              onCancelConfirm={() => setConfirmingId(null)}
            />
```

One id means the one-at-a-time rule falls out for free. The handover across cards works because
`useDismiss` listens on `pointerdown`: card A's dismissal nulls the id, *then* card B's click sets
it to B.

### Success Criteria

#### Automated Verification

- [x] Tests pass: `npm test`
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`
- [x] Build succeeds: `npm run build`
- [x] No `window.confirm` remains in `src/features/outfits/`:
      `grep -rn "window.confirm" src/features/outfits/` returns nothing

#### Manual Verification

Save two or three outfits first, then on `/outfits`:

- [ ] Clicking `×` washes the card in accent with the basting stitch around the edge; the outfit
      preview is still recognizable behind the veil.
- [ ] The question reads in the serif; the small stripe ribbon sits under it; `keep` is a filled
      accent pill and `forget it` is quiet text that goes accent on hover.
- [ ] The stitch dashes look like the same needle as the closet page's section-header hairline —
      compare side by side, and on both a narrow and a wide browser window.
- [ ] `keep` has focus on open: pressing Enter immediately cancels.
- [ ] Escape cancels. Clicking anywhere outside the card cancels. Clicking `×` again cancels.
- [ ] Clicking the card body while confirming does **not** navigate to the shuffle page.
- [ ] The card does not lift on hover while confirming.
- [ ] Opening `×` on a second card closes the first — including when clicking straight from one
      card's `×` to another's.
- [ ] `forget it` fades and shrinks the card, *then* it disappears from the grid.
- [ ] Tabbing through the grid while a card is confirming skips that card's body button.
- [ ] All five themes: run through the theme picker with a card confirming. The question stays
      legible over the wash in every one, and the accent never fights the paper.
- [ ] With OS reduced-motion enabled, `forget it` still deletes (instantly, no fade).
- [ ] VoiceOver announces the confirmation when it opens.
- [ ] On a touch screen or a device-emulated phone: the `×` is visible without hover, and the
      confirmation is comfortable at `grid-cols-2`.

**Implementation Note**: pause here for manual confirmation before Phase 3 — the compact variant
inherits every visual decision made above, so it is worth having them settled first.

---

## Phase 3: Compact variant and the closet tile

### Overview

Wire the same component into `ClosetPage` → `Tile` in compact form, with the "worn in N outfits"
note, removing the second `window.confirm`.

### Changes Required

#### 1. The closet tile

**File**: `src/features/closet/ClosetPage.tsx`
**Changes**: `Tile` mirrors `OutfitCard`'s structure. `removeUpload` moves up to `ClosetPage` so
that page owns deletion the way `OutfitsPage` does; `renameUpload` stays.

Imports to add:

```tsx
import { ConfirmDelete } from "../../components/ConfirmDelete";
import { useDismiss } from "../../components/useDismiss";
import { outfitUsesItem } from "../shuffle/outfit";
import { useOutfitsStore } from "../outfits/useOutfitsStore";
```

`Tile`:

```tsx
interface TileProps {
  item: ClosetItem;
  confirming: boolean;
  onDelete: () => void;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
}

/** Every item in the closet was uploaded, so every tile is renameable and deletable. */
function Tile({
  item,
  confirming,
  onDelete,
  onRequestConfirm,
  onCancelConfirm,
}: TileProps) {
  const renameUpload = useClosetStore((state) => state.renameUpload);
  const saved = useOutfitsStore((state) => state.saved);
  const tileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(item.name);
  const [leaving, setLeaving] = useState(false);

  // This delete is irreversible — the blob goes and the object URL is revoked — so the
  // confirmation says what it will cost (Decision 4). Subscribing every tile to `saved` is free
  // in practice: an outfit cannot be saved from this page, so the list never changes under it.
  const wornIn = saved.filter((entry) =>
    outfitUsesItem(entry.outfit, item.id),
  ).length;

  const cancel = () => {
    onCancelConfirm();
    triggerRef.current?.focus();
  };

  // Same reasoning as OutfitCard: the region is the whole tile so the × can toggle, and
  // dismissal switches off once the delete is committed.
  useDismiss(tileRef, confirming && !leaving ? cancel : null);

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (leaving) onDelete();
  };

  return (
    <div
      ref={tileRef}
      onAnimationEnd={handleAnimationEnd}
      className={`group border-ink/10 paper-card relative flex flex-col rounded-2xl border bg-white p-2 shadow-sm transition ${
        leaving ? "animate-card-leave" : ""
      }`}
    >
      {/* ... × button unchanged except for these three lines ... */}
      <button
        ref={triggerRef}
        type="button"
        onClick={confirming ? cancel : onRequestConfirm}
        aria-label={`Delete ${item.name}`}
        aria-expanded={confirming}
        className="text-ink/35 hover:bg-wash/60 hover:text-accent absolute top-1 right-1 z-10 h-6 w-6 cursor-pointer rounded-full text-base leading-none transition md:pointer-fine:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100"
      >
        ×
      </button>

      {/* ... image frame unchanged ... */}

      {/* The rename field keeps its own Escape handler, so it is pulled out of the tab order
          while confirming rather than disabled: the two Escapes must never both be live, and a
          disabled input would grey out visibly through the ghosted tile. */}
      <input
        /* ...existing props... */
        tabIndex={confirming ? -1 : undefined}
      />

      {confirming && (
        <ConfirmDelete
          compact
          question="remove?"
          note={
            wornIn > 0
              ? `worn in ${wornIn} ${wornIn === 1 ? "outfit" : "outfits"}`
              : undefined
          }
          confirmLabel="remove"
          onConfirm={() => setLeaving(true)}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
```

The question is the short form throughout: tiles run roughly 110px on a phone at `grid-cols-3` up
to ~160px at `lg:grid-cols-6`, and "remove this from the closet?" wraps to three lines even at the
wide end. The full-length wording stays in the decisions doc for any roomier surface that wants it.

#### 2. The closet page

**File**: `src/features/closet/ClosetPage.tsx`
**Changes**: `ClosetPage` holds `confirmingId` and owns the deletion, mirroring `OutfitsPage`.

```tsx
export function ClosetPage() {
  const closet = useCloset();
  const removeUpload = useClosetStore((state) => state.removeUpload);
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const total = Object.values(closet).flat().length;

  // Fire-and-forget as before: the store persists first, then mirrors, so a rejected delete
  // leaves the closet untouched.
  const handleDelete = (id: string) => {
    void removeUpload(id);
    setConfirmingId(null);
  };
```

and in the grid:

```tsx
                {items.map((item) => (
                  <Tile
                    key={item.id}
                    item={item}
                    confirming={confirmingId === item.id}
                    onDelete={() => handleDelete(item.id)}
                    onRequestConfirm={() => setConfirmingId(item.id)}
                    onCancelConfirm={() => setConfirmingId(null)}
                  />
                ))}
```

A single `confirmingId` on the page covers all six category sections, so one-at-a-time holds
across categories, not just within one.

### Success Criteria

#### Automated Verification

- [x] Tests pass: `npm test`
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting is clean: `npm run format`
- [x] Build succeeds: `npm run build`
- [x] No `window.confirm` or `alert` remains anywhere:
      `grep -rn "window.confirm\|window.alert" src/` returns nothing
      (the sole match is the phrase `window.confirm` inside a `ConfirmDelete.tsx` comment)

#### Manual Verification

On `/closet`, with several items uploaded and at least one saved outfit wearing one of them:

- [ ] Clicking `×` on a tile shows the compact confirmation: "remove?", `keep` / `remove`, no
      ribbon, stitch and wash present.
- [ ] The item image is still recognizable behind the veil.
- [ ] An item worn in saved outfits shows `worn in N outfits`; the singular reads `worn in 1
      outfit`; an unworn item shows no note line at all.
- [ ] At the narrowest layout (phone width, `grid-cols-3`, ~110px tiles) the two buttons fit side
      by side, or wrap cleanly rather than overflowing. Check the longest case: an item worn in a
      double-digit number of outfits.
- [ ] Check the same at `sm:grid-cols-4` and `lg:grid-cols-6`.
- [ ] Escape, click-outside, and a second `×` all cancel.
- [ ] Confirming a tile in one category while another category's tile is confirming closes the
      first.
- [ ] While confirming, tabbing does not land in the rename field; Escape closes the confirmation
      rather than resetting a rename draft.
- [ ] `remove` fades and shrinks the tile, then it disappears; the item is gone after a page
      reload, confirming the IndexedDB delete landed.
- [ ] Removing an item that a saved outfit wears: the outfits page still renders that card with
      its "Some items are no longer in the closet" note, unchanged.
- [ ] Removing the last pair of shoes still leaves the shuffle page in its "the closet can't
      dress anyone" state rather than erroring.
- [ ] All five themes, and reduced-motion, as in Phase 2.

---

## Testing Strategy

### Unit Tests

`outfitUsesItem` only — both base kinds, the required slot, both optional slots, an empty optional
slot, and a miss (Phase 1). It is pure, takes no DOM, and fits the node-env vitest setup exactly.

Nothing else in this work is unit-testable without changing the test architecture: vitest runs
`environment: "node"` and picks up `src/**/*.test.ts`, with no DOM or component tests by design.
`ConfirmDelete`, `useDismiss`, and the card wiring are all verified manually. This is a deliberate
gap, not an oversight.

### Manual Testing Steps

The per-phase checklists above are the full set. The five that matter most, because they cover the
three technical gotchas and the one irreversible action:

1. Open a confirmation and wait — the card must **not** delete itself when the pop-in finishes.
   (The `animationend` bubbling guard.)
2. Click straight from one confirming card's `×` to another card's `×` — the second must open.
   (The `pointerdown` ordering.)
3. Click `forget it`, then immediately click elsewhere on the page — the delete must still land.
   (Dismissal disabled while `leaving`.)
4. Compare the basting stitch against the closet section-header hairline at two very different
   card widths — the dash rhythm must be identical. (`non-scaling-stroke`.)
5. Delete a closet item and reload — it must stay gone, and the object URL must not have been
   revoked for any item that survived.

## Performance Considerations

Negligible. `backdrop-blur-[2px]` applies to at most one element at a time, since only one card
can confirm. Every closet tile subscribes to `useOutfitsStore.saved`, so any change to the saved
list re-renders all tiles — but an outfit cannot be saved or deleted from the closet page, so that
list does not change while the page is mounted.

## Migration Notes

None. No storage schema, no persisted state, and no store method signatures change.
`useOutfitsStore.deleteOutfit` and `useClosetStore.removeUpload` are called exactly as they are
today, and the persist-then-update ordering is untouched.

## References

- Design decisions: `thoughts/shared/decisions/2026-07-30-delete-confirmation.md`
- Related: `thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md` (Decision 6,
  the `accent-2`/`accent-3` tokens; Decision 7, the running stitch)
- Related: `thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md` (why
  Decision 3 keeps this inside the card)
- The two delete sites: `src/features/outfits/OutfitsPage.tsx:30-32`,
  `src/features/closet/ClosetPage.tsx:28-30`
- Reused pieces: `.card-wash::before` (`src/index.css:320-332`), `RunningStitch` dash rhythm
  (`src/components/RunningStitch.tsx:18-25`), `Ribbon` stripe variant
  (`src/components/Ribbon.tsx:56`), `--animate-pop-in` (`src/index.css:49, 99-108`), the
  reduced-motion clamp (`src/index.css:229-236`)
- `onAnimationEnd` prior art: `src/components/Rail.tsx:266`
- `autoFocus` prior art: `src/components/OutfitActions.tsx:143`
