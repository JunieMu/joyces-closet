---
date: 2026-07-31T13:39:20-05:00
researcher: Joyce Ma
git_commit: 1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c
branch: main
repository: joyces-closet
topic: "Calendar planning system — assigning saved outfits to days of the week / days of the month"
tags: [research, codebase, calendar, planning, outfits, persistence, routing]
status: complete
last_updated: 2026-07-31
last_updated_by: Joyce Ma
---

# Research: Calendar Outfit Planning

**Date**: 2026-07-31T13:39:20-05:00
**Researcher**: Joyce Ma
**Git Commit**: `1fcae0e471aa8aea4f9dd2a87b633cafff6fff5c`
**Branch**: `main`
**Repository**: joyces-closet

> **Note on references**: the working tree has 28 uncommitted/untracked files at time of research (including `Ribbon.tsx`, `CategoryShape.tsx`, `ConfirmDelete.tsx`, `RunningStitch.tsx`, which do not exist at the cited commit). Line numbers below refer to the **local working tree**, not to GitHub at `1fcae0e`. Permalinks are deliberately omitted for that reason.

## Research Question

Create a calendar planning system where the user can save outfits and plan which day of the week or day of the month they want to wear each one. How would this plug into the existing codebase?

## Summary

**This is the feature the app was designed to grow into.** It is named four separate times in the founding design docs as deferred-but-planned, and the architecture was shaped around it:

> "v1 = A + C... **Data model must be designed so B and D bolt on cleanly later.**"
> — `thoughts/shared/decisions/2026-07-13-closet-rebuild.md:10-14` (Decision 1; D = calendar planning)

> "**react-router from day one**... Establishes where closet-manager and **calendar pages land later**."
> — same doc, Decision 4, `:31`

> "Calendar planning — future; **trivial once saved outfits exist.**"
> — same doc, Out of Scope, `:80`

> "Future migrations enabled, not performed: ... **calendar (consumes `SavedOutfit`)**."
> — `thoughts/shared/plans/2026-07-13-closet-rebuild.md:457`

The mechanical plumbing genuinely is close to trivial — a fourth route, a fourth nav entry in both navs, one new localStorage-backed store cloned almost verbatim from `OutfitStore`, and no changes to `main.tsx`, hydration, IndexedDB, or the shuffle/closet stores. Roughly a day's work if nothing else were in play.

**The hard parts are not plumbing.** Four things are genuinely undecided and cost more than the wiring:

1. **"Day of week" and "day of month" are two different data models**, not two views of one. Weekday is a bounded 7-slot recurring rotation; date is an unbounded growing log needing a month grid and a policy for the past. Supporting both is possible and has a clean house precedent (a discriminated union, exactly like `OutfitBase`) — but it is a decision, not a detail.
2. **Second-order dangling references are new territory.** Today's references are one hop (`Outfit` → `ClosetItem`), and `repairOutfit` handles the hole. A plan entry is two hops (`Plan` → `SavedOutfit` → `ClosetItem`), and there is no repair machinery at the outer level, no cascade anywhere in the app, and no `useSavedOutfit(id)` resolve seam yet.
3. **A month grid on a 375px phone is narrower than any surface this app has ever laid out.** The tightest existing surface is a closet tile at ~110–160px (`grid-cols-3`); a 7-column month grid gives ~45px cells. Mobile-first is Decision 9 and non-negotiable.
4. **The ribbon family is exactly three, one per page**, by explicit decision. A fourth page needs a fourth hand-authored SVG weave.

Also worth flagging early: **the backup format does not carry plans**, and the version-gating rules mean "add plans to backups" has a real forward/backward-compatibility fork (see [Backup format impact](#backup-format-impact)).

## Detailed Findings

### The persistence pattern to clone

`SavedOutfit`/`OutfitStore` is the exact template, and it is small enough to quote in full.

The interface — `src/features/outfits/store.ts:3-19`:

```ts
export interface SavedOutfit {
  id: string;
  name: string;
  createdAt: string; // ISO
  outfit: Outfit;
}

/**
 * The only way saved outfits are persisted (Decision 6). The UI never touches a
 * storage API directly, so moving to a backend means writing one more implementation
 * of this interface — nothing else changes.
 */
export interface OutfitStore {
  list(): SavedOutfit[];
  save(outfit: SavedOutfit): void;
  delete(id: string): void;
}
```

The localStorage implementation — `src/features/outfits/localStorageStore.ts` — establishes three conventions a plan store must copy:

- **Injectable storage**: `createLocalStorageOutfitStore(storage: StorageLike = window.localStorage)` at `:19-21`, where `StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">` at `:6`. This is the *only* reason the store is testable under `environment: "node"`.
- **Reads never throw**: `:22-39`. Missing key, corrupt JSON, wrong shape — all degrade to `[]`. Two sibling readers cite this by line number (`indexedDbStore.ts:103`, `backup.ts:120-121`).
- **Whole-array rewrite, not append**: `write()` at `:41-43` serializes the full list, which is what lets `localStorageStore.test.ts:116-123` assert "recovers from corrupt storage on the next save".

The zustand mirror — `src/features/outfits/useOutfitsStore.ts:8-10, 20-40`:

```ts
// The one place that picks an OutfitStore implementation. Swapping in a backend-backed
// store (Decision 6) means changing this line and nothing else.
const outfitStore: OutfitStore = createLocalStorageOutfitStore();

/**
 * A view over the OutfitStore — deliberately no persist middleware: persistence is the
 * store's job, this just mirrors it into React.
 */
export const useOutfitsStore = create<OutfitsState>()((set) => ({
  saved: outfitStore.list(),

  saveOutfit: (name, outfit) => {
    outfitStore.save({ /* ... */ });
    set({ saved: outfitStore.list() });   // ← re-read from storage, never computed locally
  },
```

Note the mirror is refreshed by **re-reading storage**, not by locally mutating the array — so store and React cannot drift.

**Storage key convention** — `joyces-closet:<domain>:v<n>`. The four keys in existence:

| Key | Medium | Declared at |
|---|---|---|
| `joyces-closet:uploads:v1` | IndexedDB DB name | `src/features/uploads/indexedDbStore.ts:4` |
| `joyces-closet:saved-outfits:v1` | localStorage | `src/features/outfits/localStorageStore.ts:4` |
| `joyces-closet:theme:v1` | localStorage (raw string, not JSON) | `src/features/theme/themeStorage.ts:3` |
| `joyces-closet:current-outfit` | localStorage (zustand `persist`) | `src/features/shuffle/useShuffleStore.ts:106` |

A plan store lands at `joyces-closet:plan:v1`. A version bump means a *new key* — there is no migration code anywhere in the repo, old data is orphaned by design.

**Startup impact: none.** Because localStorage is synchronous, a plan store seeds itself at module-init (`planStore.list()` inline in `create()`), exactly like `useOutfitsStore.ts:25` and `useThemeStore.ts:15-16`. It needs **no** hook in `main.tsx` and cannot disturb the load-bearing hydration ordering. Only an IndexedDB-backed store would force a change to `main.tsx:13-21`, and there is no reason for a plan to need IndexedDB — the records are a few dozen bytes each.

### The reference model — ids are the contract

The governing principle, stated in prior research (`thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md:136`):

> **Ids are the contract, images are ephemeral.**

`Outfit` (`src/features/shuffle/outfit.ts:3-13`) stores **only ids** — never item objects, never images:

```ts
/** (top + bottom) XOR (dress) — a dress is a full-body item filling both slots (Decision 7). */
export type OutfitBase =
  | { kind: "separates"; topId: string; bottomId: string }
  | { kind: "dress"; dressId: string };

export interface Outfit {
  base: OutfitBase;
  jacketId: string | null;
  shoesId: string;
  accessoryId: string | null;
}
```

Because nothing is denormalized alongside an id, `renameUpload` (`useClosetStore.ts:59-77`) needs zero outfit updates, and deletion cannot corrupt anything.

Resolution happens **at the render edge**, through a hook that takes `null` deliberately so callers stay branch-free — `src/features/closet/closet.ts:26-30`:

```ts
export function useClosetItem(id: string | null): ClosetItem | undefined {
  return useClosetStore((state) => (id === null ? undefined : state.itemsById.get(id)));
}
```

A dead id resolves to `undefined`, and the render-or-vanish component returns `null` rather than a broken image — `src/features/outfits/OutfitCard.tsx:62-80`.

**Critically: nothing in this app ever cascades a delete.** `useClosetStore.removeUpload` (`:45-57`) deletes the blob, revokes the object URL, re-derives the closet — and never touches saved outfits. Saved outfits keep dangling ids in localStorage **forever**; repair is applied only to a *transient copy* when an outfit is loaded onto the shuffle page (`OutfitsPage.tsx:26-33`). This is deliberate — `thoughts/shared/decisions/2026-07-27-clothing-image-upload.md:73`:

> **Deletion semantics**: no bespoke handling for uploads referenced by saved outfits — existing validation/repair (`isOutfitValid`/`repairOutfit`) and the "Some items are no longer in the closet" caption already cover it.

Instead of cascading, the app **warns before the delete and degrades after it**. The warning idiom — `src/features/closet/ClosetPage.tsx:51-56`:

```ts
// This delete is irreversible — the blob goes and the object URL is revoked — so the
// confirmation says what it will cost (Decision 4).
const wornIn = saved.filter((entry) => outfitUsesItem(entry.outfit, item.id)).length;
```

rendered as `worn in 3 outfits` on the confirm layer (`ClosetPage.tsx:148-152`). The degradation idiom — `OutfitCard.tsx:210-214`:

```tsx
{!complete && (
  <p className="font-body text-accent/70 mt-1 text-xs italic">
    Some items are no longer in the closet
  </p>
)}
```

#### What this means for the calendar — the second-order problem

A plan entry references a `SavedOutfit`, which references `ClosetItem`s. That is one hop further out than anything in the app today, and the supporting machinery does not exist at that level:

- **No `useSavedOutfit(id)` resolve seam.** `useOutfitsStore` exposes `saved: SavedOutfit[]` only — there is no `savedById` index and no lookup hook. `closet.ts`'s `getItem`/`useClosetItem` pair (with its "which to use when" doc comment at `:4-13`) is the pattern to mirror, and `merge.ts:27-33`'s `buildIndex` is the index-as-derived-state pattern.
- **No `repairOutfit` analogue.** `repairOutfit` substitutes a missing required item with `closet.<category>[0]`. There is no sensible substitute for a deleted *saved outfit* — you cannot swap in "some other outfit" for last Tuesday. So the plan's answer to a dangling reference must be **drop or show-empty**, not repair.
- **Two matching moves already have precedent**, and both should be taken:
  - Add a `plannedFor` count to the outfit delete confirmation, exactly like `wornIn` — `OutfitCard.tsx:223-224` already carries `forget this outfit?` / `forget it`, and `ConfirmDelete`'s `note?: string` prop (`ConfirmDelete.tsx:5-21`) exists precisely for this second line.
  - Render an empty/ghosted day rather than crashing, mirroring `Thumbnail`'s `if (!item) return null`.
- **The reverse-lookup helper to write** is the analogue of `outfitUsesItem` (`outfit.ts:83-95`) — something like `planUsesOutfit(plan, savedOutfitId)`, pure and trivially testable.

One helper that does **not** exist and would be worth writing if the calendar needs to enumerate an outfit's items: there is no `outfitItems()` flattening function. Per-slot enumeration is currently hand-written in three places (`outfit.ts:83-95`, `OutfitCard.tsx:97-121`, and the validators).

### The central design fork: weekday vs. date

The research question says "day of the week **or** day of the month". These are not two renderings of one model.

**Option A — weekday rotation.** `Record<0..6, string | null>` mapping weekday → `SavedOutfit` id. Seven slots, fixed size, never grows, no month math, no "what about the past" question, and it renders beautifully as seven rows on a phone. Semantically it is *a uniform*: "Mondays I wear this."

**Option B — dated plan.** A list of `{ date: "2026-08-03", outfitId }`. Unbounded and monotonically growing, needs month-grid math, needs a retention policy for past entries, and is the option that forces the 375px month-grid problem. Semantically it is *an agenda*: "on the 3rd I'm wearing this."

**Option C — both, as a discriminated union.** This has a direct house precedent in `OutfitBase` (`outfit.ts:3-6`) and would look like:

```ts
type PlanSlot =
  | { kind: "weekday"; weekday: number }   // 0–6, the recurring default
  | { kind: "date"; date: string };        // "YYYY-MM-DD" local, the override
```

The appeal is that it makes the two models *compose* rather than compete: weekday entries are your standing rotation, a dated entry overrides it for one specific day. Crucially, it collapses the whole feature's read path into one pure function —

```ts
planFor(date: Date, plan: Plan): string | null   // date entry wins, else weekday, else null
```

— which is exactly the shape the testing doctrine demands (pure, injected `Date`, node environment, no DOM). Precedence order becomes the single interesting rule to test, and it is one `it.each` table.

This is my recommendation, but it is genuinely a taste call about what the feature *means*, and it belongs in a `/grill-to-decisions` pass before planning.

### Date handling — what exists, and the trap to avoid

**There is no date library and none is permissible.** `package.json:20-26` has exactly five runtime dependencies: `@huggingface/transformers`, `react`, `react-dom`, `react-router` (^8.2.0), `zustand` (^5.0.14). No `date-fns`, `dayjs`, `luxon`. The no-new-dependencies rule is stated three separate times across decision docs; the WASM background remover is the only exception ever granted, and it was justified in writing.

All date work today is native, and there are exactly three display formats:

| Format | Code | Output |
|---|---|---|
| Default name | `src/features/outfits/naming.ts:2-4` | `Outfit · Jul 13` |
| Card timestamp | `src/features/outfits/OutfitCard.tsx:143-147` | `Jul 13, 2026` |
| Today's date line | `src/features/shuffle/ShufflePage.tsx:82-88` | `Monday, July 13` |

All three use `toLocaleDateString("en-US", {...})` with the locale hardcoded.

**Dates are always a parameter, never mocked.** `defaultOutfitName(date: Date)` takes it with no default; `quoteOfTheDay(date: Date = new Date())` defaults only at the call seam. `vi` is never imported anywhere in the repo — no mocks, no spies, no fake timers. Tests pass literals: `expect(defaultOutfitName(new Date(2026, 6, 13))).toBe("Outfit · Jul 13")` (`naming.test.ts:7`).

**The timezone idiom to copy** — `src/lib/quotes.ts:41-48` already solves "which local day is it?":

```ts
const localDays = Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
```

**The trap to avoid**: `backupFilename` uses `now.toISOString().slice(0, 10)` (`src/features/uploads/backup.ts:159-161`). That is UTC, and for a filename it is harmless. For a calendar it is a date-shifting bug — after 7pm Central, `toISOString().slice(0,10)` returns *tomorrow*. Any plan key must be built from `getFullYear()`/`getMonth()`/`getDate()`, not from `toISOString()`.

Also note `quotes.test.ts:12-16` teaches the right testing technique for date-derived values: assert the **relationship between consecutive days**, not the absolute value, so the test doesn't go brittle.

### Routing, navigation, and page anatomy

**Routing is a two-line change** — `src/app.tsx:10-20` is a flat route table under `Layout`:

```tsx
children: [
  { index: true, Component: ShufflePage },
  { path: "outfits", Component: OutfitsPage },
  { path: "closet", Component: ClosetPage },
],
```

`vercel.json` already rewrites every path to `index.html`, so a new path needs no deploy config.

**Nav must be added in both places.** `src/components/Layout.tsx:30-40` (desktop sidebar) and `:68-79` (mobile header) both hardcode the three links, sharing `navLinkClass` (`:7-12`). This double-edit is the established precedent — `thoughts/shared/decisions/2026-07-27-clothing-image-upload.md` Decision 4 did exactly this for `/closet`.

⚠️ **Crowding**: the mobile header currently holds `today` / `outfits` / `closet` + the theme button in one row at `px-4`. A fourth pill at 375px is tight. Worth a look before committing to a nav entry versus, say, reaching the plan from the Today page.

**Pages set no container styling.** `Layout.tsx:82-88` supplies `mx-auto w-full max-w-5xl px-4 py-8 md:px-10`; page roots are bare flex columns (`OutfitsPage.tsx:42` uses `flex flex-col gap-6`).

**The page-header idiom is invariant** — `OutfitsPage.tsx:43-48`:

```tsx
<header className="flex flex-col items-center gap-3 text-center">
  <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
    saved outfits
  </h1>
  <Ribbon variant="stripe" className="h-6 w-44 sm:h-7 sm:w-52" />
</header>
```

**The empty state** — `OutfitsPage.tsx:50-59` is the template, and note the all-lowercase copy:

```tsx
<div className="font-body text-ink/60 flex flex-col items-center gap-3 py-10 text-center">
  <p>nothing saved yet.</p>
  <Link to="/" className="border-accent/40 text-accent hover:bg-wash/60 rounded-full border px-6 py-2 transition-colors">
    put an outfit together
  </Link>
</div>
```

**Copy voice** (`thoughts/shared/decisions/2026-07-30-delete-confirmation.md:56-58`, Decision 4): all UI copy is lowercase, including page titles and nav. Verbs are honest, not euphemistic. Explanatory prose stays sentence-case (`Some items are no longer in the closet`). Stored data names are Title Case (`Outfit · Jul 13`). `OutfitActions.tsx` is the lone Title Case outlier and should not be treated as the model.

### The ribbon problem

`thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md` Decision 3 established a **fixed one-ribbon-per-page family**: Today = wavy plaid (`--color-accent`), Closet = gingham (`--color-accent-2`), Outfits = candy-stripe (`--color-accent-3`). `src/components/Ribbon.tsx:147-153` types it as exactly `"plaid" | "gingham" | "stripe"` — there is no spare fourth variant.

A calendar page therefore needs a **new hand-authored SVG weave**, which is real design work under real constraints (Decision 2 of that doc): inline SVG only (data-URI SVGs cannot read theme tokens), `feDisplacementMap` banned on small elements, `useId()`-scoped pattern ids because `url(#id)` resolves document-wide, and `style={{ fill: "var(--color-accent-N)" }}` rather than the `fill` attribute (`Ribbon.tsx:59-63`).

There are only three accent tokens (`--color-accent`, `-2`, `-3`, `index.css:11-14`), all three already spoken for by a ribbon. A fourth ribbon either reuses a token or the theme blocks gain a `--color-accent-4` across all five presets (`index.css:150, 168, 187, 206, 225`).

### Theming and layout constraints

Theming is **automatic and needs no registration** — any surface using `text-ink`, `bg-paper`, `bg-accent`, `bg-wash`, `border-ink/10` resolves through `var(--color-*)`, which `[data-theme]` on `<html>` reassigns (`index.css:142-242`).

Two constraints bite a calendar specifically:

- **Accent is the only action color**, and there is deliberately **no danger/alarm token** (`2026-07-17-ui-artistic-polish.md` Decision 2; `2026-07-30-delete-confirmation.md` Decision 5). So "today", "planned", and "empty" must be distinguished by weight, wash, and stitching — not by a second hue. `bg-wash`, `border-accent/40`, and the tint scale are the available levers.
- **All five presets are light** (Decision 6, no dark theme). A "today" highlight must read on all five papers, which vary meaningfully in warmth.

**Animation is CSS-first with zero libraries** (`ui-redesign` Decision 11, `artistic-polish` Decision 3). Available `animate-*` tokens: `rail-in`, four `rail-slide-*`, `pop-in`, `pop-out`, `card-leave` (`index.css:34-60`). The reduced-motion clamp collapses durations to `0.01ms` rather than removing them, **specifically so `animationend` still fires** (`index.css:56-59`) — anything gating a mutation on `onAnimationEnd` must keep the `event.target !== event.currentTarget` guard (`OutfitCard.tsx:164-169`), since `animationend` bubbles.

**Page/route transitions have been rejected three times** across decision docs. Don't propose one.

### Overlays — the pattern, and the mistake not to repeat

`thoughts/shared/decisions/2026-07-30-delete-confirmation.md` Decision 3 rejected both centered modals and anchored popovers *on grids*, with reasoning that transfers directly to a calendar grid:

> on the outfits grid **every later sibling card would paint over it** ... the in-card layer "never escapes the card, so **no z-index negotiation**"

And `thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md:255`:

> **The app has no z-index scale.** Values in use are ad hoc: `z-10` ... `z-20` ... `z-30`.

A "pick an outfit for this day" affordance is the highest-risk piece of UI in the feature: it is a popover anchored to a cell in a grid, which is precisely the shape that already caused one documented stacking bug. The house answer is `absolute inset-0` **inside** the cell (as `ConfirmDelete.tsx:63-71` does — no portal, no modal, no z-index at all), or a full-width panel below the grid rather than floating over it.

`useDismiss` (`src/components/useDismiss.ts:16-19`) already exists for Escape + outside-click, and uses `pointerdown` rather than `click` deliberately (`:9-14`) so one surface can close as a sibling opens.

### Backup format impact

`src/features/uploads/backup.ts:33-39`:

```ts
export interface BackupFile {
  kind: typeof BACKUP_KIND;   // "joyces-closet:backup"
  version: number;            // BACKUP_VERSION = 1
  exportedAt: string;
  items: BackupItem[];
  outfits: SavedOutfit[];
}
```

Plans are not in it. The version gate — `backup.ts:139-140`:

```ts
if (typeof file.version !== "number" || file.version > BACKUP_VERSION)
  throw new Error("That backup was made by a newer version of the app than this one.");
```

This creates a real fork:

- **Add `plans` without bumping `BACKUP_VERSION`.** Old builds read new files fine (unknown keys are ignored; missing arrays coerce to `[]` at `:146-147`). Cost: an old build that imports and re-exports **silently drops the plans**.
- **Bump to `version: 2`.** Old builds reject the file outright with a clear message. Cost: cross-version friction, in an app whose data is per-browser anyway.

Either is defensible; it needs deciding rather than defaulting.

⚠️ **`isSavedOutfit` is duplicated** — `localStorageStore.ts:8-17` and `backup.ts:90-100` carry two independent copies of the same predicate. Any change to the `SavedOutfit` shape must edit both. This is an argument for a **separate plan store** over adding a `plannedFor` field to `SavedOutfit`.

Also note `exportBackup`/`importBackup` (`backupFile.ts`) have **no test coverage** — `backupFile.ts:13-17` states the split deliberately ("this is glue"), and only the pure `backup.ts` half is tested.

### Testing

`vite.config.ts:7-12` is the whole constraint:

```ts
test: {
  // Domain-only tests (Decision 11): no DOM needed — storage and RNG are injected.
  environment: "node",
  include: ["src/**/*.test.ts"],
  passWithNoTests: true,
},
```

The `*.test.ts` glob (not `.tsx`) is the enforcement mechanism for "no component tests". There is no setup file, no jsdom, no testing-library, no `globals: true`.

So the calendar's testable surface must be extracted into pure modules:

- Month-grid math (days in month, leading weekday offset, trailing blanks) — pure, ~20 lines
- Local date-key derivation (the `toISOString` trap above)
- `planFor(date, plan)` precedence resolution
- `planUsesOutfit(plan, id)` reverse lookup
- The store, against a `fakeStorage()` (`localStorageStore.test.ts:10-18` — a `Map` behind three methods, with `map` **exposed** so tests can plant corrupt values)

Style to match: `describe` per exported function, `it` names as full sentences stating the rule (`it("stops finding an item once it leaves the closet")`), `it.each` tables with a human label per row, local fixture builders at the top of the file with a comment explaining *why*.

## Code References

- `src/app.tsx:10-20` — the flat route table; a fourth route goes here
- `src/components/Layout.tsx:30-40, 68-79` — desktop and mobile navs, both must be edited
- `src/features/outfits/store.ts:3-19` — `SavedOutfit` + the `OutfitStore` interface to clone
- `src/features/outfits/localStorageStore.ts:19-43` — injectable storage, never-throw reads, whole-array write
- `src/features/outfits/useOutfitsStore.ts:8-10, 20-40` — persist-first-then-mirror, no persist middleware
- `src/features/shuffle/outfit.ts:3-13` — `OutfitBase` discriminated union, the precedent for a `PlanSlot` union
- `src/features/shuffle/outfit.ts:83-95` — `outfitUsesItem`, template for `planUsesOutfit`
- `src/features/shuffle/outfit.ts:97-127` — `repairOutfit`, and why it has no plan-level analogue
- `src/features/closet/closet.ts:14-30` — `getItem`/`useClosetItem`, the resolve seam to mirror for saved outfits
- `src/features/closet/merge.ts:27-33` — `buildIndex`, index-as-derived-state
- `src/features/closet/ClosetPage.tsx:51-56, 148-152` — the `wornIn` warning idiom
- `src/features/outfits/OutfitCard.tsx:62-80` — render-or-vanish for a possibly-dead id
- `src/features/outfits/OutfitCard.tsx:210-214` — the degradation caption
- `src/features/outfits/OutfitsPage.tsx:43-59` — page header + empty-state templates
- `src/features/shuffle/ShufflePage.tsx:82-88` — the existing "today" date line, the natural tie-in point
- `src/lib/quotes.ts:41-48` — the local-day-number timezone idiom
- `src/features/uploads/backup.ts:33-39, 125-156` — backup schema and the version gate
- `src/features/uploads/backup.ts:159-161` — `toISOString().slice(0,10)`, the UTC trap not to copy
- `src/components/ConfirmDelete.tsx:5-21, 63-71` — prop signature and the no-z-index containment trick
- `src/components/useDismiss.ts:9-19` — Escape + outside-click, `pointerdown` not `click`
- `src/components/Ribbon.tsx:147-153` — the three-variant union
- `src/index.css:3-27, 142-242` — token vocabulary and the five theme blocks
- `vite.config.ts:7-12` — the node-only, `.test.ts`-only test constraint
- `src/main.tsx:1-21` — the hydration ordering a localStorage plan store does not disturb

## Architecture Insights

1. **Storage-behind-an-interface is the load-bearing abstraction**, and it has now paid off twice (uploads swapping to IndexedDB, outfits staying on localStorage). A plan store is the third instance and should not invent anything.
2. **The app never cascades and never repairs on disk.** It warns before, and degrades after. Every proposal to "clean up plans when an outfit is deleted" fights this grain; the idiomatic move is a count on the confirm layer plus an empty render.
3. **Ids are the only thing that crosses a feature boundary.** Nothing is denormalized, which is why deletes and renames are cheap. A plan storing an `Outfit` copy instead of a `SavedOutfit` id would break this and diverge from `plans/2026-07-13-closet-rebuild.md:457` ("calendar consumes `SavedOutfit`").
4. **Discriminated unions are the house shape for "one of two kinds"** — `OutfitBase` is the model, and the weekday/date fork fits it exactly.
5. **Purity is load-bearing for testability**, not a style preference. `environment: "node"` means anything not extracted into a `.ts` module is simply untested. Dates and randomness are always parameters.
6. **Comments citing numbered decisions are treated as deliverables** in this codebase, not as optional polish. New code that omits them will visibly not match.

## Historical Context (from thoughts/)

- `thoughts/shared/decisions/2026-07-13-closet-rebuild.md:10-14, 31, 80` — calendar named as deferred option D three times; the data model was explicitly required to accommodate it, and react-router was adopted on day one partly to hold its route.
- `thoughts/shared/plans/2026-07-13-closet-rebuild.md:457` — "calendar (consumes `SavedOutfit`)" — the intended dependency direction.
- `thoughts/shared/decisions/2026-07-13-closet-rebuild.md:60, 82` — "No tags/notes on outfits in v1", rejected twice. `SavedOutfit` has no tags, no wear history, no date field. **Wear history is greenfield** — the string "wear history" appears nowhere in `thoughts/` or `src/`.
- `thoughts/shared/decisions/2026-07-27-clothing-image-upload.md:73` — the "no bespoke deletion handling, lean on repair + caption" precedent.
- `thoughts/shared/decisions/2026-07-30-delete-confirmation.md` Decisions 3, 5, 11 — in-surface confirm layers, accent-only palette, `role="alertdialog"` with no focus trap.
- `thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md` Decisions 2, 3, 6 — the ribbon family, the SVG constraints, and the two secondary accent tokens ("future trims may draw on them too").
- `thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md:255, 290` — no z-index scale exists; establishing one is left open.
- ⚠️ **Freshness caveat** (from `CLAUDE.md`): the docs are historical snapshots. The "manifest" and "34 built-in items" language throughout the July 13 and July 27 docs is stale — built-ins were removed and the closet is uploads-only.

**Numbering note**: decision numbering **restarts at 1 in every doc**; there is no global sequence. A calendar decisions doc starts at Decision 1, and cross-doc references are qualified by date (e.g. "2026-07-13 closet-rebuild Decision 1").

## Related Research

- `thoughts/shared/research/2026-07-27-clothing-image-upload-feature.md` — establishes "ids are the contract, images are ephemeral"
- `thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md` — the stacking-context failure mode a calendar day-picker could reproduce
- `thoughts/shared/research/2026-07-30-shuffle-carousel-animation-options.md` — the CSS-only animation vocabulary

## Open Questions

These are the decisions a `/grill-to-decisions` pass should settle before planning:

1. **Weekday, date, or both?** Recurring rotation, dated agenda, or the `PlanSlot` union with date-overrides-weekday precedence. This determines the storage shape, the UI, and whether the "past" question exists at all.
2. **What does the page look like on a 375px phone?** Month grid (7×5–6, ~45px cells — narrower than anything the app has built), week strip, or agenda list. Mobile-first is binding, and this is the constraint most likely to reshape the whole feature.
3. **How is an outfit assigned to a day?** Day-cell popover (highest stacking risk, has precedent for going wrong), in-cell `absolute inset-0` layer (the `ConfirmDelete` pattern), a full-width panel below the grid, or the reverse direction — a "plan this" action on the existing `OutfitCard`.
4. **What happens to past dated entries?** Kept forever (becoming a de facto wear log the app has no other concept of), pruned on read, or pruned on write.
5. **What happens when a planned `SavedOutfit` is deleted?** Recommended: no cascade — a `planned for N days` note on the outfit's delete confirmation (mirroring `wornIn`), plus an empty day cell. Needs confirming.
6. **Does the Today page surface today's plan?** `ShufflePage.tsx:82-88` already renders the date; showing "today you planned: ..." is the feature's actual payoff and the strongest reason it earns a place in the app. Also raises: does a plan *preload* the shuffle canvas, or just link to it?
7. **Which ribbon does the page wear?** A fourth variant needs a hand-authored weave and either reuses one of the three accent tokens or adds `--color-accent-4` to all five theme blocks.
8. **Does the backup carry plans, and does `BACKUP_VERSION` bump?** See [Backup format impact](#backup-format-impact).
9. **Nav or no nav?** A fourth mobile pill alongside the theme button at 375px is tight. Alternative: reach the plan from Today.
10. **What is the feature called in the UI?** `plan`, `calendar`, `the week`, `week ahead` — lowercase, and it sets the route path.
