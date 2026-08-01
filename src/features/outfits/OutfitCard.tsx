import { useRef, useState } from "react";

import { ConfirmDelete } from "../../components/ConfirmDelete";
import { useDismiss } from "../../components/useDismiss";
import { useCloset, useClosetItem } from "../closet/closet";
import type { ClosetItem } from "../closet/types";
import { isOutfitValid } from "../shuffle/outfit";
import { plannedDaysFor } from "../week/plan";
import { usePlanStore } from "../week/usePlanStore";
import type { SavedOutfit } from "./store";

interface OutfitCardProps {
  saved: SavedOutfit;
  /** Page state (Decision 10) — one id at a time, so opening a second closes the first. */
  confirming: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
}

/** Scrapbook variety (user decision): each card keeps one tint, keyed off its id. */
const WASH_CLASSES = [
  "wash-tops",
  "wash-bottoms",
  "wash-dresses",
  "wash-jackets",
  "wash-shoes",
  "wash-accessories",
];

function washClass(id: string): string {
  let hash = 0;
  for (const char of id)
    hash = (hash + char.charCodeAt(0)) % WASH_CLASSES.length;
  return WASH_CLASSES[hash] ?? "wash-tops";
}

/**
 * Bottoms arrive on one of two canvases: long ones on the pipeline's TALL 1080x2000, shorts and
 * skirts on the SQUARE 1080x1080 (uploads/pipeline/constants.ts). A single box cannot flatter
 * both — contain-fitting a 0.54-aspect image into the wide short-bottom box left it using only
 * 45% of the available width, which is why saved pants read as tiny next to the tops while
 * shorts looked right. Each canvas gets a box shaped like it instead: the card's equivalent of
 * what RAIL_FRAME does for the shuffle rails.
 *
 * The long box reaches 96% of the card height. Nothing sits under it — both small slots are in
 * the lower corners — so a full-length leg simply runs to the card's lower edge.
 */
const BOTTOM_BOX = {
  long: "top-[38%] left-1/2 h-[58%] w-[42%] -translate-x-1/2",
  short: "top-[42%] left-1/2 h-[40%] w-[64%] -translate-x-1/2",
} as const;

/** Which canvas an item was normalized onto. Unknown dimensions read as the square one. */
function isTallCanvas(item: ClosetItem | undefined): boolean {
  return (
    item?.width !== undefined &&
    item.height !== undefined &&
    item.height > item.width
  );
}

function Thumbnail({
  id,
  className,
}: {
  id: string | null;
  className: string;
}) {
  const item = useClosetItem(id);
  if (!item) return null;

  return (
    <img
      src={item.image}
      alt={item.name}
      loading="lazy"
      className={`absolute object-contain ${className}`}
    />
  );
}

/**
 * A mini paper doll: jacket behind the top (or dress), bottom below, and the two small slots
 * in the lower corners — accessory left, shoes right (user decision). Exported because the
 * week page reuses it for both the day rows and the assignment picker's thumbnails
 * (2026-07-31 week-planning): a planned day should look like the outfit it plans.
 */
export function OutfitPreview({ saved }: { saved: SavedOutfit }) {
  const { base, jacketId, shoesId, accessoryId } = saved.outfit;

  // Resolved here rather than inside Thumbnail because the bottom's canvas picks its box.
  // Called unconditionally — the hook takes null — so the separates/dress branch below stays
  // a plain expression.
  const bottom = useClosetItem(
    base.kind === "separates" ? base.bottomId : null,
  );
  const bottomBox = isTallCanvas(bottom) ? BOTTOM_BOX.long : BOTTOM_BOX.short;

  return (
    <div className="relative aspect-3/4 w-full">
      <Thumbnail
        id={jacketId}
        className="top-0 left-0 h-[46%] w-[58%] opacity-90"
      />

      {base.kind === "separates" ? (
        <>
          <Thumbnail
            id={base.topId}
            className="top-0 right-0 h-[46%] w-[58%]"
          />
          <Thumbnail id={base.bottomId} className={bottomBox} />
        </>
      ) : (
        <Thumbnail
          id={base.dressId}
          className="top-0 left-1/2 h-[76%] w-[70%] -translate-x-1/2"
        />
      )}

      <Thumbnail id={shoesId} className="right-0 bottom-0 h-[18%] w-[38%]" />
      <Thumbnail id={accessoryId} className="bottom-0 left-0 h-[22%] w-[30%]" />
    </div>
  );
}

export function OutfitCard({
  saved,
  confirming,
  onLoad,
  onDelete,
  onRequestConfirm,
  onCancelConfirm,
}: OutfitCardProps) {
  const closet = useCloset();
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);
  // Purely "keep the layer mounted a moment longer so it can fade": page state has already
  // let go of this card by then, which is what lets a handover to another card play both
  // halves at once — this one fading out while that one pops in.
  const [closing, setClosing] = useState(false);

  // Deleting a planned outfit warns rather than cascades (2026-07-31 week-planning
  // Decision 7) — there is no substitute outfit to repair a day with. Subscribing every card
  // to `entries` is free in practice: plans cannot change from this page, so the list never
  // changes under it.
  const entries = usePlanStore((state) => state.entries);
  const plannedFor = plannedDaysFor(entries, saved.id);

  const complete = isOutfitValid(saved.outfit, closet);
  const created = new Date(saved.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const cancel = () => {
    onCancelConfirm();
    setClosing(true);
    triggerRef.current?.focus();
  };

  // The dismissal region is the whole CARD, not the confirm layer: the × sits above the layer
  // (it carries z-10, the layer does not), so if it were "outside" then clicking it would close
  // via this hook and immediately reopen via its own handler. Inside the card, the × is simply
  // a toggle and the two never fight.
  //
  // Switched off once `leaving` is true — a stray click during the 200ms exit must not unmount
  // the layer out from under an animation that is about to fire the delete.
  useDismiss(cardRef, confirming && !leaving ? cancel : null);

  // animationend BUBBLES: without the target guard, the confirm layer's own pop-in would fire
  // the delete the instant the confirmation opens.
  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (leaving) onDelete();
  };

  return (
    <div
      ref={cardRef}
      onAnimationEnd={handleAnimationEnd}
      className={`group border-ink/10 paper-card card-wash ${washClass(saved.id)} relative rounded-2xl border bg-white p-3 shadow-sm transition ${
        leaving ? "animate-card-leave" : ""
      } ${confirming ? "" : "hover:-translate-y-0.5 hover:shadow-painterly"}`}
    >
      {/* Ghost delete. Hidden until hover/focus on a mouse-driven desktop; on any touch screen
          (including a tablet past the md breakpoint) it stays visible — there is no hover there.
          While confirming it becomes the close button: it is painted above the layer, so leaving
          it inert would read as broken. `md:focus:` joins `md:focus-visible:` because cancelling
          with the mouse returns focus here programmatically, which does not match focus-visible. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={confirming ? cancel : onRequestConfirm}
        aria-label={`Delete ${saved.name}`}
        aria-expanded={confirming}
        className="text-ink/35 hover:bg-wash/60 hover:text-accent absolute top-2 right-2 z-10 h-7 w-7 cursor-pointer rounded-full text-lg leading-none transition md:pointer-fine:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100"
      >
        ×
      </button>

      {/* Disabled while confirming (Decision 6): the layer already blocks the pointer, but a
          near-miss Enter on a tabbed-to card would otherwise navigate away from the question. */}
      <button
        type="button"
        onClick={onLoad}
        disabled={confirming}
        className="block w-full cursor-pointer text-left"
        aria-label={`Wear ${saved.name}`}
      >
        <OutfitPreview saved={saved} />

        <p className="font-body text-ink mt-2 truncate text-sm font-medium">
          {saved.name}
        </p>
        <p className="font-body text-ink/45 text-xs">{created}</p>
        {!complete && (
          <p className="font-body text-accent/70 mt-1 text-xs italic">
            Some items are no longer in the closet
          </p>
        )}
      </button>

      {/* The copy is accurate on purpose: the record disappears, the clothes do not.
          `closing` is derived, not stored: if this is still rendered while page state has moved
          on, it is on its way out. Reopening mid-fade therefore just flips it back to the
          entrance on the element already there. */}
      {(confirming || closing) && (
        <ConfirmDelete
          question="forget this outfit?"
          note={
            plannedFor > 0
              ? `planned for ${plannedFor} ${plannedFor === 1 ? "day" : "days"}`
              : undefined
          }
          confirmLabel="forget it"
          closing={!confirming}
          onClosed={() => setClosing(false)}
          onConfirm={() => setLeaving(true)}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
