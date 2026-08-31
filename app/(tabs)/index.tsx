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
import { eventsRepository, getDatabase } from '../../src/db';
import type { Treat, TreatEvent } from '../../src/domain/entities';
import { formatKcal, formatQuantity } from '../../src/domain/units';
import { useTodayEvents } from '../../src/features/entries/useTodayEvents';
import { useActivePet } from '../../src/features/pets/usePets';
import { useUiStore } from '../../src/state/preferences';
import {
  MIN_TOUCH_TARGET,
  radii,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
} from '../../src/theme';

export default function TodayScreen() {
  const { colors } = useTheme();
  const { pet, loading: petLoading } = useActivePet();
  const viewedDate = useUiStore((state) => state.viewedDate);
  const { data, loading, refresh } = useTodayEvents(pet?.id ?? null, viewedDate);

  const [lastEventId, setLastEventId] = useState<string | null>(null);

  async function quickAdd(treat: Treat) {
    if (!pet) return;
    const db = await getDatabase();
    const event = await eventsRepository.recordEvent(
      db,
      eventsRepository.draftFromTreat({ petId: pet.id, treat }),
    );

    setLastEventId(event.id);
    refresh();
    // Announce the commit, as required for assistive technology.
    AccessibilityInfo.announceForAccessibility(`Recorded ${treat.name} for ${pet.name}`);
  }

  async function undoLast() {
    if (!lastEventId) return;
    await eventsRepository.softDeleteEvent(await getDatabase(), lastEventId);
    setLastEventId(null);
    refresh();
    AccessibilityInfo.announceForAccessibility('Entry removed');
  }

  if (petLoading || (loading && !data)) return <LoadingState />;

  if (!pet) {
    return (
      <EmptyState
        title="No pet yet"
        body="Add a pet to start recording treats."
      />
    );
  }

  const summary = data?.summary;
  const events = data?.events ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.content}
    >
      {/* Pet context stays visible so it is never ambiguous who a treat is for. */}
      <View style={styles.petRow}>
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[typography.headline, { color: colors.ink }]}>
            {pet.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.petText}>
          <Text style={[typography.largeTitle, { color: colors.ink }]}>{pet.name}</Text>
          <Text style={[typography.caption, { color: colors.mutedInk }]}>
            {pet.species === 'dog' ? 'Dog' : 'Cat'} · {data?.localDate ?? ''}
          </Text>
        </View>
      </View>

      <Card>
        <Text style={[typography.caption, { color: colors.mutedInk }]}>Today</Text>
        <Text style={[typography.largeTitle, tabularNumbers, { color: colors.ink }]}>
          {summary?.eventCount ?? 0}
        </Text>
        <Text style={[typography.body, { color: colors.mutedInk }]}>
          {summary?.eventCount === 1 ? 'treat recorded' : 'treats recorded'}
        </Text>

        <Text style={[typography.body, tabularNumbers, { color: colors.ink }]}>
          Known calories: {formatKcal(summary?.knownKcalMilli ?? 0)}
        </Text>

        {/* Unknown values are disclosed rather than silently counted as zero. */}
        {summary && summary.unknownKcalEventCount > 0 ? (
          <Text style={[typography.caption, { color: colors.mutedInk }]}>
            Calories unknown for {summary.unknownKcalEventCount}{' '}
            {summary.unknownKcalEventCount === 1 ? 'entry' : 'entries'}
          </Text>
        ) : null}

        {/* Budget progress renders only once a goal exists; it is optional by design. */}
        <ProgressBar
          fraction={0}
          accessibilityLabel="No daily budget set"
        />
        <Text style={[typography.caption, { color: colors.mutedInk }]}>
          No daily budget set.
        </Text>
      </Card>

      {data && data.quickAdd.length > 0 ? (
        <View style={styles.section}>
          <Text style={[typography.title2, { color: colors.ink }]}>Quick add</Text>
          <View style={styles.quickAddGrid}>
            {data.quickAdd.map((treat) => (
              <Pressable
                key={treat.id}
                accessibilityRole="button"
                accessibilityLabel={`Add ${treat.name} for ${pet.name}`}
                accessibilityHint={`Records ${formatQuantity(treat.defaultQuantityMilli)} ${treat.unit}`}
                onPress={() => void quickAdd(treat)}
                style={({ pressed }) => [
                  styles.quickAddTile,
                  {
                    backgroundColor: colors.surface,
                    borderColor: treat.isFavorite ? colors.accent : colors.line,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[typography.headline, { color: colors.ink }]} numberOfLines={2}>
                  {treat.name}
                </Text>
                <Text style={[typography.caption, tabularNumbers, { color: colors.mutedInk }]}>
                  {formatQuantity(treat.defaultQuantityMilli)} {treat.unit}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {lastEventId ? (
        <Button label="Undo last entry" variant="secondary" onPress={() => void undoLast()} />
      ) : null}

      <View style={styles.section}>
        <Text style={[typography.title2, { color: colors.ink }]}>Entries</Text>
        {events.length === 0 ? (
          <EmptyState
            title="No treats recorded today"
            body="Quick add a favorite, or add a treat to get started."
          />
        ) : (
          events.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </View>
    </ScrollView>
  );
}

function EventRow({ event }: { event: TreatEvent }) {
  const { colors } = useTheme();
  const time = new Date(event.occurredAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={[styles.eventRow, { borderBottomColor: colors.line }]}>
      <Text style={[typography.caption, tabularNumbers, styles.eventTime, { color: colors.mutedInk }]}>
        {time}
      </Text>
      <View style={styles.eventBody}>
        {/* Snapshot name, so a renamed or archived treat still reads correctly. */}
        <Text style={[typography.body, { color: colors.ink }]}>{event.treatNameSnapshot}</Text>
        <Text style={[typography.caption, tabularNumbers, { color: colors.mutedInk }]}>
          {formatQuantity(event.quantityMilli)} {event.unitSnapshot} ·{' '}
          {formatKcal(event.kcalTotalMilli)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petText: { flex: 1 },
  section: { gap: spacing.sm },
  quickAddGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  quickAddTile: {
    minWidth: 140,
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    borderRadius: radii.quickAdd,
    borderWidth: 1,
    padding: spacing.sm,
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventTime: { minWidth: 64, paddingTop: 2 },
  eventBody: { flex: 1, gap: spacing.xxs },
});
