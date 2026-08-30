/**
 * The narrow slice of expo-sqlite the data layer actually uses.
 *
 * Depending on this interface instead of the concrete SQLiteDatabase lets the
 * migration runner and repositories be unit-tested against an in-memory double,
 * and keeps expo-sqlite behind the repository boundary (docs/architecture.md).
 *
 * Signatures mirror expo-sqlite's own, so a real SQLiteDatabase satisfies this
 * type directly. Pass an empty array when a statement takes no parameters.
 */

/** Values SQLite can bind to a placeholder. */
export type SqlValue = string | number | boolean | null | Uint8Array;

export interface SqliteLike {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
