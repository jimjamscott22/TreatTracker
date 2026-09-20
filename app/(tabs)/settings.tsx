import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Card, EmptyState } from '../../src/components';
import { getDatabase } from '../../src/db';
import { shareFullBackup } from '../../src/features/backup/transfer';
import { useActivePet } from '../../src/features/pets/usePets';
import { MIN_TOUCH_TARGET, spacing, typography, useTheme } from '../../src/theme';

/**
 * Scaffold placeholder.
 *
 * Still to build, per docs/ux-flows.md: pet management, optional daily
 * budgets and reminders (requesting notification permission only after a
 * reminder is enabled). The treat catalog and full-device backup are below.
 */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { pet } = useActivePet();
  const [sharing, setSharing] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  async function handleBackup() {
    setSharing(true);
    setBackupError(null);
    try {
      await shareFullBackup(await getDatabase());
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'The backup could not be created.');
    } finally {
      setSharing(false);
    }
  }

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

      <Card>
        <Text style={[typography.headline, { color: colors.ink }]}>Back up your records</Text>
        <Text style={[typography.body, { color: colors.mutedInk }]}>Save the full JSON backup to Files. Keep it until your standalone app has imported and verified every record.</Text>
        <Button label="Save backup to Files" onPress={handleBackup} busy={sharing} />
        {backupError ? <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.accent }]}>{backupError}</Text> : null}
      </Card>

      <EmptyState
        title="More settings are not built yet"
        body="Pet management, budgets, reminders, and filtered exports come next."
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
