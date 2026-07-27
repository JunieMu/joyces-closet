import type { ItemCategory } from "../closet/types";

/** Tops carry a subtype because the built-ins were prepped to two different sizing
 *  conventions — tanks are width-normalized, shirts height-normalized. Only used at
 *  upload time to pick the fill target; nothing downstream reads it to render. */
export type TopSubtype = "shirt" | "sweater" | "tank";

export interface UploadRecord {
  id: string; // crypto.randomUUID()
  name: string;
  category: ItemCategory;
  subtype?: TopSubtype; // tops only — provenance, for possible future re-normalization
  createdAt: string; // ISO
  image: Blob; // normalized PNG on a standard canvas
  width: number; // canvas dimensions, so the closet page lays out without decoding
  height: number;
}
