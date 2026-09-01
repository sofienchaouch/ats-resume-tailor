import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleToken: string | null;
  signInWithGoogle: () => Promise<void>;
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
        error.code === 'auth/cancelled-popup-request'
      ) {
        // User dismissed the popup themselves -- not an error worth surfacing.
        return;
      }

      // The Firebase project's Authorized domains list doesn't include the
      // host the app is served from. A redirect would hit the exact same wall,
      // so don't attempt it -- tell the operator how to fix it instead.
      if (error.code === 'auth/unauthorized-domain') {
        throw new Error(
          `"${window.location.hostname}" is not an authorized domain for this Firebase project. ` +
          `Add it in Firebase Console -> Authentication -> Settings -> Authorized domains, then retry.`
        );
      }

      if (error.code === 'auth/popup-blocked') {
        // The browser (or an embedded/sandboxed context) refused to open the
        // popup. Fall back to a full-page redirect -- the result is picked up
        // by getRedirectResult() above on the next page load.
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError: any) {
          if (redirectError?.code === 'auth/unauthorized-domain') {
            throw new Error(
              `"${window.location.hostname}" is not an authorized domain for this Firebase project. ` +
              `Add it in Firebase Console -> Authentication -> Settings -> Authorized domains, then retry.`
            );
          }
          throw new Error('Google sign-in could not open. Allow popups for this site, or try a different browser.');
        }
      }

      if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error during Google sign-in. Check your connection and retry.');
      }

      throw new Error(`Google sign-in failed${error.code ? ` (${error.code})` : ''}.`);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setGoogleToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleToken, signInWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
