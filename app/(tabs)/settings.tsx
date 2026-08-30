import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card, EmptyState } from '../../src/components';
import { useActivePet } from '../../src/features/pets/usePets';
import { spacing, typography, useTheme } from '../../src/theme';

/**
 * Scaffold placeholder.
 *
 * Still to build, per docs/ux-flows.md: pet management, the treat catalog,
 * optional daily budgets, reminders (requesting notification permission only
 * after a reminder is enabled), and export.
 */
export default function SettingsScreen() {
  const { colors } = useTheme();
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

      <EmptyState
        title="Settings are not built yet"
        body="Pets, treat catalog, budgets, reminders, and export come next."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
});
