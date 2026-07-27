---
date: 2026-07-13
source: grill-to-decisions
input: Complete UI redesign of the closet planning app — spacing, colors, button shapes, fonts (Fraunces headers, Work Sans body), carousel placement, sidebar, nav, quotes, animation. Goal is a cohesive, polished, real-app feel. Functionality unchanged.
status: decided
---

# Design Decisions: UI Redesign — Warm Editorial Boutique

## Decision 1: Aesthetic direction

**Context**: Current look is pastel dollhouse — blush header, rose outlined pills, periwinkle headings (`src/index.css:3-13`). User wants "real app" polish; Fraunces pulls editorial.
**Options**: A — warm editorial boutique (ivory bg, ink-brown text, one rose accent) · B — polished pastel (keep blush/periwinkle, refine) · C — dark dressing-room.
**Decision**: **A — warm editorial boutique**, keeping a rose/blush accent so it still reads as Joyce's. Generous whitespace, thin rules/dividers, magazine feel.

## Decision 2: Typography

**Context**: Currently Playfair Display + Montserrat via Google Fonts link (`index.html:10-13`).
**Decision**: **Fraunces for headings/display, Work Sans for body** (user's explicit choice). Swap the Google Fonts `<link>` and the `--font-display`/`--font-body` tokens. Load Fraunces with italic axis (used for quotes).

## Decision 3: Palette

**Options**: A — rosewood monochrome-warm · B — same plus muted slate-periwinkle secondary accent.
**Decision**: **A — rosewood monochrome-warm, periwinkle is dropped entirely.** Working values (all as Tailwind `@theme` tokens, tweakable later):
- Background: warm ivory `#FAF6F0`
- Text: deep espresso-plum `#3D2E2E`
- Accent: dusty rosewood `#B05E5E` (matured version of current rose `#cf7878`)
- Soft fill/hover tint: blush `#F3E2E0`
- Plus derived warm-neutral hairline-border and muted-text tones as needed.
One accent family, used consistently — this is the core cohesion move.

## Decision 4: Layout architecture — sidebar replaces top nav (desktop)

**Context**: Current nav is a blush top bar with two links (`src/components/Layout.tsx:11-25`); action buttons sit on the canvas.
**Options**: A — left sidebar as control panel · B — refined top nav only.
**Decision**: **A — persistent left sidebar on desktop.** Top-to-bottom: "Joyce's Closet" brand (Fraunces) → nav links **Today** (renamed from "Home") and **Outfits** → divider → action block (Shuffle All, Save Outfit, and the separates/dress toggle when dresses exist) → flexible space → daily quote footer. The main canvas holds only the outfit.

## Decision 5: Mobile collapse of the sidebar

**Options**: A — slim top bar (brand + nav) + sticky bottom action bar · B — slim top bar + actions inline above rails.
**Decision**: **A.** On mobile: slim top header with brand + nav; Shuffle All / Save Outfit live in a sticky bottom action bar, always thumb-reachable. Desktop is the primary target but mobile stays fully supported (swipe-to-browse on rails is kept).

## Decision 6: Shuffle canvas — paper-doll composition

**Context**: Rails currently sit in an even 2-col grid (`src/features/shuffle/ShufflePage.tsx:135`), reading as "list of widgets." The saved-outfit cards already draw a mini paper doll (`src/features/outfits/OutfitCard.tsx:32-70`) — the canvas should match.
**Options**: A — paper-doll composition · B — refined grid with card shelves.
**Decision**: **A.** Dominant center column stacked like a body: top → bottom → shoes; jacket flanks the top, accessory sits near the shoes. In dress mode the top+bottom slots merge into one tall dress slot (existing conditional behavior in `ShufflePage.tsx:136-157` is preserved, still dormant until dresses exist).

## Decision 7: Rail chrome

**Context**: Big always-on periwinkle `‹ ›` text arrows (`src/components/Rail.tsx:18-20`) plus six labeled "Shuffle X" pill buttons (`Rail.tsx:101-107`) = visual noise.
**Options**: A — quiet chrome (slim low-opacity circular arrows, strengthen on hover; per-rail shuffle becomes a small icon button by the rail label) · B — hover-only chrome.
**Decision**: **A — quiet, always-visible chrome.** Discoverability beats hiding in a tool used half-awake. Arrows always visible on mobile; swipe stays.

## Decision 8: Headline & date

**Decision**: Keep **"What am I wearing today?"** as the big Fraunces canvas headline, with the actual date as a small subline (e.g. "Sunday, July 13").

## Decision 9: Shape & button hierarchy

**Context**: Everything is currently an outlined pill — no action reads as primary.
**Decision**: Two-shape system — **pills for actions, soft rectangles for surfaces**:
- Primary (Shuffle All): solid rosewood pill, ivory text — the one loud element.
- Secondary (Save Outfit, load/wear): quiet outlined or tinted pill.
- Tertiary (per-rail shuffle, delete, cancel): small icon-only ghost buttons.
- Surfaces (cards, rails, sidebar, popover): `rounded-2xl`, hairline warm-neutral borders, very soft shadows.

## Decision 10: Save flow

**Context**: The naming form currently injects above the rails and reflows the whole canvas (`ShufflePage.tsx:73-107`).
**Options**: popover anchored to the Save button · centered modal.
**Decision**: **Popover/panel anchored to the Save button** — in the sidebar on desktop, rising from the bottom action bar on mobile. The canvas never reflows. Keep the default-name prefill and "Saved ✓" feedback behavior.

## Decision 11: Animation scope

**Options**: tier 1 micro-interactions · tier 2 shuffle/swap animation · tier 3 route transitions + ambient decoration.
**Decision**: **Tiers 1 + 2, CSS-first, no framer-motion (or any new dependency).**
- Tier 1: hover/press states, card lift, smooth color/shadow transitions everywhere.
- Tier 2: arrow/shuffle swaps slide/crossfade the item in; **Shuffle All staggers the rails** so the outfit cascades into place — this is the signature delight moment.
Tier 3 explicitly skipped.

## Decision 12: Quotes

**Decision**: A small italic Fraunces quote as the sidebar footer (above nothing — it IS the footer), rotating **daily and deterministically by date** (seeded RNG exists in `src/lib/rng.ts`). Content is a **mix of real fashion-icon quotes and playful invented one-liners**, stored in **one easily-editable array in its own file** — user plans to swap in personal custom quotes later, so editing must be a one-file change. Invented lines carry no attribution; real ones get a short attribution.

## Decision 13: Scope guardrails

**Decision**: **UI-only.** Zero behavior changes: shuffle logic, stores, localStorage persistence, outfit repair, saving/deleting all untouched. Both pages (Today + Outfits) redesigned. Existing logic tests (`shuffle.test.ts`, `closet.test.ts`, `naming.test.ts`, `localStorageStore.test.ts`) must keep passing unmodified.

## Codebase Findings

- Tailwind 4 with `@theme` tokens in `src/index.css:3-13` — palette/fonts are already centralized; redesign slots in cleanly there.
- Fonts load via Google Fonts `<link>` in `index.html:10-13` — swap to Fraunces + Work Sans (include Fraunces italic for quotes).
- Stack: React 19, react-router 8, Zustand 5, Vite 8, Tailwind 4. No animation or icon library installed; decisions above require adding none.
- `Rail.tsx` owns arrows, swipe (threshold at `Rail.tsx:16`), wrap-around stepping, and the "No {label}" dashed empty slot for optional rails — all behavior to preserve under new chrome.
- Per-slot sizing lives in the `SIZE` map at `ShufflePage.tsx:10-14`; the paper-doll layout replaces this proportion system.
- `OutfitCard.tsx` delete button is an always-visible `×` (`OutfitCard.tsx:82-89`); restyle as tertiary ghost per Decision 9 (hover-reveal on desktop is fine, must stay reachable on touch).
- `dist/` is committed build output — never hand-edit; it regenerates on `npm run build`.
- The dress/separates toggle (`ShufflePage.tsx:110-133`) is dormant (no dresses in the closet yet) but must remain functional and get the new styling.

## Out of Scope

- Dark mode.
- Any behavior/logic changes, new features, or closet-content changes.
- Route/page transitions and ambient floating decoration (animation tier 3).
- New dependencies (framer-motion, icon packs, etc.).
- Enabling the dress feature (stays dormant until dresses exist).
- Favicon / meta / PWA polish.
