// Firebase configuration based on firebase_barebones_javascript blueprint
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Check if all required Firebase secrets are present
const hasRequiredSecrets = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
);

export const firebaseConfigured = hasRequiredSecrets;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (hasRequiredSecrets) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} else {
  console.warn(
    "Firebase is not configured. Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID environment variables."
  );
}

// Helper functions that throw if Firebase is not configured
export function getAuthOrThrow() {
  if (!auth) {
    throw new Error("Firebase Auth is not configured. Please set up Firebase environment variables.");
  }
  return auth;
}

export function getDbOrThrow() {
  if (!db) {
    throw new Error("Firebase Firestore is not configured. Please set up Firebase environment variables.");
  }
  return db;
}

export function getGoogleProviderOrThrow() {
  if (!googleProvider) {
    throw new Error("Firebase Google Provider is not configured. Please set up Firebase environment variables.");
  }
  return googleProvider;
}

export { app, auth, db, googleProvider };
