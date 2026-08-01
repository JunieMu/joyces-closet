/**
 * Local-day arithmetic for the week page (2026-07-31 week-planning Decision 4). Nothing
 * here touches UTC: a plan's whole notion of "day" is the day Joyce is standing in.
 */

/**
 * The local date key "YYYY-MM-DD" — built from local components, NEVER via
 * toISOString().slice(0,10) (backup.ts:159's filename idiom): that one is UTC and names
 * tomorrow from ~7pm Central onwards, which would file an evening's plan under the wrong
 * day. This is the string a dated plan entry is keyed by.
 */
export function dateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * date + n days, at local midnight. The component constructor rolls over months, years and
 * DST correctly; adding 86_400_000 ms does not, on the two days a year that aren't 24 hours
 * long — it would land at 23:00 the previous day and name the wrong date.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * The seven local dates of the sunday–saturday week containing `date`.
 *
 * This is the only place the week's start day lives. Stored entries are unaffected by it:
 * a weekday slot holds a raw `getDay()` number (plan.ts:5), which is 0 = Sunday whatever
 * order the page happens to lay the days out in.
 */
export function weekOf(date: Date): Date[] {
  // getDay() is already sunday-first, so it IS the offset from the start of the week.
  const sunday = addDays(date, -date.getDay());

  return Array.from({ length: 7 }, (_, index) => addDays(sunday, index));
}

/** "jul 27" — the row's date line, and half of the week range. */
export function monthDayLabel(date: Date): string {
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
}

/** "jul 27 – aug 2" (Decision 9) — an en dash, lowercase like all UI copy. */
export function weekRangeLabel(days: Date[]): string {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return "";

  return `${monthDayLabel(first)} – ${monthDayLabel(last)}`;
}

/** "monday" — the panel heading, and the word the scope pills are phrased around. */
export function weekdayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

/** "mon" — the day box's own label, where the full name would not survive a 98px column. */
export function weekdayShort(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
}

/**
 * The number in a day box's corner. Bare ("27") on an ordinary day, but the 1st carries its
 * month ("aug 1"): a week straddling a boundary otherwise runs 30, 31, 1, 2 with nothing on
 * the grid itself saying where the month turned over.
 */
export function dayMark(date: Date): string {
  return date.getDate() === 1 ? monthDayLabel(date) : `${date.getDate()}`;
}
