import { migration001Initial } from './001-initial';

export type Migration = {
  /** Target `user_version` after this migration succeeds. Contiguous from 1. */
  version: number;
  name: string;
  sql: string;
};

/**
 * Ordered migration list. Append only -- never edit a released entry
 * (AGENTS.md, docs/data-model.md).
 */
export const migrations: readonly Migration[] = [
  { version: 1, name: '001-initial', sql: migration001Initial },
];

export const LATEST_SCHEMA_VERSION = migrations.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);
