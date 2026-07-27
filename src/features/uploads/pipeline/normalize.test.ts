import { describe, expect, it } from "vitest";

import {
  BOTTOM_LONG,
  BOTTOM_SHORT,
  PLACEMENT,
  TOP_PLACEMENT,
  type Placement,
} from "./constants";
import { alphaBoundingBox, fitBox } from "./normalize";

const BY_NAME: Record<string, Placement> = {
  shirt: TOP_PLACEMENT.shirt,
  sweater: TOP_PLACEMENT.sweater,
  tank: TOP_PLACEMENT.tank,
  BOTTOM_LONG,
  BOTTOM_SHORT,
  jackets: PLACEMENT.jackets,
  shoes: PLACEMENT.shoes,
  accessories: PLACEMENT.accessories,
};

/**
 * Measured 2026-07-27 by decoding public/images/ ** /*.png and taking each garment's alpha
 * bounding box at threshold 8. This table is the only record of what the built-ins
 * actually are — the node test environment has no PNG decoder, so it cannot be re-derived
 * here. If a constant drifts away from the convention it was fitted to, this fails.
 *
 * [file, placement, canvasW, canvasH, bboxW, bboxH]
 * shirt1.png (1080x1480) is excluded: known outlier on a non-standard canvas.
 */
const BUILT_INS: [string, string, number, number, number, number][] = [
  ["bag1.png", "accessories", 1080, 1080, 872, 819],
  ["pants1.png", "BOTTOM_LONG", 1080, 2000, 1027, 1492],
  ["pants2.png", "BOTTOM_LONG", 1080, 2000, 960, 1662],
  ["pants3.png", "BOTTOM_LONG", 1080, 2000, 920, 1752],
  ["pants4.png", "BOTTOM_LONG", 1080, 2000, 913, 1721],
  ["pants5.png", "BOTTOM_LONG", 1080, 2000, 1048, 1633],
  ["pants6.png", "BOTTOM_LONG", 1080, 2000, 1028, 1491],
  ["pants7.png", "BOTTOM_LONG", 1080, 2000, 1019, 1569],
  ["shorts1.png", "BOTTOM_SHORT", 1080, 1080, 1017, 642],
  ["shorts2.png", "BOTTOM_SHORT", 1080, 1080, 903, 720],
  ["shorts3.png", "BOTTOM_SHORT", 1080, 1080, 912, 668],
  ["shorts4.png", "BOTTOM_SHORT", 1080, 1080, 944, 675],
  ["skirt1.png", "BOTTOM_SHORT", 1080, 1080, 878, 601],
  ["skirt2.png", "BOTTOM_SHORT", 1080, 1080, 996, 650],
  ["skirt3.png", "BOTTOM_SHORT", 1080, 1080, 1025, 698],
  ["jacket1.png", "jackets", 1080, 1080, 664, 965],
  ["jacket2.png", "jackets", 1080, 1080, 762, 1001],
  ["jacket3.png", "jackets", 1080, 1080, 708, 988],
  ["shoes1.png", "shoes", 1080, 1080, 971, 655],
  ["shirt2.png", "shirt", 1080, 1080, 1011, 806],
  ["shirt3.png", "shirt", 1080, 1080, 936, 1003],
  ["shirt4.png", "shirt", 1080, 1080, 681, 1035],
  ["shirt5.png", "shirt", 1080, 1080, 771, 1025],
  ["shirt6.png", "shirt", 1080, 1080, 821, 1017],
  ["sweater1.png", "sweater", 1080, 1080, 774, 992],
  ["tank1.png", "tank", 1080, 1080, 626, 729],
  ["tank2.png", "tank", 1080, 1080, 649, 764],
  ["tank3.png", "tank", 1080, 1080, 636, 740],
  ["tank4.png", "tank", 1080, 1080, 625, 804],
  ["tank5.png", "tank", 1080, 1080, 628, 661],
  ["tank6.png", "tank", 1080, 1080, 634, 850],
  ["tank7.png", "tank", 1080, 1080, 634, 649],
  ["tank8.png", "tank", 1080, 1080, 638, 953],
];

/** What fitBox would produce for this garment, as fractions of the canvas. */
function predictedFill(placementName: string, bboxW: number, bboxH: number) {
  const placement = BY_NAME[placementName]!;
  const box = fitBox({ width: bboxW, height: bboxH }, placement);
  return {
    w: box.width / placement.canvas.width,
    h: box.height / placement.canvas.height,
  };
}

const TIGHT = new Set([
  "shirt",
  "sweater",
  "tank",
  "jackets",
  "shoes",
  "accessories",
]);

describe("fitBox reproduces the built-in sizing conventions", () => {
  it.each(BUILT_INS)(
    "%s lands within 0.08 of its measured fill",
    (_file, placement, canvasW, canvasH, bboxW, bboxH) => {
      const got = predictedFill(placement, bboxW, bboxH);
      expect(Math.abs(got.w - bboxW / canvasW)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(got.h - bboxH / canvasH)).toBeLessThanOrEqual(0.08);
    },
  );

  // Everything except bottoms was authored to a tight convention; bottoms spread wider
  // (worst 0.077 on skirt1), which is why the general bound above is looser.
  it.each(BUILT_INS.filter(([, placement]) => TIGHT.has(placement)))(
    "%s lands within 0.02 of its measured fill",
    (_file, placement, canvasW, canvasH, bboxW, bboxH) => {
      const got = predictedFill(placement, bboxW, bboxH);
      expect(Math.abs(got.w - bboxW / canvasW)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(got.h - bboxH / canvasH)).toBeLessThanOrEqual(0.02);
    },
  );

  it("keeps every tank at the measured 0.587 canvas width", () => {
    for (const [, placement, canvasW, , bboxW, bboxH] of BUILT_INS) {
      if (placement !== "tank") continue;
      expect(predictedFill(placement, bboxW, bboxH).w).toBeCloseTo(0.587, 2);
      expect(canvasW).toBe(1080);
    }
  });

  it("waist-anchors bottoms and centres everything else", () => {
    const long = fitBox({ width: 1000, height: 1800 }, BOTTOM_LONG);
    expect(long.top).toBeCloseTo(0.03 * 2000, 5);

    const top = fitBox({ width: 800, height: 900 }, TOP_PLACEMENT.shirt);
    expect(top.top).toBeCloseTo((1080 - top.height) / 2, 5);
  });

  it("horizontally centres every placement", () => {
    for (const [, placement, canvasW, , bboxW, bboxH] of BUILT_INS) {
      const box = fitBox({ width: bboxW, height: bboxH }, BY_NAME[placement]!);
      expect(box.left + box.width / 2).toBeCloseTo(canvasW / 2, 5);
    }
  });

  it("never lets a garment overflow its canvas", () => {
    for (const [, placement, canvasW, canvasH, bboxW, bboxH] of BUILT_INS) {
      const box = fitBox({ width: bboxW, height: bboxH }, BY_NAME[placement]!);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(canvasW);
      expect(box.top + box.height).toBeLessThanOrEqual(canvasH);
    }
  });

  it("preserves the garment's aspect ratio", () => {
    const box = fitBox({ width: 900, height: 300 }, TOP_PLACEMENT.shirt);
    expect(box.width / box.height).toBeCloseTo(3, 5);
  });
});

/** Builds an alpha plane with `opaque` describing which pixels are solid. */
function alphaPlane(
  width: number,
  height: number,
  opaque: (x: number, y: number) => boolean,
): Uint8Array {
  const plane = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      plane[y * width + x] = opaque(x, y) ? 255 : 0;
  return plane;
}

describe("alphaBoundingBox", () => {
  it("returns null for a fully transparent image", () => {
    expect(alphaBoundingBox(new Uint8Array(16 * 16), 16, 16)).toBeNull();
  });

  it("trims to the opaque region inclusive of edge pixels", () => {
    // A solid 3x2 block whose top-left corner sits at (2, 1).
    const alpha = alphaPlane(
      10,
      8,
      (x, y) => x >= 2 && x <= 4 && y >= 1 && y <= 2,
    );

    expect(alphaBoundingBox(alpha, 10, 8)).toEqual({
      left: 2,
      top: 1,
      width: 3,
      height: 2,
    });
  });

  it("returns the full canvas when every pixel is opaque", () => {
    expect(
      alphaBoundingBox(
        alphaPlane(6, 4, () => true),
        6,
        4,
      ),
    ).toEqual({
      left: 0,
      top: 0,
      width: 6,
      height: 4,
    });
  });

  it("finds a single opaque pixel", () => {
    const alpha = alphaPlane(5, 5, (x, y) => x === 4 && y === 0);

    expect(alphaBoundingBox(alpha, 5, 5)).toEqual({
      left: 4,
      top: 0,
      width: 1,
      height: 1,
    });
  });

  it("ignores pixels at or below the threshold", () => {
    const alpha = new Uint8Array(4 * 4);
    alpha[0] = 8; // exactly at the default threshold — not opaque enough
    alpha[5] = 9; // one above it — counts

    expect(alphaBoundingBox(alpha, 4, 4)).toEqual({
      left: 1,
      top: 1,
      width: 1,
      height: 1,
    });
  });
});
