import { beforeEach, describe, expect, it } from "vitest";

import type { Outfit } from "../shuffle/outfit";
import {
  createLocalStorageOutfitStore,
  SAVED_OUTFITS_KEY,
} from "./localStorageStore";
import type { SavedOutfit } from "./store";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const outfit: Outfit = {
  base: { kind: "separates", topId: "top-tank-3", bottomId: "bottom-skirt-2" },
  jacketId: null,
  shoesId: "shoes-1",
  accessoryId: "accessory-bag-1",
};

function saved(id: string, name: string): SavedOutfit {
  return { id, name, createdAt: "2026-07-13T10:00:00.000Z", outfit };
}

describe("localStorage outfit store", () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it("starts empty", () => {
    expect(createLocalStorageOutfitStore(storage).list()).toEqual([]);
  });

  it("round-trips a saved outfit", () => {
    const store = createLocalStorageOutfitStore(storage);
    store.save(saved("a", "Outfit · Jul 13"));

    expect(store.list()).toEqual([saved("a", "Outfit · Jul 13")]);
  });

  it("keeps saved outfits across store instances over the same storage", () => {
    createLocalStorageOutfitStore(storage).save(saved("a", "Brunch"));

    expect(createLocalStorageOutfitStore(storage).list()).toEqual([
      saved("a", "Brunch"),
    ]);
  });

  it("replaces an outfit saved again under the same id", () => {
    const store = createLocalStorageOutfitStore(storage);
    store.save(saved("a", "Brunch"));
    store.save(saved("a", "Brunch, renamed"));

    expect(store.list()).toEqual([saved("a", "Brunch, renamed")]);
  });

  it("deletes only the target outfit", () => {
    const store = createLocalStorageOutfitStore(storage);
    store.save(saved("a", "Brunch"));
    store.save(saved("b", "Work"));
    store.save(saved("c", "Dinner"));

    store.delete("b");

    expect(store.list().map((s) => s.id)).toEqual(["a", "c"]);
    expect(
      createLocalStorageOutfitStore(storage)
        .list()
        .map((s) => s.id),
    ).toEqual(["a", "c"]);
  });

  it("ignores a delete for an unknown id", () => {
    const store = createLocalStorageOutfitStore(storage);
    store.save(saved("a", "Brunch"));

    store.delete("nope");

    expect(store.list().map((s) => s.id)).toEqual(["a"]);
  });

  it("returns an empty list when the stored value is corrupt", () => {
    storage.map.set(SAVED_OUTFITS_KEY, "{not json");

    expect(createLocalStorageOutfitStore(storage).list()).toEqual([]);
  });

  it("returns an empty list when the stored value is valid JSON of the wrong shape", () => {
    storage.map.set(
      SAVED_OUTFITS_KEY,
      JSON.stringify({ outfits: "everywhere" }),
    );

    expect(createLocalStorageOutfitStore(storage).list()).toEqual([]);
  });

  it("drops entries that are not saved outfits, keeping the good ones", () => {
    storage.map.set(
      SAVED_OUTFITS_KEY,
      JSON.stringify([saved("a", "Brunch"), null, 42, {}]),
    );

    expect(createLocalStorageOutfitStore(storage).list()).toEqual([
      saved("a", "Brunch"),
    ]);
  });

  it("recovers from corrupt storage on the next save", () => {
    storage.map.set(SAVED_OUTFITS_KEY, "{not json");
    const store = createLocalStorageOutfitStore(storage);

    store.save(saved("a", "Brunch"));

    expect(store.list()).toEqual([saved("a", "Brunch")]);
  });
});
