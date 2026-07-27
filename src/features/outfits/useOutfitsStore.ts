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
}));
