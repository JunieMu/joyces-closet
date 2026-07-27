/** Browser-only half of the pipeline. Kept deliberately thin — every decision it makes
 *  lives in the pure modules (normalize.ts / detect.ts / constants.ts), which are the ones
 *  under test. `environment: "node"` (vite.config.ts:9) cannot reach any of this. */

import type { CanvasSpec } from "./constants";
import { UploadError } from "./errors";
import type { Box } from "./normalize";

/** `imageOrientation: "from-image"` applies EXIF rotation, so phone photos land upright. */
export async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UploadError(
      "unreadable",
      "That file could not be read as an image.",
    );
  }
}

export interface AlphaData {
  alpha: Uint8Array;
  width: number;
  height: number;
}

function context2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  // `willReadFrequently` is deliberately off: each canvas here is read once, and the flag
  // would push rendering onto the CPU backend and slow the composite down.
  const context = canvas.getContext("2d");
  if (!context)
    throw new UploadError("unreadable", "This browser has no 2D canvas.");
  return context;
}

/** The alpha plane only — one byte per pixel, a quarter of what getImageData hands back,
 *  which matters when the input is a 12-megapixel phone photo. */
export function readAlpha(bitmap: ImageBitmap): AlphaData {
  const { width, height } = bitmap;
  const context = context2d(width, height);
  context.drawImage(bitmap, 0, 0);

  const { data } = context.getImageData(0, 0, width, height);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]!;

  return { alpha, width, height };
}

/** Draws `source`'s `crop` region into `dest` on a fresh canvas of `canvas` size and
 *  encodes PNG. High-quality downscaling matters: the crop is often ~1000px landing in a
 *  ~600px box. */
export function composite(
  source: ImageBitmap,
  crop: Box,
  dest: Box,
  canvas: CanvasSpec,
): Promise<Blob> {
  const context = context2d(canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    crop.left,
    crop.top,
    crop.width,
    crop.height,
    dest.left,
    dest.top,
    dest.width,
    dest.height,
  );

  return new Promise((resolve, reject) => {
    // PNG, not WebP: Safari cannot encode WebP from a canvas (Decision 10).
    context.canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else
        reject(
          new UploadError(
            "unreadable",
            "The normalized image could not be encoded.",
          ),
        );
    }, "image/png");
  });
}
