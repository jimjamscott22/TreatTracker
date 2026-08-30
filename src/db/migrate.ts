import { migrations, type Migration } from './migrations';
import type { SqliteLike } from './types';

/**
 * Applies pending migrations in order.
 *
 * Schema version is tracked with SQLite's own `user_version` (docs/data-model.md).
 * `user_version` advances only after a migration's statements succeed, so an
 * interrupted run re-applies the same migration rather than skipping it. The
 * runner is therefore idempotent at the migration level.
 */
export async function runMigrations(
  db: SqliteLike,
  list: readonly Migration[] = migrations,
): Promise<number> {
  const ordered = [...list].sort((a, b) => a.version - b.version);
  const current = await currentSchemaVersion(db);

  for (const migration of ordered) {
    if (migration.version <= current) continue;

    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(`Migration ${migration.name} has an invalid version`);
    }

    try {
      await db.execAsync(migration.sql);
      // PRAGMA does not accept bound parameters; the value is a validated integer.
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    } catch (cause) {
      // A failed migration must stop writes and surface a recoverable error
      // rather than leaving the app running against a half-built schema.
      throw new Error(
        `Migration ${migration.name} (version ${migration.version}) failed`,
        { cause },
      );
    }
  }

  return currentSchemaVersion(db);
}

export async function currentSchemaVersion(db: SqliteLike): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;', []);
  return row?.user_version ?? 0;
}
