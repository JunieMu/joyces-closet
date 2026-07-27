import type { UploadRecord } from "./types";

/**
 * The only way uploads are persisted. Async because IndexedDB is — image blobs are far too
 * large for localStorage. Moving to a backend means one more implementation of this and
 * nothing else (same posture as OutfitStore).
 */
export interface UploadStore {
  list(): Promise<UploadRecord[]>;
  save(record: UploadRecord): Promise<void>;
  delete(id: string): Promise<void>;
}
