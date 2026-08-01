import type { PlanEntry, PlanSlot } from "./plan";

/**
 * The only way plans are persisted (2026-07-31 week-planning; the OutfitStore idiom,
 * outfits/store.ts:10-14). The UI never touches a storage API directly, so moving to a
 * backend means writing one more implementation of this interface — nothing else changes.
 */
export interface PlanStore {
  list(): PlanEntry[];
  /** Upserts by slot: a second entry for the same weekday or date replaces the first. */
  set(entry: PlanEntry): void;
  clear(slot: PlanSlot): void;
}
