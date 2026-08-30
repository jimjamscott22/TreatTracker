import type { LocalDate, UtcInstant } from './entities';

/**
 * Date helpers for the "local calendar date" semantics in docs/architecture.md.
 *
 * "Today" is a user-facing local calendar concept, not a UTC date. Grouping uses
 * an event's stored `localDate`, which keeps the event attached to its intended
 * day across travel and daylight-saving changes.
 *
 * All arithmetic below treats a LocalDate as a bare calendar label and steps
 * through UTC, so a DST transition can never shift or duplicate a day.
 */

/** Derives the local calendar date observed at `instant` in `timeZone`. */
export function localDateOf(instant: Date | UtcInstant, timeZone?: string): LocalDate {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Offset in minutes east of UTC at `instant` for `timeZone`. */
export function utcOffsetMinutesOf(instant: Date, timeZone?: string): number {
  if (!timeZone) return -instant.getTimezoneOffset();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  const magnitude = Number(hours) * 60 + Number(minutes);
  return sign === '-' ? -magnitude : magnitude;
}

/** The device's IANA zone, or null when the runtime cannot report one. */
export function deviceTimeZone(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
}

function toUtcNoon(date: LocalDate): Date {
  // Noon avoids any chance of a date rolling under offset arithmetic.
  return new Date(`${date}T12:00:00.000Z`);
}

function fromUtcNoon(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcNoon(d);
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const ms = toUtcNoon(to).getTime() - toUtcNoon(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Every calendar date from `start` to `end`, inclusive of both ends. */
export function enumerateLocalDates(start: LocalDate, end: LocalDate): LocalDate[] {
  if (compareLocalDates(start, end) > 0) return [];
  const dates: LocalDate[] = [];
  for (let cursor = start; compareLocalDates(cursor, end) <= 0; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export type DateRange = {
  start: LocalDate;
  /** Inclusive. */
  end: LocalDate;
  /** Every date in the range, including days with zero events. */
  dates: LocalDate[];
};

/**
 * A range of `lengthDays` ending on (and including) `end` -- the shape the
 * 7-day and 30-day insight views use.
 */
export function rangeEndingOn(end: LocalDate, lengthDays: number): DateRange {
  if (lengthDays < 1) throw new Error('lengthDays must be at least 1');
  const start = addDays(end, -(lengthDays - 1));
  return { start, end, dates: enumerateLocalDates(start, end) };
}

/** The equally sized range immediately preceding `range`, for comparisons. */
export function previousRange(range: DateRange): DateRange {
  const length = range.dates.length;
  return rangeEndingOn(addDays(range.start, -1), length);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function monthDay(date: LocalDate): { month: string; day: number; year: string } {
  const [year = '', month = '01', day = '01'] = date.split('-');
  return { month: MONTHS[Number(month) - 1] ?? '', day: Number(day), year };
}

/**
 * Formats a range the way docs/ux-flows.md requires insights to cite it, e.g.
 * "Aug 16-22" or "Dec 28 - Jan 3".
 */
export function formatRangeLabel(range: DateRange): string {
  const from = monthDay(range.start);
  const to = monthDay(range.end);
  if (range.start === range.end) return `${from.month} ${from.day}`;
  if (from.month === to.month && from.year === to.year) {
    return `${from.month} ${from.day}–${to.day}`;
  }
  return `${from.month} ${from.day} – ${to.month} ${to.day}`;
}
