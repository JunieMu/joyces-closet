import type { Placement } from "./constants";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Tightest box containing every pixel above `threshold`. Null when nothing is opaque
 *  enough — a fully transparent image, which the caller must reject. */
export function alphaBoundingBox(
  alpha: Uint8Array,
  width: number,
  height: number,
  threshold = 8,
): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x]! <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Where the trimmed garment lands on the standard canvas: contain-fit into the placement's
 * fill box, horizontally centred, vertically centred or waist-anchored. This is the whole
 * of "standardized sizing" — the PNG canvas IS the layout contract, since the two render
 * sites use object-contain with zero per-item CSS.
 */
export function fitBox(
  garment: { width: number; height: number },
  placement: Placement,
): Box {
  const { canvas, fillW, fillH, anchor } = placement;
  const boxW = fillW * canvas.width;
  const boxH = fillH * canvas.height;

  const scale = Math.min(boxW / garment.width, boxH / garment.height);
  const width = garment.width * scale;
  const height = garment.height * scale;

  // A top-anchored garment could in principle run off the bottom edge if fillH + margin
  // ever exceeded 1. It cannot with today's constants (0.87 + 0.03; 0.88 + 0.08), but the
  // clamp keeps "never overflows the canvas" a real invariant rather than a coincidence.
  const top =
    anchor.kind === "top"
      ? Math.min(anchor.margin * canvas.height, canvas.height - height)
      : (canvas.height - height) / 2;

  return {
    left: (canvas.width - width) / 2,
    top,
    width,
    height,
  };
}
