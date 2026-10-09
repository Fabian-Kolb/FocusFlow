import React, { useRef, useState } from 'react';

import { Icon } from '../ds';
const AXIS_LOCK_PX = 10;      // ab hier wird entschieden: horizontal wischen oder vertikal scrollen
const COMMIT_RATIO = 0.35;    // Anteil der Kartenbreite, ab dem die Aktion ausgelöst wird
const COMMIT_MIN_PX = 90;
const MAX_PULL_RATIO = 0.9;

/**
 * Wischgesten für Karten (nur Touch, Maus bleibt unberührt):
 *  - nach rechts wischen → `right`-Aktion (z. B. Erledigt)
 *  - nach links wischen  → `left`-Aktion (z. B. Papierkorb)
 * Vertikales Scrollen bleibt erhalten (`touch-action: pan-y`), Long-Press-Ziehen
 * (useBoardSort) bricht bei Bewegung > 8 px von selbst ab.
 *
 * @param {{ label: string, icon: string, className: string, onCommit: () => void, dismiss?: boolean }} left/right
 *   `dismiss`: Karte fliegt nach dem Auslösen hinaus (z. B. beim Löschen), sonst schnappt sie zurück.
 */
export default function SwipeableCard({ left, right, disabled = false, children, className = '' }) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const containerRef = useRef(null);

  const reset = () => {
    setAnimating(true);
    setDx(0);
    setTimeout(() => setAnimating(false), 200);
  };

  const onTouchStart = (e) => {
    if (disabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    gesture.current = {
      startX: t.clientX,
      startY: t.clientY,
      axis: null,
      width: containerRef.current?.offsetWidth || 300,
      armed: false
    };
  };

  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    // Long-Press-Ziehen hat übernommen → Wischgeste verwerfen
    if (disabled) {
      gesture.current = null;
      if (dx !== 0) setDx(0);
      return;
    }
    const t = e.touches[0];
    const moveX = t.clientX - g.startX;
    const moveY = t.clientY - g.startY;

    if (!g.axis) {
      if (Math.abs(moveX) < AXIS_LOCK_PX && Math.abs(moveY) < AXIS_LOCK_PX) return;
      g.axis = Math.abs(moveX) > Math.abs(moveY) * 1.2 ? 'x' : 'y';
    }
    if (g.axis !== 'x') return;

    // Ohne passende Aktion in diese Richtung nur leichten Widerstand zeigen
    const action = moveX > 0 ? right : left;
    const limit = g.width * MAX_PULL_RATIO;
    const next = action ? Math.max(-limit, Math.min(limit, moveX)) : moveX * 0.15;
    setDx(next);

    const threshold = Math.max(COMMIT_MIN_PX, g.width * COMMIT_RATIO);
    const armed = Boolean(action) && Math.abs(next) >= threshold;
    if (armed !== g.armed) {
      g.armed = armed;
      if (armed) navigator.vibrate?.(10);
    }
  };

  const onTouchEnd = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== 'x') return;

    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 50);

    const action = dx > 0 ? right : left;
    if (!g.armed || !action) {
      reset();
      return;
    }

    if (action.dismiss) {
      setAnimating(true);
      setDx(dx > 0 ? g.width : -g.width);
      setTimeout(() => {
        action.onCommit();
        setAnimating(false);
        setDx(0);
      }, 180);
    } else {
      action.onCommit();
      reset();
    }
  };

  const active = dx !== 0;
  const shown = dx > 0 ? right : left;
  const armedNow = Boolean(gesture.current?.armed);

  return (
    <div
      ref={containerRef}
      className={`relative ${active ? 'overflow-hidden rounded-lg' : ''} ${className}`}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={reset}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {active && shown && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center px-5 text-on-accent text-body-strong transition-colors ${
            dx > 0 ? 'justify-start' : 'justify-end'
          } ${armedNow ? shown.className : 'bg-control'}`}
        >
          <span className="flex items-center gap-2">
            <Icon name={shown.icon} size="lg" />
            {shown.label}
          </span>
        </div>
      )}
      <div
        className="relative h-full"
        style={{
          transform: active ? `translateX(${dx}px)` : undefined,
          transition: animating ? 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
}
