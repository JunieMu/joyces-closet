import { describe, expect, it } from "vitest";

import {
  assignCommands,
  clearCommands,
  isPlanEntry,
  plannedDaysFor,
  planFor,
  slotKey,
  type PlanEntry,
  type PlanResolution,
} from "./plan";

// Local dates, never parsed from strings: new Date("2026-07-27") is UTC midnight, which is
// the day before west of Greenwich — exactly the shift dateKey exists to avoid.
const MONDAY = new Date(2026, 6, 27); // 2026-07-27, a Monday
const NEXT_MONDAY = new Date(2026, 7, 3); // 2026-08-03
const TUESDAY = new Date(2026, 6, 28); // 2026-07-28

const rotation: PlanEntry = { kind: "weekday", weekday: 1, outfitId: "rota" };
const override: PlanEntry = {
  kind: "date",
  date: "2026-07-27",
  outfitId: "just-today",
};
const skip: PlanEntry = { kind: "date", date: "2026-07-27", outfitId: null };

const PRECEDENCE: [string, PlanEntry[], Date, PlanResolution][] = [
  [
    "a dated entry beats the weekday rotation",
    [rotation, override],
    MONDAY,
    { source: "date", outfitId: "just-today" },
  ],
  [
    "a skip beats the rotation too, resolving to nothing",
    [rotation, skip],
    MONDAY,
    { source: "date", outfitId: null },
  ],
  [
    "the rotation fills a date with no entry of its own",
    [rotation],
    NEXT_MONDAY,
    { source: "weekday", outfitId: "rota" },
  ],
  ["an empty plan resolves to nothing", [], MONDAY, { source: "none" }],
  [
    "another day's dated entry does not leak",
    [override],
    TUESDAY,
    { source: "none" },
  ],
  [
    "another weekday's rotation does not apply",
    [rotation],
    TUESDAY,
    { source: "none" },
  ],
];

describe("planFor", () => {
  it.each(PRECEDENCE)("%s", (_label, entries, date, expected) => {
    expect(planFor(date, entries)).toEqual(expected);
  });
});

describe("assignCommands", () => {
  it("writes only the override for 'just this monday'", () => {
    expect(assignCommands([], MONDAY, "picked", "date")).toEqual([
      {
        op: "set",
        entry: { kind: "date", date: "2026-07-27", outfitId: "picked" },
      },
    ]);
  });

  it("writes the rotation slot for 'every monday'", () => {
    expect(assignCommands([], MONDAY, "picked", "weekday")).toEqual([
      { op: "set", entry: { kind: "weekday", weekday: 1, outfitId: "picked" } },
    ]);
  });

  // Otherwise the row the pill was tapped from would keep showing its old dated entry while
  // every other monday changed — the new rotation would look like it had missed a day.
  const STALE: [string, PlanEntry][] = [
    ["an override", override],
    ["a skip", skip],
  ];

  it.each(STALE)(
    "'every monday' also clears this day's %s",
    (_label, dated) => {
      expect(assignCommands([dated], MONDAY, "picked", "weekday")).toEqual([
        {
          op: "set",
          entry: { kind: "weekday", weekday: 1, outfitId: "picked" },
        },
        { op: "clear", slot: { kind: "date", date: "2026-07-27" } },
      ]);
    },
  );

  it("emits no clear when the day has no dated entry", () => {
    const commands = assignCommands([rotation], MONDAY, "picked", "weekday");

    expect(commands.filter((command) => command.op === "clear")).toEqual([]);
  });
});

describe("clearCommands", () => {
  it("writes a skip when clearing one day out of a rotation", () => {
    expect(clearCommands([rotation], MONDAY, "date")).toEqual([
      {
        op: "set",
        entry: { kind: "date", date: "2026-07-27", outfitId: null },
      },
    ]);
  });

  it("deletes the dated entry outright when no rotation underlies it", () => {
    expect(clearCommands([override], MONDAY, "date")).toEqual([
      { op: "clear", slot: { kind: "date", date: "2026-07-27" } },
    ]);
  });

  it("does nothing when the day is already empty", () => {
    expect(clearCommands([], MONDAY, "date")).toEqual([]);
  });

  it("clears the rotation slot for 'every monday'", () => {
    expect(clearCommands([rotation], MONDAY, "weekday")).toEqual([
      { op: "clear", slot: { kind: "weekday", weekday: 1 } },
    ]);
  });

  // Clearing from a row must leave THAT row empty, not reveal a leftover override.
  it("'every monday' also clears this day's dated entry", () => {
    expect(clearCommands([rotation, override], MONDAY, "weekday")).toEqual([
      { op: "clear", slot: { kind: "weekday", weekday: 1 } },
      { op: "clear", slot: { kind: "date", date: "2026-07-27" } },
    ]);
  });
});

describe("plannedDaysFor", () => {
  it("counts weekday and dated entries as one day each", () => {
    const entries: PlanEntry[] = [
      { kind: "weekday", weekday: 1, outfitId: "a" },
      { kind: "date", date: "2026-07-29", outfitId: "a" },
      { kind: "date", date: "2026-07-30", outfitId: "b" },
    ];

    expect(plannedDaysFor(entries, "a")).toBe(2);
  });

  it("never counts a skip", () => {
    expect(plannedDaysFor([skip], "just-today")).toBe(0);
  });

  it("is zero for an outfit nothing is planned around", () => {
    expect(plannedDaysFor([rotation, override], "unplanned")).toBe(0);
  });
});

const SHAPES: [string, unknown, boolean][] = [
  ["a weekday entry", { kind: "weekday", weekday: 0, outfitId: "a" }, true],
  ["a dated entry", { kind: "date", date: "2026-07-27", outfitId: "a" }, true],
  ["a skip", { kind: "date", date: "2026-07-27", outfitId: null }, true],
  [
    "a weekday past saturday",
    { kind: "weekday", weekday: 7, outfitId: "a" },
    false,
  ],
  [
    "a negative weekday",
    { kind: "weekday", weekday: -1, outfitId: "a" },
    false,
  ],
  [
    "a fractional weekday",
    { kind: "weekday", weekday: 2.5, outfitId: "a" },
    false,
  ],
  [
    "a weekday entry with no outfit",
    { kind: "weekday", weekday: 1, outfitId: null },
    false,
  ],
  [
    "an unpadded date",
    { kind: "date", date: "2026-8-3", outfitId: "a" },
    false,
  ],
  [
    "a date that isn't a string",
    { kind: "date", date: 20260727, outfitId: "a" },
    false,
  ],
  ["an unknown kind", { kind: "month", month: 7, outfitId: "a" }, false],
  ["null", null, false],
  ["a bare string", "monday", false],
];

describe("isPlanEntry", () => {
  it.each(SHAPES)("says %s is %s", (_label, value, expected) => {
    expect(isPlanEntry(value)).toBe(expected);
  });
});

describe("slotKey", () => {
  it("never collides across the two kinds", () => {
    expect(slotKey({ kind: "weekday", weekday: 1 })).not.toBe(
      slotKey({ kind: "date", date: "2026-07-27" }),
    );
  });

  it("is the same for the same slot whatever the entry carries", () => {
    expect(slotKey(override)).toBe(slotKey(skip));
  });
});
