import { getDatabase, eventsRepository, treatsRepository } from '../../db';
import { localDateOf } from '../../domain/dates';
import type { LocalDate, Treat, TreatEvent } from '../../domain/entities';
import { summarizeDay, type DaySummary } from '../../domain/totals';
import { useAsyncData } from '../../utils/useAsyncData';

export type TodayData = {
  localDate: LocalDate;
  events: TreatEvent[];
  summary: DaySummary;
  quickAdd: Treat[];
};

/** Everything the Today screen renders for one pet on one local calendar day. */
export function useTodayEvents(petId: string | null, viewedDate: LocalDate | null) {
  const localDate = viewedDate ?? localDateOf(new Date());

  return useAsyncData<TodayData | null>(async () => {
    if (!petId) return null;
    const db = await getDatabase();
    const [events, quickAdd] = await Promise.all([
      eventsRepository.listEventsForDate(db, petId, localDate),
      treatsRepository.listQuickAddTreats(db),
    ]);

    return { localDate, events, summary: summarizeDay(events, localDate), quickAdd };
  }, [petId, localDate]);
}
