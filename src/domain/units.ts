/**
 * Quantities and energy are persisted as integer thousandths ("milli") so that
 * repeated arithmetic never accumulates floating-point drift. Formatting to a
 * human-readable value happens only at the display boundary.
 *
 * See AGENTS.md ("Store energy as integer thousandths of a kilocalorie") and
 * docs/data-model.md.
 */

/** Thousandths of a unit. Always an integer. */
export type Milli = number;

export function toMilli(value: number): Milli {
  return Math.round(value * 1000);
}

export function fromMilli(value: Milli): number {
  return value / 1000;
}

/**
 * Energy for one event, in milli-kcal.
 *
 * Returns null when the per-unit estimate is unknown -- docs/data-model.md
 * requires unknown to stay NULL and never collapse to zero.
 */
export function eventKcalMilli(
  quantityMilli: Milli,
  kcalPerUnitMilliSnapshot: Milli | null,
): Milli | null {
  if (kcalPerUnitMilliSnapshot === null) return null;
  return Math.round((quantityMilli * kcalPerUnitMilliSnapshot) / 1000);
}

/** Formats a milli quantity for display, trimming trailing zeros ("1.5", "2"). */
export function formatQuantity(quantityMilli: Milli): string {
  const value = fromMilli(quantityMilli);
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/**
 * Formats milli-kcal for display. docs/ux-flows.md requires unknown values to
 * read as "Not entered" rather than "0 kcal".
 */
export function formatKcal(kcalMilli: Milli | null): string {
  if (kcalMilli === null) return 'Not entered';
  return `${Math.round(fromMilli(kcalMilli))} kcal`;
}
