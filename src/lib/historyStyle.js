// Verlaufseinträge speichern (aus älteren Versionen) Tailwind-Klassen in `badgeBg`/`iconStyle`.
// Gezeichnet wird nur noch nach Bedeutung: erledigt = grün, angelegt/gestartet = Akzent, sonst neutral.
export function historyTone(item) {
  if (item?.tone) return item.tone;
  const stored = `${item?.iconStyle || ''} ${item?.badgeBg || ''}`;
  if (/success|emerald|green/.test(stored)) return 'success';
  if (/accent|primary|blue/.test(stored)) return 'accent';
  return 'neutral';
}

export const HISTORY_MARK_CLASS = {
  success: 'border-success bg-success-subtle text-success',
  accent: 'border-accent bg-accent-subtle text-accent',
  neutral: 'border-default bg-subtle text-secondary',
};
