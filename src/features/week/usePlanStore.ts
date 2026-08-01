import { create } from "zustand";

import { createLocalStoragePlanStore } from "./localStoragePlanStore";
import { slotKey, type DayCommand, type PlanEntry } from "./plan";
import type { PlanStore } from "./store";

// The one place that picks a PlanStore implementation (the useOutfitsStore.ts:8-10 idiom).
const planStore: PlanStore = createLocalStoragePlanStore();

interface PlanState {
  entries: PlanEntry[];
  /**
   * Runs a command list from assignCommands/clearCommands, then re-reads storage. The
   * pill semantics live in plan.ts where they are pure and tested; this only executes.
   */
  apply: (commands: DayCommand[]) => void;
  /**
   * Restores entries from a backup; an occupied slot keeps its local entry, so importing
   * the same file twice adds nothing (the importOutfits idiom, useOutfitsStore.ts:42-53).
   * Returns how many were new.
   */
  importEntries: (entries: PlanEntry[]) => number;
}

/**
 * A view over the PlanStore — persistence is the store's job, this just mirrors it into
 * React. Deliberately no persist middleware, and it seeds synchronously at module init
 * because localStorage is synchronous: unlike the closet, nothing here hangs off
 * main.tsx's hydration ordering (2026-07-13 closet-rebuild Decision 8).
 */
export const usePlanStore = create<PlanState>()((set) => ({
  entries: planStore.list(),

  apply: (commands) => {
    for (const command of commands) {
      if (command.op === "set") planStore.set(command.entry);
      else planStore.clear(command.slot);
    }
    set({ entries: planStore.list() });
  },

  importEntries: (entries) => {
    const occupied = new Set(planStore.list().map(slotKey));
    const fresh = entries.filter((entry) => !occupied.has(slotKey(entry)));

    for (const entry of fresh) planStore.set(entry);
    set({ entries: planStore.list() });

    return fresh.length;
  },
}));
