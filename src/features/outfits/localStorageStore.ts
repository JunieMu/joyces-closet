import { isOutfitShape, withSavedBagDefault } from "../shuffle/outfit";
import type { OutfitStore, SavedOutfit } from "./store";

export const SAVED_OUTFITS_KEY = "joyces-closet:saved-outfits:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isSavedOutfit(value: unknown): value is SavedOutfit {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string" &&
    isOutfitShape(candidate.outfit)
  );
}

export function createLocalStorageOutfitStore(
  storage: StorageLike = window.localStorage,
): OutfitStore {
  // Anything unreadable — missing key, corrupt JSON, a value of the wrong shape —
  // degrades to an empty list. Reading saved outfits must never throw.
  function read(): SavedOutfit[] {
    let raw: string | null;
    try {
      raw = storage.getItem(SAVED_OUTFITS_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];

    try {
      const parsed: unknown = JSON.parse(raw);
      // Normalized BEFORE filtering (2026-08-02 Decision 11): an outfit stored before bags
      // existed has no `bagId` key, which isOutfitShape rejects — and since save/delete
      // below read-filter-write the WHOLE array, a rejected outfit is deleted outright on
      // the next mutation rather than merely failing to display.
      return Array.isArray(parsed)
        ? parsed.map(withSavedBagDefault).filter(isSavedOutfit)
        : [];
    } catch {
      return [];
    }
  }

  function write(outfits: SavedOutfit[]): void {
    storage.setItem(SAVED_OUTFITS_KEY, JSON.stringify(outfits));
  }

  return {
    list: read,

    save(outfit) {
      const existing = read();
      const index = existing.findIndex((saved) => saved.id === outfit.id);
      if (index === -1) {
        write([...existing, outfit]);
      } else {
        write(
          existing.map((saved) => (saved.id === outfit.id ? outfit : saved)),
        );
      }
    },

    delete(id) {
      write(read().filter((saved) => saved.id !== id));
    },
  };
}
