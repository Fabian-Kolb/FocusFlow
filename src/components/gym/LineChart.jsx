import React, { useState } from 'react';
import { cx } from '../ds';

const W = 320;
const H = 160;
const PAD = { left: 40, right: 12, top: 12, bottom: 24 };

/**
 * Schlichtes Liniendiagramm für eine Reihe (ein Strich, Akzentfarbe, ruhige Achsen). Die Punkte stehen in gleichem
 * Abstand (Trainings sind nicht gleichmäßig verteilt). Antippen oder Darüberfahren zeigt den Wert; die Tabelle
 * darunter auf der Seite ist die Alternative für Screenreader.
 *
 * @param {{ points: { key: string, label: string, value: number, valueText: string }[], ariaLabel: string, formatY?: (n: number) => string, className?: string }} props
 */
export default function LineChart({ points, ariaLabel, formatY = (n) => String(Math.round(n * 10) / 10), className = '' }) {
  const [hover, setHover] = useState(null);
  if (!points || points.length === 0) return null;

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const y = (v) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];
  const active = hover === null ? points.length - 1 : hover;
  const tipLeft = Math.min(88, Math.max(12, (x(active) / W) * 100));

  const pick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(nearest) - px)) nearest = i; });
    setHover(nearest);
  };

  return (
    <div className={cx('relative', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
        <g className="text-tertiary">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fill="currentColor" className="text-micro">{formatY(t)}</text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} textAnchor="start" fill="currentColor" className="text-micro">{points[0].label}</text>
          {points.length > 1 && <text x={W - PAD.right} y={H - 6} textAnchor="end" fill="currentColor" className="text-micro">{points[points.length - 1].label}</text>}
        </g>
        <g className="text-accent">
          {points.length > 1 && <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((p, i) => (
            <circle key={p.key} cx={x(i)} cy={y(p.value)} r={i === active ? 5 : 3} fill="currentColor" />
          ))}
        </g>
        <rect
          x="0" y="0" width={W} height={H} fill="transparent"
          onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}
        />
      </svg>
      <div
        className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-default bg-raised px-2 py-1 text-caption shadow-md"
        style={{ left: `${tipLeft}%` }}
      >
        <span className="text-caption-strong text-primary">{points[active].valueText}</span>
        <span className="ml-1 text-secondary">{points[active].label}</span>
      </div>
    </div>
  );
}
