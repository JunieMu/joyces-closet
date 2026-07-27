# Joyce's Closet

A personal wardrobe app for planning what to wear. Shuffle a full outfit when you
can't decide, re-roll any single piece you don't like, save the combinations you
love, and dress the whole thing in one of five color themes.

> **Live:** _https://joyces-closet.vercel.app/_

Originally a plain HTML/CSS/JS project (2024), rebuilt from the ground up as a
typed, tested React app.

## Features

- **Upload your own clothes** — the closet is whatever you put in it. Photograph a
  piece, and it's cut out, sized to the paper-doll canvas, and dropped into the
  shuffle. Rename or delete anything from the closet page.
- **Shuffle** — generate a complete outfit (base + optional jacket, shoes, optional
  accessory) with one tap.
- **Per-slot re-roll** — happy with the top but not the shoes? Re-roll just that
  slot; everything else stays put.
- **Separates or dresses** — a "base" is either a top + bottom **or** a single
  dress. The picker is pool-proportional, so dresses show up in proportion to how
  many you own (and never when you own none).
- **Save outfits** — keep favorites, auto-named like `Outfit · Jul 13` unless you
  name them yourself. Saved to your browser, so they persist between visits.
- **Themes** — five presets (Rosewood, Lavender Dusk, Garden, Sea Glass,
  Marmalade), applied before first paint so there's no color flash on load.
- **Daily quote** — a rotating style quote on the shuffle page.

## Tech stack

- **React 19** + **TypeScript**
- **Vite** (build/dev)
- **React Router** for the three routes
- **Zustand** for state (closet, shuffle, saved outfits, theme)
- **Tailwind CSS v4**
- **IndexedDB** for uploaded image blobs, **localStorage** for outfits and theme
- **@huggingface/transformers** for in-browser background removal, lazy-loaded in a
  worker and only fetched when an opaque photo is actually uploaded
- **Vitest** for unit tests
- Deployed on **Vercel**

## Getting started

```bash
npm install
npm run dev        # start the dev server (Vite)
```

Then open the URL Vite prints (default http://localhost:5173).

### Scripts

| Command              | What it does                         |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start the local dev server           |
| `npm run build`      | Type-check and build for production  |
| `npm run preview`    | Preview the production build locally |
| `npm test`           | Run the test suite once (Vitest)     |
| `npm run test:watch` | Run tests in watch mode              |
| `npm run lint`       | Lint with ESLint                     |
| `npm run typecheck`  | Type-check without emitting          |
| `npm run format`     | Format with Prettier                 |

## Project structure

```
src/
  components/          Shared UI (Layout, Rail, OutfitActions, useCascade)
  features/
    closet/            The closet store, item types, and the Closet page
    uploads/           Upload flow, image pipeline, and the IndexedDB store
    shuffle/           Shuffle logic + the Shuffle page
    outfits/           Saved-outfit model, storage, and the Outfits page
    theme/             Theme presets, persistence, and the picker
  lib/                 RNG and the quote pool
  main.tsx             Hydrates the closet, then mounts the app
  app.tsx              Routing + mount
```

The app is organized by **feature** rather than by file type — each folder under
`src/features/` owns its logic, UI, and tests together.

## Adding clothes

Everything comes in through the app — there is no checked-in wardrobe to edit.
Open **closet → Add an item**, pick a photo, choose a category, and save. The
pipeline (`src/features/uploads/pipeline/`) does the rest:

1. **Detect** — inspects the alpha channel. An already-transparent PNG skips
   straight to step 3.
2. **Cut out** — an opaque photo goes through in-browser background removal in a
   worker (the model is fetched on first use only).
3. **Normalize** — trims to the garment's bounding box, scales it to the
   per-category fill target, and composites it onto the standard 1080-wide
   canvas, waist-anchored for bottoms. Bottoms get a 1080×2000 canvas when the
   cutout looks full-length, with a toggle in the preview to override.
4. **Save** — a PNG blob in IndexedDB, keyed by a UUID.

Categories are `tops`, `bottoms`, `dresses`, `jackets`, `shoes`, and
`accessories`. Everything downstream — shuffling, the rails, saved-outfit
validation — reads from the closet store, so nothing else needs to change. That
includes dresses: uploading your first one activates the separates/dress toggle,
the merged dress rail, and dresses in the shuffle pool.

An outfit needs a base (a top **and** a bottom, or a dress) plus shoes. Until the
closet holds that much, the shuffle page shows what's still missing instead.

## How shuffling works

Outfit generation lives in `src/features/shuffle/shuffle.ts` as pure functions
driven by a seedable RNG (so the logic is fully testable). An outfit is:

- a **base** — either separates (top + bottom) or a single dress,
- an **optional jacket**, a **required pair of shoes**, and an **optional accessory**.

Optional slots include a "none" outcome, so not every outfit comes with a jacket
or accessory — matching how you'd actually get dressed.

Because every item is deletable, "the closet can't dress anyone" is an ordinary
state rather than an error: `shuffleOutfit` returns `null`, and `missingForOutfit`
says which categories are still empty. The shuffle store re-validates whenever the
closet changes, so deleting your last pair of shoes drops you back to the empty
state instead of throwing.

## Data & persistence

Uploaded images live in **IndexedDB** (blobs are far too large for `localStorage`);
saved outfits and the selected theme live in `localStorage`. Storage goes through
small interfaces (`UploadStore`, `OutfitStore`, theme read/write), so swapping to a
real backend later means writing one new implementation — the UI doesn't change.
This also means the closet is per-browser: uploads on your phone won't appear on
your laptop.

Stored outfits are validated and repaired on load, so deleting an item from the
closet never leaves a saved outfit showing a broken image — the card renders
without the missing piece and says so.

Because browser storage is per-origin and evictable, the closet page has **export
backup** and **import backup**: one JSON file carrying every uploaded image plus
every saved outfit. Import merges by id, so re-importing the same file adds
nothing. This is the only way a closet moves between devices — or survives moving
the app to a different domain, since `*.vercel.app` and a custom domain are
separate origins with separate IndexedDB. After the first upload the app also
calls `navigator.storage.persist()`, which asks the browser not to evict the
closet automatically; it's insurance, not a guarantee, and refusal changes
nothing.

## Tests

193 unit tests across shuffle logic, the closet store, the image pipeline, backup
encoding, upload and outfit storage, naming, theme persistence, and quotes:

```bash
npm test
```

## Author

Joyce Ma — [github.com/JunieMu](https://github.com/JunieMu)
