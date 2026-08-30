import { petDraftSchema, type Pet, type PetDraft } from '../../domain/entities';
import { newId } from '../../utils/ids';
import { fromBool, toPet, type PetRow } from '../mappers';
import type { SqliteLike } from '../types';

const SELECT = `
  SELECT id, name, species, photo_uri, birth_date, weight_grams,
         weight_unit_preference, is_active, created_at, updated_at, deleted_at
  FROM pets
`;

export async function listPets(db: SqliteLike): Promise<Pet[]> {
  const rows = await db.getAllAsync<PetRow>(
    `${SELECT} WHERE deleted_at IS NULL ORDER BY is_active DESC, name COLLATE NOCASE ASC`,
    [],
  );
  return rows.map(toPet);
}

export async function getPet(db: SqliteLike, id: string): Promise<Pet | null> {
  const row = await db.getFirstAsync<PetRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? toPet(row) : null;
}

export async function countPets(db: SqliteLike): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM pets WHERE deleted_at IS NULL',
    [],
  );
  return row?.count ?? 0;
}

/**
 * Creates a pet and returns the committed record.
 *
 * The draft is validated before the write opens, per docs/architecture.md.
 */
export async function createPet(db: SqliteLike, draft: PetDraft): Promise<Pet> {
  const input = petDraftSchema.parse(draft);
  const now = new Date().toISOString();
  const id = newId();

  await db.runAsync(
    `INSERT INTO pets (
       id, name, species, photo_uri, birth_date, weight_grams,
       weight_unit_preference, is_active, created_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
    [
      id,
      input.name,
      input.species,
      input.photoUri,
      input.birthDate,
      input.weightGrams,
      input.weightUnitPreference,
      now,
      now,
    ],
  );

  const created = await getPet(db, id);
  if (!created) throw new Error('Pet was not persisted');
  return created;
}

export async function updatePet(
  db: SqliteLike,
  id: string,
  draft: PetDraft,
): Promise<Pet> {
  const input = petDraftSchema.parse(draft);
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE pets
        SET name = ?, species = ?, photo_uri = ?, birth_date = ?,
            weight_grams = ?, weight_unit_preference = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [
      input.name,
      input.species,
      input.photoUri,
      input.birthDate,
      input.weightGrams,
      input.weightUnitPreference,
      now,
      id,
    ],
  );

  const updated = await getPet(db, id);
  if (!updated) throw new Error(`Pet ${id} not found`);
  return updated;
}

export async function setPetActive(
  db: SqliteLike,
  id: string,
  isActive: boolean,
): Promise<void> {
  await db.runAsync('UPDATE pets SET is_active = ?, updated_at = ? WHERE id = ?', [
    fromBool(isActive),
    new Date().toISOString(),
    id,
  ]);
}

/**
 * Soft-deletes a pet. Events are intentionally left in place so history and
 * exports keep their snapshots (docs/data-model.md).
 */
export async function softDeletePet(db: SqliteLike, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE pets SET deleted_at = ?, updated_at = ?, is_active = 0 WHERE id = ?',
    [now, now, id],
  );
}
