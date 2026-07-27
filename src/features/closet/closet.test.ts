import { beforeEach, describe, expect, it } from "vitest";

import { getCloset, getItem } from "./closet";
import type { ClosetItem, ItemCategory } from "./types";
import { useClosetStore } from "./useClosetStore";

// The closet is upload-only, so there is no static manifest to assert against — no disk
// paths, no fixed counts. These drive the store the way hydration does (setUploads) and
// check what the read seam hands back.
function upload(id: string, category: ItemCategory): ClosetItem {
  return { id, name: id, category, image: `blob:${id}` };
}

beforeEach(() => {
  useClosetStore.getState().setUploads([]);
});

describe("getCloset", () => {
  it("is empty before anything is uploaded", () => {
    expect(Object.values(getCloset()).flat()).toEqual([]);
  });

  it("has an entry for every category, even when empty", () => {
    expect(Object.keys(getCloset()).sort()).toEqual(
      ["accessories", "bottoms", "dresses", "jackets", "shoes", "tops"].sort(),
    );
  });

  it("reflects the uploads it was given", () => {
    const top = upload("u-top", "tops");
    useClosetStore.getState().setUploads([top, upload("u-shoe", "shoes")]);

    expect(getCloset().tops).toEqual([top]);
    expect(getCloset().shoes.map((item) => item.id)).toEqual(["u-shoe"]);
  });
});

describe("getItem", () => {
  it("looks up every uploaded item by id", () => {
    const uploads = [upload("u1", "tops"), upload("u2", "bottoms")];
    useClosetStore.getState().setUploads(uploads);

    for (const item of uploads) expect(getItem(item.id)).toBe(item);
  });

  it("returns undefined for an unknown id", () => {
    expect(getItem("nonexistent-99")).toBeUndefined();
  });

  // What makes a saved outfit referencing a deleted item degrade rather than break: the
  // lookup goes cold, and repairOutfit takes it from there.
  it("stops finding an item once it leaves the closet", () => {
    useClosetStore.getState().setUploads([upload("u1", "tops")]);
    expect(getItem("u1")).toBeDefined();

    useClosetStore.getState().setUploads([]);
    expect(getItem("u1")).toBeUndefined();
  });
});
