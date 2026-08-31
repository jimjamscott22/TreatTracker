import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState } from '../../src/components';
import { eventsRepository, getDatabase } from '../../src/db';
import { formatRangeLabel, localDateOf, previousRange, rangeEndingOn } from '../../src/domain/dates';
import { summarizeRange } from '../../src/domain/totals';
import { compareRanges, dataCompleteness, rankTreats } from '../../src/domain/trends';
import { formatKcal } from '../../src/domain/units';
import { useActivePet } from '../../src/features/pets/usePets';
import { useUiStore } from '../../src/state/preferences';
import { useAsyncData } from '../../src/utils/useAsyncData';
import {
  MIN_TOUCH_TARGET,
  radii,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
} from '../../src/theme';

/**
 * Insights over the 7- and 30-day ranges.
 *
 * Every card states the exact dates it covers, and zero-event days are included
 * in the averages, per docs/ux-flows.md. Charts are still to come; the textual
 * summaries below are the accessible equivalents they must keep.
 */
export default function InsightsScreen() {
  const { colors } = useTheme();
  const { pet } = useActivePet();
  const rangeDays = useUiStore((state) => state.insightsRangeDays);
  const setRange = useUiStore((state) => state.setInsightsRange);

  const { data, loading } = useAsyncData(async () => {
    if (!pet) return null;

    const current = rangeEndingOn(localDateOf(new Date()), rangeDays);
    const prior = previousRange(current);
    const db = await getDatabase();

    const [currentEvents, priorEvents] = await Promise.all([
      eventsRepository.listEventsInRange(db, pet.id, current.start, current.end),
      eventsRepository.listEventsInRange(db, pet.id, prior.start, prior.end),
    ]);

    const currentSummary = summarizeRange(currentEvents, current.dates);
    const priorSummary = summarizeRange(priorEvents, prior.dates);

    return {
      current,
      prior,
      currentSummary,
      comparison: compareRanges(currentSummary, priorSummary),
      topTreats: rankTreats(currentEvents).slice(0, 5),
      completeness: dataCompleteness(currentEvents),
    };
  }, [pet?.id, rangeDays]);

  if (!pet) return <EmptyState title="No pet yet" body="Add a pet to see insights." />;

  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.segmented} accessibilityRole="tablist">
        {([7, 30] as const).map((days) => {
          const selected = rangeDays === days;
          return (
            <Pressable
              key={days}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setRange(days)}
              style={[
                styles.segment,
                {
                  backgroundColor: selected ? colors.accentSoft : colors.surface,
                  borderColor: selected ? colors.accent : colors.line,
                },
              ]}
            >
              <Text style={[typography.headline, { color: colors.ink }]}>{days} days</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !data || data.currentSummary.eventCount === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          body={data ? `No entries for ${formatRangeLabel(data.current)}.` : undefined}
        />
      ) : (
        <>
          <Card>
            <Text style={[typography.caption, { color: colors.mutedInk }]}>
              {formatRangeLabel(data.current)}
            </Text>
            <Text style={[typography.largeTitle, tabularNumbers, { color: colors.ink }]}>
              {data.currentSummary.eventCount}
            </Text>
            <Text style={[typography.body, { color: colors.mutedInk }]}>treats recorded</Text>
            <Text style={[typography.body, tabularNumbers, { color: colors.ink }]}>
              {data.currentSummary.averageEventsPerDay.toFixed(1)} per day on average
            </Text>
            <Text style={[typography.caption, { color: colors.mutedInk }]}>
              Includes days with no entries.
            </Text>
          </Card>

          <Card>
            <Text style={[typography.headline, { color: colors.ink }]}>
              Compared with {formatRangeLabel(data.prior)}
            </Text>
            <Text style={[typography.body, tabularNumbers, { color: colors.ink }]}>
              {formatDelta(data.comparison.eventCount.absolute)} treats
            </Text>
            <Text style={[typography.body, tabularNumbers, { color: colors.ink }]}>
              Known calories: {formatKcal(data.currentSummary.knownKcalMilli)}
            </Text>
            {data.comparison.comparisonAffectedByUnknownCalories ? (
              <Text style={[typography.caption, { color: colors.mutedInk }]}>
                Some entries have no calorie estimate, so calorie totals are partial.
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text style={[typography.headline, { color: colors.ink }]}>Top treats</Text>
            {data.topTreats.map((treat) => (
              <Text
                key={`${treat.treatId ?? treat.name}`}
                style={[typography.body, tabularNumbers, { color: colors.ink }]}
              >
                {treat.name} · {treat.eventCount}
              </Text>
            ))}
          </Card>

          <Card>
            <Text style={[typography.headline, { color: colors.ink }]}>Data completeness</Text>
            <Text style={[typography.body, tabularNumbers, { color: colors.mutedInk }]}>
              {data.completeness.eventsWithKnownCalories} of {data.completeness.totalEvents}{' '}
              entries have a calorie estimate.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

/** Neutral phrasing: a change is reported, never praised or warned about. */
function formatDelta(absolute: number): string {
  if (absolute === 0) return 'No change in';
  return absolute > 0 ? `${absolute} more` : `${Math.abs(absolute)} fewer`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
  segmented: { flexDirection: 'row', gap: spacing.xs },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
