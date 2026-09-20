import { DatabaseSync } from 'node:sqlite';

import { parseBackupText } from '../../domain/backup';
import { createFullBackup, restoreFullBackup, type BackupDatabase } from '../repositories/backup';
import { migration001Initial } from '../migrations/001-initial';
import type { SqlValue } from '../types';

const PET_ID = 'cb161bb5-23f6-4e2b-923e-098e21f0992a';
const TREAT_ID = '987895a8-a8ec-448e-96d5-f6f0c3166827';
const EVENT_ID = '02b52788-f66e-4175-9830-4cf58d45370a';
const GOAL_ID = '51d932d8-8f7d-4b06-92c7-f891bdf85e4c';
const REMINDER_ID = '7b9a82c5-c47b-4e14-b729-b4dfe46df6fb';
const NOW = '2026-09-19T12:00:00.000Z';

function createDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migration001Initial);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  let failOnTable: string | null = null;

  const bind = (params: SqlValue[]) => params.map((value) => typeof value === 'boolean' ? Number(value) : value);
  const db: BackupDatabase = {
    async getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]> {
      return sqlite.prepare(source).all(...bind(params)) as T[];
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
      return (sqlite.prepare(source).get(...bind(params)) as T | undefined) ?? null;
    },
    async runAsync(source: string, params: SqlValue[]) {
      if (failOnTable && source.startsWith(`INSERT INTO ${failOnTable} `)) {
        throw new Error('injected write failure');
      }
      return { changes: Number(sqlite.prepare(source).run(...bind(params)).changes) };
    },
    async withExclusiveTransactionAsync(task) {
      sqlite.exec('BEGIN IMMEDIATE;');
      try {
        await task(db);
        sqlite.exec('COMMIT;');
      } catch (error) {
        sqlite.exec('ROLLBACK;');
        throw error;
      }
    },
  };

  return { db, sqlite, failOn: (table: string) => { failOnTable = table; } };
}

function seed(sqlite: DatabaseSync) {
  sqlite.prepare('INSERT INTO pets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    PET_ID, 'Miso', 'cat', null, null, null, 'kg', 1, NOW, NOW, null,
  );
  sqlite.prepare('INSERT INTO treats VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    TREAT_ID, 'Duck strips', 'Acme', 'training', 1000, 'piece', 2000, 1, NOW, NOW, NOW, NOW,
  );
  sqlite.prepare('INSERT INTO treat_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    EVENT_ID, PET_ID, TREAT_ID, 1500, NOW, '2026-09-19', 'America/New_York', -240,
    'after a walk', 'Old duck strips', 'Old brand', 'training', 'piece', 2000, 3000, NOW, NOW, null,
  );
  sqlite.prepare('INSERT INTO daily_goals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    GOAL_ID, PET_ID, 'event_count', 5000, '2026-09-01', null, NOW, NOW, null,
  );
  sqlite.prepare('INSERT INTO reminders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    REMINDER_ID, PET_ID, 'Review treats', '19:00', 127, 'device_local', 1,
    'source-phone-notification', NOW, NOW, null,
  );
  sqlite.prepare('INSERT INTO app_metadata VALUES (?, ?)').run('display_preference', 'compact');
}

describe('full backup transfer', () => {
  it('round trips all records and preserves event snapshots and tombstones', async () => {
    const source = createDatabase();
    const target = createDatabase();
    seed(source.sqlite);

    const backup = await createFullBackup(source.db, '0.1.0');
    expect(backup.events[0]?.treat_name_snapshot).toBe('Old duck strips');
    expect(backup.treats[0]?.deleted_at).toBe(NOW);

    await restoreFullBackup(target.db, backup);
    const restored = await createFullBackup(target.db, '0.1.0');
    expect(restored.pets).toEqual(backup.pets);
    expect(restored.treats).toEqual(backup.treats);
    expect(restored.events).toEqual(backup.events);
    expect(restored.goals).toEqual(backup.goals);
    expect(restored.metadata).toEqual(backup.metadata);
    expect(restored.reminders[0]).toEqual({ ...backup.reminders[0], platform_notification_id: null });
  });

  it('rejects invalid JSON, incompatible versions, duplicate IDs, bad references, and altered totals', async () => {
    const source = createDatabase();
    const target = createDatabase();
    seed(source.sqlite);
    const backup = await createFullBackup(source.db, '0.1.0');

    expect(() => parseBackupText('{')).toThrow('not a valid JSON');
    for (const invalid of [
      { ...backup, version: 2 },
      { ...backup, events: [...backup.events, backup.events[0]] },
      { ...backup, events: [{ ...backup.events[0], pet_id: TREAT_ID }] },
      { ...backup, events: [{ ...backup.events[0], kcal_total_milli: 7 }] },
    ]) {
      await expect(restoreFullBackup(target.db, invalid)).rejects.toThrow();
    }
    expect(target.sqlite.prepare('SELECT COUNT(*) AS count FROM pets').get()).toEqual({ count: 0 });
  });

  it('leaves an existing target untouched', async () => {
    const source = createDatabase();
    const target = createDatabase();
    seed(source.sqlite);
    seed(target.sqlite);
    const backup = await createFullBackup(source.db, '0.1.0');

    await expect(restoreFullBackup(target.db, backup)).rejects.toThrow('fresh app');
    expect(target.sqlite.prepare('SELECT COUNT(*) AS count FROM treat_events').get()).toEqual({ count: 1 });
  });

  it('rolls back every table after a write fails halfway through', async () => {
    const source = createDatabase();
    const target = createDatabase();
    seed(source.sqlite);
    target.failOn('treat_events');
    const backup = await createFullBackup(source.db, '0.1.0');

    await expect(restoreFullBackup(target.db, backup)).rejects.toThrow('injected write failure');
    for (const table of ['pets', 'treats', 'treat_events', 'daily_goals', 'reminders', 'app_metadata']) {
      expect(target.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
  });
});
