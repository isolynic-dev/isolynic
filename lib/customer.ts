
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  startAfter,
  getDocs,
  addDoc,
  serverTimestamp,
  type Unsubscribe,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  CustomerDoc,
  ConversationDoc,
  MessagePreviewDoc,
  TimelineEventDoc,
  AppointmentDoc,
  CustomerNoteDoc,
  SmartSuggestionDoc,
} from "@/types/customer";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase";
import type { OpportunityDoc } from "@/types/recovery";



const TIMELINE_PAGE_SIZE = 12;
const CONVERSATION_PREVIEW_SIZE = 4;

function withId<T>(d: QueryDocumentSnapshot): T {
  return { id: d.id, ...d.data() } as T;
}

/** Subscribe to the root customer document. Fires null on delete/not-found. */
export function subscribeCustomer(
  customerId: string,
  onData: (c: CustomerDoc | null) => void,
  onError: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "customers", customerId),
    (snap) => {
      if (!snap.exists() || snap.data()?.deletedAt) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() } as CustomerDoc);
    },
    (err) => onError(err)
  );
}

/** Active (non-terminal) opportunities for this customer, most-recent first. */
export function subscribeActiveOpportunities(
  customerId: string,
  onData: (opps: OpportunityDoc[]) => void,
  onError: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "opportunities"),
    where("customerId", "==", customerId),
    where("state", "not-in", ["completed", "lost"]),
    orderBy("state"),
    orderBy("lastActivityAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => withId<OpportunityDoc>(d))),
    onError
  );
}

/** Single most relevant conversation + latest few message previews. */
export function subscribeRecentConversation(
  customerId: string,
  onData: (data: { conversation: ConversationDoc | null; messages: MessagePreviewDoc[] }) => void,
  onError: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "conversations"),
    where("customerId", "==", customerId),
    orderBy("lastMessageAt", "desc"),
    limit(1)
  );

  let unsubMessages: Unsubscribe | null = null;

  const unsubConvo = onSnapshot(
    q,
    (snap) => {
      unsubMessages?.();
      if (snap.empty) {
        onData({ conversation: null, messages: [] });
        return;
      }
      const conversation = withId<ConversationDoc>(snap.docs[0]);
      const msgQuery = query(
        collection(db, "conversations", conversation.id, "messages"),
        orderBy("sentAt", "desc"),
        limit(CONVERSATION_PREVIEW_SIZE)
      );
      unsubMessages = onSnapshot(
        msgQuery,
        (msgSnap) => {
          const messages = msgSnap.docs
            .map((d) => withId<MessagePreviewDoc>(d))
            .reverse(); // chronological for display
          onData({ conversation, messages });
        },
        onError
      );
    },
    onError
  );

  return () => {
    unsubConvo();
    unsubMessages?.();
  };
}

/** First page of timeline, newest first. Returns an unsubscribe + a loader
 * for older pages (spec §86 — no unlimited history on this screen). */
export function subscribeTimelineFirstPage(
  customerId: string,
  onData: (events: TimelineEventDoc[], hasMore: boolean) => void,
  onError: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "customers", customerId, "timeline"),
    orderBy("occurredAt", "desc"),
    limit(TIMELINE_PAGE_SIZE + 1)
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.slice(0, TIMELINE_PAGE_SIZE).map((d) => withId<TimelineEventDoc>(d));
      onData(docs, snap.docs.length > TIMELINE_PAGE_SIZE);
    },
    onError
  );
}

export async function loadOlderTimelineEvents(
  customerId: string,
  after: TimelineEventDoc
): Promise<{ events: TimelineEventDoc[]; hasMore: boolean }> {
  const anchor = await getDocs(
    query(
      collection(db, "customers", customerId, "timeline"),
      orderBy("occurredAt", "desc"),
      where("occurredAt", "==", after.occurredAt),
      limit(1)
    )
  );
  const cursor = anchor.docs[0];
  const q = query(
    collection(db, "customers", customerId, "timeline"),
    orderBy("occurredAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(TIMELINE_PAGE_SIZE + 1)
  );
  const snap = await getDocs(q);
  const events = snap.docs.slice(0, TIMELINE_PAGE_SIZE).map((d) => withId<TimelineEventDoc>(d));
  return { events, hasMore: snap.docs.length > TIMELINE_PAGE_SIZE };
}

export function subscribeAppointments(
  customerId: string,
  onData: (appts: AppointmentDoc[]) => void,
  onError: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "appointments"),
    where("customerId", "==", customerId),
    where("status", "in", ["confirmed", "pending"]),
    orderBy("startsAt", "asc"),
    limit(3)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => withId<AppointmentDoc>(d))),
    onError
  );
}

export function subscribeNotes(
  customerId: string,
  onData: (notes: CustomerNoteDoc[]) => void,
  onError: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "customers", customerId, "notes"),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => withId<CustomerNoteDoc>(d))),
    onError
  );
}

export function subscribePendingSuggestions(
  customerId: string,
  onData: (s: SmartSuggestionDoc[]) => void,
  onError: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "customers", customerId, "smartSuggestions"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(3)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => withId<SmartSuggestionDoc>(d))),
    onError
  );
}

/** Direct client write — plain-text note creation is low-risk and latency
 * sensitive (spec §28 "Saved" should feel instant), so it bypasses a
 * Cloud Function. Firestore rules restrict this to create-only, owner-role,
 * <=1000 chars, and only on customers the caller's business owns. */
export async function createNote(customerId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Note text is required.");
  if (trimmed.length > 1000) throw new Error("Note is too long.");
  await addDoc(collection(db, "customers", customerId, "notes"), {
    text: trimmed,
    createdBy: "owner",
    createdAt: serverTimestamp(),
  });
}






// lib/firebase/customerActions.ts

const functions = getFunctions(firebaseApp);

interface OkResult {
  ok: true;
}

async function call<TReq, TRes = OkResult>(name: string, data: TReq): Promise<TRes> {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  const result = await fn(data);
  return result.data;
}

export const markCustomerNotACustomer = (customerId: string) =>
  call("markCustomerNotACustomer", { customerId });

export const deleteCustomer = (customerId: string) =>
  call("deleteCustomer", { customerId });

export const mergeCustomers = (primaryCustomerId: string, duplicateCustomerId: string) =>
  call("mergeCustomers", { primaryCustomerId, duplicateCustomerId });

export const editCustomerIdentity = (
  customerId: string,
  updates: { displayName?: string; phone?: string; preferredChannel?: "whatsapp" | "phone" | "web" }
) => call("editCustomerIdentity", { customerId, updates });

export const takeOverConversation = (customerId: string, opportunityId?: string) =>
  call("takeOverConversation", { customerId, opportunityId });

export const resumeAutomaticRecovery = (customerId: string, opportunityId: string) =>
  call("resumeAutomaticRecovery", { customerId, opportunityId });

export const stopRecovery = (customerId: string, opportunityId: string) =>
  call("stopRecovery", { customerId, opportunityId });

export const setAutoRecoveryBlocked = (customerId: string, blocked: boolean) =>
  call("setAutoRecoveryBlocked", { customerId, blocked });

export const confirmSmartSuggestion = (customerId: string, suggestionId: string, accept: boolean) =>
  call("confirmSmartSuggestion", { customerId, suggestionId, accept });

export const sendCustomerMessage = (
  customerId: string,
  opportunityId: string | null,
  text: string
) => call<{ customerId: string; opportunityId: string | null; text: string }, { ok: true; queued: boolean }>(
  "sendCustomerMessage",
  { customerId, opportunityId, text }
);