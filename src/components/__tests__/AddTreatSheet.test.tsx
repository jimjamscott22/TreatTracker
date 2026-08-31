import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { eventsRepository, treatsRepository } from '../../db';
import { ThemeProvider } from '../../theme';
import { AddTreatSheet } from '../AddTreatSheet';

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

describe('AddTreatSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTreats.listQuickAddTreats.mockResolvedValue([]);
    mockedTreats.searchTreats.mockResolvedValue([]);
  });

  it('offers to create a new treat with real quotes, not HTML entities', async () => {
    render(
      <ThemeProvider>
        <AddTreatSheet
          visible
          petId="pet-1"
          petName="Miso"
          onClose={jest.fn()}
          onRecorded={jest.fn()}
        />
      </ThemeProvider>,
    );

    fireEvent.changeText(await screen.findByLabelText('Search treats'), 'Duck strips');

    expect(await screen.findByText('Create "Duck strips"')).toBeTruthy();
    expect(screen.queryByText(/&ldquo;|&rdquo;|&quot;/)).toBeNull();
  });

  it('creates a catalog treat and records an event when "Use once" is off', async () => {
    const onRecorded = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatSheet
          visible
          petId="pet-1"
          petName="Miso"
          onClose={jest.fn()}
          onRecorded={onRecorded}
        />
      </ThemeProvider>,
    );

    fireEvent.changeText(await screen.findByLabelText('Search treats'), 'Duck strips');
    fireEvent.press(await screen.findByText('Create "Duck strips"'));
    fireEvent.press(await screen.findByText('Save and record'));

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
    const onRecorded = jest.fn();
    render(
      <ThemeProvider>
        <AddTreatSheet
          visible
          petId="pet-1"
          petName="Miso"
          onClose={jest.fn()}
          onRecorded={onRecorded}
        />
      </ThemeProvider>,
    );

    fireEvent.changeText(await screen.findByLabelText('Search treats'), 'Leftover chicken');
    fireEvent.press(await screen.findByText('Create "Leftover chicken"'));
    fireEvent(screen.getByLabelText('Use once'), 'valueChange', true);
    fireEvent.press(await screen.findByText('Record treat'));

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
