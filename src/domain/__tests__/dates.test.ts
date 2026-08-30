import {
  addDays,
  daysBetween,
  enumerateLocalDates,
  formatRangeLabel,
  localDateOf,
  previousRange,
  rangeEndingOn,
  utcOffsetMinutesOf,
} from '../dates';

describe('localDateOf', () => {
  it('uses the local calendar date, not the UTC date', () => {
    // 2026-08-21T05:00Z is still the 20th in Los Angeles.
    const instant = '2026-08-21T05:00:00.000Z';
    expect(localDateOf(instant, 'America/Los_Angeles')).toBe('2026-08-20');
    expect(localDateOf(instant, 'UTC')).toBe('2026-08-21');
  });
});

describe('utcOffsetMinutesOf', () => {
  it('reports the offset in effect at that instant', () => {
    expect(utcOffsetMinutesOf(new Date('2026-08-20T18:00:00Z'), 'America/Los_Angeles')).toBe(-420);
    expect(utcOffsetMinutesOf(new Date('2026-01-20T18:00:00Z'), 'America/Los_Angeles')).toBe(-480);
  });
});

describe('calendar arithmetic', () => {
  it('steps across a daylight-saving transition without losing a day', () => {
    // US DST starts 2026-03-08; the calendar day must still advance by one.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('enumerateLocalDates', () => {
  it('includes both ends', () => {
    expect(enumerateLocalDates('2026-08-18', '2026-08-20')).toEqual([
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
  });

  it('returns nothing when the range is inverted', () => {
    expect(enumerateLocalDates('2026-08-20', '2026-08-18')).toEqual([]);
  });
});

describe('ranges', () => {
  it('builds an inclusive range of the requested length', () => {
    const range = rangeEndingOn('2026-08-22', 7);
    expect(range.start).toBe('2026-08-16');
    expect(range.end).toBe('2026-08-22');
    expect(range.dates).toHaveLength(7);
  });

  it('places the previous range immediately before, with equal length', () => {
    const prior = previousRange(rangeEndingOn('2026-08-22', 7));
    expect(prior.start).toBe('2026-08-09');
    expect(prior.end).toBe('2026-08-15');
    expect(prior.dates).toHaveLength(7);
  });

  it('labels a range the way insight cards cite it', () => {
    expect(formatRangeLabel(rangeEndingOn('2026-08-22', 7))).toBe('Aug 16–22');
    expect(formatRangeLabel(rangeEndingOn('2026-01-03', 7))).toBe('Dec 28 – Jan 3');
  });
});
