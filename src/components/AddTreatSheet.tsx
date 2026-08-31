import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { eventsRepository, getDatabase, treatsRepository } from '../db';
import {
  treatCategoryLabels,
  treatCategorySchema,
  treatDraftSchema,
  treatEventDraftSchema,
  type Treat,
  type TreatCategory,
} from '../domain/entities';
import { deviceTimeZone, localDateOf, utcOffsetMinutesOf } from '../domain/dates';
import { toMilli } from '../domain/units';
import { MIN_TOUCH_TARGET, radii, spacing, typography, useTheme } from '../theme';
import { Button } from './Button';
import { QuickAddTile } from './QuickAddTile';

type Step = 'search' | 'form';

type Props = {
  visible: boolean;
  petId: string;
  petName: string;
  onClose: () => void;
  /** Called after a treat is recorded; receives the new event id. */
  onRecorded: (eventId: string) => void;
};

const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function parseQuantityMilli(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return toMilli(parsed);
}

function parseKcalMilli(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return toMilli(parsed);
}

export function AddTreatSheet({ visible, petId, petName, onClose, onRecorded }: Props) {
  const { colors } = useTheme();

  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Treat[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<TreatCategory>('other');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [kcal, setKcal] = useState('');
  const [note, setNote] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [useOnce, setUseOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const resetForm = useCallback(() => {
    setStep('search');
    setQuery('');
    setResults([]);
    setName('');
    setCategory('other');
    setQuantity('1');
    setUnit('piece');
    setKcal('');
    setNote('');
    setIsFavorite(false);
    setUseOnce(false);
    setError(null);
    setSaving(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    resetForm();
  }, [visible, resetForm]);

  useEffect(() => {
    if (!visible || step !== 'search') return;

    let cancelled = false;

    async function loadResults() {
      setSearchLoading(true);
      try {
        const db = await getDatabase();
        const treats =
          debouncedQuery.trim().length === 0
            ? await treatsRepository.listQuickAddTreats(db)
            : await treatsRepository.searchTreats(db, debouncedQuery);
        if (!cancelled) setResults(treats);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }

    void loadResults();
    return () => {
      cancelled = true;
    };
  }, [visible, step, debouncedQuery]);

  function handleClose() {
    AccessibilityInfo.announceForAccessibility('Add treat cancelled');
    onClose();
  }

  async function recordFromCatalog(treat: Treat) {
    setSaving(true);
    try {
      const db = await getDatabase();
      const event = await eventsRepository.recordEvent(
        db,
        eventsRepository.draftFromTreat({ petId, treat }),
      );
      onRecorded(event.id);
      AccessibilityInfo.announceForAccessibility(`Recorded ${treat.name} for ${petName}`);
      onClose();
    } catch {
      setError('That treat could not be recorded. Try again.');
      setSaving(false);
    }
  }

  function advanceToCreate() {
    setName(query.trim());
    setStep('form');
    setError(null);
  }

  async function handleSave() {
    const quantityMilli = parseQuantityMilli(quantity);
    if (quantityMilli === null) {
      setError('Quantity must be more than zero');
      return;
    }

    const kcalPerUnitMilli = parseKcalMilli(kcal);

    if (useOnce) {
      const occurredAt = new Date();
      const timezone = deviceTimeZone();
      const draft = treatEventDraftSchema.safeParse({
        petId,
        treatId: null,
        quantityMilli,
        occurredAt: occurredAt.toISOString(),
        localDate: localDateOf(occurredAt, timezone ?? undefined),
        timezone,
        utcOffsetMinutes: utcOffsetMinutesOf(occurredAt, timezone ?? undefined),
        note: note.trim() || null,
        treatNameSnapshot: name.trim(),
        brandSnapshot: null,
        categorySnapshot: category,
        unitSnapshot: unit.trim() || 'piece',
        kcalPerUnitMilliSnapshot: kcalPerUnitMilli,
      });

      if (!draft.success) {
        setError(draft.error.issues[0]?.message ?? 'Check the details and try again.');
        return;
      }

      setSaving(true);
      try {
        const db = await getDatabase();
        const event = await eventsRepository.recordEvent(db, draft.data);
        onRecorded(event.id);
        AccessibilityInfo.announceForAccessibility(
          `Recorded ${draft.data.treatNameSnapshot} for ${petName}`,
        );
        onClose();
      } catch {
        setError('That treat could not be saved. Try again.');
        setSaving(false);
      }
      return;
    }

    const treatDraft = treatDraftSchema.safeParse({
      name,
      brand: null,
      category,
      defaultQuantityMilli: quantityMilli,
      unit: unit.trim() || 'piece',
      kcalPerUnitMilli,
      isFavorite,
    });

    if (!treatDraft.success) {
      setError(treatDraft.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      const { event } = await eventsRepository.recordNewCatalogTreat(db, {
        petId,
        treatDraft: treatDraft.data,
        note: note.trim() || null,
      });
      onRecorded(event.id);
      AccessibilityInfo.announceForAccessibility(
        `Recorded ${treatDraft.data.name} for ${petName}`,
      );
      onClose();
    } catch {
      setError('That treat could not be saved. Try again.');
      setSaving(false);
    }
  }

  const trimmedQuery = query.trim();
  const showCreateRow = trimmedQuery.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Dismiss add treat sheet"
          onPress={handleClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
            <Text style={[typography.title2, { color: colors.ink }]}>
              {step === 'search' ? 'Add treat' : 'New treat'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[typography.headline, { color: colors.accent }]}>Close</Text>
            </Pressable>
          </View>

          {step === 'search' ? (
            <View style={styles.searchBody}>
              <TextInput
                value={query}
                onChangeText={(next) => {
                  setQuery(next);
                  setError(null);
                }}
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

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.resultsContent}
              >
                {searchLoading && results.length === 0 ? (
                  <Text style={[typography.body, { color: colors.mutedInk }]}>
                    Searching…
                  </Text>
                ) : null}

                <View style={styles.resultsGrid}>
                  {results.map((treat) => (
                    <QuickAddTile
                      key={treat.id}
                      treat={treat}
                      accessibilityLabel={`Add ${treat.name} for ${petName}`}
                      onPress={() => void recordFromCatalog(treat)}
                    />
                  ))}
                </View>

                {!searchLoading && results.length === 0 && !trimmedQuery ? (
                  <Text style={[typography.body, styles.emptyHint, { color: colors.mutedInk }]}>
                    No treats yet. Type a name to create one.
                  </Text>
                ) : null}

                {showCreateRow ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Create ${trimmedQuery}`}
                    onPress={advanceToCreate}
                    style={({ pressed }) => [
                      styles.createRow,
                      {
                        borderColor: colors.line,
                        backgroundColor: colors.canvas,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[typography.body, { color: colors.accent }]}>
                      {`Create "${trimmedQuery}"`}
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>

              {error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[typography.body, { color: colors.accent }]}
                >
                  {error}
                </Text>
              ) : null}
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
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
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryRow}
                >
                  {treatCategorySchema.options.map((option) => {
                    const selected = category === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setCategory(option)}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: selected ? colors.accentSoft : colors.canvas,
                            borderColor: selected ? colors.accent : colors.line,
                          },
                        ]}
                      >
                        <Text style={[typography.caption, { color: colors.ink }]}>
                          {treatCategoryLabels[option]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.quantityRow}>
                <View style={[styles.field, styles.quantityField]}>
                  <Text style={[typography.headline, { color: colors.ink }]}>Quantity</Text>
                  <TextInput
                    value={quantity}
                    onChangeText={(next) => {
                      setQuantity(next);
                      setError(null);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.mutedInk}
                    accessibilityLabel="Quantity"
                    style={[
                      styles.input,
                      typography.body,
                      { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
                    ]}
                  />
                </View>
                <View style={[styles.field, styles.unitField]}>
                  <Text style={[typography.headline, { color: colors.ink }]}>Unit</Text>
                  <TextInput
                    value={unit}
                    onChangeText={(next) => {
                      setUnit(next);
                      setError(null);
                    }}
                    placeholder="piece"
                    placeholderTextColor={colors.mutedInk}
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
                  Kcal per unit (optional)
                </Text>
                <TextInput
                  value={kcal}
                  onChangeText={(next) => {
                    setKcal(next);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Leave blank if unknown"
                  placeholderTextColor={colors.mutedInk}
                  accessibilityLabel="Kcal per unit"
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
                  placeholder="Optional note"
                  placeholderTextColor={colors.mutedInk}
                  accessibilityLabel="Note"
                  style={[
                    styles.input,
                    typography.body,
                    { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line },
                  ]}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={[typography.body, { color: colors.ink, flex: 1 }]}>Use once</Text>
                <Switch
                  accessibilityLabel="Use once"
                  accessibilityHint="Record without adding to the treat catalog"
                  value={useOnce}
                  onValueChange={(next) => {
                    setUseOnce(next);
                    if (next) setIsFavorite(false);
                  }}
                  trackColor={{ false: colors.line, true: colors.accentSoft }}
                  thumbColor={useOnce ? colors.accent : colors.mutedInk}
                />
              </View>

              {!useOnce ? (
                <View style={styles.toggleRow}>
                  <Text style={[typography.body, { color: colors.ink, flex: 1 }]}>Favorite</Text>
                  <Switch
                    accessibilityLabel="Favorite"
                    value={isFavorite}
                    onValueChange={setIsFavorite}
                    trackColor={{ false: colors.line, true: colors.accentSoft }}
                    thumbColor={isFavorite ? colors.accent : colors.mutedInk}
                  />
                </View>
              ) : null}

              {error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[typography.body, { color: colors.accent }]}
                >
                  {error}
                </Text>
              ) : null}

              <Button
                label={useOnce ? 'Record treat' : 'Save and record'}
                onPress={() => void handleSave()}
                busy={saving}
              />
            </ScrollView>
          )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheetContainer: {
    width: '100%',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    maxHeight: '90%',
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBody: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    maxHeight: 480,
  },
  formContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  resultsContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  emptyHint: { textAlign: 'center', paddingVertical: spacing.md },
  createRow: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  field: { gap: spacing.xxs },
  quantityRow: { flexDirection: 'row', gap: spacing.sm },
  quantityField: { flex: 1 },
  unitField: { flex: 1 },
  categoryRow: { gap: spacing.xs, paddingVertical: spacing.xxs },
  categoryChip: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
});
