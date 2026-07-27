import { describe, expect, it } from "vitest";

import { readTheme, THEME_KEY, writeTheme } from "./themeStorage";
import { DEFAULT_THEME } from "./themes";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("theme storage", () => {
  it("round-trips a written theme", () => {
    const storage = fakeStorage();
    writeTheme("garden", storage);

    expect(readTheme(storage)).toBe("garden");
  });

  it("returns the default when the key is missing", () => {
    expect(readTheme(fakeStorage())).toBe(DEFAULT_THEME);
  });

  it("returns the default for an unknown stored id", () => {
    const storage = fakeStorage();
    storage.map.set(THEME_KEY, "neon");

    expect(readTheme(storage)).toBe(DEFAULT_THEME);
  });

  it("returns the default when getItem throws (never escapes)", () => {
    const storage = {
      getItem: () => {
        throw new Error("nope");
      },
      setItem: () => {},
    };

    expect(readTheme(storage)).toBe(DEFAULT_THEME);
  });

  it("does not throw when setItem throws", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };

    expect(() => writeTheme("seaglass", storage)).not.toThrow();
  });
});
