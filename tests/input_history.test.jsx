import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInputHistory } from '../src/hooks/useInputHistory';

const key = (k, value = '', extra = {}) => ({
  key: k,
  ...extra,
  target: { value, selectionStart: value.length, selectionEnd: value.length, setSelectionRange: vi.fn(), style: {}, scrollHeight: 20 },
  nativeEvent: {},
  preventDefault: vi.fn(),
});

describe('useInputHistory', () => {
  it('blättert mit Pfeil hoch und runter durch frühere Nachrichten und bringt den Entwurf zurück', () => {
    const setValue = vi.fn();
    const entries = ['zuletzt', 'davor'];
    const { result, rerender } = renderHook(({ v }) => useInputHistory(entries, v, setValue), { initialProps: { v: 'Entwurf' } });
    expect(result.current(key('ArrowUp', 'Entwurf'))).toBe(true);
    expect(setValue).toHaveBeenLastCalledWith('zuletzt');
    rerender({ v: 'zuletzt' });
    result.current(key('ArrowUp', 'zuletzt'));
    expect(setValue).toHaveBeenLastCalledWith('davor');
    rerender({ v: 'davor' });
    result.current(key('ArrowDown', 'davor'));
    expect(setValue).toHaveBeenLastCalledWith('zuletzt');
    rerender({ v: 'zuletzt' });
    result.current(key('ArrowDown', 'zuletzt'));
    expect(setValue).toHaveBeenLastCalledWith('Entwurf');
  });

  it('lässt Pfeiltasten in mehrzeiligem Text und ohne Verlauf in Ruhe; Strg+U und Esc leeren', () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useInputHistory([], 'text', setValue));
    expect(result.current(key('ArrowUp', 'text'))).toBe(false);
    expect(result.current(key('u', 'text', { ctrlKey: true }))).toBe(true);
    expect(setValue).toHaveBeenLastCalledWith('');
    expect(result.current(key('Escape', 'text'))).toBe(true);
    const multi = renderHook(() => useInputHistory(['a'], 'x\ny', setValue));
    expect(multi.result.current(key('ArrowUp', 'x\ny'))).toBe(false);
  });
});
