import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  where,
} from "firebase/firestore";

import {
  httpsCallable,
} from "firebase/functions";

import {
  subscribeActiveOpportunities,
  subscribeAppointments,
  subscribeCustomer,
  subscribeNotes,
  subscribePendingSuggestions,
  subscribeRecentConversation,
  subscribeTimelineFirstPage,
  loadOlderTimelineEvents,
} from "@/lib/customer";


import {
  auth,
  db,
  functions,
} from "@/lib/firebase";

import {
  fetchOnboardingState,
  initOnboardingRecord,
  persistOnboardingState,
} from "@/lib/onboarding";

import {
  subscribeToAccount,
} from "@/lib/account";

import {
  track,
} from "@/lib/analytics";

import type {
  OnboardingRecord,
  OnboardingState,
} from "@/types/onboarding";

import type {
  HomeSummaryDoc,
} from "@/types/home";

import type {
  ConversationMessage,
  Conversation,
  SystemEvent,
  TimelineItem,
  Customer,
} from "@/types/conversations";

import type {
  CustomerDoc,
  ConversationDoc,
  MessagePreviewDoc,
  TimelineEventDoc,
  AppointmentDoc,
  CustomerNoteDoc,
  SmartSuggestionDoc,
} from "@/types/customer";

import type {
  AccountState,
} from "@/types/account";

import {
  ACTIVE_QUEUE_STATUSES,
  RECENTLY_RESOLVED_STATUSES,
  type OpportunityDoc,
} from "@/types/recovery";







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




























///---- RECOVERY QUEUE ----///



// hooks/useRecoveryQueue.ts


const RECENT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type QueueFilter = 'all' | 'needs_you' | 'handled';

interface UseRecoveryQueueResult {
  loading: boolean;
  errored: boolean;
  fromCache: boolean;
  active: OpportunityDoc[];
  recentlyRecovered: OpportunityDoc[];
  newlyArrivedId: string | null;
  dismissNewlyArrived: () => void;
}

export function useRecoveryQueue(businessId: string | null): UseRecoveryQueueResult {
  const [active, setActive] = useState<OpportunityDoc[]>([]);
  const [recentlyRecovered, setRecentlyRecovered] = useState<OpportunityDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [newlyArrivedId, setNewlyArrivedId] = useState<string | null>(null);

  const knownIds = useRef<Set<string>>(new Set());
  const isFirstSnapshot = useRef(true);

  useEffect(() => {
    if (!businessId) return;

    const unsubs: Unsubscribe[] = [];

    const activeQuery = query(
      collection(db, 'opportunities'),
      where('businessId', '==', businessId),
      where('status', 'in', ACTIVE_QUEUE_STATUSES),
      orderBy('priorityScore', 'desc'),
      limit(100)
    );

    unsubs.push(
      onSnapshot(
        activeQuery,
        (snap) => {
          setLoading(false);
          setErrored(false);
          setFromCache(snap.metadata.fromCache);

          const docs = snap.docs.map((d) => d.data() as OpportunityDoc);

          // Detect genuinely new high-confidence opportunities to power the subtle banner (§25).
          if (!isFirstSnapshot.current) {
            for (const change of snap.docChanges()) {
              if (change.type === 'added' && !knownIds.current.has(change.doc.id)) {
                const doc = change.doc.data() as OpportunityDoc;
                if (doc.priorityBand === 'high') {
                  setNewlyArrivedId(doc.id);
                }
              }
            }
          }

          knownIds.current = new Set(docs.map((d) => d.id));
          isFirstSnapshot.current = false;
          setActive(docs);
        },
        () => {
          setLoading(false);
          setErrored(true);
        }
      )
    );

    const recentQuery = query(
      collection(db, 'opportunities'),
      where('businessId', '==', businessId),
      where('status', 'in', RECENTLY_RESOLVED_STATUSES),
      where('updatedAt', '>=', Date.now() - RECENT_LOOKBACK_MS),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );

    unsubs.push(
      onSnapshot(recentQuery, (snap) => {
        setRecentlyRecovered(snap.docs.map((d) => d.data() as OpportunityDoc));
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [businessId]);

  return {
    loading,
    errored,
    fromCache,
    active,
    recentlyRecovered,
    newlyArrivedId,
    dismissNewlyArrived: () => setNewlyArrivedId(null),
  };
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useFilteredQueue(active: OpportunityDoc[], filter: QueueFilter) {
  return useMemo(() => {
    if (filter === 'all') return active;
    if (filter === 'needs_you') {
      return active.filter(
        (o) => o.decisionBand === 'human_required' || o.status === 'CUSTOMER_RESPONDED'
      );
    }
    return active.filter((o) => o.status === 'HANDLED' || o.status === 'BOOKED' || o.status === 'WON');
  }, [active, filter]);
}
























////-----OPPORTUNITY SCREEN-----////



// hooks/useOpportunity.ts

import type {
  Opportunity,
  TimelineEvent,
  RecoverResponse,
  TakeoverResponse,
  DismissResponse,
  ResolveResponse,
} from '@/types/opportunity';

interface UseOpportunityResult {
  opportunity: Opportunity | null;
  timeline: TimelineEvent[];
  loading: boolean;
  error: string | null;
  justUpdated: boolean;
  recover: (message?: string) => Promise<RecoverResponse>;
  takeover: () => Promise<TakeoverResponse>;
  dismiss: () => Promise<DismissResponse>;
  undoDismiss: (token: string) => Promise<{ status: string }>;
  addNote: (note: string) => Promise<{ status: string }>;
  resolve: (
    outcome: 'won' | 'lost',
    detail?: { value?: number; reason?: string }
  ) => Promise<ResolveResponse>;
}

const TIMELINE_PAGE_SIZE = 20;

export function useOpportunity(opportunityId: string): UseOpportunityResult {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const firstSnapshot = useRef(true);
  const updateFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live opportunity document
  useEffect(() => {
    if (!opportunityId) return;
    setLoading(true);
    const ref = doc(db, 'opportunities', opportunityId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError('not_found');
          setOpportunity(null);
          setLoading(false);
          return;
        }
        setOpportunity(snap.data() as Opportunity);
        setLoading(false);
        setError(null);

        if (!firstSnapshot.current) {
          setJustUpdated(true);
          if (updateFlashTimer.current) clearTimeout(updateFlashTimer.current);
          updateFlashTimer.current = setTimeout(() => setJustUpdated(false), 4000);
        }
        firstSnapshot.current = false;
      },
      (err) => {
        console.error('Opportunity snapshot error', err);
        setError('load_failed');
        setLoading(false);
      }
    );

    return () => {
      unsub();
      if (updateFlashTimer.current) clearTimeout(updateFlashTimer.current);
    };
  }, [opportunityId]);

  // Live timeline (most recent N events; older ones are summarized in UI)
  useEffect(() => {
    if (!opportunityId) return;
    const q = query(
      collection(db, 'opportunities', opportunityId, 'timeline'),
      orderBy('timestamp', 'desc'),
      limit(TIMELINE_PAGE_SIZE)
    );
    const unsub = onSnapshot(q, (snap) => {
      const events = snap.docs.map((d) => d.data() as TimelineEvent).reverse();
      setTimeline(events);
    });
    return () => unsub();
  }, [opportunityId]);

  const recover = useCallback(
    async (message?: string): Promise<RecoverResponse> => {
      const fn = httpsCallable<{ opportunityId: string; message?: string }, RecoverResponse>(
        functions,
        'recoverOpportunity'
      );
      const res = await fn({ opportunityId, message });
      return res.data;
    },
    [opportunityId]
  );

  const takeover = useCallback(async (): Promise<TakeoverResponse> => {
    const fn = httpsCallable<{ opportunityId: string }, TakeoverResponse>(
      functions,
      'takeoverOpportunity'
    );
    const res = await fn({ opportunityId });
    return res.data;
  }, [opportunityId]);

  const dismiss = useCallback(async (): Promise<DismissResponse> => {
    const fn = httpsCallable<{ opportunityId: string }, DismissResponse>(
      functions,
      'dismissOpportunity'
    );
    const res = await fn({ opportunityId });
    return res.data;
  }, [opportunityId]);

  const undoDismiss = useCallback(
    async (token: string) => {
      const fn = httpsCallable<{ opportunityId: string; undoToken: string }, { status: string }>(
        functions,
        'undoOpportunityAction'
      );
      const res = await fn({ opportunityId, undoToken: token });
      return res.data;
    },
    [opportunityId]
  );

  const addNote = useCallback(
    async (note: string) => {
      const fn = httpsCallable<{ opportunityId: string; note: string }, { status: string }>(
        functions,
        'addOpportunityNote'
      );
      const res = await fn({ opportunityId, note });
      return res.data;
    },
    [opportunityId]
  );

  const resolve = useCallback(
    async (
      outcome: 'won' | 'lost',
      detail?: { value?: number; reason?: string }
    ): Promise<ResolveResponse> => {
      const fn = httpsCallable<
        { opportunityId: string; outcome: 'won' | 'lost'; value?: number; reason?: string },
        ResolveResponse
      >(functions, 'resolveOpportunity');
      const res = await fn({ opportunityId, outcome, ...detail });
      return res.data;
    },
    [opportunityId]
  );

  return {
    opportunity,
    timeline,
    loading,
    error,
    justUpdated,
    recover,
    takeover,
    dismiss,
    undoDismiss,
    addNote,
    resolve,
  };
}






























///-------CONVERSATION SCREEN-----/////



// hooks/useConversation.ts


type UseConversationResult = {
  conversation: Conversation | null;
  loading: boolean;
  error: FirestoreError | null;
};

function mapConversation(id: string, data: DocumentData): Conversation {
  return {
    id,
    businessId: data.businessId,
    customerId: data.customerId,
    opportunityId: data.opportunityId,
    channel: data.channel,
    status: data.status,
    ownershipMode: data.ownershipMode,
    summary: data.summary ?? "",
    whyHere: data.whyHere ?? null,
    recommendedAction: data.recommendedAction ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastCustomerActivity: data.lastCustomerActivity ?? null,
    lastOwnerActivity: data.lastOwnerActivity ?? null,
    lastIsolynicActivity: data.lastIsolynicActivity ?? null,
    currentBooking: data.currentBooking ?? null,
    isClosed: !!data.isClosed,
    closedReason: data.closedReason,
  };
}

/**
 * Real-time subscription to a single conversation document.
 * Backs header/status/banner state (spec §41 real-time behavior).
 */
export function useConversation(conversationId: string | null): UseConversationResult {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setConversation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "conversations", conversationId);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setConversation(null);
          setLoading(false);
          return;
        }
        setConversation(mapConversation(snap.id, snap.data()));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId]);

  return { conversation, loading, error };
}






// hooks/useConversationTimeline.ts



const PAGE_SIZE = 40;

function mapMessage(id: string, data: DocumentData): ConversationMessage {
  return {
    id,
    conversationId: data.conversationId,
    senderType: data.senderType,
    channel: data.channel,
    body: data.body ?? "",
    attachments: data.attachments ?? [],
    timestamp: data.timestamp,
    deliveryStatus: data.deliveryStatus,
    providerReference: data.providerReference,
    isAutomaticFollowUp: !!data.isAutomaticFollowUp,
    isPrivateNote: !!data.isPrivateNote,
  };
}

function mapSystemEvent(id: string, data: DocumentData): SystemEvent {
  return {
    id,
    conversationId: data.conversationId,
    type: data.type,
    label: data.label,
    timestamp: data.timestamp,
    metadata: data.metadata ?? {},
  };
}

/**
 * Windowed / paginated conversation timeline (spec §58 — never load an
 * unbounded conversation into the browser). Subscribes in real time to the
 * most recent PAGE_SIZE items, and supports loading older history on demand
 * (one-shot fetch, not subscribed, to bound listener cost).
 */
export function useConversationTimeline(conversationId: string | null) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const toTimelineItem = useCallback(
    (docSnap: QueryDocumentSnapshot<DocumentData>): TimelineItem => {
      const data = docSnap.data();
      if (data._collectionType === "system_event") {
        return { kind: "system_event", data: mapSystemEvent(docSnap.id, data) };
      }
      return { kind: "message", data: mapMessage(docSnap.id, data) };
    },
    []
  );

  // Live subscription to the latest window.
  useEffect(() => {
    if (!conversationId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const timelineRef = collection(db, "conversations", conversationId, "timeline");
    const q = query(timelineRef, orderBy("timestamp", "desc"), limit(PAGE_SIZE));

    const unsubscribe = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map(toTimelineItem).reverse(); // chronological asc
      setItems(mapped);
      oldestDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId, toTimelineItem]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !oldestDocRef.current || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const timelineRef = collection(db, "conversations", conversationId, "timeline");
      const q = query(
        timelineRef,
        orderBy("timestamp", "desc"),
        startAfter(oldestDocRef.current),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const older = snap.docs.map(toTimelineItem).reverse();
      setItems((prev) => [...older, ...prev]);
      oldestDocRef.current = snap.docs[snap.docs.length - 1] ?? oldestDocRef.current;
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, toTimelineItem]);

  return { items, loading, loadingMore, hasMore, loadOlder };
}



// hooks/useCustomer.ts



export function useCustomer(customerId: string | null) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, "customers", customerId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setCustomer(null);
      } else {
        setCustomer({ id: snap.id, ...(snap.data() as Omit<Customer, "id">) });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [customerId]);

  return { customer, loading };
}




// hooks/useConnectionStatus.ts


/**
 * Tracks browser connectivity for offline banners (spec §99–100).
 */
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 4000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, justReconnected };
}


















///-----CUSTOMER SCREEN-----///




// hooks/useCustomerScreen.ts


type LoadState = "loading" | "ready" | "not_found" | "error";

interface UseCustomerScreenResult {
  loadState: LoadState;
  customer: CustomerDoc | null;
  activeOpportunities: OpportunityDoc[];
  conversation: ConversationDoc | null;
  messages: MessagePreviewDoc[];
  timeline: TimelineEventDoc[];
  timelineHasMore: boolean;
  loadMoreTimeline: () => Promise<void>;
  timelineLoadingMore: boolean;
  appointments: AppointmentDoc[];
  notes: CustomerNoteDoc[];
  pendingSuggestions: SmartSuggestionDoc[];
  isOffline: boolean;
  error: Error | null;
  retry: () => void;
}

/** Composes every real-time slice this screen needs into one view-model,
 * so the identity block can render before slower sections resolve
 * (spec §54 — skeletons per-section, identity first). */
export function useCustomerScreen(customerId: string | null): UseCustomerScreenResult {
  const [retryTick, setRetryTick] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<Error | null>(null);

  const [customer, setCustomer] = useState<CustomerDoc | null>(null);
  const [activeOpportunities, setActiveOpportunities] = useState<OpportunityDoc[]>([]);
  const [conversation, setConversation] = useState<ConversationDoc | null>(null);
  const [messages, setMessages] = useState<MessagePreviewDoc[]>([]);
  const [timeline, setTimeline] = useState<TimelineEventDoc[]>([]);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [notes, setNotes] = useState<CustomerNoteDoc[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<SmartSuggestionDoc[]>([]);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const lastTimelineDocRef = useRef<TimelineEventDoc | null>(null);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const handleError = useCallback((e: Error) => {
    setError(e);
    setLoadState("error");
  }, []);

  useEffect(() => {
    if (!customerId) return;
    setLoadState("loading");
    setError(null);

    const unsubCustomer = subscribeCustomer(
      customerId,
      (c) => {
        setCustomer(c);
        setLoadState((prev) => (c === null ? "not_found" : prev === "error" ? "error" : "ready"));
      },
      handleError
    );

    const unsubOpps = subscribeActiveOpportunities(customerId, setActiveOpportunities, handleError);

    const unsubConvo = subscribeRecentConversation(
      customerId,
      (d) => {
        setConversation(d.conversation);
        setMessages(d.messages);
      },
      handleError
    );

    const unsubTimeline = subscribeTimelineFirstPage(
      customerId,
      (events, hasMore) => {
        setTimeline(events);
        setTimelineHasMore(hasMore);
        lastTimelineDocRef.current = events[events.length - 1] ?? null;
      },
      handleError
    );

    const unsubAppts = subscribeAppointments(customerId, setAppointments, handleError);
    const unsubNotes = subscribeNotes(customerId, setNotes, handleError);
    const unsubSuggestions = subscribePendingSuggestions(customerId, setPendingSuggestions, handleError);

    return () => {
      unsubCustomer();
      unsubOpps();
      unsubConvo();
      unsubTimeline();
      unsubAppts();
      unsubNotes();
      unsubSuggestions();
    };
  }, [customerId, retryTick, handleError]);

  const loadMoreTimeline = useCallback(async () => {
    if (!customerId || !lastTimelineDocRef.current || timelineLoadingMore) return;
    setTimelineLoadingMore(true);
    try {
      const { events, hasMore } = await loadOlderTimelineEvents(customerId, lastTimelineDocRef.current);
      setTimeline((prev) => [...prev, ...events]);
      setTimelineHasMore(hasMore);
      if (events.length) lastTimelineDocRef.current = events[events.length - 1];
    } catch (e) {
      // Non-fatal: older history failing to load shouldn't break the screen.
      console.error("Failed to load older timeline events", e);
    } finally {
      setTimelineLoadingMore(false);
    }
  }, [customerId, timelineLoadingMore]);

  const retry = useCallback(() => setRetryTick((t) => t + 1), []);

  return useMemo(
    () => ({
      loadState,
      customer,
      activeOpportunities,
      conversation,
      messages,
      timeline,
      timelineHasMore,
      loadMoreTimeline,
      timelineLoadingMore,
      appointments,
      notes,
      pendingSuggestions,
      isOffline,
      error,
      retry,
    }),
    [
      loadState,
      customer,
      activeOpportunities,
      conversation,
      messages,
      timeline,
      timelineHasMore,
      loadMoreTimeline,
      timelineLoadingMore,
      appointments,
      notes,
      pendingSuggestions,
      isOffline,
      error,
      retry,
    ]
  );
}
















///----- ACCOUNT SCREEN -----///





// hooks/useAccount.ts

'use client';



interface UseAccountResult {
  account: AccountState | null;
  loading: boolean;
  error: string | null;
}

export function useAccount(): UseAccountResult {
  const { user } = useAuth();
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setAccount(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToAccount(
      user.uid,
      (state) => {
        setAccount(state);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  return { account, loading, error };
}

// Generic "save with transient confirmation" wrapper used across sections (§58, §73)
export function useSavedConfirmation() {
  const [saved, setSaved] = useState(false);
  const flash = useCallback(() => {
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, []);
  return { saved, flash };
}

