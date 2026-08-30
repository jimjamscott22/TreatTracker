import * as Crypto from 'expo-crypto';

/**
 * Stable, on-device UUIDs for every persisted entity (AGENTS.md).
 *
 * Generating these client-side keeps ids stable if a future sync phase arrives,
 * so records never need renumbering on upload.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
