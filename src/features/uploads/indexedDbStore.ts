import type { UploadStore } from "./store";
import type { UploadRecord } from "./types";

export const UPLOADS_DB = "joyces-closet:uploads:v1";
export const UPLOADS_STORE = "items";

const CATEGORIES = new Set([
  "tops",
  "bottoms",
  "dresses",
  "jackets",
  "shoes",
  "accessories",
]);

function isUploadRecord(value: unknown): value is UploadRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    CATEGORIES.has(candidate.category) &&
    typeof candidate.createdAt === "string" &&
    candidate.image instanceof Blob &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  );
}

/** Promisifies an IDBRequest. Rejections carry the underlying DOMException. */
function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export function createIndexedDbUploadStore(factory?: IDBFactory): UploadStore {
  let opening: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    // One connection, reused. A failed open is not cached, so a later call can retry.
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      // Resolved here rather than as a default parameter, so that merely constructing the
      // store touches no globals: `uploadStore.ts` is imported transitively by closet.ts,
      // which the node-environment tests do load.
      const idb = factory ?? globalThis.indexedDB;
      if (!idb) {
        reject(new Error("IndexedDB is unavailable in this environment"));
        return;
      }

      const request = idb.open(UPLOADS_DB, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
          db.createObjectStore(UPLOADS_STORE, { keyPath: "id" });
        }
      };

      // A second tab holding an old version open blocks the upgrade indefinitely; failing
      // fast beats a hydration that never resolves and so never mounts the app.
      request.onblocked = () =>
        reject(new Error("IndexedDB upgrade blocked by another tab"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open IndexedDB"));
    }).catch((error: unknown) => {
      opening = null;
      throw error;
    });

    return opening;
  }

  async function transact<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const db = await open();
    const transaction = db.transaction(UPLOADS_STORE, mode);
    const result = await run(transaction.objectStore(UPLOADS_STORE));

    // Writes are only durable once the transaction itself commits — a quota failure
    // surfaces here rather than on the individual request.
    if (mode === "readwrite") {
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Upload transaction aborted"));
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Upload transaction failed"));
      });
    }

    return result;
  }

  return {
    // Reading uploads must never throw (the localStorageStore.ts:24-39 idiom): a missing
    // DB, a blocked upgrade or a record of the wrong shape degrades to an empty list, so
    // Joyce lands on the empty-closet prompt instead of a dead app.
    async list() {
      try {
        const records = await transact("readonly", (store) =>
          toPromise(store.getAll()),
        );
        return Array.isArray(records) ? records.filter(isUploadRecord) : [];
      } catch {
        return [];
      }
    },

    // Writes surface their error so the upload UI can report a quota failure honestly.
    async save(record) {
      await transact("readwrite", (store) => toPromise(store.put(record)));
    },

    async delete(id) {
      await transact("readwrite", (store) => toPromise(store.delete(id)));
    },
  };
}
