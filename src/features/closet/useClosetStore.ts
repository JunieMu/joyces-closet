import { create } from "zustand";

import { requestPersistentStorage } from "../uploads/persistStorage";
import { toClosetItem } from "../uploads/toClosetItem";
import type { UploadRecord } from "../uploads/types";
import { uploadStore } from "../uploads/uploadStore";
import { buildIndex, toCloset } from "./merge";
import type { Closet, ClosetItem } from "./types";

interface ClosetState {
  uploads: ClosetItem[]; // hydrated: blobs already turned into object URLs
  closet: Closet;
  itemsById: Map<string, ClosetItem>;
  setUploads: (uploads: ClosetItem[]) => void;
  addUpload: (record: UploadRecord) => Promise<void>;
  removeUpload: (id: string) => Promise<void>;
  renameUpload: (id: string, name: string) => Promise<void>;
}

function derive(uploads: ClosetItem[]) {
  const closet = toCloset(uploads);
  return { uploads, closet, itemsById: buildIndex(closet) };
}

/** The closet source, and the only one: everything in it was uploaded. Deliberately no persist
 *  middleware — persistence is the UploadStore's job (same split as useOutfitsStore); this
 *  mirrors it into React. */
export const useClosetStore = create<ClosetState>()((set, get) => ({
  ...derive([]),

  setUploads: (uploads) => set(derive(uploads)),

  // Persist first, then mirror (the useOutfitsStore.ts:25-38 pattern). A rejected write —
  // a quota failure, most likely — propagates to the upload flow with the closet untouched,
  // so Joyce never sees an item that did not actually save.
  addUpload: async (record) => {
    await uploadStore.save(record);
    set(derive([...get().uploads, toClosetItem(record)]));

    // Fire-and-forget, after the save that made it worth asking for. Never awaited: the
    // upload is already durable, and a browser that prompts must not stall the flow.
    void requestPersistentStorage();
  },

  // Anything here can be deleted, including the last pair of shoes — so this is the operation
  // that can leave the closet unable to dress anyone. useShuffleStore subscribes to that and
  // re-validates; saved outfits are covered by the existing repairOutfit machinery.
  removeUpload: async (id) => {
    const item = get().uploads.find((upload) => upload.id === id);
    if (!item) return;

    await uploadStore.delete(id);
    // The one piece of lifecycle that leaks if forgotten — this URL was minted by
    // toClosetItem and nothing else can free it.
    URL.revokeObjectURL(item.image);
    set(derive(get().uploads.filter((upload) => upload.id !== id)));
  },

  renameUpload: async (id, name) => {
    const records = await uploadStore.list();
    const record = records.find((entry) => entry.id === id);
    if (!record) return;

    const trimmed = name.trim();
    if (!trimmed || trimmed === record.name) return;

    // Re-saving the whole record keeps the blob intact; only the name differs. The object
    // URL is untouched, so the rendered image never flickers.
    await uploadStore.save({ ...record, name: trimmed });
    set(
      derive(
        get().uploads.map((upload) =>
          upload.id === id ? { ...upload, name: trimmed } : upload,
        ),
      ),
    );
  },
}));
