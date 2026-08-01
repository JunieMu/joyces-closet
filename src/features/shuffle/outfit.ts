import type { Closet, ItemCategory } from "../closet/types";

/** (top + bottom) XOR (dress) — a dress is a full-body item filling both slots (Decision 7). */
export type OutfitBase =
  | { kind: "separates"; topId: string; bottomId: string }
  | { kind: "dress"; dressId: string };

export interface Outfit {
  base: OutfitBase;
  jacketId: string | null; // optional slot
  shoesId: string; // required slot
  accessoryId: string | null; // optional slot
}

function inCategory(
  closet: Closet,
  category: ItemCategory,
  id: string,
): boolean {
  return closet[category].some((item) => item.id === id);
}

/**
 * Structural check for untrusted data (anything coming back out of storage), so that
 * `isOutfitValid` can be handed a value it is safe to read. Says nothing about whether
 * the ids still exist — that's `isOutfitValid`'s job.
 */
export function isOutfitShape(value: unknown): value is Outfit {
  if (typeof value !== "object" || value === null) return false;
  const outfit = value as Record<string, unknown>;

  const base = outfit.base;
  if (typeof base !== "object" || base === null) return false;
  const baseFields = base as Record<string, unknown>;
  const baseOk =
    (baseFields.kind === "separates" &&
      typeof baseFields.topId === "string" &&
      typeof baseFields.bottomId === "string") ||
    (baseFields.kind === "dress" && typeof baseFields.dressId === "string");

  const optionalOk = (field: unknown) =>
    field === null || typeof field === "string";

  return (
    baseOk &&
    typeof outfit.shoesId === "string" &&
    optionalOk(outfit.jacketId) &&
    optionalOk(outfit.accessoryId)
  );
}

/**
 * True when every id the outfit references still exists in the right category.
 * Used to sanity-check outfits coming back from storage — a since-deleted item
 * must never reach the renderer as a broken image.
 */
export function isOutfitValid(outfit: Outfit, closet: Closet): boolean {
  const baseValid =
    outfit.base.kind === "separates"
      ? inCategory(closet, "tops", outfit.base.topId) &&
        inCategory(closet, "bottoms", outfit.base.bottomId)
      : inCategory(closet, "dresses", outfit.base.dressId);

  const jacketValid =
    outfit.jacketId === null || inCategory(closet, "jackets", outfit.jacketId);
  const accessoryValid =
    outfit.accessoryId === null ||
    inCategory(closet, "accessories", outfit.accessoryId);

  return (
    baseValid &&
    jacketValid &&
    accessoryValid &&
    inCategory(closet, "shoes", outfit.shoesId)
  );
}

/**
 * Whether an outfit wears a particular closet item. Deleting from the closet is the one
 * irreversible action in the app, so the confirmation says how many saved outfits it will
 * leave with a hole in them (2026-07-30 Decision 4).
 */
export function outfitUsesItem(outfit: Outfit, id: string): boolean {
  const baseUses =
    outfit.base.kind === "separates"
      ? outfit.base.topId === id || outfit.base.bottomId === id
      : outfit.base.dressId === id;

  return (
    baseUses ||
    outfit.shoesId === id ||
    outfit.jacketId === id ||
    outfit.accessoryId === id
  );
}

/**
 * Makes a stored outfit wearable against today's closet: ids that no longer exist are
 * dropped from the optional slots and substituted in the required ones. Returns null
 * only when the closet itself can't dress anyone (no shoes, or no base to build).
 *
 * This is what lets a saved outfit survive Joyce deleting an item from the closet —
 * the card still loads, minus whatever is gone.
 */
export function repairOutfit(outfit: Outfit, closet: Closet): Outfit | null {
  const shoes = inCategory(closet, "shoes", outfit.shoesId)
    ? outfit.shoesId
    : closet.shoes[0]?.id;
  if (shoes === undefined) return null;

  const base = repairBase(outfit.base, closet);
  if (base === null) return null;

  return {
    base,
    jacketId:
      outfit.jacketId !== null && inCategory(closet, "jackets", outfit.jacketId)
        ? outfit.jacketId
        : null,
    shoesId: shoes,
    accessoryId:
      outfit.accessoryId !== null &&
      inCategory(closet, "accessories", outfit.accessoryId)
        ? outfit.accessoryId
        : null,
  };
}

function repairBase(base: OutfitBase, closet: Closet): OutfitBase | null {
  if (base.kind === "dress" && inCategory(closet, "dresses", base.dressId))
    return base;

  // A dress that's gone falls back to separates rather than dropping the outfit entirely.
  const topId =
    base.kind === "separates" && inCategory(closet, "tops", base.topId)
      ? base.topId
      : closet.tops[0]?.id;
  const bottomId =
    base.kind === "separates" && inCategory(closet, "bottoms", base.bottomId)
      ? base.bottomId
      : closet.bottoms[0]?.id;

  if (topId === undefined || bottomId === undefined) return null;
  return { kind: "separates", topId, bottomId };
}
