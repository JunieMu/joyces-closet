import { isPlanEntry, slotKey, type PlanEntry } from "./plan";
import type { PlanStore } from "./store";

export const PLAN_KEY = "joyces-closet:plan:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createLocalStoragePlanStore(
  storage: StorageLike = window.localStorage,
): PlanStore {
  // Anything unreadable — missing key, corrupt JSON, a value of the wrong shape —
  // degrades to an empty plan. Reading the plan must never throw.
  function read(): PlanEntry[] {
    let raw: string | null;
    try {
      raw = storage.getItem(PLAN_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];

    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isPlanEntry) : [];
    } catch {
      return [];
    }
  }

  function write(entries: PlanEntry[]): void {
    storage.setItem(PLAN_KEY, JSON.stringify(entries));
  }

  return {
    list: read,

    // Keyed on the slot rather than an id (plan.ts:20): planning a monday twice replaces
    // the monday, it does not accumulate two mondays.
    set(entry) {
      const existing = read();
      const key = slotKey(entry);
      const index = existing.findIndex((saved) => slotKey(saved) === key);

      if (index === -1) {
        write([...existing, entry]);
      } else {
        write(
          existing.map((saved) => (slotKey(saved) === key ? entry : saved)),
        );
      }
    },

    clear(slot) {
      const key = slotKey(slot);
      write(read().filter((saved) => slotKey(saved) !== key));
    },
  };
}
