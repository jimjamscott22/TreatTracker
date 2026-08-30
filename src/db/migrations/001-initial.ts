/**
 * Migration 001 -- initial schema.
 *
 * Mirrors docs/data-model.md. Per AGENTS.md a released migration is never
 * edited; corrections ship as a new numbered migration.
 */
export const migration001Initial = `
CREATE TABLE IF NOT EXISTS pets (
  id                       TEXT PRIMARY KEY NOT NULL,
  name                     TEXT NOT NULL,
  species                  TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
  photo_uri                TEXT,
  birth_date               TEXT,
  weight_grams             INTEGER,
  weight_unit_preference   TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit_preference IN ('kg', 'lb')),
  is_active                INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  deleted_at               TEXT
);

CREATE TABLE IF NOT EXISTS treats (
  id                       TEXT PRIMARY KEY NOT NULL,
  name                     TEXT NOT NULL,
  brand                    TEXT,
  category                 TEXT NOT NULL DEFAULT 'other',
  default_quantity_milli   INTEGER NOT NULL CHECK (default_quantity_milli > 0),
  unit                     TEXT NOT NULL DEFAULT 'piece',
  kcal_per_unit_milli      INTEGER,
  is_favorite              INTEGER NOT NULL DEFAULT 0,
  last_used_at             TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  deleted_at               TEXT
);

CREATE TABLE IF NOT EXISTS treat_events (
  id                               TEXT PRIMARY KEY NOT NULL,
  pet_id                           TEXT NOT NULL REFERENCES pets (id),
  treat_id                         TEXT REFERENCES treats (id),
  quantity_milli                   INTEGER NOT NULL CHECK (quantity_milli > 0),
  occurred_at                      TEXT NOT NULL,
  local_date                       TEXT NOT NULL,
  timezone                         TEXT,
  utc_offset_minutes               INTEGER NOT NULL,
  note                             TEXT,
  treat_name_snapshot              TEXT NOT NULL,
  brand_snapshot                   TEXT,
  category_snapshot                TEXT NOT NULL,
  unit_snapshot                    TEXT NOT NULL,
  kcal_per_unit_milli_snapshot     INTEGER,
  kcal_total_milli                 INTEGER,
  created_at                       TEXT NOT NULL,
  updated_at                       TEXT NOT NULL,
  deleted_at                       TEXT,
  -- Invariant from docs/data-model.md: the total is null exactly when the
  -- per-unit snapshot is null.
  CHECK (
    (kcal_per_unit_milli_snapshot IS NULL AND kcal_total_milli IS NULL)
    OR (kcal_per_unit_milli_snapshot IS NOT NULL AND kcal_total_milli IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS daily_goals (
  id               TEXT PRIMARY KEY NOT NULL,
  pet_id           TEXT NOT NULL REFERENCES pets (id),
  metric           TEXT NOT NULL CHECK (metric IN ('event_count', 'known_kcal')),
  target_milli     INTEGER NOT NULL CHECK (target_milli > 0),
  effective_from   TEXT NOT NULL,
  effective_to     TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);

CREATE TABLE IF NOT EXISTS reminders (
  id                        TEXT PRIMARY KEY NOT NULL,
  pet_id                    TEXT REFERENCES pets (id),
  label                     TEXT NOT NULL,
  local_time                TEXT NOT NULL,
  days_mask                 INTEGER NOT NULL DEFAULT 0,
  timezone_mode             TEXT NOT NULL DEFAULT 'device_local',
  enabled                   INTEGER NOT NULL DEFAULT 1,
  platform_notification_id  TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  deleted_at                TEXT
);

CREATE TABLE IF NOT EXISTS app_metadata (
  key    TEXT PRIMARY KEY NOT NULL,
  value  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_pet_local_date
  ON treat_events (pet_id, local_date, occurred_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_treat
  ON treat_events (treat_id, occurred_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_treats_recent
  ON treats (is_favorite DESC, last_used_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_goals_pet_range
  ON daily_goals (pet_id, metric, effective_from, effective_to)
  WHERE deleted_at IS NULL;
`;
