import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, linkedinProvider } from './firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

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
    // Popups are unreliable across browsers/embedded contexts (many block
    // window.open outright). If signInWithGoogle below fell back to
    // signInWithRedirect, the result only becomes available here, after the
    // full-page round trip completes.
    getRedirectResult(auth).then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setGoogleToken(credential.accessToken);
        }
      }
    }).catch((err) => {
      console.error("Google Sign In (redirect) Error", err);
    });

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
      if (error.code === 'auth/popup-blocked') {
        // The browser (or an embedded/sandboxed context) refused to open the
        // popup outright. Fall back to a full-page redirect -- the result is
        // picked up by getRedirectResult() above on the next page load.
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("Google Sign In redirect fallback failed", redirectError);
        }
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
      // linkedinProvider is new OAuthProvider('linkedin.com') -- Firebase has
      // no built-in LinkedIn federation. A working LinkedIn sign-in provider
      // requires registering a real OIDC connector (id "oidc.linkedin") in
      // the Firebase Console with actual LinkedIn OIDC app credentials --
      // that's an external, manual, credentials-bearing step this codebase
      // cannot perform on its own. Until that's done, every attempt fails;
      // surface that honestly instead of swallowing it into the console.
      console.error("LinkedIn Sign In Error", error);
      alert(
        "LinkedIn sign-in isn't set up yet for this app (it needs a LinkedIn OIDC provider " +
        "registered in the Firebase Console). Please use Google sign-in instead."
      );
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
