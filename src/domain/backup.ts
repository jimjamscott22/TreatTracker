import { z } from 'zod';

import { goalMetricSchema, speciesSchema, treatCategorySchema } from './entities';

const id = z.uuid();
const instant = z.iso.datetime();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
  'Invalid calendar date',
);
const flag = z.union([z.literal(0), z.literal(1)]);
const deletedAt = instant.nullable();

const pet = z.strictObject({
  id,
  name: z.string().min(1),
  species: speciesSchema,
  photo_uri: z.string().nullable(),
  birth_date: date.nullable(),
  weight_grams: z.number().int().positive().nullable(),
  weight_unit_preference: z.enum(['kg', 'lb']),
  is_active: flag,
  created_at: instant,
  updated_at: instant,
  deleted_at: deletedAt,
});

const treat = z.strictObject({
  id,
  name: z.string().min(1),
  brand: z.string().nullable(),
  category: treatCategorySchema,
  default_quantity_milli: z.number().int().positive(),
  unit: z.string().min(1),
  kcal_per_unit_milli: z.number().int().nonnegative().nullable(),
  is_favorite: flag,
  last_used_at: instant.nullable(),
  created_at: instant,
  updated_at: instant,
  deleted_at: deletedAt,
});

const event = z.strictObject({
  id,
  pet_id: id,
  treat_id: id.nullable(),
  quantity_milli: z.number().int().positive(),
  occurred_at: instant,
  local_date: date,
  timezone: z.string().nullable(),
  utc_offset_minutes: z.number().int().min(-840).max(840),
  note: z.string().nullable(),
  treat_name_snapshot: z.string().min(1),
  brand_snapshot: z.string().nullable(),
  category_snapshot: treatCategorySchema,
  unit_snapshot: z.string().min(1),
  kcal_per_unit_milli_snapshot: z.number().int().nonnegative().nullable(),
  kcal_total_milli: z.number().int().nonnegative().nullable(),
  created_at: instant,
  updated_at: instant,
  deleted_at: deletedAt,
});

const goal = z.strictObject({
  id,
  pet_id: id,
  metric: goalMetricSchema,
  target_milli: z.number().int().positive(),
  effective_from: date,
  effective_to: date.nullable(),
  created_at: instant,
  updated_at: instant,
  deleted_at: deletedAt,
});

const reminder = z.strictObject({
  id,
  pet_id: id.nullable(),
  label: z.string().min(1),
  local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  days_mask: z.number().int().min(0).max(127),
  timezone_mode: z.literal('device_local'),
  enabled: flag,
  platform_notification_id: z.string().nullable(),
  created_at: instant,
  updated_at: instant,
  deleted_at: deletedAt,
});

const metadata = z.strictObject({
  key: z.string().min(1),
  value: z.string(),
});

export const backupSchema = z.strictObject({
  format: z.literal('treat-tracker-backup'),
  version: z.literal(1),
  scope: z.literal('full'),
  appVersion: z.string().min(1),
  exportedAt: instant,
  pets: z.array(pet),
  treats: z.array(treat),
  events: z.array(event),
  goals: z.array(goal),
  reminders: z.array(reminder),
  metadata: z.array(metadata),
}).superRefine((backup, context) => {
  const unique = (values: readonly string[], name: string) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', message: `Duplicate ${name} ID` });
    }
  };

  unique(backup.pets.map((row) => row.id), 'pet');
  unique(backup.treats.map((row) => row.id), 'treat');
  unique(backup.events.map((row) => row.id), 'event');
  unique(backup.goals.map((row) => row.id), 'goal');
  unique(backup.reminders.map((row) => row.id), 'reminder');
  unique(backup.metadata.map((row) => row.key), 'metadata');

  const pets = new Set(backup.pets.map((row) => row.id));
  const treats = new Set(backup.treats.map((row) => row.id));
  for (const row of backup.events) {
    if (!pets.has(row.pet_id) || (row.treat_id !== null && !treats.has(row.treat_id))) {
      context.addIssue({ code: 'custom', message: 'Event references a missing pet or treat' });
    }
    const expected = row.kcal_per_unit_milli_snapshot === null
      ? null
      : Math.round(row.quantity_milli * row.kcal_per_unit_milli_snapshot / 1000);
    if (row.kcal_total_milli !== expected) {
      context.addIssue({ code: 'custom', message: 'Event calorie snapshot is inconsistent' });
    }
  }
  for (const row of backup.goals) {
    if (!pets.has(row.pet_id)) context.addIssue({ code: 'custom', message: 'Goal references a missing pet' });
  }
  for (const row of backup.reminders) {
    if (row.pet_id !== null && !pets.has(row.pet_id)) {
      context.addIssue({ code: 'custom', message: 'Reminder references a missing pet' });
    }
  }
  if (backup.pets.some((row) => row.photo_uri !== null)) {
    context.addIssue({ code: 'custom', message: 'Pet photos need a portable backup format before transfer' });
  }
});

export type FullBackup = z.infer<typeof backupSchema>;

export function parseBackup(input: unknown): FullBackup {
  const result = backupSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Backup validation failed: ${result.error.issues[0]?.message ?? 'invalid file'}`);
  }
  return result.data;
}

export function parseBackupText(text: string): FullBackup {
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    throw new Error('This is not a valid JSON backup file.');
  }
  return parseBackup(input);
}
