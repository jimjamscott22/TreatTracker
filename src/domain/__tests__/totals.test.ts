import type { DailyGoal } from '../entities';
import { budgetProgress, goalInEffect, summarizeDay, summarizeRange } from '../totals';
import { makeEvent, makeUnknownKcalEvent } from './fixtures';

describe('summarizeDay', () => {
  it('counts events and sums only known calories', () => {
    const summary = summarizeDay(
      [
        makeEvent({ localDate: '2026-08-20', kcalTotalMilli: 12_000 }),
        makeEvent({ localDate: '2026-08-20', kcalTotalMilli: 8_000 }),
        makeUnknownKcalEvent({ localDate: '2026-08-20' }),
      ],
      '2026-08-20',
    );

    expect(summary.eventCount).toBe(3);
    expect(summary.knownKcalMilli).toBe(20_000);
    // The unknown entry is disclosed separately, never counted as zero calories.
    expect(summary.unknownKcalEventCount).toBe(1);
  });

  it('ignores events from other days', () => {
    const summary = summarizeDay(
      [makeEvent({ localDate: '2026-08-19' }), makeEvent({ localDate: '2026-08-20' })],
      '2026-08-20',
    );
    expect(summary.eventCount).toBe(1);
  });

  it('excludes soft-deleted events', () => {
    const summary = summarizeDay(
      [
        makeEvent({ localDate: '2026-08-20' }),
        makeEvent({ localDate: '2026-08-20', deletedAt: '2026-08-20T16:00:00.000Z' }),
      ],
      '2026-08-20',
    );
    expect(summary.eventCount).toBe(1);
  });
});

describe('summarizeRange', () => {
  it('includes zero-event days in the average', () => {
    const dates = ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'];
    const summary = summarizeRange(
      [makeEvent({ localDate: '2026-08-20' }), makeEvent({ localDate: '2026-08-20' })],
      dates,
    );

    expect(summary.eventCount).toBe(2);
    expect(summary.days).toHaveLength(4);
    // 2 events over 4 calendar days, not over the 1 day that had entries.
    expect(summary.averageEventsPerDay).toBe(0.5);
  });

  it('handles an empty range without dividing by zero', () => {
    const summary = summarizeRange([], []);
    expect(summary.eventCount).toBe(0);
    expect(summary.averageEventsPerDay).toBe(0);
  });

  it('ignores events outside the requested dates', () => {
    const summary = summarizeRange(
      [makeEvent({ localDate: '2026-07-01' }), makeEvent({ localDate: '2026-08-20' })],
      ['2026-08-20'],
    );
    expect(summary.eventCount).toBe(1);
  });
});

describe('goalInEffect', () => {
  const goal = (overrides: Partial<DailyGoal>): DailyGoal => ({
    id: 'goal-1',
    petId: 'pet-1',
    metric: 'event_count',
    targetMilli: 5000,
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  });

  it('returns the budget that applied historically', () => {
    const goals = [
      goal({ id: 'old', targetMilli: 3000, effectiveFrom: '2026-07-01', effectiveTo: '2026-08-01' }),
      goal({ id: 'current', targetMilli: 5000, effectiveFrom: '2026-08-01' }),
    ];

    expect(goalInEffect(goals, '2026-07-15')?.id).toBe('old');
    expect(goalInEffect(goals, '2026-08-15')?.id).toBe('current');
  });

  it('treats the end date as exclusive', () => {
    const goals = [goal({ effectiveFrom: '2026-07-01', effectiveTo: '2026-08-01' })];
    expect(goalInEffect(goals, '2026-08-01')).toBeNull();
  });

  it('ignores soft-deleted goals', () => {
    const goals = [goal({ deletedAt: '2026-08-02T00:00:00.000Z' })];
    expect(goalInEffect(goals, '2026-08-15')).toBeNull();
  });
});

describe('budgetProgress', () => {
  const day = { localDate: '2026-08-20', eventCount: 6, knownKcalMilli: 40_000, unknownKcalEventCount: 1 };

  it('is null when no budget is set, since budgets are optional', () => {
    expect(budgetProgress(day, null)).toBeNull();
  });

  it('reports being over budget as a plain number, not an error state', () => {
    const progress = budgetProgress(day, {
      id: 'g', petId: 'pet-1', metric: 'event_count', targetMilli: 5000,
      effectiveFrom: '2026-08-01', effectiveTo: null,
      createdAt: '', updatedAt: '', deletedAt: null,
    });

    expect(progress?.fraction).toBeCloseTo(1.2);
    expect(progress?.overBy).toBe(1000);
  });

  it('flags a calorie budget as partial when some entries lack estimates', () => {
    const progress = budgetProgress(day, {
      id: 'g', petId: 'pet-1', metric: 'known_kcal', targetMilli: 50_000,
      effectiveFrom: '2026-08-01', effectiveTo: null,
      createdAt: '', updatedAt: '', deletedAt: null,
    });

    expect(progress?.hasUnknownCalories).toBe(true);
  });
});
