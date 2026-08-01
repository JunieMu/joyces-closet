export type ItemCategory =
  "tops" | "bottoms" | "dresses" | "jackets" | "shoes" | "accessories";

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
