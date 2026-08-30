import { ScrollView, StyleSheet } from 'react-native';

import { EmptyState } from '../../src/components';
import { spacing, useTheme } from '../../src/theme';

/**
 * Scaffold placeholder.
 *
 * docs/ux-flows.md ("Browse history") specifies a calendar/list hybrid of daily
 * totals, a per-date event list, and filters by treat, category, and unknown
 * calories -- explicitly not an unstructured infinite feed. The repository query
 * this needs, `eventsRepository.listEventsInRange`, already exists.
 */
export default function HistoryScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      <EmptyState
        title="History is not built yet"
        body="Daily totals, per-day entries, and filters are the next step here."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, flexGrow: 1, justifyContent: 'center' },
});
