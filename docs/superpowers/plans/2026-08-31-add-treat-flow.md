# Add a treat flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use superpowers:test-driven-development or superpowers:executing-plans — both are disabled for this project; implement each step directly, then verify with the listed test/typecheck commands.

**Goal:** Give Today a working "Add a treat" entry point so a user with zero catalog treats can record their first entry, per `docs/superpowers/specs/2026-08-31-add-treat-flow-design.md`.

**Architecture:** A new `AddTreatSheet` component (RN `Modal`, no new dependency) is mounted from `app/(tabs)/index.tsx` and opened from a header button plus the existing empty-state action. It has two steps — search/create, then a form — backed by one new repository function that inserts a catalog treat and its first event in a single transaction, and the existing `eventsRepository.recordEvent` for one-off entries and for picking an existing treat.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router, TypeScript strict, Zod, expo-sqlite, Jest + jest-expo + @testing-library/react-native.

## Global Constraints

(From `AGENTS.md`, verbatim requirements that apply to every task below.)

- Access SQLite through repositories; UI components must not execute SQL.
- Store energy as integer thousandths of a kilocalorie when calculations require precision; format values for display at the boundary.
- Use accessible labels, dynamic type, and a minimum 44-by-44-point touch target.
- Updates to catalog treats must never mutate prior event snapshots.
- Use TypeScript with strict mode; avoid `any`.
- Use stable UUIDs for persisted entities.
- For each behavior change, add the lowest-cost test that proves it: unit tests for repository logic, component tests for validation/empty-states/quick-add-style interactions.
- Before marking work complete: run type checking and relevant tests.
- Keep commits focused and describe user-visible outcomes.

---

## Task 1: `recordCatalogTreatEvent` repository function

**Files:**
- Modify: `src/db/repositories/events.ts`
- Test: `src/db/__tests__/events.test.ts` (create)

**Interfaces:**
- Consumes: `treatDraftSchema`, `treatEventDraftSchema`, `TreatDraft`, `Treat`, `TreatEvent` (`src/domain/entities.ts`); `eventKcalMilli` (`src/domain/units.ts`); `deviceTimeZone`, `localDateOf`, `utcOffsetMinutesOf` (`src/domain/dates.ts`); `newId` (`src/utils/ids.ts`); `fromBool` (`src/db/mappers.ts`); `getTreat` (`src/db/repositories/treats.ts`); `SqliteLike` (`src/db/types.ts`).
- Produces: `eventsRepository.recordCatalogTreatEvent(db: SqliteLike, params: { petId: string; treatDraft: TreatDraft; quantityMilli?: number; occurredAt?: Date; note?: string | null }): Promise<{ treat: Treat; event: TreatEvent }>` — later tasks (`AddTreatSheet`) call this exact signature.

- [ ] **Step 1: Update the imports at the top of `src/db/repositories/events.ts`**

Replace the existing import block:

```ts
import { deviceTimeZone, localDateOf, utcOffsetMinutesOf } from '../../domain/dates';
import {
  treatEventDraftSchema,
  type LocalDate,
  type Treat,
  type TreatEvent,
  type TreatEventDraft,
} from '../../domain/entities';
import { eventKcalMilli } from '../../domain/units';
import { newId } from '../../utils/ids';
import { toTreatEvent, type TreatEventRow } from '../mappers';
import type { SqliteLike } from '../types';
```

with:

```ts
import { deviceTimeZone, localDateOf, utcOffsetMinutesOf } from '../../domain/dates';
import {
  treatDraftSchema,
  treatEventDraftSchema,
  type LocalDate,
  type Treat,
  type TreatDraft,
  type TreatEvent,
  type TreatEventDraft,
} from '../../domain/entities';
import { eventKcalMilli } from '../../domain/units';
import { newId } from '../../utils/ids';
import { fromBool, toTreatEvent, type TreatEventRow } from '../mappers';
import type { SqliteLike } from '../types';
import { getTreat } from './treats';
```

- [ ] **Step 2: Append the new function to `src/db/repositories/events.ts`**, after `restoreEvent`:

```ts

/**
 * Creates a catalog treat and records the first event for it in one
 * transaction -- docs/ux-flows.md, "Add a new treat": "Save creates the
 * catalog item and event in one transaction."
 *
 * This does not call `createTreat` / `recordEvent`: both open their own
 * `withTransactionAsync`, and nesting transactions is not safe. The two
 * inserts below are duplicated from those functions' SQL but run inside one
 * transaction here instead.
 */
export async function recordCatalogTreatEvent(
  db: SqliteLike,
  params: {
    petId: string;
    treatDraft: TreatDraft;
    quantityMilli?: number;
    occurredAt?: Date;
    note?: string | null;
  },
): Promise<{ treat: Treat; event: TreatEvent }> {
  const treatInput = treatDraftSchema.parse(params.treatDraft);
  const occurredAtDate = params.occurredAt ?? new Date();
  const timezone = deviceTimeZone();

  const eventInput = treatEventDraftSchema.parse({
    petId: params.petId,
    treatId: null,
    quantityMilli: params.quantityMilli ?? treatInput.defaultQuantityMilli,
    occurredAt: occurredAtDate.toISOString(),
    localDate: localDateOf(occurredAtDate, timezone ?? undefined),
    timezone,
    utcOffsetMinutes: utcOffsetMinutesOf(occurredAtDate, timezone ?? undefined),
    note: params.note ?? null,
    treatNameSnapshot: treatInput.name,
    brandSnapshot: treatInput.brand,
    categorySnapshot: treatInput.category,
    unitSnapshot: treatInput.unit,
    kcalPerUnitMilliSnapshot: treatInput.kcalPerUnitMilli,
  });

  const treatId = newId();
  const eventId = newId();
  const now = new Date().toISOString();
  const kcalTotalMilli = eventKcalMilli(
    eventInput.quantityMilli,
    eventInput.kcalPerUnitMilliSnapshot,
  );

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO treats (
         id, name, brand, category, default_quantity_milli, unit,
         kcal_per_unit_milli, is_favorite, last_used_at,
         created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        treatId,
        treatInput.name,
        treatInput.brand,
        treatInput.category,
        treatInput.defaultQuantityMilli,
        treatInput.unit,
        treatInput.kcalPerUnitMilli,
        fromBool(treatInput.isFavorite),
        eventInput.occurredAt,
        now,
        now,
      ],
    );

    await db.runAsync(
      `INSERT INTO treat_events (
         id, pet_id, treat_id, quantity_milli, occurred_at, local_date, timezone,
         utc_offset_minutes, note, treat_name_snapshot, brand_snapshot,
         category_snapshot, unit_snapshot, kcal_per_unit_milli_snapshot,
         kcal_total_milli, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        eventId,
        eventInput.petId,
        treatId,
        eventInput.quantityMilli,
        eventInput.occurredAt,
        eventInput.localDate,
        eventInput.timezone,
        eventInput.utcOffsetMinutes,
        eventInput.note,
        eventInput.treatNameSnapshot,
        eventInput.brandSnapshot,
        eventInput.categorySnapshot,
        eventInput.unitSnapshot,
        eventInput.kcalPerUnitMilliSnapshot,
        kcalTotalMilli,
        now,
        now,
      ],
    );
  });

  const treat = await getTreat(db, treatId);
  const event = await getEvent(db, eventId);
  if (!treat || !event) throw new Error('Treat or event was not persisted');
  return { treat, event };
}
```

- [ ] **Step 3: Create `src/db/__tests__/events.test.ts`**

```ts
import { recordCatalogTreatEvent } from '../repositories/events';
import type { SqliteLike, SqlValue } from '../types';

/**
 * In-memory stand-in for expo-sqlite, scoped to what
 * `recordCatalogTreatEvent` issues: two INSERTs and two id-keyed SELECTs.
 */
function createFakeDb(): SqliteLike {
  const treats = new Map<string, Record<string, SqlValue>>();
  const events = new Map<string, Record<string, SqlValue>>();

  return {
    async execAsync() {},
    async getAllAsync() {
      return [];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      await task();
    },
    async runAsync(source: string, params: SqlValue[]) {
      if (source.includes('INSERT INTO treats')) {
        const [
          id, name, brand, category, default_quantity_milli, unit,
          kcal_per_unit_milli, is_favorite, last_used_at, created_at, updated_at,
        ] = params;
        treats.set(id as string, {
          id, name, brand, category, default_quantity_milli, unit,
          kcal_per_unit_milli, is_favorite, last_used_at, created_at, updated_at,
          deleted_at: null,
        });
      } else if (source.includes('INSERT INTO treat_events')) {
        const [
          id, pet_id, treat_id, quantity_milli, occurred_at, local_date, timezone,
          utc_offset_minutes, note, treat_name_snapshot, brand_snapshot,
          category_snapshot, unit_snapshot, kcal_per_unit_milli_snapshot,
          kcal_total_milli, created_at, updated_at,
        ] = params;
        events.set(id as string, {
          id, pet_id, treat_id, quantity_milli, occurred_at, local_date, timezone,
          utc_offset_minutes, note, treat_name_snapshot, brand_snapshot,
          category_snapshot, unit_snapshot, kcal_per_unit_milli_snapshot,
          kcal_total_milli, created_at, updated_at, deleted_at: null,
        });
      }
      return { changes: 1 };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
      const id = params[0] as string;
      if (source.includes('FROM treats')) return (treats.get(id) as T) ?? null;
      if (source.includes('FROM treat_events')) return (events.get(id) as T) ?? null;
      return null;
    },
  };
}

describe('recordCatalogTreatEvent', () => {
  it('creates a catalog treat and an event for it in one call', async () => {
    const db = createFakeDb();

    const { treat, event } = await recordCatalogTreatEvent(db, {
      petId: 'pet-1',
      treatDraft: {
        name: 'Duck strips',
        brand: null,
        category: 'training',
        defaultQuantityMilli: 1000,
        unit: 'piece',
        kcalPerUnitMilli: 20000,
        isFavorite: true,
      },
    });

    expect(treat.name).toBe('Duck strips');
    expect(treat.isFavorite).toBe(true);
    expect(event.treatId).toBe(treat.id);
    expect(event.petId).toBe('pet-1');
    expect(event.quantityMilli).toBe(1000);
    expect(event.kcalTotalMilli).toBe(20000);
    expect(event.treatNameSnapshot).toBe('Duck strips');
  });

  it('defaults the event quantity to the treat draft default quantity, and leaves calories null when not entered', async () => {
    const db = createFakeDb();

    const { event } = await recordCatalogTreatEvent(db, {
      petId: 'pet-1',
      treatDraft: {
        name: 'Biscuit',
        brand: null,
        category: 'biscuit',
        defaultQuantityMilli: 2000,
        unit: 'piece',
        kcalPerUnitMilli: null,
        isFavorite: false,
      },
    });

    expect(event.quantityMilli).toBe(2000);
    expect(event.kcalPerUnitMilliSnapshot).toBeNull();
    expect(event.kcalTotalMilli).toBeNull();
  });
});
```

- [ ] **Step 4: Run the new test**

Run: `npm test -- src/db/__tests__/events.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories/events.ts src/db/__tests__/events.test.ts
git commit -m "$(cat <<'EOF'
feat: add recordCatalogTreatEvent for creating a treat and its first event together

Add-a-treat needs to insert a catalog row and an event row atomically;
neither existing createTreat nor recordEvent can be composed safely
because each opens its own transaction.
EOF
)"
```

---

## Task 2: `CategoryPicker` component

**Files:**
- Create: `src/components/CategoryPicker.tsx`
- Test: `src/components/__tests__/CategoryPicker.test.tsx` (create)

**Interfaces:**
- Consumes: `treatCategorySchema`, `treatCategoryLabels`, `TreatCategory` (`src/domain/entities.ts`); `MIN_TOUCH_TARGET`, `radii`, `spacing`, `typography`, `useTheme` (`src/theme`).
- Produces: `CategoryPicker({ value: TreatCategory; onChange: (category: TreatCategory) => void })` — consumed by `AddTreatFormStep` in Task 4.

- [ ] **Step 1: Create `src/components/CategoryPicker.tsx`**

```tsx
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import {
  treatCategoryLabels,
  treatCategorySchema,
  type TreatCategory,
} from '../domain/entities';
import { MIN_TOUCH_TARGET, radii, spacing, typography, useTheme } from '../theme';

const CATEGORIES = treatCategorySchema.options;

type Props = {
  value: TreatCategory;
  onChange: (category: TreatCategory) => void;
};

export function CategoryPicker({ value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
    >
      {CATEGORIES.map((category) => {
        const selected = category === value;
        return (
          <Pressable
            key={category}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={treatCategoryLabels[category]}
            onPress={() => onChange(category)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.accentSoft : colors.surface,
                borderColor: selected ? colors.accent : colors.line,
              },
            ]}
          >
            <Text style={[typography.body, { color: colors.ink }]}>
              {treatCategoryLabels[category]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.xxs },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.quickAdd,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Create `src/components/__tests__/CategoryPicker.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme';
import { CategoryPicker } from '../CategoryPicker';

describe('CategoryPicker', () => {
  it('renders every treat category and reports a change on press', () => {
    const onChange = jest.fn();
    render(
      <ThemeProvider>
        <CategoryPicker value="other" onChange={onChange} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Biscuit')).toBeTruthy();
    expect(screen.getByText('Training')).toBeTruthy();

    fireEvent.press(screen.getByText('Chew'));
    expect(onChange).toHaveBeenCalledWith('chew');
  });
});
```

- [ ] **Step 3: Run the new test**

Run: `npm test -- src/components/__tests__/CategoryPicker.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryPicker.tsx src/components/__tests__/CategoryPicker.test.tsx
git commit -m "feat: add CategoryPicker component for the treat form"
```

---

## Task 3: `AddTreatSearchStep` component

**Files:**
- Create: `src/components/AddTreatSearchStep.tsx`
- Test: `src/components/__tests__/AddTreatSearchStep.test.tsx` (create)

**Interfaces:**
- Consumes: `getDatabase`, `treatsRepository` (`src/db`); `Treat` (`src/domain/entities.ts`); `formatQuantity` (`src/domain/units.ts`); theme tokens.
- Produces: `AddTreatSearchStep({ onPick: (treat: Treat) => void; onCreateNew: (name: string) => void; busy: boolean })` — consumed by `AddTreatSheet` in Task 5.

- [ ] **Step 1: Create `src/components/AddTreatSearchStep.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getDatabase, treatsRepository } from '../db';
import type { Treat } from '../domain/entities';
import { formatQuantity } from '../domain/units';
import { MIN_TOUCH_TARGET, radii, spacing, typography, useTheme } from '../theme';

type Props = {
  onPick: (treat: Treat) => void;
  onCreateNew: (name: string) => void;
  busy: boolean;
};

export function AddTreatSearchStep({ onPick, onCreateNew, busy }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Treat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const db = await getDatabase();
        const trimmed = query.trim();
        const treats = trimmed
          ? await treatsRepository.searchTreats(db, trimmed)
          : await treatsRepository.listQuickAddTreats(db, 20);
        if (!cancelled) {
          setResults(treats);
          setLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const trimmedQuery = query.trim();
  const exactMatch = results.some(
    (treat) => treat.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );

  return (
    <View style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search treats"
        placeholderTextColor={colors.mutedInk}
        autoFocus
        accessibilityLabel="Search treats"
        style={[
          styles.input,
          typography.body,
          { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
        ]}
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {results.map((treat) => (
            <Pressable
              key={treat.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${treat.name}`}
              disabled={busy}
              onPress={() => onPick(treat)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.line, opacity: pressed || busy ? 0.6 : 1 },
              ]}
            >
              <Text style={[typography.body, { color: colors.ink }]}>{treat.name}</Text>
              <Text style={[typography.caption, { color: colors.mutedInk }]}>
                {formatQuantity(treat.defaultQuantityMilli)} {treat.unit}
              </Text>
            </Pressable>
          ))}

          {trimmedQuery && !exactMatch ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Create ${trimmedQuery}`}
              onPress={() => onCreateNew(trimmedQuery)}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[typography.headline, { color: colors.accent }]}>
                Create &quot;{trimmedQuery}&quot;
              </Text>
            </Pressable>
          ) : null}

          {!loading && results.length === 0 && !trimmedQuery ? (
            <Text style={[typography.body, styles.emptyText, { color: colors.mutedInk }]}>
              No treats yet. Type a name to create one.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  list: { maxHeight: 360 },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyText: { textAlign: 'center', paddingVertical: spacing.md },
});
```

Note: the rendered text uses `&quot;` JSX entities around the query so ESLint's `react/no-unescaped-entities` (if enabled) doesn't flag literal quote characters; the accessibility label and the test below use plain `"` since those are plain strings, not JSX text.

- [ ] **Step 2: Create `src/components/__tests__/AddTreatSearchStep.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { treatsRepository } from '../../db';
import { ThemeProvider } from '../../theme';
import { AddTreatSearchStep } from '../AddTreatSearchStep';

jest.mock('../../db', () => ({
  getDatabase: jest.fn().mockResolvedValue({}),
  treatsRepository: {
    listQuickAddTreats: jest.fn(),
    searchTreats: jest.fn(),
  },
}));

const mockedTreats = treatsRepository as jest.Mocked<typeof treatsRepository>;

describe('AddTreatSearchStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists quick-add treats by default and lets the user pick one', async () => {
    mockedTreats.listQuickAddTreats.mockResolvedValue([
      {
        id: 't1',
        name: 'Chicken jerky',
        brand: null,
        category: 'training',
        defaultQuantityMilli: 1000,
        unit: 'piece',
        kcalPerUnitMilli: null,
        isFavorite: true,
        lastUsedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
      },
    ]);

    const onPick = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatSearchStep onPick={onPick} onCreateNew={jest.fn()} busy={false} />
      </ThemeProvider>,
    );

    const result = await screen.findByText('Chicken jerky');
    fireEvent.press(result);

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('offers to create a new treat when the query has no exact match', async () => {
    mockedTreats.listQuickAddTreats.mockResolvedValue([]);
    mockedTreats.searchTreats.mockResolvedValue([]);

    const onCreateNew = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatSearchStep onPick={jest.fn()} onCreateNew={onCreateNew} busy={false} />
      </ThemeProvider>,
    );

    fireEvent.changeText(screen.getByLabelText('Search treats'), 'Duck strips');

    const createRow = await screen.findByText('Create "Duck strips"');
    fireEvent.press(createRow);

    expect(onCreateNew).toHaveBeenCalledWith('Duck strips');
  });
});
```

- [ ] **Step 3: Run the new test**

Run: `npm test -- src/components/__tests__/AddTreatSearchStep.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/AddTreatSearchStep.tsx src/components/__tests__/AddTreatSearchStep.test.tsx
git commit -m "feat: add AddTreatSearchStep for searching or creating a treat"
```

---

## Task 4: `AddTreatFormStep` component

**Files:**
- Create: `src/components/AddTreatFormStep.tsx`
- Test: `src/components/__tests__/AddTreatFormStep.test.tsx` (create)

**Interfaces:**
- Consumes: `Button` (`src/components/Button.tsx`); `CategoryPicker` (Task 2); `treatCategoryLabels`, `treatDraftSchema`, `TreatCategory` (`src/domain/entities.ts`); `toMilli` (`src/domain/units.ts`); theme tokens.
- Produces: `type TreatFormValues = { name: string; category: TreatCategory; quantityMilli: number; unit: string; kcalPerUnitMilli: number | null; note: string | null; isFavorite: boolean; useOnce: boolean }` and `AddTreatFormStep({ initialName: string; busy: boolean; onBack: () => void; onSubmit: (values: TreatFormValues) => void })` — consumed by `AddTreatSheet` in Task 5.

- [ ] **Step 1: Create `src/components/AddTreatFormStep.tsx`**

```tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { treatDraftSchema, type TreatCategory } from '../domain/entities';
import { toMilli } from '../domain/units';
import { MIN_TOUCH_TARGET, radii, spacing, typography, useTheme } from '../theme';
import { Button } from './Button';
import { CategoryPicker } from './CategoryPicker';

export type TreatFormValues = {
  name: string;
  category: TreatCategory;
  quantityMilli: number;
  unit: string;
  kcalPerUnitMilli: number | null;
  note: string | null;
  isFavorite: boolean;
  useOnce: boolean;
};

type Props = {
  initialName: string;
  busy: boolean;
  onBack: () => void;
  onSubmit: (values: TreatFormValues) => void;
};

export function AddTreatFormStep({ initialName, busy, onBack, onSubmit }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<TreatCategory>('other');
  const [quantityText, setQuantityText] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [kcalText, setKcalText] = useState('');
  const [note, setNote] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [useOnce, setUseOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const quantity = Number(quantityText);
    const trimmedKcal = kcalText.trim();
    const kcal = trimmedKcal ? Number(trimmedKcal) : null;

    if (trimmedKcal && !Number.isFinite(kcal)) {
      setError('Enter a valid calorie value, or leave it blank.');
      return;
    }

    const parsed = treatDraftSchema.safeParse({
      name,
      brand: null,
      category,
      defaultQuantityMilli: Number.isFinite(quantity) ? toMilli(quantity) : NaN,
      unit,
      kcalPerUnitMilli: kcal !== null ? toMilli(kcal) : null,
      isFavorite,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setError(null);
    onSubmit({
      name: parsed.data.name,
      category: parsed.data.category,
      quantityMilli: parsed.data.defaultQuantityMilli,
      unit: parsed.data.unit,
      kcalPerUnitMilli: parsed.data.kcalPerUnitMilli,
      note: note.trim() ? note.trim() : null,
      isFavorite: parsed.data.isFavorite,
      useOnce,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={[typography.headline, { color: colors.ink }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={(next) => {
            setName(next);
            setError(null);
          }}
          placeholder="Treat name"
          placeholderTextColor={colors.mutedInk}
          accessibilityLabel="Treat name"
          style={[
            styles.input,
            typography.body,
            { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[typography.headline, { color: colors.ink }]}>Category</Text>
        <CategoryPicker value={category} onChange={setCategory} />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, styles.flex1]}>
          <Text style={[typography.headline, { color: colors.ink }]}>Quantity</Text>
          <TextInput
            value={quantityText}
            onChangeText={setQuantityText}
            keyboardType="decimal-pad"
            accessibilityLabel="Quantity"
            style={[
              styles.input,
              typography.body,
              { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
            ]}
          />
        </View>
        <View style={[styles.field, styles.flex1]}>
          <Text style={[typography.headline, { color: colors.ink }]}>Unit</Text>
          <TextInput
            value={unit}
            onChangeText={setUnit}
            accessibilityLabel="Unit"
            style={[
              styles.input,
              typography.body,
              { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
            ]}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[typography.headline, { color: colors.ink }]}>
          Calories per unit (optional)
        </Text>
        <TextInput
          value={kcalText}
          onChangeText={setKcalText}
          keyboardType="decimal-pad"
          placeholder="Not entered"
          placeholderTextColor={colors.mutedInk}
          accessibilityLabel="Calories per unit"
          style={[
            styles.input,
            typography.body,
            { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[typography.headline, { color: colors.ink }]}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note"
          placeholderTextColor={colors.mutedInk}
          accessibilityLabel="Note"
          style={[
            styles.input,
            typography.body,
            { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
          ]}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={[typography.body, { color: colors.ink }]}>
          Use once (don&apos;t save to catalog)
        </Text>
        <Switch value={useOnce} onValueChange={setUseOnce} accessibilityLabel="Use once" />
      </View>

      {!useOnce ? (
        <View style={styles.switchRow}>
          <Text style={[typography.body, { color: colors.ink }]}>Favorite</Text>
          <Switch value={isFavorite} onValueChange={setIsFavorite} accessibilityLabel="Favorite" />
        </View>
      ) : null}

      {error ? (
        <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.accent }]}>
          {error}
        </Text>
      ) : null}

      <Button
        label={useOnce ? 'Record treat' : 'Save and record'}
        onPress={handleSubmit}
        busy={busy}
      />
      <Button label="Back to search" variant="ghost" onPress={onBack} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  field: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
});
```

- [ ] **Step 2: Create `src/components/__tests__/AddTreatFormStep.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme';
import { AddTreatFormStep } from '../AddTreatFormStep';

describe('AddTreatFormStep', () => {
  it('submits parsed values with quantity and calories converted to milli units', () => {
    const onSubmit = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatFormStep
          initialName="Duck strips"
          busy={false}
          onBack={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>,
    );

    fireEvent.changeText(screen.getByLabelText('Quantity'), '2');
    fireEvent.changeText(screen.getByLabelText('Calories per unit'), '35');
    fireEvent.press(screen.getByText('Save and record'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Duck strips',
      category: 'other',
      quantityMilli: 2000,
      unit: 'piece',
      kcalPerUnitMilli: 35000,
      note: null,
      isFavorite: false,
      useOnce: false,
    });
  });

  it('shows a validation error and does not submit when the name is blank', () => {
    const onSubmit = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatFormStep initialName="" busy={false} onBack={jest.fn()} onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByText('Save and record'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a treat name')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the new test**

Run: `npm test -- src/components/__tests__/AddTreatFormStep.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/AddTreatFormStep.tsx src/components/__tests__/AddTreatFormStep.test.tsx
git commit -m "feat: add AddTreatFormStep with catalog and one-off validation"
```

---

## Task 5: `AddTreatSheet` orchestrator component

**Files:**
- Create: `src/components/AddTreatSheet.tsx`
- Modify: `src/components/index.ts`
- Test: `src/components/__tests__/AddTreatSheet.test.tsx` (create)

**Interfaces:**
- Consumes: `AddTreatSearchStep` (Task 3), `AddTreatFormStep` + `TreatFormValues` (Task 4); `eventsRepository`, `getDatabase` (`src/db`); `TreatDraft`, `TreatEventDraft` (`src/domain/entities.ts`); `deviceTimeZone`, `localDateOf`, `utcOffsetMinutesOf` (`src/domain/dates.ts`); theme tokens.
- Produces: `AddTreatSheet({ visible: boolean; petId: string; petName: string; onClose: () => void; onSaved: () => void })`, exported from `src/components/index.ts` — consumed by `app/(tabs)/index.tsx` in Task 6.

- [ ] **Step 1: Create `src/components/AddTreatSheet.tsx`**

```tsx
import { useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { eventsRepository, getDatabase } from '../db';
import { deviceTimeZone, localDateOf, utcOffsetMinutesOf } from '../domain/dates';
import type { Treat, TreatDraft, TreatEventDraft } from '../domain/entities';
import { MIN_TOUCH_TARGET, radii, spacing, typography, useTheme } from '../theme';
import { AddTreatFormStep, type TreatFormValues } from './AddTreatFormStep';
import { AddTreatSearchStep } from './AddTreatSearchStep';

type Props = {
  visible: boolean;
  petId: string;
  petName: string;
  onClose: () => void;
  onSaved: () => void;
};

type Step = { name: 'search' } | { name: 'form'; prefillName: string };

export function AddTreatSheet({ visible, petId, petName, onClose, onSaved }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>({ name: 'search' });
  const [saving, setSaving] = useState(false);

  function reset() {
    setStep({ name: 'search' });
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePickExisting(treat: Treat) {
    setSaving(true);
    try {
      const db = await getDatabase();
      await eventsRepository.recordEvent(
        db,
        eventsRepository.draftFromTreat({ petId, treat }),
      );
      AccessibilityInfo.announceForAccessibility(`Recorded ${treat.name} for ${petName}`);
      reset();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForm(values: TreatFormValues) {
    setSaving(true);
    try {
      const db = await getDatabase();

      if (values.useOnce) {
        const occurredAt = new Date();
        const timezone = deviceTimeZone();
        const draft: TreatEventDraft = {
          petId,
          treatId: null,
          quantityMilli: values.quantityMilli,
          occurredAt: occurredAt.toISOString(),
          localDate: localDateOf(occurredAt, timezone ?? undefined),
          timezone,
          utcOffsetMinutes: utcOffsetMinutesOf(occurredAt, timezone ?? undefined),
          note: values.note,
          treatNameSnapshot: values.name,
          brandSnapshot: null,
          categorySnapshot: values.category,
          unitSnapshot: values.unit,
          kcalPerUnitMilliSnapshot: values.kcalPerUnitMilli,
        };
        await eventsRepository.recordEvent(db, draft);
        AccessibilityInfo.announceForAccessibility(`Recorded ${values.name} for ${petName}`);
      } else {
        const treatDraft: TreatDraft = {
          name: values.name,
          brand: null,
          category: values.category,
          defaultQuantityMilli: values.quantityMilli,
          unit: values.unit,
          kcalPerUnitMilli: values.kcalPerUnitMilli,
          isFavorite: values.isFavorite,
        };
        await eventsRepository.recordCatalogTreatEvent(db, {
          petId,
          treatDraft,
          quantityMilli: values.quantityMilli,
        });
        AccessibilityInfo.announceForAccessibility(
          `Added ${values.name} and recorded it for ${petName}`,
        );
      }

      reset();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close"
          onPress={handleClose}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[typography.title2, { color: colors.ink }]}>
              {step.name === 'search' ? 'Add a treat' : 'New treat'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <Text style={[typography.body, { color: colors.accent }]}>Close</Text>
            </Pressable>
          </View>

          {step.name === 'search' ? (
            <AddTreatSearchStep
              onPick={(treat) => void handlePickExisting(treat)}
              onCreateNew={(name) => setStep({ name: 'form', prefillName: name })}
              busy={saving}
            />
          ) : (
            <AddTreatFormStep
              initialName={step.prefillName}
              busy={saving}
              onBack={() => setStep({ name: 'search' })}
              onSubmit={(values) => void handleSubmitForm(values)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    padding: spacing.md,
    gap: spacing.md,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Export it from the barrel, `src/components/index.ts`**

Replace:

```ts
export { Button } from './Button';
export { Card } from './Card';
export { EmptyState } from './EmptyState';
export { LoadingState } from './LoadingState';
export { ProgressBar } from './ProgressBar';
```

with:

```ts
export { AddTreatSheet } from './AddTreatSheet';
export { Button } from './Button';
export { Card } from './Card';
export { EmptyState } from './EmptyState';
export { LoadingState } from './LoadingState';
export { ProgressBar } from './ProgressBar';
```

- [ ] **Step 3: Create `src/components/__tests__/AddTreatSheet.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { eventsRepository, treatsRepository } from '../../db';
import { ThemeProvider } from '../../theme';
import { AddTreatSheet } from '../AddTreatSheet';

jest.mock('../../db', () => ({
  getDatabase: jest.fn().mockResolvedValue({}),
  treatsRepository: {
    listQuickAddTreats: jest.fn(),
    searchTreats: jest.fn(),
  },
  eventsRepository: {
    draftFromTreat: jest.fn((params) => ({ ...params, drafted: true })),
    recordEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    recordCatalogTreatEvent: jest.fn().mockResolvedValue({
      treat: { id: 'treat-1' },
      event: { id: 'event-1' },
    }),
  },
}));

const mockedTreats = treatsRepository as jest.Mocked<typeof treatsRepository>;
const mockedEvents = eventsRepository as jest.Mocked<typeof eventsRepository>;

describe('AddTreatSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTreats.listQuickAddTreats.mockResolvedValue([]);
    mockedTreats.searchTreats.mockResolvedValue([]);
  });

  it('creates a catalog treat and records an event when "Use once" is off', async () => {
    const onSaved = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatSheet
          visible
          petId="pet-1"
          petName="Miso"
          onClose={jest.fn()}
          onSaved={onSaved}
        />
      </ThemeProvider>,
    );

    fireEvent.changeText(await screen.findByLabelText('Search treats'), 'Duck strips');
    fireEvent.press(await screen.findByText('Create "Duck strips"'));
    fireEvent.press(await screen.findByText('Save and record'));

    await screen.findByText('Add a treat');

    expect(mockedEvents.recordCatalogTreatEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        petId: 'pet-1',
        treatDraft: expect.objectContaining({ name: 'Duck strips' }),
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('records a one-off event with no catalog treat when "Use once" is on', async () => {
    const onSaved = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatSheet
          visible
          petId="pet-1"
          petName="Miso"
          onClose={jest.fn()}
          onSaved={onSaved}
        />
      </ThemeProvider>,
    );

    fireEvent.changeText(await screen.findByLabelText('Search treats'), 'Leftover chicken');
    fireEvent.press(await screen.findByText('Create "Leftover chicken"'));
    fireEvent(screen.getByLabelText('Use once'), 'valueChange', true);
    fireEvent.press(await screen.findByText('Record treat'));

    expect(mockedEvents.recordEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        petId: 'pet-1',
        treatId: null,
        treatNameSnapshot: 'Leftover chicken',
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the new test**

Run: `npm test -- src/components/__tests__/AddTreatSheet.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/AddTreatSheet.tsx src/components/index.ts src/components/__tests__/AddTreatSheet.test.tsx
git commit -m "feat: add AddTreatSheet orchestrating search, create, and one-off entry"
```

---

## Task 6: Wire the sheet into Today

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `AddTreatSheet` (Task 5); `useNavigation` (`expo-router`).
- Produces: nothing new consumed elsewhere — this is the user-facing fix for the reported bug.

- [ ] **Step 1: Update imports** in `app/(tabs)/index.tsx`

Replace:

```tsx
import { useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, EmptyState, LoadingState, ProgressBar } from '../../src/components';
```

with:

```tsx
import { useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AddTreatSheet,
  Button,
  Card,
  EmptyState,
  LoadingState,
  ProgressBar,
} from '../../src/components';
```

- [ ] **Step 2: Add the header button and sheet-visibility state**

In `TodayScreen`, replace:

```tsx
  const [lastEventId, setLastEventId] = useState<string | null>(null);
```

with:

```tsx
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [addTreatVisible, setAddTreatVisible] = useState(false);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        pet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a treat"
            onPress={() => setAddTreatVisible(true)}
            style={styles.headerButton}
          >
            <Text style={[typography.headline, { color: colors.accent }]}>Add</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, pet, colors.accent]);
```

- [ ] **Step 3: Wire the empty-day action**

Replace:

```tsx
          <EmptyState
            title="No treats recorded today"
            body="Quick add a favorite, or add a treat to get started."
          />
```

with:

```tsx
          <EmptyState
            title="No treats recorded today"
            body="Quick add a favorite, or add a treat to get started."
            actionLabel="Add a treat"
            onAction={() => setAddTreatVisible(true)}
          />
```

- [ ] **Step 4: Mount the sheet**

Replace the component's final `return`:

```tsx
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      {/* ... existing content unchanged ... */}
    </ScrollView>
  );
}
```

with:

```tsx
  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.canvas }}
        contentContainerStyle={styles.content}
      >
        {/* ... existing content unchanged ... */}
      </ScrollView>
      <AddTreatSheet
        visible={addTreatVisible}
        petId={pet.id}
        petName={pet.name}
        onClose={() => setAddTreatVisible(false)}
        onSaved={() => {
          setAddTreatVisible(false);
          refresh();
        }}
      />
    </>
  );
}
```

(Only the wrapping `<>...</>` and the appended `<AddTreatSheet />` are new; every element currently inside `<ScrollView>` stays exactly as-is.)

- [ ] **Step 5: Add the header button style**

In the `StyleSheet.create` call at the bottom of the file, add a `headerButton` entry alongside the existing keys:

```ts
  headerButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
```

- [ ] **Step 6: Type-check and run the full test suite**

Run: `npm run typecheck`
Expected: no errors

Run: `npm test`
Expected: PASS, all suites (including the pre-existing domain/db suites and every suite added in Tasks 1-5)

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
feat: add an entry point for adding a treat on Today

Today previously had no way to reach treat creation once the catalog
was empty -- neither the header nor the empty-day state offered an
action. Both now open the new AddTreatSheet.
EOF
)"
```

---

## Task 7: Manual on-device verification

Per `AGENTS.md`'s testing expectations ("Physical-iPhone smoke testing") and the project's guidance that test suites verify code correctness but not feature correctness, exercise the real flow before calling this done.

- [ ] **Step 1: Start the dev server**

Run: `npm start`

- [ ] **Step 2: On the iPhone (Expo Go), verify the catalog path**

1. Open the app to Today (with the pet created earlier in this session).
2. Tap "Add" in the header.
3. Type a new treat name (something with no existing match), tap `Create "<name>"`.
4. Fill in quantity/unit, leave "Use once" off, tap "Save and record".
5. Confirm: the sheet closes, the new entry appears in Today's event list, and the event count/known-calories update.
6. Tap "Add" again, confirm the same treat now appears in the search step's default list (proving it was actually saved to the catalog).

- [ ] **Step 3: Verify the one-off path**

1. Tap "Add", create another new name, enable "Use once", fill in the required fields, tap "Record treat".
2. Confirm: the entry appears in today's list.
3. Tap "Add" again and confirm this treat does **not** appear in the default/search list (it must not have been saved to the catalog).

- [ ] **Step 4: Verify the empty-state entry point**

If there is a way to reach a day with zero entries (e.g. a fresh pet, or delete today's entries first), confirm the "Add a treat" button inside the empty state also opens the same sheet.

- [ ] **Step 5: Report results**

State plainly which of Steps 2-4 passed on-device, and paste the exact text of anything that didn't behave as expected — do not report this task complete without having actually run it on the phone.
