import { create } from 'zustand';

import type { LocalDate } from '../domain/entities';

/**
 * Transient UI state only.
 *
 * AGENTS.md and docs/architecture.md both forbid duplicating durable records
 * here: SQLite stays the source of truth, and this store holds just the
 * selections that describe what the user is currently looking at.
 */
type UiState = {
  activePetId: string | null;
  /** Date the Today screen is showing; null means "follow the real today". */
  viewedDate: LocalDate | null;
  insightsRangeDays: 7 | 30;
  setActivePet: (petId: string | null) => void;
  setViewedDate: (date: LocalDate | null) => void;
  setInsightsRange: (days: 7 | 30) => void;
};

export const useUiStore = create<UiState>((set) => ({
  activePetId: null,
  viewedDate: null,
  insightsRangeDays: 7,
  setActivePet: (activePetId) => set({ activePetId }),
  setViewedDate: (viewedDate) => set({ viewedDate }),
  setInsightsRange: (insightsRangeDays) => set({ insightsRangeDays }),
}));
