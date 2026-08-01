import { beforeEach, describe, expect, it } from "vitest";

import { createLocalStoragePlanStore, PLAN_KEY } from "./localStoragePlanStore";
import type { PlanEntry } from "./plan";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const monday: PlanEntry = { kind: "weekday", weekday: 1, outfitId: "rota" };
const wedding: PlanEntry = {
  kind: "date",
  date: "2026-08-15",
  outfitId: "the-wedding",
};
const skip: PlanEntry = { kind: "date", date: "2026-08-15", outfitId: null };

describe("localStorage plan store", () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it("starts empty", () => {
    expect(createLocalStoragePlanStore(storage).list()).toEqual([]);
  });

  it("round-trips a rotation, an override and a skip", () => {
    const store = createLocalStoragePlanStore(storage);
    store.set(monday);
    store.set(wedding);
    store.set({ kind: "date", date: "2026-08-16", outfitId: null });

    expect(store.list()).toEqual([
      monday,
      wedding,
      { kind: "date", date: "2026-08-16", outfitId: null },
    ]);
  });

  it("keeps entries across store instances over the same storage", () => {
    createLocalStoragePlanStore(storage).set(monday);

    expect(createLocalStoragePlanStore(storage).list()).toEqual([monday]);
  });

  // The slot is the identity (plan.ts:20): planning the same monday twice replaces it.
  it("replaces the entry occupying the same weekday slot", () => {
    const store = createLocalStoragePlanStore(storage);
    store.set(monday);
    store.set({ kind: "weekday", weekday: 1, outfitId: "a-new-rotation" });

    expect(store.list()).toEqual([
      { kind: "weekday", weekday: 1, outfitId: "a-new-rotation" },
    ]);
  });

  it("replaces an override with a skip on the same date", () => {
    const store = createLocalStoragePlanStore(storage);
    store.set(wedding);
    store.set(skip);

    expect(store.list()).toEqual([skip]);
  });

  it("clears only the target slot", () => {
    const store = createLocalStoragePlanStore(storage);
    store.set(monday);
    store.set(wedding);

    store.clear({ kind: "date", date: "2026-08-15" });

    expect(store.list()).toEqual([monday]);
    expect(createLocalStoragePlanStore(storage).list()).toEqual([monday]);
  });

  it("ignores a clear for a slot nothing occupies", () => {
    const store = createLocalStoragePlanStore(storage);
    store.set(monday);

    store.clear({ kind: "weekday", weekday: 4 });

    expect(store.list()).toEqual([monday]);
  });

  it("returns an empty plan when the stored value is corrupt", () => {
    storage.map.set(PLAN_KEY, "{not json");

    expect(createLocalStoragePlanStore(storage).list()).toEqual([]);
  });

  it("returns an empty plan when the stored value is valid JSON of the wrong shape", () => {
    storage.map.set(PLAN_KEY, JSON.stringify({ monday: "the linen one" }));

    expect(createLocalStoragePlanStore(storage).list()).toEqual([]);
  });

  it("drops entries that are not plan entries, keeping the good ones", () => {
    storage.map.set(
      PLAN_KEY,
      JSON.stringify([
        monday,
        { kind: "weekday", weekday: 7, outfitId: "no-such-day" },
        null,
        42,
        wedding,
      ]),
    );

    expect(createLocalStoragePlanStore(storage).list()).toEqual([
      monday,
      wedding,
    ]);
  });

  it("recovers from corrupt storage on the next set", () => {
    storage.map.set(PLAN_KEY, "{not json");
    const store = createLocalStoragePlanStore(storage);

    store.set(monday);

    expect(store.list()).toEqual([monday]);
  });
});
