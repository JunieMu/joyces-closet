import { describe, expect, it } from "vitest";

import type { Outfit } from "./outfit";
import {
  isOutfitShape,
  outfitUsesItem,
  withBagDefault,
  withSavedBagDefault,
} from "./outfit";

const separates: Outfit = {
  base: { kind: "separates", topId: "top-1", bottomId: "bottom-1" },
  jacketId: "jacket-1",
  bagId: null,
  shoesId: "shoes-1",
  accessoryId: null,
};

const dressed: Outfit = {
  base: { kind: "dress", dressId: "dress-1" },
  jacketId: null,
  bagId: "bag-1",
  shoesId: "shoes-1",
  accessoryId: "accessory-1",
};

describe("outfitUsesItem", () => {
  it("finds both halves of a separates base", () => {
    expect(outfitUsesItem(separates, "top-1")).toBe(true);
    expect(outfitUsesItem(separates, "bottom-1")).toBe(true);
  });

  it("finds a dress base", () => {
    expect(outfitUsesItem(dressed, "dress-1")).toBe(true);
  });

  it("finds the required and optional slots", () => {
    expect(outfitUsesItem(separates, "shoes-1")).toBe(true);
    expect(outfitUsesItem(separates, "jacket-1")).toBe(true);
    expect(outfitUsesItem(dressed, "accessory-1")).toBe(true);
  });

  // Covered by hand because no compile error points at outfitUsesItem when Outfit widens,
  // and a miss under-reports the closet delete confirmation's "worn in N outfits" count.
  it("finds a bag", () => {
    expect(outfitUsesItem(dressed, "bag-1")).toBe(true);
  });

  it("is false for an item the outfit does not wear", () => {
    expect(outfitUsesItem(separates, "dress-1")).toBe(false);
    expect(outfitUsesItem(dressed, "top-1")).toBe(false);
  });

  it("does not match an empty optional slot", () => {
    expect(outfitUsesItem(separates, "accessory-1")).toBe(false);
    expect(outfitUsesItem(separates, "bag-1")).toBe(false);
    expect(outfitUsesItem(dressed, "jacket-1")).toBe(false);
  });
});

/**
 * The regression net for 2026-08-02 Decision 11. Every outfit stored before bags existed has
 * no `bagId` key, and the storage layer read-filter-writes the whole array — so an outfit the
 * guard rejects is DELETED on the next save, not merely hidden.
 */
describe("withBagDefault", () => {
  // Deliberately not typed as Outfit: this is what an outfit written by the previous release
  // actually looks like coming back off disk.
  const legacy = {
    base: { kind: "separates", topId: "top-1", bottomId: "bottom-1" },
    jacketId: null,
    shoesId: "shoes-1",
    accessoryId: "accessory-1",
  };

  it("gives a legacy outfit a null bag, so the strict guard accepts it", () => {
    const normalized = withBagDefault(legacy);

    expect(normalized).toEqual({ ...legacy, bagId: null });
    expect(isOutfitShape(normalized)).toBe(true);
  });

  // Pins WHY the helper exists: undefined satisfies neither branch of optionalOk, so the
  // unnormalized object fails. Delete this normalization and this is the outfit that vanishes.
  it("is required — the same outfit fails isOutfitShape unnormalized", () => {
    expect(isOutfitShape(legacy)).toBe(false);
  });

  it("returns an outfit that already has a bag unchanged, not a copy", () => {
    expect(withBagDefault(dressed)).toBe(dressed);
    expect(withBagDefault(separates)).toBe(separates); // bagId: null counts as present
  });

  it.each([
    ["null", null],
    ["a string", "outfit"],
    ["a number", 42],
  ])("passes %s through untouched", (_label, value) => {
    expect(withBagDefault(value)).toBe(value);
  });
});

describe("withSavedBagDefault", () => {
  it("normalizes the nested outfit and keeps the wrapper's own fields", () => {
    const saved = {
      id: "outfit-1",
      name: "Brunch",
      createdAt: "2026-07-27T00:00:00.000Z",
      outfit: {
        base: { kind: "dress", dressId: "dress-1" },
        jacketId: null,
        shoesId: "shoes-1",
        accessoryId: null,
      },
    };

    expect(withSavedBagDefault(saved)).toEqual({
      ...saved,
      outfit: { ...saved.outfit, bagId: null },
    });
  });

  it.each([
    ["null", null],
    ["a string", "saved"],
  ])("passes %s through untouched", (_label, value) => {
    expect(withSavedBagDefault(value)).toBe(value);
  });
});
