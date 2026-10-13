import { useLayoutEffect, useState } from 'react';

const RATIO = 400 / 165; // Seitenverhältnis eines Wortes (WordmarkWord: aspect-[400/165])
const TOP = 12; // Abstand der kompakten Wörter zum oberen Rand (px)
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
// Ganz klein wirken die 3D-Buchstaben unruhig: am Ende der Bewegung auf den flachen Schriftzug überblenden
export const flatFade = (progress) => clamp01((progress - 0.85) / 0.15);
export const compactHeight = (vw) => (vw < 1024 ? 30 : 36);
const easeOut = (v) => 1 - (1 - v) ** 3;

/**
 * FOCUS und FLOW auf der Startseite: Die Wörter liegen als fixierte Ebene über der Seite. Ihre Ruheposition kommt von
 * Platzhaltern im Layout (`slotRefs`). Beim Herunterscrollen gleiten sie, nur abhängig vom Scroll-Fortschritt, nebeneinander
 * oben in die Mitte und werden klein. Weil sie fixiert sind und nicht mit der Seite mitlaufen, ruckelt nichts, auch nicht
 * bei schnellem Scrollen; oben angekommen stehen sie fest.
 *
 * Die aktuelle Transformation steht zusätzlich in `data-compact`, damit das Zentrieren beim Login sie mitnehmen kann
 * (Login.jsx, centerWords). Bei reduzierter Bewegung stehen die Wörter einfach an ihrem Platz und scrollen mit;
 * `reduced` und `progress` steuern dann den flachen Schriftzug oben (CompactWordmarkBar).
 */
export default function useFloatingWordmark(slotRefs, wordRefs, { enabled = true } = {}) {
  const [state, setState] = useState({ progress: 0, reduced: false, th: 30 });

  useLayoutEffect(() => {
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let base = null;
    let frame = 0;

    const nodes = () => ({
      slots: slotRefs.map((r) => r.current),
      words: wordRefs.map((r) => r.current),
    });

    const measure = () => {
      const { slots } = nodes();
      if (slots.some((s) => !s)) return;
      base = slots.map((s) => {
        const r = s.getBoundingClientRect();
        return { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height, ox: s.offsetLeft, oy: s.offsetTop };
      });
    };

    const apply = () => {
      frame = 0;
      // Während des Login-Übergangs müssen die 3D-Wörter sichtbar sein (sie fliegen in die App)
      if (!enabled) { nodes().words.forEach((w) => { if (w) w.style.opacity = ''; }); return; }
      if (!base) return;
      const { words } = nodes();
      if (words.some((w) => !w)) return;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const end = Math.max(160, vh * 0.55);
      const progress = clamp01(window.scrollY / end);

      if (mqReduced.matches) {
        words.forEach((el, i) => {
          const b = base[i];
          Object.assign(el.style, { position: 'absolute', left: `${b.ox}px`, top: `${b.oy}px`, width: `${b.w}px`, height: `${b.h}px`, transform: '', maxWidth: 'none', opacity: '' });
          el.dataset.compact = '';
        });
        setState((s) => (s.progress === progress && s.reduced ? s : { progress, reduced: true, th: compactHeight(vw) }));
        return;
      }

      const e = easeOut(progress);
      const th = compactHeight(vw);
      const fade = flatFade(progress);
      const tw = th * RATIO;
      const overlap = tw * 0.08; // die Rahmen der Wörter haben leeren Rand
      const targets = [{ x: vw / 2 - tw + overlap / 2, y: TOP }, { x: vw / 2 - overlap / 2, y: TOP }];
      words.forEach((el, i) => {
        const b = base[i];
        const x = b.x + (targets[i].x - b.x) * e;
        const y = b.y + (targets[i].y - b.y) * e;
        const s = 1 + (tw / b.w - 1) * e;
        const t = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
        Object.assign(el.style, { position: 'fixed', left: '0px', top: '0px', width: `${b.w}px`, height: `${b.h}px`, maxWidth: 'none', transformOrigin: '0 0', transform: t, opacity: fade > 0 ? (1 - fade).toFixed(3) : '' });
        el.dataset.compact = t;
      });
      setState((s) => (s.progress === progress && !s.reduced && s.th === th ? s : { progress, reduced: false, th }));
    };

    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
    const remeasure = () => { measure(); apply(); };

    remeasure();
    const ro = new ResizeObserver(remeasure);
    nodes().slots.forEach((s) => s && ro.observe(s));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure);
    mqReduced.addEventListener?.('change', remeasure);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      mqReduced.removeEventListener?.('change', remeasure);
    };
    // slotRefs und wordRefs sind stabile Ref-Objekte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}
