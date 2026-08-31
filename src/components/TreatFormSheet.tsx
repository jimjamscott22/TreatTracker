import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
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

import { getDatabase, treatsRepository } from '../db';
import {
  treatCategoryLabels,
  treatCategorySchema,
  treatDraftSchema,
  type Treat,
  type TreatCategory,
} from '../domain/entities';
import { fromMilli, toMilli } from '../domain/units';
import { MIN_TOUCH_TARGET, radii, spacing, typography, useTheme } from '../theme';
import { Button } from './Button';

type Mode = 'create' | 'edit';

type Props = {
  visible: boolean;
  mode: Mode;
  /** Required when `mode` is "edit"; ignored for "create". */
  treat: Treat | null;
  onClose: () => void;
  onSaved: (treat: Treat) => void;
  onArchived?: (treatId: string) => void;
  onRestored?: (treat: Treat) => void;
};

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

/**
 * Create/edit form for one catalog treat.
 *
 * Editing a treat never touches past event snapshots
 * (docs/data-model.md, AGENTS.md) -- this sheet only writes the `treats` row.
 */
export function TreatFormSheet({
  visible,
  mode,
  treat,
  onClose,
  onSaved,
  onArchived,
  onRestored,
}: Props) {
  const { colors } = useTheme();
  const isArchived = treat?.deletedAt != null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<TreatCategory>('other');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [kcal, setKcal] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const resetForm = useCallback(() => {
    if (mode === 'edit' && treat) {
      setName(treat.name);
      setCategory(treat.category);
      setQuantity(String(fromMilli(treat.defaultQuantityMilli)));
      setUnit(treat.unit);
      setKcal(treat.kcalPerUnitMilli === null ? '' : String(fromMilli(treat.kcalPerUnitMilli)));
      setIsFavorite(treat.isFavorite);
    } else {
      setName('');
      setCategory('other');
      setQuantity('1');
      setUnit('piece');
      setKcal('');
      setIsFavorite(false);
    }
    setError(null);
    setSaving(false);
    setArchiving(false);
  }, [mode, treat]);

  useEffect(() => {
    if (!visible) return;
    resetForm();
  }, [visible, resetForm]);

  function handleClose() {
    if (saving || archiving) return;
    onClose();
  }

  async function handleSave() {
    const quantityMilli = parseQuantityMilli(quantity);
    if (quantityMilli === null) {
      setError('Quantity must be more than zero');
      return;
    }

    const draft = treatDraftSchema.safeParse({
      name,
      brand: treat?.brand ?? null,
      category,
      defaultQuantityMilli: quantityMilli,
      unit: unit.trim() || 'piece',
      kcalPerUnitMilli: parseKcalMilli(kcal),
      isFavorite,
    });

    if (!draft.success) {
      setError(draft.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      const saved =
        mode === 'edit' && treat
          ? await treatsRepository.updateTreat(db, treat.id, draft.data)
          : await treatsRepository.createTreat(db, draft.data);
      AccessibilityInfo.announceForAccessibility(
        mode === 'edit' ? `Saved changes to ${saved.name}` : `Created ${saved.name}`,
      );
      onSaved(saved);
      onClose();
    } catch {
      setError('That treat could not be saved. Try again.');
      setSaving(false);
    }
  }

  function confirmArchive() {
    if (!treat) return;
    Alert.alert(
      `Archive ${treat.name}?`,
      'Archived treats stay visible in past entries, but drop out of search and quick-add until restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => void doArchive() },
      ],
    );
  }

  async function doArchive() {
    if (!treat) return;
    setArchiving(true);
    try {
      const db = await getDatabase();
      await treatsRepository.archiveTreat(db, treat.id);
      AccessibilityInfo.announceForAccessibility(`Archived ${treat.name}`);
      onArchived?.(treat.id);
      onClose();
    } catch {
      setError('That treat could not be archived. Try again.');
      setArchiving(false);
    }
  }

  async function doRestore() {
    if (!treat) return;
    setArchiving(true);
    try {
      const db = await getDatabase();
      await treatsRepository.restoreTreat(db, treat.id);
      const restored = await treatsRepository.getTreat(db, treat.id);
      AccessibilityInfo.announceForAccessibility(`Restored ${treat.name}`);
      if (restored) onRestored?.(restored);
      onClose();
    } catch {
      setError('That treat could not be restored. Try again.');
      setArchiving(false);
    }
  }

  const busy = saving || archiving;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Dismiss treat form"
          onPress={handleClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={[typography.title2, { color: colors.ink }]}>
                {mode === 'edit' ? 'Edit treat' : 'New treat'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={handleClose}
                hitSlop={spacing.xs}
                style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[typography.headline, { color: colors.accent }]}>Close</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              {isArchived ? (
                <Text style={[typography.caption, { color: colors.mutedInk }]}>
                  This treat is archived. It stays out of search and quick-add until restored.
                </Text>
              ) : null}

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
                  <Text style={[typography.headline, { color: colors.ink }]}>Default quantity</Text>
                  <TextInput
                    value={quantity}
                    onChangeText={(next) => {
                      setQuantity(next);
                      setError(null);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.mutedInk}
                    accessibilityLabel="Default quantity"
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

              <View style={styles.toggleRow}>
                <Text style={[typography.body, { color: colors.ink, flex: 1 }]}>Favorite</Text>
                <Switch
                  accessibilityLabel="Favorite"
                  accessibilityHint="Shows this treat in the Today quick-add area"
                  value={isFavorite}
                  onValueChange={setIsFavorite}
                  trackColor={{ false: colors.line, true: colors.accentSoft }}
                  thumbColor={isFavorite ? colors.accent : colors.mutedInk}
                />
              </View>

              {error ? (
                <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.accent }]}>
                  {error}
                </Text>
              ) : null}

              <Button
                label={mode === 'edit' ? 'Save changes' : 'Save treat'}
                onPress={() => void handleSave()}
                busy={saving}
                disabled={archiving}
              />

              {mode === 'edit' && treat ? (
                isArchived ? (
                  <Button
                    label="Restore treat"
                    variant="secondary"
                    onPress={() => void doRestore()}
                    busy={archiving}
                    disabled={saving}
                  />
                ) : (
                  <Button
                    label="Archive treat"
                    variant="ghost"
                    onPress={confirmArchive}
                    busy={archiving}
                    disabled={saving}
                  />
                )
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheetContainer: { width: '100%' },
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
  formContent: { paddingHorizontal: spacing.md, gap: spacing.md, paddingBottom: spacing.md },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET },
});
