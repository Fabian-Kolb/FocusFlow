// Bereichsfarben: Farbe nur im kleinen Icon-Chip und im aktiven Navigationspunkt, Flächen bleiben neutral.
// Klassen stehen vollständig ausgeschrieben, damit Tailwind sie findet.
export const AREAS = {
  dashboard: { chip: 'bg-accent-subtle text-accent', activeText: 'text-accent', activeBg: 'bg-accent-subtle', dot: 'bg-accent' },
  inbox: { chip: 'bg-area-thoughts-subtle text-area-thoughts', activeText: 'text-area-thoughts', activeBg: 'bg-area-thoughts-subtle', dot: 'bg-area-thoughts' },
  reminders: { chip: 'bg-area-reminders-subtle text-area-reminders', activeText: 'text-area-reminders', activeBg: 'bg-area-reminders-subtle', dot: 'bg-area-reminders' },
  projects: { chip: 'bg-area-projects-subtle text-area-projects', activeText: 'text-area-projects', activeBg: 'bg-area-projects-subtle', dot: 'bg-area-projects' },
  board: { chip: 'bg-area-projects-subtle text-area-projects', activeText: 'text-area-projects', activeBg: 'bg-area-projects-subtle', dot: 'bg-area-projects' },
  calendar: { chip: 'bg-area-calendar-subtle text-area-calendar', activeText: 'text-area-calendar', activeBg: 'bg-area-calendar-subtle', dot: 'bg-area-calendar' },
  review: { chip: 'bg-area-review-subtle text-area-review', activeText: 'text-area-review', activeBg: 'bg-area-review-subtle', dot: 'bg-area-review' },
  coach: { chip: 'bg-inverse text-inverse', activeText: 'text-primary', activeBg: 'bg-subtle', dot: 'bg-inverse' },
  trash: { chip: 'bg-subtle text-secondary', activeText: 'text-primary', activeBg: 'bg-subtle', dot: 'bg-control' },
};

export const areaOf = (id) => AREAS[id] || AREAS.dashboard;

// Bereichs-Id → area-Name des IconTile-Bausteins (ds)
const TILE_AREAS = { dashboard: 'accent', inbox: 'thoughts', reminders: 'reminders', projects: 'projects', board: 'projects', calendar: 'calendar', review: 'review', coach: 'coach', trash: 'neutral' };
export const tileAreaOf = (id) => TILE_AREAS[id] || 'neutral';
