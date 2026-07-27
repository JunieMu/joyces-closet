import { describe, expect, it } from "vitest";

import type { SavedOutfit } from "../outfits/store";
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  backupFilename,
  decodeBackup,
  encodeBackup,
  fromBase64,
  toBase64,
  type BackupItem,
} from "./backup";

function item(overrides: Partial<BackupItem> = {}): BackupItem {
  return {
    id: "item-1",
    name: "Shirt · Jul 27",
    category: "tops",
    createdAt: "2026-07-27T00:00:00.000Z",
    width: 1080,
    height: 1080,
    image: toBase64(new Uint8Array([137, 80, 78, 71])), // a PNG magic number
    ...overrides,
  };
}

const outfit: SavedOutfit = {
  id: "outfit-1",
  name: "Outfit · Jul 27",
  createdAt: "2026-07-27T00:00:00.000Z",
  outfit: {
    base: { kind: "separates", topId: "item-1", bottomId: "item-2" },
    jacketId: null,
    shoesId: "item-3",
    accessoryId: null,
  },
};

const EXPORTED_AT = "2026-07-27T12:00:00.000Z";

describe("base64 round-trip", () => {
  it("survives an exact byte sequence", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 254]);

    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  // The reason toBase64 chunks: String.fromCharCode(...bytes) blows the call stack well
  // below the size of a real 1080px PNG, so a naive implementation passes small fixtures
  // and then fails on the first actual upload.
  it("handles a payload larger than one chunk without overflowing the stack", () => {
    const bytes = new Uint8Array(200_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;

    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it("round-trips an empty payload", () => {
    expect(fromBase64(toBase64(new Uint8Array()))).toEqual(new Uint8Array());
  });
});

describe("encodeBackup", () => {
  it("writes a file that decodeBackup reads back unchanged", () => {
    const decoded = decodeBackup(encodeBackup([item()], [outfit], EXPORTED_AT));

    expect(decoded.items).toEqual([item()]);
    expect(decoded.outfits).toEqual([outfit]);
    expect(decoded.skipped).toBe(0);
  });

  it("stamps the file so it can be recognised later", () => {
    const parsed: unknown = JSON.parse(encodeBackup([], [], EXPORTED_AT));

    expect(parsed).toMatchObject({
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exportedAt: EXPORTED_AT,
    });
  });

  it("round-trips an empty closet", () => {
    const decoded = decodeBackup(encodeBackup([], [], EXPORTED_AT));

    expect(decoded).toEqual({ items: [], outfits: [], skipped: 0 });
  });
});

describe("decodeBackup rejects a file that isn't ours", () => {
  it.each([
    ["not JSON at all", "definitely not json"],
    ["JSON that isn't an object", "42"],
    ["null", "null"],
    ["an object with no kind marker", JSON.stringify({ items: [] })],
    ["someone else's backup", JSON.stringify({ kind: "other-app:backup" })],
  ])("rejects %s", (_label, text) => {
    expect(() => decodeBackup(text)).toThrow(/isn't a closet backup/);
  });

  it("refuses a file from a newer version rather than guessing at it", () => {
    const text = JSON.stringify({
      kind: BACKUP_KIND,
      version: BACKUP_VERSION + 1,
      items: [],
      outfits: [],
    });

    expect(() => decodeBackup(text)).toThrow(/newer version/);
  });
});

describe("decodeBackup drops bad entries without losing the good ones", () => {
  function fileWith(items: unknown[], outfits: unknown[] = []): string {
    return JSON.stringify({
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exportedAt: EXPORTED_AT,
      items,
      outfits,
    });
  }

  it.each([
    ["a missing id", { ...item(), id: undefined }],
    ["a category that isn't real", { ...item(), category: "hats" }],
    ["a subtype that isn't real", { ...item(), subtype: "poncho" }],
    ["non-numeric dimensions", { ...item(), width: "1080" }],
    ["an empty image payload", { ...item(), image: "" }],
    ["not an object", "just a string"],
  ])("skips an item with %s", (_label, bad) => {
    const decoded = decodeBackup(fileWith([item(), bad]));

    expect(decoded.items).toEqual([item()]);
    expect(decoded.skipped).toBe(1);
  });

  it("keeps a valid optional subtype", () => {
    const tank = item({ id: "item-2", subtype: "tank" });

    expect(decodeBackup(fileWith([tank])).items).toEqual([tank]);
  });

  it("skips an outfit whose shape is wrong but keeps the rest", () => {
    const decoded = decodeBackup(
      fileWith([], [outfit, { ...outfit, id: "outfit-2", outfit: null }]),
    );

    expect(decoded.outfits).toEqual([outfit]);
    expect(decoded.skipped).toBe(1);
  });

  it("treats missing collections as empty rather than failing", () => {
    const text = JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION });

    expect(decodeBackup(text)).toEqual({ items: [], outfits: [], skipped: 0 });
  });
});

describe("backupFilename", () => {
  it("names the file by date, so exports sort chronologically", () => {
    expect(backupFilename(new Date("2026-07-27T18:30:00.000Z"))).toBe(
      "joyces-closet-2026-07-27.json",
    );
  });
});
