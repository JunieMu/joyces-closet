---
date: 2026-07-17
source: grill-to-decisions
input: Polish/enhance the UI — more colors and color schemes, watercolor/aura/sketchy-painty artistic treatments, ambient animation, plus a color theme picker for experimenting with palettes. Builds on the 2026-07-13 warm-editorial-boutique redesign.
status: decided
---

# Design Decisions: Artistic Polish — Watercolor Sketchbook + Theme Picker

## Decision 1: Artistic direction

**Context**: The warm-editorial-boutique redesign (thoughts/shared/decisions/2026-07-13-ui-redesign.md) is clean but reads as plain — one accent, zero texture, no ambient motion. Tier-3 ambient decoration was deferred there; this project reopens it deliberately.
**Options**: A — fashion-sketchbook/atelier (watercolor washes, paint swatches, sketchy hand-drawn lines) · B — dreamy aura (large drifting blurred gradient blobs, ethereal) · C — hybrid.
**Decision**: **C, weighted toward A.** Sketchbook is the soul of the app (paper-doll ⇒ fashion illustrator's workbook, fits Fraunces and the warm palette); a single soft aura-style ambient gradient lives behind the paper-doll canvas as the "stage light." The app should feel like an art object, not a document — but with one living element, not decoration everywhere.

## Decision 2: Color story — per-category hues, one primary action color

**Context**: Current palette is rosewood-monochrome (`src/index.css:3-8`). A closet app is *about* color and categories.
**Options**: A — rosewood stays the only functional accent, new hues decorative-only · B — multi-accent: each garment category gets its own muted hue used in labels/swatches/washes.
**Decision**: **B, with heavily muted watercolor-tone hues.** Each category (tops, bottoms, jackets, shoes, accessories, dresses) gets its own soft tint — informational, not just decorative. **Rosewood (the theme primary) remains the only action color**: buttons, links, active nav, focus states — so the button hierarchy from Decision 9 of the prior redesign survives intact. Category tints must stay muted enough to avoid a sticker-chart look; exact values are re-derived per theme (Decision 5).

## Decision 3: Implementation constraint — pure code, no new dependencies or assets

**Options**: A — CSS/SVG only (inline `feTurbulence` filters, layered gradients, blur) · B — allow static watercolor PNG/SVG assets in `public/`.
**Decision**: **A.** All texture and painterly effects via CSS gradients + inline SVG filters — no libraries, no decorative asset files. Revisit only if the result isn't lush enough. This keeps every color themable via tokens (assets would bake colors in).

## Decision 4: Theme picker — real user-facing feature

**Context**: User wants to experiment with different palettes. This forces the right architecture anyway: every color becomes a swappable token, nothing hard-coded.
**Options**: A — real feature, quietly placed · B — dev-only panel (query param / shortcut).
**Decision**: **A.** A small row of theme swatches (watercolor dots) — in the desktop sidebar footer area and reachable on mobile (e.g. via the header). Selection **persists in localStorage**. Picking a palette for the app is on-theme for an app about picking outfits.

## Decision 5: Themes are curated presets, not a freeform editor

**Options**: A — 4–6 named preset palettes, each a complete designed token set · B — freeform per-token color picker.
**Decision**: **A.** Every theme is a full token set: background, ink, primary accent, soft fill, the category tints, aura/wash colors. Preset lineup (names and exact hex values are drafts — planner may refine, user approves final values):

1. **Rosewood** — current warm ivory / espresso-plum / rosewood; becomes theme zero and the default
2. **Lavender dusk** — pale lilac paper, plum ink, wisteria accent
3. **Garden** — warm cream, moss-green accent, botanical tints
4. **Sea glass** — cool off-white, dusty teal/blue accent
5. **Marmalade** — apricot-cream paper, terracotta accent

All presets stay warm-muted-watercolor in spirit. A custom editor can bolt on later; the token architecture is identical either way.

## Decision 6: No dark theme in v1

**Context**: Dark mode was out of scope in the prior redesign. A dark preset is not just swapped tokens — hairlines, shadows, wash opacities, and the white card surfaces all need re-judging, and garment PNGs assume light backgrounds.
**Decision**: **All v1 presets are light.** Dark becomes its own small project later, made cheap by the token architecture.

## Decision 7: Placement map — where texture, color, and motion live

**Decision**: Approved as proposed:

- **Page background**: whisper-subtle paper grain (SVG turbulence, very low opacity) — the "sketchbook page."
- **Behind the paper-doll canvas**: one large soft watercolor aura (theme-tinted, 2–3 blended blobs), breathing on a slow ~20s cycle, gently re-blooming on Shuffle All. This is the ambient centerpiece and the only ambient motion in the app.
- **Headline**: hand-painted brush-stroke underline swash beneath "what am i wearing today?" in the theme primary.
- **Rail labels**: each category label gets a small watercolor swatch dot in its category tint — where the per-category hues live (`src/components/Rail.tsx:107`).
- **Empty "none" slots**: dashed border (`src/components/Rail.tsx:153`) becomes a sketchy hand-drawn border (SVG filter).
- **Sidebar quote**: sits on a faint watercolor wash blob.
- **Outfit cards**: paper texture + soft category-tint wash on the top edge; hover lift gains a slightly painterly shadow.
- **Buttons**: Shuffle All stays solid theme-primary; subtle painterly texture overlay on hover.
- **No floating particles/sparkles anywhere.** Reduced-motion users get a static aura — the existing global media query (`src/index.css:46-54`) already freezes animations.

## Codebase Findings

- Tailwind 4 `@theme` tokens centralize palette/fonts in `src/index.css:3-16` — theme switching can override these CSS custom properties per `data-theme` attribute; utilities like `bg-ivory`/`text-ink` resolve through the vars, so existing class usage keeps working. Token *names* are currently literal (`--color-ivory`, `--color-rosewood`); the planner should decide whether to keep them as-is (themes reassign their values) or rename to semantic roles (`--color-paper`, `--color-accent`) — semantic renaming touches every component but reads honestly under non-rosewood themes.
- Persistence pattern to copy: Zustand store + localStorage in `src/features/outfits/localStorageStore.ts` / `useOutfitsStore.ts`; theme choice should follow the same idiom.
- Existing animation tokens (`--animate-rail-in`, `--animate-pop-in`) live in `src/index.css:13-37`; the aura breathing animation joins them. Global reduced-motion kill switch already exists (`src/index.css:46-54`).
- The paper-doll canvas the aura sits behind is the `.paper-doll` grid (`src/index.css:57-79`, rendered at `src/features/shuffle/ShufflePage.tsx:52`); Shuffle All already bumps a cascade tick (`src/components/useCascade.ts`) the aura re-bloom can subscribe to.
- Rail labels and empty slots to decorate: `src/components/Rail.tsx:107` (label span), `Rail.tsx:153` (dashed empty slot).
- Outfit cards: white surfaces at `src/features/outfits/OutfitCard.tsx:81`.
- Sidebar quote footer: `src/components/Layout.tsx:40-49`; mobile header (theme picker reachability): `Layout.tsx:53-65`.
- No decorative assets exist; `public/` holds only garment images. Stack unchanged: React 19, react-router 8, Zustand 5, Vite 8, Tailwind 4, zero animation/icon libraries.
- `dist/` is committed build output — regenerate via `npm run build`, never hand-edit.

## Out of Scope

- Dark theme (Decision 6) — later project.
- Freeform custom color editor — presets only in v1.
- Decorative asset files or new dependencies (Decision 3).
- Floating particles, sparkles, route/page transitions.
- Any behavior/logic changes: shuffle, stores, persistence of outfits, repair — all untouched. Existing tests must keep passing unmodified.
- Garment image re-processing or closet content changes.
