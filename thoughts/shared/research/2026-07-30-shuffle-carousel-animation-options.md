---
date: 2026-07-30T18:38:17-05:00
researcher: Joyce Ma
git_commit: 1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c
branch: main
repository: joyces-closet
topic: "Replacing the shuffle fade-in with a carousel-style swipe/flip animation — what are the options?"
tags: [research, codebase, shuffle, rail, animation, carousel, tailwind, view-transitions]
status: complete
last_updated: 2026-07-30
last_updated_by: Joyce Ma
last_updated_note: "Added follow-up research comparing the visual/feel differences between Option A (CSS two-frame) and Option B (View Transitions)"
---

# Research: Carousel-style swipe/flip animation for the shuffle page

**Date**: 2026-07-30T18:38:17-05:00
**Researcher**: Joyce Ma
**Git Commit**: `1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c`
**Branch**: main
**Repository**: joyces-closet

## Research Question

The shuffle animation currently "kind of fades in"; the goal is a swiping/flipping-through animation like a carousel. What options exist for plugging that kind of animation into the app?

## Summary

The current animation is not a plain fade — it's `rail-in` (fade + 10px rise + slight scale-up) played by **remounting a keyed `<div>`** in `Rail.tsx`, staggered top-to-bottom on Shuffle All via a UI-only `useCascade` tick store. Three facts shape every option:

1. **There is no exit animation and nothing to animate out.** The old outfit/item is not retained anywhere — `shuffleAll` overwrites the single `outfit` field and React unmounts the old node in the same commit. A slide-old-out/slide-new-in carousel requires adding retention (per-Rail previous-item state or a store field).
2. **No direction signal reaches the animated node.** `step(±1)` knows the swipe direction but `animate-rail-in` always enters from below. Directional sliding needs that delta plumbed into the frame.
3. **The codebase has zero animation libraries, on purpose.** Two design-decision docs lock animation to "CSS-first, no framer-motion (or any new dependency)". Any library option means consciously revisiting that decision.

Four viable approaches, in increasing order of dependency/effort:

- **A. Extend the existing CSS remount pattern** with directional slide (or 3D flip) keyframes + a two-frame overlap for exit animation. Zero deps, honors all standing decisions, inherits the reduced-motion clamp for free. **Recommended default.**
- **B. Native View Transitions API** (`document.startViewTransition`). Zero deps, browser-managed old/new snapshots (exit animation for free), but bypasses the app's reduced-motion clamp and needs its own guard + feature-detect fallback.
- **C. Motion library (`motion`, ex-framer-motion)** — `AnimatePresence` + direction variants is the canonical React carousel pattern, and adds real gesture-following drag. ~18–35 KB gz into the main chunk; breaks the no-deps decision.
- **D. Headless carousel library (`embla-carousel-react`)** — a true dragging track with momentum/loop; smallest library option (~8 KB gz) but replaces the Rail's render-one-item model wholesale.

## Detailed Findings

### 1. How the current animation actually works

**The keyframe** — `src/index.css:28` declares `--animate-rail-in: rail-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;` inside the Tailwind v4 `@theme` block (so it compiles to the `animate-rail-in` utility). Keyframes at `src/index.css:37-46`:

```css
@keyframes rail-in {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

Fill mode `both` is load-bearing: rails with a stagger delay hold at `opacity: 0` until their turn.

**The remount trigger** — `src/components/Rail.tsx:82-90, 146-154`. The animated frame is keyed `frameKey = "${active?.id ?? "none"}:${cascadeTick}"`; any change unmounts the old `<div>` (and its `<img>`) and mounts a fresh one, replaying the CSS animation from frame 0. Including `cascadeTick` in the key means Shuffle All re-animates a rail even when the same item is re-rolled. A render-phase `setFrame` freezes `animationDelay` at mount so mid-cascade re-renders can't rewrite it (this replaced a ref because `eslint-plugin-react-hooks` v7's React-Compiler rule forbids reading refs during render — see Deviations in the 2026-07-13 plan). Note `<StrictMode>` at `src/app.tsx:32` double-invokes render-phase updates.

**The cascade** — `src/features/shuffle/ShufflePage.tsx:11-17`:

```tsx
const CASCADE_MS = { top: 0, jacket: 70, bottom: 140, shoes: 210, accessory: 280 };
```

`useCascade` (`src/components/useCascade.ts:9-12`) is a 12-line Zustand store (`tick` + `bump()`), bumped only by the Shuffle All button (`src/components/OutfitActions.tsx:106`). Total cascade window ≈ 280 + 400 = **680 ms**. The aura re-blooms off the same tick (`ShufflePage.tsx:113`, `<div key={tick} className="aura">`).

**Reduced motion** — `src/index.css:185-200` clamps `animation-duration`/`animation-delay`/`transition-duration` to ~0 globally with `!important`, plus an explicit `animation: none` escape for `.aura`. Any new CSS animation inherits this automatically; JS-driven or View-Transition animation does **not**.

### 2. What triggers a shuffle, and the retention gap

Chain: Shuffle All button → `bump()` + `shuffleAll()` (`OutfitActions.tsx:103-112`) → `useShuffleStore.shuffleAll` overwrites `outfit` wholesale (`src/features/shuffle/useShuffleStore.ts:63`) → React 19 batches both Zustand sets into one render → every Rail gets a new `frameKey` → keyed remount.

**The previous outfit is not retained anywhere**: the store holds a single `outfit: Outfit | null`; Rail's only local state is `{ key, tick, delay }`. The old DOM node is gone before the new one animates in — there is no exit animation and nothing to animate out. Any old-slides-out/new-slides-in effect requires adding retention:

- per-Rail `useState` of the previous item + `onAnimationEnd`/timer to drop it, **or**
- a `previousOutfit` field in the store — the `persist` `partialize` at `useShuffleStore.ts:107` only saves `outfit`, so a transient field is automatically excluded from persistence.

Other `outfit` writers (all bypass `bump()`, so rails animate with delay 0): arrow/swipe step → `setSlot` (`useShuffleStore.ts:71-75`); per-rail shuffle icon → `shuffleSlot` (`:65-69`); the separates↔dress toggle → `setBaseKind` (`:78-101`); `loadOutfit` from saved outfits (`:103`, remounts the page via navigation); and the closet subscription (`:131-141`), which can repair the outfit **asynchronously** after an upload/delete.

### 3. The Rail is already half a carousel

`src/components/Rail.tsx` is a hand-rolled swipe component (built per closet-rebuild Decision 9: "build the rail as our own lightweight component (swipe/arrow navigation) — no Bootstrap carousel"):

- Full track + index already computed: `positions` (with `null` prepended for optional slots), `current`, wraparound `step(delta)` with modulo (`Rail.tsx:73-96`). Only `positions[current]` is rendered.
- Swipe gesture already exists: `pointerdown` records x, `pointerup` fires `step(distance < 0 ? 1 : -1)` past a 40px threshold (`Rail.tsx:22, 98-106, 140-145`), with `touch-pan-y` so vertical scroll survives. It's discrete — **no finger tracking, no transform follow, no velocity**.
- "None" is a real browsable position on optional rails (jacket, accessory), rendered as an italic empty label (`Rail.tsx:155-169`).
- Images are IndexedDB-blob **object URLs** (`src/features/closet/types.ts:8`) — rendering neighbor slides costs nothing network-wise (already in memory), but URLs are revoked on item delete.
- Direction gap: `step()` knows the delta, but the animated frame doesn't — `rail-in` always enters from below regardless of swipe direction.

Per-slot layout: `.paper-doll` grid-template-areas (`src/index.css:203-225`), five/six `<Rail>` instances with fixed frame heights (tops `h-52 sm:h-64`, bottoms/dresses `h-80 sm:h-96`, shoes/accessories `h-28 sm:h-32` — `src/features/closet/railScale.ts:13-30`). Gotcha: the dress rail's shuffle calls `shuffleSlot("base")` and can return a `separates` base — one rail can vanish and be replaced by two rails mid-animation (same flip via the `setBaseKind` toggle).

### 4. Available infrastructure (and what's missing)

**Have:**
- Tailwind v4 CSS-first config; the `--animate-*` `@theme` token pattern with two precedents (`rail-in`, `pop-in`) — new keyframes slot in the same way (`src/index.css:28-56`).
- The remount-key replay idiom, the frozen-delay stagger pattern, and the `useCascade` tick as the sanctioned orchestration signal.
- Global reduced-motion clamp (`src/index.css:185-200`).
- 5 runtime deps total (`react` 19.2.7, `react-dom` 19.2.7, `react-router` 8.2.0, `zustand` 5.0.14, `@huggingface/transformers` 4.2.0). Verified **zero** animation/carousel libraries anywhere in `package-lock.json`/`node_modules` (checked: motion/framer-motion, react-spring, embla, swiper, keen-slider, react-slick, auto-animate, react-transition-group, use-gesture, gsap, animejs, tailwindcss-animate).

**Missing:**
- Any exit/leave animation mechanism; any direction signal in the animated node.
- Any 3D CSS (`perspective`, `backface-visibility`, `rotate-*`, `transform-style`) — a flip would be the codebase's first.
- View Transitions: zero usage; React's `<ViewTransition>` is **not** in the installed React build (canary-only, `node_modules/@types/react/canary.d.ts`); native `document.startViewTransition` is unclaimed and available.
- `manualChunks` control — `vite.config.ts` has no build config at all (the onnxruntime isolation comes free from Vite's worker chunking). A new library lands in the 317 KB main `app-*.js` chunk.
- Component tests — vitest runs `environment: "node"`, `src/**/*.test.ts` only. Replacing the animation breaks no tests; nothing guards a regression either.

## Options Analysis

### Option A — Extend the CSS remount pattern (directional slide or flip) · zero deps · **recommended default**

Stay inside the existing idiom: add keyframes like `rail-slide-in-left/right` + `rail-slide-out-left/right` (or `rail-flip-in/out` with `rotateY` + `perspective` for a card-flip feel) as new `--animate-*` tokens, and teach `Rail` two things:

1. **Direction**: extend the `frame` state with the last `step()` delta (arrows/swipe pass ±1; shuffle actions can pick a fixed or random direction) and choose the in/out keyframe pair from it.
2. **Exit overlap**: keep the outgoing item in per-Rail state, render **two absolutely-stacked frames** inside the fixed-height rail frame (old plays slide-out, new plays slide-in), drop the old one `onAnimationEnd`. The fixed frame heights and `overflow-hidden` make clipping trivial.

- **Pros**: honors both standing decisions (CSS-only, no deps); inherits the reduced-motion clamp automatically; keeps the Shuffle All cascade stagger working (same delay plumbing); compositor-friendly (transform/opacity only); smallest diff to review.
- **Cons**: manual bookkeeping — previous-item retention, `onAnimationEnd` cleanup, StrictMode-safe render-phase state, the dress↔separates structural flip, and the async closet-subscription repair all need care. Still no finger-following drag; the swipe remains a discrete flick.
- **Effort**: small-medium. One CSS block + `Rail.tsx` changes; no store/logic changes required if retention lives in `Rail`.

### Option B — Native View Transitions API · zero deps

Wrap the state update in `document.startViewTransition(() => { flushSync(() => step(...)) })`, give each rail frame a `view-transition-name`, and style `::view-transition-old/new(rail-*)` with directional slide keyframes. The browser snapshots old and new for you — **exit animation for free, no retention code**.

- **Pros**: no dependency; solves the retention gap at the platform level; per-name customization can reproduce the cascade stagger (`animation-delay` on the pseudo-elements).
- **Cons**: `::view-transition-*` pseudo-elements **bypass the reduced-motion clamp** at `src/index.css:185-200` — needs its own `@media (prefers-reduced-motion)` guard; needs feature-detect fallback (`if (!document.startViewTransition) setState()`), though support is broad by 2026 (Chrome/Edge 111+, Safari 18+, Firefox since 2025 for same-document); freezes the page during capture (the breathing aura stutters for a frame); `flushSync` interplay with Zustand + React 19 batching needs verification; React's own `<ViewTransition>` would require `react@experimental` — not viable. Note route/page transitions were twice rejected in decisions — this option should stay scoped to in-page rail swaps.
- **Effort**: small for basic slide; medium once reduced-motion, stagger, and fallback are handled.

### Option C — `motion` (ex-framer-motion) · revisits the no-deps decision

The canonical React carousel: `AnimatePresence` with `custom={direction}` variants animates old-out/new-in declaratively, and `drag="x"` adds true finger-following drag with elastic overshoot and velocity-based flicks — the piece no CSS option provides.

- **Pros**: kills the retention and direction problems declaratively; gesture physics; well-trodden pattern; React 19-compatible (v12+); `useReducedMotion` hook for the clamp.
- **Cons**: **directly contradicts ui-redesign Decision 11 and artistic-polish Decision 3** ("zero animation libraries") — adopting it is a deliberate decision reversal to document; ~18–35 KB gz (LazyMotion `domAnimation` subset vs full) into the 317 KB main chunk; two animation systems in one app unless the cascade/aura/pop-in are migrated too.
- **Effort**: medium. Rewrite `Rail`'s frame with `AnimatePresence`; keep everything else.

### Option D — `embla-carousel-react` (or keen-slider) · smallest real-carousel dep

A headless track model: all items render in a horizontal scroll track; the library owns drag-follow, momentum, looping, and programmatic `scrollTo(index)`.

- **Pros**: the most "carousel-like" feel of all options at ~8 KB gz; loop support matches the existing wraparound; `scrollTo(randomIndex)` on shuffle gives a fun slot-machine spin through intermediate items; object-URL images make rendering the whole track cheap.
- **Cons**: replaces the Rail's render-one-item model wholesale (biggest rewrite); same decision-reversal as C; the Shuffle All cascade and the `useCascade`/keyed-remount idiom need rethinking (embla animates scroll position, not mount/unmount); "none" positions and the dress↔separates flip need custom handling.
- **Effort**: medium-large. Best only if the dragging-track feel is the actual goal.

**Not recommended**: `swiper` (heavy for one rail), `react-transition-group` (unmaintained-adjacent, solves less than Option A by hand), building gesture-follow drag by hand in vanilla JS (that's re-implementing embla).

### Decision guide

| Want | Pick |
|---|---|
| Directional slide/flip on arrows, swipe, and shuffle; keep the app dependency-free | **A** |
| Same, with platform-managed old/new snapshots and less React state | **B** |
| Finger-following drag with spring physics | **C** |
| A true draggable, momentum-scrolling item track | **D** |

## Code References

- [`src/components/Rail.tsx:82-90`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/components/Rail.tsx#L82-L90) — frameKey + render-phase frozen-delay state
- [`src/components/Rail.tsx:146-154`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/components/Rail.tsx#L146-L154) — the keyed animated frame (`animate-rail-in`)
- [`src/components/Rail.tsx:93-106`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/components/Rail.tsx#L93-L106) — wraparound `step()` + discrete swipe handler (40px threshold)
- [`src/index.css:28-56`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/index.css#L28-L56) — `--animate-rail-in`/`--animate-pop-in` tokens + keyframes
- [`src/index.css:185-200`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/index.css#L185-L200) — global reduced-motion clamp (+ `.aura` escape hatch)
- [`src/features/shuffle/ShufflePage.tsx:11-17`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/features/shuffle/ShufflePage.tsx#L11-L17) — `CASCADE_MS` stagger table
- [`src/components/useCascade.ts:9-12`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/components/useCascade.ts#L9-L12) — the Shuffle All tick store
- [`src/features/shuffle/useShuffleStore.ts:63`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/features/shuffle/useShuffleStore.ts#L63) — `shuffleAll` overwrites `outfit` (no history)
- [`src/features/shuffle/useShuffleStore.ts:107-117`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/features/shuffle/useShuffleStore.ts#L107-L117) — persist `partialize`/`merge` (transient fields auto-excluded)
- [`src/components/OutfitActions.tsx:103-112`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/components/OutfitActions.tsx#L103-L112) — Shuffle All button (`bump()` + `shuffleAll()`)
- [`src/features/closet/railScale.ts:13-30`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/src/features/closet/railScale.ts#L13-L30) — rail frame heights / image width caps
- [`vite.config.ts:6-12`](https://github.com/JunieMu/joyces-closet/blob/1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c/vite.config.ts#L6-L12) — no build/chunk config; node-env tests only

## Architecture Insights

- **Animation-by-remount is the house style**: keyed `<div>`s replay CSS animations (`Rail` frame, aura bloom, pop-ins). There is no exit-animation machinery anywhere in the app.
- **Orchestration is a Zustand tick, not a timeline**: `useCascade` exists specifically so UI choreography never touches `useShuffleStore` (the "UI-only, zero behavior changes" guardrail from the redesign). A new animation should keep consuming the tick rather than adding store coupling.
- **All motion is transform/opacity, compositor-friendly, and behind one reduced-motion clamp** — with two documented escape hatches already (rail `animation-delay: 0ms !important`, aura `animation: none`). Option B would add a third class of exception.
- **The swipe is a gesture *detector*, not a gesture *follower*** — upgrading to follow-the-finger is precisely the line where a library starts paying for itself.
- **Nothing is component-tested by design** — animation changes are verified manually; keep logic (direction math, retention timing) in pure functions if it grows.

## Historical Context (from thoughts/)

- `thoughts/shared/decisions/2026-07-13-ui-redesign.md` — **Decision 11 "Animation scope"**: "Tiers 1 + 2, CSS-first, no framer-motion (or any new dependency)." Tier 2 defines today's behavior: "arrow/shuffle swaps slide/crossfade the item in; Shuffle All staggers the rails so the outfit cascades into place — this is the signature delight moment." (Notably, a *slide* was the original intent.) Decision 7 keeps swipe + always-visible arrows; Decision 13 is the "UI-only, zero behavior changes" guardrail.
- `thoughts/shared/plans/2026-07-13-ui-redesign-warm-editorial-boutique.md` — specified the shipping `rail-in` token, the `useCascade` store, the keyed-remount mechanism, and the stagger table. Deviations section documents why the delay is state (not a ref) and why reduced-motion needs `animation-delay: 0ms !important`.
- `thoughts/shared/decisions/2026-07-17-ui-artistic-polish.md` — Decision 3: "pure code, no new dependencies"; Decision 7: the aura is "the only ambient motion in the app"; route/page transitions rejected again.
- `thoughts/shared/plans/2026-07-17-ui-artistic-polish.md` — implemented the aura off the same cascade tick; noted at the time that the `rail-in` fill-mode/delay machinery in `Rail.tsx` "must not be disturbed" (a constraint scoped to *that* additive work, not a permanent ban on redesigning the rail animation).
- `thoughts/shared/decisions/2026-07-13-closet-rebuild.md` — Decision 9: keep the "carousel/paper-doll soul", build the rail in-house, "no Bootstrap carousel" (the legacy app was 5 hardcoded Bootstrap carousels).
- `thoughts/shared/plans/2026-07-13-closet-rebuild.md` — original animation-free `Rail.tsx` spec (pointer-event swipe, 40px threshold, no library).

## Related Research

- `thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md` — most recent design-system inventory (pill buttons, `paper-card`, `animate-pop-in`, `useCascade` listed among stores).

## Open Questions

1. **Which "carousel feel" is the actual goal** — directional slide on the existing flick gesture (A/B suffice), a 3D card flip (A), or finger-following drag with physics (C/D)? This is the fork that decides whether the no-dependency decision gets revisited.
2. Should **Shuffle All** also slide directionally (everything sweeps left, slot-machine style), or keep the rise-in cascade and only make arrow/swipe/per-rail-shuffle directional?
3. How should the **dress↔separates structural flip** animate — the one case where rails appear/disappear rather than swap contents?
4. If Option B is chosen: verify `flushSync` + Zustand + React 19 batching inside `startViewTransition`, and how the frozen-page capture interacts with the breathing aura.

## Follow-up Research 2026-07-30 (evening)

### Question: What are the animation/look differences between Option A and Option B?

For the steady case — one clean swipe, old item slides out, new item slides in — the two can be made to look **nearly identical**: both are authored keyframes on transform/opacity with whatever easing/distance is written. The differences are all at the edges:

| Dimension | A — CSS two-frame slide/flip | B — View Transitions |
|---|---|---|
| What moves | Two **live DOM elements** (real `<img>`s) absolutely stacked in the rail frame | Two **bitmap snapshots**; the old state is a frozen screenshot |
| Clipping at the rail edge | `overflow-hidden` on the frame clips the slide to a clean "window" | Snapshots render in a document-level overlay and **escape ancestor clipping** — a sliding snapshot glides over neighboring rails/grid cells; only fixable with `clip-path` keyframes on the pseudo-elements |
| Ambient motion during swap | Aura keeps breathing; page stays live | Old frame is a static capture — the breathing aura (and any hover state) **freezes/stutters** for the transition duration (~400ms per swap; the full ~680ms cascade on Shuffle All) |
| Rapid interaction (arrow-spamming, fast flicks) | Each trigger restarts cleanly per rail — flip-through-a-stack feel | **One transition per document**; a second trigger skips the running one to its end state → jump-cuts under spam |
| Rail independence | Rails animate independently and simultaneously (per-rail shuffle, async closet-repair) | Document-global; everything funnels through the single transition |
| Interactivity mid-animation | Fully interactive | The visible page is a snapshot overlay while the real DOM underneath is already the new state; clicks land on elements not yet visible |
| 3D flip variant | Rotates live elements; a proper two-face card is possible | Rotates snapshots — works, but it's spinning screenshots |
| Shuffle All cascade | Today's stagger plumbing carries over unchanged (per-frame `animation-delay`) | Achievable via per-rail `view-transition-name` + delays on the pseudo-elements, all inside one long transition |
| Reduced motion | Inherited from the global clamp (`src/index.css:185-200`) automatically | Bypasses the clamp; needs its own `::view-transition-*` guard |

### Verdict

- **A feels like a mechanical stepper/carousel** — each rail is its own clipped window you flick through, interruptible, always live. This matches the "flipping through a carousel" goal directly.
- **B feels like a choreographed scene change** — the browser morphs the whole page from state 1 to state 2 as one move. It shines when many things move as one (layout reflows, page-level transitions), less when rapidly flicking a single slot.

Two B-specific gotchas weigh heavily for this app: the **clipping escape** (an unclipped slide sails over the tight paper-doll grid — especially the 2-column mobile layout — reading as "flying screenshots" rather than "carousel"), and the **frozen aura** during every swap. B's genuine advantage — exit animation with zero retention bookkeeping — is paid for in those edge behaviors.

**Net**: same destination look for a single swipe; A wins on carousel *feel* (clipped window, interruptibility, per-rail independence), B wins on implementation simplicity for the exit half but fights back on clipping, reduced motion, and rapid interaction.
