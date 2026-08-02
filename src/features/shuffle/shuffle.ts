import type { Closet, ClosetItem } from "../closet/types";
import type { Rng } from "../../lib/rng";
import type { Outfit, OutfitBase } from "./outfit";

export type SlotName =
  "base" | "top" | "bottom" | "jacket" | "bag" | "shoes" | "accessory";

/** Uniform index in [0, n). Clamped so an `rng` that ever returns exactly 1 can't overflow. */
function rollIndex(n: number, rng: Rng): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

function at(items: ClosetItem[], index: number): ClosetItem {
  const item = items[index];
  if (!item)
    throw new Error(
      `Closet index ${index} out of range (length ${items.length})`,
    );
  return item;
}

/** Uniform over the items. Throws when empty — only used for required slots. */
function pickRequired(items: ClosetItem[], rng: Rng, slot: string): ClosetItem {
  if (items.length === 0)
    throw new Error(`Cannot shuffle ${slot}: no items in the closet`);
  return at(items, rollIndex(items.length, rng));
}

/**
 * Uniform over `items.length + 1` options, the extra one being "none" (Decision 7).
 * 3 jackets ⇒ a 1-in-4 chance of no jacket, matching the old app's `none.png` slot.
 *
 * Bags splitting out of accessories (2026-08-02 Decision 1) made this two independent rolls
 * where there was one, and that arithmetic change is the POINT of the feature, not a side
 * effect: bare-flank outfits get rarer — `1/((a+1)(b+1))` instead of `1/(a+b+1)` — and each
 * individual bag appears far more often, since it now competes against the other bags rather
 * than against every accessory.
 */
function pickOptional(items: ClosetItem[], rng: Rng): ClosetItem | null {
  const index = rollIndex(items.length + 1, rng);
  return index < items.length ? at(items, index) : null;
}

/**
 * Pool-proportional base (Decision 8): one roll over every wearable combination —
 * `tops × bottoms` separates plus `dresses` dresses — so a dress is picked with
 * probability proportional to how many dresses there are. Zero dresses ⇒ probability 0.
 */
function shuffleBase(closet: Closet, rng: Rng): OutfitBase {
  const { tops, bottoms, dresses } = closet;
  const combos = tops.length * bottoms.length;
  const total = combos + dresses.length;
  if (total === 0)
    throw new Error("Cannot shuffle: the closet has no wearable base");

  const roll = rollIndex(total, rng);
  if (roll < combos) {
    return {
      kind: "separates",
      topId: at(tops, Math.floor(roll / bottoms.length)).id,
      bottomId: at(bottoms, roll % bottoms.length).id,
    };
  }
  return { kind: "dress", dressId: at(dresses, roll - combos).id };
}

/** The categories that must be filled before an outfit exists — what the empty state asks for. */
export type MissingCategory = "tops" | "bottoms" | "shoes";

/**
 * What the closet still needs before a complete outfit can be built. Empty ⇒ it can dress.
 *
 * The closet is upload-only, so "not yet" is an ordinary state — a first visit, or deleting
 * the last pair of shoes — not an error.
 */
export function missingForOutfit(closet: Closet): MissingCategory[] {
  const missing: MissingCategory[] = [];

  // A dress fills the top and bottom slots at once, so a closet with one needs neither.
  const hasBase =
    closet.tops.length * closet.bottoms.length + closet.dresses.length > 0;
  if (!hasBase) {
    if (closet.tops.length === 0) missing.push("tops");
    if (closet.bottoms.length === 0) missing.push("bottoms");
  }
  if (closet.shoes.length === 0) missing.push("shoes");

  return missing;
}

/**
 * Whether a complete outfit can be built at all. Callers check this instead of catching; the
 * throws above stay as internal invariant guards, unreachable once this has returned true.
 */
export function canDress(closet: Closet): boolean {
  return missingForOutfit(closet).length === 0;
}

/** Null when the closet can't dress anyone — the same convention as `repairOutfit`. */
export function shuffleOutfit(closet: Closet, rng: Rng): Outfit | null {
  if (!canDress(closet)) return null;

  return {
    base: shuffleBase(closet, rng),
    jacketId: pickOptional(closet.jackets, rng)?.id ?? null,
    bagId: pickOptional(closet.bags, rng)?.id ?? null,
    shoesId: pickRequired(closet.shoes, rng, "shoes").id,
    accessoryId: pickOptional(closet.accessories, rng)?.id ?? null,
  };
}

/** Re-rolls a single slot; every other slot is carried over untouched. Never mutates. */
export function shuffleSlot(
  outfit: Outfit,
  slot: SlotName,
  closet: Closet,
  rng: Rng,
): Outfit {
  switch (slot) {
    case "base":
      return { ...outfit, base: shuffleBase(closet, rng) };

    case "top":
      // Top and bottom only exist in separates mode; on a dress base this is a no-op.
      if (outfit.base.kind !== "separates") return outfit;
      return {
        ...outfit,
        base: {
          ...outfit.base,
          topId: pickRequired(closet.tops, rng, "top").id,
        },
      };

    case "bottom":
      if (outfit.base.kind !== "separates") return outfit;
      return {
        ...outfit,
        base: {
          ...outfit.base,
          bottomId: pickRequired(closet.bottoms, rng, "bottom").id,
        },
      };

    case "jacket":
      return {
        ...outfit,
        jacketId: pickOptional(closet.jackets, rng)?.id ?? null,
      };

    case "bag":
      return {
        ...outfit,
        bagId: pickOptional(closet.bags, rng)?.id ?? null,
      };

    case "shoes":
      return {
        ...outfit,
        shoesId: pickRequired(closet.shoes, rng, "shoes").id,
      };

    case "accessory":
      return {
        ...outfit,
        accessoryId: pickOptional(closet.accessories, rng)?.id ?? null,
      };
  }
}
