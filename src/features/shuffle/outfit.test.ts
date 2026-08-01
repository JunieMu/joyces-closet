import { describe, expect, it } from "vitest";

import type { Outfit } from "./outfit";
import { outfitUsesItem } from "./outfit";

const separates: Outfit = {
  base: { kind: "separates", topId: "top-1", bottomId: "bottom-1" },
  jacketId: "jacket-1",
  shoesId: "shoes-1",
  accessoryId: null,
};

const dressed: Outfit = {
  base: { kind: "dress", dressId: "dress-1" },
  jacketId: null,
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

  it("is false for an item the outfit does not wear", () => {
    expect(outfitUsesItem(separates, "dress-1")).toBe(false);
    expect(outfitUsesItem(dressed, "top-1")).toBe(false);
  });

  it("does not match an empty optional slot", () => {
    expect(outfitUsesItem(separates, "accessory-1")).toBe(false);
    expect(outfitUsesItem(dressed, "jacket-1")).toBe(false);
  });
});
