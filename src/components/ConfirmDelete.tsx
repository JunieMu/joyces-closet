import { useEffect, useId, useRef } from "react";

import { Ribbon } from "./Ribbon";

interface ConfirmDeleteProps {
  question: string;
  /** A quiet second line — omitted entirely when there is nothing to say. */
  note?: string;
  /** The honest verb, never a euphemism: "forget it" / "remove". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Closet-tile sizing (Decision 9): explicit, not a container query. */
  compact?: boolean;
  /**
   * Play the exit instead of the entrance. Comes as a pair with `onClosed` — the caller keeps
   * this mounted through the fade, and `onClosed` is what finally takes it down.
   */
  closing?: boolean;
  onClosed?: () => void;
}

/**
 * The basting stitch (Decision 8): the card looks basted for taking apart. Same needle as the
 * closet section headers — RunningStitch.tsx:24's exact `7 6` rhythm and round cap — rather than
 * a CSS `border-dashed`, which is a machine dash with square ends and a different rhythm.
 *
 * The rect has to stretch to a card of unknown aspect, and `preserveAspectRatio="none"` would
 * ordinarily stretch the dashes with it. `vector-effect="non-scaling-stroke"` moves stroking into
 * screen space, so the 1.6 width and the 7/6 rhythm stay in CSS pixels at any card size — the
 * same on-screen values RunningStitch produces at its natural scale, where its 1200x8 viewBox at
 * h-2 makes one user unit about one pixel. Only the corner radius goes slightly elliptical, which
 * is invisible at this size and reads as hand-sewn anyway.
 */
function BastingStitch({ compact }: { compact: boolean }) {
  const inset = compact ? 4 : 2.5;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="text-accent/45 pointer-events-none absolute inset-0 h-full w-full"
    >
      <rect
        x={inset}
        y={inset}
        width={100 - inset * 2}
        height={100 - inset * 2}
        rx="4"
        ry="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="7 6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The card confirming itself (2026-07-30 Decision 3). Absolutely positioned inside the card's own
 * relative box, so it never escapes it: no z-index negotiation with sibling cards, the sticky
 * sidebar, or the shuffle canvas, and the item stays visible behind the question — the one thing
 * a centered modal structurally cannot do.
 *
 * Not modal and deliberately not focus-trapped (Decision 11): Escape and click-outside are the
 * exits, and trapping focus in a non-modal in-card panel causes more problems than it solves.
 */
export function ConfirmDelete({
  question,
  note,
  confirmLabel,
  onConfirm,
  onCancel,
  compact = false,
  closing = false,
  onClosed,
}: ConfirmDeleteProps) {
  const questionId = useId();
  const noteId = useId();
  const keepRef = useRef<HTMLButtonElement>(null);

  // `keep` takes focus on open (Decision 11). An effect rather than `autoFocus`
  // (OutfitActions.tsx:143's pattern) because cancelling no longer unmounts this immediately:
  // reopening during the 150ms fade reuses the same element, and autoFocus only ever fires on
  // mount, so the second open would leave focus behind on the × trigger.
  useEffect(() => {
    if (!closing) keepRef.current?.focus();
  }, [closing]);

  // animationend bubbles, and this same handler sees the entrance — so it acts only on this
  // element's own exit.
  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (closing) onClosed?.();
  };

  return (
    <div
      role="alertdialog"
      aria-labelledby={questionId}
      aria-describedby={note ? noteId : undefined}
      // On the way out it is already answered: hidden from screen readers, and click-through
      // so the card underneath is live again the instant the user cancels rather than 150ms later.
      aria-hidden={closing || undefined}
      onAnimationEnd={handleAnimationEnd}
      className={`confirm-wash bg-paper/70 absolute inset-0 flex flex-col items-center justify-center rounded-2xl text-center backdrop-blur-[2px] ${
        closing ? "animate-pop-out pointer-events-none" : "animate-pop-in"
      } ${compact ? "gap-1 px-1" : "gap-2 px-3"}`}
    >
      <BastingStitch compact={compact} />

      {/* No name echo (Decision 4): window.confirm had to quote the item because the dialog
          floated away from the card. In-card the name is already directly below, and re-quoting
          it wraps badly at closet-tile width. The trigger's aria-label still carries it. */}
      <p
        id={questionId}
        className={`font-display text-ink ${compact ? "text-xs" : "text-sm"}`}
      >
        {question}
      </p>

      {/* One flourish, and the text is beside it rather than on it — legibility over a woven
          band at this size was considered and rejected (Decision 8). */}
      {!compact && <Ribbon variant="stripe" className="h-2.5 w-16" />}

      {note && (
        <p
          id={noteId}
          className={`font-body text-ink/55 ${compact ? "text-[10px]" : "text-xs"}`}
        >
          {note}
        </p>
      )}

      {/* `keep` is the filled pill and holds initial focus; the destructive verb is quiet ghost
          text. This inverts the usual primary/secondary reflex on purpose (Decision 5): with no
          alarm token in any theme both buttons are accent-family, so the safe choice is where
          both the eye and the Enter key land.

          flex-wrap is the safety valve at the narrowest closet-tile width (~110px on a phone at
          grid-cols-3), where two pills side by side are just about the limit. */}
      <div
        className={`flex flex-wrap items-center justify-center ${compact ? "gap-1" : "gap-2"}`}
      >
        <button
          ref={keepRef}
          type="button"
          onClick={onCancel}
          className={`btn-painterly bg-accent text-paper font-body hover:bg-accent/90 cursor-pointer rounded-full font-medium shadow-sm transition active:scale-[0.98] ${
            compact ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-sm"
          }`}
        >
          keep
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`font-body text-ink/55 hover:text-accent cursor-pointer rounded-full transition ${
            compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-sm"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
