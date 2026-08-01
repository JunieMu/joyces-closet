import { dateKey } from "./week";

/** A slot a plan entry occupies: a recurring weekday or one specific local date. */
export type PlanSlot =
  | { kind: "weekday"; weekday: number } // 0–6, Date.getDay() numbering (0 = Sunday)
  | { kind: "date"; date: string }; // "YYYY-MM-DD" local — see dateKey()

/**
 * One planned day (2026-07-31 week-planning Decision 1), mirroring OutfitBase's union
 * (outfit.ts:3-6). References a SavedOutfit by id only — ids are the contract, which is
 * what keeps this module free of any feature dependency. A dated entry with outfitId null
 * is an explicit skip ("nothing this monday"), and that is what lets one day be cleared
 * out of a standing rotation (Decision 5). Weekday entries never hold null: clearing a
 * rotation is deleting its entry.
 */
export type PlanEntry =
  | { kind: "weekday"; weekday: number; outfitId: string }
  | { kind: "date"; date: string; outfitId: string | null };

/** The slot IS an entry's identity — no uuid. Upsert, clear and backup merge all key on it. */
export function slotKey(slot: PlanSlot): string {
  return slot.kind === "weekday"
    ? `weekday:${slot.weekday}`
    : `date:${slot.date}`;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Structural check for untrusted data (the isOutfitShape idiom, outfit.ts:24-27). Used by
 * BOTH the store read and backup import — defined once here so the isSavedOutfit
 * duplication (localStorageStore.ts:8, backup.ts:90) is not repeated at this level.
 */
export function isPlanEntry(value: unknown): value is PlanEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;

  if (entry.kind === "weekday") {
    return (
      typeof entry.weekday === "number" &&
      Number.isInteger(entry.weekday) &&
      entry.weekday >= 0 &&
      entry.weekday <= 6 &&
      typeof entry.outfitId === "string"
    );
  }

  if (entry.kind === "date") {
    return (
      typeof entry.date === "string" &&
      DATE_KEY_RE.test(entry.date) &&
      (entry.outfitId === null || typeof entry.outfitId === "string")
    );
  }

  return false;
}

type DateEntry = Extract<PlanEntry, { kind: "date" }>;
type WeekdayEntry = Extract<PlanEntry, { kind: "weekday" }>;

export function dateEntryAt(
  entries: PlanEntry[],
  date: string,
): DateEntry | undefined {
  return entries.find(
    (entry): entry is DateEntry => entry.kind === "date" && entry.date === date,
  );
}

export function weekdayEntryAt(
  entries: PlanEntry[],
  weekday: number,
): WeekdayEntry | undefined {
  return entries.find(
    (entry): entry is WeekdayEntry =>
      entry.kind === "weekday" && entry.weekday === weekday,
  );
}

/** What a day resolves to, and which layer said so — the row's badge needs the source. */
export type PlanResolution =
  | { source: "date"; outfitId: string | null } // null = an explicit skip
  | { source: "weekday"; outfitId: string }
  | { source: "none" };

/**
 * The dated entry wins (including a skip), else the weekday rotation, else nothing
 * (Decision 1) — the feature's single interesting invariant.
 */
export function planFor(date: Date, entries: PlanEntry[]): PlanResolution {
  const dated = dateEntryAt(entries, dateKey(date));
  if (dated) return { source: "date", outfitId: dated.outfitId };

  const rotation = weekdayEntryAt(entries, date.getDay());
  if (rotation) return { source: "weekday", outfitId: rotation.outfitId };

  return { source: "none" };
}

export type Scope = "date" | "weekday";

export type DayCommand =
  { op: "set"; entry: PlanEntry } | { op: "clear"; slot: PlanSlot };

/**
 * The writes behind the two assignment pills (Decision 5). "date" writes the one-day
 * override. "weekday" writes the rotation slot — and also removes any dated entry on the
 * day the pill was tapped from, so THAT row shows the rotation immediately instead of a
 * stale override or skip still winning over it.
 *
 * Total, like clearCommands: a scope with nothing to do emits nothing rather than assuming
 * the UI gated correctly.
 */
export function assignCommands(
  entries: PlanEntry[],
  date: Date,
  outfitId: string,
  scope: Scope,
): DayCommand[] {
  const key = dateKey(date);

  if (scope === "date") {
    return [{ op: "set", entry: { kind: "date", date: key, outfitId } }];
  }

  const commands: DayCommand[] = [
    { op: "set", entry: { kind: "weekday", weekday: date.getDay(), outfitId } },
  ];
  if (dateEntryAt(entries, key)) {
    commands.push({ op: "clear", slot: { kind: "date", date: key } });
  }

  return commands;
}

/**
 * The writes behind the two clear pills. "date": when a rotation underlies this day an
 * explicit skip is written, because merely deleting the override would repopulate the row
 * from the rotation; with no rotation underneath the dated entry is simply deleted.
 * "weekday": the rotation slot goes, and so does this day's dated entry — clearing from a
 * row must leave THAT row empty rather than revealing a leftover override.
 */
export function clearCommands(
  entries: PlanEntry[],
  date: Date,
  scope: Scope,
): DayCommand[] {
  const key = dateKey(date);
  const dated = dateEntryAt(entries, key);
  const rotation = weekdayEntryAt(entries, date.getDay());

  if (scope === "date") {
    if (rotation) {
      return [
        { op: "set", entry: { kind: "date", date: key, outfitId: null } },
      ];
    }
    return dated ? [{ op: "clear", slot: { kind: "date", date: key } }] : [];
  }

  const commands: DayCommand[] = [];
  if (rotation) {
    commands.push({
      op: "clear",
      slot: { kind: "weekday", weekday: date.getDay() },
    });
  }
  if (dated) {
    commands.push({ op: "clear", slot: { kind: "date", date: key } });
  }

  return commands;
}

/**
 * How many planned days wear this outfit — the delete confirmation's honesty line
 * (Decision 7), the plan-level analogue of outfitUsesItem (outfit.ts:83-95). A weekday
 * entry counts as one day; a skip (outfitId null) never matches anything.
 */
export function plannedDaysFor(entries: PlanEntry[], outfitId: string): number {
  return entries.filter((entry) => entry.outfitId === outfitId).length;
}
