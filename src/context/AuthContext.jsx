import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { 
  getCalendarConnectionStatus, 
  getCalendarAuthUrl, 
  saveCalendarTokens,
  clearCalendarTokens,
  disconnectGoogleCalendar as disconnectCalendarApi 
} from '../lib/calendarAPI';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const GUEST_STORAGE_FLAG = 'focusflow_is_guest';

const GUEST_USER_OBJ = {
  uid: 'guest_preview_user',
  email: 'gast@focusflow.app',
  displayName: 'Gast-Benutzer',
  isGuest: true
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
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
        // Kein Firebase-User: Prüfen ob Gast-Sitzung im localStorage aktiv ist
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
    try {
      localStorage.removeItem(GUEST_STORAGE_FLAG);
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
      localStorage.setItem(GUEST_STORAGE_FLAG, 'true');
    } catch (e) {
      console.warn('LocalStorage error setting guest flag:', e);
    }
    setUser(GUEST_USER_OBJ);
  };

  /**
   * Startet den OAuth 2.0 Offline-Access-Flow für Google Kalender
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

        const handleMessage = async (event) => {
          // Sicherheitsprüfung: Nur Nachrichten vom identischen Origin erlauben
          if (event.origin !== window.location.origin) return;

          if (event.data?.type === 'FOCUSFLOW_CALENDAR_CONNECTED') {
            isResolved = true;
            window.removeEventListener('message', handleMessage);
            clearInterval(checkClosed);
            if (event.data.accessToken) {
              const rawToken = event.data.accessToken;
              const token = rawToken.includes('%') ? decodeURIComponent(rawToken) : rawToken;
              saveCalendarTokens({
                accessToken: token
              });
            }
            setIsCalendarConnected(true);
            resolve(true);
          }
        };

        window.addEventListener('message', handleMessage);

        // Fallback-Timer zum Prüfen, ob das Fenster geschlossen wurde
        const checkClosed = setInterval(async () => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            if (!isResolved) {
              const connected = await getCalendarConnectionStatus();
              setIsCalendarConnected(connected);
              resolve(connected);
            }
          }
        }, 1000);
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

  const value = {
    user,
    loading,
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
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
