"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useCallback, useEffect, useState } from "react";
import type { OnboardingRecord, OnboardingState } from "@/types/onboarding";
import {
  fetchOnboardingState,
  initOnboardingRecord,
  persistOnboardingState,
} from "@/lib/onboarding";




// src/hooks/useReducedMotion.ts


export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}




// src/hooks/useAuth.ts



interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      () => {
        // Auth listener failure must not hang the screen indefinitely.
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { user, loading };
}





// src/hooks/useOnboardingState.ts



export function useOnboardingState(uid: string | null) {
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        await initOnboardingRecord(uid);
        const data = await fetchOnboardingState(uid);
        if (!cancelled) setRecord(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const updateState = useCallback(
    async (patch: Partial<OnboardingRecord> & { state?: OnboardingState }) => {
      if (!uid) return;
      await persistOnboardingState(uid, patch);
      setRecord((prev) =>
        prev
          ? { ...prev, ...patch, updatedAt: Date.now() }
          : ({ uid, ...patch, createdAt: Date.now(), updatedAt: Date.now() } as OnboardingRecord)
      );
    },
    [uid]
  );

  return { record, loading, updateState };
}