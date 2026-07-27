import { describe, expect, it } from "vitest";

import type { Closet, ClosetItem, ItemCategory } from "../closet/types";
import type { Rng } from "../../lib/rng";
import {
  isOutfitShape,
  isOutfitValid,
  repairOutfit,
  type Outfit,
} from "./outfit";
import { shuffleOutfit, shuffleSlot } from "./shuffle";

// Fixture closets, not the real manifest — adding clothes must never churn these tests.
function items(category: ItemCategory, count: number): ClosetItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${category}-${i + 1}`,
    name: `${category} ${i + 1}`,
    category,
    image: `/images/${category}/${i + 1}.png`,
  }));
}

function fixture(counts: Partial<Record<ItemCategory, number>>): Closet {
  return {
    tops: items("tops", counts.tops ?? 0),
    bottoms: items("bottoms", counts.bottoms ?? 0),
    dresses: items("dresses", counts.dresses ?? 0),
    jackets: items("jackets", counts.jackets ?? 0),
    shoes: items("shoes", counts.shoes ?? 0),
    accessories: items("accessories", counts.accessories ?? 0),
  };
}

/** Hands out exactly the given values, in order, then refuses to be called again. */
function scripted(...values: number[]): Rng {
  let i = 0;
  return () => {
    const value = values[i++];
    if (value === undefined) throw new Error("scripted rng exhausted");
    return value;
  };
}

/** Deterministic PRNG (mulberry32) for "shuffle many times and nothing breaks" sweeps. */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dressBase: Outfit = {
  base: { kind: "dress", dressId: "dresses-1" },
  jacketId: null,
  shoesId: "shoes-1",
  accessoryId: null,
};

describe("base selection is pool-proportional", () => {
  // 2 tops × 2 bottoms + 1 dress = a pool of 5: the dress owns the final fifth.
  const closet = fixture({ tops: 2, bottoms: 2, dresses: 1, shoes: 1 });
  const start: Outfit = {
    ...dressBase,
    base: { kind: "dress", dressId: "dresses-1" },
  };

  it.each([
    [0.0, "tops-1", "bottoms-1"],
    [0.2, "tops-1", "bottoms-2"],
    [0.4, "tops-2", "bottoms-1"],
    [0.6, "tops-2", "bottoms-2"],
  ])("roll %s picks separates %s + %s", (roll, topId, bottomId) => {
    const { base } = shuffleSlot(start, "base", closet, scripted(roll));
    expect(base).toEqual({ kind: "separates", topId, bottomId });
  });

  it.each([0.8, 0.95, 0.999])("roll %s picks the dress", (roll) => {
    const { base } = shuffleSlot(start, "base", closet, scripted(roll));
    expect(base).toEqual({ kind: "dress", dressId: "dresses-1" });
  });

  it("never picks a dress when there are none", () => {
    const dressless = fixture({ tops: 3, bottoms: 5, dresses: 0, shoes: 1 });
    for (let roll = 0; roll < 1; roll += 0.01) {
      const { base } = shuffleSlot(start, "base", dressless, scripted(roll));
      expect(base.kind).toBe("separates");
    }
  });
});

describe("optional slots shuffle over items + none", () => {
  const closet = fixture({
    tops: 1,
    bottoms: 1,
    jackets: 3,
    shoes: 1,
    accessories: 1,
  });

  // 3 jackets ⇒ 4 options ⇒ "no jacket" is the final quarter, as in the old app.
  it.each([
    [0.0, "jackets-1"],
    [0.3, "jackets-2"],
    [0.6, "jackets-3"],
    [0.75, null],
    [0.99, null],
  ])("roll %s picks jacket %s", (roll, expected) => {
    const outfit = shuffleSlot(dressBase, "jacket", closet, scripted(roll));
    expect(outfit.jacketId).toBe(expected);
  });

  // 1 accessory ⇒ 2 options ⇒ half the rolls land on "none".
  it.each([
    [0.0, "accessories-1"],
    [0.49, "accessories-1"],
    [0.5, null],
    [0.99, null],
  ])("roll %s picks accessory %s", (roll, expected) => {
    const outfit = shuffleSlot(dressBase, "accessory", closet, scripted(roll));
    expect(outfit.accessoryId).toBe(expected);
  });

  it("never leaves shoes empty", () => {
    const outfit = shuffleSlot(dressBase, "shoes", closet, scripted(0.99));
    expect(outfit.shoesId).toBe("shoes-1");
  });
});

describe("shuffleSlot touches one slot at a time", () => {
  const closet = fixture({
    tops: 4,
    bottoms: 4,
    jackets: 3,
    shoes: 2,
    accessories: 2,
  });
  const outfit: Outfit = {
    base: { kind: "separates", topId: "tops-1", bottomId: "bottoms-1" },
    jacketId: "jackets-1",
    shoesId: "shoes-1",
    accessoryId: "accessories-1",
  };

  it("changes only the jacket", () => {
    const next = shuffleSlot(outfit, "jacket", closet, scripted(0.5));
    expect(next).toEqual({ ...outfit, jacketId: next.jacketId });
    expect(next.jacketId).not.toBe(outfit.jacketId);
  });

  it("changes only the top, keeping the bottom", () => {
    const next = shuffleSlot(outfit, "top", closet, scripted(0.9));
    expect(next.base).toEqual({
      kind: "separates",
      topId: "tops-4",
      bottomId: "bottoms-1",
    });
    expect(next.jacketId).toBe(outfit.jacketId);
    expect(next.shoesId).toBe(outfit.shoesId);
    expect(next.accessoryId).toBe(outfit.accessoryId);
  });

  it("is a no-op when shuffling a top on a dress base", () => {
    const dressed: Outfit = {
      ...outfit,
      base: { kind: "dress", dressId: "dresses-1" },
    };
    const rng: Rng = () => {
      throw new Error("rng must not be consumed by a no-op");
    };
    expect(shuffleSlot(dressed, "top", closet, rng)).toEqual(dressed);
    expect(shuffleSlot(dressed, "bottom", closet, rng)).toEqual(dressed);
  });

  it("does not mutate the outfit it is given", () => {
    const before = structuredClone(outfit);
    shuffleSlot(outfit, "base", closet, scripted(0.5));
    expect(outfit).toEqual(before);
  });
});

describe("shuffleOutfit", () => {
  it("always produces a valid outfit", () => {
    const closet = fixture({
      tops: 15,
      bottoms: 14,
      dresses: 2,
      jackets: 3,
      shoes: 1,
      accessories: 1,
    });
    const rng = seeded(1234);
    for (let i = 0; i < 500; i++) {
      expect(isOutfitValid(shuffleOutfit(closet, rng), closet)).toBe(true);
    }
  });

  it("produces a valid outfit from a dressless closet", () => {
    const closet = fixture({ tops: 3, bottoms: 3, jackets: 1, shoes: 1 });
    const rng = seeded(99);
    for (let i = 0; i < 200; i++) {
      const outfit = shuffleOutfit(closet, rng);
      expect(outfit.base.kind).toBe("separates");
      expect(outfit.accessoryId).toBeNull(); // no accessories in this fixture
      expect(isOutfitValid(outfit, closet)).toBe(true);
    }
  });

  it("throws rather than inventing an outfit from an empty closet", () => {
    expect(() => shuffleOutfit(fixture({}), seeded(1))).toThrow(
      /no wearable base/,
    );
  });
});

describe("isOutfitValid", () => {
  const closet = fixture({
    tops: 2,
    bottoms: 2,
    dresses: 1,
    jackets: 1,
    shoes: 1,
  });
  const valid: Outfit = {
    base: { kind: "separates", topId: "tops-1", bottomId: "bottoms-1" },
    jacketId: "jackets-1",
    shoesId: "shoes-1",
    accessoryId: null,
  };

  it("accepts an outfit whose ids all exist", () => {
    expect(isOutfitValid(valid, closet)).toBe(true);
  });

  it("accepts empty optional slots", () => {
    expect(isOutfitValid({ ...valid, jacketId: null }, closet)).toBe(true);
  });

  it("rejects an id that no longer exists in the closet", () => {
    expect(isOutfitValid({ ...valid, shoesId: "shoes-9" }, closet)).toBe(false);
    expect(isOutfitValid({ ...valid, jacketId: "jackets-9" }, closet)).toBe(
      false,
    );
    expect(
      isOutfitValid(
        { ...valid, base: { kind: "dress", dressId: "dresses-9" } },
        closet,
      ),
    ).toBe(false);
  });

  it("rejects an id borrowed from the wrong category", () => {
    expect(
      isOutfitValid(
        {
          ...valid,
          base: {
            kind: "separates",
            topId: "bottoms-1",
            bottomId: "bottoms-1",
          },
        },
        closet,
      ),
    ).toBe(false);
  });
});

describe("repairOutfit", () => {
  const closet = fixture({
    tops: 2,
    bottoms: 2,
    jackets: 1,
    shoes: 1,
    accessories: 1,
  });
  const valid: Outfit = {
    base: { kind: "separates", topId: "tops-2", bottomId: "bottoms-2" },
    jacketId: "jackets-1",
    shoesId: "shoes-1",
    accessoryId: "accessories-1",
  };

  it("leaves a still-valid outfit exactly as it is", () => {
    expect(repairOutfit(valid, closet)).toEqual(valid);
  });

  it("drops optional items that no longer exist", () => {
    const repaired = repairOutfit(
      { ...valid, jacketId: "jackets-9", accessoryId: "accessories-9" },
      closet,
    );

    expect(repaired).toEqual({ ...valid, jacketId: null, accessoryId: null });
  });

  it("substitutes a required item that no longer exists", () => {
    const repaired = repairOutfit(
      {
        ...valid,
        base: { kind: "separates", topId: "tops-9", bottomId: "bottoms-2" },
        shoesId: "shoes-9",
      },
      closet,
    );

    expect(repaired).toEqual({
      ...valid,
      base: { kind: "separates", topId: "tops-1", bottomId: "bottoms-2" },
      shoesId: "shoes-1",
    });
  });

  it("falls back to separates when the saved dress is gone", () => {
    const repaired = repairOutfit(
      { ...valid, base: { kind: "dress", dressId: "dresses-1" } },
      closet,
    );

    expect(repaired?.base).toEqual({
      kind: "separates",
      topId: "tops-1",
      bottomId: "bottoms-1",
    });
  });

  it("keeps a dress that still exists", () => {
    const withDresses = fixture({ tops: 1, bottoms: 1, dresses: 1, shoes: 1 });
    const dressed: Outfit = {
      ...valid,
      base: { kind: "dress", dressId: "dresses-1" },
    };

    expect(repairOutfit(dressed, withDresses)?.base).toEqual({
      kind: "dress",
      dressId: "dresses-1",
    });
  });

  it("always returns something valid, or nothing at all", () => {
    const repaired = repairOutfit({ ...valid, shoesId: "shoes-9" }, closet);
    expect(repaired && isOutfitValid(repaired, closet)).toBe(true);

    // A closet with no shoes can't dress anyone, so there is nothing to load.
    expect(repairOutfit(valid, fixture({ tops: 1, bottoms: 1 }))).toBeNull();
    expect(repairOutfit(valid, fixture({ shoes: 1 }))).toBeNull();
  });
});

describe("isOutfitShape", () => {
  const valid: Outfit = {
    base: { kind: "separates", topId: "tops-1", bottomId: "bottoms-1" },
    jacketId: null,
    shoesId: "shoes-1",
    accessoryId: "accessories-1",
  };

  it("accepts both kinds of base", () => {
    expect(isOutfitShape(valid)).toBe(true);
    expect(
      isOutfitShape({
        ...valid,
        base: { kind: "dress", dressId: "dresses-1" },
      }),
    ).toBe(true);
  });

  it.each([
    ["not an object", "outfit"],
    ["null", null],
    ["no base", { jacketId: null, shoesId: "shoes-1", accessoryId: null }],
    [
      "unknown base kind",
      { ...valid, base: { kind: "romper", romperId: "r-1" } },
    ],
    [
      "separates base missing a bottom",
      { ...valid, base: { kind: "separates", topId: "t" } },
    ],
    ["missing required shoes", { ...valid, shoesId: undefined }],
    ["a non-string optional slot", { ...valid, jacketId: 7 }],
  ])("rejects %s", (_label, value) => {
    expect(isOutfitShape(value)).toBe(false);
  });
});
