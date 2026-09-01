import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { treatsRepository } from '../../src/db';
import type { Treat } from '../../src/domain/entities';
import { ThemeProvider } from '../../src/theme';
import TreatCatalogScreen from '../treats';

jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../src/db', () => ({
  getDatabase: jest.fn().mockResolvedValue({}),
  treatsRepository: {
    listCatalogTreats: jest.fn(),
    setTreatFavorite: jest.fn().mockResolvedValue(undefined),
    createTreat: jest.fn(),
    updateTreat: jest.fn(),
    archiveTreat: jest.fn(),
    restoreTreat: jest.fn(),
    getTreat: jest.fn(),
  },
}));

const mockedTreats = treatsRepository as jest.Mocked<typeof treatsRepository>;

const activeTreats: Treat[] = [
  {
    id: 'treat-1',
    name: 'Duck strips',
    brand: null,
    category: 'training',
    defaultQuantityMilli: 1000,
    unit: 'piece',
    kcalPerUnitMilli: 20000,
    isFavorite: false,
    lastUsedAt: null,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',
    deletedAt: null,
  },
];

const archivedTreats: Treat[] = [
  { ...activeTreats[0]!, id: 'treat-2', name: 'Old biscuit', deletedAt: '2030-01-02T00:00:00.000Z' },
];

async function renderScreen() {
  await render(
    <ThemeProvider>
      <TreatCatalogScreen />
    </ThemeProvider>,
  );
}

describe('TreatCatalogScreen', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedTreats.listCatalogTreats.mockImplementation(async (_db, options) =>
      options?.includeArchived ? archivedTreats : activeTreats,
    );
  });

  it('shows an empty state when the active catalog has no treats', async () => {
    mockedTreats.listCatalogTreats.mockResolvedValue([]);
    await renderScreen();

    expect(await screen.findByText('No treats yet')).toBeTruthy();
  });

  it('lists active treats with their category, quantity, and calories', async () => {
    await renderScreen();

    expect(await screen.findByText('Duck strips')).toBeTruthy();
    expect(screen.getByText('Training · 1 piece · 20 kcal')).toBeTruthy();
  });

  it('toggles favorite from the list without opening the edit form', async () => {
    await renderScreen();
    await screen.findByText('Duck strips');

    await fireEvent.press(screen.getByLabelText('Add Duck strips to favorites'));

    await waitFor(() => {
      expect(mockedTreats.setTreatFavorite).toHaveBeenCalledWith({}, 'treat-1', true);
    });
  });

  it('switches to the archived filter and shows archived-specific copy', async () => {
    await renderScreen();
    await screen.findByText('Duck strips');

    await fireEvent.press(screen.getByText('Archived'));

    expect(await screen.findByText('Old biscuit')).toBeTruthy();
    expect(screen.queryByLabelText('Add Old biscuit to favorites')).toBeNull();

    await waitFor(() => {
      expect(mockedTreats.listCatalogTreats).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ includeArchived: true }),
      );
    });
  });

  it('opens the create form from "New treat"', async () => {
    await renderScreen();
    await screen.findByText('Duck strips');

    await fireEvent.press(screen.getByText('New treat'));

    expect(await screen.findByText('Save treat')).toBeTruthy();
  });

  it('opens the edit form pre-filled when a treat row is pressed', async () => {
    await renderScreen();
    await screen.findByText('Duck strips');

    await fireEvent.press(screen.getByLabelText('Edit Duck strips'));

    expect(await screen.findByText('Save changes')).toBeTruthy();
    expect(screen.getByDisplayValue('Duck strips')).toBeTruthy();
  });
});
