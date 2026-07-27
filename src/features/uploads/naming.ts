import type { ItemCategory } from "../closet/types";
import type { TopSubtype } from "./types";

/** Singular, because these name one garment — "Bottoms" stays plural the way a pair does. */
const CATEGORY_NOUN: Record<ItemCategory, string> = {
  tops: "Top",
  bottoms: "Bottoms",
  dresses: "Dress",
  jackets: "Jacket",
  shoes: "Shoes",
  accessories: "Accessory",
};

const SUBTYPE_NOUN: Record<TopSubtype, string> = {
  shirt: "Shirt",
  sweater: "Sweater",
  tank: "Tank",
};

/** The name an upload gets when Joyce doesn't type one: "Tank · Jul 27". Mirrors
 *  defaultOutfitName's form (outfits/naming.ts:2), using the subtype when there is one. */
export function defaultItemName(
  category: ItemCategory,
  subtype: TopSubtype | undefined,
  date: Date,
): string {
  const noun =
    category === "tops" && subtype
      ? SUBTYPE_NOUN[subtype]
      : CATEGORY_NOUN[category];

  return `${noun} · ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}
