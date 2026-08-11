import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, linkedinProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithLinkedin: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setGoogleToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleToken(credential.accessToken);
      }
    } catch (error: any) {
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request' ||
        error.code === 'auth/network-request-failed'
      ) {
        // User closed the popup, or network failure - handle gracefully
        return;
      }
      console.error("Google Sign In Error", error);
    }
  };

  const signInWithLinkedin = async () => {
    try {
      await signInWithPopup(auth, linkedinProvider);
    } catch (error: any) {
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request' ||
        error.code === 'auth/network-request-failed'
      ) {
        return;
      }
      console.error("LinkedIn Sign In Error", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setGoogleToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleToken, signInWithGoogle, signInWithLinkedin, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
