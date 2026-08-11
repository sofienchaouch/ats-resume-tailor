import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
// Reuses the single canonical Firebase app instance from src/firebase.ts
// instead of calling initializeApp a second time — the two files' configs
// were verified identical, so this was never a live bug, but a second
// initializeApp call site is still a footgun for the next person who edits
// one and not the other.
import { auth } from '../firebase';

export { auth };

// Configure Google Auth Provider with Gmail Compose scope
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

// Keep auth state flags
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize Auth listener and restore cached token if available
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Try to load cached token from session memory if active session is present
  const sessionToken = sessionStorage.getItem('gmail_oauth_token');
  if (sessionToken) {
    cachedAccessToken = sessionToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If logged in but no token in memory, we need to sign in again to get the token
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('gmail_oauth_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup and request scopes
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token from credentials.');
    }

    cachedAccessToken = credential.accessToken;
    // Save token in sessionStorage to persist across simple page refreshes
    sessionStorage.setItem('gmail_oauth_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || sessionStorage.getItem('gmail_oauth_token');
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  sessionStorage.removeItem('gmail_oauth_token');
};
