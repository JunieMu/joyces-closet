import { create } from "zustand";

import type { Outfit } from "../shuffle/outfit";
import { createLocalStorageOutfitStore } from "./localStorageStore";
import { defaultOutfitName } from "./naming";
import type { OutfitStore, SavedOutfit } from "./store";

// The one place that picks an OutfitStore implementation. Swapping in a backend-backed
// store (Decision 6) means changing this line and nothing else.
const outfitStore: OutfitStore = createLocalStorageOutfitStore();

interface OutfitsState {
  saved: SavedOutfit[];
  saveOutfit: (name: string, outfit: Outfit) => void;
  deleteOutfit: (id: string) => void;
  /** Restores outfits from a backup, keeping their ids. Returns how many were new. */
  importOutfits: (outfits: SavedOutfit[]) => number;
}

/**
 * A view over the OutfitStore — deliberately no persist middleware: persistence is the
 * store's job, this just mirrors it into React.
 */
export const useOutfitsStore = create<OutfitsState>()((set) => ({
  saved: outfitStore.list(),

  saveOutfit: (name, outfit) => {
    outfitStore.save({
      id: crypto.randomUUID(),
      name: name.trim() || defaultOutfitName(new Date()),
      createdAt: new Date().toISOString(),
      outfit,
    });
    set({ saved: outfitStore.list() });
  },

  deleteOutfit: (id) => {
    outfitStore.delete(id);
    set({ saved: outfitStore.list() });
  },

  // Ids are preserved rather than reminted (unlike saveOutfit) so that importing the same
  // backup twice is a no-op instead of doubling the list. An outfit wearing an item the
  // backup didn't carry needs no special handling — repairOutfit already covers it.
  importOutfits: (outfits) => {
    const existing = new Set(outfitStore.list().map((saved) => saved.id));
    const fresh = outfits.filter((outfit) => !existing.has(outfit.id));

    for (const outfit of fresh) outfitStore.save(outfit);
    set({ saved: outfitStore.list() });

    return fresh.length;
  },
}));

/**
 * The resolve seam for a possibly-deleted saved outfit — closet.ts's getItem/useClosetItem
 * pair (closet.ts:14-30) one hop out: plans reference SavedOutfits the way outfits reference
 * items, and a dead id resolves to undefined for the caller to render honestly rather than
 * crash on. A linear find rather than closet.ts's Map index on purpose — the week page
 * resolves at most seven ids per render against a list of dozens, where the closet index
 * serves module-init shuffles over every item.
 */
export function getSavedOutfit(id: string): SavedOutfit | undefined {
  return useOutfitsStore.getState().saved.find((saved) => saved.id === id);
}

export function useSavedOutfit(id: string | null): SavedOutfit | undefined {
  return useOutfitsStore((state) =>
    id === null ? undefined : state.saved.find((saved) => saved.id === id),
  );
}
