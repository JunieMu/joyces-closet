import { describe, expect, it } from "vitest";

import { isFullLength, isPreCut } from "./detect";

/** An alpha plane of `size` pixels where the first `clearFraction` share is transparent. */
function plane(size: number, clearFraction: number): Uint8Array {
  const alpha = new Uint8Array(size).fill(255);
  const clear = Math.round(size * clearFraction);
  for (let i = 0; i < clear; i++) alpha[i] = 0;
  return alpha;
}

describe("isPreCut", () => {
  it("rejects a photo with no transparency at all", () => {
    expect(isPreCut(plane(1000, 0))).toBe(false);
  });

  it("rejects an image that is only 4% clear", () => {
    expect(isPreCut(plane(1000, 0.04))).toBe(false);
  });

  it("accepts an image that is 6% clear", () => {
    expect(isPreCut(plane(1000, 0.06))).toBe(true);
  });

  it("accepts a built-in-like cutout at 60% clear", () => {
    expect(isPreCut(plane(1000, 0.6))).toBe(true);
  });

  it("counts near-transparent pixels below the threshold as clear", () => {
    // 10% of the plane sits at alpha 15 — under the default cut-off of 16.
    const alpha = new Uint8Array(1000).fill(255);
    for (let i = 0; i < 100; i++) alpha[i] = 15;

    expect(isPreCut(alpha)).toBe(true);
  });
});

describe("isFullLength", () => {
  // The measured extremes: pants 0.525-0.689, shorts/skirts 1.254-1.584.
  it.each([0.525, 0.689])(
    "treats a %s-aspect garment as full length",
    (aspect) => {
      expect(isFullLength({ width: aspect * 1000, height: 1000 })).toBe(true);
    },
  );

  it.each([1.254, 1.584])("treats a %s-aspect garment as short", (aspect) => {
    expect(isFullLength({ width: aspect * 1000, height: 1000 })).toBe(false);
  });

  it("treats an exactly square garment as short", () => {
    expect(isFullLength({ width: 1000, height: 1000 })).toBe(false);
  });
});
