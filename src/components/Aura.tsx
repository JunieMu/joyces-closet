import type { ItemCategory } from "../features/closet/types";

/** The closet's seven section pools, each in its own category tint (page-auras Decision 10). */
const POOL_TINT: Record<ItemCategory, string> = {
  tops: "aura-pool-tops",
  bottoms: "aura-pool-bottoms",
  dresses: "aura-pool-dresses",
  jackets: "aura-pool-jackets",
  bags: "aura-pool-bags",
  shoes: "aura-pool-shoes",
  accessories: "aura-pool-accessories",
};

/**
 * `category` belongs to the pool variant alone; `?: never` on the others makes passing it
 * anywhere else a type error rather than a silently ignored prop.
 */
type AuraProps =
  | { variant: "stage" | "horizon" | "gallery"; category?: never }
  | { variant: "pool"; category?: ItemCategory };

/**
 * Each page's light (2026-07-31 page-auras). One DOM shape across all four variants — the
 * container positions and blooms, the children carry colour and breathe — so the auras stay
 * one family and the reduced-motion kill switch stays two selectors per variant.
 *
 * `stage` emits Today's existing markup VERBATIM (Decision 14): Today's CSS is not touched
 * by this slice and its aura must be pixel-identical afterwards. ShufflePage keys this
 * component on the cascade tick, which remounts it and replays aura-bloom on Shuffle All —
 * the one reactive aura in the app (Decision 4).
 *
 * Every variant is pure decoration and stays out of the accessibility tree. None of them
 * reads from a store or takes a data-derived condition: an aura is a property of the page,
 * not of its data (Decision 11).
 */
export function Aura(props: AuraProps) {
  if (props.variant === "stage")
    return (
      <div className="aura" aria-hidden="true">
        <div className="aura-blob-1" />
        <div className="aura-blob-2" />
        <div className="aura-blob-3" />
      </div>
    );

  if (props.variant === "horizon")
    return (
      <div className="aura-horizon" aria-hidden="true">
        <div />
      </div>
    );

  if (props.variant === "gallery")
    return (
      <div className="aura-gallery" aria-hidden="true">
        <div className="aura-gallery-1" />
        <div className="aura-gallery-2" />
      </div>
    );

  // No category = the closet's own header pool, in the gingham thread.
  return (
    <div
      className={`aura-pool ${
        props.category ? POOL_TINT[props.category] : "aura-pool-header"
      }`}
      aria-hidden="true"
    >
      <div />
    </div>
  );
}
