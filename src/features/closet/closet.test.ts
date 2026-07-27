import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getCloset, getItem } from "./closet";
import type { ItemCategory } from "./types";

const closet = getCloset();
const allItems = Object.values(closet).flat();
const categories = Object.keys(closet) as ItemCategory[];

// Shape checks only — no item counts, so adding clothes never requires a test edit.
describe("closet manifest", () => {
  it("has an entry for every category", () => {
    expect(categories).toEqual(
      expect.arrayContaining([
        "tops",
        "bottoms",
        "dresses",
        "jackets",
        "shoes",
        "accessories",
      ]),
    );
  });

  it("has unique ids", () => {
    const ids = allItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("files every item under its own category", () => {
    for (const category of categories) {
      for (const item of closet[category]) {
        expect(item.category).toBe(category);
        expect(item.image.startsWith(`/images/${category}/`)).toBe(true);
      }
    }
  });

  it("points every item at an image that exists on disk", () => {
    for (const item of allItems) {
      expect(
        existsSync(join("public", item.image)),
        `missing ${item.image}`,
      ).toBe(true);
    }
  });

  it("has at least one pair of shoes (a required slot)", () => {
    expect(closet.shoes.length).toBeGreaterThanOrEqual(1);
  });

  it("can build a full separates outfit", () => {
    expect(closet.tops.length).toBeGreaterThanOrEqual(1);
    expect(closet.bottoms.length).toBeGreaterThanOrEqual(1);
  });
});

describe("getItem", () => {
  it("looks up every manifest item by id", () => {
    for (const item of allItems) {
      expect(getItem(item.id)).toBe(item);
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getItem("top-nonexistent-99")).toBeUndefined();
  });
});
