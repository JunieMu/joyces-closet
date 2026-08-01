# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Vite dev server (http://localhost:5173)
npm test              # run all tests once (vitest run)
npm run test:watch    # tests in watch mode
npx vitest run src/features/shuffle/shuffle.test.ts   # single test file
npx vitest run src/features/shuffle/shuffle.test.ts -t "name"  # single test by name
npm run typecheck     # tsc -b --noEmit
npm run lint          # eslint
npm run format        # prettier --write . (thoughts/ is ignored)
npm run build         # tsc -b && vite build
```

## What this is

A client-only React 19 SPA (Vite, TypeScript, Tailwind v4, React Router, Zustand) — a personal wardrobe app: upload photos of clothes, shuffle them into outfits, save favorites. There is **no backend**: uploaded image blobs live in IndexedDB, saved outfits and theme in localStorage, so all data is per-browser. Deployed on Vercel; `vercel.json` rewrites every path to `index.html`.

Code is organized by feature under `src/features/` (`closet`, `uploads`, `shuffle`, `outfits`, `theme`), with shared UI in `src/components/` and the seedable RNG + quotes in `src/lib/`.

## Load-bearing startup order

- An inline script in `index.html` applies the persisted theme (`data-theme` attribute) before first paint.
- `src/main.tsx` awaits `hydrateCloset()` and only then **dynamically** imports `src/app.tsx`. This ordering is required because `useShuffleStore` shuffles from the closet at module-init time; converting that dynamic import to a static one silently breaks hydration.

## State & persistence pattern

- Storage sits behind small interfaces — `UploadStore` (`src/features/uploads/store.ts`, IndexedDB) and `OutfitStore` (`src/features/outfits/store.ts`, localStorage), plus theme read/write. UI and stores never touch storage APIs directly; a backend swap means writing one new implementation.
- Zustand stores mirror storage into React and deliberately **do not** use persist middleware. The write order is: persist first, then update the store — a rejected write (e.g. quota) propagates to the caller with the UI untouched. Follow this pattern (`useClosetStore.addUpload`, `useOutfitsStore`) for anything new that persists.
- Exception: `useShuffleStore` persists the current outfit with `persist` + a validating `merge` that discards outfits referencing deleted items.
- `useShuffleStore` subscribes to `useClosetStore` (bottom of `useShuffleStore.ts`) and re-validates/repairs the outfit on every closet change. `outfit === null` ("the closet can't dress anyone") is an ordinary state, not an error — the shuffle page renders what's missing instead.
- `ClosetItem.image` is an object URL minted in `toClosetItem` and revoked only in `removeUpload` — the one lifecycle that leaks if forgotten.
- Outfit shape: a base (top + bottom `separates` **or** a single `dress`), required shoes, optional jacket/accessory. Categories: `tops`, `bottoms`, `dresses`, `jackets`, `shoes`, `accessories`.

## Upload pipeline (`src/features/uploads/pipeline/`)

detect (alpha-channel inspection; transparent PNGs skip removal) → background removal in a Web Worker (`removal.worker.ts` — Transformers.js/onnxruntime live in their own chunk, fetched only on the first opaque upload) → normalize (trim to bounding box, scale to per-category fill target, composite onto a 1080-wide canvas; bottoms are waist-anchored and get a 1080×2000 canvas when full-length) → save PNG blob to IndexedDB keyed by `crypto.randomUUID()`.

## Tests

Vitest with `environment: "node"`, picking up only `src/**/*.test.ts` — domain logic only, no DOM or component tests, by design. Testability comes from injection: shuffle logic takes a seedable RNG (`src/lib/rng.ts`), stores take in-memory storage implementations (`memoryUploadStore`, the localStorage-backed store tested against a fake). Keep new logic in pure functions/injected dependencies so it stays testable this way.

## Design docs (`thoughts/`)

`thoughts/shared/{research,plans,decisions}/` hold the research, implementation plans, and numbered design decisions behind each feature; code comments cite them (e.g. "Decision 8" in `main.tsx`). The `.claude/commands` workflow (research_codebase → create_plan → implement_plan → commit) reads and writes these docs. They are historical snapshots — e.g. older decisions reference 34 built-in items, but built-ins were since removed and the closet is uploads-only.
