/**
 * Große Überschriften der Startseite. Bewusste Abweichung vom Design System (größter Textstil dort: `text-display`, 32 px):
 * Eine Marken-Startseite braucht Überschriften im Apple-Maßstab. Gilt nur für src/components/brand/landing.
 * Vorschlag fürs Design-System-Artefakt: eigener Stil `text-hero` (siehe docs/Wissen/12_3D_Branding_und_Landingpage).
 * Klassen: `text-display` (Schrift, Gewicht, Laufweite), Größe und Zeilenhöhe kommen von hier.
 */
export const HERO_TYPE = { fontSize: 'clamp(2.5rem, 6.2vw, 4.75rem)', lineHeight: 1.04, letterSpacing: '-0.035em' };
export const SECTION_TYPE = { fontSize: 'clamp(2rem, 4.6vw, 3.5rem)', lineHeight: 1.06, letterSpacing: '-0.03em' };
export const STEP_TYPE = { fontSize: 'clamp(1.75rem, 3.4vw, 2.75rem)', lineHeight: 1.1, letterSpacing: '-0.025em' };
export const LEAD_TYPE = { fontSize: 'clamp(1.0625rem, 1.6vw, 1.3125rem)', lineHeight: 1.5 };
