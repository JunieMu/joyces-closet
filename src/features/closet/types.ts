export type ItemCategory =
  "tops" | "bottoms" | "dresses" | "jackets" | "shoes" | "accessories";

export interface ClosetItem {
  id: string; // a crypto.randomUUID()
  name: string; // e.g. "Shirt · Jul 27"
  category: ItemCategory;
  image: string; // an object URL, minted in toClosetItem and revoked on delete
  // Reserved for future features (Decisions 3 & 7) — no logic reads these in v1:
  tags?: { colors?: string[]; seasons?: string[]; occasions?: string[] };
  jacketCompatible?: boolean; // tops/dresses only
}

export type Closet = Record<ItemCategory, ClosetItem[]>;
