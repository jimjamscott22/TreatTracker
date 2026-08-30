import { deviceTimeZone, localDateOf, utcOffsetMinutesOf } from '../../domain/dates';
import {
  treatEventDraftSchema,
  type LocalDate,
  type Treat,
  type TreatEvent,
  type TreatEventDraft,
} from '../../domain/entities';
import { eventKcalMilli } from '../../domain/units';
import { newId } from '../../utils/ids';
import { toTreatEvent, type TreatEventRow } from '../mappers';
import type { SqliteLike } from '../types';

const SELECT = `
  SELECT id, pet_id, treat_id, quantity_milli, occurred_at, local_date, timezone,
         utc_offset_minutes, note, treat_name_snapshot, brand_snapshot,
         category_snapshot, unit_snapshot, kcal_per_unit_milli_snapshot,
         kcal_total_milli, created_at, updated_at, deleted_at
  FROM treat_events
`;

export async function getEvent(
  db: SqliteLike,
  id: string,
): Promise<TreatEvent | null> {
  const row = await db.getFirstAsync<TreatEventRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? toTreatEvent(row) : null;
}

/** Events for one pet on one local calendar day, oldest first. */
export async function listEventsForDate(
  db: SqliteLike,
  petId: string,
  localDate: LocalDate,
): Promise<TreatEvent[]> {
  const rows = await db.getAllAsync<TreatEventRow>(
    `${SELECT}
      WHERE pet_id = ? AND local_date = ? AND deleted_at IS NULL
      ORDER BY occurred_at ASC`,
    [petId, localDate],
  );
  return rows.map(toTreatEvent);
}

/**
 * Events for one pet across an inclusive local-date range.
 *
 * Queries are scoped to the pet and dates a screen actually shows, per the read
 * guidance in docs/architecture.md.
 */
export async function listEventsInRange(
  db: SqliteLike,
  petId: string,
  start: LocalDate,
  end: LocalDate,
): Promise<TreatEvent[]> {
  const rows = await db.getAllAsync<TreatEventRow>(
    `${SELECT}
      WHERE pet_id = ? AND local_date BETWEEN ? AND ? AND deleted_at IS NULL
      ORDER BY local_date ASC, occurred_at ASC`,
    [petId, start, end],
  );
  return rows.map(toTreatEvent);
}

/**
 * Builds an event draft from a catalog treat, copying every display and
 * nutrition value onto the event as a snapshot.
 *
 * Taking the snapshot here -- rather than joining the catalog at read time -- is
 * what keeps history stable when a treat is later renamed or archived.
 */
export function draftFromTreat(params: {
  petId: string;
  treat: Treat;
  quantityMilli?: number;
  occurredAt?: Date;
  note?: string | null;
}): TreatEventDraft {
  const occurredAt = params.occurredAt ?? new Date();
  const timezone = deviceTimeZone();

  return {
    petId: params.petId,
    treatId: params.treat.id,
    quantityMilli: params.quantityMilli ?? params.treat.defaultQuantityMilli,
    occurredAt: occurredAt.toISOString(),
    localDate: localDateOf(occurredAt, timezone ?? undefined),
    timezone,
    utcOffsetMinutes: utcOffsetMinutesOf(occurredAt, timezone ?? undefined),
    note: params.note ?? null,
    treatNameSnapshot: params.treat.name,
    brandSnapshot: params.treat.brand,
    categorySnapshot: params.treat.category,
    unitSnapshot: params.treat.unit,
    kcalPerUnitMilliSnapshot: params.treat.kcalPerUnitMilli,
  };
}

/**
 * Commits one event and, when it came from the catalog, stamps that treat's
 * `last_used_at` in the same transaction so quick-add ordering stays consistent
 * with what was actually recorded.
 */
export async function recordEvent(
  db: SqliteLike,
  draft: TreatEventDraft,
): Promise<TreatEvent> {
  const input = treatEventDraftSchema.parse(draft);
  const now = new Date().toISOString();
  const id = newId();
  const kcalTotalMilli = eventKcalMilli(
    input.quantityMilli,
    input.kcalPerUnitMilliSnapshot,
  );

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO treat_events (
         id, pet_id, treat_id, quantity_milli, occurred_at, local_date, timezone,
         utc_offset_minutes, note, treat_name_snapshot, brand_snapshot,
         category_snapshot, unit_snapshot, kcal_per_unit_milli_snapshot,
         kcal_total_milli, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.petId,
        input.treatId,
        input.quantityMilli,
        input.occurredAt,
        input.localDate,
        input.timezone,
        input.utcOffsetMinutes,
        input.note,
        input.treatNameSnapshot,
        input.brandSnapshot,
        input.categorySnapshot,
        input.unitSnapshot,
        input.kcalPerUnitMilliSnapshot,
        kcalTotalMilli,
        now,
        now,
      ],
    );

    if (input.treatId) {
      await db.runAsync(
        'UPDATE treats SET last_used_at = ?, updated_at = ? WHERE id = ?',
        [input.occurredAt, now, input.treatId],
      );
    }
  });

  const created = await getEvent(db, id);
  if (!created) throw new Error('Event was not persisted');
  return created;
}

/**
 * Edits an existing event.
 *
 * The calorie total is recomputed from the event's own existing snapshot, not
 * from the current catalog -- docs/ux-flows.md only allows a new per-unit value
 * when the user explicitly picks a different treat or value.
 */
export async function updateEvent(
  db: SqliteLike,
  id: string,
  changes: {
    quantityMilli?: number;
    occurredAt?: Date;
    note?: string | null;
    kcalPerUnitMilliSnapshot?: number | null;
  },
): Promise<TreatEvent> {
  const existing = await getEvent(db, id);
  if (!existing || existing.deletedAt !== null) {
    throw new Error(`Event ${id} not found`);
  }

  const quantityMilli = changes.quantityMilli ?? existing.quantityMilli;
  if (quantityMilli <= 0) throw new Error('Quantity must be more than zero');

  const kcalPerUnit =
    changes.kcalPerUnitMilliSnapshot !== undefined
      ? changes.kcalPerUnitMilliSnapshot
      : existing.kcalPerUnitMilliSnapshot;

  // Re-deriving local date and zone from the edited instant keeps the event on
  // the day the user meant after a time change (docs/architecture.md).
  const occurredAtDate = changes.occurredAt ?? new Date(existing.occurredAt);
  const timezone = changes.occurredAt ? deviceTimeZone() : existing.timezone;
  const localDate = changes.occurredAt
    ? localDateOf(occurredAtDate, timezone ?? undefined)
    : existing.localDate;
  const utcOffsetMinutes = changes.occurredAt
    ? utcOffsetMinutesOf(occurredAtDate, timezone ?? undefined)
    : existing.utcOffsetMinutes;

  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE treat_events
        SET quantity_milli = ?, occurred_at = ?, local_date = ?, timezone = ?,
            utc_offset_minutes = ?, note = ?, kcal_per_unit_milli_snapshot = ?,
            kcal_total_milli = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [
      quantityMilli,
      occurredAtDate.toISOString(),
      localDate,
      timezone,
      utcOffsetMinutes,
      changes.note !== undefined ? changes.note : existing.note,
      kcalPerUnit,
      eventKcalMilli(quantityMilli, kcalPerUnit),
      now,
      id,
    ],
  );

  const updated = await getEvent(db, id);
  if (!updated) throw new Error(`Event ${id} not found after update`);
  return updated;
}

/** Soft-deletes an event so an Undo affordance can still restore it. */
export async function softDeleteEvent(db: SqliteLike, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE treat_events SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    [now, now, id],
  );
}

/** Restores a soft-deleted event, backing the Undo affordance. */
export async function restoreEvent(db: SqliteLike, id: string): Promise<void> {
  await db.runAsync(
    'UPDATE treat_events SET deleted_at = NULL, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), id],
  );
}
