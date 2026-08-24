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
  disconnectGoogleCalendar as disconnectCalendarApi 
} from '../lib/calendarAPI';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);

  // Synchronisiere Verbindungsstatus, wenn sich der Nutzer ändert
  useEffect(() => {
    const checkStatus = async () => {
      if (user) {
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
          const db = getFirestore();
          const normalizedEmail = currentUser.email ? currentUser.email.trim().toLowerCase() : '';
          const whitelistRef = doc(db, 'whitelist', normalizedEmail);
          await getDoc(whitelistRef);
          
          setUser(currentUser);
        } catch (error) {
          console.error("Access Denied: User is not in the whitelist.", error);
          await signOut(auth);
          setUser(null);
          setIsCalendarConnected(false);
          window.dispatchEvent(new CustomEvent('auth-error', { 
            detail: 'Dein Account ist für diese App nicht freigeschaltet. Bitte kontaktiere den Administrator.' 
          }));
        }
      } else {
        setUser(null);
        setIsCalendarConnected(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = (email, password) => {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    return signInWithEmailAndPassword(auth, cleanEmail, password);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result;
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
        const handleMessage = (event) => {
          if (event.data?.type === 'FOCUSFLOW_CALENDAR_CONNECTED') {
            window.removeEventListener('message', handleMessage);
            if (auth.currentUser) {
              localStorage.setItem('ff_cal_connected_' + auth.currentUser.uid, 'true');
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
            const connected = auth.currentUser ? (localStorage.getItem('ff_cal_connected_' + auth.currentUser.uid) === 'true') : false;
            setIsCalendarConnected(connected);
            resolve(connected);
          }
        }, 1000);
      });
    } catch (error) {
      console.error("Error linking Google Calendar:", error);
      throw error;
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (auth.currentUser) {
      localStorage.removeItem('ff_cal_connected_' + auth.currentUser.uid);
    }
    setIsCalendarConnected(false);
    try {
      await disconnectCalendarApi();
    } catch (err) {
      console.error('Fehler beim Trennen von Google Calendar:', err);
    }
  };

  const logout = async () => {
    if (auth.currentUser) {
      localStorage.removeItem('ff_cal_connected_' + auth.currentUser.uid);
    }
    setIsCalendarConnected(false);
    return signOut(auth);
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
