import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { doc, getDoc, getDocs, collection, writeBatch, getFirestore } from 'firebase/firestore';
import { 
  getCalendarConnectionStatus, 
  getCalendarAuthUrl, 
  saveCalendarTokens,
  clearCalendarTokens,
  disconnectGoogleCalendar as disconnectCalendarApi 
} from '../lib/calendarAPI';
import {
  DEV_ACCOUNT_FLAG,
  getDevUser,
  isDevSessionActive,
  matchesDevCredentials,
} from '../lib/devAccount';
import { seedDevAccountDataOnce, resetDevAccountData } from '../lib/devSeed';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const GUEST_STORAGE_FLAG = 'focusflow_is_guest';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Nur Entwicklung: `ffDev.reset()` spielt die Beispieldaten des Dev-Accounts neu ein und lädt die Seite neu
  window.ffDev = {
    reset: () => {
      resetDevAccountData();
      window.location.reload();
    },
  };
}

// Alle Nutzer-Subcollections unter users/{uid} (siehe firestore.rules)
export const USER_DATA_COLLECTIONS = [
  'projects',
  'reminders',
  'inboxItems',
  'categories',
  'reminderCategories',
  'kanbanViews',
  'chat_data'
];

async function deleteAllUserData(db, uid) {
  for (const colName of USER_DATA_COLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', uid, colName));
    const docs = snap.docs;
    // Firestore-Batches erlauben max. 500 Operationen
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

function clearLocalUserData(uid) {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes(uid) || key === 'focusflow_coach_history')) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.warn('LocalStorage konnte nicht bereinigt werden:', e);
  }
}

const GUEST_USER_OBJ = {
  uid: 'guest_preview_user',
  email: 'gast@focusflow.app',
  displayName: 'Gast-Benutzer',
  isGuest: true
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Nur Entwicklung: lokaler Dev-Account (siehe src/lib/devAccount.js)
    if (isDevSessionActive()) return getDevUser();
    try {
      if (localStorage.getItem(GUEST_STORAGE_FLAG) === 'true') {
        return GUEST_USER_OBJ;
      }
    } catch (e) {
      console.warn('LocalStorage error reading guest flag:', e);
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);

  // Synchronisiere Verbindungsstatus, wenn sich der Nutzer ändert
  useEffect(() => {
    const checkStatus = async () => {
      if (user && !user.isGuest) {
        const connected = await getCalendarConnectionStatus();
        setIsCalendarConnected(connected);
      } else {
        setIsCalendarConnected(false);
      }
    };
    checkStatus();

    const handleStatusSync = (e) => {
      if (typeof e.detail?.connected === 'boolean') {
        setIsCalendarConnected(e.detail.connected);
      }
    };
    window.addEventListener('focusflow_calendar_sync_status', handleStatusSync);
    return () => window.removeEventListener('focusflow_calendar_sync_status', handleStatusSync);
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          localStorage.removeItem(GUEST_STORAGE_FLAG);
        } catch (e) {}

        try {
          const db = getFirestore();
          const normalizedEmail = currentUser.email ? currentUser.email.trim().toLowerCase() : '';
          const whitelistRef = doc(db, 'whitelist', normalizedEmail);
          const snap = await getDoc(whitelistRef);
          
          if (!snap.exists()) {
            throw new Error('Account ist nicht auf der Whitelist.');
          }
          
          setUser(currentUser);
        } catch (error) {
          console.error("Access Denied: User is not in the whitelist.", error);
          await signOut(auth);
          setUser(null);
          setIsCalendarConnected(false);
          clearCalendarTokens();
          window.dispatchEvent(new CustomEvent('auth-error', { 
            detail: 'Dein Account ist für diese App nicht freigeschaltet. Bitte kontaktiere den Administrator.' 
          }));
        }
      } else {
        // Kein Firebase-User: Dev-Account (nur Entwicklung) oder Gast-Sitzung im localStorage?
        if (isDevSessionActive()) {
          setUser(getDevUser());
          setLoading(false);
          return;
        }
        let isGuest = false;
        try {
          isGuest = localStorage.getItem(GUEST_STORAGE_FLAG) === 'true';
        } catch (e) {}

        if (isGuest) {
          setUser(GUEST_USER_OBJ);
        } else {
          setUser(null);
          setIsCalendarConnected(false);
          clearCalendarTokens();
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = (email, password) => {
    // Nur Entwicklung: Anmeldung am lokalen Dev-Account, ohne Netzwerk
    if (matchesDevCredentials(email, password)) {
      try {
        localStorage.removeItem(GUEST_STORAGE_FLAG);
        localStorage.setItem(DEV_ACCOUNT_FLAG, 'true');
      } catch (e) {}
      seedDevAccountDataOnce();
      setUser(getDevUser());
      return Promise.resolve({ user: getDevUser() });
    }
    try {
      localStorage.removeItem(GUEST_STORAGE_FLAG);
      localStorage.removeItem(DEV_ACCOUNT_FLAG);
    } catch (e) {}
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    return signInWithEmailAndPassword(auth, cleanEmail, password);
  };

  const loginWithGoogle = async () => {
    try {
      localStorage.removeItem(GUEST_STORAGE_FLAG);
    } catch (e) {}
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result;
  };

  const loginAsGuest = () => {
    try {
      localStorage.removeItem(DEV_ACCOUNT_FLAG);
      localStorage.setItem(GUEST_STORAGE_FLAG, 'true');
    } catch (e) {
      console.warn('LocalStorage error setting guest flag:', e);
    }
    setUser(GUEST_USER_OBJ);
  };

  /**
   * Startet den OAuth 2.0 Offline-Access-Flow für Google Kalender.
   * Nutzt Backend-Status-Polling statt postMessage/popup.closed,
   * da Google's COOP-Header die Popup-Kommunikation blockieren.
   */
  const linkGoogleCalendar = async () => {
    if (!auth.currentUser) return;

    try {
      const authUrl = await getCalendarAuthUrl();
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'focusflow_google_oauth',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup) {
        throw new Error('Popup wurde vom Browser blockiert. Bitte erlaube Popups für diese Website.');
      }

      return new Promise((resolve) => {
        let isResolved = false;

        // Primär: postMessage vom Callback-Fenster (falls COOP es erlaubt)
        const handleMessage = async (event) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type === 'FOCUSFLOW_CALENDAR_CONNECTED') {
            cleanup();
            saveCalendarTokens();
            setIsCalendarConnected(true);
            resolve(true);
          }
        };

        window.addEventListener('message', handleMessage);

        // Fallback: Polling des Backend-Status alle 2 Sekunden.
        // Fängt den Fall ab, dass COOP postMessage und popup.closed blockiert.
        const statusPoll = setInterval(async () => {
          if (isResolved) return;
          try {
            const connected = await getCalendarConnectionStatus();
            if (connected) {
              cleanup();
              saveCalendarTokens();
              setIsCalendarConnected(true);
              resolve(true);
            }
          } catch {
            // Status-Check fehlgeschlagen, weiter pollen
          }
        }, 2000);

        // Sicherheits-Timeout: Nach 5 Minuten aufgeben
        const timeout = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            resolve(false);
          }
        }, 5 * 60 * 1000);

        function cleanup() {
          if (isResolved) return;
          isResolved = true;
          window.removeEventListener('message', handleMessage);
          clearInterval(statusPoll);
          clearTimeout(timeout);
          // Popup schließen, falls noch offen (direkter close() Aufruf ohne .closed Property-Access, um COOP-Warnung zu vermeiden)
          try { popup?.close(); } catch {}
        }
      });
    } catch (error) {
      console.error("Error linking Google Calendar:", error);
      throw error;
    }
  };

  const disconnectGoogleCalendar = async () => {
    clearCalendarTokens();
    setIsCalendarConnected(false);
    try {
      await disconnectCalendarApi();
    } catch (err) {
      console.error('Fehler beim Trennen von Google Calendar:', err);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem(DEV_ACCOUNT_FLAG);
      localStorage.removeItem(GUEST_STORAGE_FLAG);
    } catch (e) {
      console.warn('Fehler beim Löschen des Gast-Flags:', e);
    }
    clearCalendarTokens();
    setIsCalendarConnected(false);
    setUser(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('SignOut Fehler:', err);
    }
  };

  const updateUserProfile = async (displayName, photoURL) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName, photoURL });
    setUser({ ...auth.currentUser });
  };

  const changePassword = async (newPassword) => {
    if (!auth.currentUser) return;
    await updatePassword(auth.currentUser, newPassword);
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  /**
   * Löscht Konto und alle Inhalte endgültig (DSGVO Art. 17).
   * Firebase verlangt eine frische Anmeldung: Passwort-Nutzer bestätigen per Passwort,
   * Google-Nutzer per Google-Popup.
   */
  const deleteAccount = async ({ password } = {}) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Nicht angemeldet.');

    const usesGoogle = currentUser.providerData?.some(p => p.providerId === 'google.com');
    if (usesGoogle) {
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
    } else {
      const credential = EmailAuthProvider.credential(currentUser.email, password || '');
      await reauthenticateWithCredential(currentUser, credential);
    }

    // Kalender-Token serverseitig entfernen (best effort)
    try {
      await disconnectCalendarApi();
    } catch (err) {
      console.warn('Kalender konnte beim Löschen nicht getrennt werden:', err);
    }

    const uid = currentUser.uid;
    await deleteAllUserData(getFirestore(), uid);
    await deleteUser(currentUser);

    clearLocalUserData(uid);
    clearCalendarTokens();
    setIsCalendarConnected(false);
    setUser(null);
  };

  const reloadUser = async () => {
    if (!auth.currentUser) return null;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setUser({ ...auth.currentUser });
    return auth.currentUser;
  };

  const isEmailVerified = Boolean(user?.isGuest || user?.emailVerified);
  const isGoogleUser = Boolean(user?.providerData?.some(p => p.providerId === 'google.com'));

  const value = {
    user,
    loading,
    isEmailVerified,
    isGoogleUser,
    isCalendarConnected,
    googleCalendarToken: isCalendarConnected ? 'connected' : null, // Abwärtskompatibilität
    setIsCalendarConnected,
    loginWithEmail,
    loginWithGoogle,
    loginAsGuest,
    linkGoogleCalendar,
    disconnectGoogleCalendar,
    logout,
    updateUserProfile,
    changePassword,
    resetPassword,
    sendVerificationEmail,
    reloadUser,
    deleteAccount
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
