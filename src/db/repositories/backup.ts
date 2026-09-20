import { parseBackup, type FullBackup } from '../../domain/backup';
import type { SqliteLike, SqlValue } from '../types';

/** The native SQLite transaction exposes the same query methods as the database. */
type BackupTransaction = Pick<SqliteLike, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

export type BackupDatabase = BackupTransaction & {
  withExclusiveTransactionAsync(task: (transaction: BackupTransaction) => Promise<void>): Promise<void>;
};

const tables = [
  { key: 'pets', table: 'pets', columns: ['id', 'name', 'species', 'photo_uri', 'birth_date', 'weight_grams', 'weight_unit_preference', 'is_active', 'created_at', 'updated_at', 'deleted_at'] },
  { key: 'treats', table: 'treats', columns: ['id', 'name', 'brand', 'category', 'default_quantity_milli', 'unit', 'kcal_per_unit_milli', 'is_favorite', 'last_used_at', 'created_at', 'updated_at', 'deleted_at'] },
  { key: 'events', table: 'treat_events', columns: ['id', 'pet_id', 'treat_id', 'quantity_milli', 'occurred_at', 'local_date', 'timezone', 'utc_offset_minutes', 'note', 'treat_name_snapshot', 'brand_snapshot', 'category_snapshot', 'unit_snapshot', 'kcal_per_unit_milli_snapshot', 'kcal_total_milli', 'created_at', 'updated_at', 'deleted_at'] },
  { key: 'goals', table: 'daily_goals', columns: ['id', 'pet_id', 'metric', 'target_milli', 'effective_from', 'effective_to', 'created_at', 'updated_at', 'deleted_at'] },
  { key: 'reminders', table: 'reminders', columns: ['id', 'pet_id', 'label', 'local_time', 'days_mask', 'timezone_mode', 'enabled', 'platform_notification_id', 'created_at', 'updated_at', 'deleted_at'] },
  { key: 'metadata', table: 'app_metadata', columns: ['key', 'value'] },
] as const;

/** Reads one consistent snapshot, including archived rows and tombstones. */
export async function createFullBackup(db: BackupDatabase, appVersion: string): Promise<FullBackup> {
  let backup: FullBackup | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const pets = await transaction.getAllAsync<FullBackup['pets'][number]>('SELECT * FROM pets ORDER BY id', []);
    const treats = await transaction.getAllAsync<FullBackup['treats'][number]>('SELECT * FROM treats ORDER BY id', []);
    const events = await transaction.getAllAsync<FullBackup['events'][number]>('SELECT * FROM treat_events ORDER BY id', []);
    const goals = await transaction.getAllAsync<FullBackup['goals'][number]>('SELECT * FROM daily_goals ORDER BY id', []);
    const reminders = await transaction.getAllAsync<FullBackup['reminders'][number]>('SELECT * FROM reminders ORDER BY id', []);
    const metadata = await transaction.getAllAsync<FullBackup['metadata'][number]>('SELECT * FROM app_metadata ORDER BY key', []);
    backup = parseBackup({
      format: 'treat-tracker-backup',
      version: 1,
      scope: 'full',
      appVersion,
      exportedAt: new Date().toISOString(),
      pets,
      treats,
      events,
      goals,
      reminders,
      metadata,
    });
  });
  if (backup === null) throw new Error('The backup could not be created.');
  return backup;
}

/** Import is intentionally restore-only: a populated target is never merged or replaced. */
export async function restoreFullBackup(db: BackupDatabase, input: unknown): Promise<FullBackup> {
  const backup = parseBackup(input);

  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const { table } of tables) {
      const result = await transaction.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${table}`,
        [],
      );
      if ((result?.count ?? 0) !== 0) {
        throw new Error('Import requires a fresh app with no existing records.');
      }
    }

    for (const { key, table, columns } of tables) {
      for (const original of backup[key]) {
        // Notification IDs belong to the original iPhone and cannot schedule a
        // notification on the target. The reminder definition is preserved.
        const row = key === 'reminders'
          ? { ...original, platform_notification_id: null }
          : original;
        const record = row as unknown as Record<string, SqlValue>;
        const params = columns.map((column) => {
          const value = record[column];
          if (value === undefined) throw new Error(`Backup column ${column} is missing.`);
          return value;
        });
        const placeholders = columns.map(() => '?').join(', ');
        await transaction.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          params,
        );
      }
    }

    const violations = await transaction.getAllAsync<unknown>('PRAGMA foreign_key_check', []);
    if (violations.length > 0) throw new Error('The backup has invalid record references.');
  });

  return backup;
}
