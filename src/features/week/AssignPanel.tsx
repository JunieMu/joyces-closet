import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { OutfitPreview } from "../outfits/OutfitCard";
import { useOutfitsStore } from "../outfits/useOutfitsStore";
import { assignCommands, clearCommands, type Scope } from "./plan";
import { usePlanStore } from "./usePlanStore";
import { monthDayLabel, weekdayName } from "./week";

interface AssignPanelProps {
  date: Date;
  /**
   * "pick" opens the outfit picker; "clear" opens straight into the scope question, which is
   * where the day box's ghost × sends a day that has a rotation underneath it.
   */
  mode: "pick" | "clear";
  onDone: () => void;
}

const SCOPE_PILL =
  "border-accent/40 text-accent hover:bg-wash/60 font-body cursor-pointer rounded-full " +
  "border px-4 py-1.5 text-sm transition-colors active:scale-[0.98]";

/**
 * Assignment, inline (Decision 5). Nothing floats — a picker over a grid is the app's
 * documented failure mode (2026-07-30 delete-confirmation Decision 3) — so this needs no
 * z-index at all; it is an ordinary block after the grid and simply pushes the page down.
 *
 * It sits after the whole grid rather than after the tapped day's row, which is exact at xl
 * (7 columns is one row, so "after the grid" IS "under that day) and approximate below it.
 * That is why the heading names the day and the box carries a ring: at 2 columns the panel
 * is up to three rows away from what it belongs to, and neither cue alone would carry.
 *
 * The pending question lives in here rather than on the page, which is what makes both
 * collapsing and switching days a reset: the page keys this by date, so either one unmounts
 * the half-asked question. No effect required.
 */
export function AssignPanel({ date, mode, onDone }: AssignPanelProps) {
  const saved = useOutfitsStore((state) => state.saved);
  const entries = usePlanStore((state) => state.entries);
  const apply = usePlanStore((state) => state.apply);
  // Seeded once, on mount — which is exactly right because the page keys this by mode, so
  // arriving in a different mode is arriving as a different panel.
  const [pending, setPending] = useState<
    { mode: "assign"; outfitId: string } | { mode: "clear" } | null
  >(mode === "clear" ? { mode: "clear" } : null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Opening a day in the top row of a 2-column week puts this three rows below the fold, and
  // a picker you have to go looking for reads as nothing having happened. `nearest` scrolls
  // only when it actually needs to, so the common xl case stays perfectly still. Mount-only:
  // the page remounts this per day, so switching days re-runs it.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    panelRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduced.matches ? "auto" : "smooth",
    });
  }, []);

  const weekday = weekdayName(date);
  const newestFirst = [...saved].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const answer = (scope: Scope) => {
    if (!pending) return;
    // Every rule — skips, "every monday also drops this day's override" — already lives in
    // the command functions. The panel never constructs an entry itself.
    apply(
      pending.mode === "assign"
        ? assignCommands(entries, date, pending.outfitId, scope)
        : clearCommands(entries, date, scope),
    );
    onDone();
  };

  const pendingName =
    pending?.mode === "assign"
      ? saved.find((outfit) => outfit.id === pending.outfitId)?.name
      : undefined;

  return (
    <div
      ref={panelRef}
      className="animate-pop-in paper-card border-ink/10 rounded-2xl border bg-white p-3"
    >
      {/* The heading stays put through the scope question: the day is the one thing that must
          never be in doubt while the panel is detached from its box. */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-body text-ink text-sm font-medium">{weekday}</p>
        <p className="font-body text-ink/45 text-xs">{monthDayLabel(date)}</p>
      </div>

      <div className="border-ink/10 mt-2 border-t pt-3">
        {pending ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-body text-ink/55 mr-1 text-sm">
              {pendingName ? `plan ${pendingName}` : "clear this day"}
            </p>
            <button
              type="button"
              onClick={() => answer("date")}
              className={SCOPE_PILL}
            >
              just this {weekday}
            </button>
            <button
              type="button"
              onClick={() => answer("weekday")}
              className={SCOPE_PILL}
            >
              every {weekday}
            </button>
          </div>
        ) : newestFirst.length === 0 ? (
          <div className="font-body text-ink/55 flex flex-col items-start gap-2 text-sm">
            <p>nothing saved yet.</p>
            <Link
              to="/"
              className="border-accent/40 text-accent hover:bg-wash/60 rounded-full border px-4 py-1.5 transition-colors"
            >
              put an outfit together
            </Link>
          </div>
        ) : (
          /* A wrapping grid that scrolls DOWN, not a horizontal scroller. The row used to run
             off the right edge, which on a wide desktop meant a dozen outfits hidden behind a
             gesture nobody performs with a mouse — sideways is the one direction a trackpad
             swipe and a scroll wheel disagree about. Wrapping spends the panel's full width
             first and only then asks for a scroll, in the direction the page already scrolls.

             auto-fill rather than a column ladder: the cells are the same ~5rem/6rem the
             scroller used, and the panel is free to fit as many as it can — 3 or 4 across a
             375px phone, a dozen-plus across a desktop panel — without the count being
             re-guessed per breakpoint against a sidebar that only exists past `md`.

             The cap is the point of the whole thing: `max-h` keeps a 40-outfit closet from
             pushing the week grid off screen, and lands mid-row often enough that the cut-off
             thumbnails are their own "keep going" cue. Nothing sits below it — the clear
             affordance used to, as 12px grey text under a scroller, and moved to the day box's
             own ghost × (DayBox.tsx) — so the scrollport can end where the panel does. */
          <div className="max-h-80 overflow-y-auto overscroll-contain pr-1">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] sm:gap-3">
              {newestFirst.map((outfit) => (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() =>
                    setPending({ mode: "assign", outfitId: outfit.id })
                  }
                  className="cursor-pointer text-left"
                  aria-label={`plan ${outfit.name} for ${weekday}`}
                >
                  <OutfitPreview saved={outfit} />
                  <p className="font-body text-ink mt-1 truncate text-xs">
                    {outfit.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
