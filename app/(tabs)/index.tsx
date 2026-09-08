import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import {
  AddTreatSheet,
  Button,
  Card,
  EmptyState,
  Fab,
  LoadingState,
  ProgressBar,
  QuickAddTile,
} from '../../src/components';
import { eventsRepository, getDatabase } from '../../src/db';
import type { Treat, TreatEvent } from '../../src/domain/entities';
import { summarizeDay } from '../../src/domain/totals';
import { eventKcalMilli, formatKcal, formatQuantity } from '../../src/domain/units';
import { useTodayEvents } from '../../src/features/entries/useTodayEvents';
import { useActivePet } from '../../src/features/pets/usePets';
import { useUiStore } from '../../src/state/preferences';
import {
  MIN_TOUCH_TARGET,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
} from '../../src/theme';
import { newId } from '../../src/utils/ids';

/** An undo affordance can reverse either side of a soft-delete. */
type PendingUndo = {
  eventId: string;
  /** What pressing Undo does: delete an entry just added, or restore one just removed. */
  action: 'delete' | 'restore';
};

export default function TodayScreen() {
  const { colors } = useTheme();
  const { pet, loading: petLoading } = useActivePet();
  const viewedDate = useUiStore((state) => state.viewedDate);
  const addTreatVisible = useUiStore((state) => state.addTreatSheetOpen);
  const openAddTreat = useUiStore((state) => state.openAddTreatSheet);
  const closeAddTreat = useUiStore((state) => state.closeAddTreatSheet);
  const { data, loading, refresh } = useTodayEvents(pet?.id ?? null, viewedDate);

  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  // Shown the instant a quick-add is tapped, before the write reaches SQLite,
  // so recording never waits on a round trip (app convention audit: "speed
  // perception"). Cleared once the real fetched data contains the same event.
  const [optimisticEvents, setOptimisticEvents] = useState<TreatEvent[]>([]);

  useEffect(() => {
    if (optimisticEvents.length === 0 || !data) return;
    setOptimisticEvents((prev) =>
      prev.filter(
        (optimistic) =>
          !data.events.some(
            (event) =>
              event.treatId === optimistic.treatId && event.occurredAt === optimistic.occurredAt,
          ),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function quickAdd(treat: Treat) {
    if (!pet) return;

    const draft = eventsRepository.draftFromTreat({ petId: pet.id, treat });
    const optimisticEvent: TreatEvent = {
      id: `optimistic-${newId()}`,
      petId: draft.petId,
      treatId: draft.treatId,
      quantityMilli: draft.quantityMilli,
      occurredAt: draft.occurredAt,
      localDate: draft.localDate,
      timezone: draft.timezone,
      utcOffsetMinutes: draft.utcOffsetMinutes,
      note: draft.note,
      treatNameSnapshot: draft.treatNameSnapshot,
      brandSnapshot: draft.brandSnapshot,
      categorySnapshot: draft.categorySnapshot,
      unitSnapshot: draft.unitSnapshot,
      kcalPerUnitMilliSnapshot: draft.kcalPerUnitMilliSnapshot,
      kcalTotalMilli: eventKcalMilli(draft.quantityMilli, draft.kcalPerUnitMilliSnapshot),
      createdAt: draft.occurredAt,
      updatedAt: draft.occurredAt,
      deletedAt: null,
    };

    setOptimisticEvents((prev) => [...prev, optimisticEvent]);
    AccessibilityInfo.announceForAccessibility(`Recorded ${treat.name} for ${pet.name}`);

    try {
      const db = await getDatabase();
      const event = await eventsRepository.recordEvent(db, draft);
      setPendingUndo({ eventId: event.id, action: 'delete' });
      refresh();
    } catch {
      setOptimisticEvents((prev) => prev.filter((e) => e.id !== optimisticEvent.id));
      AccessibilityInfo.announceForAccessibility(`Could not record ${treat.name}. Try again.`);
    }
  }

  function handleRecorded(eventId: string) {
    setPendingUndo({ eventId, action: 'delete' });
    refresh();
  }

  async function handleSwipeDelete(event: TreatEvent) {
    await eventsRepository.softDeleteEvent(await getDatabase(), event.id);
    setPendingUndo({ eventId: event.id, action: 'restore' });
    refresh();
    AccessibilityInfo.announceForAccessibility('Entry removed');
  }

  async function handleUndo() {
    if (!pendingUndo) return;
    const db = await getDatabase();
    if (pendingUndo.action === 'delete') {
      await eventsRepository.softDeleteEvent(db, pendingUndo.eventId);
      AccessibilityInfo.announceForAccessibility('Entry removed');
    } else {
      await eventsRepository.restoreEvent(db, pendingUndo.eventId);
      AccessibilityInfo.announceForAccessibility('Entry restored');
    }
    setPendingUndo(null);
    refresh();
  }

  const sheet = pet ? (
    <AddTreatSheet
      visible={addTreatVisible}
      petId={pet.id}
      petName={pet.name}
      onClose={closeAddTreat}
      onRecorded={handleRecorded}
    />
  ) : null;

  if (!pet) {
    return (
      <>
        {petLoading ? (
          <LoadingState />
        ) : (
          <EmptyState
            title="No pet yet"
            body="Add a pet to start recording treats."
          />
        )}
        {sheet}
      </>
    );
  }

  if (loading && !data) {
    return (
      <>
        <LoadingState />
        {sheet}
      </>
    );
  }

  const events = data
    ? [...data.events, ...optimisticEvents.filter((event) => event.localDate === data.localDate)]
    : [];
  const summary = data ? summarizeDay(events, data.localDate) : undefined;

  return (
    <>
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

        {events.length === 0 ? (
          <EmptyState
            title="No treats recorded today"
            body="Quick add a favorite, or add a treat to get started."
            actionLabel="Add a treat"
            onAction={openAddTreat}
          />
        ) : null}

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

          {summary && summary.unknownKcalEventCount > 0 ? (
            <Text style={[typography.caption, { color: colors.mutedInk }]}>
              Calories unknown for {summary.unknownKcalEventCount}{' '}
              {summary.unknownKcalEventCount === 1 ? 'entry' : 'entries'}
            </Text>
          ) : null}

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
                <QuickAddTile
                  key={treat.id}
                  treat={treat}
                  accessibilityLabel={`Add ${treat.name} for ${pet.name}`}
                  accessibilityHint={`Records ${formatQuantity(treat.defaultQuantityMilli)} ${treat.unit}`}
                  onPress={() => void quickAdd(treat)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {pendingUndo ? (
          <Button
            label={pendingUndo.action === 'delete' ? 'Undo last entry' : 'Undo'}
            variant="secondary"
            onPress={() => void handleUndo()}
          />
        ) : null}

        {events.length > 0 ? (
          <View style={styles.section}>
            <Text style={[typography.title2, { color: colors.ink }]}>Entries</Text>
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                petName={pet.name}
                onDelete={() => void handleSwipeDelete(event)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Fab
        onPress={openAddTreat}
        accessibilityLabel="Add a treat"
        accessibilityHint={`Records a treat for ${pet.name}`}
      />

      {sheet}
    </>
  );
}

function EventRow({
  event,
  petName,
  onDelete,
}: {
  event: TreatEvent;
  petName: string;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const time = new Date(event.occurredAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  function confirmDelete() {
    // docs/ux-flows.md: "Delete requires confirmation describing the affected
    // pet and time."
    Alert.alert(
      'Delete this entry?',
      `${event.treatNameSnapshot} for ${petName} at ${time}. This can be undone right after.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeableRef.current?.close() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            swipeableRef.current?.close();
            onDelete();
          },
        },
      ],
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete entry: ${event.treatNameSnapshot} at ${time}`}
          onPress={confirmDelete}
          style={[styles.deleteAction, { backgroundColor: colors.accent }]}
        >
          <Text style={[typography.headline, { color: colors.surface }]}>Delete</Text>
        </Pressable>
      )}
    >
      <View style={[styles.eventRow, { backgroundColor: colors.canvas, borderBottomColor: colors.line }]}>
        <Text style={[typography.caption, tabularNumbers, styles.eventTime, { color: colors.mutedInk }]}>
          {time}
        </Text>
        <View style={styles.eventBody}>
          <Text style={[typography.body, { color: colors.ink }]}>{event.treatNameSnapshot}</Text>
          <Text style={[typography.caption, tabularNumbers, { color: colors.mutedInk }]}>
            {formatQuantity(event.quantityMilli)} {event.unitSnapshot} ·{' '}
            {formatKcal(event.kcalTotalMilli)}
          </Text>
        </View>
      </View>
    </Swipeable>
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
  eventRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventTime: { minWidth: 64, paddingTop: 2 },
  eventBody: { flex: 1, gap: spacing.xxs },
  deleteAction: {
    minWidth: MIN_TOUCH_TARGET + spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
