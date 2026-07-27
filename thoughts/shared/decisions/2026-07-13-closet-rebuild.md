---
date: 2026-07-13
source: grill-to-decisions
input: Full from-scratch rebuild of the joyces-closet webapp (existing static HTML/Bootstrap/JS app; nothing needs to survive)
status: decided
---

# Design Decisions: Closet App Rebuild

## Decision 1: v1 scope

**Context**: Current app only shuffles a hardcoded closet (`index.html` carousels + `index.js` random-index buttons). "Closet planning" implies more: item management, saved outfits, calendar.
**Options**: A — shuffle/browse parity · B — in-UI closet management (upload/edit items) · C — save outfits · D — calendar planning.
**Decision**: v1 = **A + C** (shuffle + save outfits). Data model must be designed so B and D bolt on cleanly later. In-app photo upload is explicitly a later feature implementation.

## Decision 2: Users and runtime

**Context**: Determines persistence and hosting complexity.
**Options**: A — single user, static site · B — single user cross-device (needs sync backend) · C — multi-user (auth + backend).
**Decision**: **A** — single-user static site, no backend, no accounts. All persistence goes behind one storage interface so B/C become a swap, not a rewrite.

## Decision 3: How clothes enter the app

**Context**: Today: drop PNGs into `images/<category>/` and hand-edit HTML.
**Options**: A — files-in-folders + typed manifest · B — in-app upload (IndexedDB/backend, image pipeline).
**Decision**: **A** for v1. A handwritten, type-checked `closet.ts` manifest describes every item (id, name, category, image path, room for tags: color/season/occasion and jacket-compatibility metadata). Images live in `public/images/<category>/`. Adding an item = drop a PNG + add one manifest entry. Item model designed so B is purely additive later.

## Decision 4: Framework

**Options**: A — React + Vite · B — SvelteKit · C — Next.js (carries an unneeded server) · D — vanilla TS + Vite (hand-rolled reactivity works against expansion goal).
**Decision**: **React + Vite + TypeScript**, with **react-router from day one**: `/` (shuffle) and `/outfits` (saved). Establishes where closet-manager and calendar pages land later.

## Decision 5: Styling

**Options**: A — Tailwind v4 · B — CSS Modules.
**Decision**: **Tailwind v4**. Keep the existing visual identity as the token set rather than inventing a new design: pastel palette (pink `#facfcf`, `#ffe8e8`, accent `#cf7878`, blue `#8ba9e0`, `#d2dae9`, yellow `#fef0d6` — see `styles.css`), Fraunces Serif for headings, Work Sans for body. No Bootstrap.

## Decision 6: State and persistence

**Options**: React built-ins vs Zustand; localStorage vs IndexedDB vs backend.
**Decision**: **Zustand** for app state (current outfit selection, saved outfits), using its `persist` middleware. Saved outfits go through a small **`OutfitStore` interface** (`list`/`save`/`delete`) with a **localStorage implementation** for v1 — UI never talks to localStorage directly, so a future backend is a drop-in swap. Closet items come from the static typed manifest (Decision 3), not from storage.

## Decision 7: Outfit slot model

**Context**: Today's `none.png` in the jackets carousel hacks around optional jackets; dresses don't exist yet but are wanted.
**Decision**: An outfit is a set of slots: (**top + bottom**) XOR (**dress** — a full-body item filling both), optional **jacket**, required **shoes**, optional **accessory**. Categories: tops, bottoms, dresses, jackets, shoes, accessories. No `none.png` sentinel images — optionality lives in the model. Item schema reserves room for jacket-compatibility metadata (see Out of Scope).

## Decision 8: Shuffle behavior with dresses

**Options**: A — pool-proportional (shuffle-all picks dress with probability proportional to dresses vs top/bottom combos) · B — dresses only via explicit browse.
**Decision**: **A — pool-proportional.** Manual browsing can always reach dresses. When a dress is active, the top and bottom slots visually merge into one.

## Decision 9: Core interaction and layout

**Options**: A — keep the carousel/paper-doll soul (browsable rail per slot + per-slot shuffle + shuffle-all) · B — grid-picker overlay.
**Decision**: **A.** Build the rail as our own lightweight component (swipe/arrow navigation) — no Bootstrap carousel. Layout: vertical paper-doll stack (jacket/top → bottom → shoes) with accessories alongside, **designed mobile-first**.

## Decision 10: Saved outfits UX

**Decision**: "Save outfit" button on the shuffle page captures current slots; name optional, defaulting to a date-based name (e.g. "Outfit · Jul 13"). `/outfits` shows a grid of outfit cards with mini stacked previews; tapping a card loads it back into the shuffle view; delete available per card. No tags/notes on outfits in v1.

## Decision 11: Tooling, testing, deployment

**Decision**: Strict TypeScript, ESLint + Prettier. **Vitest for domain logic only** (shuffle rules, slot model, outfit store) — no component tests in v1. Deploy target is **Vercel**, eventually — configure as a standard Vite SPA so deployment is a non-event; actually deploying is not a v1 blocker.

## Decision 12: File organization

**Decision**: Feature-based structure: `src/features/shuffle/`, `src/features/outfits/`, `src/features/closet/` (manifest, item types), with shared UI primitives and utilities in `src/components/` / `src/lib/`. Domain logic (shuffle, slot rules) lives in plain TS modules separate from React components so it's unit-testable and survives future UI changes.

## Codebase Findings

- Entire current app is 3 files: `index.html` (5 hardcoded Bootstrap carousels), `index.js` (4 shuffle functions that set `data-bs-slide-to` to a random index), `styles.css` (palette + fonts worth preserving as tokens).
- Current image inventory in `images/`: 15 tops (shirts/tanks/sweater), 14 bottoms (pants/skirts/shorts), 3 jackets, 1 shoe, 1 accessory (bag), plus `none.png` and `*test.png` placeholders. Filenames encode subtype (e.g. `tank3.png`, `skirt2.png`) — useful when writing the initial manifest; `none.png` and test images should not carry over.
- No package.json, build system, or tests exist — greenfield; nothing to migrate except images and the visual identity.

## Out of Scope (explicitly deferred)

- **In-app upload / closet management UI** — later feature; v1 item model must not block it.
- **Jacket-compatibility-weighted shuffle** (jackets more likely when the top is jacket-compatible) — future tuning; reserve metadata room in the item schema now.
- **Calendar planning** — future; trivial once saved outfits exist.
- **Cross-device sync / backend / auth** — future; enabled by the `OutfitStore` interface.
- **Tags/notes on saved outfits** — not in v1.
- **Component/E2E tests** — not in v1.
