import type { ClosetItem } from "../closet/types";
import type { UploadRecord } from "./types";

/**
 * Object URLs are created here and live as long as the item does — revoked only when the
 * upload is deleted. Nothing persists an image path (outfits store ids only), so a URL
 * that changes every session is safe.
 *
 * Its own module, importing nothing but types, so that both `hydrate.ts` and
 * `useClosetStore` can use it without the closet and uploads features importing each
 * other in a cycle.
 */
export function toClosetItem(record: UploadRecord): ClosetItem {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    image: URL.createObjectURL(record.image),
    width: record.width,
    height: record.height,
  };
}
