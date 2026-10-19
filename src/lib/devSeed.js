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
  'focusflow_guest_reminder_categories',
  'focusflow_guest_gym',
  'focusflow_guest_kanban_views',
  'focusflow_dev_calendar',
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
    ...buildSeedFaecher(),
    {
      id: 'dev_proj_kunde',
      environmentId: 'arbeit',
      title: 'Kunden-Relaunch',
      description: 'Neuer Webauftritt für den Kunden, Abnahme in drei Wochen.',
      status: 'IN ARBEIT',
      isPaused: false,
      inKanban: true,
      categoryId: 'allgemein',
      startDate: inDays(-20),
      endDate: inDays(21),
      phases: [
        {
          id: 'dev_ph_konzept',
          title: 'Konzept',
          completed: false,
          description: '',
          tasks: [
            { id: 'dev_tw1', title: 'Seitenstruktur abstimmen', date: inDays(1), completed: false, note: 'Mit dem Team klären' },
            { id: 'dev_tw2', title: 'Angebot finalisieren', date: inDays(0), completed: false, note: '' },
            { id: 'dev_tw3', title: 'Kick-off-Protokoll verschicken', date: inDays(-5), completed: true, note: '' },
          ],
          materials: [],
        },
      ],
      notes: [],
      history: [],
    },
  ];
}

// Fächer der Hochschule: Projekte vom Typ „fach“ mit Prüfungstermin, Aufgaben in „Aufgaben“ und Hinweisen aus der Stunde
function buildSeedFaecher() {
  const fach = (id, title, description, exam, tasks, hints = []) => ({
    id: `dev_proj_${id}`,
    type: 'fach',
    environmentId: 'hochschule',
    title,
    description,
    status: 'AKTIV',
    isPaused: false,
    inKanban: true,
    categoryId: 'allgemein',
    exam: { date: exam },
    hints,
    phases: [{ id: `dev_ph_${id}`, title: 'Aufgaben', completed: false, description: '', tasks, materials: [] }],
    notes: [],
    history: [],
  });
  const task = (id, title, date, completed = false) => ({ id: `dev_t_${id}`, title, date, completed, note: '' });
  return [
    fach('mathe', 'Mathe 2', 'Analysis und lineare Algebra, 2. Semester.', inDays(18), [
      task('m1', 'Übungsblatt 3 abgeben', inDays(-1)),
      task('m2', 'Übungsblatt 4 abgeben', inDays(7)),
      task('m3', 'Integrationsregeln wiederholen', inDays(10)),
      task('m4', 'Übungsblatt 2 abgeben', inDays(-8), true),
    ], [
      { id: 'dev_hint_1', text: 'Kapitel 3 kommt sicher in die Klausur', date: inDays(-2), exam: true },
      { id: 'dev_hint_2', text: 'Eine Seite Formelsammlung darf mitgebracht werden', date: inDays(-5) },
      { id: 'dev_hint_3', text: 'Übungsblatt 5 vor der Übung am Donnerstag lösen', date: inDays(-5) },
    ]),
    fach('prog', 'Programmieren', 'Webanwendung im Team, Labor jeden zweiten Freitag.', inDays(26), [
      task('p1', 'Laborbericht an die Gruppe schicken', inDays(1)),
      task('p2', 'Projektabgabe Webanwendung', inDays(26)),
    ]),
    fach('bwl', 'BWL', 'Grundlagen der Betriebswirtschaft.', inDays(24), [
      task('b1', 'Für die BWL-Klausur anmelden', inDays(2)),
      task('b2', 'Kapitel 2 zusammenfassen', ''),
    ]),
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
    ...buildSeedEnvironmentTasks(now),
  ];
}

// Aufgaben in den Umgebungen Hochschule und Arbeit: Abgaben und Prüfungen (kind), Schnelles (quick), Geparktes
// (parked) und Dinge, die zu lange liegen (ohne Datum, älter als 7 Tage), damit „Noch wichtig?“ etwas zu fragen hat.
function buildSeedEnvironmentTasks(now) {
  const base = { status: 'AKTIV', notes: [], description: '', time: '', categoryId: 'allgemein' };
  const task = (id, environmentId, title, fields) => ({ ...base, id: `dev_rem_${id}`, environmentId, title, date: '', ...fields });
  return [
    task('h4', 'hochschule', 'Altklausur 2025 rechnen', { createdAt: now - 2 * DAY }),
    task('h5', 'hochschule', 'Skript Kapitel 4 ausdrucken', { createdAt: now - 9 * DAY }),
    task('h8', 'hochschule', 'Tutor wegen Übungstermin anschreiben', { quick: true, createdAt: now - 1 * DAY }),
    task('h11', 'hochschule', 'Praktikumsbericht abgeben', { date: inDays(12), kind: 'abgabe', createdAt: now - 8 * DAY }),
    task('h12', 'hochschule', 'Anmeldung beim Prüfungsamt', { date: inDays(5), kind: 'abgabe', createdAt: now - 6 * DAY }),
    task('w1', 'arbeit', 'Angebot an den Kunden schicken', { date: inDays(0), time: '15:00', createdAt: now - 3 * DAY }),
    task('w2', 'arbeit', 'Rückmeldung zum Konzept einholen', { date: inDays(2), createdAt: now - 5 * DAY }),
    task('w3', 'arbeit', 'Zeiterfassung ausfüllen', { quick: true, createdAt: now - 1 * DAY }),
    task('w4', 'arbeit', 'Onboarding-Dokument überarbeiten', { createdAt: now - 12 * DAY }),
    { ...base, id: 'dev_rem_a1', title: 'Mensakarte aufladen', quick: true, date: '', createdAt: now - 1 * DAY },
    { ...base, id: 'dev_rem_a2', title: 'Fahrradlicht reparieren', date: '', createdAt: now - 14 * DAY },
    { ...base, id: 'dev_rem_a3', title: 'Neue Saiten für die Gitarre', parked: true, date: '', createdAt: now - 25 * DAY },
  ];
}

// Gym-Logbuch: Übungen, drei Trainingstage und elf Trainings der letzten vier Wochen mit steigenden Gewichten
// (Trizepsdrücken ohne Wiederholungen), dazu wöchentliche Körperwerte.
export function buildSeedGym() {
  const now = new Date();
  const at = (daysAgo, hour = 18) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 0).getTime();
  const names = {
    bank: 'Bankdrücken', schulter: 'Schulterdrücken', trizeps: 'Trizepsdrücken',
    klimm: 'Klimmzüge', rudern: 'Rudern', curls: 'Bizeps-Curls',
    knie: 'Kniebeugen', presse: 'Beinpresse', waden: 'Wadenheben',
  };
  const ex = (key) => `dev_ex_${key}`;
  const exercises = Object.entries(names).map(([key, name], i) => ({ id: ex(key), name, createdAt: 1000 + i }));
  const days = [
    { id: 'dev_plan_push', name: 'Push', keys: ['bank', 'schulter', 'trizeps'] },
    { id: 'dev_plan_pull', name: 'Pull', keys: ['klimm', 'rudern', 'curls'] },
    { id: 'dev_plan_beine', name: 'Beine', keys: ['knie', 'presse', 'waden'] },
  ];
  const plans = days.map((d, order) => ({ id: d.id, name: d.name, order, exerciseIds: d.keys.map(ex), createdAt: 2000 + order }));
  const base = { bank: 57.5, schulter: 32.5, trizeps: 22.5, klimm: 0, rudern: 50, curls: 15, knie: 80, presse: 140, waden: 60 };
  const reps = { bank: [8, 8, 7], schulter: [10, 9, 8], trizeps: [null, null, null], klimm: [8, 7, 6], rudern: [10, 10, 9], curls: [12, 10, 10], knie: [8, 8, 6], presse: [12, 12, 10], waden: [15, 15, 15] };
  const offsets = [26, 24, 22, 19, 17, 15, 12, 10, 7, 5, 3];
  const seen = {};
  const workouts = offsets.map((daysAgo, k) => {
    const day = days[k % 3];
    const start = at(daysAgo);
    const sets = [];
    day.keys.forEach((key) => {
      seen[key] = (seen[key] || 0) + 1;
      const weight = base[key] + Math.floor((seen[key] - 1) / 2) * 2.5;
      reps[key].forEach((r, i) => {
        sets.push({ id: `dev_s_${k}_${key}_${i}`, exerciseId: ex(key), weight, ...(r ? { reps: r } : {}), at: start + (sets.length + 1) * 150000 });
      });
    });
    return {
      id: `dev_w_${k}`, date: iso(new Date(start)), planId: day.id, startedAt: start, endedAt: start + 65 * 60000,
      exerciseIds: day.keys.map(ex), sets, createdAt: start,
    };
  });
  const body = [26, 19, 12, 5].map((daysAgo, i) => ({
    id: `dev_b_${i}`, date: iso(new Date(at(daysAgo, 8))), weight: [83.0, 82.6, 82.1, 81.7][i], createdAt: at(daysAgo, 8),
  }));
  return { exercises, plans, workouts, body };
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
    localStorage.setItem('focusflow_guest_gym', JSON.stringify(buildSeedGym()));
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
