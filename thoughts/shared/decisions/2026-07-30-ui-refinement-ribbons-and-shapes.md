---
date: 2026-07-30
source: grill-to-decisions
input: Raw brief — UI rehaul/refinement: fix jagged paint lines, replace category dots, keep the aura, explore patterns/trims (plaid etc.) without overwhelming the pages; resolve whether detailing needs image assets or can be code-generated.
status: decided
---

# Design Decisions: UI refinement — ribbons, shape markers, and pattern detailing

## Decision 1: Aesthetic direction

**Context**: The app's visual language is "watercolor sketchbook" (washes, grain, paint dabs). Trims/plaid pull toward textile/haberdashery. Which wins?
**Options**: A — sketchbook stays the base, textile details as contained accents (small blast radius, keeps what Joyce likes) · B — lean into textile as the new identity (bigger, riskier rework).
**Decision**: **A.** Sketchbook base, textile accents in deliberate spots. The aura, paper grain, card washes, and quote blob all stay. Detailing lives on exactly two surface types this pass: page-title underlines and closet section headers. Cards, buttons, and the sidebar get no new detailing.

## Decision 2: All detailing is code-generated — no image assets, and no displacement filters

**Context**: The title paint line got pixelated because it runs through `filter: url(#sketchy)` (`ShufflePage.tsx:81`) — an `feTurbulence` + `feDisplacementMap` filter (`Layout.tsx:22-32`). Displacement mapping is a raster op: the browser rasterizes the 12px-tall SVG at layout size, shoves pixels ±1.5px with no anti-aliasing, and often rasterizes at 1x on retina. Jaggedness is structural to that technique, not a tuning problem.
**Options**: imported pattern images (fixed colors — fights the five-theme token system) · displacement filters (proven jagged) · pure vector geometry + CSS gradients (resolution-independent, theme-aware).
**Decision**: Everything is generated in code: inline SVG with `currentColor`/theme-var fills, and layered CSS gradients. Hand-drawn wobble is **baked into path geometry**, never applied via displacement filters. `feDisplacementMap` is banned on small elements; the `#sketchy` filter def in `Layout.tsx` is removed once its only consumer (the title underline) is replaced. Note: data-URI SVGs cannot read CSS vars — anything theme-tinted must be inline SVG (`currentColor`) or a CSS-mask-plus-background-color trick.

## Decision 3: Title underlines become a "ribbon family" — one per page

**Context**: The paint-stroke underline exists only on the Today page (`ShufflePage.tsx:77-99`). Joyce wants plaid/pattern experimentation, whimsy ("curly or wavy or frilly"), and per-page variety; all three pages have an h1 to hang a ribbon under.
**Options**: A — all three pages get plaid, varying only colorway/curl · B — a ribbon family: three related patterns, one per page.
**Decision**: **B.** Today = **wavy plaid ribbon** (the hero), Closet = **gingham ribbon**, Outfits = **candy-stripe ribbon**. Each page's ribbon differs in curl shape and colorway (which accent dominates). Rendering approach: gently wavy ribbon body with an axis-aligned pattern fill (SVG patterns fill in straight user space — a soft wave over a straight weave reads hand-sewn; tight curls would break the illusion, so waves stay gentle), plus **solid-color curled ends** drawn as separate paths (the "reverse side of the ribbon" illustration trick). Frilliness lives in the silhouette, not in warping the pattern. Ribbons replace the paint-stroke SVG on Today and are *added* under "the closet" (`ClosetPage.tsx:186-188`) and "saved outfits" (`OutfitsPage.tsx:35-37`).

## Decision 4: Category dots become a fixed shape iconography

**Context**: Joyce doesn't love the 8px `.watercolor-dot` markers next to rail labels (`Rail.tsx:227-232`) and closet section headers (`ClosetPage.tsx:214-218`). Replace, don't remove.
**Options**: remove entirely · tint the label text (hurts legibility at 11px uppercase) · replace with cute shapes.
**Decision**: Replace with solid watercolor-tinted shapes, **fixed mapping** so the same category always shows the same shape on both the shuffle rails and the closet headers: tops = **sun**, bottoms = **moon (crescent)**, dresses = **star**, jackets = **cloud**, shoes = **sparkle (4-point twinkle)**, accessories = **heart**. Markers grow from 8px to ~12px so silhouettes read; fills stay solid with the soft watercolor highlight the dots have now (no pattern inside — it can't read at that size). Inline SVG, `currentColor`, existing `CATEGORY_TINT` classes keep working.

## Decision 5: Theme-picker swatches become a uniform flower

**Context**: The picker dots (`ThemePicker.tsx:40-44` and `ThemePickerButton`, `ThemePicker.tsx:63-67`) are functionally swatches — color is the information. Joyce asked for the same shape treatment there.
**Options**: distinct shape per theme (falsely implies meaning) · one uniform shape, color varies.
**Decision**: One **5-petal flower** for all five swatches (and the mobile picker button). Visually distinct from the category shape set so the two systems don't blur. The `data-theme` re-scope trick is preserved — an inline SVG filled with `currentColor` resolves the re-scoped `--color-accent` exactly as the dot does.

## Decision 6: Every theme gains two secondary accent tokens

**Context**: A plaid woven from one accent is flat. Palette audit (`index.css:114-196`): Rosewood's aura trio (pink / soft yellow / sage) is a ready-made plaid ✓; Garden (moss/gold/teal) ~okay, could use a berry pop; Marmalade (apricot/gold/rose) is all-warm, wants a soft blue; Lavender (lilac/periwinkle/pink) is monochrome purple, needs butter yellow or sage; Sea Glass (seafoam/powder blue/pale green) is monochrome cool, needs sand or shell pink.
**Options**: reuse aura colors directly (fails for the monochrome themes) · ribbon-specific tokens (too narrow) · generic secondary accents.
**Decision**: Add `--color-accent-2` and `--color-accent-3` to the `@theme` defaults and all five `[data-theme]` blocks. Ribbons weave from accent + accent-2 + accent-3; future trims/stitches may draw on them too. Rosewood's values can start from its aura colors; Lavender, Sea Glass, Marmalade (and possibly Garden) get new hand-picked colors. Exact hexes are implementation-time choices under this constraint: **must weave a lively but soft plaid and harmonize with that theme's paper and ink.**

## Decision 7: Closet section headers get a running-stitch hairline

**Context**: Closet section headers are a tiny uppercase label + dot (`ClosetPage.tsx:213-222`); the header row is one of the two chosen detailing surfaces.
**Decision**: Alongside the new shape marker, a **faint running-stitch (dashed, slightly wobbly) hairline** trails from the label to the row's edge, at very low opacity (ink-hairline territory, ~`ink/10`). Gives the textile motif a quiet home and helps the page scan.

## Decision 8: Soften the quote-wash blob edge

**Context**: What read as a "strange paint line beneath the quote" is the `.quote-wash` blob's gradient edge (`index.css:277-292`) rendering harshly — there is no line element there.
**Decision**: Keep the blob; soften its edge (longer gradient falloff and/or more blur — planner's call on exact values). No new detailing in the sidebar beyond this fix.

## Codebase Findings

- Title underline SVG: `src/features/shuffle/ShufflePage.tsx:77-99`; the `#sketchy` filter def it references: `src/components/Layout.tsx:22-32`. The underline is the filter's **only** consumer — remove the def with it.
- `.watercolor-dot`: `src/index.css:200-214`; consumers: `src/components/Rail.tsx:227-232` (via `tintClass` prop, `Rail.tsx:18`), `src/features/closet/ClosetPage.tsx:214-218` (via `CATEGORY_TINT` from `railScale.ts`), `src/features/theme/ThemePicker.tsx:40-44` and `:63-67`.
- Current marker sizes: category dots `h-2 w-2` (8px), picker swatches `h-4 w-4` (16px in a 24px button).
- Theme token blocks: `@theme` defaults `src/index.css:3-24`; presets `src/index.css:114-196`. The picker's `data-theme` re-scope relies on these blocks being unlayered.
- Page titles to hang ribbons under: `ShufflePage.tsx:72-74`, `ClosetPage.tsx:186-188`, `OutfitsPage.tsx:35-37`.
- Quote blob: `.quote-wash::before`, `src/index.css:281-292` — `blur(6px)` + radial-gradient with `transparent 70%` stop; the short falloff is the harsh edge.
- Theme-awareness constraint for patterns: CSS gradients can use `var(--color-*)`; inline SVG can use `currentColor`; **data-URI SVG backgrounds cannot reference CSS vars** (would need the mask trick).
- The existing `--texture-grain` data-URI (`src/index.css:220`) is intentionally raster noise — unaffected by, and exempt from, the no-displacement rule.

## Out of Scope

- The aura — untouched, Joyce likes it as-is.
- Any detailing on outfit cards, closet tiles, buttons, or the paper-doll stage (deferred, revisit after this pass lands).
- Direction B (full textile identity shift) — explicitly not chosen.
- Theme-picker behavior/interaction — only the swatch visual changes.
- New theme presets — only new tokens within the existing five.
