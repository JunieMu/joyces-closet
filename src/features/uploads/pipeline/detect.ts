/**
 * Does this upload already have a cut-out background (Decision 3)? Every built-in has
 * 37.5-75.9% fully-transparent pixels; a camera photo has 0%. The 5% threshold sits in
 * that gap with room to spare, and unlike a border-ring test it still works on an image
 * cropped tight to the garment.
 */
export function isPreCut(
  alpha: Uint8Array,
  threshold = 16,
  minFraction = 0.05,
): boolean {
  let clear = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i]! < threshold) clear++;
  return clear / alpha.length >= minFraction;
}

/**
 * Full-length bottoms take the tall canvas (Decision 6). Measured garment aspects:
 * pants 0.525-0.689, shorts/skirts 1.254-1.584 — a threshold of 1.0 (taller than wide)
 * sits in a wide empty gap, so the preview toggle should almost never be needed.
 */
export function isFullLength(garment: {
  width: number;
  height: number;
}): boolean {
  return garment.width / garment.height < 1;
}
