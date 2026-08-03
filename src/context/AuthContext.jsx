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

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Versuche das Whitelist-Dokument des Nutzers abzurufen.
          // Dokumenten-IDs in Firestore sind case-sensitiv, daher normalisieren wir auf kleingeschrieben.
          const db = getFirestore();
          const normalizedEmail = currentUser.email ? currentUser.email.trim().toLowerCase() : '';
          const whitelistRef = doc(db, 'whitelist', normalizedEmail);
          await getDoc(whitelistRef);
          
          // Zugriff gewährt -> Nutzer ist whitelisted
          setUser(currentUser);
        } catch (error) {
          console.error("Access Denied: User is not in the whitelist.", error);
          // Sofort ausloggen
          await signOut(auth);
          setUser(null);
          // UI benachrichtigen
          window.dispatchEvent(new CustomEvent('auth-error', { 
            detail: 'Dein Account ist für diese App nicht freigeschaltet. Bitte kontaktiere den Administrator.' 
          }));
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = (email, password) => {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    return signInWithEmailAndPassword(auth, cleanEmail, password);
  };

  const loginWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const logout = () => {
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
    loginWithEmail,
    loginWithGoogle,
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
