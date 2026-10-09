/**
 * FocusFlow Design-System als Tailwind-Preset (Tailwind 3).
 * Jede Farbe, jeder Radius, Schatten, z-Index und jede Dauer zeigt auf eine CSS-Variable aus tokens.css.
 * Hell/Dunkel wechselt über <html data-theme="light|dark">. Rohe Paletten (red-500, neutral-900 …) gibt es
 * bewusst nicht: nur die semantischen Namen unten (Regel 01).
 */
const v = (n) => `var(--${n})`;
const pick = (prefix, names) => Object.fromEntries(names.map((n) => [n, v(`${prefix}-${n}`)]));
const areas = ['thoughts', 'reminders', 'projects', 'calendar', 'review'];
const areaFg = Object.fromEntries(areas.map((a) => [`area-${a}`, v(`area-${a}`)]));
const areaBg = Object.fromEntries(areas.map((a) => [`area-${a}-subtle`, v(`area-${a}-subtle`)]));
const base = { transparent: 'transparent', current: 'currentColor', inherit: 'inherit' };

const bg = { ...base,
  ...pick('bg', ['canvas', 'surface', 'subtle', 'muted', 'raised', 'hover', 'pressed', 'selected', 'inverse', 'scrim',
    'accent', 'accent-hover', 'accent-pressed', 'accent-subtle', 'success', 'success-subtle', 'info', 'info-subtle',
    'warning', 'warning-subtle', 'danger', 'danger-hover', 'danger-subtle']),
  ...areaBg, ...areaFg, 'control': v('border-control'), white: v('neutral-0') };
const text = { ...base,
  ...pick('text', ['primary', 'secondary', 'tertiary', 'disabled', 'inverse', 'on-accent', 'accent', 'success', 'info', 'warning', 'danger']),
  ...areaFg };
const border = { ...base, DEFAULT: v('border-default'),
  ...pick('border', ['subtle', 'default', 'control', 'strong', 'accent', 'success', 'info', 'warning', 'danger']),
  'danger-strong': v('text-danger'), focus: v('focus-ring') };

export default {
  theme: {
    colors: base,
    backgroundColor: bg,
    textColor: text,
    borderColor: border,
    divideColor: border,
    outlineColor: { ...border },
    ringColor: { ...base, DEFAULT: v('focus-ring'), focus: v('focus-ring'), danger: v('text-danger') },
    ringOffsetColor: { ...base, canvas: v('bg-canvas'), surface: v('bg-surface') },
    placeholderColor: { tertiary: v('text-tertiary') },
    caretColor: { accent: v('text-accent') },
    fill: { ...base }, stroke: { ...base },
    gradientColorStops: base,
    fontFamily: { sans: v('font-sans'), label: v('font-label'), code: v('font-code') },
    fontSize: {
      display: ['32px', { lineHeight: '40px', letterSpacing: '-0.025em', fontWeight: '700' }],
      'title-lg': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '700' }],
      title: ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '700' }],
      heading: ['18px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '600' }],
      subheading: ['16px', { lineHeight: '24px', fontWeight: '600' }],
      'body-lg': ['16px', { lineHeight: '24px', fontWeight: '450' }],
      body: ['14px', { lineHeight: '20px', fontWeight: '450' }],
      'body-strong': ['14px', { lineHeight: '20px', fontWeight: '600' }],
      caption: ['12px', { lineHeight: '16px', fontWeight: '450' }],
      'caption-strong': ['12px', { lineHeight: '16px', fontWeight: '600' }],
      micro: ['11px', { lineHeight: '14px', fontWeight: '500' }],
      'label-lg': ['16px', { lineHeight: '24px', fontWeight: '550' }],
      label: ['14px', { lineHeight: '20px', fontWeight: '550' }],
      'label-sm': ['13px', { lineHeight: '18px', fontWeight: '550' }],
      eyebrow: ['12px', { lineHeight: '16px', letterSpacing: '0.06em', fontWeight: '700' }],
      stat: ['28px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '700' }],
      code: ['13px', { lineHeight: '20px', fontWeight: '450' }],
    },
    borderRadius: { none: '0', xs: v('radius-xs'), sm: v('radius-sm'), md: v('radius-md'), lg: v('radius-lg'), xl: v('radius-xl'), full: v('radius-full') },
    boxShadow: { none: 'none', xs: v('shadow-xs'), sm: v('shadow-sm'), md: v('shadow-md'), lg: v('shadow-lg'), sheet: v('shadow-sheet') },
    zIndex: { 0: '0', 10: '10', nav: v('z-nav'), dropdown: v('z-dropdown'), sheet: v('z-sheet'), dialog: v('z-dialog'), toast: v('z-toast'), tooltip: v('z-tooltip'), palette: v('z-palette') },
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1344px' },
    extend: {
      transitionDuration: { instant: v('duration-instant'), fast: v('duration-fast'), base: v('duration-base'), slow: v('duration-slow'), slower: v('duration-slower') },
      transitionTimingFunction: { standard: v('easing-standard'), enter: v('easing-enter'), exit: v('easing-exit') },
      width: { drawer: v('drawer-width') },
      // content: Seitenbreite der Screens (1120 px), reading: Lesespalte (680 px), siehe Regel 01
      maxWidth: { drawer: v('drawer-width'), content: '1120px', reading: '680px' },
    },
  },
};
