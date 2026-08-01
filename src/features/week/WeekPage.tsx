import { useRef, useState } from "react";

import { Aura } from "../../components/Aura";
import { Ribbon } from "../../components/Ribbon";
import { useDismiss } from "../../components/useDismiss";
import { AssignPanel } from "./AssignPanel";
import { DayBox } from "./DayBox";
import { clearCommands, planFor, weekdayEntryAt } from "./plan";
import { usePlanStore } from "./usePlanStore";
import { addDays, dateKey, weekOf, weekRangeLabel } from "./week";

/** The ghost-control register: quiet until reached for. */
const ARROW =
  "text-ink/45 hover:bg-wash/60 hover:text-accent flex h-7 w-7 cursor-pointer " +
  "items-center justify-center rounded-full text-lg leading-none transition-colors";

/**
 * The week as a calendar of boxes rather than a list of rows, so the box width sets the
 * preview width.
 *
 * Every desktop width gets the real thing: seven columns, one row, the whole week at a
 * glance. `lg` is where that starts, and it is as early as it can start — `md` still pays
 * for `Layout.tsx`'s 17rem sidebar without being any wider than `sm`, leaving a 416px
 * content box that seven columns would cut into 52px slivers. Below `lg` the grid wraps
 * instead and spends the width on the pictures.
 *
 * One row is not free at the bottom of its range: at exactly 1024px it costs each day
 * ~73px, less than the wrapped layout gave. It pays for itself immediately after — a card
 * grows every pixel the window does, and by a 1512px laptop it is back to ~143px.
 *
 * Preview widths, against the fixed 56–64px the old rows allowed:
 * 151px (phone) · 178px (sm) · 114px (md) · 73px (lg) · 109px (1280) · 143px (1512) ·
 * 148px (1600+, where max-w-7xl caps the page).
 */
const GRID =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-7 lg:gap-2";

/**
 * Which day the panel is open for, and which question it is asking. The mode travels with
 * the key because the ghost × can open the panel straight into the scope question, and
 * "clear monday" is a different panel from "plan monday" even though it is the same day.
 */
type Selection = { key: string; mode: "pick" | "clear" };

export function WeekPage() {
  // The anchor names the visible week; the arrows slide it ±7 days, so any date is reachable
  // and past weeks stay browsable and editable (Decision 6). Held in component state rather
  // than the URL or storage: reloading deliberately lands back on the current week.
  const [anchor, setAnchor] = useState(() => new Date());
  const entries = usePlanStore((state) => state.entries);
  const apply = usePlanStore((state) => state.apply);
  // One selection means the one-at-a-time rule falls out for free, as confirmingId does on
  // the outfits page (OutfitsPage.tsx:17-20).
  const [selection, setSelection] = useState<Selection | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  // The dismissal region is the grid AND the panel together, which it has to be now that the
  // panel is a sibling of the grid rather than a child of a row — anything outside this pair
  // is genuinely outside. It also keeps the property the rows relied on: useDismiss fires on
  // pointerdown, so a per-box region would collapse the open day while the finger was still
  // down on another one, the layout would shift under the finger, and the pointerup would
  // land somewhere else entirely. Scoped to the region, a day-to-day handover is an ordinary
  // click and the panel only moves once the new day is already open.
  useDismiss(regionRef, selection === null ? null : () => setSelection(null));

  const days = weekOf(anchor);
  const todayKey = dateKey(new Date());
  // Derived rather than trusted: a selection can only survive as long as its day is on
  // screen, so paging past it cannot leave a panel behind for a day nobody can see.
  const selected = days.find((day) => dateKey(day) === selection?.key) ?? null;

  const step = (delta: number) => {
    setAnchor(addDays(anchor, delta));
    setSelection(null);
  };

  /**
   * The ghost × on a day box. Lives here rather than in the box because clearing is not
   * always one act: when a rotation underlies the day, "just this monday" and "every monday"
   * mean different things and the scope question is a real one, so the panel opens already
   * asking it. With only a dated entry there is nothing to ask about, so the day just goes —
   * and any panel open on another day goes with it, since the grid has moved on.
   */
  const handleClear = (day: Date) => {
    if (weekdayEntryAt(entries, day.getDay())) {
      setSelection({ key: dateKey(day), mode: "clear" });
      return;
    }
    apply(clearCommands(entries, day, "date"));
    setSelection(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          the week
        </h1>
        <Ribbon variant="polka" className="h-6 w-44 sm:h-7 sm:w-52" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-7)}
            aria-label="previous week"
            className={ARROW}
          >
            ‹
          </button>
          <p className="font-body text-ink/55 w-36 text-sm">
            {weekRangeLabel(days)}
          </p>
          <button
            type="button"
            onClick={() => step(7)}
            aria-label="next week"
            className={ARROW}
          >
            ›
          </button>
        </div>
      </header>

      <div ref={regionRef} className="flex flex-col gap-3">
        {/* The band is anchored to the grid, not to the page, so opening the assign panel
            below cannot move or resize it. `relative` WITHOUT `isolate`, deliberately: the
            band has to reach up behind the header (page-auras Decision 8), which a stacking
            context here would paint it over instead of under. */}
        <div className="relative">
          <Aura variant="horizon" />

          {/* No mon/tue/wed header strip above the grid: each box already names its own day,
              and a strip could not survive the two-column phone layout anyway. */}
          <div className={GRID}>
            {days.map((day, index) => {
              const key = dateKey(day);

              return (
                <DayBox
                  key={key}
                  date={day}
                  isToday={key === todayKey}
                  isLast={index === days.length - 1}
                  selected={key === selection?.key}
                  resolution={planFor(day, entries)}
                  // Tapping the open day closes it, but tapping a day the × has opened into
                  // the clear question switches it to picking rather than closing — that is a
                  // change of mind about what to do, not a dismissal.
                  onSelect={() =>
                    setSelection((current) =>
                      current?.key === key && current.mode === "pick"
                        ? null
                        : { key, mode: "pick" },
                    )
                  }
                  onClear={() => handleClear(day)}
                />
              );
            })}
          </div>
        </div>

        {/* Keyed by day AND mode, so switching either remounts — which is what discards a
            half-asked scope question and re-runs the panel's scroll-into-view. The mode
            belongs in the key because a × on the day already open has to reset the panel to
            the clear question, and a prop change alone would leave its state where it was. */}
        {selected && selection && (
          <AssignPanel
            key={`${selection.key}:${selection.mode}`}
            date={selected}
            mode={selection.mode}
            onDone={() => setSelection(null)}
          />
        )}
      </div>
    </div>
  );
}
