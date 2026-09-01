import { useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, EmptyState, LoadingState, TreatFormSheet } from '../src/components';
import { getDatabase, treatsRepository } from '../src/db';
import { treatCategoryLabels, type Treat } from '../src/domain/entities';
import { formatKcal, formatQuantity } from '../src/domain/units';
import { useTreatCatalog } from '../src/features/treats/useTreatCatalog';
import { MIN_TOUCH_TARGET, spacing, tabularNumbers, typography, useTheme } from '../src/theme';

type Filter = 'active' | 'archived';

/**
 * Treat Catalog management screen (docs/product-spec.md, "Treat catalog";
 * docs/ux-flows.md notes it is reached through Settings).
 *
 * This is separate from `AddTreatSheet`'s inline "create while recording"
 * flow: this screen is where a caregiver browses, edits, favorites, and
 * archives the whole catalog independent of any single entry.
 */
export default function TreatCatalogScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const { treats, loading, refresh } = useTreatCatalog(query, filter === 'archived');

  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedTreat, setSelectedTreat] = useState<Treat | null>(null);

  function openCreate() {
    setFormMode('create');
    setSelectedTreat(null);
    setFormVisible(true);
  }

  function openEdit(treat: Treat) {
    setFormMode('edit');
    setSelectedTreat(treat);
    setFormVisible(true);
  }

  function closeForm() {
    setFormVisible(false);
  }

  async function toggleFavorite(treat: Treat) {
    const db = await getDatabase();
    await treatsRepository.setTreatFavorite(db, treat.id, !treat.isFavorite);
    AccessibilityInfo.announceForAccessibility(
      treat.isFavorite ? `Removed ${treat.name} from favorites` : `Added ${treat.name} to favorites`,
    );
    refresh();
  }

  const trimmedQuery = query.trim();
  const emptyTitle =
    trimmedQuery.length > 0
      ? `No matches for "${trimmedQuery}"`
      : filter === 'archived'
        ? 'No archived treats'
        : 'No treats yet';
  const emptyBody =
    filter === 'archived'
      ? 'Treats you archive appear here so you can restore them later.'
      : 'Create a treat to make it searchable and quick-addable from Today.';

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.canvas }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search treats"
          placeholderTextColor={colors.mutedInk}
          accessibilityLabel="Search treats"
          style={[
            styles.input,
            typography.body,
            { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        />

        <View style={styles.filterRow} accessibilityRole="tablist">
          {(
            [
              { key: 'active' as const, label: 'Active' },
              { key: 'archived' as const, label: 'Archived' },
            ]
          ).map((option) => {
            const selected = filter === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                    borderColor: selected ? colors.accent : colors.line,
                  },
                ]}
              >
                <Text style={[typography.headline, { color: colors.ink }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button label="New treat" onPress={openCreate} />

        {loading && treats.length === 0 ? <LoadingState /> : null}

        {!loading && treats.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : null}

        <View style={styles.list}>
          {treats.map((treat) => (
            <TreatRow
              key={treat.id}
              treat={treat}
              archived={filter === 'archived'}
              onPress={() => openEdit(treat)}
              onToggleFavorite={() => void toggleFavorite(treat)}
            />
          ))}
        </View>
      </ScrollView>

      <TreatFormSheet
        visible={formVisible}
        mode={formMode}
        treat={selectedTreat}
        onClose={closeForm}
        onSaved={refresh}
        onArchived={refresh}
        onRestored={refresh}
      />
    </>
  );
}

function TreatRow({
  treat,
  archived,
  onPress,
  onToggleFavorite,
}: {
  treat: Treat;
  archived: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${treat.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.rowBody, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[typography.headline, { color: colors.ink }]}>{treat.name}</Text>
        <Text style={[typography.caption, tabularNumbers, { color: colors.mutedInk }]}>
          {treatCategoryLabels[treat.category]} · {formatQuantity(treat.defaultQuantityMilli)}{' '}
          {treat.unit} · {formatKcal(treat.kcalPerUnitMilli)}
        </Text>
      </Pressable>

      {archived ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: treat.isFavorite }}
          accessibilityLabel={
            treat.isFavorite ? `Remove ${treat.name} from favorites` : `Add ${treat.name} to favorites`
          }
          onPress={onToggleFavorite}
          hitSlop={spacing.xs}
          style={styles.favoriteButton}
        >
          <Text style={[typography.title2, { color: treat.isFavorite ? colors.accent : colors.mutedInk }]}>
            {treat.isFavorite ? '★' : '☆'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterChip: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  favoriteButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
