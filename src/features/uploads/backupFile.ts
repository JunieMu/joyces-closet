import { useClosetStore } from "../closet/useClosetStore";
import { useOutfitsStore } from "../outfits/useOutfitsStore";
import { usePlanStore } from "../week/usePlanStore";
import {
  backupFilename,
  decodeBackup,
  encodeBackup,
  fromBase64,
  toBase64,
  type BackupItem,
} from "./backup";
import { uploadStore } from "./uploadStore";

/**
 * The browser half of backup: blobs to bytes and back, a download, a file read. Everything
 * that can be decided without a DOM lives in backup.ts, which is why that half is the tested
 * one — this is glue.
 */

export interface ImportResult {
  itemsAdded: number;
  itemsAlreadyPresent: number;
  outfitsAdded: number;
  plansAdded: number;
  skipped: number;
}

function download(text: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  // Revoked on the next tick rather than immediately: some browsers read the href
  // asynchronously after click(), and pulling the URL out from under them cancels the save.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Everything in the closet, every saved outfit and the plan, as one self-contained JSON file. */
export async function exportBackup(now: Date): Promise<number> {
  const records = await uploadStore.list();

  const items: BackupItem[] = await Promise.all(
    records.map(async (record) => ({
      id: record.id,
      name: record.name,
      category: record.category,
      ...(record.subtype ? { subtype: record.subtype } : {}),
      createdAt: record.createdAt,
      width: record.width,
      height: record.height,
      image: toBase64(new Uint8Array(await record.image.arrayBuffer())),
    })),
  );

  const outfits = useOutfitsStore.getState().saved;
  const plans = usePlanStore.getState().entries;
  download(
    encodeBackup(items, outfits, plans, now.toISOString()),
    backupFilename(now),
  );

  return items.length;
}

/**
 * Merges a backup into the closet: anything whose id is already here is left alone, so
 * importing the same file twice adds nothing the second time. Deliberately never destructive
 * — there is no "replace my closet" path, because getting that wrong costs the wardrobe.
 */
export async function importBackup(file: File): Promise<ImportResult> {
  const { items, outfits, plans, skipped } = decodeBackup(await file.text());

  const present = new Set((await uploadStore.list()).map(({ id }) => id));
  const fresh = items.filter((item) => !present.has(item.id));

  // Through addUpload so each item persists, mints its object URL and lands in the closet
  // by the same path an ordinary upload takes — one at a time, so a quota failure partway
  // through leaves everything before it saved rather than rolling the lot back.
  for (const item of fresh) {
    await useClosetStore.getState().addUpload({
      id: item.id,
      name: item.name,
      category: item.category,
      ...(item.subtype ? { subtype: item.subtype } : {}),
      createdAt: item.createdAt,
      image: new Blob([fromBase64(item.image)], { type: "image/png" }),
      width: item.width,
      height: item.height,
    });
  }

  return {
    itemsAdded: fresh.length,
    itemsAlreadyPresent: items.length - fresh.length,
    outfitsAdded: useOutfitsStore.getState().importOutfits(outfits),
    // Slot-keyed and additive, like outfits: a day already planned locally keeps its own
    // entry, so importing the same file twice adds nothing the second time.
    plansAdded: usePlanStore.getState().importEntries(plans),
    skipped,
  };
}
