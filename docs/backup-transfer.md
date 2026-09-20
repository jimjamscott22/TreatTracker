# Full-device backup and iPhone transfer

The **Save backup to Files** action in Settings creates a complete JSON snapshot
of the local SQLite records. Use the iOS share sheet's **Save to Files** action
and keep the resulting file somewhere you can find from the new app. No backup
is uploaded by Treat Tracker. Confirm the file appears in Files before relying
on it.

On a fresh standalone installation, tap **Choose backup from Files** on the
welcome screen, review the pet, treat, and entry counts, then tap **Import
backup**. Import refuses a database with any existing records; it never merges
or overwrites. If import fails, the transaction rolls back and you can retry.
After import, compare the Today totals, a few dated entries, and treat names
with Expo Go. Stop logging in Expo Go once the standalone copy is verified;
the two applications do not synchronize.

## Format v1

The JSON root contains `format: "treat-tracker-backup"`, `version: 1`,
`scope: "full"`, `appVersion`, `exportedAt`, and arrays named `pets`, `treats`,
`events`, `goals`, `reminders`, and `metadata`. Array objects use the SQLite
column names and types documented in [data-model.md](data-model.md). They
include archived and soft-deleted rows. The format preserves UUIDs, UTC
timestamps, event-local dates, catalog links, historical display/calorie
snapshots, and metadata. An importer must validate the entire document and
cross-record references before any write, then insert in foreign-key order in
one transaction. Other format versions and partial exports are rejected.

The source iPhone's platform notification IDs are included in the file for
completeness but are cleared on import: they cannot identify a notification on
a different installation. Reminder definitions are preserved. Pet photo URIs
are also device-local; until photo files are bundled into a future backup
format, the exporter rejects a database containing a pet photo instead of
silently producing an incomplete transfer.

This full backup differs from the selected-pet/date-range JSON or CSV export
described in the product roadmap. The latter is for sharing records and must
not be used for a complete restore. Keep a second copy of the JSON backup if
the phone holds your only treat history; deleting either app can delete its
local database.
