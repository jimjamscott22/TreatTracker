import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { eventsRepository, petsRepository, treatsRepository } from '../../src/db';
import type { Pet, Treat, TreatEvent } from '../../src/domain/entities';
import { useUiStore } from '../../src/state/preferences';
import { ThemeProvider } from '../../src/theme';
import TodayScreen from '../(tabs)/index';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

// RNGH's real Swipeable relies on native gesture handlers that don't run in
// this unit-test harness (same reasoning as the KeyboardAvoidingView stub
// above). The stub still renders the row's right action so its "Delete"
// button is reachable, since the point under test is the delete-then-undo
// flow, not the swipe gesture itself.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react') as typeof import('react');
  return {
    Swipeable: React.forwardRef(
      (
        { children, renderRightActions }: {
          children: React.ReactNode;
          renderRightActions?: () => React.ReactNode;
        },
        ref: React.Ref<{ close: () => void }>,
      ) => {
        React.useImperativeHandle(ref, () => ({ close: () => {} }));
        return React.createElement(
          React.Fragment,
          null,
          children,
          renderRightActions ? renderRightActions() : null,
        );
      },
    ),
  };
});

jest.mock('../../src/db', () => {
  const actual = jest.requireActual('../../src/db');
  return {
    getDatabase: jest.fn().mockResolvedValue({}),
    eventsRepository: {
      ...actual.eventsRepository,
      listEventsForDate: jest.fn(),
      recordEvent: jest.fn(),
      softDeleteEvent: jest.fn().mockResolvedValue(undefined),
      restoreEvent: jest.fn().mockResolvedValue(undefined),
    },
    treatsRepository: { listQuickAddTreats: jest.fn() },
    petsRepository: { listPets: jest.fn() },
  };
});

const mockedEvents = eventsRepository as jest.Mocked<typeof eventsRepository>;
const mockedTreats = treatsRepository as jest.Mocked<typeof treatsRepository>;
const mockedPets = petsRepository as jest.Mocked<typeof petsRepository>;

const pet: Pet = {
  id: 'pet-1',
  name: 'Miso',
  species: 'dog',
  photoUri: null,
  birthDate: null,
  weightGrams: null,
  weightUnitPreference: 'kg',
  isActive: true,
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
  deletedAt: null,
};

const favoriteTreat: Treat = {
  id: 'treat-1',
  name: 'Duck strips',
  brand: null,
  category: 'training',
  defaultQuantityMilli: 1000,
  unit: 'piece',
  kcalPerUnitMilli: 20000,
  isFavorite: true,
  lastUsedAt: null,
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
  deletedAt: null,
};

function makeRecordedEvent(overrides: Partial<TreatEvent> = {}): TreatEvent {
  return {
    id: 'event-1',
    petId: pet.id,
    treatId: favoriteTreat.id,
    quantityMilli: favoriteTreat.defaultQuantityMilli,
    occurredAt: '2030-06-01T12:00:00.000Z',
    localDate: '2030-06-01',
    timezone: 'UTC',
    utcOffsetMinutes: 0,
    note: null,
    treatNameSnapshot: favoriteTreat.name,
    brandSnapshot: null,
    categorySnapshot: favoriteTreat.category,
    unitSnapshot: favoriteTreat.unit,
    kcalPerUnitMilliSnapshot: favoriteTreat.kcalPerUnitMilli,
    kcalTotalMilli: 20000,
    createdAt: '2030-06-01T12:00:00.000Z',
    updatedAt: '2030-06-01T12:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

/** Resolves only once the test calls it, so we can inspect the UI mid-flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function renderScreen() {
  await render(
    <ThemeProvider>
      <TodayScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useUiStore.setState({
    activePetId: null,
    viewedDate: null,
    insightsRangeDays: 7,
    addTreatSheetOpen: false,
  });
  mockedPets.listPets.mockResolvedValue([pet]);
  mockedTreats.listQuickAddTreats.mockResolvedValue([favoriteTreat]);
  mockedEvents.listEventsForDate.mockResolvedValue([]);
});

describe('TodayScreen quick add', () => {
  it('shows the entry and updated total the instant a quick-add tile is pressed', async () => {
    const { promise, resolve } = deferred<TreatEvent>();
    mockedEvents.recordEvent.mockReturnValue(promise);

    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Add Duck strips for Miso'));

    // Optimistic: the write hasn't resolved yet, but the UI already reflects
    // it -- the Entries section (and its count) render before the mocked
    // write settles.
    expect(await screen.findByText('Entries')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();

    await act(async () => {
      resolve(makeRecordedEvent());
      await promise;
    });

    await waitFor(() => expect(screen.getByText('Undo last entry')).toBeTruthy());
    // Let the refresh() triggered after recording settle before the test ends.
    await waitFor(() => expect(mockedEvents.listEventsForDate).toHaveBeenCalledTimes(2));
  });

  it('rolls the optimistic entry back if recording fails', async () => {
    let reject!: (error: unknown) => void;
    const rejecting = new Promise<TreatEvent>((_resolve, r) => {
      reject = r;
    });
    mockedEvents.recordEvent.mockReturnValue(rejecting);

    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Add Duck strips for Miso'));
    expect(await screen.findByText('Entries')).toBeTruthy();

    await act(async () => {
      reject(new Error('write failed'));
      await rejecting.catch(() => {});
    });

    await waitFor(() => expect(screen.queryByText('Entries')).toBeNull());
  });
});

describe('TodayScreen swipe-to-delete', () => {
  it('confirms, soft-deletes, and offers an undo that restores the entry', async () => {
    const recorded = makeRecordedEvent();
    mockedEvents.listEventsForDate.mockResolvedValue([recorded]);

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });

    await renderScreen();

    const expectedTime = new Date(recorded.occurredAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    await fireEvent.press(
      await screen.findByLabelText(`Delete entry: ${recorded.treatNameSnapshot} at ${expectedTime}`),
    );

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockedEvents.softDeleteEvent).toHaveBeenCalledWith({}, recorded.id));
    await waitFor(() => expect(screen.getByText('Undo')).toBeTruthy());
    // Let the refresh() triggered after the delete settle before continuing.
    await waitFor(() => expect(mockedEvents.listEventsForDate).toHaveBeenCalledTimes(2));

    mockedEvents.listEventsForDate.mockResolvedValue([]);
    await fireEvent.press(screen.getByText('Undo'));

    await waitFor(() => expect(mockedEvents.restoreEvent).toHaveBeenCalledWith({}, recorded.id));
    // Let the refresh() triggered after the restore settle before the test ends.
    await waitFor(() => expect(mockedEvents.listEventsForDate).toHaveBeenCalledTimes(3));
  });
});
