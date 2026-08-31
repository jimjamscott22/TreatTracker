import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { eventsRepository, treatsRepository } from '../../db';
import { ThemeProvider } from '../../theme';
import { AddTreatSheet } from '../AddTreatSheet';

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
    listQuickAddTreats: jest.fn(),
    searchTreats: jest.fn(),
  },
  eventsRepository: {
    draftFromTreat: jest.fn((params: { petId: string; treat: { id: string } }) => ({
      petId: params.petId,
      treatId: params.treat.id,
    })),
    recordEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    recordNewCatalogTreat: jest.fn().mockResolvedValue({
      treat: { id: 'treat-1' },
      event: { id: 'event-1' },
    }),
  },
}));

const mockedTreats = treatsRepository as jest.Mocked<typeof treatsRepository>;
const mockedEvents = eventsRepository as jest.Mocked<typeof eventsRepository>;

async function renderSheet() {
  const onRecorded = jest.fn();
  const onClose = jest.fn();
  await render(
    <ThemeProvider>
      <AddTreatSheet
        visible
        petId="pet-1"
        petName="Miso"
        onClose={onClose}
        onRecorded={onRecorded}
      />
    </ThemeProvider>,
  );
  return { onRecorded, onClose };
}

describe('AddTreatSheet', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedTreats.listQuickAddTreats.mockResolvedValue([]);
    mockedTreats.searchTreats.mockResolvedValue([]);
  });

  it('offers to create a new treat with real quotes, not HTML entities', async () => {
    await renderSheet();

    await fireEvent.changeText(screen.getByPlaceholderText('Search treats'), 'Duck strips');

    expect(await screen.findByText('Create "Duck strips"')).toBeTruthy();
    expect(screen.queryByText(/&ldquo;|&rdquo;|&quot;/)).toBeNull();
  });

  it('creates a catalog treat and records an event when "Use once" is off', async () => {
    const { onRecorded } = await renderSheet();

    await fireEvent.changeText(screen.getByPlaceholderText('Search treats'), 'Duck strips');
    await fireEvent.press(await screen.findByText('Create "Duck strips"'));
    await fireEvent.press(await screen.findByText('Save and record'));

    await waitFor(() => {
      expect(mockedEvents.recordNewCatalogTreat).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          petId: 'pet-1',
          treatDraft: expect.objectContaining({ name: 'Duck strips' }),
        }),
      );
    });
    expect(onRecorded).toHaveBeenCalledWith('event-1');
  });

  it('records a one-off event with no catalog treat when "Use once" is on', async () => {
    const { onRecorded } = await renderSheet();

    await fireEvent.changeText(screen.getByPlaceholderText('Search treats'), 'Leftover chicken');
    await fireEvent.press(await screen.findByText('Create "Leftover chicken"'));
    await fireEvent(screen.getByLabelText('Use once'), 'valueChange', true);
    await fireEvent.press(await screen.findByText('Record treat'));

    await waitFor(() => {
      expect(mockedEvents.recordEvent).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          petId: 'pet-1',
          treatId: null,
          treatNameSnapshot: 'Leftover chicken',
        }),
      );
    });
    expect(onRecorded).toHaveBeenCalledWith('event-1');
  });
});
