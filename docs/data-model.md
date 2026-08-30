# Data model

## Principles

- SQLite is the MVP source of truth.
- Persist IDs as UUID strings generated on-device.
- Persist instants as ISO 8601 UTC strings.
- Preserve event-local calendar dates for stable daily grouping.
- Snapshot mutable catalog values onto events.
- Represent unknown values as `NULL`, never as zero.
- Include timestamps and soft-deletion fields needed by future synchronization.

## Entity relationships

```text
pet 1 ─── * treat_event * ─── 0..1 treat
pet 1 ─── * daily_goal
pet 1 ─── * reminder
```

A treat event may retain a nullable catalog reference. Its snapshots remain valid if that treat is archived or deleted.

## Tables

### `pets`

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Required, trimmed |
| `species` | TEXT | `dog` or `cat` |
| `photo_uri` | TEXT NULL | Local URI in MVP |
| `birth_date` | TEXT NULL | `YYYY-MM-DD` |
| `weight_grams` | INTEGER NULL | Avoid floating-point unit drift |
| `weight_unit_preference` | TEXT | `kg` or `lb` |
| `is_active` | INTEGER | Boolean |
| `created_at` | TEXT | UTC instant |
| `updated_at` | TEXT | UTC instant |
| `deleted_at` | TEXT NULL | Tombstone |

Pet name does not need to be unique.

### `treats`

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Required |
| `brand` | TEXT NULL | Optional |
| `category` | TEXT | User-selectable category |
| `default_quantity_milli` | INTEGER | Quantity × 1000 |
| `unit` | TEXT | Display unit, such as `piece` or `tsp` |
| `kcal_per_unit_milli` | INTEGER NULL | kcal × 1000 |
| `is_favorite` | INTEGER | Boolean |
| `last_used_at` | TEXT NULL | Supports recent ordering |
| `created_at` | TEXT | UTC instant |
| `updated_at` | TEXT | UTC instant |
| `deleted_at` | TEXT NULL | Archive/tombstone |

Do not enforce unique names; two brands may use the same product name.

Suggested initial categories:

- Biscuit
- Chew
- Dental
- Freeze-dried
- Human food
- Training
- Other

Categories are organizational labels, not health classifications.

### `treat_events`

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `pet_id` | TEXT FK | Required |
| `treat_id` | TEXT FK NULL | Catalog link if one exists |
| `quantity_milli` | INTEGER | Quantity × 1000; greater than zero |
| `occurred_at` | TEXT | UTC instant |
| `local_date` | TEXT | Intended `YYYY-MM-DD` grouping date |
| `timezone` | TEXT NULL | IANA zone |
| `utc_offset_minutes` | INTEGER | Offset at occurrence |
| `note` | TEXT NULL | User-entered |
| `treat_name_snapshot` | TEXT | Required |
| `brand_snapshot` | TEXT NULL | Historical display value |
| `category_snapshot` | TEXT | Historical grouping value |
| `unit_snapshot` | TEXT | Historical unit |
| `kcal_per_unit_milli_snapshot` | INTEGER NULL | Historical estimate |
| `kcal_total_milli` | INTEGER NULL | Stored result at write time |
| `created_at` | TEXT | UTC instant |
| `updated_at` | TEXT | UTC instant |
| `deleted_at` | TEXT NULL | Tombstone |

`kcal_total_milli` is calculated transactionally:

```text
round(quantity_milli × kcal_per_unit_milli_snapshot / 1000)
```

It is `NULL` when the per-unit estimate is unknown.

### `daily_goals`

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `pet_id` | TEXT FK | Required |
| `metric` | TEXT | `event_count` or `known_kcal` |
| `target_milli` | INTEGER | Target × 1000 |
| `effective_from` | TEXT | Local `YYYY-MM-DD` |
| `effective_to` | TEXT NULL | Exclusive end date |
| `created_at` | TEXT | UTC instant |
| `updated_at` | TEXT | UTC instant |
| `deleted_at` | TEXT NULL | Tombstone |

Effective ranges preserve what budget applied historically. Prevent overlapping active ranges for the same pet and metric in application validation.

### `reminders`

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `pet_id` | TEXT FK NULL | Null means general reminder |
| `label` | TEXT | User-visible purpose |
| `local_time` | TEXT | `HH:mm` |
| `days_mask` | INTEGER | Seven-bit weekday mask |
| `timezone_mode` | TEXT | Initially `device_local` |
| `enabled` | INTEGER | Boolean |
| `platform_notification_id` | TEXT NULL | Scheduled notification |
| `created_at` | TEXT | UTC instant |
| `updated_at` | TEXT | UTC instant |
| `deleted_at` | TEXT NULL | Tombstone |

### `app_metadata`

| Field | Type | Notes |
|---|---|---|
| `key` | TEXT PK | Stable metadata key |
| `value` | TEXT | Serialized scalar or JSON |

Use for schema metadata and durable preferences that do not warrant a dedicated table. Database schema version should still use SQLite's `user_version`.

## Indexes

Create at minimum:

```sql
CREATE INDEX idx_events_pet_local_date
  ON treat_events (pet_id, local_date, occurred_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_events_treat
  ON treat_events (treat_id, occurred_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_treats_recent
  ON treats (is_favorite DESC, last_used_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_goals_pet_range
  ON daily_goals (pet_id, metric, effective_from, effective_to)
  WHERE deleted_at IS NULL;
```

## Invariants

- Active event must reference an active or deleted pet record that still exists locally.
- Event quantity is greater than zero.
- Event total is null exactly when its calorie snapshot is null.
- Event snapshots do not change when its linked catalog treat changes.
- Editing an event quantity recalculates its total from its existing calorie snapshot unless the user explicitly selects a new treat/value.
- A pet always has a valid species value.
- At least one non-deleted pet is active when pets exist.
- Soft-deleted records are excluded from normal totals and lists.

## Migration strategy

Each migration should:

1. Run inside a transaction when SQLite permits.
2. Be idempotent at the migration-runner level.
3. Advance `user_version` only after success.
4. Preserve all user events.
5. Include tests from a fixture representing the prior schema.

Never edit a released migration. Add a new numbered migration.

## Export contract

The JSON export root should include:

```json
{
  "format": "treat-tracker-export",
  "version": 1,
  "exportedAt": "2030-01-01T12:00:00.000Z",
  "pets": [],
  "treats": [],
  "events": [],
  "goals": []
}
```

CSV event export should contain:

```text
event_id,pet_name,occurred_at,local_date,timezone,treat_name,brand,category,quantity,unit,estimated_kcal,note
```

Unknown calorie values remain blank. Protect CSV consumers from formula injection by prefixing risky text cells with a single quote.

## Future synchronization fields

Do not add speculative columns until sync design begins, but reserve these concepts:

- Device or actor identity
- Server revision
- Pending mutation outbox
- Last synchronized timestamp
- Conflict record

Stable UUIDs, `updated_at`, and tombstones already reduce the eventual migration cost.
