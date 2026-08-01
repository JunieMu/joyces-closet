import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Escape + click-outside for a transient panel. Passing `null` attaches nothing — that is what
 * lets a card keep its confirmation mounted through the exit animation without a stray click
 * cancelling a delete that is already in flight.
 *
 * The pointer listener is `pointerdown`, deliberately, not `click`. React dispatches its
 * synthetic click at the root container, which is BELOW document, so a document-level click
 * listener runs AFTER the handler that opened the next panel and would immediately close it
 * again — a second card could never take over from the first. `pointerdown` runs before both,
 * so the handover comes out closed-then-opened. It also means the interaction that opened a
 * panel cannot dismiss it, since this listener does not exist yet when that pointerdown fires.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: (() => void) | null,
): void {
  useEffect(() => {
    if (onDismiss === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) return;
      onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, onDismiss]);
}
