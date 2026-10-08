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

    // Default window width to 375px (Mobile viewport)
    window.innerWidth = 375;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    expect(sundayHeaders[0].className).toContain('text-red-500');
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

    expect(screen.getByPlaceholderText(/Termine suchen/i)).toBeDefined();
  });

  it('opens mobile day detail sheet when clicking on a day cell', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    // Find a day cell number (e.g. 15) and click
    const day15Elements = screen.getAllByText('15');
    fireEvent.click(day15Elements[0]);

    // Modal with dialog role should open
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();

    // Default view mode must be 'list', showing the docked bottom add button
    expect(screen.getByText(/hinzufüg/i)).toBeDefined();
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

    // Extra menu (dialog) should open!
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(within(dialog).getByText('Ganztägig')).toBeDefined();
  });

  it('defaults to list mode in day sheet and allows switching to timeline', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    const day10Elements = screen.getAllByText('10');
    fireEvent.click(day10Elements[0]);

    const switchBtn = screen.getByRole('button', { name: /Ansicht umschalten/i });
    expect(switchBtn).toBeDefined();

    // Toggle to timeline
    fireEvent.click(switchBtn);

    // Toggle back to list
    fireEvent.click(switchBtn);
    expect(screen.getByText(/hinzufüg/i)).toBeDefined();
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

    // Should NOT force the dialog open just by tapping Today in header
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking an event inside the mobile day sheet opens the event detail dialog with z-[80]', async () => {
    await act(async () => {
      render(<Calendar />);
    });

    // Open sheet via clicking the event on mobile
    const eventSummaries = await screen.findAllByText('Ganztägiger Workshop');
    fireEvent.click(eventSummaries[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();

    // Inside sheet, find and click the all-day event
    const eventCard = within(dialog).getByText('Ganztägiger Workshop');
    fireEvent.click(eventCard);

    // Detail modal should be rendered with title and edit button
    expect(await screen.findByRole('button', { name: /Bearbeiten/i })).toBeDefined();
    expect(screen.getByText('Zeitraum')).toBeDefined();
  });

  it('groups timed events by start time so subsequent events at the same time do not repeat the hour label', async () => {
    calendarAPI.fetchCalendarEvents.mockResolvedValue([
      {
        id: 'evt_a',
        summary: 'Termin A',
        start: { dateTime: '2026-10-08T12:00:00Z' },
        end: { dateTime: '2026-10-08T13:00:00Z' },
        colorId: '9',
      },
      {
        id: 'evt_b',
        summary: 'Termin B',
        start: { dateTime: '2026-10-08T12:00:00Z' },
        end: { dateTime: '2026-10-08T13:00:00Z' },
        colorId: '9',
      },
    ]);

    await act(async () => {
      render(<Calendar />);
    });

    // Open day sheet via clicking Termin A
    const eventA = await screen.findAllByText('Termin A');
    fireEvent.click(eventA[0]);

    const dialog = screen.getByRole('dialog');
    // Find all start-time divs (w-12 shrink-0 font-mono) in the timed events list
    const timeDivs = within(dialog).getAllByText((content, element) => {
      return element.tagName.toLowerCase() === 'div' && element.className.includes('w-12') && element.className.includes('font-mono');
    });
    expect(timeDivs.length).toBe(2);
    // First event shows formatted start time, second event at same time has empty string
    expect(timeDivs[0].textContent.trim().length).toBeGreaterThan(0);
    expect(timeDivs[1].textContent.trim()).toBe('');
  });

  it('allocates compact h-auto space with line-clamp-2 and break-all without stretching vertically for timed and all-day events', async () => {
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
    // has line-clamp-2 & break-all, has border-l-[3px] accent bar, and does NOT have a solid background fill
    const timedElements = await screen.findAllByText('Embedded Systems');
    const timedEl = timedElements[0];
    expect(timedEl.className).toContain('line-clamp-2');
    expect(timedEl.className).toContain('break-all');
    expect(timedEl.parentElement.className).toContain('h-auto');
    expect(timedEl.parentElement.className).toContain('border-l-[3px]');
    expect(timedEl.parentElement.className).not.toContain('flex-1');
    expect(timedEl.parentElement.className).not.toContain('h-full');
    expect(timedEl.parentElement.style.backgroundColor).toBe('');

    // Verify all-day event card (Einzelsitzung Vertrag on day 6) has h-auto, does NOT have flex-1 or h-full,
    // has line-clamp-2 & break-all, has rounded-[4px] chip styling, and has a pastel background fill
    const alldayElements = await screen.findAllByText('Einzelsitzung Vertrag');
    const alldayEl = alldayElements[0];
    expect(alldayEl.className).toContain('line-clamp-2');
    expect(alldayEl.className).toContain('break-all');
    expect(alldayEl.parentElement.className).toContain('h-auto');
    expect(alldayEl.parentElement.className).toContain('rounded-[4px]');
    expect(alldayEl.parentElement.className).not.toContain('flex-1');
    expect(alldayEl.parentElement.className).not.toContain('h-full');
    expect(alldayEl.parentElement.style.backgroundColor).not.toBe('');

    // Verify multi events also have h-auto and line-clamp-2 & break-all without stretching vertically
    const multi4Elements = await screen.findAllByText('Multi Event 4');
    const multi4El = multi4Elements[0];
    expect(multi4El.className).toContain('line-clamp-2');
    expect(multi4El.className).toContain('break-all');
    expect(multi4El.parentElement.className).toContain('h-auto');
    expect(multi4El.parentElement.className).not.toContain('flex-1');
    expect(multi4El.parentElement.className).not.toContain('h-full');
  });
});
