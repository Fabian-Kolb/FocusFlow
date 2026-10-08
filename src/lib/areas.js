// Bereichsfarben: Farbe nur im kleinen Icon-Chip und im aktiven Navigationspunkt, Flächen bleiben neutral.
// Klassen stehen vollständig ausgeschrieben, damit Tailwind sie findet.
export const AREAS = {
  dashboard: { chip: 'bg-accent-soft text-accent', activeText: 'text-accent-strong', activeBg: 'bg-accent-soft', dot: 'bg-accent' },
  inbox: { chip: 'bg-area-thoughts-soft text-area-thoughts', activeText: 'text-area-thoughts', activeBg: 'bg-area-thoughts-soft', dot: 'bg-area-thoughts' },
  reminders: { chip: 'bg-area-reminders-soft text-area-reminders', activeText: 'text-area-reminders', activeBg: 'bg-area-reminders-soft', dot: 'bg-area-reminders' },
  projects: { chip: 'bg-area-projects-soft text-area-projects', activeText: 'text-area-projects', activeBg: 'bg-area-projects-soft', dot: 'bg-area-projects' },
  board: { chip: 'bg-area-projects-soft text-area-projects', activeText: 'text-area-projects', activeBg: 'bg-area-projects-soft', dot: 'bg-area-projects' },
  calendar: { chip: 'bg-area-calendar-soft text-area-calendar', activeText: 'text-area-calendar', activeBg: 'bg-area-calendar-soft', dot: 'bg-area-calendar' },
  review: { chip: 'bg-area-review-soft text-area-review', activeText: 'text-area-review', activeBg: 'bg-area-review-soft', dot: 'bg-area-review' },
  coach: { chip: 'bg-primary text-white', activeText: 'text-primary', activeBg: 'bg-surface-low', dot: 'bg-primary' },
  trash: { chip: 'bg-surface-low text-on-surface-variant', activeText: 'text-primary', activeBg: 'bg-surface-low', dot: 'bg-on-surface-variant' },
};

export const areaOf = (id) => AREAS[id] || AREAS.dashboard;
