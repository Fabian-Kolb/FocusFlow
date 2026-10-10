import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import Calendar from '../src/components/screens/Calendar';
import * as AuthContext from '../src/context/AuthContext';
import * as calendarAPI from '../src/lib/calendarAPI';

// Ansichten des Kalenders: Monat, Woche, Tag, Agenda (PC: Umschalter und Tagesleiste, Handy: Menü).
// „Heute“ ist fest der 15. Oktober 2026 (Donnerstag), damit die Tests nicht vom echten Datum abhängen.

const local = (d, h, m) => new Date(2026, 9, d, h, m).toISOString();

describe('Kalender: Ansichten', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 15, 12, 0, 0) });
    localStorage.clear();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'user_1', isGuest: false },
      isCalendarConnected: true,
      linkGoogleCalendar: vi.fn(),
    });
    vi.spyOn(calendarAPI, 'fetchCalendarEvents').mockResolvedValue([
      { id: 'e1', summary: 'Zahnarzt', start: { dateTime: local(14, 10, 0) }, end: { dateTime: local(14, 11, 0) }, colorId: '4' },
      { id: 'e2', summary: 'Konferenz', start: { date: '2026-10-16' }, end: { date: '2026-10-18' }, colorId: '3' },
      { id: 'e3', summary: 'Workshop', start: { dateTime: local(20, 13, 0) }, end: { dateTime: local(20, 15, 0) }, colorId: '9', hangoutLink: 'https://meet.google.com/abc' },
    ]);
    window.innerWidth = 1280;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const mount = async () => {
    await act(async () => {
      render(<Calendar />);
    });
  };
  const title = () => screen.getByTitle('Monat auswählen').textContent;
  const columns = () => document.querySelectorAll('[data-day-column]');

  it('zeigt am PC Heute, Pfeile, Titel, Ansicht-Umschalter und „+ Termin“ in einer Kopfzeile', async () => {
    await mount();
    expect(screen.getByRole('button', { name: 'Zurück zu Heute' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDefined();
    expect(title()).toContain('Oktober 2026');
    expect(screen.getByRole('button', { name: 'Monat' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Woche' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /Termin$/ })).toBeDefined();
    // Die Menü-Schaltfläche zu den Einstellungen gibt es hier nicht mehr (anderswo erreichbar)
    expect(screen.queryByRole('button', { name: /Menü öffnen/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ansicht wählen/i })).toBeNull();
  });

  it('Wochenansicht: sieben Tagesspalten je Seite, Titel mit Zeitraum, Auswahl bleibt gespeichert', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }));
    expect(title()).toContain('12.–18. Oktober 2026');
    expect(columns()).toHaveLength(21); // Vorwoche, aktuelle Woche, Folgewoche
    expect(localStorage.getItem('focusflow_calendar_view')).toBe('week');
    // Der ganztägige Termin über zwei Tage steht in der Kopfleiste
    expect(screen.getAllByText('Konferenz').length).toBeGreaterThan(0);
  });

  it('Pfeile, Heute und Tastatur bewegen sich um eine Woche', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(title()).toContain('19.–25. Oktober 2026');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(title()).toContain('5.–11. Oktober 2026');
    fireEvent.keyDown(window, { key: 't' });
    expect(title()).toContain('12.–18. Oktober 2026');
  });

  it('Tastenkürzel wechseln die Ansicht, aber nicht beim Tippen in ein Feld', async () => {
    await mount();
    fireEvent.keyDown(window, { key: 'w' });
    expect(columns()).toHaveLength(21);
    fireEvent.keyDown(window, { key: 'd' });
    expect(columns()).toHaveLength(3);
    fireEvent.keyDown(window, { key: 'm' });
    expect(columns()).toHaveLength(0);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'w' });
    expect(columns()).toHaveLength(0);
    input.remove();
  });

  it('Tagesansicht zeigt einen Tag je Seite mit Tag und Datum im Titel', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Tag' }));
    expect(title()).toContain('Donnerstag, 15. Oktober 2026');
    expect(columns()).toHaveLength(3);
  });

  it('Klick auf eine freie Stelle im Zeitraster legt einen Termin zur gerundeten Uhrzeit an', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }));
    const column = document.querySelector('[data-day-column="2026-10-14"]');
    // 56 px je Stunde: 600 px entsprechen 10:43 Uhr, gerundet auf 10:30
    fireEvent.click(column, { clientY: 600 });
    expect(screen.getByText('Neuer Termin')).toBeDefined();
    expect(document.querySelector('input[type="date"]').value).toBe('2026-10-14');
    expect(document.querySelectorAll('input[type="time"]')[0].value).toBe('10:30');
    expect(document.querySelectorAll('input[type="time"]')[1].value).toBe('11:30');
  });

  it('Termine stehen im Zeitraster und öffnen beim Klick das Detail', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }));
    const column = document.querySelector('[data-day-column="2026-10-14"]');
    fireEvent.click(within(column).getByText('Zahnarzt'));
    expect(await screen.findByRole('button', { name: /Bearbeiten/i })).toBeDefined();
  });

  it('Agenda listet kommende Termine nach Tagen, mit Meet-Hinweis', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    const agenda = screen.getByLabelText('Agenda');
    expect(within(agenda).getByText('Morgen')).toBeDefined(); // 16. Okt., ganztägiger Termin
    expect(within(agenda).getByText('Dienstag, 20. Okt.')).toBeDefined();
    expect(within(agenda).getAllByText('Konferenz')).toHaveLength(2); // an beiden Tagen der Mehrtagestermin
    expect(within(agenda).getByText('Workshop')).toBeDefined();
    expect(within(agenda).getByText('Google Meet')).toBeDefined();
    // Termine vor dem gewählten Tag gehören nicht in die Agenda
    expect(within(agenda).queryByText('Zahnarzt')).toBeNull();
    expect(within(agenda).getByRole('button', { name: /Weitere Tage laden/i })).toBeDefined();
  });

  it('Tagesleiste lässt sich am PC ein- und ausblenden und merkt sich das', async () => {
    await mount();
    expect(screen.queryByRole('complementary', { name: 'Tagesleiste' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tagesleiste einblenden' }));
    const sidebar = screen.getByRole('complementary', { name: 'Tagesleiste' });
    expect(within(sidebar).getByText('Heute')).toBeDefined();
    expect(localStorage.getItem('focusflow_calendar_day_sidebar')).toBe('1');
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Nächster Tag' }));
    expect(within(screen.getByRole('complementary', { name: 'Tagesleiste' })).getByText(/16\. Okt\./)).toBeDefined();
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Tagesleiste' })).getByRole('button', { name: 'Tagesleiste ausblenden' }));
    expect(screen.queryByRole('complementary', { name: 'Tagesleiste' })).toBeNull();
    expect(localStorage.getItem('focusflow_calendar_day_sidebar')).toBe('0');
  });

  it('Im Monatsraster legt das Plus einer Zelle einen Termin an diesem Tag an, die Tageszahl öffnet den Tag', async () => {
    await mount();
    const center = document.querySelector('[style*="translateX"]').children[1];
    fireEvent.click(within(center).getByRole('button', { name: /Termin am 14\. Oktober erstellen/i }));
    expect(screen.getByText('Neuer Termin')).toBeDefined();
    expect(document.querySelector('input[type="date"]').value).toBe('2026-10-14');
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/i }));

    const center2 = document.querySelector('[style*="translateX"]').children[1];
    fireEvent.click(within(center2).getByRole('button', { name: /14\. Oktober öffnen/i }));
    expect(title()).toContain('Mittwoch, 14. Oktober 2026');
  });

  it('Am Handy wählt ein Menü die Ansicht und es gibt kein Tagesleisten-Symbol', async () => {
    window.innerWidth = 375;
    await mount();
    expect(screen.queryByRole('button', { name: /Tagesleiste/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht wählen' }));
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(items.some((t) => t.endsWith('Agenda'))).toBe(true);
    fireEvent.click(screen.getAllByRole('menuitem').find((i) => i.textContent.endsWith('Woche')));
    expect(columns()).toHaveLength(21);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
