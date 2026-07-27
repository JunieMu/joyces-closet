import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getCloset } from "../closet/closet";
import { defaultRng } from "../../lib/rng";
import { isOutfitShape, isOutfitValid, type Outfit } from "./outfit";
import { shuffleOutfit, shuffleSlot, type SlotName } from "./shuffle";

/** Slots the rails can browse. "dress" is the merged base rail (dormant until dresses exist). */
export type EditableSlot =
  "top" | "bottom" | "dress" | "jacket" | "shoes" | "accessory";

interface ShuffleState {
  outfit: Outfit;
  shuffleAll: () => void;
  shuffleSlot: (slot: SlotName) => void;
  setSlot: (slot: EditableSlot, itemId: string | null) => void;
  setBaseKind: (kind: "separates" | "dress") => void;
  loadOutfit: (outfit: Outfit) => void;
}

function freshOutfit(): Outfit {
  return shuffleOutfit(getCloset(), defaultRng);
}

function applySlot(
  outfit: Outfit,
  slot: EditableSlot,
  itemId: string | null,
): Outfit {
  switch (slot) {
    case "top":
      if (outfit.base.kind !== "separates" || itemId === null) return outfit;
      return { ...outfit, base: { ...outfit.base, topId: itemId } };
    case "bottom":
      if (outfit.base.kind !== "separates" || itemId === null) return outfit;
      return { ...outfit, base: { ...outfit.base, bottomId: itemId } };
    case "dress":
      if (itemId === null) return outfit;
      return { ...outfit, base: { kind: "dress", dressId: itemId } };
    case "shoes":
      if (itemId === null) return outfit; // shoes are required — "none" is not a position
      return { ...outfit, shoesId: itemId };
    case "jacket":
      return { ...outfit, jacketId: itemId };
    case "accessory":
      return { ...outfit, accessoryId: itemId };
  }
}

export const useShuffleStore = create<ShuffleState>()(
  persist(
    (set, get) => ({
      outfit: freshOutfit(),

      shuffleAll: () => set({ outfit: freshOutfit() }),

      shuffleSlot: (slot) =>
        set({
          outfit: shuffleSlot(get().outfit, slot, getCloset(), defaultRng),
        }),

      setSlot: (slot, itemId) =>
        set({ outfit: applySlot(get().outfit, slot, itemId) }),

      // The separates↔dress toggle: swap the base wholesale, keeping the other slots.
      setBaseKind: (kind) => {
        const closet = getCloset();
        const { outfit } = get();
        if (outfit.base.kind === kind) return;

        if (kind === "dress") {
          const dress = closet.dresses[0];
          if (!dress) return;
          set({
            outfit: { ...outfit, base: { kind: "dress", dressId: dress.id } },
          });
          return;
        }

        const top = closet.tops[0];
        const bottom = closet.bottoms[0];
        if (!top || !bottom) return;
        set({
          outfit: {
            ...outfit,
            base: { kind: "separates", topId: top.id, bottomId: bottom.id },
          },
        });
      },

      loadOutfit: (outfit) => set({ outfit }),
    }),
    {
      name: "joyces-closet:current-outfit",
      partialize: (state) => ({ outfit: state.outfit }),

      // A persisted outfit is only reused if it still makes sense against today's
      // manifest — an item deleted since it was stored must never render as a broken
      // image, so anything missing or stale falls back to the fresh initial shuffle.
      merge: (persisted, current) => {
        const stored = (persisted as { outfit?: unknown } | undefined)?.outfit;
        const usable =
          isOutfitShape(stored) && isOutfitValid(stored, getCloset());
        return { ...current, outfit: usable ? stored : current.outfit };
      },
    },
  ),
);
