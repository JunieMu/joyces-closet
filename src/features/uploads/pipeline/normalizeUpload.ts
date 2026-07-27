import type { ItemCategory } from "../../closet/types";
import type { TopSubtype } from "../types";
import { composite, decode, readAlpha } from "./canvas";
import { placementFor } from "./constants";
import { isFullLength, isPreCut } from "./detect";
import { UploadError } from "./errors";
import { alphaBoundingBox, fitBox } from "./normalize";

export interface NormalizeResult {
  blob: Blob;
  width: number;
  height: number;
  fullLength: boolean; // what the bottoms inference decided; the preview toggle can override
  wasPreCut: boolean;
}

export interface NormalizeOptions {
  category: ItemCategory;
  subtype?: TopSubtype;
  fullLength?: boolean; // set by the preview toggle; otherwise inferred
  removeBackground?: (bitmap: ImageBitmap) => Promise<ImageBitmap>; // injected in Phase 5
}

/**
 * decode -> (remove background if opaque) -> alpha bbox -> fit box -> composite -> PNG.
 * Throws a typed UploadError when the image has no opaque pixels at all, which is the one
 * input the rest of the pipeline cannot represent.
 */
export async function normalizeUpload(
  file: Blob,
  options: NormalizeOptions,
): Promise<NormalizeResult> {
  const decoded = await decode(file);

  let bitmap = decoded;
  let { alpha, width, height } = readAlpha(bitmap);

  // Decision 3: an already-transparent upload skips the remover entirely, which is what
  // keeps the 45 MB model off the pre-cut path.
  const wasPreCut = isPreCut(alpha);
  if (!wasPreCut && options.removeBackground) {
    try {
      bitmap = await options.removeBackground(decoded);
    } catch (error) {
      decoded.close();
      throw error instanceof UploadError
        ? error
        : new UploadError(
            "removal-failed",
            "The background could not be removed from that photo.",
          );
    }
    if (bitmap !== decoded) decoded.close();
    ({ alpha, width, height } = readAlpha(bitmap));
  }

  const garment = alphaBoundingBox(alpha, width, height);
  if (!garment) {
    bitmap.close();
    throw new UploadError(
      "empty",
      "That image is fully transparent — there is no garment to cut out.",
    );
  }

  // Only bottoms have two canvases; for every other category the flag is inert, but it is
  // still reported back so the preview's toggle knows what the inference chose.
  const fullLength = options.fullLength ?? isFullLength(garment);
  const placement = placementFor(options.category, {
    subtype: options.subtype,
    fullLength,
  });

  const blob = await composite(
    bitmap,
    garment,
    fitBox(garment, placement),
    placement.canvas,
  );
  bitmap.close();

  return {
    blob,
    width: placement.canvas.width,
    height: placement.canvas.height,
    fullLength,
    wasPreCut,
  };
}
