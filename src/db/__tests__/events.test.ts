import { recordNewCatalogTreat } from '../repositories/events';
import type { SqliteLike, SqlValue } from '../types';

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
        const [
          id,
          name,
          brand,
          category,
          default_quantity_milli,
          unit,
          kcal_per_unit_milli,
          is_favorite,
          last_used_at,
          created_at,
          updated_at,
        ] = params;
        treats.set(id as string, {
          id,
          name,
          brand,
          category,
          default_quantity_milli,
          unit,
          kcal_per_unit_milli,
          is_favorite,
          last_used_at,
          created_at,
          updated_at,
          deleted_at: null,
        });
      } else if (source.includes('INSERT INTO treat_events')) {
        const [
          id,
          pet_id,
          treat_id,
          quantity_milli,
          occurred_at,
          local_date,
          timezone,
          utc_offset_minutes,
          note,
          treat_name_snapshot,
          brand_snapshot,
          category_snapshot,
          unit_snapshot,
          kcal_per_unit_milli_snapshot,
          kcal_total_milli,
          created_at,
          updated_at,
        ] = params;
        events.set(id as string, {
          id,
          pet_id,
          treat_id,
          quantity_milli,
          occurred_at,
          local_date,
          timezone,
          utc_offset_minutes,
          note,
          treat_name_snapshot,
          brand_snapshot,
          category_snapshot,
          unit_snapshot,
          kcal_per_unit_milli_snapshot,
          kcal_total_milli,
          created_at,
          updated_at,
          deleted_at: null,
        });
      }
      return { changes: 1 };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
      const id = params[0] as string;
      if (source.includes('FROM treats')) return (treats.get(id) as T) ?? null;
      if (source.includes('FROM treat_events')) return (events.get(id) as T) ?? null;
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
