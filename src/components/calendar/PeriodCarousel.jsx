import React from 'react';
import { useMonthCarousel } from '../../hooks/useMonthCarousel';
import { cx } from '../ds';

/**
 * Wisch-Karussell für Monat, Woche und Tag: Vorheriger, aktueller und nächster Zeitraum sind gerendert,
 * Wischen zeigt also immer echten Inhalt. `renderSlide(delta)` liefert den Zeitraum -1, 0 oder +1.
 *
 * `scrollable`: Die Seiten sind höher als der Platz (Zeitraster). Der senkrechte Scroll-Container steht dann
 * außerhalb der Wischspur (`scrollRef`), so scrollen alle drei Seiten gemeinsam und der Kopf bleibt sticky.
 */
const PeriodCarousel = ({ onPrev, onNext, renderSlide, scrollable = false, scrollRef, className }) => {
  const carousel = useMonthCarousel({ onNext, onPrev });

  return (
    <div
      ref={carousel.containerRef}
      className={cx('relative min-h-0 flex-1 select-none overflow-hidden', className)}
      style={{ touchAction: 'pan-y' }}
      {...carousel.handlers}
    >
      <div
        ref={scrollRef}
        className={cx('h-full', scrollable ? 'no-scrollbar overflow-y-auto overflow-x-hidden' : 'overflow-hidden')}
      >
        <div
          className="flex w-full"
          style={{
            height: scrollable ? undefined : '100%',
            transform: `translateX(calc(-100% + ${carousel.swipeOffset}px))`,
            transition: carousel.isAnimating ? 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
            willChange: carousel.isDragging || carousel.isAnimating ? 'transform' : 'auto',
          }}
        >
          {[-1, 0, 1].map((delta) => (
            <div key={delta} className="flex w-full flex-shrink-0 flex-col" style={{ height: scrollable ? undefined : '100%' }}>
              {renderSlide(delta)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PeriodCarousel;
