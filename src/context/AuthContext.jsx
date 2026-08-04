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
  linkWithPopup
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleCalendarToken, setGoogleCalendarToken] = useState(() => {
    return localStorage.getItem('googleCalendarToken') || null;
  });

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
          localStorage.removeItem('googleCalendarToken');
          setGoogleCalendarToken(null);
          window.dispatchEvent(new CustomEvent('auth-error', { 
            detail: 'Dein Account ist für diese App nicht freigeschaltet. Bitte kontaktiere den Administrator.' 
          }));
        }
      } else {
        setUser(null);
        localStorage.removeItem('googleCalendarToken');
        setGoogleCalendarToken(null);
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
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    const result = await signInWithPopup(auth, provider);
    
    // Extrahiere das Access Token für die Kalender API
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
      setGoogleCalendarToken(credential.accessToken);
      localStorage.setItem('googleCalendarToken', credential.accessToken);
    }
    
    return result;
  };

  const linkGoogleCalendar = async () => {
    if (!auth.currentUser) return;
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      
      // Prüfen, ob der Nutzer ohnehin schon mit Google eingeloggt ist
      const isGoogleUser = auth.currentUser.providerData.some(
        (profile) => profile.providerId === 'google.com'
      );

      let result;
      if (isGoogleUser) {
        // Wenn es schon ein Google-Nutzer ist, machen wir einfach einen Re-Login
        // um die neuen Scopes zu bekommen. Das verhindert den "popup-blocked" Fehler!
        result = await signInWithPopup(auth, provider);
      } else {
        // Nur wenn es ein reiner E-Mail Nutzer ist, versuchen wir den Account zu verknüpfen
        result = await linkWithPopup(auth.currentUser, provider);
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        setGoogleCalendarToken(credential.accessToken);
        localStorage.setItem('googleCalendarToken', credential.accessToken);
      }
      return result;
    } catch (error) {
      console.error("Error linking Google Calendar:", error);
      
      // Falls wir trotzdem in einen Fehler laufen (z.B. User ist E-Mail, aber die Google-Mail gehört schon wem anders)
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Dein Browser hat das Popup blockiert. Bitte erlaube Popups für diese Seite und klicke erneut.');
      } else if (error.code === 'auth/credential-already-in-use') {
        throw new Error('Dieser Google-Account wird bereits von einem anderen Profil verwendet. Bitte logge dich komplett aus und melde dich direkt mit Google an.');
      }
      
      throw error;
    }
  };

  const disconnectGoogleCalendar = () => {
    localStorage.removeItem('googleCalendarToken');
    setGoogleCalendarToken(null);
  };

  const logout = async () => {
    localStorage.removeItem('googleCalendarToken');
    setGoogleCalendarToken(null);
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
    googleCalendarToken,
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
