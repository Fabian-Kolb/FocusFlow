import React from 'react';
import { Button, IconButton } from '../../ds';
import WordmarkSvg from '../WordmarkSvg';
import useScrollReveal from '../useScrollReveal';
import { LEGAL_PATHS } from '../../../lib/legal';
import { LEAD_TYPE, SECTION_TYPE } from './landingType';

const LINK_CLASS = 'rounded-xs py-1 text-caption text-secondary transition-colors duration-fast hover:text-primary';

/**
 * Ende der Startseite: ehrlicher Hinweis (privat, auf Einladung), letzter Aufruf mit Gast-Knopf, dann der Footer mit
 * Nutzungshinweisen, Datenschutz, Impressum und dem Umschalter für Hell/Dunkel.
 */
function LandingClosing({ onGuest, onSignIn, onShowTerms, isDark, onToggleTheme, guestDisabled, footerRef }) {
  const [ref, style] = useScrollReveal();
  return (
    <>
      <section aria-labelledby="landing-closing-title" className="bg-subtle">
        <div ref={ref} style={style} className="mx-auto flex w-full max-w-reading flex-col items-center px-4 py-24 text-center md:px-6 lg:py-32">
          <p className="text-eyebrow text-secondary">Privat. Auf Einladung.</p>
          <h2 id="landing-closing-title" className="mt-3 text-display text-primary" style={SECTION_TYPE}>Bereit für einen<br />freien Kopf?</h2>
          <p className="mt-4 text-secondary" style={LEAD_TYPE}>
            FocusFlow ist ein privates Projekt für einen kleinen Kreis. Als Gast kannst du trotzdem alles sofort ausprobieren.
          </p>
          <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" leadingIcon="explore" onClick={onGuest} disabled={guestDisabled} className="w-full sm:w-auto">Als Gast ausprobieren</Button>
            <Button size="lg" variant="secondary" onClick={onSignIn} className="w-full sm:w-auto">Anmelden</Button>
          </div>
        </div>
      </section>

      <footer ref={footerRef} className="border-t border-subtle">
        <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center text-primary" aria-label="FocusFlow">
            <div style={{ height: 22, width: 22 * (400 / 165) }}><WordmarkSvg word="FOCUS" /></div>
            <div style={{ height: 22, width: 22 * (400 / 165), marginLeft: -4 }}><WordmarkSvg word="FLOW" /></div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <button type="button" onClick={onShowTerms} className={LINK_CLASS}>Nutzungshinweise</button>
            <a href={LEGAL_PATHS.datenschutz} className={LINK_CLASS}>Datenschutz</a>
            <a href={LEGAL_PATHS.impressum} className={LINK_CLASS}>Impressum</a>
            <IconButton
              icon={isDark ? 'light_mode' : 'dark_mode'}
              label={isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
              size="sm"
              onClick={onToggleTheme}
            />
          </div>
        </div>
      </footer>
    </>
  );
}

export default LandingClosing;
