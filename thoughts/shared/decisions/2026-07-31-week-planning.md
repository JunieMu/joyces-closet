---
date: 2026-07-31
source: grill-to-decisions
input: thoughts/shared/research/2026-07-31-calendar-outfit-planning.md
status: decided
---

# Design Decisions: Week Planning

The calendar feature the app was founded expecting (2026-07-13 closet-rebuild Decision 1, option D — "data model must be designed so B and D bolt on cleanly later"). Joyce assigns saved outfits to days: a standing weekday rotation ("mondays I wear this") layered under dated overrides ("the 15th is the wedding"). A new `/week` page shows one week at a time; the Today page hands the plan back on the day itself. Plans consume `SavedOutfit` by id, per `thoughts/shared/plans/2026-07-13-closet-rebuild.md:457` ("calendar (consumes `SavedOutfit`)").

## Decision 1: The model is layered — weekday rotation + dated overrides

**Context**: "Day of the week" and "day of the month" are two different data models, not two views of one. Weekday is a bounded 7-slot recurrence; dates are an unbounded log. Supporting only one halves the feature Joyce asked for.
**Options**: A — weekday rotation only: simplest, no month math, but can't plan a specific date · B — dated agenda only: handles specific dates, but every week re-plans Monday from scratch · C — both, layered: weekday entries are the standing rotation, a dated entry overrides that one day.
**Decision**: **C.** A plan entry is a discriminated union on `kind` — `{ kind: "weekday"; weekday: 0–6 }` or `{ kind: "date"; date: "YYYY-MM-DD" }` (local date, never derived via `toISOString()`) — mirroring the house `OutfitBase` shape (`src/features/shuffle/outfit.ts:3-6`). Resolution is one pure function, `planFor(date, plan)`: dated entry wins, else weekday entry, else empty. That precedence rule is the feature's single interesting invariant and is trivially testable under the node-only test doctrine.

## Decision 2: The Today page surfaces today's plan, one tap to wear

**Context**: Planning is only worth doing if the app hands the plan back on the day. The Today page already renders the date (`src/features/shuffle/ShufflePage.tsx:82-88`) — the seam exists.
**Options**: A — Today shows "planned for today" with a one-tap "wear this" that loads the outfit onto the shuffle canvas · B — plan page is self-contained, Today untouched · C — Today auto-loads the planned outfit as the current outfit.
**Decision**: **A.** The payoff loop without C's surprise of stomping whatever shuffle was in progress. "Wear this" goes through `repairOutfit` before `loadOutfit`, exactly as `OutfitsPage.handleLoad` does (`src/features/outfits/OutfitsPage.tsx:26-33`). Nothing auto-loads.

## Decision 3: Assignment flows calendar → outfit only

**Context**: Two possible directions: tap a day then pick an outfit, or a "plan this" action on `OutfitCard` that picks a day.
**Options**: A — day → outfit only · B — outfit → day only · C — both.
**Decision**: **A.** One assignment path keeps v1's interaction surface small, and week-planning naturally starts from the days. "Plan this" on the card is a cheap later addition if outfit-first thinking turns out to be wanted (see Out of Scope).

## Decision 4: Week view only — no month grid in v1

**Context**: A 7-column month grid at 375px yields ~45px cells — narrower than any surface the app has built (tightest today: closet tiles at ~110–160px, 2026-07-30 delete-confirmation Decision 9). Mobile-first is binding (2026-07-13 closet-rebuild Decision 9).
**Options**: A — week view only: seven full-width rows, monday–sunday, prev/next arrows · B — month grid: second layout, tiny cells, answers nothing the week view can't.
**Decision**: **A.** Full-width day rows are the most phone-friendly surface available and dodge the research's hardest constraint entirely. Each row renders the *resolved* plan for its date (override if present, else weekday default). Navigating weeks reaches any date. A desktop month view is its own later slice if ever missed.

## Decision 5: Assignment is an inline row expansion with scope pills

**Context**: A picker floating over a grid is the app's documented failure mode (`thoughts/shared/research/2026-07-30-save-outfit-popover-stacking-bug.md`; 2026-07-30 delete-confirmation Decision 3 rejected popovers on grids — "every later sibling card would paint over it"). The app has no z-index scale.
**Decision**: Tapping a day row expands it inline, accordion-style — revealing a horizontal scroll of saved-outfit thumbnails. Nothing floats, nothing needs a z-index. Because the model is layered, picking an outfit then asks scope with two pills — **"just this monday"** / **"every monday"** (lowercase, weekday name matching the row) — writing a dated override or the weekday slot respectively. Clearing a planned row works the same way, asking the same scope question when both layers apply to that day. `useDismiss` (`src/components/useDismiss.ts`) covers Escape/outside-tap collapse; one row expanded at a time, following the `confirmingId` single-id pattern (`src/features/outfits/OutfitsPage.tsx:20`).

## Decision 6: Past entries are kept forever; past weeks stay browsable and editable

**Context**: Dated entries are ~60 bytes; a decade of daily planning is under 250KB — localStorage-safe. Pruning is code and a policy; keeping is neither.
**Options**: A — prune on write/read · B — keep forever.
**Decision**: **B.** Past weeks remain scrollable and render what was planned — a quiet de facto wear log. Editing the past is pointless but harmless; allowing it is simpler than building a guard, so no guard.

## Decision 7: Deleting a planned outfit — warn before, degrade after, never cascade

**Context**: The app never cascades deletes (2026-07-27 clothing-image-upload Decision 10: saved outfits keep dangling item ids forever; repair is transient). A plan referencing a deleted `SavedOutfit` has no repair analogue — you can't substitute "some other outfit" for a day.
**Decision**: Both established moves, at the new level:
- The outfit's `forget this outfit?` confirmation gains a note — **"planned for 3 days"** — via `ConfirmDelete`'s existing `note` prop (`src/components/ConfirmDelete.tsx:5-21`), mirroring `worn in 3 outfits` (`src/features/closet/ClosetPage.tsx:51-56`). Weekday entries count as 1 day each for this note.
- Afterward, a day row holding a dead id renders a quiet italic caption — *"that outfit is gone"* — in the register of "Some items are no longer in the closet" (`src/features/outfits/OutfitCard.tsx:210-214`). Silent emptiness would look like nothing was ever planned; the caption is honest. The plan entry stays on disk untouched.

## Decision 8: Backup carries plans; `BACKUP_VERSION` stays 1

**Context**: The backup file (`src/features/uploads/backup.ts:33-39`) doesn't know about plans. Bumping the version makes old builds reject new files outright (`backup.ts:139-140`).
**Options**: A — add a `plans` field, stay at version 1: old builds ignore the unknown key; new builds importing old files coerce the missing array to `[]` · B — bump to version 2: old builds reject new files with a clear message.
**Decision**: **A.** Both directions degrade gracefully. The only cost — an old build re-exporting silently drops plans — is a non-issue for a single-user, per-browser app. Import merges plans additively and id-keyed, same as outfits (`src/features/outfits/useOutfitsStore.ts:42-53`).

## Decision 9: Named "week" — route `/week`, nav "week", h1 "the week"

**Context**: The nav label must fit the crowded 375px mobile header alongside today/outfits/closet + the theme button. "Calendar" oversells now that there's no month grid; "plan" names intent rather than what's on screen.
**Decision**: Route **`/week`**, nav label **"week"** added to both navs (desktop sidebar `src/components/Layout.tsx:30-40`, mobile header `:68-79` — the both-navs precedent from 2026-07-27 clothing-image-upload Decision 4). Page h1 is **"the week"** with a muted subline showing the visible range ("jul 27 – aug 2"), the same h1+subline pattern as the closet's item count (`src/features/closet/ClosetPage.tsx:274-285`).

## Decision 10: A fourth ribbon — polka dot on a new `--color-accent-4`

**Context**: The ribbon family is fixed at one per page, one accent token each (2026-07-30 ribbons-and-shapes Decision 3), and all three tokens are spoken for. `Ribbon.tsx` types exactly `"plaid" | "gingham" | "stripe"`.
**Options**: A — reuse an existing token/variant, breaking one-per-page symmetry · B — new variant + new token.
**Decision**: **B.** Add `--color-accent-4` to the `@theme` block and all five theme presets (`src/index.css:150, 168, 187, 206, 225`), and give `/week` a new **polka-dot** weave (reads at ribbon scale, distinct from plaid/gingham/stripe — and dots-as-days is a happy accident). All existing SVG constraints bind (2026-07-30 ribbons-and-shapes Decision 2): inline SVG, `style={{ fill: "var(--color-accent-4)" }}` not the `fill` attribute, `useId()`-scoped pattern ids, no `feDisplacementMap`. The exact weave goes through a mock-and-sign-off gate before app code, per the ribbons-and-shapes plan's Phase 1 precedent.

## Codebase Findings

Things the planner should know, surfaced while grilling (full detail in the research doc):

- **The store to clone**: `OutfitStore`/`createLocalStorageOutfitStore`/`useOutfitsStore` (`src/features/outfits/store.ts:3-19`, `localStorageStore.ts:19-43`, `useOutfitsStore.ts:8-40`) — injectable `StorageLike`, reads never throw, whole-array writes, persist-first-then-mirror, no persist middleware. Key: `joyces-closet:plan:v1`.
- **No `main.tsx` change**: a localStorage store seeds synchronously at module init (`useOutfitsStore.ts:25` precedent); the load-bearing hydration ordering is untouched.
- **The UTC trap**: `backup.ts:159-161` uses `toISOString().slice(0,10)` — harmless for filenames, a date-shifting bug for plan keys (after ~7pm Central it yields tomorrow). Build date keys from `getFullYear()/getMonth()/getDate()`; the local-day idiom lives at `src/lib/quotes.ts:41-48`.
- **No `useSavedOutfit(id)` seam exists** — `useOutfitsStore` exposes only `saved: SavedOutfit[]`. The resolve-seam pattern to mirror is `getItem`/`useClosetItem` (`src/features/closet/closet.ts:14-30`) with `buildIndex`-style derived state (`src/features/closet/merge.ts:27-33`).
- **`planUsesOutfit` analogue**: template is `outfitUsesItem` (`src/features/shuffle/outfit.ts:83-95`), consumed the way `wornIn` is (`ClosetPage.tsx:51-56`).
- **`isSavedOutfit` is duplicated** (`localStorageStore.ts:8-17`, `backup.ts:90-100`) — one reason plans are a separate store, not a field on `SavedOutfit`. A plan-entry guard will be needed for both the store read and backup import.
- **Test doctrine**: `environment: "node"`, `src/**/*.test.ts` only, no mocks/`vi` anywhere; dates always parameters, never mocked (`naming.test.ts`, `quotes.test.ts:12-16` — assert relationships between days, not absolutes). Pure modules to extract: week-window math, local date keys, `planFor` precedence, `planUsesOutfit`, the store against `fakeStorage()`.
- **Decision numbering restarts per doc** — this doc's numbers are qualified elsewhere as "2026-07-31 week-planning Decision N".

## Out of Scope

- **Month grid** — week view only; a desktop month view is its own later slice (Decision 4).
- **"Plan this" from `OutfitCard`** — outfit → day assignment deferred (Decision 3).
- **Auto-loading the planned outfit on Today** — rejected; one-tap wear only (Decision 2).
- **Wear-log surfacing** — past weeks are browsable, but no dedicated history view, stats, or "worn N times" anywhere.
- **Pruning/retention logic and past-week edit guards** — keep forever, allow everything (Decision 6).
- **Cascade or on-disk repair of plan entries** — never (Decision 7).
- **`BACKUP_VERSION` bump** — stays 1 (Decision 8).
- **Nav restructure for mobile crowding** — "week" fits; revisit only if a fifth page ever appears.
- **Drag-and-drop assignment, multi-outfit days, notes on days** — none of it in v1.
