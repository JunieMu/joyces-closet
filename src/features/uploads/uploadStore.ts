import { createIndexedDbUploadStore } from "./indexedDbStore";
import type { UploadStore } from "./store";

// The one place that picks an implementation — the OutfitStore idiom (useOutfitsStore.ts:10).
export const uploadStore: UploadStore = createIndexedDbUploadStore();
