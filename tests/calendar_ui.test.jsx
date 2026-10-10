import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import Calendar from '../src/components/screens/Calendar';
import * as AuthContext from '../src/context/AuthContext';
import * as ModalContext from '../src/context/ModalContext';
import * as calendarAPI from '../src/lib/calendarAPI';

describe('Calendar UI & Mobile Interaction Tests', () => {
  const mockUser = { uid: 'user_1', isGuest: false };
  const mockOpenModal = vi.fn();

  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: mockUser,
      isCalendarConnected: true,
      linkGoogleCalendar: vi.fn(),
      disconnectGoogleCalendar: vi.fn(),
    });

    vi.spyOn(ModalContext, 'useModal').mockReturnValue({
      openModal: mockOpenModal,
    });

    // Mock fetchCalendarEvents returning mock events for October 2026
    vi.spyOn(calendarAPI, 'fetchCalendarEvents').mockResolvedValue([
      {
        id: 'evt_1',
        summary: 'Ganztägiger Workshop',
        start: { date: '2026-10-08' },
        end: { date: '2026-10-09' },
        colorId: '9',
      },
      {
        id: 'evt_2',
        summary: 'Fokus-Sprint',
        start: { dateTime: '2026-10-08T12:00:00Z' },
        end: { dateTime: '2026-10-08T13:00:00Z' },
        colorId: '7',
      },
    ]);

    // Feste „Heute“-Zeit: Die Testdaten liegen im Oktober 2026, der Test darf nicht vom echten Datum abhängen
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 15, 12, 0, 0) });
    localStorage.clear();

    // Default window width to 375px (Mobile viewport)
    window.innerWidth = 375;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const daySheet = () => screen.getByRole('region', { name: /Termine am/i });
  // Die Monatsseiten (Vormonat, aktuell, Folgemonat) stehen alle im DOM: Zelle der mittleren Seite wählen
  const centerCell = (n) => {
    const track = document.querySelector('[style*="translateX"]');
    return within(track.children[1]).getAllByText(String(n))[0];
  };

  it('renders weekday headers with SO. highlighted in red', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    expect(screen.getAllByText('MO.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DI.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MI.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DO.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FR.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SA.').length).toBeGreaterThan(0);

    const sundayHeaders = screen.getAllByText('SO.');
    expect(sundayHeaders.length).toBeGreaterThan(0);
    expect(sundayHeaders[0].className).toContain('text-danger');
  });

  it('renders the today button in header showing today date number', async () => {
    const todayDate = new Date().getDate().toString();
    await act(async () => {
      render(<Calendar />);
    });

    const todayButtons = screen.getAllByRole('button', { name: /Zurück zu Heute/i });
    expect(todayButtons.length).toBeGreaterThan(0);
    expect(todayButtons[0].textContent).toContain(todayDate);
  });

  it('renders search button and opens search dialog when clicked', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    const searchBtn = screen.getByRole('button', { name: /Termine suchen/i });
    fireEvent.click(searchBtn);

    expect(screen.getByPlaceholderText(/Titel, Beschreibung/i)).toBeDefined();
  });

  it('opens mobile day detail sheet when clicking on a day cell', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    // Tag 16 der aktuellen Monatsseite antippen (der 15. ist „heute“ und steht auch im Heute-Knopf)
    fireEvent.click(centerCell(16));

    // Das Tagessheet fährt als Vorschau hoch (nicht modal) und zeigt den Tag mit Hinzufügen-Knopf
    const sheet = daySheet();
    expect(within(sheet).getByText(/16\. Okt\./)).toBeDefined();
    expect(within(sheet).getByRole('button', { name: /Termin an diesem Tag erstellen/i })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tapping the selected day again closes the sheet, the close button too', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    expect(screen.queryByRole('region', { name: /Termine am/i })).toBeNull(); // geschlossen: für Hilfstechnik nicht sichtbar
    fireEvent.click(centerCell(17));
    expect(daySheet()).toBeDefined();
    fireEvent.click(centerCell(17));
    expect(screen.queryByRole('region', { name: /Termine am/i })).toBeNull();

    fireEvent.click(centerCell(18));
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Tagesansicht schließen/i }));
    expect(screen.queryByRole('region', { name: /Termine am/i })).toBeNull();
  });

  it('day sheet steps between the three heights via the handle', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    fireEvent.click(centerCell(16));
    const peek = daySheet().style.height;
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Tagesansicht vergrößern/i }));
    const half = daySheet().style.height;
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Tagesansicht vergrößern/i }));
    const full = daySheet().style.height;
    expect(parseInt(peek, 10)).toBeLessThan(parseInt(half, 10));
    expect(parseInt(half, 10)).toBeLessThan(parseInt(full, 10));
    // Ganz oben führt der Griff wieder auf die Vorschau zurück
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Tagesansicht verkleinern/i }));
    expect(daySheet().style.height).toBe(peek);
  });

  it('previous and next day buttons in the sheet move the selected day', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    fireEvent.click(centerCell(16));
    expect(within(daySheet()).getByText(/16\. Okt\./)).toBeDefined();
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Nächster Tag/i }));
    expect(within(daySheet()).getByText(/17\. Okt\./)).toBeDefined();
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Vorheriger Tag/i }));
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Vorheriger Tag/i }));
    expect(within(daySheet()).getByText(/15\. Okt\./)).toBeDefined();
    expect(within(daySheet()).getByText('Heute')).toBeDefined();
  });

  it('does NOT distinguish between cell click and event click on mobile – both open the extra menu', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    // Wait for events to load into state
    const eventSummaries = await screen.findAllByText('Ganztägiger Workshop');
    expect(eventSummaries.length).toBeGreaterThan(0);

    // Clicking the event pill on mobile
    fireEvent.click(eventSummaries[0]);

    // Das Tagessheet öffnet sich (auch beim Tippen auf den Termin) und zeigt den ganztägigen Termin
    const sheet = daySheet();
    expect(within(sheet).getByText('Ganztägiger Workshop')).toBeDefined();
    expect(within(sheet).getByText('Ganztägig')).toBeDefined();
  });

  it('defaults to list mode in day sheet and allows switching to timeline', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    // Ein Tag, der nicht „heute“ ist (der Heute-Knopf zeigt dieselbe Zahl)
    fireEvent.click(centerCell(20));

    const toTimelineBtn = within(daySheet()).getByRole('button', { name: /Zeitstrahl anzeigen/i });
    expect(toTimelineBtn).toBeDefined();

    // Toggle to timeline: Zeitraster mit Spalte für den Tag
    fireEvent.click(toTimelineBtn);
    expect(daySheet().querySelector('[data-day-column]')).not.toBeNull();
    expect(localStorage.getItem('focusflow_calendar_mobile_day_view')).toBe('timeline');

    // Toggle back to list
    fireEvent.click(within(daySheet()).getByRole('button', { name: /Liste anzeigen/i }));
    expect(daySheet().querySelector('[data-day-column]')).toBeNull();
    expect(within(daySheet()).getByRole('button', { name: /Termin an diesem Tag erstellen/i })).toBeDefined();
  });

  it('does not display obsolete text like "Wischen für nächsten Monat"', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    expect(screen.queryByText(/Wischen für nächsten Monat/i)).toBeNull();
  });

  it('preloads current, previous, and next month events in parallel on mount', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    // fetchCalendarEvents should have been called for 3 target months
    expect(calendarAPI.fetchCalendarEvents).toHaveBeenCalledTimes(3);
  });

  it('today button in header updates to today without forcibly opening the mobile day drawer', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    const todayBtn = screen.getByRole('button', { name: /Zurück zu Heute/i });
    fireEvent.click(todayBtn);

    // Should NOT force the sheet open just by tapping Today in header
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('region', { name: /Termine am/i })).toBeNull();
  });

  it('clicking an event inside the mobile day sheet opens the event detail dialog above it', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    // Open sheet via clicking the event on mobile
    const eventSummaries = await screen.findAllByText('Ganztägiger Workshop');
    fireEvent.click(eventSummaries[0]);

    // Inside sheet, find and click the all-day event
    const eventCard = within(daySheet()).getByText('Ganztägiger Workshop');
    fireEvent.click(eventCard);

    // Detail modal should be rendered with title and edit button
    expect(await screen.findByRole('button', { name: /Bearbeiten/i })).toBeDefined();
    expect(screen.getByText('Zeitraum')).toBeDefined();
  });

  it('lists timed events of the day in the sheet, each with its time range', async () => {
    calendarAPI.fetchCalendarEvents.mockResolvedValue([
      {
        id: 'evt_a',
        summary: 'Termin A',
        start: { dateTime: new Date(2026, 9, 8, 12, 0).toISOString() },
        end: { dateTime: new Date(2026, 9, 8, 13, 0).toISOString() },
        colorId: '9',
      },
      {
        id: 'evt_b',
        summary: 'Termin B',
        start: { dateTime: new Date(2026, 9, 8, 9, 30).toISOString() },
        end: { dateTime: new Date(2026, 9, 8, 10, 0).toISOString() },
        colorId: '9',
      },
    ]);

    await act(async () => {
      render(<Calendar />);
    });

    // Open day sheet via clicking Termin A
    const eventA = await screen.findAllByText('Termin A');
    fireEvent.click(eventA[0]);

    const sheet = daySheet();
    const items = within(sheet).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // Früh zuerst, jeder Eintrag mit Zeitraum
    expect(items[0].textContent).toContain('Termin B');
    expect(items[0].textContent).toContain('09:30 – 10:00');
    expect(items[1].textContent).toContain('Termin A');
    expect(items[1].textContent).toContain('12:00 – 13:00');
  });

  it('allocates compact h-auto space with line-clamp-2 and break-words without stretching vertically for timed and all-day events', async () => {
    calendarAPI.fetchCalendarEvents.mockImplementation(async (year, monthIndex) => {
      return [
        {
          id: 'evt_timed_embedded',
          summary: 'Embedded Systems',
          start: { dateTime: `${year}-${String(monthIndex + 1).padStart(2, '0')}-09T10:00:00Z` },
          end: { dateTime: `${year}-${String(monthIndex + 1).padStart(2, '0')}-09T11:00:00Z` },
          colorId: '9',
        },
        {
          id: 'evt_allday',
          summary: 'Einzelsitzung Vertrag',
          start: { date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-06` },
          colorId: '9',
        },
        {
          id: 'evt_m1',
          summary: 'Multi Event 1',
          start: { date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-08` },
          colorId: '9',
        },
        {
          id: 'evt_m2',
          summary: 'Multi Event 2',
          start: { date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-08` },
          colorId: '9',
        },
        {
          id: 'evt_m3',
          summary: 'Multi Event 3',
          start: { date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-08` },
          colorId: '9',
        },
        {
          id: 'evt_m4',
          summary: 'Multi Event 4',
          start: { date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-08` },
          colorId: '9',
        },
      ];
    });

    await act(async () => {
      render(<Calendar />);
    });

    // Verify timed event card (e.g. Embedded Systems on day 9) has h-auto, does NOT have flex-1 or h-full,
    // has line-clamp-2 & break-words, has border-l-[3px] accent bar, and does NOT have a solid background fill
    const timedElements = await screen.findAllByText('Embedded Systems');
    const timedEl = timedElements[0];
    expect(timedEl.className).toContain('line-clamp-2');
    expect(timedEl.className).toContain('break-words');
    expect(timedEl.parentElement.className).toContain('h-auto');
    expect(timedEl.parentElement.className).toContain('border-l-[3px]');
    expect(timedEl.parentElement.className).not.toContain('flex-1');
    expect(timedEl.parentElement.className).not.toContain('h-full');
    expect(timedEl.parentElement.style.backgroundColor).toBe('');

    // Verify all-day event card (Einzelsitzung Vertrag on day 6) has h-auto, does NOT have flex-1 or h-full,
    // has line-clamp-2 & break-words, has rounded-xs chip styling, and has a pastel background fill
    const alldayElements = await screen.findAllByText('Einzelsitzung Vertrag');
    const alldayEl = alldayElements[0];
    expect(alldayEl.className).toContain('line-clamp-2');
    expect(alldayEl.className).toContain('break-words');
    expect(alldayEl.parentElement.className).toContain('h-auto');
    expect(alldayEl.parentElement.className).toContain('rounded-xs');
    expect(alldayEl.parentElement.className).not.toContain('flex-1');
    expect(alldayEl.parentElement.className).not.toContain('h-full');
    expect(alldayEl.parentElement.style.backgroundColor).not.toBe('');

    // Verify multi events also have h-auto and line-clamp-2 & break-words without stretching vertically
    const multi4Elements = await screen.findAllByText('Multi Event 4');
    const multi4El = multi4Elements[0];
    expect(multi4El.className).toContain('line-clamp-2');
    expect(multi4El.className).toContain('break-words');
    expect(multi4El.parentElement.className).toContain('h-auto');
    expect(multi4El.parentElement.className).not.toContain('flex-1');
    expect(multi4El.parentElement.className).not.toContain('h-full');
  });
});
