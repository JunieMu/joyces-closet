import { describe, expect, it } from "vitest";

import { buildIndex, toCloset } from "./merge";
import type { ClosetItem, ItemCategory } from "./types";

const CATEGORIES: ItemCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "jackets",
  "shoes",
  "accessories",
];

function upload(id: string, category: ItemCategory): ClosetItem {
  return { id, name: id, category, image: `blob:${id}` };
}

describe("toCloset", () => {
  it("gives an empty closet every category", () => {
    const closet = toCloset([]);

    expect(Object.keys(closet).sort()).toEqual([...CATEGORIES].sort());
    for (const category of CATEGORIES) expect(closet[category]).toEqual([]);
  });

  it("files each upload under its own category", () => {
    const closet = toCloset([
      upload("u-top", "tops"),
      upload("u-dress", "dresses"),
      upload("u-shoe", "shoes"),
    ]);

    expect(closet.tops.map((item) => item.id)).toEqual(["u-top"]);
    expect(closet.dresses.map((item) => item.id)).toEqual(["u-dress"]);
    expect(closet.shoes.map((item) => item.id)).toEqual(["u-shoe"]);
    expect(closet.jackets).toEqual([]);
  });

  it("keeps insertion order, so rail positions never shift", () => {
    const closet = toCloset([
      upload("u1", "tops"),
      upload("u2", "bottoms"),
      upload("u3", "tops"),
    ]);

    expect(closet.tops.map((item) => item.id)).toEqual(["u1", "u3"]);
  });

  // The condition all three dormant dress gates read: shuffle probability
  // (shuffle.ts:43-59), the toggle (OutfitActions.tsx:78) and the dress rail
  // (ShufflePage.tsx:130-145) all key off closet.dresses being non-empty.
  it("makes closet.dresses non-empty on the first uploaded dress", () => {
    expect(toCloset([]).dresses).toEqual([]);

    const dress = upload("u-dress", "dresses");
    expect(toCloset([dress]).dresses).toEqual([dress]);
  });

  it("does not mutate the list it is given", () => {
    const uploads = [upload("u1", "tops")];
    toCloset(uploads);

    expect(uploads).toHaveLength(1);
  });
});

describe("buildIndex", () => {
  it("finds every item by id", () => {
    const top = upload("u1", "tops");
    const shoe = upload("u2", "shoes");
    const index = buildIndex(toCloset([top, shoe]));

    expect(index.get("u1")).toBe(top);
    expect(index.get("u2")).toBe(shoe);
    expect(index.size).toBe(2);
  });

  it("returns undefined for an unknown id", () => {
    expect(buildIndex(toCloset([])).get("nope")).toBeUndefined();
  });
});
