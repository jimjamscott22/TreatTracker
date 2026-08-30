import type { TreatCategory, TreatEvent } from './entities';
import { activeEvents } from './totals';
import type { RangeSummary } from './totals';

/**
 * Range comparison and ranking for the Insights tab.
 *
 * Ranking and labelling read exclusively from each event's snapshot fields.
 * docs/architecture.md forbids joining current catalog values onto old events,
 * so a renamed or archived treat keeps the name it had when it was recorded.
 */

export type Delta = {
  current: number;
  previous: number;
  absolute: number;
  /**
   * Change as a fraction of the previous value, or null when the previous value
   * was zero -- there is no meaningful percentage change from nothing, and
   * reporting "+100%" there would be misleading.
   */
  fraction: number | null;
};

function delta(current: number, previous: number): Delta {
  return {
    current,
    previous,
    absolute: current - previous,
    fraction: previous === 0 ? null : (current - previous) / previous,
  };
}

export type RangeComparison = {
  eventCount: Delta;
  knownKcalMilli: Delta;
  averageEventsPerDay: Delta;
  /** True when either range has entries with no calorie estimate. */
  comparisonAffectedByUnknownCalories: boolean;
};

export function compareRanges(
  currentSummary: RangeSummary,
  previousSummary: RangeSummary,
): RangeComparison {
  return {
    eventCount: delta(currentSummary.eventCount, previousSummary.eventCount),
    knownKcalMilli: delta(
      currentSummary.knownKcalMilli,
      previousSummary.knownKcalMilli,
    ),
    averageEventsPerDay: delta(
      currentSummary.averageEventsPerDay,
      previousSummary.averageEventsPerDay,
    ),
    comparisonAffectedByUnknownCalories:
      currentSummary.unknownKcalEventCount > 0 ||
      previousSummary.unknownKcalEventCount > 0,
  };
}

export type RankedTreat = {
  /** Catalog id when the event still points at one; null for one-off entries. */
  treatId: string | null;
  /** Historical display name from the event snapshot. */
  name: string;
  brand: string | null;
  eventCount: number;
  knownKcalMilli: number;
  unknownKcalEventCount: number;
};

/**
 * Ranks treats by how often they were recorded, most frequent first. Ties break
 * alphabetically so the ordering is deterministic and testable.
 */
export function rankTreats(events: readonly TreatEvent[]): RankedTreat[] {
  const buckets = new Map<string, RankedTreat>();

  for (const event of activeEvents(events)) {
    // One-off entries group by their snapshot name, not by a shared null key.
    const key = event.treatId ?? `snapshot:${event.treatNameSnapshot}:${event.brandSnapshot ?? ''}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.eventCount += 1;
      if (event.kcalTotalMilli === null) existing.unknownKcalEventCount += 1;
      else existing.knownKcalMilli += event.kcalTotalMilli;
      continue;
    }

    buckets.set(key, {
      treatId: event.treatId,
      name: event.treatNameSnapshot,
      brand: event.brandSnapshot,
      eventCount: 1,
      knownKcalMilli: event.kcalTotalMilli ?? 0,
      unknownKcalEventCount: event.kcalTotalMilli === null ? 1 : 0,
    });
  }

  return [...buckets.values()].sort(
    (a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name),
  );
}

export type CategorySlice = {
  category: TreatCategory;
  eventCount: number;
  /** Share of all events in the range, 0..1. */
  fraction: number;
};

export function categoryDistribution(events: readonly TreatEvent[]): CategorySlice[] {
  const active = activeEvents(events);
  const counts = new Map<TreatCategory, number>();

  for (const event of active) {
    counts.set(event.categorySnapshot, (counts.get(event.categorySnapshot) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, eventCount]) => ({
      category,
      eventCount,
      fraction: active.length === 0 ? 0 : eventCount / active.length,
    }))
    .sort((a, b) => b.eventCount - a.eventCount || a.category.localeCompare(b.category));
}

export type Completeness = {
  totalEvents: number;
  eventsWithKnownCalories: number;
  eventsWithUnknownCalories: number;
};

/**
 * Backs the "data completeness note" every insight card must show
 * (docs/ux-flows.md).
 */
export function dataCompleteness(events: readonly TreatEvent[]): Completeness {
  const active = activeEvents(events);
  const unknown = active.filter((event) => event.kcalTotalMilli === null).length;
  return {
    totalEvents: active.length,
    eventsWithKnownCalories: active.length - unknown,
    eventsWithUnknownCalories: unknown,
  };
}
