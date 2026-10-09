// Beispieldaten für den Dev-Account (nur Entwicklung). Alle Termine sind relativ zu „heute“,
// damit Überfällig / Heute / Nächste 7 Tage immer etwas zeigen.

const DAY = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

export const DEV_SEED_FLAG = 'focusflow_dev_seeded';
const KEYS = [
  'focusflow_guest_projects',
  'focusflow_guest_reminders',
  'focusflow_guest_inbox',
  'focusflow_guest_kanban_views',
];

export function buildSeedProjects() {
  return [
    {
      id: 'dev_proj_umzug',
      title: 'Umzug nach Köln',
      description: 'Alles rund um den Umzug im November.',
      status: 'AKTIV',
      isPaused: false,
      inKanban: true,
      categoryId: 'allgemein',
      startDate: inDays(-14),
      endDate: inDays(30),
      phases: [
        {
          id: 'dev_ph_planung',
          title: 'Planung',
          completed: false,
          description: 'Termine und Verträge',
          tasks: [
            { id: 'dev_t1', title: 'Mietvertrag unterschreiben', date: inDays(-6), completed: false, note: '' },
            { id: 'dev_t2', title: 'Umzugsunternehmen anfragen', date: inDays(0), completed: false, note: 'Drei Angebote einholen' },
            { id: 'dev_t3', title: 'Nachsendeauftrag einrichten', date: inDays(3), completed: false, note: '' },
            { id: 'dev_t4', title: 'Wohnungsbesichtigung', date: inDays(-12), completed: true, note: '' },
          ],
          materials: [],
        },
        {
          id: 'dev_ph_orga',
          title: 'Organisation',
          completed: false,
          description: 'Packen und Ummelden',
          tasks: [
            { id: 'dev_t5', title: 'Kartons besorgen', date: inDays(5), completed: false, note: '' },
            { id: 'dev_t6', title: 'Ummeldung beim Bürgeramt', date: inDays(9), completed: false, note: 'Termin online buchen' },
          ],
          materials: [],
        },
      ],
      notes: [],
      history: [],
    },
    {
      id: 'dev_proj_website',
      title: 'Website-Relaunch',
      description: 'Neues Design und Inhalte für die Portfolio-Seite.',
      status: 'IN ARBEIT',
      isPaused: false,
      inKanban: true,
      categoryId: 'allgemein',
      startDate: inDays(-30),
      endDate: inDays(14),
      phases: [
        {
          id: 'dev_ph_design',
          title: 'Design',
          completed: true,
          description: '',
          tasks: [
            { id: 'dev_t7', title: 'Moodboard erstellen', date: inDays(-20), completed: true, note: '' },
            { id: 'dev_t8', title: 'Farbkonzept festlegen', date: inDays(-15), completed: true, note: '' },
          ],
          materials: [],
        },
        {
          id: 'dev_ph_umsetzung',
          title: 'Umsetzung',
          completed: false,
          description: '',
          tasks: [
            { id: 'dev_t9', title: 'Startseite bauen', date: inDays(1), completed: false, note: '' },
            { id: 'dev_t10', title: 'Texte überarbeiten', date: inDays(6), completed: false, note: '' },
          ],
          materials: [],
        },
      ],
      notes: [],
      history: [],
    },
    {
      id: 'dev_proj_pausiert',
      title: 'Gitarre lernen',
      description: 'Pausiert bis zum Frühjahr.',
      status: 'AKTIV',
      isPaused: true,
      inKanban: false,
      categoryId: 'allgemein',
      phases: [],
      notes: [],
      history: [],
    },
  ];
}

export function buildSeedReminders() {
  const now = Date.now();
  const base = { categoryId: 'allgemein', status: 'AKTIV', notes: [] };
  return [
    { ...base, id: 'dev_rem_1', title: 'Steuererklärung abgeben', description: 'Belege sind im Ordner Finanzen.', priority: 'hoch', date: inDays(-3), time: '', createdAt: now - 9 * DAY },
    { ...base, id: 'dev_rem_2', title: 'Zahnarzt anrufen', description: '', priority: 'mittel', date: inDays(0), time: '16:30', createdAt: now - 5 * DAY },
    { ...base, id: 'dev_rem_3', title: 'Paket abholen', description: 'Abholschein liegt im Flur.', priority: 'niedrig', date: inDays(0), time: '', createdAt: now - 2 * DAY },
    { ...base, id: 'dev_rem_4', title: 'Morgens Blumen gießen', description: '', priority: 'niedrig', date: inDays(0), time: '08:00', status: 'ABGESCHLOSSEN', createdAt: now - 4 * DAY },
    { ...base, id: 'dev_rem_5', title: 'Wochenreview', description: 'Fortschritt der Projekte abgleichen.', priority: 'mittel', date: inDays(1), time: '09:00', recurrence: { freq: 'weekly', interval: 1 }, createdAt: now - 20 * DAY },
    { ...base, id: 'dev_rem_6', title: 'Geburtstag Mama', description: 'Geschenk besorgen.', priority: 'hoch', date: inDays(4), time: '', createdAt: now - 6 * DAY },
    { ...base, id: 'dev_rem_7', title: 'Neue Laufschuhe ansehen', description: '', priority: 'niedrig', date: '', time: '', createdAt: now - 1 * DAY },
  ];
}

export function buildSeedThoughts() {
  const now = Date.now();
  const make = (offsetMs, fields) => {
    const ts = now - offsetMs;
    return {
      id: `i_${ts}`,
      createdAt: ts,
      type: 'unclassified',
      cleanText: null,
      extractedDateType: null,
      extractedDate: null,
      extractedEndDate: null,
      extractedTime: null,
      ...fields,
    };
  };
  return [
    make(10 * 60 * 1000, {
      title: 'Wochenplanung am Sonntag',
      summary: 'Wochenplanung am Sonntag machen',
      originalText: 'Wochenplanung am Sonntag machen',
    }),
    make(95 * 60 * 1000, {
      title: 'Fokus-Timer mit Musik',
      summary: '### Fokus-Timer mit Musik\n- Pomodoro 25/5 als Grundlage\n- Spotify oder lokale Playlists anbinden\n- Statistik pro Woche\n- Ruhige Sounds Alternative\n- Streaks für Motivation\n- Widget den Homescreen',
      cleanText: 'Ich habe die Idee für einen Fokus-Timer mit Musik. Er soll nach Pomodoro 25/5 arbeiten, Spotify anbinden, eine Wochenstatistik zeigen und ruhige Sounds anbieten.',
      originalText: 'äh also ich hab da so ne idee für nen fokus timer mit musik so pomodoro 25 5 und spotify dann irgendne statistik pro woche und ruhige sounds',
    }),
    make(3 * 60 * 60 * 1000, {
      title: 'Zahnarzt: Termin nächste Woche',
      summary: '### Zahnarzt: Termin nächste Woche\n- Dienstag um 14 Uhr\n- Rezept für Zahnseide mitnehmen',
      originalText: 'Zahnarzt anrufen wegen Termin nächste Woche Dienstag um 14 Uhr, außerdem Rezept für Zahnseide mitnehmen',
      extractedDateType: 'appointment',
      extractedDate: inDays(5),
      extractedTime: '14:00',
    }),
    make(26 * 60 * 60 * 1000, {
      title: 'Geschenkideen Mama',
      summary: '### Geschenkideen Mama\n- Buch über Gartenarbeit\n- Gutschein für Wellness\n- Bilderrahmen mit Familienfoto',
      originalText: 'Geschenkideen Mama: Buch über Gartenarbeit, Gutschein Wellness, Bilderrahmen mit Familienfoto',
    }),
    make(4 * DAY, {
      title: 'Blog über Remote-Arbeit schreiben, der die Erfahrungen letzten zwei Jahre zusammenfasst und konkrete Tipps gibt',
      summary: 'Blog über Remote-Arbeit schreiben, der die Erfahrungen letzten zwei Jahre zusammenfasst und konkrete Tipps gibt',
      originalText: 'Blog über Remote-Arbeit schreiben, der die Erfahrungen letzten zwei Jahre zusammenfasst und konkrete Tipps gibt',
    }),
    make(9 * DAY, {
      title: 'Urlaub im Herbst',
      summary: '### Urlaub im Herbst\n- Portugal oder Griechenland\n- Zwei Wochen Oktober\n- Flüge früh vergleichen',
      originalText: 'Urlaub im Herbst Portugal oder Griechenland zwei Wochen im Oktober Flüge früh vergleichen',
      extractedDateType: 'timeframe',
      extractedDate: inDays(40),
      extractedEndDate: inDays(54),
    }),
  ];
}

/** Schreibt die Beispieldaten in den lokalen Speicher (überschreibt vorhandene Gast-/Dev-Daten) */
export function seedDevAccountData() {
  try {
    localStorage.setItem('focusflow_guest_projects', JSON.stringify(buildSeedProjects()));
    localStorage.setItem('focusflow_guest_reminders', JSON.stringify(buildSeedReminders()));
    localStorage.setItem('focusflow_guest_inbox', JSON.stringify(buildSeedThoughts()));
    localStorage.setItem(DEV_SEED_FLAG, 'true');
    return true;
  } catch (e) {
    console.warn('Dev-Beispieldaten konnten nicht geschrieben werden:', e);
    return false;
  }
}

/** Löscht die lokalen Daten des Dev-Accounts und spielt die Beispieldaten neu ein */
export function resetDevAccountData() {
  try {
    KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(DEV_SEED_FLAG);
  } catch {
    // egal
  }
  return seedDevAccountData();
}

export function seedDevAccountDataOnce() {
  try {
    if (localStorage.getItem(DEV_SEED_FLAG) === 'true') return false;
  } catch {
    return false;
  }
  return seedDevAccountData();
}
