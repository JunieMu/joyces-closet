import { OutfitPreview } from "../outfits/OutfitCard";
import { useSavedOutfit } from "../outfits/useOutfitsStore";
import type { PlanResolution } from "./plan";
import { dayMark, monthDayLabel, weekdayName, weekdayShort } from "./week";

interface DayBoxProps {
  date: Date;
  isToday: boolean;
  /** The week's seventh box, which takes the remainder of its row — see the span ladder. */
  isLast: boolean;
  /** Page state — one day at a time, so opening a second closes the first. */
  selected: boolean;
  resolution: PlanResolution;
  onSelect: () => void;
  /** Clears outright, or opens the panel already asking the scope question — see WeekPage. */
  onClear: () => void;
}

/**
 * One day of the week as a box. The box width sets the preview width, which is the whole
 * reason for the grid: the old full-width rows pinned the preview to a fixed `w-14 sm:w-16`
 * beside a line of text, so the outfit was the smallest thing on a row about the outfit.
 *
 * A div rather than a button, even though the whole face is tappable: the ghost × is a
 * second, separate action, and a button inside a button is invalid HTML with no working
 * semantics. Same shell-plus-two-buttons shape as OutfitCard (OutfitCard.tsx:182-226).
 */
export function DayBox({
  date,
  isToday,
  isLast,
  selected,
  resolution,
  onSelect,
  onClear,
}: DayBoxProps) {
  const outfitId = resolution.source === "none" ? null : resolution.outfitId;
  const saved = useSavedOutfit(outfitId);

  // The last box closes the week: seven never divides evenly into 2 or 3 columns, so rather
  // than leave a hole it takes the rest of its row. Its preview is then pinned back to
  // roughly one column's width so no day's outfit renders bigger than another's just for
  // landing last; the extra width is air. At lg the grid is 7 across and none of it applies.
  //
  // Position, deliberately, rather than naming a weekday: the week's start day lives in
  // weekOf() alone, and moving it must not silently strand this in the middle of a row.

  // The rotation badge cannot be text in a 73px box, so it is a dot — which is also the week
  // page's own motif, its ribbon being the polka one. Being decoration it stays out of the
  // accessibility tree; the label below says "every monday" in words instead.
  const recurring = resolution.source === "weekday";

  // A day worth clearing is one showing something — a resolved outfit or the dead-id
  // caption. A skip is already clear, and an unplanned day has nothing to take away.
  const planned = outfitId !== null;

  const label = [
    `plan ${weekdayName(date)}, ${monthDayLabel(date)}`,
    saved && `wearing ${saved.name}`,
    saved && recurring && `every ${weekdayName(date)}`,
    planned && !saved && "that outfit is gone",
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div
      // Both today branches carry a border colour and a background: emitting one or the other,
      // rather than layering an override, keeps this out of Tailwind's source-order lottery.
      // The selected ring is a third property entirely, so it composes with either — which it
      // has to, since today is the day most likely to be tapped, and accent cannot separate
      // the two states by hue (every preset is light, 2026-07-17 Decision 2).
      className={`paper-card group relative rounded-2xl border p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-painterly ${
        isToday ? "border-accent/40 bg-wash/40" : "border-ink/10 bg-white"
      } ${selected ? "ring-accent/50 ring-2" : ""} ${
        isLast ? "col-span-2 sm:col-span-3 lg:col-span-1" : ""
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        aria-label={label}
        className="block w-full cursor-pointer text-left"
      >
        {/* Weekday and date sit together on the left so the top-right corner belongs to the ×
            alone. Right-aligning the date the way a wall calendar does would put it under a
            button that is permanently visible on any touch screen. */}
        <div className="flex items-center gap-1">
          <span className="font-body text-ink shrink-0 text-xs font-medium">
            {weekdayShort(date)}
          </span>
          {recurring && (
            <span
              aria-hidden="true"
              className="bg-accent/50 h-1.5 w-1.5 shrink-0 rounded-full"
            />
          )}
          <span className="font-body text-ink/45 truncate text-xs">
            {dayMark(date)}
          </span>
        </div>

        {/* OutfitPreview is aspect-3/4 w-full, so this wrapper is what sizes it — and the
            empty state matches its aspect exactly, which is what keeps a week of unplanned
            days from having ragged row heights. */}
        <div
          className={`mt-1.5 ${
            isLast ? "mx-auto w-1/2 sm:w-1/3 lg:w-full" : "w-full"
          }`}
        >
          {saved ? (
            <OutfitPreview saved={saved} />
          ) : (
            <div className="relative aspect-3/4 w-full">
              {/* A skip looks exactly like an unplanned day on purpose: the difference
                  between "nothing here" and "deliberately nothing here" matters to the
                  assign/clear flows, never to the eye. A dead id gets no plus — the day IS
                  planned, and the caption below is what says what happened to it. */}
              {!planned && (
                <span
                  aria-hidden="true"
                  className="text-ink/20 group-hover:text-accent/50 absolute inset-0 flex items-center justify-center text-2xl leading-none transition-colors"
                >
                  +
                </span>
              )}
            </div>
          )}
        </div>

        {/* Fixed height, always rendered: without it a row of two unplanned days would sit
            shorter than a row with names on it, and the grid would come out ragged. */}
        <div className="mt-1.5 h-4">
          {saved ? (
            <p className="font-body text-ink truncate text-xs">{saved.name}</p>
          ) : (
            // The plan is never repaired on disk and never cascades (Decision 7) — there is
            // no "some other outfit" to substitute for a day. So the box says what happened,
            // in the register of OutfitCard's missing-items caption. Going quietly empty
            // would read as never planned.
            planned && (
              <p className="font-body text-accent/70 truncate text-[0.65rem] italic">
                that outfit is gone
              </p>
            )
          )}
        </div>
      </button>

      {/* Ghost clear, on OutfitCard's exact terms (OutfitCard.tsx:195-204): hidden until
          hover or focus on a mouse-driven desktop, permanently visible on any touch screen —
          including a tablet past the md breakpoint — because there is no hover there. The
          previous affordance was 12px grey text below a horizontal scroller, a ~76x16 target
          that failed even WCAG's 24x24 minimum; this is a 28px circle at the card's corner. */}
      {planned && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`clear ${weekdayName(date)}, ${monthDayLabel(date)}`}
          className="text-ink/35 hover:bg-wash/60 hover:text-accent absolute top-1 right-1 h-7 w-7 cursor-pointer rounded-full text-lg leading-none transition md:pointer-fine:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}
