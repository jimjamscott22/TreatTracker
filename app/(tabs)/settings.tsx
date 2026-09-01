import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Card, EmptyState } from '../../src/components';
import { useActivePet } from '../../src/features/pets/usePets';
import { MIN_TOUCH_TARGET, spacing, typography, useTheme } from '../../src/theme';

/**
 * Scaffold placeholder.
 *
 * Still to build, per docs/ux-flows.md: pet management, optional daily
 * budgets, reminders (requesting notification permission only after a
 * reminder is enabled), and export. The treat catalog is built below.
 */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { pet } = useActivePet();

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      {pet ? (
        <Card>
          <Text style={[typography.caption, { color: colors.mutedInk }]}>Current pet</Text>
          <Text style={[typography.title2, { color: colors.ink }]}>{pet.name}</Text>
          <Text style={[typography.caption, { color: colors.mutedInk }]}>
            {pet.species === 'dog' ? 'Dog' : 'Cat'}
          </Text>
        </Card>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Treat catalog"
        accessibilityHint="Create, edit, favorite, and archive treats"
        onPress={() => router.push('/treats')}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[typography.headline, { color: colors.ink }]}>Treat catalog</Text>
        <Text style={[typography.caption, { color: colors.mutedInk }]}>
          Create, edit, favorite, and archive treats
        </Text>
      </Pressable>

      <EmptyState
        title="More settings are not built yet"
        body="Pet management, budgets, reminders, and export come next."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xxs,
    justifyContent: 'center',
  },
});
