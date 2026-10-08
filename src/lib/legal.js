// Zentrale Angaben für Impressum & Datenschutzerklärung.
// TODO vor Release: Platzhalter in eckigen Klammern durch echte Angaben ersetzen.
// Solange Platzhalter enthalten sind, zeigt die Rechtsseite einen Entwurfs-Hinweis.
export const LEGAL_OPERATOR = {
  name: '[Vorname Nachname]',
  street: '[Straße Hausnummer]',
  city: '[PLZ Ort]',
  country: 'Deutschland',
  email: '[kontakt@deine-domain.de]',
  phone: '' // optional; E-Mail reicht nicht immer – ggf. Telefon oder Kontaktformular ergänzen
};

export const LEGAL_LAST_UPDATED = '08.10.2026';

export const LEGAL_PATHS = {
  impressum: '/impressum',
  datenschutz: '/datenschutz'
};

export function getLegalPageFromPath(pathname = '') {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === LEGAL_PATHS.impressum) return 'impressum';
  if (clean === LEGAL_PATHS.datenschutz) return 'datenschutz';
  return null;
}

export function hasLegalPlaceholders() {
  return Object.values(LEGAL_OPERATOR).some((v) => typeof v === 'string' && /\[.*\]/.test(v));
}
