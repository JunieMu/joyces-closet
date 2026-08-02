/**
 * The category set, and the manifest ORDER the closet page and the upload picker present
 * (2026-08-02 Decision 10: bags sits under jackets, mirroring the shuffle page's left column
 * and preserving the big→small gradient).
 *
 * Single source of truth (Decision 13). The union below derives from this array, and so do the
 * runtime allowlists in uploads/indexedDbStore.ts and uploads/backup.ts — those used to be
 * hand-maintained Sets, and a category missing from either one saved fine, displayed for a whole
 * session, then vanished on reload with the error swallowed. Adding a category is one edit here
 * plus whatever Record<ItemCategory, X> maps the compiler then points at.
 */
export const CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "jackets",
  "bags",
  "shoes",
  "accessories",
] as const;

export type ItemCategory = (typeof CATEGORIES)[number];

/** The runtime half of the union, for validating untrusted data off disk. */
export function isItemCategory(value: unknown): value is ItemCategory {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}

export interface ClosetItem {
  id: string; // a crypto.randomUUID()
  name: string; // e.g. "Shirt · Jul 27"
  category: ItemCategory;
  image: string; // an object URL, minted in toClosetItem and revoked on delete
  // The normalized canvas the pipeline composited onto: 1080x1080, or 1080x2000 for a
  // full-length bottom or a dress (uploads/pipeline/constants.ts). Carried through from the
  // UploadRecord so a renderer can shape its box to the garment rather than contain-fit a tall
  // canvas into a wide slot. Optional because test fixtures build items by hand; absent reads
  // as the square canvas, which is what every item rendered as before this existed.
  width?: number;
  height?: number;
  // Reserved for future features (Decisions 3 & 7) — no logic reads these in v1:
  tags?: { colors?: string[]; seasons?: string[]; occasions?: string[] };
  jacketCompatible?: boolean; // tops/dresses only
}

export type Closet = Record<ItemCategory, ClosetItem[]>;
