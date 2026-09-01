import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { treatsRepository } from '../../db';
import type { Treat } from '../../domain/entities';
import { ThemeProvider } from '../../theme';
import { TreatFormSheet } from '../TreatFormSheet';

jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../db', () => ({
  getDatabase: jest.fn().mockResolvedValue({}),
  treatsRepository: {
    createTreat: jest.fn(),
    updateTreat: jest.fn(),
    archiveTreat: jest.fn(),
    restoreTreat: jest.fn(),
    getTreat: jest.fn(),
  },
}));

const mockedTreats = treatsRepository as jest.Mocked<typeof treatsRepository>;

const activeTreat: Treat = {
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
};

const archivedTreat: Treat = { ...activeTreat, id: 'treat-2', name: 'Old biscuit', deletedAt: '2030-01-02T00:00:00.000Z' };

describe('TreatFormSheet', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new catalog treat with the entered fields', async () => {
    mockedTreats.createTreat.mockResolvedValue({ ...activeTreat, id: 'treat-new', name: 'Salmon jerky' });
    const onSaved = jest.fn();
    const onClose = jest.fn();

    await render(
      <ThemeProvider>
        <TreatFormSheet
          visible
          mode="create"
          treat={null}
          onClose={onClose}
          onSaved={onSaved}
        />
      </ThemeProvider>,
    );

    await fireEvent.changeText(screen.getByLabelText('Treat name'), 'Salmon jerky');
    await fireEvent.press(screen.getByText('Save treat'));

    await waitFor(() => {
      expect(mockedTreats.createTreat).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ name: 'Salmon jerky', defaultQuantityMilli: 1000, unit: 'piece' }),
      );
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Salmon jerky' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects a zero quantity without calling the repository', async () => {
    const onSaved = jest.fn();

    await render(
      <ThemeProvider>
        <TreatFormSheet visible mode="create" treat={null} onClose={jest.fn()} onSaved={onSaved} />
      </ThemeProvider>,
    );

    await fireEvent.changeText(screen.getByLabelText('Treat name'), 'Salmon jerky');
    await fireEvent.changeText(screen.getByLabelText('Default quantity'), '0');
    await fireEvent.press(screen.getByText('Save treat'));

    expect(await screen.findByText('Quantity must be more than zero')).toBeTruthy();
    expect(mockedTreats.createTreat).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('pre-fills the form and saves edits without creating a new treat', async () => {
    mockedTreats.updateTreat.mockResolvedValue({ ...activeTreat, name: 'Duck strips (large)' });
    const onSaved = jest.fn();

    await render(
      <ThemeProvider>
        <TreatFormSheet
          visible
          mode="edit"
          treat={activeTreat}
          onClose={jest.fn()}
          onSaved={onSaved}
        />
      </ThemeProvider>,
    );

    expect(screen.getByDisplayValue('Duck strips')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Treat name'), 'Duck strips (large)');
    await fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => {
      expect(mockedTreats.updateTreat).toHaveBeenCalledWith(
        {},
        'treat-1',
        expect.objectContaining({ name: 'Duck strips (large)' }),
      );
    });
    expect(mockedTreats.createTreat).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Duck strips (large)' }));
  });

  it('archives the treat after the user confirms the destructive prompt', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const archiveButton = buttons?.find((b) => b.text === 'Archive');
      archiveButton?.onPress?.();
    });
    mockedTreats.archiveTreat.mockResolvedValue(undefined);
    const onArchived = jest.fn();
    const onClose = jest.fn();

    await render(
      <ThemeProvider>
        <TreatFormSheet
          visible
          mode="edit"
          treat={activeTreat}
          onClose={onClose}
          onSaved={jest.fn()}
          onArchived={onArchived}
        />
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByText('Archive treat'));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockedTreats.archiveTreat).toHaveBeenCalledWith({}, 'treat-1');
    });
    expect(onArchived).toHaveBeenCalledWith('treat-1');
    expect(onClose).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('does not archive when the user cancels the confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancelButton = buttons?.find((b) => b.text === 'Cancel');
      cancelButton?.onPress?.();
    });

    await render(
      <ThemeProvider>
        <TreatFormSheet visible mode="edit" treat={activeTreat} onClose={jest.fn()} onSaved={jest.fn()} />
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByText('Archive treat'));

    expect(mockedTreats.archiveTreat).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('offers to restore an archived treat instead of archiving it again', async () => {
    mockedTreats.restoreTreat.mockResolvedValue(undefined);
    mockedTreats.getTreat.mockResolvedValue({ ...archivedTreat, deletedAt: null });
    const onRestored = jest.fn();

    await render(
      <ThemeProvider>
        <TreatFormSheet
          visible
          mode="edit"
          treat={archivedTreat}
          onClose={jest.fn()}
          onSaved={jest.fn()}
          onRestored={onRestored}
        />
      </ThemeProvider>,
    );

    expect(screen.queryByText('Archive treat')).toBeNull();
    await fireEvent.press(screen.getByText('Restore treat'));

    await waitFor(() => {
      expect(mockedTreats.restoreTreat).toHaveBeenCalledWith({}, 'treat-2');
    });
    expect(onRestored).toHaveBeenCalledWith(expect.objectContaining({ id: 'treat-2', deletedAt: null }));
  });
});
