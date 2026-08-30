import type { TreatCategory, TreatEvent } from '../entities';

let counter = 0;

/**
 * Builds a treat event with sane defaults so each test states only the fields
 * it actually cares about.
 */
export function makeEvent(overrides: Partial<TreatEvent> = {}): TreatEvent {
  counter += 1;
  const base: TreatEvent = {
    id: `event-${counter}`,
    petId: 'pet-1',
    treatId: 'treat-1',
    quantityMilli: 1000,
    occurredAt: '2026-08-20T15:00:00.000Z',
    localDate: '2026-08-20',
    timezone: 'America/Los_Angeles',
    utcOffsetMinutes: -420,
    note: null,
    treatNameSnapshot: 'Biscuit',
    brandSnapshot: null,
    categorySnapshot: 'biscuit' as TreatCategory,
    unitSnapshot: 'piece',
    kcalPerUnitMilliSnapshot: 12_000,
    kcalTotalMilli: 12_000,
    createdAt: '2026-08-20T15:00:00.000Z',
    updatedAt: '2026-08-20T15:00:00.000Z',
    deletedAt: null,
  };

  return { ...base, ...overrides };
}

/** An event whose calorie estimate was never entered. */
export function makeUnknownKcalEvent(overrides: Partial<TreatEvent> = {}): TreatEvent {
  return makeEvent({
    kcalPerUnitMilliSnapshot: null,
    kcalTotalMilli: null,
    ...overrides,
  });
}
