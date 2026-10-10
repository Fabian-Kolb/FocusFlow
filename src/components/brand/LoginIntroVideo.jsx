import React from 'react';
import { Card } from '../ds';

/**
 * Erklär-Video unter der Login-Karte: Video links, kurzer Text rechts (ab lg).
 * Bausteine und Tokens aus dem Design-System (Regel 01). Kein Autoplay mit Ton:
 * das Video lädt erst beim Abspielen (preload none) und zeigt bis dahin das Vorschaubild.
 */
function LoginIntroVideo() {
  return (
    <section aria-labelledby="intro-video-title" className="mx-auto w-full max-w-[1120px] px-4 pb-16 md:px-6">
      <Card padding="md" className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <video
          className="block w-full rounded-lg border border-subtle bg-muted"
          src="/focusflow-intro.mp4"
          poster="/focusflow-intro-poster.jpg"
          controls
          playsInline
          preload="none"
        >
          Dein Browser kann dieses Video nicht abspielen.
        </video>
        <div className="max-w-prose">
          <p className="text-eyebrow text-secondary">So funktioniert FocusFlow</p>
          <h2 id="intro-video-title" className="mt-2 text-title text-primary">FocusFlow in 30 Sekunden</h2>
          <p className="mt-3 text-body-lg text-secondary">
            Gedanken festhalten, Fio ordnet sie, und aus ihnen werden Erinnerungen, Termine und Projekte. Probier es direkt im Browser aus.
          </p>
        </div>
      </Card>
    </section>
  );
}

export default LoginIntroVideo;
