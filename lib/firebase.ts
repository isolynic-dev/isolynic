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
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
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

// ---------------------------------------------------------------------------
// Customer helpers
// ---------------------------------------------------------------------------

export async function createNote(
  customerId: string,
  text: string
): Promise<string> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Note cannot be empty.");
  }

  if (!auth.currentUser) {
    throw new Error("You must be signed in to add a note.");
  }

  const notesRef = collection(
    db,
    "customers",
    customerId,
    "notes"
  );

  const noteRef = await addDoc(notesRef, {
    text: trimmedText,
    createdBy: "owner",
    createdAt: serverTimestamp(),
  });

  return noteRef.id;
}

export async function confirmSmartSuggestion(
  customerId: string,
  suggestionId: string,
  accept: boolean
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error(
      "You must be signed in to update a suggestion."
    );
  }

  const suggestionRef = doc(
    db,
    "customers",
    customerId,
    "smartSuggestions",
    suggestionId
  );

  await updateDoc(suggestionRef, {
    status: accept ? "saved" : "ignored",
  });
}

export async function editCustomerIdentity(
  customerId: string,
  updates: {
    displayName?: string;
    phone?: string;
    preferredChannel?: "whatsapp" | "phone" | "web";
  }
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error(
      "You must be signed in to edit customer information."
    );
  }

  const customerRef = doc(
    db,
    "customers",
    customerId
  );

  await updateDoc(customerRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}


export async function recoverOpportunity(
  opportunityId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!auth.currentUser) {
    return {
      ok: false,
      reason: "You must be signed in to recover an opportunity.",
    };
  }

  try {
    const opportunityRef = doc(
      db,
      "opportunities",
      opportunityId
    );

    await updateDoc(opportunityRef, {
      status: "RECOVERY_SENT",
      ownerAction: "recover",
      lastRecoveryAction: {
        type: "follow_up",
        at: Date.now(),
        channel: "whatsapp",
      },
      updatedAt: Date.now(),
      version: Date.now(),
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "We couldn't recover this opportunity.",
    };
  }
}

export async function ignoreOpportunity(
  opportunityId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!auth.currentUser) {
    return {
      ok: false,
      reason: "You must be signed in to ignore an opportunity.",
    };
  }

  try {
    const opportunityRef = doc(
      db,
      "opportunities",
      opportunityId
    );

    await updateDoc(opportunityRef, {
      status: "IGNORED",
      ownerAction: "ignore",
      explicitlyRejected: true,
      undoExpiresAt: Date.now() + 30_000,
      updatedAt: Date.now(),
      version: Date.now(),
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "Couldn't ignore this opportunity.",
    };
  }
}

export async function markNotACustomer(
  opportunityId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!auth.currentUser) {
    return {
      ok: false,
      reason: "You must be signed in to update this opportunity.",
    };
  }

  try {
    const opportunityRef = doc(
      db,
      "opportunities",
      opportunityId
    );

    await updateDoc(opportunityRef, {
      status: "NOT_A_CUSTOMER",
      ownerAction: "not_a_customer",
      explicitlyRejected: true,
      undoExpiresAt: Date.now() + 30_000,
      updatedAt: Date.now(),
      version: Date.now(),
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "Couldn't mark this as not a customer.",
    };
  }
}