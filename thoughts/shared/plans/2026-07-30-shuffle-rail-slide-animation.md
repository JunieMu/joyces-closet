# Shuffle Rail Slide Animation — Implementation Plan

## Overview

Replace the shuffle rails' `rail-in` rise/fade with a directional, carousel-style **slide**:
each rail becomes a clipped filmstrip window where the outgoing item leaves the way the
incoming one arrives. Per
`thoughts/shared/decisions/2026-07-30-shuffle-rail-slide-animation.md`: CSS-only, no new
dependencies, **UI-only** — `useShuffleStore`, `shuffle.ts`, `useCascade`, and all existing
tests stay byte-identical. Three files change: `src/index.css`, `src/components/Rail.tsx`,
`src/features/shuffle/ShufflePage.tsx`.

User decisions made during planning:

- **Replay nonce covers every gesture** (Decision 5 generalized): the arrows, the swipe, and
  the ⇄ button all bump one local counter, so a swap that lands back on the same item still
  sweeps. A one-item rail's `›` replays the slide instead of reading as a dead arrow, and the
  direction a gesture recorded is always consumed by the frame it caused — no stale direction
  can leak into a later Shuffle All.
- **An appearing rail rises immediately** (delay 0), exactly as a freshly mounted rail does
  today. In the rare Shuffle All that flips the base kind, the brand-new rail rises ahead of
  the cascade rather than waiting for its slot; the alternative would have made every page
  load cascade, which no decision asks for.

## Current State Analysis

- **The animation**: `--animate-rail-in: rail-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both`
  (`src/index.css:28`), keyframes at `src/index.css:37-46` (fade + 10px rise + scale 0.98→1).
  Used in exactly one place — `src/components/Rail.tsx:151`.
- **The trigger**: keyed-remount replay. `frameKey = "${active?.id ?? "none"}:${cascadeTick}"`
  (`Rail.tsx:82`); a render-phase `setFrame` freezes `animationDelay` at mount so a re-render
  mid-cascade can't rewrite a running animation (`Rail.tsx:83-90`, `:146-154`).
- **No exit animation exists anywhere in the app.** The previous outfit is not retained:
  `shuffleAll` overwrites `outfit` wholesale (`useShuffleStore.ts:63`) and React unmounts the
  old node in the same commit.
- **No direction signal reaches the frame.** `step(delta)` (`Rail.tsx:93-96`) knows the
  travel direction; the animated node never sees it.
- **The frame's container has no `relative` and no `overflow-hidden`** (`Rail.tsx:140-145`) —
  both are prerequisites for a clipped two-frame window.
- **The cascade**: `CASCADE_MS = {top: 0, jacket: 70, bottom: 140, shoes: 210, accessory: 280}`
  (`ShufflePage.tsx:11-17`), driven by the `useCascade` tick that only Shuffle All bumps
  (`OutfitActions.tsx:105-108`). Total window ≈ 680 ms.
- **Reduced motion**: one global clamp (`src/index.css:185-200`) zeroes
  `animation-duration`/`animation-delay` for everything, with an `animation: none` escape for
  `.aura`. Any new CSS keyframe inherits it for free.
- **Tests**: vitest `environment: "node"`, `src/**/*.test.ts` only — domain logic. Nothing here
  is unit-testable; verification is manual, per house convention.

## Desired End State

Every item→item exchange on a shuffle rail slides: the old frame translates 100% of the frame
width out of a clipped window while the new one translates in from the opposite edge, both on
`0.4s cubic-bezier(0.22, 1, 0.36, 1)` with `fill-mode: both`, so the pair reads as one
filmstrip step. `›`/swipe-left enter from the right; `‹`/swipe-right enter from the left;
every programmatic swap (⇄, Shuffle All, a closet repair) sweeps forward. Shuffle All sweeps
all rails forward on the existing 0/70/140/210/280 ms stagger. A rail with no predecessor —
first paint, a loaded outfit, a rail that appears in the dress↔separates flip — still plays
`rail-in`. Rapid input finalizes the in-flight pair and starts a new one immediately.

Verified by: `npm run typecheck && npm run lint && npm test && npm run build` all green,
`git diff --stat` touching exactly three source files, and the manual matrix in
**Testing Strategy**.

### Key Discoveries

- **The Tops and Dresses rails are the same element type at the same tree position**
  (`ShufflePage.tsx:120-151`), so React **reuses the `Rail` instance** across a base flip
  rather than remounting it. Today that is invisible (the inner keyed frame remounts anyway);
  with retained state it would slide the dress out and the top in inside a frame that just
  changed from `h-80` to `h-52`. Decision 2 wants vanish + rise, which needs an explicit `key`
  (Phase 3).
- **Tailwind v4 only generates utilities it can literally see**: `` `animate-rail-slide-in-${dir}` ``
  would compile to nothing. Direction must select from a lookup of complete class strings.
- **`animationend` still fires under the reduced-motion clamp** (duration 0.01 ms), so the
  exit-frame cleanup path works there with no new escape hatch.
- **The render-phase `setFrame` idiom must stay idempotent**: `<StrictMode>` (`app.tsx:32`)
  double-invokes render-phase updates. Computing the next frame purely from the *committed*
  frame + props (never from the value being written) keeps both invocations identical.
- **`ClosetItem` object identity is stable** for a given id (`useClosetStore.ts:20-23`; only
  `renameUpload` mints a new object, reusing the same object URL) — so a snapshot of the
  outgoing item cannot go stale in a way that breaks its image during the 400 ms it lives.
- **`removeUpload` revokes the object URL** (`useClosetStore.ts:55`), but deletions happen on
  `/closet` while `ShufflePage` is unmounted, so a retained frame can never hold a revoked URL
  in practice.
- The mock's approved slide keyframes are pure `translateX` — no opacity, no scale.

## What We're NOT Doing

- The 3D flip variant, finger-following drag, gesture physics, or any animation/carousel
  library (Options B/C/D in the research doc). No new dependencies.
- View Transitions API; route/page transitions.
- Any change to `shuffleSlot`'s distribution, `shuffle.ts`, `useShuffleStore`, `useCascade`,
  or the persisted outfit shape.
- Component/DOM test infrastructure.
- Touching `pop-in`, the aura, the outfit cards, or any animation off the shuffle rails.
- Cross-rail choreography for the dress↔separates flip beyond "vanish instantly / rise in".

## Implementation Approach

Keep the house idiom — CSS keyframes as `--animate-*` `@theme` tokens, replayed by remounting
a keyed node — and extend it in two directions: a **second frame** (the outgoing item, kept in
`Rail`-local state and dropped on `animationend`), and a **direction + nonce** recorded by the
gesture that caused the swap. All new state lives in `Rail`; nothing else learns that an
animation exists.

The state machine, in one paragraph: a `gesture` state records `{dir, seq}`, bumped by every
arrow, swipe, and ⇄ press. `frameKey` gains `gesture.seq`, so every gesture is guaranteed to
produce a new frame. When the key changes, the render phase builds the next frame *from the
committed one*: it inherits the delay rule unchanged, snapshots the outgoing item, and takes
its direction from the gesture if that gesture has not been consumed yet, otherwise forward.
A `slide` flag records whether there was a predecessor at all — it survives the exit frame's
removal, so dropping the old frame can never restart the new one's animation.

## Phase 1: Slide keyframes as `@theme` tokens

### Overview

Add the four directional keyframes and their `--animate-*` tokens beside `rail-in`. Purely
additive: nothing consumes them yet, so the app is unchanged after this phase.

### Changes Required:

#### 1. Animation tokens

**File**: `src/index.css`
**Changes**: retarget the `--animate-rail-in` comment (it is now the *appear* animation, not
the every-swap animation) and add four slide tokens after it.

```css
  /* A rail frame APPEARING with nothing to exchange with: first paint, a loaded outfit, or a
     rail that the base flip brought into existence (2026-07-30 Decision 2). */
  --animate-rail-in: rail-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;

  /* A rail frame being EXCHANGED (arrow, swipe, per-rail ⇄, Shuffle All): the outgoing frame
     leaves the way the incoming one arrived. Identical duration and curve on both halves is
     what makes the pair read as one filmstrip step (2026-07-30 Decision 1). */
  --animate-rail-slide-out-left: rail-slide-out-left 0.4s
    cubic-bezier(0.22, 1, 0.36, 1) both;
  --animate-rail-slide-out-right: rail-slide-out-right 0.4s
    cubic-bezier(0.22, 1, 0.36, 1) both;
  --animate-rail-slide-in-left: rail-slide-in-left 0.4s
    cubic-bezier(0.22, 1, 0.36, 1) both;
  --animate-rail-slide-in-right: rail-slide-in-right 0.4s
    cubic-bezier(0.22, 1, 0.36, 1) both;
```

#### 2. Keyframes

**File**: `src/index.css`
**Changes**: add after the `rail-in` keyframes block (still inside `@theme`, beside the
existing two). Travel is a full frame width; `overflow-hidden` on the window does the clipping.

```css
  @keyframes rail-slide-out-left {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-100%);
    }
  }
  @keyframes rail-slide-out-right {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(100%);
    }
  }
  @keyframes rail-slide-in-left {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @keyframes rail-slide-in-right {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
```

> Naming deviates from the mock's `rail-in-left`/`rail-out-left` on purpose: `rail-in` survives
> as the *appear* animation (Decision 2), and `animate-rail-in-left` sitting next to
> `animate-rail-in` would read as a variant of it rather than a different animation. The
> timing, travel, and curve are the mock's, unchanged.

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff
- [x] All four tokens present: `grep -c "animate-rail-slide" src/index.css` → `4`

#### Manual Verification:

- [ ] `npm run dev` — the shuffle page looks and behaves exactly as before (rails still rise);
      no console warnings.

---

## Phase 2: The two-frame slide in `Rail`

### Overview

The whole mechanism: a clipped window holding one or two absolutely-stacked frames, gesture
direction + replay nonce, and the retained outgoing frame. All state is `Rail`-local
(Decision 7).

### Changes Required:

#### 1. Module-level constants and the frame body

**File**: `src/components/Rail.tsx`
**Changes**: add below the existing `ARROW_CLASS`, and extract the frame's contents so both
frames render identically.

```tsx
/**
 * Which keyframe pair a swap plays. The new item enters from the direction of travel: `›` and
 * a left swipe sweep forward (in from the right), `‹` and a right swipe sweep back. Every
 * programmatic swap — the ⇄ button, Shuffle All, a closet repair — sweeps forward (Decision 4).
 *
 * Spelled out rather than interpolated: Tailwind only generates utilities it can see in source.
 */
const SLIDE = {
  forward: {
    out: "animate-rail-slide-out-left",
    in: "animate-rail-slide-in-right",
  },
  back: {
    out: "animate-rail-slide-out-right",
    in: "animate-rail-slide-in-left",
  },
} as const;

/** What a frame shows. "None" is a real position on optional rails, not an absent item. */
function FrameBody({
  item,
  imageClassName,
  emptyLabel,
}: {
  item: ClosetItem | null;
  imageClassName: string;
  emptyLabel: string;
}) {
  if (item === null)
    // No frame around the empty position: an outlined box read as heavier than the garment it
    // stands in for, and its straight edges invited comparison to a true rectangle. The paper
    // holds the space instead.
    return (
      <div className="font-display text-ink/35 flex h-full w-full items-center justify-center text-sm italic">
        {emptyLabel}
      </div>
    );

  return (
    <img
      src={item.image}
      alt={item.name}
      draggable={false}
      className={`max-h-full object-contain select-none ${imageClassName}`}
    />
  );
}

/** One rendered pair of frames: the item entering, and (briefly) the one it replaced. */
interface Frame {
  key: string; // the frameKey this pair was built for; "" before the first mount
  tick: number;
  delay: number;
  n: number; // bumped per pair, so both frames remount and replay even on a same-item swap
  gestureSeq: number; // the gesture this pair consumed — a later swap must not reuse its direction
  dir: 1 | -1;
  slide: boolean; // false when there was no predecessor: the frame rises instead (Decision 2)
  item: ClosetItem | null; // what is on screen, kept so the next swap knows what to exchange out
  out: { item: ClosetItem | null } | null; // the outgoing frame, alive only while it animates
}
```

#### 2. State and the frame builder

**File**: `src/components/Rail.tsx`
**Changes**: replace the `frame` state (`Rail.tsx:67-70`) and the render-phase update
(`Rail.tsx:82-90`). The delay rule is carried over verbatim.

```tsx
  const swipeStartX = useRef<number | null>(null);

  // Every rail gesture bumps `seq` and records where it travels. The nonce is what makes a
  // re-roll that lands back on the same item still play (Decision 5) — and, because a gesture
  // always produces a new frame, the direction it recorded is always consumed by the swap it
  // caused, never left behind for a later Shuffle All to pick up.
  const [gesture, setGesture] = useState<{ dir: 1 | -1; seq: number }>({
    dir: 1,
    seq: 0,
  });

  // The frame pair is rebuilt in the render phase whenever the key changes, and its delay and
  // direction are frozen at that moment: a re-render while the cascade is still in flight must
  // not rewrite an animation that is already running.
  const [frame, setFrame] = useState<Frame>({
    key: "",
    tick: cascadeTick,
    delay: 0,
    n: 0,
    gestureSeq: 0,
    dir: 1,
    slide: false,
    item: null,
    out: null,
  });

  // "None" is a real, browsable position on optional rails — there is no none.png sentinel.
  const positions: (ClosetItem | null)[] = allowNone ? [null, ...items] : items;
  if (positions.length === 0) return null;

  const current = Math.max(
    0,
    positions.findIndex((item) => (item?.id ?? null) === activeId),
  );
  const active = positions[current] ?? null;

  const frameKey = `${active?.id ?? "none"}:${cascadeTick}:${gesture.seq}`;
  // Built from the committed frame only, never from the value being written: StrictMode
  // double-invokes render-phase updates, and both invocations have to agree.
  const view: Frame =
    frame.key === frameKey
      ? frame
      : {
          key: frameKey,
          tick: cascadeTick,
          // A Shuffle All (tick bumped) staggers; an arrow step, swipe or ⇄ plays at once.
          delay: cascadeTick === frame.tick ? 0 : cascadeDelayMs,
          n: frame.n + 1,
          gestureSeq: gesture.seq,
          // A swap the user steered follows their travel; everything else sweeps forward.
          dir: gesture.seq === frame.gestureSeq ? 1 : gesture.dir,
          // A rail's first frame has nothing to exchange with, so it rises in (Decision 2).
          slide: frame.key !== "",
          item: active,
          out: frame.key === "" ? null : { item: frame.item },
        };
  if (view !== frame) setFrame(view);
```

#### 3. Handlers

**File**: `src/components/Rail.tsx`
**Changes**: `step` gains the gesture bump; the ⇄ button gets a wrapper; add the exit-frame
cleanup. `handlePointerUp` is unchanged (it already routes through `step`).

```tsx
  // Wraps around at both ends, so a single-item rail simply lands back on itself — the nonce
  // is what makes that land visibly rather than as a dead arrow.
  const step = (delta: 1 | -1) => {
    const next = (current + delta + positions.length) % positions.length;
    setGesture((previous) => ({ dir: delta, seq: previous.seq + 1 }));
    onChange(positions[next]?.id ?? null);
  };

  // shuffleSlot re-rolls uniformly over every item including the current one, so with three
  // tops roughly one press in three hands back what was already there. The nonce keeps the
  // button honest: the sweep plays either way, and the distribution stays untouched
  // (Decision 5).
  const handleShuffle = () => {
    setGesture((previous) => ({ dir: 1, seq: previous.seq + 1 }));
    onShuffle();
  };

  // The outgoing frame has finished leaving; drop it so its <img> stops holding the DOM. Guarded
  // on the pair it belongs to, so a swap landing in the same batch keeps its own exit frame.
  const dropExitingFrame = (n: number) =>
    setFrame((previous) =>
      previous.n === n && previous.out !== null
        ? { ...previous, out: null }
        : previous,
    );
```

The ⇄ button (`Rail.tsx:120-127`) changes one line: `onClick={onShuffle}` → `onClick={handleShuffle}`.

#### 4. The filmstrip window

**File**: `src/components/Rail.tsx`
**Changes**: replace the swipe surface and its single frame (`Rail.tsx:140-171`).

```tsx
        {/* The filmstrip window: frames stack on top of each other and are clipped at its
            edge, so a swap slides one item out of view exactly as the next arrives. */}
        <div
          className={`relative flex-1 touch-pan-y overflow-hidden ${className}`}
          onPointerDown={(event) => (swipeStartX.current = event.clientX)}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => (swipeStartX.current = null)}
        >
          {view.out !== null && (
            <div
              key={`out-${view.n}`}
              aria-hidden="true"
              style={{ animationDelay: `${view.delay}ms` }}
              className={`${slide.out} absolute inset-0 flex justify-center ${alignClass}`}
              onAnimationEnd={() => dropExitingFrame(view.n)}
            >
              <FrameBody
                item={view.out.item}
                imageClassName={imageClassName}
                emptyLabel={emptyText}
              />
            </div>
          )}

          <div
            key={`in-${view.n}`}
            style={{ animationDelay: `${view.delay}ms` }}
            className={`${view.slide ? slide.in : "animate-rail-in"} absolute inset-0 flex justify-center ${alignClass}`}
          >
            <FrameBody
              item={active}
              imageClassName={imageClassName}
              emptyLabel={emptyText}
            />
          </div>
        </div>
```

with these locals computed just above the `return` (after `view`):

```tsx
  const slide = view.dir > 0 ? SLIDE.forward : SLIDE.back;
  const alignClass = align === "top" ? "items-start" : "items-center";
  const emptyText = emptyLabel ?? `no ${label.toLowerCase()}`;
```

Notes on why this shape:

- The entering frame renders `active`, not `view.item` — identical in practice, but it cannot
  go stale after a rename.
- The entering frame's class depends on `view.slide`, **not** on whether `view.out` is still
  present. Tying it to `out` would swap the class from slide-in to `animate-rail-in` the moment
  the exit frame is dropped, restarting the animation on an already-settled frame.
- Both frames carry the same `animationDelay`. With `fill-mode: both`, a staggered pair holds
  the old item at rest and the new one off-frame until that rail's turn — the same trick the
  cascade already relies on.
- Interruption is free (Decision 6): a new key means new `n`, so both nodes remount. The frame
  that was entering becomes a fresh outgoing node starting from `translateX(0)` — it snaps to
  rest and leaves, which is exactly "finalize and restart".
- The exiting frame is `aria-hidden` so a screen reader never announces the same rail twice.
- The window keeps `flex-1` and the height class; `items-center justify-center` move onto the
  frames, since absolutely positioned children ignore the parent's flex alignment.

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint` (react-hooks v7 compiler rules — no ref reads during render)
- [x] Tests pass unmodified: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff
- [x] The guardrail holds — `git diff --stat` lists only `src/index.css`,
      `src/components/Rail.tsx` (and `ShufflePage.tsx` after Phase 3); no store, no
      `shuffle.ts`, no test file.

#### Manual Verification:

- [ ] `›` slides the new item in from the right while the old one exits left, clipped at the
      frame edge; `‹` mirrors it.
- [ ] A left swipe matches `›`, a right swipe matches `‹`; vertical page scroll still works
      from on top of a rail (`touch-pan-y` intact).
- [ ] The ⇄ button always sweeps forward — including when the re-roll hands back the same item
      (easiest to see on a category with 2–3 pieces).
- [ ] Shuffle All sweeps every rail forward, staggered top → jacket → bottom → shoes →
      accessory; the aura still re-blooms on the same press.
- [ ] Browsing to and from "none" on the jacket/accessory rails slides the italic label like
      any other frame.
- [ ] Mashing an arrow reads as flipping through a stack: no lockout, no queue, each press
      restarts immediately.
- [ ] First load and a full reload rise (no slide, nothing flies in from off-frame); the same
      after loading a saved outfit from `/outfits`.
- [ ] Nothing is clipped at rest — check the bottoms rail (tall art, waist-anchored to the
      frame's top edge) and the shoes/accessory rails.
- [ ] On mobile (2-column paper doll) a sliding item stays inside its own rail's window and
      never sails over the neighboring column.
- [ ] With Reduce Motion on (System Settings → Accessibility → Display), swaps are instant and
      no ghost frame is left in the DOM (inspect a rail after a few swaps: one child).

**Implementation Note**: pause here for manual confirmation before Phase 3.

---

## Phase 3: Vanish-and-rise across the dress↔separates flip

### Overview

Two `key` props. Without them React reuses the one `Rail` instance across the base flip, and
the retained state added in Phase 2 would slide a dress out of a frame that has already
shrunk to top height — while Decision 2 says a disappearing rail vanishes and an appearing one
rises.

### Changes Required:

#### 1. Distinct keys on the two base branches

**File**: `src/features/shuffle/ShufflePage.tsx`
**Changes**: at the base conditional (`:120-151`), give each branch its own key and say why.

```tsx
          {/* Distinct keys, so the flip tears the rail down instead of reusing the instance:
              a rail that appears has no predecessor to slide from, and rises in (Decision 2). */}
          {base.kind === "separates" ? (
            <div key="top" className="[grid-area:top]">
              <Rail label="Tops" ... />
            </div>
          ) : (
            // A dress fills the top and bottom slots at once, so the two rails merge into one.
            <div
              key="dress"
              className="[grid-area:top] md:[grid-row:top-start_/_bottom-end]"
            >
              <Rail label="Dresses" ... />
            </div>
          )}
```

Everything inside each branch is unchanged. The bottoms rail already mounts and unmounts with
`base.kind === "separates" && (...)`, so it needs nothing.

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff

#### Manual Verification (needs at least one dress uploaded):

- [ ] Toggling **Dress** in the sidebar/bottom bar: the tops and bottoms rails vanish
      instantly, the dress rail rises in — nothing slides sideways, no half-height dress
      mid-flight.
- [ ] Toggling back to **Top & bottom**: the dress rail vanishes, tops and bottoms rise.
- [ ] The dress rail's ⇄ landing on a separates base behaves the same way.
- [ ] Browsing the dress rail with the arrows still slides normally (it is the same rail).
- [ ] A Shuffle All that flips the base kind: the new rail rises immediately while the others
      sweep on their stagger — accepted, and the only place the two motions are visible at
      once.

---

## Testing Strategy

### Unit Tests

None to add, and none to change. The vitest setup is node-env and picks up `src/**/*.test.ts`
only — domain logic, by design (`CLAUDE.md`). Nothing in this change is a pure function worth
extracting: the direction/nonce rules are three lines of state bookkeeping whose whole meaning
is when React re-renders. The existing suite is a regression guard for the guardrail itself —
it must pass **unmodified**, which is the proof that no shuffle logic moved.

### Manual Testing Steps

Prerequisite closet: ≥3 tops, ≥3 bottoms, ≥2 pairs of shoes, ≥1 jacket, ≥1 accessory, ≥1 dress.
Also worth a pass with a category holding exactly **one** item (the replay-nonce case).

1. Run the Phase 2 and Phase 3 manual checklists above.
2. Repeat the arrow/swipe/⇄/Shuffle All matrix under **Reduce Motion**.
3. Repeat at a mobile width (2-column paper doll) and at desktop (3-column composition).
4. Check one non-default theme (the animation is color-agnostic, but the clipped window is new
   chrome — confirm nothing reads as a hard edge against a different paper).
5. Leave a rail mid-slide and navigate away (`/closet`), then back: no stuck frame, rails rise.

## Performance Considerations

At most two frames per rail, six rails, `transform`-only keyframes — compositor work, no
layout, no paint. The peak is a Shuffle All: 12 nodes animating within one 680 ms window, each
carrying an already-decoded object-URL image. The extra `<img>` per rail exists only for the
400 ms of its exit and is then dropped. No new dependencies, so no bundle change.

## Migration Notes

Nothing persisted changes: no new storage keys, no store fields, no outfit-shape change, so
there is no forward or backward migration. Rollback is reverting the commit — the CSS tokens
are additive and `--animate-rail-in` is still the appear animation, so a partial revert of
`Rail.tsx` alone also lands in a working state.

## References

- Design decisions (source of truth):
  `thoughts/shared/decisions/2026-07-30-shuffle-rail-slide-animation.md`
- Research + options analysis:
  `thoughts/shared/research/2026-07-30-shuffle-carousel-animation-options.md`
- Approved interactive mock (slide card):
  https://claude.ai/code/artifact/52b88c67-ca16-4f14-be50-bd3819ea6b3b
- Current animation token + keyframes: `src/index.css:28`, `src/index.css:37-46`
- Reduced-motion clamp: `src/index.css:185-200`
- Frame key + frozen delay: `src/components/Rail.tsx:82-90`
- The animated frame and swipe surface: `src/components/Rail.tsx:140-171`
- Cascade table: `src/features/shuffle/ShufflePage.tsx:11-17` · tick bump:
  `src/components/OutfitActions.tsx:105-108`
- Base conditional (the instance-reuse trap): `src/features/shuffle/ShufflePage.tsx:120-151`
- UI-only guardrail: `thoughts/shared/decisions/2026-07-13-ui-redesign.md` Decision 13;
  animation scope: Decision 11
- User decisions during planning: replay nonce on **every gesture**; an appearing rail rises
  **immediately** (delay 0)
