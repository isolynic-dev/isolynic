"use client";
// src/lib/firebase.ts


import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  getFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";



const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function requireEnv() {
  const missing = Object.entries(firebaseConfig)
    .filter(([key, value]) => key !== "measurementId" && !value)
    .map(([key]) => key);

  if (missing.length > 0 && typeof window !== "undefined") {
    // Fail loudly in dev, quietly degrade in prod (screen must still render).
    // eslint-disable-next-line no-console
    console.error(
      `[Isolynic] Missing Firebase env vars: ${missing.join(", ")}`
    );
  }
}

requireEnv();

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

let analyticsInstance: Analytics | null = null;

/**
 * Analytics must never block or crash the Welcome screen.
 * Lazily and safely initialized, browser-only.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (analyticsInstance) return analyticsInstance;

  try {
    const supported = await isSupported();
    if (!supported) return null;
    analyticsInstance = getAnalytics(firebaseApp);
    return analyticsInstance;
  } catch {
    return null;
  }
}









const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const app = getFirebaseApp();
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

// Offline cache — required by spec §52 ("show last known valid state offline").
// Guarded for SSR since IndexedDB only exists in the browser, and guarded
// against multi-tab failures which are non-fatal.
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open — persistence can only be enabled in one at a time.
      console.warn("Firestore persistence unavailable: multiple tabs open.");
    } else if (err.code === "unimplemented") {
      console.warn("Firestore persistence unavailable in this browser.");
    }
  });
}