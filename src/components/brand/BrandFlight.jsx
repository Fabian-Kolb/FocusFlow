import React, { useEffect, useRef, useState } from 'react';
import WordmarkSvg from './WordmarkSvg';
import { WORDMARK_FRAME } from './focusFlowWordmarkData';
import { F_GLYPH } from './wordmarkPaths';
import { STAGE_PAD_X, STAGE_PAD_Y } from './wordmarkStage';
import { peekBrandHandoff, clearBrandHandoff } from '../../lib/brandTransition';

const WORDS = ['FOCUS', 'FLOW'];
const DURATION = 1150;
const STAGGER = 110;
const EASING = 'cubic-bezier(0.55, 0, 0.1, 1)';

// Tatsächliche Deckkraft eines Elements inklusive aller Eltern
function effectiveOpacity(el) {
  let o = 1;
  for (let n = el; n && n !== document.body; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
  return o;
}

function usableRect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const ok = r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && effectiveOpacity(el) > 0.5;
  return ok ? r : null;
}

// Zielfläche für die Wortbox so, dass das F des Wortes genau auf dem Ziel-F liegt
function boxForF(target) {
  const scale = target.width / (F_GLYPH.x1 - F_GLYPH.x0);
  return {
    left: target.left - (F_GLYPH.x0 + WORDMARK_FRAME.width / 2) * scale,
    top: target.top - (F_GLYPH.y0 + WORDMARK_FRAME.height / 2) * scale,
    width: WORDMARK_FRAME.width * scale,
    height: WORDMARK_FRAME.height * scale,
  };
}

/**
 * Nach dem Login fliegen die beiden 3D-Wörter (als Standbild, vorher gerade ausgerichtet) an ihren Platz in der App:
 * - Sidebar offen: ins Logo FOCUS FLOW (`[data-brand-word]`), das Standbild blendet in die flache Fassung über.
 * - Sidebar eingeklappt: schrumpfen auf die beiden F der Bildmarke (`[data-brand-f]`), die übrigen Buchstaben verschwinden.
 * - Kein Ziel sichtbar (Handy): nach oben aus dem Bild.
 * Läuft nur direkt nach einem Login, sonst passiert nichts.
 */
function BrandFlight() {
  const [handoff] = useState(() => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? null : peekBrandHandoff()));
  const [done, setDone] = useState(false);
  const refs = useRef({});

  useEffect(() => {
    if (!handoff) {
      clearBrandHandoff();
      return undefined;
    }
    const hidden = [];
    const animations = WORDS.flatMap((word, i) => {
      const box = refs.current[word];
      const flat = box.querySelector('[data-flat]');
      const flatF = box.querySelector('[data-flatf]');
      const still = box.querySelector('[data-still]');
      const s = handoff[word];

      const wordTarget = document.querySelector(`[data-brand-word="${word}"]`);
      const wordRect = usableRect(wordTarget);
      const fTarget = wordRect ? null : document.querySelector(`[data-brand-f="${word}"]`);
      const fRect = usableRect(fTarget);
      const target = wordRect ? wordTarget : fTarget;
      const mode = wordRect ? 'word' : fRect ? 'f' : 'up';
      const e = mode === 'word'
        ? wordRect
        : mode === 'f'
          ? boxForF(fRect)
          : { left: s.left, top: -s.height * 1.4, width: s.width, height: s.height };
      const endColor = target && mode !== 'up' ? getComputedStyle(target).color : 'rgb(0, 0, 0)';
      if (mode !== 'up') {
        const hideEl = target.closest('[data-brand-hide]') || target;
        hideEl.style.visibility = 'hidden';
        hidden.push(hideEl);
      }

      Object.assign(box.style, { left: `${e.left}px`, top: `${e.top}px`, width: `${e.width}px`, height: `${e.height}px` });
      const timing = { duration: DURATION, delay: i * STAGGER, easing: EASING, fill: 'both' };
      const linear = { ...timing, easing: 'linear' };
      const list = [
        box.animate(
          [
            { transform: `translate(${s.left - e.left}px, ${s.top - e.top}px) scale(${s.width / e.width}, ${s.height / e.height})`, opacity: 1 },
            { transform: 'translate(0, 0) scale(1, 1)', opacity: mode === 'up' ? 0 : 1 },
          ],
          timing,
        ),
      ];

      // Standbild blendet aus, die flache Fassung (Wort oder nur das F) ab dem ersten Drittel ein
      const fadeIn = (color) => [
        { opacity: 0, color }, { opacity: 0, color, offset: 0.3 }, { opacity: 1, color },
      ];
      const fadeOut = [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.8 }, { opacity: 0 }];
      if (still) list.push(still.animate(fadeOut, linear));
      if (mode === 'f') {
        // ohne Standbild startet das flache Wort sichtbar und weicht dem F
        if (!still) list.push(flat.animate(fadeOut, linear));
        list.push(flatF.animate(fadeIn(endColor), linear));
      } else if (still) {
        list.push(flat.animate(fadeIn(endColor), linear));
      } else {
        list.push(flat.animate([{ opacity: 1, color: endColor }, { opacity: 1, color: endColor }], linear));
      }
      return list;
    });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      hidden.forEach((el) => { el.style.visibility = ''; });
      clearBrandHandoff();
      setDone(true);
    };
    const timer = setTimeout(finish, DURATION + STAGGER + 80);

    return () => {
      clearTimeout(timer);
      animations.forEach((a) => a.cancel());
      hidden.forEach((el) => { el.style.visibility = ''; });
    };
  }, [handoff]);

  if (!handoff || done) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-palette overflow-hidden" aria-hidden="true">
      {WORDS.map((word) => (
        <div
          key={word}
          ref={(el) => { refs.current[word] = el; }}
          className="absolute"
          style={{ transformOrigin: 'top left', left: handoff[word].left, top: handoff[word].top, width: handoff[word].width, height: handoff[word].height }}
        >
          <div data-flat className="absolute inset-0 text-primary" style={{ opacity: handoff[word].image ? 0 : 1 }}>
            <WordmarkSvg word={word} />
          </div>
          <div data-flatf className="absolute inset-0 text-primary" style={{ opacity: 0 }}>
            <WordmarkSvg word="FOCUS" onlyFirst />
          </div>
          {handoff[word].image && (
            <img
              data-still
              src={handoff[word].image}
              alt=""
              draggable={false}
              className="absolute max-w-none"
              style={{
                left: `${-STAGE_PAD_X * 100}%`,
                top: `${-STAGE_PAD_Y * 100}%`,
                width: `${(1 + 2 * STAGE_PAD_X) * 100}%`,
                height: `${(1 + 2 * STAGE_PAD_Y) * 100}%`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default BrandFlight;
