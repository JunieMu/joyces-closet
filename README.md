# Joyce's Closet

A personal wardrobe app for planning what to wear. Shuffle a full outfit when you
can't decide, re-roll any single piece you don't like, save the combinations you
love, and dress the whole thing in one of five color themes.

> **Live:** _https://joyces-closet.vercel.app/_

Originally a plain HTML/CSS/JS project (2024), rebuilt from the ground up as a
typed, tested React app.

## Features

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
- **React Router** for the two routes
- **Zustand** for state (shuffle, saved outfits, theme)
- **Tailwind CSS v4**
- **Vitest** for unit tests
- Deployed on **Vercel**

## Getting started

```bash
npm install
npm run dev        # start the dev server (Vite)
```

Then open the URL Vite prints (default http://localhost:5173).

### Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the local dev server                |
| `npm run build`     | Type-check and build for production        |
| `npm run preview`   | Preview the production build locally       |
| `npm test`          | Run the test suite once (Vitest)           |
| `npm run test:watch`| Run tests in watch mode                    |
| `npm run lint`      | Lint with ESLint                           |
| `npm run typecheck` | Type-check without emitting                |
| `npm run format`    | Format with Prettier                       |

## Project structure

```
public/images/         Clothing PNGs, one folder per category
src/
  components/          Shared UI (Layout, Rail, OutfitActions, useCascade)
  features/
    closet/            The wardrobe manifest + item types
    shuffle/           Shuffle logic + the Shuffle page
    outfits/           Saved-outfit model, storage, and the Outfits page
    theme/             Theme presets, persistence, and the picker
  lib/                 RNG and the quote pool
  main.tsx             App entry + routing
```

The app is organized by **feature** rather than by file type — each folder under
`src/features/` owns its logic, UI, and tests together.

## Adding clothes

The wardrobe is a single data file: `src/features/closet/closet.ts`. To add an item:

1. Drop the PNG into `public/images/<category>/` (e.g. `public/images/tops/`).
2. Add one entry to the matching category array in `closet.ts`:

   ```ts
   {
     id: "top-shirt-7",
     name: "Shirt 7",
     category: "tops",
     image: "/images/tops/shirt7.png",
   }
   ```

Categories are `tops`, `bottoms`, `dresses`, `jackets`, `shoes`, and
`accessories`. Everything downstream — shuffling, the rails, saved-outfit
validation — reads from this one manifest, so no other file needs to change.
Dresses work the same way: the code already handles them, so dropping in dress
images plus their entries activates that part of the UI.

## How shuffling works

Outfit generation lives in `src/features/shuffle/shuffle.ts` as pure functions
driven by a seedable RNG (so the logic is fully testable). An outfit is:

- a **base** — either separates (top + bottom) or a single dress,
- an **optional jacket**, a **required pair of shoes**, and an **optional accessory**.

Optional slots include a "none" outcome, so not every outfit comes with a jacket
or accessory — matching how you'd actually get dressed.

## Data & persistence

Saved outfits and the selected theme live in the browser's `localStorage`. Storage
goes through small interfaces (`OutfitStore`, theme read/write), so swapping to a
real backend later means writing one new implementation — the UI doesn't change.
Stored outfits are also validated and repaired on load, so deleting an item from
the closet never leaves a saved outfit showing a broken image.

## Tests

48 unit tests across shuffle logic, the closet manifest, outfit storage, naming,
theme persistence, and quotes:

```bash
npm test
```

## Author

Joyce Ma — [github.com/JunieMu](https://github.com/JunieMu)
