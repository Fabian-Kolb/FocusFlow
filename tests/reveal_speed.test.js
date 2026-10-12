import { describe, it, expect, beforeEach } from 'vitest';
import {
  readRevealGlow,
  writeRevealGlow,
  REVEAL_GLOW_KEY,
  REVEAL_SPEEDS,
  REVEAL_SPEED_KEY,
  DEFAULT_REVEAL_SPEED,
  readRevealSpeed,
  writeRevealSpeed,
  revealFactor,
  revealDurationLabel,
} from '../src/lib/revealSpeed';

describe('Geschwindigkeit der Login-Animation', () => {
  beforeEach(() => localStorage.clear());

  it('bietet drei feste Stufen, Mittel ist die Vorgabe', () => {
    expect(REVEAL_SPEEDS.map((s) => s.value)).toEqual(['fast', 'medium', 'slow']);
    expect(DEFAULT_REVEAL_SPEED).toBe('medium');
    expect(revealFactor('medium')).toBe(1);
    expect(revealFactor('fast')).toBeLessThan(1);
    expect(revealFactor('slow')).toBeGreaterThan(1);
  });

  it('liest ohne gespeicherte Wahl die Vorgabe und ignoriert ungültige Werte', () => {
    expect(readRevealSpeed()).toBe('medium');
    localStorage.setItem(REVEAL_SPEED_KEY, 'warp');
    expect(readRevealSpeed()).toBe('medium');
  });

  it('speichert Schnell und Langsam, Mittel löscht den Eintrag', () => {
    writeRevealSpeed('slow');
    expect(readRevealSpeed()).toBe('slow');
    expect(localStorage.getItem(REVEAL_SPEED_KEY)).toBe('slow');
    writeRevealSpeed('medium');
    expect(localStorage.getItem(REVEAL_SPEED_KEY)).toBeNull();
    writeRevealSpeed('fast');
    expect(readRevealSpeed()).toBe('fast');
  });

  it('zeigt die ungefähre Dauer je Stufe an', () => {
    expect(revealDurationLabel('fast')).toBe('ca. 0,8 s');
    expect(revealDurationLabel('medium')).toBe('ca. 1,1 s');
    expect(revealDurationLabel('slow')).toBe('ca. 1,7 s');
  });

  it('Leuchten ist standardmäßig an und lässt sich ausschalten', () => {
    expect(readRevealGlow()).toBe(true);
    writeRevealGlow(false);
    expect(localStorage.getItem(REVEAL_GLOW_KEY)).toBe('off');
    expect(readRevealGlow()).toBe(false);
    writeRevealGlow(true);
    expect(localStorage.getItem(REVEAL_GLOW_KEY)).toBeNull();
    expect(readRevealGlow()).toBe(true);
  });
});
