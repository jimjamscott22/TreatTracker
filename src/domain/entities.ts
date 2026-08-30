import { z } from 'zod';

/**
 * Domain entities mirroring docs/data-model.md.
 *
 * Domain code is deliberately free of React, Expo, database, and network
 * imports (docs/architecture.md). Repositories translate SQLite rows (snake_case)
 * into these objects (camelCase).
 */

/** ISO 8601 instant in UTC, e.g. "2030-01-01T12:00:00.000Z". */
export type UtcInstant = string;

/** Calendar day label, "YYYY-MM-DD". Never derived from a UTC date at render time. */
export type LocalDate = string;

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD local date');

export const speciesSchema = z.enum(['dog', 'cat']);
export type Species = z.infer<typeof speciesSchema>;

/**
 * Organizational labels only. docs/data-model.md is explicit that these are not
 * health classifications.
 */
export const treatCategorySchema = z.enum([
  'biscuit',
  'chew',
  'dental',
  'freeze_dried',
  'human_food',
  'training',
  'other',
]);
export type TreatCategory = z.infer<typeof treatCategorySchema>;

export const goalMetricSchema = z.enum(['event_count', 'known_kcal']);
export type GoalMetric = z.infer<typeof goalMetricSchema>;

export type Pet = {
  id: string;
  name: string;
  species: Species;
  photoUri: string | null;
  birthDate: LocalDate | null;
  weightGrams: number | null;
  weightUnitPreference: 'kg' | 'lb';
  isActive: boolean;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
  deletedAt: UtcInstant | null;
};

export type Treat = {
  id: string;
  name: string;
  brand: string | null;
  category: TreatCategory;
  defaultQuantityMilli: number;
  unit: string;
  kcalPerUnitMilli: number | null;
  isFavorite: boolean;
  lastUsedAt: UtcInstant | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
  deletedAt: UtcInstant | null;
};

/**
 * A recorded treat. Snapshot fields are copied at write time so that later
 * catalog edits never rewrite history (AGENTS.md, docs/data-model.md).
 */
export type TreatEvent = {
  id: string;
  petId: string;
  /** Null for a "use once" entry, or when the catalog item was hard-deleted. */
  treatId: string | null;
  quantityMilli: number;
  occurredAt: UtcInstant;
  localDate: LocalDate;
  timezone: string | null;
  utcOffsetMinutes: number;
  note: string | null;
  treatNameSnapshot: string;
  brandSnapshot: string | null;
  categorySnapshot: TreatCategory;
  unitSnapshot: string;
  kcalPerUnitMilliSnapshot: number | null;
  /** Null exactly when kcalPerUnitMilliSnapshot is null. */
  kcalTotalMilli: number | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
  deletedAt: UtcInstant | null;
};

export type DailyGoal = {
  id: string;
  petId: string;
  metric: GoalMetric;
  targetMilli: number;
  effectiveFrom: LocalDate;
  /** Exclusive end date; null means currently in effect. */
  effectiveTo: LocalDate | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
  deletedAt: UtcInstant | null;
};

export type Reminder = {
  id: string;
  /** Null means a general reminder not tied to one pet. */
  petId: string | null;
  label: string;
  /** "HH:mm" in the device's local time. */
  localTime: string;
  /** Seven-bit weekday mask; bit 0 = Sunday. */
  daysMask: number;
  timezoneMode: 'device_local';
  enabled: boolean;
  platformNotificationId: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
  deletedAt: UtcInstant | null;
};

/* -------------------------------------------------------------------------- */
/* Input validation at the form boundary                                       */
/* -------------------------------------------------------------------------- */

export const petDraftSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  species: speciesSchema,
  photoUri: z.string().nullable().default(null),
  birthDate: localDateSchema.nullable().default(null),
  weightGrams: z.number().int().positive().nullable().default(null),
  weightUnitPreference: z.enum(['kg', 'lb']).default('kg'),
});
export type PetDraft = z.infer<typeof petDraftSchema>;

export const treatDraftSchema = z.object({
  name: z.string().trim().min(1, 'Enter a treat name'),
  brand: z.string().trim().nullable().default(null),
  category: treatCategorySchema.default('other'),
  defaultQuantityMilli: z.number().int().positive('Quantity must be more than zero'),
  unit: z.string().trim().min(1).default('piece'),
  /** Null means "not entered" -- never coerce a blank field to zero. */
  kcalPerUnitMilli: z.number().int().nonnegative().nullable().default(null),
  isFavorite: z.boolean().default(false),
});
export type TreatDraft = z.infer<typeof treatDraftSchema>;

export const treatEventDraftSchema = z.object({
  petId: z.string().min(1),
  treatId: z.string().min(1).nullable().default(null),
  quantityMilli: z.number().int().positive('Quantity must be more than zero'),
  occurredAt: z.iso.datetime(),
  localDate: localDateSchema,
  timezone: z.string().nullable().default(null),
  utcOffsetMinutes: z.number().int(),
  note: z.string().trim().nullable().default(null),
  treatNameSnapshot: z.string().trim().min(1),
  brandSnapshot: z.string().trim().nullable().default(null),
  categorySnapshot: treatCategorySchema,
  unitSnapshot: z.string().trim().min(1),
  kcalPerUnitMilliSnapshot: z.number().int().nonnegative().nullable().default(null),
});
export type TreatEventDraft = z.infer<typeof treatEventDraftSchema>;

/** Human-readable labels for the organizational categories. */
export const treatCategoryLabels: Record<TreatCategory, string> = {
  biscuit: 'Biscuit',
  chew: 'Chew',
  dental: 'Dental',
  freeze_dried: 'Freeze-dried',
  human_food: 'Human food',
  training: 'Training',
  other: 'Other',
};
