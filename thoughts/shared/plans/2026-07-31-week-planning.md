# Week Planning ("the week") Implementation Plan

## Overview

Implement the calendar feature the app was founded expecting (2026-07-13 closet-rebuild
Decision 1, option D), per the ten decisions in
`thoughts/shared/decisions/2026-07-31-week-planning.md`: a **layered plan model** —
weekday rotation + dated overrides, resolved by one pure `planFor` — persisted in a new
localStorage-backed store cloned from the outfits trio; a **`/week` page** showing seven
full-width monday–sunday rows with inline accordion assignment and scope pills; a **Today
payoff strip** ("planned: … / wear this"); the **`planned for N days`** honesty note on the
outfit delete confirmation; and **plans in the backup file** at version 1. The page wears a
new polka-dot ribbon on a new `--color-accent-4`, mock-gated before it enters app code.

User decisions made during planning:

- **Skips allowed.** A dated entry can hold `outfitId: null` — an explicit "nothing this
  monday" — so one day can be cleared out of a standing rotation. Clear always offers both
  scope pills, symmetric with assignment.
- **Day rows show the mini paper-doll preview + name**, not name-only. `OutfitCard`'s
  `Preview` is exported for reuse.
- Weekday entries store JS `getDay()` numbers (0 = Sunday); the UI renders monday-first.
- Plan entries are **slot-keyed** (the weekday number or date string *is* the identity, no
  uuid); backup import merges by slot, local wins — mirroring `importOutfits`.
- Nav order becomes **today · week · outfits · closet** in both navs (temporal grouping;
  trivially flippable at review).

## Current State Analysis

- **The store to clone**: `SavedOutfit`/`OutfitStore` (`src/features/outfits/store.ts:3-19`),
  `createLocalStorageOutfitStore` (`src/features/outfits/localStorageStore.ts:19-64` —
  injectable `StorageLike` at `:6`, never-throw reads at `:24-39`, whole-array writes at
  `:41-43`), and the `useOutfitsStore` mirror (`src/features/outfits/useOutfitsStore.ts:24-54`
  — persist first, then re-read storage into React; no persist middleware). Storage key
  convention `joyces-closet:<domain>:v<n>`; the plan store lands at `joyces-closet:plan:v1`.
- **No `main.tsx` change needed**: localStorage is synchronous, so the plan store seeds at
  module init exactly like `useOutfitsStore.ts:25` — the load-bearing hydration ordering
  (`src/main.tsx`, 2026-07-13 Decision 8) is untouched.
- **No resolve seam for saved outfits exists**: `useOutfitsStore` exposes only
  `saved: SavedOutfit[]`. The pattern to mirror is `getItem`/`useClosetItem`
  (`src/features/closet/closet.ts:14-30`).
- **The app never cascades and never repairs on disk** (2026-07-27 Decision 10): it warns
  before (`wornIn`, `src/features/closet/ClosetPage.tsx:54-56` → `ConfirmDelete`'s `note`
  prop, `src/components/ConfirmDelete.tsx:8`) and degrades after (`OutfitCard.tsx:210-214`'s
  italic caption; `Thumbnail`'s `if (!item) return null` at `OutfitCard.tsx:69-70`).
- **`repairOutfit` has no plan-level analogue** — you can't substitute "some other outfit"
  for a day. A dangling plan entry renders a caption, never repairs (Decision 7).
- **Routing is flat** (`src/app.tsx:10-20`); both navs hardcode three links
  (`src/components/Layout.tsx:30-40` desktop, `:68-79` mobile, shared `navLinkClass` at
  `:7-12`). `vercel.json` already rewrites every path.
- **The ribbon family is fixed at three** (`src/components/Ribbon.tsx:3`,
  `VARIANT` at `:50-57`), one accent token each; all three tokens
  (`src/index.css:8,13-14`) are spoken for. Five theme preset blocks at
  `src/index.css:150-242` each repeat the full token set.
- **The backup file** (`src/features/uploads/backup.ts:33-39`) carries `items` + `outfits`
  only; the version gate at `:141-145` rejects `version > BACKUP_VERSION`; missing arrays
  coerce to `[]` at `:147-148`. `encodeBackup` takes `(items, outfits, exportedAt)` — the
  signature grows, and `backup.test.ts` calls it at `:66, :74, :84`. Glue in
  `src/features/uploads/backupFile.ts` (`exportBackup:41-64`, `importBackup:71-99`,
  `ImportResult:19-24`); status line assembled in `ClosetPage.tsx:199-208`.
- **The UTC trap**: `backup.ts:159-161` builds a date via `toISOString().slice(0,10)` —
  harmless for a filename, a date-shifting bug for plan keys (after ~7pm Central it names
  tomorrow). The local-day idiom lives at `src/lib/quotes.ts:41-48`.
- **Tests are node-env, `src/**/*.test.ts` only** (`vite.config.ts:7-12`), no mocks/`vi`
  anywhere; dates are always parameters. The store-test template is
  `localStorageStore.test.ts:10-18`'s `fakeStorage()` with its exposed `map`.
- **Working tree**: 28 uncommitted/untracked files (the ribbons/shapes, delete-confirmation,
  and slide-animation work). This plan builds on that tree; line numbers refer to it.

## Desired End State

Joyce opens `/week` (from either nav) and sees this week's seven rows, monday first, today's
row washed for emphasis, each row showing the resolved plan — dated override beating weekday
rotation — as a mini paper-doll preview + outfit name, with "every monday" marking
rotation-supplied rows. Tapping a row expands it inline into a horizontal scroll of saved
outfits; picking one asks "just this monday" / "every monday"; clearing asks the same
question and can skip a single day out of a rotation. Past and future weeks are reachable by
arrows and stay editable. On the day itself, the Today page shows "planned: {name}" with a
one-tap "wear this" that loads the repaired outfit onto the shuffle canvas. Deleting a
planned outfit warns "planned for N days" and afterwards the affected rows say *"that outfit
is gone"*. Backups round-trip plans at version 1; old backups still import.

Verified by: `npm run typecheck && npm run lint && npm test && npm run build` all green
(existing tests unmodified, three new test files), plus the per-phase manual checklists
across all five themes at desktop and 375px widths.

### Key Discoveries

- **`OutfitBase` is the house shape for the entry union** (`src/features/shuffle/outfit.ts:3-6`);
  `isOutfitShape` (`:28-50`) is the guard idiom. Defining the plan guard **once** in the
  domain module and importing it into both the store and backup avoids repeating the
  `isSavedOutfit` duplication wart (`localStorageStore.ts:8-17` vs `backup.ts:90-100`).
- **Plan entries hold only ids** — `plan.ts` never imports `SavedOutfit`, so the week
  domain has zero feature dependencies and the outfits→week import in Phase 5 creates no
  module cycle (`OutfitCard` → `usePlanStore`/`plan`; `WeekPage` → `useOutfitsStore`/
  `OutfitPreview` — no module imports in both directions).
- **The Date component constructor is the DST-safe way to walk days**
  (`new Date(y, m, d - offset + i)` rolls over correctly); adding `86_400_000` ms is wrong
  twice a year. `quotes.test.ts:12-16` teaches relationship-based assertions for
  date-derived values.
- **The accordion dodges the app's documented failure mode**: pickers floating over grids
  stack wrong (`thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md`;
  2026-07-30 delete-confirmation Decision 3). An inline row expansion needs no z-index at
  all. `useDismiss` (`src/components/useDismiss.ts:16-40`) listens on `pointerdown`
  deliberately, so one row's dismissal runs before the next row's open — the
  `confirmingId` single-id handover (`OutfitsPage.tsx:17-20`) transfers directly to a
  single `expandedKey`.
- **Mounting pending-state inside the expanded panel makes collapse-resets free**: when the
  panel unmounts, its "which outfit, awaiting scope" state dies with it — no effect needed.
- **`animate-pop-in` (`index.css:49`) is the established panel entrance**; nothing in this
  feature gates a mutation on `animationend`, so the bubbling guard idiom isn't needed.
- **Accent is the only action color and all five presets are light** (2026-07-17 Decision 2,
  2026-07-13 Decision 6): "today", "planned", "empty" must differ by weight and wash
  (`bg-wash`, `border-accent/40`, opacity steps), never by a new hue.
- **Prettier ignores `thoughts/`**; `npm run format` must leave no diff on `src/`.

## What We're NOT Doing

Per the decisions doc's Out of Scope, plus planning additions:

- **Month grid** — week view only (Decision 4); a desktop month view is its own later slice.
- **"Plan this" from `OutfitCard`** — assignment flows day → outfit only (Decision 3).
- **Auto-loading the planned outfit on Today** — one-tap wear only (Decision 2).
- **Wear-log surfacing** — past weeks are browsable; no history view, stats, or counts.
- **Pruning/retention or past-week edit guards** — keep forever, allow everything (Decision 6).
- **Cascade or on-disk repair of plan entries** — never (Decision 7).
- **`BACKUP_VERSION` bump** — stays 1 (Decision 8).
- **Nav restructure** — "week" joins the existing pills; revisit only at a fifth page.
- **Drag-and-drop, multi-outfit days, notes on days** — none of it.
- **A "back to this week" shortcut** — arrows only in v1; reload lands on the current week.
- **"Wear this" from week rows** — wearing lives on Today (Decision 2); the week page only
  plans.
- **An explicit "un-skip / restore rotation" affordance** — assigning anything to a skipped
  day overwrites the skip; that's the path back.
- **A z-index scale** — still open app-wide; nothing here floats, so nothing here needs it.

## Implementation Approach

Domain first, pixels second. Phase 1 lands the entire tested surface — types, guards,
resolution, the command functions that encode the pill semantics, week math, and the store
trio — with no UI, so every interesting invariant is green before a row exists. Phase 2 is
the design gate (polka weave + five `--color-accent-4` hexes) run as a throwaway artifact,
per the ribbons plan's Phase 1 precedent. Phases 3–5 wire UI in risk order: read-only
rendering, then the assignment interactions (the riskiest UI), then the three small
integrations (Today strip, delete note, backup). Each phase leaves the app shippable;
existing tests pass unmodified throughout.

The one deliberate deviation from a cited pattern: `useSavedOutfit` uses a linear
`Array.find` rather than `closet.ts`'s Map index — the week page resolves ≤ 7 ids per render
against a list of dozens, where the closet index serves module-init shuffles over every
item. Noted in the code comment.

## Phase 1: Plan domain & store

### Overview

Everything below `src/features/week/` that has no DOM: the entry union with skips, the slot
identity, `planFor` precedence, the assign/clear command functions, `plannedDaysFor`, local
date keys and week math, the `PlanStore` interface + localStorage implementation +
`usePlanStore` mirror, and the `useSavedOutfit` seam in the outfits feature. Three new test
files. No visible app change.

### Changes Required:

#### 1. Domain types & logic

**File**: `src/features/week/plan.ts` (new)
**Changes**: the model and its rules — ids only, no feature imports (except `dateKey` from
`week.ts`):

```ts
import { dateKey } from "./week";

/** A slot a plan entry occupies: a recurring weekday or one specific local date. */
export type PlanSlot =
  | { kind: "weekday"; weekday: number } // 0–6, Date.getDay() numbering (0 = Sunday)
  | { kind: "date"; date: string }; // "YYYY-MM-DD" local — see dateKey()

/**
 * One planned day (2026-07-31 week-planning Decision 1), mirroring OutfitBase's union
 * (outfit.ts:3-6). References a SavedOutfit by id only — ids are the contract. A dated
 * entry with outfitId null is an explicit skip ("nothing this monday"), which is what
 * lets one day be cleared out of a standing rotation (Decision 5). Weekday entries never
 * hold null: clearing a rotation is deleting its entry.
 */
export type PlanEntry =
  | { kind: "weekday"; weekday: number; outfitId: string }
  | { kind: "date"; date: string; outfitId: string | null };

/** The slot IS an entry's identity — no uuid. Upsert, clear, and backup merge key on it. */
export function slotKey(slot: PlanSlot): string {
  return slot.kind === "weekday" ? `weekday:${slot.weekday}` : `date:${slot.date}`;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Structural check for untrusted data (the isOutfitShape idiom, outfit.ts:24-27). Used by
 * BOTH the store read and backup import — defined once here so the isSavedOutfit
 * duplication (localStorageStore.ts:8, backup.ts:90) is not repeated at this level.
 */
export function isPlanEntry(value: unknown): value is PlanEntry { /* … */ }

export function dateEntryAt(entries: PlanEntry[], date: string) /* narrowed | undefined */
export function weekdayEntryAt(entries: PlanEntry[], weekday: number) /* narrowed | undefined */

/** What a day resolves to, and which layer said so (the row's badge needs the source). */
export type PlanResolution =
  | { source: "date"; outfitId: string | null } // null = explicit skip
  | { source: "weekday"; outfitId: string }
  | { source: "none" };

/** Dated entry wins (including a skip), else the weekday rotation, else nothing
    (Decision 1) — the feature's single interesting invariant. */
export function planFor(date: Date, entries: PlanEntry[]): PlanResolution { /* … */ }

export type Scope = "date" | "weekday";

export type DayCommand =
  | { op: "set"; entry: PlanEntry }
  | { op: "clear"; slot: PlanSlot };

/**
 * The writes behind the two assignment pills (Decision 5). "date" writes the one-day
 * override. "weekday" writes the rotation slot — and also removes any dated entry on the
 * day the pill was tapped from, so THAT row shows the rotation immediately instead of a
 * stale override or skip winning over it.
 */
export function assignCommands(
  entries: PlanEntry[], date: Date, outfitId: string, scope: Scope,
): DayCommand[] { /* … */ }

/**
 * The writes behind the two clear pills. "date": when the rotation underlies this day, an
 * explicit skip is written — merely deleting an override would repopulate the row from
 * the rotation; with no rotation underneath, the dated entry is simply deleted.
 * "weekday": the rotation slot goes, and so does this day's dated entry — clearing from a
 * row must leave THAT row empty, not reveal a leftover override.
 */
export function clearCommands(
  entries: PlanEntry[], date: Date, scope: Scope,
): DayCommand[] { /* … */ }

/** How many planned days wear this outfit — the delete confirmation's honesty line
    (Decision 7), the plan-level analogue of outfitUsesItem (outfit.ts:83-95). A weekday
    entry counts as one day. */
export function plannedDaysFor(entries: PlanEntry[], outfitId: string): number {
  return entries.filter((entry) => entry.outfitId === outfitId).length;
}
```

Both command functions are **total**: a scope that has nothing to do returns `[]` (or the
subset that applies) rather than assuming the UI gated correctly.

#### 2. Week & date math

**File**: `src/features/week/week.ts` (new)
**Changes**:

```ts
/**
 * The local date key "YYYY-MM-DD" — built from local components, NEVER via
 * toISOString().slice(0,10) (backup.ts:159's filename idiom): that is UTC and names
 * tomorrow after ~7pm Central. The plan's whole notion of "day" is local.
 */
export function dateKey(date: Date): string { /* getFullYear/getMonth+1/getDate, padded */ }

/** date + n days, via the component constructor — its rollover is DST-safe where
    adding 86_400_000 ms is not, on the two days a year that aren't 24 hours long. */
export function addDays(date: Date, days: number): Date { /* … */ }

/** The seven local Dates of the monday–sunday week containing `date` (Decision 4).
    Monday offset is (getDay() + 6) % 7 — getDay() is sunday-first. */
export function weekOf(date: Date): Date[] { /* … */ }

/** "jul 27 – aug 2" (Decision 9) — en-dash, lowercase like all UI copy;
    toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase(). */
export function weekRangeLabel(days: Date[]): string { /* … */ }

/** "monday" — the row label and the scope pills' word. */
export function weekdayName(date: Date): string { /* … */ }
```

#### 3. The store interface

**File**: `src/features/week/store.ts` (new)
**Changes**: the outfits split (`store.ts` interface / `localStorageStore.ts` impl), one
level up:

```ts
import type { PlanEntry, PlanSlot } from "./plan";

/**
 * The only way plans are persisted (2026-07-31 week-planning; the OutfitStore idiom,
 * outfits/store.ts:10-14). The UI never touches a storage API directly — a backend swap
 * is one new implementation of this interface.
 */
export interface PlanStore {
  list(): PlanEntry[];
  /** Upserts by slot: a second entry for the same weekday or date replaces the first. */
  set(entry: PlanEntry): void;
  clear(slot: PlanSlot): void;
}
```

#### 4. The localStorage implementation

**File**: `src/features/week/localStoragePlanStore.ts` (new)
**Changes**: `createLocalStoragePlanStore(storage: StorageLike = window.localStorage)`,
cloned from `outfits/localStorageStore.ts:19-64` —

- `export const PLAN_KEY = "joyces-closet:plan:v1";`
- local `type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">` (as
  `localStorageStore.ts:6` does; the type is two lines and not exported there);
- `read()` in the never-throw idiom (missing key / corrupt JSON / wrong shape → `[]`),
  filtering with `isPlanEntry` from `plan.ts`;
- whole-array `write()`;
- `set` upserts by `slotKey`, `clear` filters by `slotKey`.

#### 5. The zustand mirror

**File**: `src/features/week/usePlanStore.ts` (new)
**Changes**: the `useOutfitsStore` shape — persist first, mirror by re-reading, no persist
middleware:

```ts
// The one place that picks a PlanStore implementation (the useOutfitsStore.ts:8-10 idiom).
const planStore: PlanStore = createLocalStoragePlanStore();

interface PlanState {
  entries: PlanEntry[];
  /** Runs a command list from assignCommands/clearCommands, then re-reads storage —
      the pill semantics live in plan.ts where they are pure and tested. */
  apply: (commands: DayCommand[]) => void;
  /** Restores entries from a backup; occupied slots keep the local entry (the
      importOutfits idiom, useOutfitsStore.ts:44-53). Returns how many were new. */
  importEntries: (entries: PlanEntry[]) => number;
}

export const usePlanStore = create<PlanState>()((set) => ({
  entries: planStore.list(), // seeds synchronously at module init — no main.tsx hook
  /* … */
}));
```

`importEntries`: build `Set` of existing `slotKey`s, filter incoming, `planStore.set` each
fresh one, re-read, return the count.

#### 6. The saved-outfit resolve seam

**File**: `src/features/outfits/useOutfitsStore.ts`
**Changes**: append the pair, mirroring `closet.ts:14-30`'s plain/hook split and doc
comment style:

```ts
/**
 * The resolve seam for a possibly-deleted saved outfit — closet.ts's getItem/useClosetItem
 * pair one hop out: plans reference SavedOutfits the way outfits reference items, and a
 * dead id resolves to undefined for the caller to render honestly (never a crash). A
 * linear find rather than closet.ts's Map index on purpose: the week page resolves at
 * most seven ids per render against a list of dozens.
 */
export function getSavedOutfit(id: string): SavedOutfit | undefined { /* … */ }

export function useSavedOutfit(id: string | null): SavedOutfit | undefined { /* … */ }
```

#### 7. Tests

**File**: `src/features/week/plan.test.ts` (new)

- `planFor` precedence as one `it.each` table with human labels (Decision 1): dated entry
  beats weekday; a skip resolves `{source:"date", outfitId:null}` even with a rotation
  underneath; weekday fills an unplanned date; nothing → `{source:"none"}`; a dated entry
  for another day doesn't leak; a weekday entry for another weekday doesn't apply.
- `assignCommands`: "date" writes only the override; "weekday" writes the rotation slot;
  "weekday" **also clears** an existing dated entry (override *and* skip cases); "weekday"
  with no dated entry emits no clear.
- `clearCommands`: "date" with rotation underneath writes a skip; "date" with no rotation
  deletes the dated entry; "date" with nothing at all → `[]`; "weekday" clears the rotation
  slot; "weekday" also clears the day's dated entry when present.
- `plannedDaysFor`: counts weekday and dated entries one day each; skips (null) never match;
  zero for an unplanned outfit.
- `isPlanEntry` via `it.each`: valid weekday entry, valid dated entry, valid skip; rejects
  weekday 7 / -1 / 2.5, a `date` failing the key regex (`"2026-8-3"`), a weekday entry with
  null outfitId, non-objects.
- `slotKey`: weekday and date keys never collide; same slot → same key regardless of payload.

**File**: `src/features/week/week.test.ts` (new)

- `dateKey`: pads (`new Date(2026, 6, 5)` → `"2026-07-05"`); a late-evening local time
  keeps its local day (`new Date(2026, 6, 5, 23, 30)` → `"2026-07-05"` — the anti-UTC
  assertion; holds in every timezone because the components are local by construction).
- `weekOf`: returns 7 dates; first has `getDay() === 1`; contains the anchor's `dateKey`;
  keys are distinct and consecutive (each equals `dateKey(addDays(days[0], i))`); a
  DST-crossing week (anchor in the week containing 2026-11-01) still yields 7 distinct
  consecutive keys — relationship assertions, per `quotes.test.ts:12-16`.
- `addDays`: crosses month and year boundaries.
- `weekRangeLabel`: `"jul 27 – aug 2"` for the week of 2026-07-27 (cross-month), lowercase.
- `weekdayName`: `"monday"` for a known Monday.

**File**: `src/features/week/localStoragePlanStore.test.ts` (new) — the
`localStorageStore.test.ts` suite transposed: starts empty; round-trips all three entry
kinds; **upsert replaces the entry at the same slot** (same weekday, same date — including
override → skip); clear removes only the target slot; clear of an unknown slot is a no-op;
persists across store instances; corrupt JSON → `[]`; valid-JSON-wrong-shape → `[]`; drops
invalid entries keeping good ones (plant a weekday-7 entry beside valid ones via the
exposed `map`); recovers from corrupt storage on the next set.

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] All tests pass, existing ones unmodified: `npm test`
- [x] New suites pass in isolation: `npx vitest run src/features/week`
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff

#### Manual Verification:

- [ ] App renders and behaves exactly as before (nothing imports the new modules yet).

---

## Phase 2: Ribbon mock & sign-off

### Overview

The design gate (Decision 10), following the ribbons plan's Phase 1 precedent
(`thoughts/shared/plans/2026-07-30-ui-refinement-ribbons-and-shapes.md:125-200`): one
throwaway HTML file previewing the polka-dot weave and the five proposed
`--color-accent-4` values across all five themes. No app code changes. Hard gate — Phase 3
does not start until sign-off.

### Changes Required:

#### 1. The mock file

**File**: `<session scratchpad>/week-ribbon-mock.html` (throwaway — never enters the
repo), published via the Artifact tool for review.
**Contents**:

- The five theme palettes copied from `src/index.css:150-242` as `[data-theme]` blocks,
  each **plus** the proposed `--color-accent-4` (table below); a theme-switcher row;
  paper + `--texture-grain` copied for fidelity (fonts fall back to system, as before).
- The **polka-dot ribbon** at real size (~176×24 to ~208×28 CSS px) under a fake
  `the week` h1 with the muted range subline, using the existing band geometry
  (`Ribbon.tsx:18-36`) so only the weave and end treatment are up for judgment:
  - 2–3 candidate dot tiles (e.g. an offset half-drop of two dot sizes at partial
    opacity on paper; a denser single-size grid) — dots must read as *dots* at ribbon
    height, distinct from gingham's grid at a glance.
  - Both end treatments (`notch` and `fishtail`) side by side; sign-off picks one.
- The **existing three ribbons** alongside (geometry copied from `Ribbon.tsx`), so the
  four read as a family — the one-per-page symmetry check (Decision 10).
- All SVG under the standing constraints (2026-07-30 ribbons-and-shapes Decision 2):
  inline, `style={{ fill: "var(--color-accent-4)" }}` never the `fill` attribute,
  pattern ids unique per instance, no `feDisplacementMap`.

#### 2. Proposed `--color-accent-4` values (starting points, finalized by this sign-off)

Constraint: distinct from that theme's accent/-2/-3 (all spoken for by ribbons), reads on
that paper, harmonizes with its ink — each is "the missing thread" in its palette:

| Theme | `--color-accent-4` | Reasoning |
| --- | --- | --- |
| rosewood | `#8aa2b8` dusty blue | rose/gold/sage lack a cool thread |
| lavender | `#c493a8` dusty rose | wisteria/butter/periwinkle lack a warm pink |
| garden | `#7fa3a8` stream teal | moss/gold/berry lack a cool water tone |
| seaglass | `#8f9fc0` dusty periwinkle | teal/sand/shell lack a blue-violet |
| marmalade | `#94a578` olive-sage | terracotta/blue/gold lack a green |

### Success Criteria:

#### Automated Verification:

- [x] None — no app code is touched. `git status` shows no new `src/` changes beyond the
      pre-existing working-tree files.

#### Manual Verification:

- [x] Dots read as polka dots at ribbon scale on all five papers; the ribbon is
      distinguishable from gingham at a glance.
- [x] The four ribbons read as one family; no accent-4 collides with its theme's other
      three accents or goes muddy against its paper.
- [x] Joyce approves the dot tile, the end treatment, and all five hexes — iterating on
      the mock (redeploying the same artifact) until she does.

**Signed off** (mock: https://claude.ai/code/artifact/82d5e877-6478-4ee2-a1f5-b894b2be86e1):
tile **C — swiss dot + pinhead** (8×8 tile: accent-4 dots r=1.6 at (2,2) and (6,6) at 0.5
opacity, half-dropped, with accent pinheads r=0.55 at (6,2) and (2,6) at 0.4 — the pinheads
are what stop the field reading as gingham's lattice); end **notch**; all five proposed
hexes approved unchanged.

**Implementation Note**: hard gate — do not start Phase 3 until sign-off. The approved
tile geometry, end choice, and hexes flow into Phase 3 **verbatim**; if sign-off adjusts
anything, the mock is the source of truth, not this document's proposals.

---

## Phase 3: Tokens, polka ribbon, route, and the read-only week page

### Overview

`--color-accent-4` lands in all six CSS blocks, `Ribbon` gains the approved `polka`
variant, `/week` gets its route and both nav entries, and `WeekPage` renders the resolved
week — rows, badges, captions, today's wash, prev/next — with **no** assignment UI yet.

### Changes Required:

#### 1. Theme token

**File**: `src/index.css`
**Changes**: after `--color-accent-3` (`:14`), extending the Decision 6 comment:

```css
  --color-accent-2: #c9ab6a;
  --color-accent-3: #93ab8c;
  /* The week's polka thread (2026-07-31 week-planning Decision 10). */
  --color-accent-4: #8aa2b8;
```

…and the Phase-2-approved value added to each of the five preset blocks (`:150-242`),
after that block's `--color-accent-3`. Rosewood repeats the default on purpose (the
existing convention, `:145-148`).

#### 2. The polka variant

**File**: `src/components/Ribbon.tsx`
**Changes**:

- `RibbonVariant` (`:3`) gains `"polka"`.
- `VARIANT` (`:50-57`) gains
  `polka: { ink: "var(--color-accent-4)", path: band(/* approved end */) }`.
- `Weave` (`:64`) gains the polka branch — the approved dot tile, e.g. an offset
  half-drop `<pattern>` of two `<circle>`s in `style={{ fill: "var(--color-accent-4)" }}`
  at partial opacity over the paper rect (exact geometry **from the mock, verbatim**).
- Extend the family doc comment (`:45-49`): four pages, four accents.

#### 3. Route

**File**: `src/app.tsx`
**Changes**: import `WeekPage`; children (`:14-18`) gain
`{ path: "week", Component: WeekPage }` after the index route (route order mirrors nav
order).

#### 4. Both navs

**File**: `src/components/Layout.tsx`
**Changes**: a fourth `NavLink` — `to="/week"`, label `week`, shared `navLinkClass` — added
between `today` and `outfits` in the desktop sidebar (`:30-40`) **and** the mobile header
(`:68-79`); the both-navs precedent from 2026-07-27 Decision 4.

#### 5. Export the preview

**File**: `src/features/outfits/OutfitCard.tsx`
**Changes**: `function Preview` (`:86`) becomes `export function OutfitPreview` (update the
one internal call site, `:204`; comment gains "also the week page's row/picker thumbnail").

#### 6. The page

**File**: `src/features/week/WeekPage.tsx` (new)
**Changes**:

```tsx
export function WeekPage() {
  // The anchor names the visible week; prev/next slide it ±7 days. Any date is reachable
  // (Decision 6: past weeks stay browsable and editable).
  const [anchor, setAnchor] = useState(() => new Date());
  const entries = usePlanStore((state) => state.entries);

  const days = weekOf(anchor);
  const todayKey = dateKey(new Date());
  /* … */
}
```

- Header per the invariant idiom (`OutfitsPage.tsx:43-48` + the closet's h1+subline,
  `ClosetPage.tsx:274-285`): h1 `the week`, `<Ribbon variant="polka" className="h-6 w-44
  sm:h-7 sm:w-52" />`, then a centered row of ‹ previous / `{weekRangeLabel(days)}` in
  `font-body text-ink/55 text-sm` / next › — arrow buttons styled like the ghost controls
  (`text-ink/45 hover:text-accent hover:bg-wash/60 h-7 w-7 rounded-full`), with
  `aria-label="previous week"` / `"next week"`.
- Body: `flex flex-col gap-3` of seven `<DayRow>`s, keyed by `dateKey(day)`, each given
  `date`, `isToday`, and `resolution={planFor(day, entries)}`.

#### 7. The row (read-only form)

**File**: `src/features/week/DayRow.tsx` (new)
**Changes**: one full-width card per day —
`border-ink/10 paper-card rounded-2xl border bg-white p-3` (the card family idiom), with
today's row washed for emphasis instead of hued (no alarm/second-accent rule):
`border-accent/40 bg-wash/40` when `isToday`.

Layout: left column carries `weekdayName(date)` (`font-body text-ink text-sm font-medium`)
over `jul 27` (`text-ink/45 text-xs`, the `weekRangeLabel` month-day format); the content
area renders by resolution:

- `source: "none"`, or a skip (`source: "date"`, `outfitId: null`) → *nothing planned* in
  `font-body text-ink/45 text-sm italic` (a skip **looks** identical to unplanned — the
  distinction only matters to the clear/assign flows).
- an `outfitId` whose `useSavedOutfit` resolves → `<OutfitPreview>` in a fixed-width
  wrapper (`w-14 sm:w-16`; the component is `aspect-3/4 w-full`) beside the outfit name
  (`font-body text-ink text-sm font-medium truncate`), with the rotation badge
  `every monday` (`text-ink/45 text-xs`) when `source === "weekday"`; an override carries
  no badge — it is the day's own plan.
- a dead id (`useSavedOutfit` → `undefined`) → *that outfit is gone* in
  `font-body text-accent/70 text-xs italic` — Decision 7's register
  (`OutfitCard.tsx:210-214`); the entry stays on disk untouched.

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] All tests pass unmodified: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff
- [x] All six CSS blocks carry the token: `grep -c "color-accent-4" src/index.css` → `6`

#### Manual Verification:

- [ ] `week` appears in both navs; active state highlights; the mobile header at 375px
      fits four pills + the theme button without wrapping or clipping.
- [ ] Deep-linking `/week` works on the dev server (the vercel rewrite covers prod).
- [ ] The polka ribbon renders under `the week` and redyes across all five themes; the
      four-page ribbon family reads coherently.
- [ ] Seven rows monday-first; today's row wash reads on all five papers; prev/next move
      the window and the range subline; past weeks render.
- [ ] Seed `joyces-closet:plan:v1` by hand (devtools) with a weekday entry, a dated
      override, a skip, and a dead outfit id: rows resolve override-over-rotation, the
      badge appears only on rotation rows, the skip row reads *nothing planned*, the dead
      id reads *that outfit is gone*.

**Implementation Note**: pause for manual confirmation before Phase 4.

---

## Phase 4: Assignment interactions

### Overview

The accordion (Decision 5): tapping a row expands it inline into a horizontal scroll of
saved-outfit thumbnails; picking one asks scope with two pills; clearing asks the same
question when the rotation is involved. One row open at a time; nothing floats; no
z-index anywhere.

### Changes Required:

#### 1. Page-level expansion state

**File**: `src/features/week/WeekPage.tsx`
**Changes**: `const [expandedKey, setExpandedKey] = useState<string | null>(null)` — the
`confirmingId` single-id pattern (`OutfitsPage.tsx:17-20`): one key means one-at-a-time
falls out for free, and the pointerdown-based `useDismiss` makes the row-to-row handover
close-then-open. Rows receive `expanded`, `onExpand`, `onCollapse`.

#### 2. The row becomes expandable

**File**: `src/features/week/DayRow.tsx`
**Changes**:

- The collapsed content becomes a `<button type="button">` (full-width, `cursor-pointer`,
  `aria-expanded={expanded}`, `aria-label={`plan ${weekdayName(date)}`}`) toggling
  expand/collapse.
- ~~`useDismiss(rowRef, expanded ? onCollapse : null)` on the row's outer div~~ — **changed
  during implementation**: the dismissal region is the whole row *list*, hooked up once in
  `WeekPage` (`useDismiss(listRef, …)`), not once per row. Per-row was wrong here for a
  reason the accordion introduces and the card grid never had: `useDismiss` fires on
  `pointerdown`, so tapping row D while row A was open would collapse A *mid-gesture*, slide
  D up under the finger, and land the `pointerup` on a different element — the browser then
  dispatches `click` to the common ancestor and D never opens. Scoped to the list, a
  row-to-row handover is an ordinary click on D (which sets `expandedKey` to D, closing A as
  a side effect) and the layout only moves once the new row is already open. Escape and taps
  genuinely outside the list still collapse, and nothing sits below the list to be shifted.
- When `expanded`, an `<ExpandedPanel>` mounts below the collapsed content, entering with
  `animate-pop-in` (no exit animation — collapse unmounts immediately; nothing gates a
  mutation on `animationend`, so the bubbling guard isn't needed).

#### 3. The panel

**File**: `src/features/week/DayRow.tsx` (same file — a private component)
**Changes**: `ExpandedPanel({ date, resolution, onDone })`. Its pending state lives
**inside** it, so unmounting on collapse resets the flow with no effect:

```tsx
// Which write is awaiting its scope answer. Mounted only while expanded, so collapsing
// (Escape, outside tap, another row opening) abandons the question for free.
const [pending, setPending] = useState<
  { mode: "assign"; outfitId: string } | { mode: "clear" } | null
>(null);
```

Contents, top to bottom:

- **The picker**: saved outfits newest-first (`[...saved].sort` by `createdAt`, the
  `OutfitsPage.tsx:22-24` idiom) in `overflow-x-auto flex gap-2` — each a `w-20 shrink-0`
  button of `<OutfitPreview>` + truncated name (`text-xs`), tapping which sets
  `pending = { mode: "assign", outfitId }`. With no saved outfits, the panel shows
  *nothing saved yet.* + a `put an outfit together` link to `/` (the
  `OutfitsPage.tsx:50-59` empty-state register, smaller).
- **The clear action**: a quiet text button `clear this day`
  (`text-ink/55 hover:text-accent text-xs`), shown only when the row currently shows
  something (a resolved outfit or the dead-id caption — not for skips/unplanned):
  - if `weekdayEntryAt(entries, date.getDay())` exists → `pending = { mode: "clear" }`
    (scope needed);
  - else (dated entry only) → `apply(clearCommands(entries, date, "date"))` and `onDone()`
    immediately — one layer, no question (Decision 5).
- **The scope pills**, replacing the picker row while `pending` is set: two pills,
  lowercase, the weekday word from `weekdayName(date)` —
  `just this monday` / `every monday` (`border-accent/40 text-accent hover:bg-wash/60
  rounded-full border px-4 py-1.5 text-sm`, the quiet-pill register). Tapping one:

  ```tsx
  const commands =
    pending.mode === "assign"
      ? assignCommands(entries, date, pending.outfitId, scope)
      : clearCommands(entries, date, scope);
  apply(commands);
  onDone(); // collapse
  ```

  All semantics — skips, the "every also clears the standing override" rule — are already
  inside the Phase 1 command functions; the panel never constructs an entry itself.

Reassignment needs no special path: expanding a planned row shows the same picker, and
`PlanStore.set`'s slot upsert replaces whatever was there (including a skip).

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] All tests pass unmodified: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff

#### Manual Verification:

- [ ] Tapping a row expands it; tapping another closes the first and opens the second in
      one gesture; Escape and outside-tap collapse; nothing paints over any sibling row
      (scroll the panel into the row below — no overlap, the accordion pushes rows down).
- [ ] Assign `just this monday`: only that date changes; `every monday`: every visible
      monday changes, and doing it from a row that had an override or skip clears that
      row's dated entry (verify `joyces-closet:plan:v1` in devtools).
- [ ] Clear on a rotation-covered row offers both pills; `just this monday` empties only
      that row (a skip entry appears in storage) while other mondays keep the outfit;
      `every monday` empties them all and removes this row's dated entry.
- [ ] Clear on an override-only row clears immediately, no pills.
- [ ] A dead-id row can be cleared.
- [ ] Assigning onto a skipped day overwrites the skip.
- [ ] Editing a past week works (Decision 6 — no guard).
- [ ] The picker scrolls horizontally on a 375px phone; thumbnails are tappable; the
      empty-closet path shows the link to `/`.
- [ ] Reduced motion: the panel appears instantly, everything still works (the clamp
      collapses `pop-in` to 0.01ms).

**Implementation Note**: pause for manual confirmation before Phase 5.

---

## Phase 5: Today strip, delete note, backup

### Overview

The three integrations that make planning pay off and stay honest: the Today page hands
the plan back (Decision 2), the outfit delete confirmation counts planned days
(Decision 7), and the backup file carries plans at version 1 (Decision 8).

### Changes Required:

#### 1. The Today strip

**File**: `src/features/week/TodayPlan.tsx` (new)
**Changes**:

```tsx
/**
 * Today's plan handed back on the day (2026-07-31 week-planning Decision 2): one line,
 * one tap. Renders nothing when nothing is planned (or the day is skipped) — the strip
 * only earns its place when it has something to say. Nothing auto-loads: "wear this"
 * goes through repairOutfit before loadOutfit, exactly as OutfitsPage.handleLoad does
 * (OutfitsPage.tsx:26-33), and the current shuffle is never stomped unasked.
 */
export function TodayPlan() { /* … */ }
```

- `planFor(new Date(), usePlanStore(s => s.entries))`; `source: "none"` or a skip →
  `return null`.
- A dead id → the caption *that outfit is gone*
  (`font-body text-accent/70 text-xs italic`) — same register as the week rows.
- A live outfit → a centered row (`mt-3 flex items-center justify-center gap-3`):
  `planned: {name}` (`font-body text-ink/55 text-sm`, name in `text-ink`) + a
  `wear this` pill (`border-accent/40 text-accent hover:bg-wash/60 rounded-full border
  px-4 py-1.5 text-sm`) whose handler is `repairOutfit(saved.outfit, getCloset())` →
  bail on `null` → `loadOutfit(wearable)` (no navigate — we're already on `/`).

**File**: `src/features/shuffle/ShufflePage.tsx`
**Changes**: `<TodayPlan />` inside the header, directly after the date `<p>` (`:82-88`).
Note: when the closet can't dress anyone, `ShufflePage` early-returns `NothingToWear`
(`:65-66`) and the strip never renders — acceptable, since `repairOutfit` would return
`null` against that closet anyway.

#### 2. The delete note

**File**: `src/features/outfits/OutfitCard.tsx`
**Changes**: the `wornIn` idiom (`ClosetPage.tsx:51-56`) at the outfit level:

```tsx
// Deleting a planned outfit warns rather than cascades (2026-07-31 week-planning
// Decision 7). Subscribing every card to `entries` is free in practice: plans cannot
// change from this page, so the list never changes under it.
const entries = usePlanStore((state) => state.entries);
const plannedFor = plannedDaysFor(entries, saved.id);
```

…and the `ConfirmDelete` call (`:221-230`) gains
`note={plannedFor > 0 ? `planned for ${plannedFor} ${plannedFor === 1 ? "day" : "days"}` : undefined}`
— the prop exists for exactly this (`ConfirmDelete.tsx:8`, the `wornIn` note at
`ClosetPage.tsx:148-152`). Weekday entries count one day each (Decision 7), which is what
`plannedDaysFor` already does.

#### 3. Backup carries plans, version stays 1

**File**: `src/features/uploads/backup.ts`
**Changes**:

- Import `PlanEntry` + `isPlanEntry` from `../week/plan` (the file already imports from
  `outfits` and `shuffle` — established direction).
- `BackupFile` and `DecodedBackup` gain `plans: PlanEntry[]`; a comment at
  `BACKUP_VERSION` (`:8`): plans were added **without** a bump (2026-07-31 week-planning
  Decision 8) — old builds ignore the unknown key, and a missing array coerces below.
- `encodeBackup(items, outfits, plans, exportedAt)` — `plans` before `exportedAt`,
  matching the file-shape order.
- `decodeBackup`: `const rawPlans = Array.isArray(file.plans) ? file.plans : [];` (old
  files have none), `plans = rawPlans.filter(isPlanEntry)`, and the dropped count joins
  `skipped`.

**File**: `src/features/uploads/backupFile.ts`
**Changes**:

- `exportBackup` passes `usePlanStore.getState().entries` as the new argument.
- `ImportResult` gains `plansAdded: number`; `importBackup` returns
  `plansAdded: usePlanStore.getState().importEntries(decoded.plans)` — additive,
  slot-keyed, local wins, importing the same file twice adds nothing.

**File**: `src/features/closet/ClosetPage.tsx`
**Changes**: the status parts (`:199-208`) gain, after the outfits line:
`if (result.plansAdded > 0) parts.push(`${result.plansAdded} planned ${result.plansAdded === 1 ? "day" : "days"}`);`

**File**: `src/features/uploads/backup.test.ts`
**Changes**: the three existing `encodeBackup` calls (`:66, :74, :84`) gain a plans
argument (`[]` where plans aren't the subject); `fileWith` (`:114-122`) gains an optional
`plans` param. New cases:

- round-trips all three plan-entry kinds (weekday, dated, skip);
- a file with an invalid plan entry (weekday 7) drops it and counts it in `skipped`,
  keeping the valid ones;
- "treats missing collections as empty" (`:153-157`) now also asserts `plans: []` — the
  old-backup compatibility guarantee;
- the stamp test still shows `version: 1` (the no-bump decision, made visible).

### Success Criteria:

#### Automated Verification:

- [x] Type check passes: `npm run typecheck`
- [x] Lint passes: `npm run lint`
- [x] All tests pass (backup suite deliberately extended, others unmodified): `npm test`
- [x] Build succeeds: `npm run build`
- [x] Formatting is stable: `npm run format` leaves no further diff

#### Manual Verification:

- [ ] Plan an outfit for today (rotation and override each): the Today header shows
      `planned: {name}`; `wear this` loads it onto the canvas; the current shuffle is
      untouched until then; nothing auto-loads on visit.
- [ ] Delete an item worn by the planned outfit, then `wear this` — the repaired outfit
      loads minus the missing piece (the `handleLoad` behavior).
- [ ] A skipped today, and an unplanned today, show no strip; a planned-then-deleted
      outfit shows *that outfit is gone* on Today and on its week row.
- [ ] Deleting a saved outfit planned for 3 days shows `planned for 3 days` under
      `forget this outfit?`; for 1 day, `planned for 1 day`; unplanned outfits show no
      note (and the `wornIn`-style note still appears on closet-item deletes as before).
- [ ] Export with plans → clear site data → import: plans return; the status line counts
      `N planned days`; importing the same file twice adds nothing.
- [ ] Import a pre-plans backup file (or a hand-edited one without `plans`): items and
      outfits import, no error, zero planned days added.

---

## Testing Strategy

### Unit Tests

Three new files (Phase 1) plus the extended backup suite (Phase 5), all node-env pure:

- `plan.test.ts` — `planFor` precedence (the feature's one interesting invariant, as an
  `it.each` table), the assign/clear command semantics including every skip rule,
  `plannedDaysFor`, `isPlanEntry`, `slotKey`.
- `week.test.ts` — `dateKey` (the anti-UTC assertion), `weekOf` monday-start /
  DST-crossing relationships, `addDays` boundaries, `weekRangeLabel`, `weekdayName`.
- `localStoragePlanStore.test.ts` — the transposed outfit-store suite: slot upsert, slot
  clear, never-throw reads, corrupt-storage recovery, cross-instance persistence.
- `backup.test.ts` — plans round-trip, invalid-entry skipping, missing-`plans` coercion.

Style throughout: `describe` per exported function, sentence-style `it` names, `it.each`
with human labels, local fixture builders with a why-comment, relationship assertions for
date-derived values, no mocks. The UI (WeekPage, DayRow, TodayPlan) is deliberately
untested — `.test.ts` only, no component tests, by design (`vite.config.ts:7-12`); its
logic lives in the tested pure functions it calls.

### Manual Testing Steps

1. Run each phase's manual checklist at its gate (Phases 2–5 pause; Phase 2 is a hard
   design gate).
2. End-to-end after Phase 5: plan a full week (rotation + one override + one skip), walk
   prev/next across a month boundary, wear today's plan, delete the planned outfit, watch
   the captions, export/import, all across a couple of themes.
3. Mobile pass at 375px: nav fit, row layout, horizontal picker scroll, pills wrapping.
4. Reduced-motion pass: expansion and captions all function with animations clamped.

## Performance Considerations

Negligible by construction: seven rows resolving via linear scans over an entries list
(bounded by 7 weekday slots + dated entries, ~60 bytes each — Decision 6's math puts a
decade under 250KB), `Array.find` over dozens of saved outfits per `useSavedOutfit`, and
whole-array localStorage writes of a few KB at most. `OutfitPreview` renders ≤ 7 row
previews + ≤ dozens of `loading="lazy"` picker thumbnails from already-minted object URLs.
No new dependencies, no IndexedDB involvement, no change to startup hydration.

## Migration Notes

Nothing existing changes shape: `joyces-closet:plan:v1` is a new key; uploads, saved
outfits, theme, and the current-outfit key are untouched, so there is no migration and no
version bump anywhere (`BACKUP_VERSION` stays 1 by Decision 8 — old builds importing new
backups silently ignore `plans`; new builds importing old backups coerce to `[]`).
Rollback is reverting the commits: plan entries left in localStorage are simply never read
by a reverted build (orphaned-by-design, the house convention), and re-rolling forward
picks them back up. Phases are independently revertible except Phase 4/5's dependence on
Phase 1's domain and Phase 3's dependence on Phase 2's approved values — revert
forward-to-back.

## References

- Design decisions (source of truth):
  `thoughts/shared/decisions/2026-07-31-week-planning.md`
- Research: `thoughts/shared/research/2026-07-31-calendar-outfit-planning.md`
- Store trio to clone: `src/features/outfits/store.ts:3-19`,
  `src/features/outfits/localStorageStore.ts:19-64`,
  `src/features/outfits/useOutfitsStore.ts:24-54`
- Union/guard idiom: `src/features/shuffle/outfit.ts:3-6, 28-50`; reverse lookup
  `outfitUsesItem` `:83-95`; `repairOutfit` `:105-127`
- Resolve seam to mirror: `src/features/closet/closet.ts:14-30`
- Warn/degrade idioms: `src/features/closet/ClosetPage.tsx:51-56, 148-152`;
  `src/features/outfits/OutfitCard.tsx:69-70, 210-214`; `src/components/ConfirmDelete.tsx:8`
- Load-then-wear: `src/features/outfits/OutfitsPage.tsx:26-33`;
  `useShuffleStore.loadOutfit` `src/features/shuffle/useShuffleStore.ts:103`
- Single-id + dismissal: `src/features/outfits/OutfitsPage.tsx:17-20`,
  `src/components/useDismiss.ts:16-40`
- Ribbon family + constraints: `src/components/Ribbon.tsx:3, 50-57, 64-145`;
  `thoughts/shared/decisions/2026-07-30-ui-refinement-ribbons-and-shapes.md` Decisions 2, 3
- Mock-gate precedent:
  `thoughts/shared/plans/2026-07-30-ui-refinement-ribbons-and-shapes.md:125-200`
- Theme blocks: `src/index.css:3-27, 150-242`
- Backup: `src/features/uploads/backup.ts:33-39, 125-156`,
  `src/features/uploads/backupFile.ts:19-24, 41-99`,
  `src/features/uploads/backup.test.ts:66, 74, 84, 114-122, 153-157`
- Timezone idiom: `src/lib/quotes.ts:41-48`; the UTC trap `backup.ts:159-161`
- Test doctrine: `vite.config.ts:7-12`;
  `src/features/outfits/localStorageStore.test.ts:10-18`; `src/lib/quotes.test.ts:12-16`
