import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

vi.mock('../src/lib/notify', () => ({ notify: vi.fn() }));
import { notify } from '../src/lib/notify';
import { useSpeechInput } from '../src/hooks/useSpeechInput';

let instances;
class FakeRecognition {
  constructor() { instances.push(this); this.starts = 0; }
  start() { this.starts += 1; this.onstart?.(); }
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
}
const result = (text, isFinal) => Object.assign([{ transcript: text }], { isFinal });
const emit = (rec, results, resultIndex = 0) => rec.onresult({ results, resultIndex });

const setup = (initial = '') => renderHook(() => {
  const [value, setValue] = useState(initial);
  return { value, ...useSpeechInput(value, setValue) };
});

describe('useSpeechInput', () => {
  beforeEach(() => {
    instances = [];
    window.SpeechRecognition = FakeRecognition;
    notify.mockClear();
  });

  it('hängt Diktat an vorhandenen Text an und zeigt Zwischenstände', () => {
    const { result: r } = setup('Hallo');
    act(() => r.current.toggle());
    act(() => emit(instances[0], [result('Welt', false)]));
    expect(r.current.value).toBe('Hallo Welt');
    act(() => emit(instances[0], [result('Welt', true)]));
    expect(r.current.value).toBe('Hallo Welt');
  });

  it('behält bereits erkannte Sätze, wenn der Browser die Erkennung neu startet', () => {
    const { result: r } = setup();
    act(() => r.current.toggle());
    const rec = instances[0];
    act(() => emit(rec, [result('Erster Satz', true)]));
    act(() => rec.onend());
    expect(rec.starts).toBe(2);
    act(() => emit(rec, [result('Zweiter Satz', true)]));
    expect(r.current.value).toBe('Erster Satz Zweiter Satz');
  });

  it('verwirft nach stop({ discard: true }) späte Ergebnisse', () => {
    const { result: r } = setup();
    act(() => r.current.toggle());
    const rec = instances[0];
    act(() => r.current.stop({ discard: true }));
    expect(rec.onresult).toBeNull();
    expect(r.current.isListening).toBe(false);
  });

  it('meldet verweigerten Mikrofon-Zugriff', () => {
    const { result: r } = setup();
    act(() => r.current.toggle());
    act(() => instances[0].onerror({ error: 'not-allowed' }));
    expect(r.current.isListening).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Mikrofon'), 'mic_off');
  });
});
