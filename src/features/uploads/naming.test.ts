import { describe, expect, it } from "vitest";

import type { ItemCategory } from "../closet/types";
import { defaultItemName } from "./naming";
import type { TopSubtype } from "./types";

const JUL_27 = new Date(2026, 6, 27);

describe("defaultItemName", () => {
  it.each<[ItemCategory, string]>([
    ["tops", "Top · Jul 27"],
    ["bottoms", "Bottoms · Jul 27"],
    ["dresses", "Dress · Jul 27"],
    ["jackets", "Jacket · Jul 27"],
    ["shoes", "Shoes · Jul 27"],
    ["accessories", "Accessory · Jul 27"],
  ])("names a %s upload after its date", (category, expected) => {
    expect(defaultItemName(category, undefined, JUL_27)).toBe(expected);
  });

  it.each<[TopSubtype, string]>([
    ["shirt", "Shirt · Jul 27"],
    ["sweater", "Sweater · Jul 27"],
    ["tank", "Tank · Jul 27"],
  ])("prefers the %s subtype over the bare category", (subtype, expected) => {
    expect(defaultItemName("tops", subtype, JUL_27)).toBe(expected);
  });

  it("ignores a subtype on a category that cannot have one", () => {
    expect(defaultItemName("shoes", "tank", JUL_27)).toBe("Shoes · Jul 27");
  });

  it("does not pad single-digit days, matching defaultOutfitName", () => {
    expect(defaultItemName("dresses", undefined, new Date(2026, 0, 1))).toBe(
      "Dress · Jan 1",
    );
  });
});
