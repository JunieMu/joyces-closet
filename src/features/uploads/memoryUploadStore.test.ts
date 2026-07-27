import { describe, expect, it } from "vitest";

import { createMemoryUploadStore } from "./memoryUploadStore";
import type { UploadRecord } from "./types";

function record(id: string, name: string): UploadRecord {
  return {
    id,
    name,
    category: "tops",
    subtype: "tank",
    createdAt: "2026-07-27T10:00:00.000Z",
    image: new Blob([id], { type: "image/png" }),
    width: 1080,
    height: 1080,
  };
}

describe("memory upload store", () => {
  it("starts empty", async () => {
    expect(await createMemoryUploadStore().list()).toEqual([]);
  });

  it("round-trips a saved record", async () => {
    const store = createMemoryUploadStore();
    const saved = record("a", "Tank · Jul 27");

    await store.save(saved);

    expect(await store.list()).toEqual([saved]);
  });

  it("replaces a record saved again under the same id", async () => {
    const store = createMemoryUploadStore();
    await store.save(record("a", "Tank · Jul 27"));
    await store.save(record("a", "Renamed"));

    const listed = await store.list();

    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Renamed");
  });

  it("deletes only the target record", async () => {
    const store = createMemoryUploadStore();
    await store.save(record("a", "One"));
    await store.save(record("b", "Two"));
    await store.save(record("c", "Three"));

    await store.delete("b");

    expect((await store.list()).map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("ignores a delete for an unknown id", async () => {
    const store = createMemoryUploadStore();
    await store.save(record("a", "One"));

    await store.delete("nope");

    expect((await store.list()).map((item) => item.id)).toEqual(["a"]);
  });

  it("seeds from an initial list", async () => {
    const store = createMemoryUploadStore([record("a", "One")]);

    expect((await store.list()).map((item) => item.id)).toEqual(["a"]);
  });
});
