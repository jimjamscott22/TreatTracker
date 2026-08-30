import { compareLocalDates } from './dates';
import type { DailyGoal, LocalDate, TreatEvent } from './entities';

/**
 * Daily and range totals.
 *
 * Two rules from docs/ux-flows.md drive the shape of these types:
 *  - Unknown calories are excluded from totals and counted separately. Totals
 *    are always labelled "Known calories"; an unknown value is never zero.
 *  - Zero-event days are real days and must appear in a range summary, so the
 *    caller passes the calendar dates rather than letting events define them.
 */

export type DaySummary = {
  localDate: LocalDate;
  eventCount: number;
  /** Sum of known calorie estimates only, in milli-kcal. */
  knownKcalMilli: number;
  /** Events on this day whose calorie estimate was never entered. */
  unknownKcalEventCount: number;
};

export type RangeSummary = {
  dates: LocalDate[];
  days: DaySummary[];
  eventCount: number;
  knownKcalMilli: number;
  unknownKcalEventCount: number;
  /** Total events divided by the number of calendar days, zero-event days included. */
  averageEventsPerDay: number;
};

/** Drops soft-deleted rows. Callers that query through a repository get this already. */
export function activeEvents(events: readonly TreatEvent[]): TreatEvent[] {
  return events.filter((event) => event.deletedAt === null);
}

export function summarizeDay(
  events: readonly TreatEvent[],
  localDate: LocalDate,
): DaySummary {
  const onDay = activeEvents(events).filter((event) => event.localDate === localDate);

  let knownKcalMilli = 0;
  let unknownKcalEventCount = 0;

  for (const event of onDay) {
    if (event.kcalTotalMilli === null) {
      unknownKcalEventCount += 1;
    } else {
      knownKcalMilli += event.kcalTotalMilli;
    }
  }

  return {
    localDate,
    eventCount: onDay.length,
    knownKcalMilli,
    unknownKcalEventCount,
  };
}

/**
 * Summarizes `events` across an explicit list of `calendarDates`.
 *
 * Events outside those dates are ignored, so a caller can hand over a slightly
 * wider query result without skewing the totals.
 */
export function summarizeRange(
  events: readonly TreatEvent[],
  calendarDates: readonly LocalDate[],
): RangeSummary {
  const dates = [...calendarDates].sort(compareLocalDates);
  const days = dates.map((date) => summarizeDay(events, date));

  const eventCount = days.reduce((sum, day) => sum + day.eventCount, 0);
  const knownKcalMilli = days.reduce((sum, day) => sum + day.knownKcalMilli, 0);
  const unknownKcalEventCount = days.reduce(
    (sum, day) => sum + day.unknownKcalEventCount,
    0,
  );

  return {
    dates,
    days,
    eventCount,
    knownKcalMilli,
    unknownKcalEventCount,
    averageEventsPerDay: dates.length === 0 ? 0 : eventCount / dates.length,
  };
}

/** The goal in effect on `date`, honouring historical effective ranges. */
export function goalInEffect(
  goals: readonly DailyGoal[],
  date: LocalDate,
): DailyGoal | null {
  const candidates = goals.filter(
    (goal) =>
      goal.deletedAt === null &&
      compareLocalDates(goal.effectiveFrom, date) <= 0 &&
      (goal.effectiveTo === null || compareLocalDates(date, goal.effectiveTo) < 0),
  );

  // Most recently effective wins if application validation ever let two overlap.
  return (
    candidates.sort((a, b) => compareLocalDates(b.effectiveFrom, a.effectiveFrom))[0] ??
    null
  );
}

export type BudgetProgress = {
  metric: DailyGoal['metric'];
  /** Achieved value in milli units, matching `targetMilli`. */
  actualMilli: number;
  targetMilli: number;
  /** 0..1+, uncapped so "above budget" stays expressible. */
  fraction: number;
  overBy: number;
  /** True when some entry lacked a calorie estimate, making a kcal budget partial. */
  hasUnknownCalories: boolean;
};

/**
 * Progress against an optional, user-defined daily budget.
 *
 * docs/ux-flows.md is explicit that exceeding a self-set budget is not an error
 * state: this returns plain numbers and never a pass/fail or severity.
 */
export function budgetProgress(
  day: DaySummary,
  goal: DailyGoal | null,
): BudgetProgress | null {
  if (!goal || goal.targetMilli <= 0) return null;

  const actualMilli =
    goal.metric === 'event_count' ? day.eventCount * 1000 : day.knownKcalMilli;

  return {
    metric: goal.metric,
    actualMilli,
    targetMilli: goal.targetMilli,
    fraction: actualMilli / goal.targetMilli,
    overBy: Math.max(0, actualMilli - goal.targetMilli),
    hasUnknownCalories:
      goal.metric === 'known_kcal' && day.unknownKcalEventCount > 0,
  };
}
