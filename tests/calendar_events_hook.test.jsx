import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor, render, screen, fireEvent } from '@testing-library/react';
import * as calendarAPI from '../src/lib/calendarAPI';
import * as AuthContext from '../src/context/AuthContext';
import * as ModalContext from '../src/context/ModalContext';
import { useCalendarEvents, describeCalendarError } from '../src/hooks/useCalendarEvents';
import Calendar from '../src/components/screens/Calendar';

const baseProps = {
  enabled: true,
  year: 2026, month: 9,
  prevYear: 2026, prevMonth: 8,
  nextYear: 2026, nextMonth: 10,
};

const setOnline = (value) => Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });

describe('useCalendarEvents – Laden, Fehler, Offline', () => {
  let fetchSpy;
  beforeEach(() => {
    setOnline(true);
    fetchSpy = vi.spyOn(calendarAPI, 'fetchCalendarEvents').mockResolvedValue([{ id: 'e1', summary: 'Test' }]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it('lädt aktuellen, vorherigen und nächsten Monat parallel und füllt den Cache', async () => {
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    await waitFor(() => expect(Object.keys(result.current.eventsCache).sort()).toEqual(['2026-10', '2026-8', '2026-9']));
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('lädt nichts, solange der Kalender nicht verbunden ist', async () => {
    renderHook(() => useCalendarEvents({ ...baseProps, enabled: false }));
    await act(async () => {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('zeigt einen Fehler für den aktuellen Monat und versucht es nicht endlos erneut', async () => {
    fetchSpy.mockImplementation((y, m) => (m === 9 ? Promise.reject(new Error('Failed to fetch')) : Promise.resolve([])));
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    await waitFor(() => expect(result.current.error).toContain('Oktober 2026'));
    expect(result.current.error).toContain('nicht erreichbar');
    const calls = fetchSpy.mock.calls.length;
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(fetchSpy.mock.calls.length).toBe(calls); // keine Wiederholungsschleife
  });

  it('meldet Fehler beim Vor-/Folgemonat nicht im Banner', async () => {
    fetchSpy.mockImplementation((y, m) => (m === 8 ? Promise.reject(new Error('boom')) : Promise.resolve([])));
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    await waitFor(() => expect(result.current.eventsCache['2026-9']).toBeDefined());
    await act(async () => {});
    expect(result.current.error).toBeNull();
  });

  it('retry() lädt fehlgeschlagene Monate erneut und räumt den Fehler weg', async () => {
    let fail = true;
    fetchSpy.mockImplementation((y, m) => (m === 9 && fail ? Promise.reject(new Error('boom')) : Promise.resolve([{ id: `e${m}` }])));
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.eventsCache['2026-9']).toEqual([{ id: 'e9' }]);
  });

  it('erkennt Offline-Status, behält geladene Termine und lädt beim Zurückkehren online neu', async () => {
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    await waitFor(() => expect(result.current.eventsCache['2026-9']).toBeDefined());

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOffline).toBe(true);
    expect(result.current.eventsCache['2026-9']).toEqual([{ id: 'e1', summary: 'Test' }]); // bleibt sichtbar

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOffline).toBe(false);
  });

  it('startet mit Offline-Status, wenn das Gerät keine Verbindung meldet', () => {
    setOnline(false);
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    expect(result.current.isOffline).toBe(true);
  });

  it('beim Zurückkehren online werden zuvor fehlgeschlagene Monate automatisch erneut geladen', async () => {
    let fail = true;
    fetchSpy.mockImplementation((y, m) => (m === 9 && fail ? Promise.reject(new Error('Failed to fetch')) : Promise.resolve([{ id: 'ok' }])));
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    fail = false;
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.eventsCache['2026-9']).toEqual([{ id: 'ok' }]);
  });

  it('reloadMonth() aktualisiert den Cache eines Monats', async () => {
    const { result } = renderHook(() => useCalendarEvents(baseProps));
    await waitFor(() => expect(result.current.eventsCache['2026-9']).toBeDefined());
    fetchSpy.mockResolvedValue([{ id: 'neu' }]);
    await act(async () => { await result.current.reloadMonth(2026, 9); });
    expect(result.current.eventsCache['2026-9']).toEqual([{ id: 'neu' }]);
  });

  it('lädt beim Monatswechsel nur noch nicht gecachte Monate nach', async () => {
    const { result, rerender } = renderHook((props) => useCalendarEvents(props), { initialProps: baseProps });
    await waitFor(() => expect(Object.keys(result.current.eventsCache)).toHaveLength(3));
    fetchSpy.mockClear();
    rerender({ enabled: true, year: 2026, month: 10, prevYear: 2026, prevMonth: 9, nextYear: 2026, nextMonth: 11 });
    await waitFor(() => expect(result.current.eventsCache['2026-11']).toBeDefined());
    expect(fetchSpy).toHaveBeenCalledTimes(1); // nur Dezember
  });
});

describe('describeCalendarError', () => {
  it('unterscheidet Authentifizierungs-, Netzwerk- und sonstige Fehler', () => {
    expect(describeCalendarError(new Error('HTTP 401'))).toContain('Kalender neu');
    expect(describeCalendarError(new Error('Missing permissions'))).toContain('Kalender neu');
    expect(describeCalendarError(new Error('Failed to fetch'))).toContain('nicht erreichbar');
    expect(describeCalendarError(new Error('irgendwas'))).toContain('konnten nicht geladen werden');
    expect(describeCalendarError(undefined)).toContain('konnten nicht geladen werden');
  });
});

describe('Calendar – Fehler- und Offline-Banner', () => {
  beforeEach(() => {
    setOnline(true);
    window.innerWidth = 375;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'u1', isGuest: false },
      isCalendarConnected: true,
      linkGoogleCalendar: vi.fn(),
    });
    vi.spyOn(ModalContext, 'useModal').mockReturnValue({ openModal: vi.fn() });
  });
  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it('zeigt bei Ladefehler einen Alert mit "Erneut versuchen", der erneut lädt', async () => {
    const spy = vi.spyOn(calendarAPI, 'fetchCalendarEvents').mockRejectedValue(new Error('Failed to fetch'));
    await act(async () => { render(<Calendar />); });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('nicht erreichbar');

    spy.mockResolvedValue([]);
    const before = spy.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByText('Erneut versuchen')); });
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('zeigt einen Offline-Hinweis und blendet ihn beim Zurückkehren online aus', async () => {
    vi.spyOn(calendarAPI, 'fetchCalendarEvents').mockResolvedValue([]);
    await act(async () => { render(<Calendar />); });
    expect(screen.queryByText(/Du bist offline/)).toBeNull();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/Du bist offline/)).toBeTruthy();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.queryByText(/Du bist offline/)).toBeNull());
  });
});
