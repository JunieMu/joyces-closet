import type { UploadStore } from "./store";
import type { UploadRecord } from "./types";

/** An UploadStore that forgets everything on reload. Exists so the store contract can be
 *  tested under `environment: "node"`, which has no IndexedDB. */
export function createMemoryUploadStore(
  initial: UploadRecord[] = [],
): UploadStore {
  const records = new Map(initial.map((record) => [record.id, record]));

  return {
    list: () => Promise.resolve([...records.values()]),

    save(record) {
      records.set(record.id, record);
      return Promise.resolve();
    },

    delete(id) {
      records.delete(id);
      return Promise.resolve();
    },
  };
}
