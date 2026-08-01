---
date: 2026-07-30
source: grill-to-decisions
input: thoughts/shared/research/2026-07-30-shuffle-carousel-animation-options.md (Option A, slide style chosen via interactive mock) + this session's grill
status: decided
---

# Design Decisions: Shuffle rail slide animation

Replace the `rail-in` rise/fade with a directional, carousel-style slide on the shuffle page rails. CSS-only, no new dependencies, UI-only — `useShuffleStore`, `shuffle.ts`, and the existing tests stay untouched.

## Decision 1: Animation style — directional two-frame slide (Option A, slide variant)

**Context**: The research doc compared four approaches (CSS two-frame, View Transitions, motion, embla); an interactive mock compared the two Option A keyframe styles side by side (slide vs 3D flip), built with the app's real tokens and rail chrome.
**Options**: Slide — filmstrip feel, clipped at the frame edge, lockstep motion · Flip — 3D card turn, needed perspective/backface (first 3D CSS in the codebase) and a two-phase timing chain.
**Decision**: **Slide**, with the mock's approved parameters: old and new frames both animate `0.4s cubic-bezier(0.22, 1, 0.36, 1)` (the existing `rail-in` curve), 100% frame-width travel, identical duration + curve so the pair reads as one filmstrip. Keyframes live as `--animate-*` tokens in the `@theme` block, next to the existing two. The mock's collapsible "slide css" block has the ready-to-lift keyframes.

## Decision 2: Slide means exchange, rise means appear

**Context**: A slide needs an old frame to exchange with. Some rail events have none: initial page mount, `loadOutfit` (navigates to `/` and remounts `ShufflePage`), and a rail *appearing* in the dress↔separates structural flip.
**Options**: A — slide only when a previous frame exists; keep `rail-in` rise for appearances · B — slide everything, including page mount (slot-machine rack-up, but implies a spatial world that isn't there, and a brand-new rail has nowhere to slide from).
**Decision**: **A.** Item→item swaps slide; rails with no predecessor play the existing `rail-in` rise; a disappearing rail (separates→dress) vanishes instantly, as everything does today. This one rule covers page mount, `loadOutfit`, and the structural flip with zero special-casing. `--animate-rail-in` survives as the app's "appear" animation. Note: "none" on optional rails is a real frame (the italic empty label), so swaps to/from none are ordinary exchanges — they slide.

## Decision 3: Shuffle All is a forward sweep with the existing cascade stagger

**Context**: The staggered cascade (0/70/140/210/280 ms, `ShufflePage.tsx:11-17`) is the app's signature delight moment (2026-07-13 ui-redesign Decision 11).
**Options**: A — every rail slides forward with the same stagger (one motion language; the outfit racks through like a slot machine) · B — keep the rise cascade for Shuffle All only (preserves the current moment verbatim, but the page speaks two motion dialects and the most-pressed button skips the new animation).
**Decision**: **A.** Directional sweep, stagger preserved exactly. Both frames of a sliding pair get the stagger delay — `animation-fill-mode: both` holds them in place until their turn, the same trick the cascade already relies on.

## Decision 4: Direction semantics — gestures follow travel, everything else sweeps forward

**Context**: Arrows/swipe have an inherent direction; programmatic swaps (per-rail ⇄, Shuffle All, the rare closet-subscription repair) don't — `Rail` just sees `activeId` change.
**Options**: A — all programmatic swaps enter from the right, same as `›` · B — random direction per re-roll (dice-ier, but Shuffle All rails sliding opposite ways reads as noise).
**Decision**: **A.** Pressing `›` or swiping left → new item enters from the right; `‹` or swiping right → enters from the left. Every programmatic swap enters from the right ("always forward"). No random directions.

## Decision 5: Per-rail shuffle always animates (UI replay nonce)

**Context**: `shuffleSlot` picks uniformly over all items *including* the current one (`shuffle.ts:23-36`, `:106-155`) — with 3 tops, ~1 in 3 ⇄ presses changes nothing, and today that means no animation at all (the frame key doesn't change). Shuffle All doesn't have this problem because the cascade tick is part of the key.
**Options**: A — `Rail` bumps a local tick on ⇄ press and includes it in the frame key (the button already lives inside `Rail`, `Rail.tsx:120-127`) · B — keep the silent no-op ("nothing changed, nothing moves" — but it reads as a dead button) · C — exclude the current item in `shuffleSlot` (changes the probability distribution and tested domain code; breaks the UI-only guardrail).
**Decision**: **A.** Every ⇄ press visibly sweeps forward, even when the re-roll hands back the same item — honest randomness with visible feedback. Distribution and `shuffle.ts` untouched.

## Decision 6: Interruption — finalize and restart

**Context**: Rapid arrow presses or ⇄ mashing can re-trigger mid-flight (the slide is 400 ms).
**Options**: A — drop the in-flight exiting frame instantly, snap the entering frame to rest, start the new pair (what the mock does; each press feels immediate) · B — lock out input during flight (unresponsive exactly when browsing fastest) · C — queue animations (spam five presses, watch five slides after your fingers stop).
**Decision**: **A.** Finalize-and-restart. Rapid flicking reads as flipping through a stack.

## Decision 7: Retention lives in Rail — UI-only change

**Context**: The previous outfit is not retained anywhere (`useShuffleStore.ts:63` overwrites `outfit` wholesale); an exit animation needs the outgoing item kept around briefly. House guardrail: UI polish never touches shuffle logic or stores (2026-07-13 ui-redesign Decision 13).
**Options**: A — previous-item snapshot as `Rail`-local state, dropped on `animationend` · B — a `previousOutfit` field in `useShuffleStore` (crosses the UI/domain line for no benefit; `partialize` at `useShuffleStore.ts:107` would exclude it from persistence, but the store shouldn't know about animation at all).
**Decision**: **A.** All new state (previous frame, direction, replay nonce) is `Rail`-local. `useShuffleStore`, `shuffle.ts`, `useCascade`, and every existing test stay byte-identical.

## Codebase Findings

- Current mechanism: keyed-remount replay — `frameKey = "${active?.id ?? "none"}:${cascadeTick}"` with a render-phase `setFrame` that freezes `animationDelay` at mount (`Rail.tsx:82-90`, `:146-154`). `<StrictMode>` (`app.tsx:32`) double-invokes render-phase updates — the new direction/nonce state must stay render-phase-safe the same way.
- The swipe surface (`Rail.tsx:140-145`) has **no `relative` or `overflow-hidden` today** — both are required for the clipped filmstrip window; the exiting frame renders `absolute inset-0` on top.
- Timing source of truth: `--animate-rail-in: rail-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both` (`src/index.css:28`). New slide tokens sit beside it in `@theme`; ready-to-lift keyframes are in the mock artifact and the research doc's follow-up section.
- The global reduced-motion clamp (`src/index.css:185-200`) covers the new keyframes automatically — `animationend` still fires at 0.01 ms, so the frame-cleanup path works under it. No new escape hatch needed.
- Cascade plumbing unchanged: `useCascade` tick bumped only by Shuffle All (`OutfitActions.tsx:106`); `CASCADE_MS` at `ShufflePage.tsx:11-17`; the aura re-bloom keyed on the same tick (`ShufflePage.tsx:113`) is unaffected.
- Triggers with no gesture that Decision 4 sends "forward": per-rail ⇄ (`ShufflePage.tsx` per-rail `onShuffle` → `shuffleSlot`), Shuffle All, and the closet-subscription repair (`useShuffleStore.ts:131-141`) — the last is near-unreachable while the page is visible today (closet edits happen on other routes) but should fall out of the same code path.
- The dress rail's ⇄ calls `shuffleSlot("base")` and can flip the base to separates (`shuffle.ts:43-59`) — under Decision 2 the vanishing dress rail disappears instantly and the appearing top/bottom rails rise in; no cross-rail choreography.
- Interactive mock (approved look): https://claude.ai/code/artifact/52b88c67-ca16-4f14-be50-bd3819ea6b3b — slide card = the approved behavior, including cascade stagger and swipe.
- Nothing here is unit-testable under the current setup (node env, `src/**/*.test.ts` only) — verification is manual, per house convention (`CLAUDE.md`).

## Out of Scope

- The flip style, finger-following drag / gesture physics, and any animation or carousel library (motion, embla, etc.) — Options B/C/D from the research doc.
- View Transitions API; route/page transitions (twice-rejected in prior decisions, still rejected).
- Changing `shuffleSlot`'s distribution (excluding the current item) or any other `shuffle.ts` / store behavior.
- Component/DOM test infrastructure.
- Touching `pop-in`, the aura, or any animation off the shuffle rails.
