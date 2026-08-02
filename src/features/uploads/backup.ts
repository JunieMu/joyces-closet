import { isItemCategory, type ItemCategory } from "../closet/types";
import { isOutfitShape, withSavedBagDefault } from "../shuffle/outfit";
import type { SavedOutfit } from "../outfits/store";
import { isPlanEntry, type PlanEntry } from "../week/plan";
import type { TopSubtype } from "./types";

/** Marks the file as ours, so importing an unrelated .json fails cleanly instead of oddly. */
export const BACKUP_KIND = "joyces-closet:backup";
/**
 * Still 1 with `plans` added (2026-07-31 week-planning Decision 8): a bump would make old
 * builds reject new files outright (the version gate below), where staying put degrades
 * gracefully in both directions — an old build ignores the unknown key, and a new build
 * reading an old file coerces the missing array to []. The only cost is that an old build
 * re-exporting drops plans, which is a non-issue for a single-user, per-browser app.
 *
 * `bags` is the second field added under that rule (2026-08-02 Decision 12). A bump would
 * make an older cached bundle reject the ENTIRE file — items, outfits and plans — rather
 * than dropping just the bag items into `skipped`.
 */
export const BACKUP_VERSION = 1;

const SUBTYPES = new Set<string>(["shirt", "sweater", "tank"]);

/** An UploadRecord with its Blob flattened to base64 — the on-disk form of one item. */
export interface BackupItem {
  id: string;
  name: string;
  category: ItemCategory;
  subtype?: TopSubtype;
  createdAt: string;
  width: number;
  height: number;
  image: string; // base64 PNG, no data: prefix
}

export interface BackupFile {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  items: BackupItem[];
  outfits: SavedOutfit[];
  plans: PlanEntry[];
}

export interface DecodedBackup {
  items: BackupItem[];
  outfits: SavedOutfit[];
  plans: PlanEntry[];
  /** Entries dropped for failing validation — surfaced so an import can say so out loud. */
  skipped: number;
}

// btoa/atob only speak binary strings, and String.fromCharCode(...bytes) overflows the call
// stack somewhere around a hundred thousand arguments — well under one 1080px PNG. Chunking
// keeps it to a fixed number of arguments per call regardless of image size.
const CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Backed by an explicit ArrayBuffer, not the default ArrayBufferLike: a Uint8Array that
// might sit on a SharedArrayBuffer is not a BlobPart, and the caller's whole purpose is to
// hand these bytes to new Blob().
export function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isBackupItem(value: unknown): value is BackupItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    isItemCategory(item.category) &&
    (item.subtype === undefined ||
      (typeof item.subtype === "string" && SUBTYPES.has(item.subtype))) &&
    typeof item.createdAt === "string" &&
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    typeof item.image === "string" &&
    item.image.length > 0
  );
}

function isSavedOutfit(value: unknown): value is SavedOutfit {
  if (typeof value !== "object" || value === null) return false;
  const outfit = value as Record<string, unknown>;

  return (
    typeof outfit.id === "string" &&
    typeof outfit.name === "string" &&
    typeof outfit.createdAt === "string" &&
    isOutfitShape(outfit.outfit)
  );
}

export function encodeBackup(
  items: BackupItem[],
  outfits: SavedOutfit[],
  plans: PlanEntry[],
  exportedAt: string,
): string {
  const file: BackupFile = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt,
    items,
    outfits,
    plans,
  };
  // Not pretty-printed: base64 payloads dominate the file anyway, and indentation would
  // add megabytes for no one's benefit.
  return JSON.stringify(file);
}

/**
 * Reads a backup back, in the never-throw idiom the storage layer already uses
 * (localStorageStore.ts:24-39). A file that isn't ours throws — the user picked the wrong
 * file and needs telling — but a *valid* file carrying a few bad entries drops just those
 * and reports the count, so one corrupt item can't cost the whole wardrobe.
 */
export function decodeBackup(text: string): DecodedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a closet backup.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("That file isn't a closet backup.");
  }

  const file = parsed as Record<string, unknown>;
  if (file.kind !== BACKUP_KIND) {
    throw new Error("That file isn't a closet backup.");
  }
  if (typeof file.version !== "number" || file.version > BACKUP_VERSION) {
    throw new Error(
      "That backup was made by a newer version of the app than this one.",
    );
  }

  const rawItems = Array.isArray(file.items) ? file.items : [];
  const rawOutfits = Array.isArray(file.outfits) ? file.outfits : [];
  // Absent from every backup written before the week page existed (Decision 8).
  const rawPlans = Array.isArray(file.plans) ? file.plans : [];

  const items = rawItems.filter(isBackupItem);
  // Backup files on disk are permanent artifacts, so a file written before bags existed —
  // whose outfits have no `bagId` key — must keep importing forever (Decision 11).
  const outfits = rawOutfits.map(withSavedBagDefault).filter(isSavedOutfit);
  const plans = rawPlans.filter(isPlanEntry);
  const skipped =
    rawItems.length -
    items.length +
    (rawOutfits.length - outfits.length) +
    (rawPlans.length - plans.length);

  return { items, outfits, plans, skipped };
}

/** A stable, sortable filename — the date only, since one export a day is the realistic pace. */
export function backupFilename(now: Date): string {
  return `joyces-closet-${now.toISOString().slice(0, 10)}.json`;
}
