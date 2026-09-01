import { treatDraftSchema, type Treat, type TreatDraft } from '../../domain/entities';
import { newId } from '../../utils/ids';
import { fromBool, toTreat, type TreatRow } from '../mappers';
import type { SqliteLike } from '../types';

const SELECT = `
  SELECT id, name, brand, category, default_quantity_milli, unit,
         kcal_per_unit_milli, is_favorite, last_used_at,
         created_at, updated_at, deleted_at
  FROM treats
`;

export async function getTreat(db: SqliteLike, id: string): Promise<Treat | null> {
  const row = await db.getFirstAsync<TreatRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? toTreat(row) : null;
}

/**
 * Favorites first, then most recently used -- the ordering the Today screen's
 * quick-add area needs (docs/ux-flows.md).
 */
export async function listQuickAddTreats(
  db: SqliteLike,
  limit = 8,
): Promise<Treat[]> {
  const rows = await db.getAllAsync<TreatRow>(
    `${SELECT}
      WHERE deleted_at IS NULL
      ORDER BY is_favorite DESC, last_used_at DESC NULLS LAST, name COLLATE NOCASE ASC
      LIMIT ?`,
    [limit],
  );
  return rows.map(toTreat);
}

export async function searchTreats(
  db: SqliteLike,
  query: string,
  limit = 50,
): Promise<Treat[]> {
  const term = `%${query.trim()}%`;
  const rows = await db.getAllAsync<TreatRow>(
    `${SELECT}
      WHERE deleted_at IS NULL AND (name LIKE ? OR brand LIKE ?)
      ORDER BY is_favorite DESC, name COLLATE NOCASE ASC
      LIMIT ?`,
    [term, term, limit],
  );
  return rows.map(toTreat);
}

/**
 * Full catalog listing for the Treat Catalog management screen
 * (docs/product-spec.md: "Create, edit, archive, favorite, and search treats").
 *
 * Unlike `listQuickAddTreats`, this is not limited to a small quick-add set and
 * can include archived treats so a caregiver can find and restore one.
 */
export async function listCatalogTreats(
  db: SqliteLike,
  options: { query?: string; includeArchived?: boolean } = {},
): Promise<Treat[]> {
  const term = `%${(options.query ?? '').trim()}%`;
  const archivedClause = options.includeArchived ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
  const rows = await db.getAllAsync<TreatRow>(
    `${SELECT}
      WHERE ${archivedClause} AND (name LIKE ? OR brand LIKE ?)
      ORDER BY is_favorite DESC, name COLLATE NOCASE ASC`,
    [term, term],
  );
  return rows.map(toTreat);
}

export async function createTreat(
  db: SqliteLike,
  draft: TreatDraft,
): Promise<Treat> {
  const input = treatDraftSchema.parse(draft);
  const now = new Date().toISOString();
  const id = newId();

  await db.runAsync(
    `INSERT INTO treats (
       id, name, brand, category, default_quantity_milli, unit,
       kcal_per_unit_milli, is_favorite, last_used_at,
       created_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    [
      id,
      input.name,
      input.brand,
      input.category,
      input.defaultQuantityMilli,
      input.unit,
      input.kcalPerUnitMilli,
      fromBool(input.isFavorite),
      now,
      now,
    ],
  );

  const created = await getTreat(db, id);
  if (!created) throw new Error('Treat was not persisted');
  return created;
}

/**
 * Updates a catalog treat. Existing events keep their snapshots untouched --
 * this is the invariant behind "editing a treat must not rewrite old entries".
 */
export async function updateTreat(
  db: SqliteLike,
  id: string,
  draft: TreatDraft,
): Promise<Treat> {
  const input = treatDraftSchema.parse(draft);
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE treats
        SET name = ?, brand = ?, category = ?, default_quantity_milli = ?,
            unit = ?, kcal_per_unit_milli = ?, is_favorite = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [
      input.name,
      input.brand,
      input.category,
      input.defaultQuantityMilli,
      input.unit,
      input.kcalPerUnitMilli,
      fromBool(input.isFavorite),
      now,
      id,
    ],
  );

  const updated = await getTreat(db, id);
  if (!updated) throw new Error(`Treat ${id} not found`);
  return updated;
}

export async function setTreatFavorite(
  db: SqliteLike,
  id: string,
  isFavorite: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE treats SET is_favorite = ?, updated_at = ? WHERE id = ?',
    [fromBool(isFavorite), new Date().toISOString(), id],
  );
}

/** Archives a catalog treat; history that references it stays readable. */
export async function archiveTreat(db: SqliteLike, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync('UPDATE treats SET deleted_at = ?, updated_at = ? WHERE id = ?', [
    now,
    now,
    id,
  ]);
}

/**
 * Restores an archived catalog treat so it can be quick-added and searched
 * again. Past events keep the snapshots they already recorded either way.
 */
export async function restoreTreat(db: SqliteLike, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync('UPDATE treats SET deleted_at = NULL, updated_at = ? WHERE id = ?', [
    now,
    id,
  ]);
}
