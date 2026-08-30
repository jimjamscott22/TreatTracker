import { eventKcalMilli, formatKcal, formatQuantity, fromMilli, toMilli } from '../units';

describe('milli conversions', () => {
  it('round-trips a fractional quantity without drift', () => {
    expect(fromMilli(toMilli(1.5))).toBe(1.5);
    expect(toMilli(0.001)).toBe(1);
  });
});

describe('eventKcalMilli', () => {
  it('scales the per-unit estimate by the quantity', () => {
    // 2 pieces at 12 kcal each.
    expect(eventKcalMilli(2000, 12_000)).toBe(24_000);
  });

  it('returns null when the per-unit estimate is unknown', () => {
    // Unknown must stay unknown -- never collapse to zero.
    expect(eventKcalMilli(2000, null)).toBeNull();
  });

  it('rounds to a whole milli-kcal', () => {
    expect(eventKcalMilli(1500, 1)).toBe(2);
  });
});

describe('formatting', () => {
  it('trims trailing zeros from quantities', () => {
    expect(formatQuantity(2000)).toBe('2');
    expect(formatQuantity(1500)).toBe('1.5');
  });

  it('renders unknown calories as "Not entered" rather than 0 kcal', () => {
    expect(formatKcal(null)).toBe('Not entered');
    expect(formatKcal(12_000)).toBe('12 kcal');
  });
});
