import { describe, expect, it } from "vitest";

import {
  addDays,
  dateKey,
  dayMark,
  monthDayLabel,
  weekdayName,
  weekdayShort,
  weekOf,
  weekRangeLabel,
} from "./week";

describe("dateKey", () => {
  it("pads the month and day to two digits", () => {
    expect(dateKey(new Date(2026, 6, 5))).toBe("2026-07-05");
  });

  // The anti-UTC assertion. It holds in every timezone because both the fixture and the
  // key are built from local components: toISOString().slice(0,10) would name the 6th
  // anywhere west of Greenwich, filing an evening's plan under tomorrow.
  it("keeps its local day for a late-evening time", () => {
    expect(dateKey(new Date(2026, 6, 5, 23, 30))).toBe("2026-07-05");
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(dateKey(addDays(new Date(2026, 6, 30), 3))).toBe("2026-08-02");
  });

  it("crosses a year boundary", () => {
    expect(dateKey(addDays(new Date(2026, 11, 30), 3))).toBe("2027-01-02");
  });

  it("walks backwards too", () => {
    expect(dateKey(addDays(new Date(2026, 7, 2), -3))).toBe("2026-07-30");
  });
});

describe("weekOf", () => {
  const anchor = new Date(2026, 6, 30); // a Thursday

  it("returns seven days", () => {
    expect(weekOf(anchor)).toHaveLength(7);
  });

  it("starts on sunday", () => {
    expect(weekOf(anchor)[0]?.getDay()).toBe(0);
  });

  it("contains the day it was asked about", () => {
    expect(weekOf(anchor).map(dateKey)).toContain(dateKey(anchor));
  });

  // Relationship assertions rather than a hard-coded list of dates (quotes.test.ts:12-16):
  // what matters is that the seven are consecutive, not which seven they are.
  it.each([
    ["an ordinary week", new Date(2026, 6, 30)],
    // A week straddling the US DST change, where adding 86_400_000 ms would produce a
    // 23:00 the-day-before and repeat a key.
    ["a week crossing a DST change", new Date(2026, 10, 1)],
  ])("yields seven distinct consecutive days across %s", (_label, date) => {
    const days = weekOf(date);
    const first = days[0];
    if (!first) throw new Error("weekOf returned an empty week");
    const keys = days.map(dateKey);

    expect(new Set(keys).size).toBe(7);
    expect(keys).toEqual(
      Array.from({ length: 7 }, (_unused, index) =>
        dateKey(addDays(first, index)),
      ),
    );
  });

  // The two ends of the boundary, which is where an off-by-one week start shows up: a sunday
  // opens its own week rather than closing the previous one, and a saturday closes its own
  // rather than opening the next.
  it("gives sunday the week that starts on it", () => {
    const sunday = new Date(2026, 7, 2);

    expect(weekOf(sunday).map(dateKey)[0]).toBe(dateKey(sunday));
  });

  it("gives saturday the week that ends on it", () => {
    const saturday = new Date(2026, 7, 1);

    expect(weekOf(saturday).map(dateKey).at(-1)).toBe(dateKey(saturday));
  });
});

describe("weekRangeLabel", () => {
  it("reads as a lowercase range, across a month boundary", () => {
    expect(weekRangeLabel(weekOf(new Date(2026, 6, 27)))).toBe(
      "jul 26 – aug 1",
    );
  });
});

describe("monthDayLabel", () => {
  it("is lowercase and unpadded, like the rest of the UI copy", () => {
    expect(monthDayLabel(new Date(2026, 7, 2))).toBe("aug 2");
  });
});

describe("weekdayName", () => {
  it("names the day in lowercase", () => {
    expect(weekdayName(new Date(2026, 6, 27))).toBe("monday");
  });
});

describe("weekdayShort", () => {
  it("abbreviates in lowercase", () => {
    expect(weekdayShort(new Date(2026, 6, 27))).toBe("mon");
  });
});

describe("dayMark", () => {
  it("is a bare number on an ordinary day", () => {
    expect(dayMark(new Date(2026, 6, 27))).toBe("27");
  });

  // The whole point of the exception: somewhere in a boundary week the month has to be named,
  // and the 1st is the day where it changed.
  it("carries the month on the first", () => {
    expect(dayMark(new Date(2026, 7, 1))).toBe("aug 1");
  });

  it("names exactly one day of a boundary week", () => {
    const marked = weekOf(new Date(2026, 6, 27)).filter((day) =>
      dayMark(day).includes(" "),
    );

    expect(marked).toHaveLength(1);
  });
});
