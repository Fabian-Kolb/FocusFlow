import { act, render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  authState
} = vi.hoisted(() => {
  const authState = { callback: null };
  return {
    signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'signed-in' } })),
    signInWithPopup: vi.fn(async () => ({ user: { uid: 'google-user' } })),
    signOut: vi.fn(async () => {}),
    authState
  };
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    authState.callback = callback;
    return vi.fn();
  }),
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider: vi.fn(),
  signOut,
  updateProfile: vi.fn(),
  updatePassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn()
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...parts) => parts.join('/')),
  getDoc: vi.fn(async () => ({ exists: () => true })),
  getFirestore: vi.fn(() => ({}))
}));
vi.mock('../src/lib/firebase.js', () => ({
  auth: { currentUser: null }
}));
vi.mock('../src/lib/calendarAPI.js', () => ({
  getCalendarConnectionStatus: vi.fn(async () => false),
  getCalendarAuthUrl: vi.fn(),
  saveCalendarTokens: vi.fn(),
  clearCalendarTokens: vi.fn(),
  disconnectGoogleCalendar: vi.fn()
}));

import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';

function AuthProbe({ onAuth }) {
  onAuth(useAuth());
  return null;
}

describe('AuthProvider critical behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    signInWithEmailAndPassword.mockClear();
    signInWithPopup.mockClear();
    signOut.mockClear();
  });

  it('restores a guest session and exposes it as verified', async () => {
    localStorage.setItem('focusflow_is_guest', 'true');
    let value;
    render(
      <AuthProvider>
        <AuthProbe onAuth={(auth) => { value = auth; }} />
      </AuthProvider>
    );

    await act(async () => {
      await authState.callback(null);
    });
    await waitFor(() => expect(value.user.isGuest).toBe(true));
    expect(value.isEmailVerified).toBe(true);
    expect(value.user.uid).toBe('guest_preview_user');
  });

  it('normalizes email credentials and clears guest mode before sign-in', async () => {
    let value;
    render(
      <AuthProvider>
        <AuthProbe onAuth={(auth) => { value = auth; }} />
      </AuthProvider>
    );
    await act(async () => {
      await authState.callback(null);
    });

    await act(async () => {
      await value.loginWithEmail('  USER@Example.COM ', 'password');
    });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'user@example.com',
      'password'
    );
    expect(localStorage.getItem('focusflow_is_guest')).toBeNull();
  });

  it('logs out guest state and Firebase state together', async () => {
    localStorage.setItem('focusflow_is_guest', 'true');
    let value;
    render(
      <AuthProvider>
        <AuthProbe onAuth={(auth) => { value = auth; }} />
      </AuthProvider>
    );
    await act(async () => {
      await authState.callback(null);
    });
    await waitFor(() => expect(value.user.isGuest).toBe(true));

    await act(async () => {
      await value.logout();
    });
    expect(value.user).toBeNull();
    expect(localStorage.getItem('focusflow_is_guest')).toBeNull();
    expect(signOut).toHaveBeenCalled();
  });
});
