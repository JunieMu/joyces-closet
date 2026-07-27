import { describe, expect, it } from "vitest";

import { defaultOutfitName } from "./naming";

describe("defaultOutfitName", () => {
  it("names an outfit after its date", () => {
    expect(defaultOutfitName(new Date(2026, 6, 13))).toBe("Outfit · Jul 13");
  });

  it("does not pad single-digit days", () => {
    expect(defaultOutfitName(new Date(2026, 0, 1))).toBe("Outfit · Jan 1");
  });
});
