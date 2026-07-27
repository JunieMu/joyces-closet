export type ItemCategory =
  "tops" | "bottoms" | "dresses" | "jackets" | "shoes" | "accessories";

export interface ClosetItem {
  id: string; // e.g. "top-shirt-1"
  name: string; // e.g. "Shirt 1"
  category: ItemCategory;
  image: string; // "/images/tops/shirt1.png"
  // Reserved for future features (Decisions 3 & 7) — no logic reads these in v1:
  tags?: { colors?: string[]; seasons?: string[]; occasions?: string[] };
  jacketCompatible?: boolean; // tops/dresses only
}

export type Closet = Record<ItemCategory, ClosetItem[]>;
