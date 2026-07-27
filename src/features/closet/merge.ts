import type { Closet, ClosetItem, ItemCategory } from "./types";

const CATEGORIES: ItemCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "jackets",
  "shoes",
  "accessories",
];

/**
 * Files a flat list of uploads into the six category arrays. Insertion order is preserved
 * within a category, so an existing rail position never shifts when something new is added.
 *
 * This is the whole closet now — there is no built-in manifest underneath it, so every
 * category can legitimately be empty. Callers must handle that (see `canDress`).
 */
export function toCloset(uploads: ClosetItem[]): Closet {
  const closet = {} as Closet;
  for (const category of CATEGORIES) {
    closet[category] = uploads.filter((item) => item.category === category);
  }
  return closet;
}

export function buildIndex(closet: Closet): Map<string, ClosetItem> {
  return new Map(
    Object.values(closet)
      .flat()
      .map((item) => [item.id, item]),
  );
}
