import type { Outfit } from "../shuffle/outfit";

export interface SavedOutfit {
  id: string;
  name: string;
  createdAt: string; // ISO
  outfit: Outfit;
}

/**
 * The only way saved outfits are persisted (Decision 6). The UI never touches a
 * storage API directly, so moving to a backend means writing one more implementation
 * of this interface — nothing else changes.
 */
export interface OutfitStore {
  list(): SavedOutfit[];
  save(outfit: SavedOutfit): void;
  delete(id: string): void;
}
