import { summarizeRange } from '../totals';
import { categoryDistribution, compareRanges, dataCompleteness, rankTreats } from '../trends';
import { makeEvent, makeUnknownKcalEvent } from './fixtures';

describe('compareRanges', () => {
  it('reports an absolute change and a fraction', () => {
    const current = summarizeRange([makeEvent(), makeEvent(), makeEvent()], ['2026-08-20']);
    const prior = summarizeRange([makeEvent({ localDate: '2026-08-13' })], ['2026-08-13']);

    const comparison = compareRanges(current, prior);
    expect(comparison.eventCount.absolute).toBe(2);
    expect(comparison.eventCount.fraction).toBe(2);
  });

  it('returns a null fraction when the previous range was empty', () => {
    const current = summarizeRange([makeEvent()], ['2026-08-20']);
    const prior = summarizeRange([], ['2026-08-13']);

    // There is no meaningful percentage change from zero.
    expect(compareRanges(current, prior).eventCount.fraction).toBeNull();
    expect(compareRanges(current, prior).eventCount.absolute).toBe(1);
  });

  it('flags comparisons affected by unknown calorie values', () => {
    const current = summarizeRange([makeUnknownKcalEvent()], ['2026-08-20']);
    const prior = summarizeRange([], ['2026-08-13']);
    expect(compareRanges(current, prior).comparisonAffectedByUnknownCalories).toBe(true);
  });
});

describe('rankTreats', () => {
  it('ranks by frequency, breaking ties alphabetically', () => {
    const ranked = rankTreats([
      makeEvent({ treatId: 'a', treatNameSnapshot: 'Biscuit' }),
      makeEvent({ treatId: 'a', treatNameSnapshot: 'Biscuit' }),
      makeEvent({ treatId: 'b', treatNameSnapshot: 'Chew' }),
      makeEvent({ treatId: 'c', treatNameSnapshot: 'Apple' }),
    ]);

    expect(ranked.map((t) => t.name)).toEqual(['Biscuit', 'Apple', 'Chew']);
  });

  it('uses the event snapshot, so a renamed treat keeps its historical name', () => {
    // Both events point at the same catalog id but were recorded under
    // different names; the snapshot from the first event wins its bucket.
    const ranked = rankTreats([
      makeEvent({ treatId: 'a', treatNameSnapshot: 'Old name' }),
      makeEvent({ treatId: 'a', treatNameSnapshot: 'New name' }),
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.name).toBe('Old name');
  });

  it('keeps one-off entries separate rather than merging every null treat id', () => {
    const ranked = rankTreats([
      makeEvent({ treatId: null, treatNameSnapshot: 'Cheese' }),
      makeEvent({ treatId: null, treatNameSnapshot: 'Carrot' }),
    ]);

    expect(ranked).toHaveLength(2);
  });

  it('excludes soft-deleted events', () => {
    const ranked = rankTreats([
      makeEvent({ treatId: 'a' }),
      makeEvent({ treatId: 'a', deletedAt: '2026-08-20T16:00:00.000Z' }),
    ]);

    expect(ranked[0]?.eventCount).toBe(1);
  });

  it('counts unknown-calorie entries without inflating the calorie total', () => {
    const ranked = rankTreats([
      makeEvent({ treatId: 'a', kcalTotalMilli: 12_000 }),
      makeUnknownKcalEvent({ treatId: 'a' }),
    ]);

    expect(ranked[0]?.knownKcalMilli).toBe(12_000);
    expect(ranked[0]?.unknownKcalEventCount).toBe(1);
  });

  it('returns nothing for an empty range', () => {
    expect(rankTreats([])).toEqual([]);
  });
});

describe('categoryDistribution', () => {
  it('reports each category share of the range', () => {
    const slices = categoryDistribution([
      makeEvent({ categorySnapshot: 'biscuit' }),
      makeEvent({ categorySnapshot: 'biscuit' }),
      makeEvent({ categorySnapshot: 'chew' }),
    ]);

    expect(slices[0]).toMatchObject({ category: 'biscuit', eventCount: 2 });
    expect(slices[0]?.fraction).toBeCloseTo(2 / 3);
  });

  it('uses the category snapshot so recategorising does not rewrite history', () => {
    const slices = categoryDistribution([makeEvent({ categorySnapshot: 'training' })]);
    expect(slices[0]?.category).toBe('training');
  });
});

describe('dataCompleteness', () => {
  it('separates known from unknown calorie entries', () => {
    const completeness = dataCompleteness([
      makeEvent(),
      makeUnknownKcalEvent(),
      makeUnknownKcalEvent(),
    ]);

    expect(completeness).toEqual({
      totalEvents: 3,
      eventsWithKnownCalories: 1,
      eventsWithUnknownCalories: 2,
    });
  });
});
