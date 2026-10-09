import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { WORDMARK, WORDMARK_FRAME } from './focusFlowWordmarkData';
import { toPath, F_GLYPH, FF_OFFSET } from './wordmarkPaths';

const FW = WORDMARK_FRAME.width;
const FH = WORDMARK_FRAME.height;
const OVERLAP = 27.5; // FOCUS und FLOW überlappen sich um den leeren Rand der Rahmen
const FLOW_X = FW - OVERLAP;
const TOTAL_W = FLOW_X + FW;
const HEIGHT_PX = 36;
const SCALE = HEIGHT_PX / FH;
const RAIL_WIDTH = 72; // Breite der eingeklappten Sidebar
const LEFT_PX = 16; // Abstand des Logos zum linken Rand der Sidebar
const EXPANDED_WIDTH = 256; // Breite der offenen Sidebar
const SETTLE_MS = 1500; // Sicherheitsgrenze für die Synchronisation mit der Sidebar
const WORDS = ['FOCUS', 'FLOW'];

const xsOf = (flat) => flat.filter((_, i) => i % 2 === 0);
const centerX = (letter) => {
  const xs = letter.shapes.flatMap((s) => xsOf(s.outer));
  return (Math.min(...xs) + Math.max(...xs)) / 2;
};

const LETTERS = Object.fromEntries(WORDS.map((word) => [
  word,
  WORDMARK[word].letters.map((letter, i) => ({
    key: `${letter.char}-${i}`,
    cx: centerX(letter),
    shapes: letter.shapes,
    d: letter.shapes.map((s) => [toPath(s.outer), ...s.holes.map(toPath)].join(' ')).join(' '),
  })),
]));

// Das F von FLOW ist das F von FOCUS mit verlängertem Balken: Der Abschluss des Balkens (alle Punkte rechts
// von CAP_X) sitzt um BAR_SHIFT weiter rechts. Wird er zurückgeschoben, entsteht genau das F von FOCUS.
const CAP_X = -60;
const FLOW_BAR = WORDMARK.FLOW.letters[0].shapes[0].outer;
const BAR_SHIFT = Math.max(...xsOf(FLOW_BAR)) - Math.max(...xsOf(WORDMARK.FOCUS.letters[0].shapes[0].outer));
const flowBarPath = (shift) => toPath(FLOW_BAR.map((v, i) => (i % 2 === 0 && v > CAP_X ? v - shift : v)));
const FLOW_BODY_D = toPath(WORDMARK.FLOW.letters[0].shapes[1].outer);

const F_CENTER = (F_GLYPH.x0 + F_GLYPH.x1) / 2;
const F2_DX = FF_OFFSET - FLOW_X; // so weit wandert das F von FLOW nach links
const MARK_W_PX = (F_GLYPH.x1 - F_GLYPH.x0 + FF_OFFSET) * SCALE;
const CENTER_SHIFT_PX = (RAIL_WIDTH - MARK_W_PX) / 2 - (LEFT_PX + (FW / 2 + F_GLYPH.x0) * SCALE);

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const easeInOut = (v) => (v < 0.5 ? 4 * v * v * v : 1 - ((-2 * v + 2) ** 3) / 2);
const windowed = (p, from, len) => easeInOut(clamp01((p - from) / len));

const pct = (v, total) => `${(v / total) * 100}%`;

/**
 * Logo der Sidebar: FOCUS FLOW ausgeschrieben, eingeklappt nur die beiden F (FF-Bildmarke, zugleich App-Icon).
 * Beim Umschalten bleiben die beiden F stehen, alle anderen Buchstaben schieben sich in sie hinein und verschwinden,
 * das F von FLOW wandert nach links und verkürzt dabei seinen Balken auf die Länge des F von FOCUS.
 * Der Fortschritt wird jedes Bild aus der echten Breite der Sidebar abgeleitet, damit beides synchron läuft.
 * Die unsichtbaren Flächen (`data-brand-word` / `data-brand-f`) sind das Ziel des Flugs nach dem Login.
 */
function BrandLockup({ collapsed }) {
  const rootRef = useRef(null);
  const letterRefs = useRef({});
  const barRef = useRef(null);
  const progress = useRef(collapsed ? 1 : 0);
  const rafRef = useRef(0);

  const apply = useCallback((p) => {
    const setLetter = (word, i, tx, opacity) => {
      const g = letterRefs.current[`${word}-${i}`];
      if (!g) return;
      g.setAttribute('transform', `translate(${tx.toFixed(2)} 0)`);
      g.setAttribute('opacity', opacity.toFixed(3));
    };
    WORDS.forEach((word) => {
      // FOCUS bleibt stehen, das F von FLOW wandert nach links
      const count = LETTERS[word].length;
      const fTx = word === 'FLOW' ? windowed(p, 0.04, 0.7) * F2_DX : 0;
      setLetter(word, 0, fTx, 1);
      for (let i = 1; i < count; i++) {
        // Der rechte Rand der Sidebar kommt von rechts heran: Die äußeren Buchstaben gehen zuerst
        const from = (count - 1 - i) * 0.045;
        const slide = windowed(p, from, 0.5);
        const fade = 1 - easeInOut(clamp01((p - from) / 0.34));
        setLetter(word, i, fTx + slide * (F_CENTER - LETTERS[word][i].cx), fade);
      }
    });
    barRef.current?.setAttribute('d', flowBarPath(BAR_SHIFT * windowed(p, 0.15, 0.6)));
    if (rootRef.current) rootRef.current.style.transform = `translateX(${(CENTER_SHIFT_PX * windowed(p, 0, 1)).toFixed(2)}px)`;
  }, []);

  useLayoutEffect(() => {
    apply(progress.current);
  }, [apply]);

  // Der Fortschritt folgt Bild für Bild der tatsächlichen Breite der Sidebar (CSS-Übergang): Logo und Sidebar
  // schließen und öffnen sich dadurch exakt gleichzeitig, egal mit welcher Dauer oder Kurve die Sidebar läuft.
  useEffect(() => {
    const goal = collapsed ? 1 : 0;
    cancelAnimationFrame(rafRef.current);
    const aside = rootRef.current?.closest('aside');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (progress.current === goal) return undefined;
    if (!aside || reduced || aside.getBoundingClientRect().width < 1) {
      progress.current = goal;
      apply(goal);
      return undefined;
    }
    const started = performance.now();
    let steady = 0;
    const follow = (now) => {
      const width = aside.getBoundingClientRect().width;
      const p = clamp01((EXPANDED_WIDTH - width) / (EXPANDED_WIDTH - RAIL_WIDTH));
      progress.current = p;
      apply(p);
      // fertig, sobald die Breite ihr Ziel erreicht hat (oder nach der Sicherheitsgrenze)
      steady = Math.abs(p - goal) < 0.002 ? steady + 1 : 0;
      if (steady >= 2 || now - started > SETTLE_MS) {
        progress.current = goal;
        apply(goal);
        return;
      }
      rafRef.current = requestAnimationFrame(follow);
    };
    rafRef.current = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(rafRef.current);
  }, [collapsed, apply]);

  const fLeft = FW / 2 + F_GLYPH.x0;
  const fWidth = F_GLYPH.x1 - F_GLYPH.x0;

  return (
    <span
      ref={rootRef}
      role="img"
      aria-label="FocusFlow"
      data-brand-hide
      className="relative block shrink-0 text-primary select-none will-change-transform"
      style={{ height: HEIGHT_PX, width: TOTAL_W * SCALE }}
    >
      <svg
        viewBox={`0 0 ${TOTAL_W} ${FH}`}
        className="absolute inset-0 w-full h-full overflow-visible"
        fill="currentColor"
        aria-hidden="true"
      >
        {WORDS.map((word, wi) => (
          <g key={word} transform={`translate(${FW / 2 + wi * FLOW_X} ${FH / 2})`}>
            {LETTERS[word].map((letter, i) => (
              <g key={letter.key} ref={(el) => { letterRefs.current[`${word}-${i}`] = el; }}>
                {word === 'FLOW' && i === 0 ? (
                  <>
                    <path ref={barRef} fillRule="evenodd" d={flowBarPath(0)} />
                    <path fillRule="evenodd" d={FLOW_BODY_D} />
                  </>
                ) : (
                  <path fillRule="evenodd" d={letter.d} />
                )}
              </g>
            ))}
          </g>
        ))}
      </svg>
      {collapsed
        ? WORDS.map((word, wi) => (
          <span
            key={word}
            data-brand-f={word}
            aria-hidden="true"
            className="absolute"
            style={{
              left: pct(fLeft + wi * FF_OFFSET, TOTAL_W),
              width: pct(fWidth, TOTAL_W),
              top: pct(F_GLYPH.y0 + FH / 2, FH),
              height: pct(F_GLYPH.y1 - F_GLYPH.y0, FH),
            }}
          />
        ))
        : WORDS.map((word, wi) => (
          <span
            key={word}
            data-brand-word={word}
            aria-hidden="true"
            className="absolute top-0 bottom-0"
            style={{ left: pct(wi * FLOW_X, TOTAL_W), width: pct(FW, TOTAL_W) }}
          />
        ))}
    </span>
  );
}

export default BrandLockup;
