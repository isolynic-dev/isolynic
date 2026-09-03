"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { OnboardingRecord, OnboardingState } from "@/types/onboarding";
import {
  fetchOnboardingState,
  initOnboardingRecord,
  persistOnboardingState,
} from "@/lib/onboarding";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, type Unsubscribe, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HomeSummaryDoc } from "@/types/home";
import { track } from "@/lib/analytics";
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Opportunity, QueueFilter, RecoveredEntry } from '@/types/recovery';






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














///-------- HOME SCREEN ----------/////




// src/hooks/useHomeSummary.ts



interface UseHomeSummaryResult {
  data: HomeSummaryDoc | null;
  loading: boolean;
  error: string | null;
  isFromCache: boolean; // true when Firestore served the local cache (offline/stale)
  isOnline: boolean;
  refresh: () => void;
}

export function useHomeSummary(ownerId: string | null): UseHomeSummaryResult {
  const [data, setData] = useState<HomeSummaryDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const loadStartRef = useRef<number>(Date.now());
  const refreshTick = useRef<number>(0);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const refresh = useCallback(() => {
    refreshTick.current += 1;
    forceTick((t) => t + 1);
    track("home_refresh", { ownerId: ownerId ?? "unknown" });
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    loadStartRef.current = Date.now();

    const ref = doc(db, "homeSummaries", ownerId);

    const unsubscribe: Unsubscribe = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.exists()) {
          setData(null);
          setLoading(false);
          setIsFromCache(snapshot.metadata.fromCache);
          return;
        }
        const summary = snapshot.data() as HomeSummaryDoc;
        setData(summary);
        setIsFromCache(snapshot.metadata.fromCache);
        setLoading(false);
        setError(null);

        const loadTimeMs = Date.now() - loadStartRef.current;
        track("home_load_time", { ms: loadTimeMs, fromCache: snapshot.metadata.fromCache });
      },
      (err: FirestoreError) => {
        setError(humanizeFirestoreError(err));
        setLoading(false);
        track("home_error", { code: err.code, message: err.message });
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, refreshTick.current]);

  const result = useMemo(
    () => ({ data, loading, error, isFromCache, isOnline, refresh }),
    [data, loading, error, isFromCache, isOnline, refresh]
  );

  return result;
}

/**
 * §55 Error Handling — never expose server exceptions.
 */
function humanizeFirestoreError(err: FirestoreError): string {
  switch (err.code) {
    case "permission-denied":
      return "We couldn't load your customer activity.";
    case "unavailable":
      return "You're offline. Showing your latest information.";
    default:
      return "We couldn't load your customer activity.";
  }
}



















