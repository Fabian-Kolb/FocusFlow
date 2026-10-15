import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAuth = vi.hoisted(() => ({ currentUser: null }));
const signInAnonymously = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/firebase', () => ({ auth: mockAuth }));
vi.mock('../src/lib/notify', () => ({ notify: vi.fn() }));
vi.mock('firebase/auth', () => ({ signInAnonymously, signOut: vi.fn(), deleteUser: vi.fn() }));

import { askGeminiCoach, summarizeVoiceNote } from '../src/lib/gemini';
import { getGuestAiQuota } from '../src/lib/guestAiQuota';

const sseResponse = (headers = {}) => ({
  ok: true,
  headers: new Headers(headers),
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"chunk":"ok","fullText":"ok"}\n\ndata: [DONE]\n\n'));
      controller.close();
    }
  })
});

describe('KI-Aufrufe im Gast-Modus', () => {
  beforeEach(() => {
    mockAuth.currentUser = null;
    signInAnonymously.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('meldet Gäste im Live-Build anonym an und schickt deren Token mit', async () => {
    vi.stubEnv('DEV', false);
    localStorage.setItem('focusflow_is_guest', 'true');
    const anonUser = { isAnonymous: true, getIdToken: vi.fn().mockResolvedValue('anon-token') };
    signInAnonymously.mockImplementation(async () => {
      mockAuth.currentUser = anonUser;
      return { user: anonUser };
    });
    const fetchMock = vi.fn().mockResolvedValue(sseResponse({ 'X-Guest-Ai-Remaining': '7', 'X-Guest-Ai-Limit': '10' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(askGeminiCoach({ prompt: 'Hallo' })).resolves.toBe('ok');
    expect(signInAnonymously).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer anon-token');
    expect(getGuestAiQuota()).toMatchObject({ remaining: 7, limit: 10 });
  });

  it('legt ohne Gast-Modus kein anonymes Konto an', async () => {
    vi.stubEnv('DEV', false);
    const fetchMock = vi.fn().mockResolvedValue(sseResponse());
    vi.stubGlobal('fetch', fetchMock);

    await askGeminiCoach({ prompt: 'Hallo' });
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('zeigt eine klare Meldung, wenn die anonyme Anmeldung nicht geht', async () => {
    vi.stubEnv('DEV', false);
    localStorage.setItem('focusflow_is_guest', 'true');
    signInAnonymously.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/operation-not-allowed' }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(askGeminiCoach({ prompt: 'Hallo' })).rejects.toThrow('Die KI für Gäste ist gerade nicht verfügbar');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nutzt im Dev-Server keine anonyme Anmeldung', async () => {
    vi.stubEnv('DEV', true);
    localStorage.setItem('focusflow_is_guest', 'true');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({ summary: '- a' }) });
    vi.stubGlobal('fetch', fetchMock);

    await summarizeVoiceNote('Notiz');
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});
