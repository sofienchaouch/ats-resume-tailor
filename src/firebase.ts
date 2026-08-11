import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA4ykPcsx0QSyO1LCFt8C00dWKZRKryk9s",
  authDomain: "red-bruin-23n78.firebaseapp.com",
  projectId: "red-bruin-23n78",
  storageBucket: "red-bruin-23n78.firebasestorage.app",
  messagingSenderId: "226361448204",
  appId: "1:226361448204:web:425daf9ba118a850b71b29",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-atsresumetailor-a35e5226-ed67-4af0-b58c-942e2c34eca5");
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

export const linkedinProvider = new OAuthProvider('linkedin.com');
linkedinProvider.addScope('r_liteprofile');
linkedinProvider.addScope('r_emailaddress');
