import type {
  DailyGoal,
  Pet,
  Reminder,
  Treat,
  TreatCategory,
  TreatEvent,
} from '../domain/entities';

/**
 * Row shapes as SQLite returns them, and their translation into domain objects.
 *
 * SQLite has no boolean type, so flags arrive as 0/1 integers and are converted
 * here rather than leaking into feature code.
 */

const toBool = (value: number): boolean => value === 1;
const fromBool = (value: boolean): number => (value ? 1 : 0);

export { fromBool };

export type PetRow = {
  id: string;
  name: string;
  species: string;
  photo_uri: string | null;
  birth_date: string | null;
  weight_grams: number | null;
  weight_unit_preference: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species === 'cat' ? 'cat' : 'dog',
    photoUri: row.photo_uri,
    birthDate: row.birth_date,
    weightGrams: row.weight_grams,
    weightUnitPreference: row.weight_unit_preference === 'lb' ? 'lb' : 'kg',
    isActive: toBool(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type TreatRow = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  default_quantity_milli: number;
  unit: string;
  kcal_per_unit_milli: number | null;
  is_favorite: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toTreat(row: TreatRow): Treat {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category as TreatCategory,
    defaultQuantityMilli: row.default_quantity_milli,
    unit: row.unit,
    kcalPerUnitMilli: row.kcal_per_unit_milli,
    isFavorite: toBool(row.is_favorite),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type TreatEventRow = {
  id: string;
  pet_id: string;
  treat_id: string | null;
  quantity_milli: number;
  occurred_at: string;
  local_date: string;
  timezone: string | null;
  utc_offset_minutes: number;
  note: string | null;
  treat_name_snapshot: string;
  brand_snapshot: string | null;
  category_snapshot: string;
  unit_snapshot: string;
  kcal_per_unit_milli_snapshot: number | null;
  kcal_total_milli: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toTreatEvent(row: TreatEventRow): TreatEvent {
  return {
    id: row.id,
    petId: row.pet_id,
    treatId: row.treat_id,
    quantityMilli: row.quantity_milli,
    occurredAt: row.occurred_at,
    localDate: row.local_date,
    timezone: row.timezone,
    utcOffsetMinutes: row.utc_offset_minutes,
    note: row.note,
    treatNameSnapshot: row.treat_name_snapshot,
    brandSnapshot: row.brand_snapshot,
    categorySnapshot: row.category_snapshot as TreatCategory,
    unitSnapshot: row.unit_snapshot,
    kcalPerUnitMilliSnapshot: row.kcal_per_unit_milli_snapshot,
    kcalTotalMilli: row.kcal_total_milli,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type DailyGoalRow = {
  id: string;
  pet_id: string;
  metric: string;
  target_milli: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toDailyGoal(row: DailyGoalRow): DailyGoal {
  return {
    id: row.id,
    petId: row.pet_id,
    metric: row.metric === 'known_kcal' ? 'known_kcal' : 'event_count',
    targetMilli: row.target_milli,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type ReminderRow = {
  id: string;
  pet_id: string | null;
  label: string;
  local_time: string;
  days_mask: number;
  timezone_mode: string;
  enabled: number;
  platform_notification_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    petId: row.pet_id,
    label: row.label,
    localTime: row.local_time,
    daysMask: row.days_mask,
    timezoneMode: 'device_local',
    enabled: toBool(row.enabled),
    platformNotificationId: row.platform_notification_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
