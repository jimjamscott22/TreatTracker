import {
  archiveTreat,
  createTreat,
  getTreat,
  listCatalogTreats,
  restoreTreat,
  setTreatFavorite,
  updateTreat,
} from '../repositories/treats';
import type { SqliteLike, SqlValue } from '../types';

jest.mock('../../utils/ids', () => {
  let sequence = 0;
  return {
    newId: () => {
      sequence += 1;
      return `id-${sequence}`;
    },
  };
});

function param(params: SqlValue[], index: number): SqlValue {
  const value = params[index];
  if (value === undefined) {
    throw new Error(`Missing SQL parameter at index ${index}`);
  }
  return value;
}

type TreatRecord = Record<string, SqlValue>;

/**
 * In-memory stand-in for expo-sqlite, scoped to the statements the treats
 * repository issues. Filtering/ordering is applied in JS against the parsed
 * statement shape rather than a real SQL engine, mirroring the fake used in
 * `events.test.ts`.
 */
function createFakeDb(): SqliteLike {
  const treats = new Map<string, TreatRecord>();

  return {
    async execAsync() {},

    async getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]> {
      if (!source.includes('FROM treats')) return [];

      const archived = source.includes('deleted_at IS NOT NULL');
      const term = String(param(params, 0)).replace(/%/g, '').toLowerCase();

      const matches = [...treats.values()].filter((row) => {
        const isArchived = row.deleted_at !== null;
        if (isArchived !== archived) return false;
        if (term.length === 0) return true;
        const name = String(row.name).toLowerCase();
        const brand = row.brand ? String(row.brand).toLowerCase() : '';
        return name.includes(term) || brand.includes(term);
      });

      matches.sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return Number(b.is_favorite) - Number(a.is_favorite);
        return String(a.name).localeCompare(String(b.name));
      });

      return matches as T[];
    },

    async withTransactionAsync(task: () => Promise<void>) {
      await task();
    },

    async runAsync(source: string, params: SqlValue[]) {
      if (source.includes('INSERT INTO treats')) {
        const id = String(param(params, 0));
        treats.set(id, {
          id,
          name: param(params, 1),
          brand: param(params, 2),
          category: param(params, 3),
          default_quantity_milli: param(params, 4),
          unit: param(params, 5),
          kcal_per_unit_milli: param(params, 6),
          is_favorite: param(params, 7),
          last_used_at: null,
          created_at: param(params, 8),
          updated_at: param(params, 9),
          deleted_at: null,
        });
      } else if (source.includes('SET name = ?')) {
        const id = String(param(params, 8));
        const existing = treats.get(id);
        if (existing) {
          treats.set(id, {
            ...existing,
            name: param(params, 0),
            brand: param(params, 1),
            category: param(params, 2),
            default_quantity_milli: param(params, 3),
            unit: param(params, 4),
            kcal_per_unit_milli: param(params, 5),
            is_favorite: param(params, 6),
            updated_at: param(params, 7),
          });
        }
      } else if (source.includes('SET is_favorite')) {
        const id = String(param(params, 2));
        const existing = treats.get(id);
        if (existing) {
          treats.set(id, {
            ...existing,
            is_favorite: param(params, 0),
            updated_at: param(params, 1),
          });
        }
      } else if (source.includes('SET deleted_at = ?, updated_at = ?')) {
        const id = String(param(params, 2));
        const existing = treats.get(id);
        if (existing) {
          treats.set(id, { ...existing, deleted_at: param(params, 0), updated_at: param(params, 1) });
        }
      } else if (source.includes('SET deleted_at = NULL')) {
        const id = String(param(params, 1));
        const existing = treats.get(id);
        if (existing) {
          treats.set(id, { ...existing, deleted_at: null, updated_at: param(params, 0) });
        }
      }
      return { changes: 1 };
    },

    async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
      if (source.includes('FROM treats')) {
        const id = String(param(params, 0));
        return (treats.get(id) as T) ?? null;
      }
      return null;
    },
  };
}

const baseDraft = {
  name: 'Duck strips',
  brand: null,
  category: 'training' as const,
  defaultQuantityMilli: 1000,
  unit: 'piece',
  kcalPerUnitMilli: 20000,
  isFavorite: false,
};

describe('treats repository', () => {
  it('creates a treat and reads it back', async () => {
    const db = createFakeDb();
    const created = await createTreat(db, baseDraft);

    expect(created.name).toBe('Duck strips');
    expect(created.deletedAt).toBeNull();

    const fetched = await getTreat(db, created.id);
    expect(fetched).toEqual(created);
  });

  it('updates a treat without changing its id or archived state', async () => {
    const db = createFakeDb();
    const created = await createTreat(db, baseDraft);

    const updated = await updateTreat(db, created.id, {
      ...baseDraft,
      name: 'Duck strips (large)',
      kcalPerUnitMilli: 25000,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Duck strips (large)');
    expect(updated.kcalPerUnitMilli).toBe(25000);
    expect(updated.deletedAt).toBeNull();
  });

  it('toggles favorite independently of other fields', async () => {
    const db = createFakeDb();
    const created = await createTreat(db, baseDraft);
    expect(created.isFavorite).toBe(false);

    await setTreatFavorite(db, created.id, true);

    const fetched = await getTreat(db, created.id);
    expect(fetched?.isFavorite).toBe(true);
    expect(fetched?.name).toBe('Duck strips');
  });

  it('excludes archived treats from the default catalog listing, and includes them when requested', async () => {
    const db = createFakeDb();
    const active = await createTreat(db, baseDraft);
    const archived = await createTreat(db, { ...baseDraft, name: 'Old biscuit' });
    await archiveTreat(db, archived.id);

    const activeList = await listCatalogTreats(db);
    expect(activeList.map((t) => t.id)).toEqual([active.id]);

    const archivedList = await listCatalogTreats(db, { includeArchived: true });
    expect(archivedList.map((t) => t.id)).toEqual([archived.id]);
  });

  it('filters the catalog listing by name', async () => {
    const db = createFakeDb();
    await createTreat(db, baseDraft);
    await createTreat(db, { ...baseDraft, name: 'Salmon jerky' });

    const results = await listCatalogTreats(db, { query: 'duck' });
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Duck strips');
  });

  it('restores an archived treat so it reappears in the active catalog', async () => {
    const db = createFakeDb();
    const treat = await createTreat(db, baseDraft);
    await archiveTreat(db, treat.id);

    expect((await getTreat(db, treat.id))?.deletedAt).not.toBeNull();

    await restoreTreat(db, treat.id);

    const restored = await getTreat(db, treat.id);
    expect(restored?.deletedAt).toBeNull();

    const activeList = await listCatalogTreats(db);
    expect(activeList.map((t) => t.id)).toContain(treat.id);
  });

  it('never mutates a treat id across create, update, favorite, archive, and restore', async () => {
    const db = createFakeDb();
    const created = await createTreat(db, baseDraft);
    const updated = await updateTreat(db, created.id, { ...baseDraft, name: 'Renamed' });
    await setTreatFavorite(db, created.id, true);
    await archiveTreat(db, created.id);
    await restoreTreat(db, created.id);

    expect(updated.id).toBe(created.id);
    expect((await getTreat(db, created.id))?.id).toBe(created.id);
  });
});
