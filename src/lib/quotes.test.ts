import { describe, expect, it } from "vitest";

import { QUOTES, quoteOfTheDay } from "./quotes";

describe("quoteOfTheDay", () => {
  it("returns the same quote for any two times on the same day", () => {
    expect(quoteOfTheDay(new Date(2026, 6, 13, 0, 1))).toBe(
      quoteOfTheDay(new Date(2026, 6, 13, 23, 59)),
    );
  });

  it("advances to the adjacent quote on the next day", () => {
    const today = QUOTES.indexOf(quoteOfTheDay(new Date(2026, 6, 13)));
    const tomorrow = QUOTES.indexOf(quoteOfTheDay(new Date(2026, 6, 14)));
    expect(tomorrow).toBe((today + 1) % QUOTES.length);
  });

  it("never runs off the end of the list", () => {
    for (let day = 0; day < QUOTES.length * 2; day++) {
      expect(QUOTES).toContain(quoteOfTheDay(new Date(2026, 0, 1 + day)));
    }
  });
});
