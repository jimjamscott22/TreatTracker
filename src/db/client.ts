import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrate';
import type { SqliteLike } from './types';

export const DATABASE_NAME = 'treat-tracker.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the database once per app run and brings the schema up to date.
 *
 * Foreign keys are enabled explicitly -- SQLite defaults them off, and the data
 * model relies on them.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db as unknown as SqliteLike);
    return db;
  })();

  return databasePromise;
}

/** Test seam: drops the memoized handle so the next call reopens. */
export function resetDatabaseHandle(): void {
  databasePromise = null;
}
