import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAyT5_TK4cEOBrfZVc1cP6cN1tMpDvtj08",
  authDomain: "ats-tailor-3393e.firebaseapp.com",
  projectId: "ats-tailor-3393e",
  storageBucket: "ats-tailor-3393e.firebasestorage.app",
  messagingSenderId: "1040216031631",
  appId: "1:1040216031631:web:50b82266f1b132caa2cbfa",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
// Uses the project's (default) Firestore database.
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
