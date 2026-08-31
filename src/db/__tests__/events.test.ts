import { recordNewCatalogTreat } from '../repositories/events';
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

/**
 * In-memory stand-in for expo-sqlite, scoped to what
 * `recordNewCatalogTreat` issues: two INSERTs and two id-keyed SELECTs.
 */
function createFakeDb(): SqliteLike {
  const treats = new Map<string, Record<string, SqlValue>>();
  const events = new Map<string, Record<string, SqlValue>>();

  return {
    async execAsync() {},
    async getAllAsync() {
      return [];
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
          last_used_at: param(params, 8),
          created_at: param(params, 9),
          updated_at: param(params, 10),
          deleted_at: null,
        });
      } else if (source.includes('INSERT INTO treat_events')) {
        const id = String(param(params, 0));
        events.set(id, {
          id,
          pet_id: param(params, 1),
          treat_id: param(params, 2),
          quantity_milli: param(params, 3),
          occurred_at: param(params, 4),
          local_date: param(params, 5),
          timezone: param(params, 6),
          utc_offset_minutes: param(params, 7),
          note: param(params, 8),
          treat_name_snapshot: param(params, 9),
          brand_snapshot: param(params, 10),
          category_snapshot: param(params, 11),
          unit_snapshot: param(params, 12),
          kcal_per_unit_milli_snapshot: param(params, 13),
          kcal_total_milli: param(params, 14),
          created_at: param(params, 15),
          updated_at: param(params, 16),
          deleted_at: null,
        });
      }
      return { changes: 1 };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
      const id = String(param(params, 0));
      if (source.includes('FROM treat_events')) return (events.get(id) as T) ?? null;
      if (source.includes('FROM treats')) return (treats.get(id) as T) ?? null;
      return null;
    },
  };
}

describe('recordNewCatalogTreat', () => {
  it('creates a catalog treat and an event for it in one call', async () => {
    const db = createFakeDb();

    const { treat, event } = await recordNewCatalogTreat(db, {
      petId: 'pet-1',
      treatDraft: {
        name: 'Duck strips',
        brand: null,
        category: 'training',
        defaultQuantityMilli: 1000,
        unit: 'piece',
        kcalPerUnitMilli: 20000,
        isFavorite: true,
      },
    });

    expect(treat.name).toBe('Duck strips');
    expect(treat.isFavorite).toBe(true);
    expect(event.treatId).toBe(treat.id);
    expect(event.petId).toBe('pet-1');
    expect(event.quantityMilli).toBe(1000);
    expect(event.kcalTotalMilli).toBe(20000);
    expect(event.treatNameSnapshot).toBe('Duck strips');
  });

  it('defaults the event quantity to the treat draft default quantity, and leaves calories null when not entered', async () => {
    const db = createFakeDb();

    const { event } = await recordNewCatalogTreat(db, {
      petId: 'pet-1',
      treatDraft: {
        name: 'Biscuit',
        brand: null,
        category: 'biscuit',
        defaultQuantityMilli: 2000,
        unit: 'piece',
        kcalPerUnitMilli: null,
        isFavorite: false,
      },
    });

    expect(event.quantityMilli).toBe(2000);
    expect(event.kcalPerUnitMilliSnapshot).toBeNull();
    expect(event.kcalTotalMilli).toBeNull();
  });
});
