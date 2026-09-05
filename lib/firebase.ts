"use client";

import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";

import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";

import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions,
} from "firebase/functions";

import {
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";

import {
  getAnalytics,
  isSupported,
  type Analytics,
} from "firebase/analytics";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FUNCTIONS_REGION = "us-central1";
const EMULATOR_HOST = "localhost";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const isBrowser = typeof window !== "undefined";
const useEmulators =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

function validateEnv(): void {
  if (!isBrowser) return;

  const missing = Object.entries(firebaseConfig)
    .filter(([key, value]) => key !== "measurementId" && !value)
    .map(([key]) => key);

  if (missing.length === 0) return;

  // eslint-disable-next-line no-console
  console.error(
    `[Isolynic] Missing Firebase environment variables: ${missing.join(", ")}`
  );
}

validateEnv();

// ---------------------------------------------------------------------------
// Firebase App
// ---------------------------------------------------------------------------

export const firebaseApp: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const auth: Auth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();

// ---------------------------------------------------------------------------
// Cloud Functions
// ---------------------------------------------------------------------------

export const functions: Functions = getFunctions(
  firebaseApp,
  FUNCTIONS_REGION
);

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export const storage: FirebaseStorage = getStorage(firebaseApp);

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

function createFirestore(): Firestore {
  // SSR / non-browser environments cannot use IndexedDB persistence.
  if (!isBrowser) {
    return getFirestore(firebaseApp);
  }

  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Firestore has already been initialized elsewhere, such as
    // during Next.js hot reload or another module import.
    return getFirestore(firebaseApp);
  }
}

export const db: Firestore = createFirestore();

// ---------------------------------------------------------------------------
// Firebase Analytics
// ---------------------------------------------------------------------------

let analyticsInstance: Analytics | null = null;

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (!isBrowser) return null;

  if (analyticsInstance) {
    return analyticsInstance;
  }

  try {
    const supported = await isSupported();

    if (!supported) {
      return null;
    }

    analyticsInstance = getAnalytics(firebaseApp);

    return analyticsInstance;
  } catch {
    // Analytics must never prevent the application from starting.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Firebase Emulators
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __ISOLYNIC_EMULATORS_CONNECTED__: boolean | undefined;
}

function connectEmulatorsIfNeeded(): void {
  if (!isBrowser || !useEmulators) return;

  if (globalThis.__ISOLYNIC_EMULATORS_CONNECTED__) {
    return;
  }

  try {
    connectFirestoreEmulator(
      db,
      EMULATOR_HOST,
      8080
    );

    connectFunctionsEmulator(
      functions,
      EMULATOR_HOST,
      5001
    );

    connectAuthEmulator(
      auth,
      `http://${EMULATOR_HOST}:9099`
    );

    globalThis.__ISOLYNIC_EMULATORS_CONNECTED__ = true;
  } catch (error) {
    // Prevent emulator connection issues from crashing the application.
    // eslint-disable-next-line no-console
    console.error(
      "[Isolynic] Failed to connect Firebase emulators.",
      error
    );
  }
}

connectEmulatorsIfNeeded();