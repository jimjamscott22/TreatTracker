import { currentSchemaVersion, runMigrations } from '../migrate';
import { LATEST_SCHEMA_VERSION, migrations, type Migration } from '../migrations';
import type { SqliteLike } from '../types';

/**
 * In-memory stand-in for expo-sqlite.
 *
 * The runner only needs `execAsync` and `getFirstAsync`, so a fake is enough to
 * assert version bookkeeping without a native module.
 */
function createFakeDb(options: { failOnVersion?: number } = {}): SqliteLike & {
  executed: string[];
  userVersion: number;
} {
  const db = {
    executed: [] as string[],
    userVersion: 0,

    async execAsync(source: string) {
      const pragma = /^PRAGMA user_version = (\d+);$/.exec(source.trim());
      if (pragma?.[1]) {
        db.userVersion = Number(pragma[1]);
        return;
      }

      if (
        options.failOnVersion !== undefined &&
        source.includes(`__fail_${options.failOnVersion}__`)
      ) {
        throw new Error('syntax error');
      }

      db.executed.push(source);
    },

    async runAsync() {
      return { changes: 0 };
    },

    async getFirstAsync<T>(source: string): Promise<T | null> {
      if (source.trim().startsWith('PRAGMA user_version')) {
        return { user_version: db.userVersion } as T;
      }
      return null;
    },

    async getAllAsync<T>(): Promise<T[]> {
      return [];
    },

    async withTransactionAsync(task: () => Promise<void>) {
      await task();
    },
  };

  return db;
}

describe('runMigrations', () => {
  it('brings a fresh database to the latest schema version', async () => {
    const db = createFakeDb();
    const version = await runMigrations(db);

    expect(version).toBe(LATEST_SCHEMA_VERSION);
    expect(db.executed).toHaveLength(migrations.length);
  });

  it('is idempotent -- a second run applies nothing', async () => {
    const db = createFakeDb();
    await runMigrations(db);
    const executedAfterFirst = db.executed.length;

    await runMigrations(db);

    expect(db.executed).toHaveLength(executedAfterFirst);
    expect(await currentSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('applies only migrations newer than the stored version', async () => {
    const list: Migration[] = [
      { version: 1, name: 'one', sql: 'SELECT 1;' },
      { version: 2, name: 'two', sql: 'SELECT 2;' },
    ];
    const db = createFakeDb();
    db.userVersion = 1;

    await runMigrations(db, list);

    expect(db.executed).toEqual(['SELECT 2;']);
    expect(db.userVersion).toBe(2);
  });

  it('applies migrations in version order regardless of list order', async () => {
    const list: Migration[] = [
      { version: 2, name: 'two', sql: 'SELECT 2;' },
      { version: 1, name: 'one', sql: 'SELECT 1;' },
    ];
    const db = createFakeDb();

    await runMigrations(db, list);

    expect(db.executed).toEqual(['SELECT 1;', 'SELECT 2;']);
  });

  it('leaves the version behind when a migration fails, so it retries next launch', async () => {
    const list: Migration[] = [
      { version: 1, name: 'one', sql: 'SELECT 1;' },
      { version: 2, name: 'two', sql: '__fail_2__' },
    ];
    const db = createFakeDb({ failOnVersion: 2 });

    await expect(runMigrations(db, list)).rejects.toThrow(/two \(version 2\) failed/);

    // Migration 1 committed; 2 did not, so the database stays at 1.
    expect(db.userVersion).toBe(1);
  });
});

describe('migration list', () => {
  it('has contiguous versions starting at 1, so none can be skipped', () => {
    const versions = migrations.map((m) => m.version);
    expect(versions).toEqual(versions.map((_, index) => index + 1));
  });

  it('has unique names', () => {
    expect(new Set(migrations.map((m) => m.name)).size).toBe(migrations.length);
  });
});
