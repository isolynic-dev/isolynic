
// src/lib/onboarding.ts
"use client";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type { OnboardingRecord, OnboardingState } from "@/types/onboarding";

const COLLECTION = "onboarding";

export async function fetchOnboardingState(
  uid: string
): Promise<OnboardingRecord | null> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as OnboardingRecord;
}

export async function persistOnboardingState(
  uid: string,
  patch: Partial<OnboardingRecord>
): Promise<void> {
  const ref = doc(db, COLLECTION, uid);
  const payload: DocumentData = {
    ...patch,
    uid,
    updatedAt: Date.now(),
  };
  await setDoc(ref, payload, { merge: true });
}

export async function initOnboardingRecord(uid: string): Promise<void> {
  const existing = await fetchOnboardingState(uid);
  if (existing) return;
  const ref = doc(db, COLLECTION, uid);
  await setDoc(ref, {
    uid,
    state: "AUTHENTICATED" as OnboardingState,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    _serverCreatedAt: serverTimestamp(),
  });
}

/**
 * A state is "complete" for routing purposes once the user
 * has connected at least one channel.
 */
export function isOnboardingComplete(state?: OnboardingState): boolean {
  if (!state) return false;
  return (
    state === "CHANNEL_SELECTED" ||
    state === "TEST_READY" ||
    state === "ACTIVATED" ||
    state === "HOME"
  );
}