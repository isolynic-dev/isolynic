
// functions/src/conversation/types.ts

import { Timestamp } from "firebase-admin/firestore";

export type Channel = "whatsapp" | "phone" | "website" | "sms";
export type SenderType = "CUSTOMER" | "ISOLYNIC" | "OWNER" | "SYSTEM";
export type OwnershipMode = "ISOLYNIC" | "OWNER" | "WAITING";
export type OpportunityStatus =
  | "active"
  | "isolynic_handling"
  | "waiting_for_customer"
  | "needs_attention"
  | "booked"
  | "recovered"
  | "lost";

export interface ConversationDoc {
  businessId: string;
  customerId: string;
  opportunityId: string;
  channel: Channel;
  status: OpportunityStatus;
  ownershipMode: OwnershipMode;
  summary: string;
  whyHere: string | null;
  recommendedAction: { action: string; reason: string } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastCustomerActivity: Timestamp | null;
  lastOwnerActivity: Timestamp | null;
  lastIsolynicActivity: Timestamp | null;
  currentBooking: Record<string, unknown> | null;
  isClosed: boolean;
  closedReason?: string;
}

export interface TimelineMessageDoc {
  _collectionType: "message";
  conversationId: string;
  senderType: SenderType;
  channel: Channel;
  body: string;
  attachments: unknown[];
  timestamp: Timestamp;
  deliveryStatus?: string;
  providerReference?: string;
  isAutomaticFollowUp?: boolean;
  isPrivateNote?: boolean;
}

export interface TimelineSystemEventDoc {
  _collectionType: "system_event";
  conversationId: string;
  type: string;
  label: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}
```

---

## 27. `functions/src/conversation/auth.ts`

```typescript
// functions/src/conversation/auth.ts

import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Server-side authorization boundary (spec §105): the client never decides
 * conversation access — every callable re-verifies ownership here.
 */
export async function assertConversationAccess(
  request: CallableRequest,
  conversationId: string
) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const businessId = request.auth.token.businessId as string | undefined;
  if (!businessId) {
    throw new HttpsError("permission-denied", "No business associated with this account.");
  }

  const convoRef = db.collection("conversations").doc(conversationId);
  const convoSnap = await convoRef.get();
  if (!convoSnap.exists) {
    throw new HttpsError("not-found", "Conversation not found.");
  }
  const data = convoSnap.data()!;
  if (data.businessId !== businessId) {
    throw new HttpsError("permission-denied", "You don't have access to this conversation.");
  }

  return { convoRef, data, uid: request.auth.uid, businessId };
}
```

---

## 28. `functions/src/conversation/callables.ts`

```typescript
// functions/src/conversation/callables.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { assertConversationAccess } from "./auth";
import { sendOutboundMessage } from "./channelDispatch";
import { generateReplySuggestion } from "./ai";
import { findAvailableSlots, insertCalendarEvent } from "./calendar";
import { logSecurityEvent } from "./audit";

const db = getFirestore();

/**
 * Owner sends a manual message. Manual means manual (spec §48) — the body
 * is sent verbatim, never rewritten by AI.
 */
export const sendOwnerMessage = onCall(async (request) => {
  const { conversationId, body } = request.data as { conversationId: string; body: string };
  if (!body || !body.trim()) {
    throw new HttpsError("invalid-argument", "Message body is required.");
  }
  if (body.length > 4000) {
    throw new HttpsError("invalid-argument", "Message is too long.");
  }

  const { convoRef, data, uid } = await assertConversationAccess(request, conversationId);

  const timelineRef = convoRef.collection("timeline").doc();
  const now = Timestamp.now();

  await timelineRef.set({
    _collectionType: "message",
    conversationId,
    senderType: "OWNER",
    channel: data.channel,
    body: body.trim(),
    attachments: [],
    timestamp: now,
    deliveryStatus: "sending",
    authorUid: uid,
  });

  await convoRef.update({
    lastOwnerActivity: now,
    updatedAt: now,
  });

  try {
    const providerReference = await sendOutboundMessage({
      businessId: data.businessId,
      customerId: data.customerId,
      channel: data.channel,
      body: body.trim(),
    });
    await timelineRef.update({ deliveryStatus: "sent", providerReference });
  } catch (err) {
    await timelineRef.update({ deliveryStatus: "failed" });
    throw new HttpsError("internal", "Couldn't send the message. Try again.");
  }

  return { success: true, messageId: timelineRef.id };
});

export const retryFailedMessage = onCall(async (request) => {
  const { conversationId, messageId } = request.data as {
    conversationId: string;
    messageId: string;
  };
  const { convoRef, data } = await assertConversationAccess(request, conversationId);

  const msgRef = convoRef.collection("timeline").doc(messageId);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) throw new HttpsError("not-found", "Message not found.");
  const msg = msgSnap.data()!;

  if (msg.deliveryStatus !== "failed") {
    throw new HttpsError("failed-precondition", "This message isn't in a failed state.");
  }

  await msgRef.update({ deliveryStatus: "sending" });
  try {
    const providerReference = await sendOutboundMessage({
      businessId: data.businessId,
      customerId: data.customerId,
      channel: data.channel,
      body: msg.body,
    });
    await msgRef.update({ deliveryStatus: "sent", providerReference });
  } catch {
    await msgRef.update({ deliveryStatus: "failed" });
    throw new HttpsError("internal", "Couldn't send the message. Try again.");
  }

  return { success: true };
});

/**
 * One tap, no confirmation friction (spec §26–27): stop autonomous
 * handling immediately and hand control to the owner.
 */
export const takeOverConversation = onCall(async (request) => {
  const { conversationId } = request.data as { conversationId: string };
  const { convoRef, uid } = await assertConversationAccess(request, conversationId);

  const now = Timestamp.now();
  await convoRef.update({
    ownershipMode: "OWNER",
    updatedAt: now,
  });

  await convoRef.collection("timeline").add({
    _collectionType: "system_event",
    conversationId,
    type: "owner_takeover",
    label: "You took over this conversation",
    timestamp: now,
  });

  await logSecurityEvent({ type: "owner_takeover", conversationId, uid });

  return { success: true };
});

export const releaseConversationToIsolynic = onCall(async (request) => {
  const { conversationId } = request.data as { conversationId: string };
  const { convoRef, uid } = await assertConversationAccess(request, conversationId);

  const now = Timestamp.now();
  await convoRef.update({
    ownershipMode: "ISOLYNIC",
    updatedAt: now,
  });

  await convoRef.collection("timeline").add({
    _collectionType: "system_event",
    conversationId,
    type: "owner_released",
    label: "Isolynic is handling this conversation again",
    timestamp: now,
  });

  await logSecurityEvent({ type: "owner_released", conversationId, uid });

  return { success: true };
});

/**
 * One suggested reply, contextual, never auto-sent (spec §25).
 */
export const suggestReply = onCall(async (request) => {
  const { conversationId } = request.data as { conversationId: string };
  const { data } = await assertConversationAccess(request, conversationId);

  const suggestion = await generateReplySuggestion({
    conversationId,
    businessId: data.businessId,
    customerId: data.customerId,
  });

  return { suggestion };
});

export const markNotOpportunity = onCall(async (request) => {
  const { conversationId } = request.data as { conversationId: string };
  const { convoRef, data, uid } = await assertConversationAccess(request, conversationId);

  await convoRef.update({
    recommendedAction: null,
    whyHere: null,
    updatedAt: Timestamp.now(),
  });

  await db.collection("opportunities").doc(data.opportunityId).update({
    excludedFromRecovery: true,
    excludedAt: Timestamp.now(),
    // Feedback signal for the opportunity engine's future training (spec §52).
    feedback: FieldValue.arrayUnion({ type: "not_opportunity", uid, at: Timestamp.now() }),
  });

  return { success: true };
});

export const closeConversation = onCall(async (request) => {
  const { conversationId, reason } = request.data as {
    conversationId: string;
    reason: string;
  };
  const { convoRef, uid } = await assertConversationAccess(request, conversationId);

  const now = Timestamp.now();
  await convoRef.update({
    isClosed: true,
    status: "lost",
    closedReason: reason || "Closed by owner",
    updatedAt: now,
  });

  await convoRef.collection("timeline").add({
    _collectionType: "system_event",
    conversationId,
    type: "conversation_closed",
    label: "Closed",
    timestamp: now,
  });

  await logSecurityEvent({ type: "conversation_closed", conversationId, uid });
  return { success: true };
});

export const reopenConversation = onCall(async (request) => {
  const { conversationId } = request.data as { conversationId: string };
  const { convoRef } = await assertConversationAccess(request, conversationId);

  await convoRef.update({
    isClosed: false,
    status: "active",
    closedReason: FieldValue.delete(),
    updatedAt: Timestamp.now(),
  });

  return { success: true };
});

export const deleteConversationRequest = onCall(async (request) => {
  const { conversationId } = request.data as { conversationId: string };
  const { convoRef, uid } = await assertConversationAccess(request, conversationId);

  await logSecurityEvent({ type: "conversation_deleted", conversationId, uid });

  // Soft-delete: preserve for audit/compliance, hide from normal listing.
  await convoRef.update({
    deleted: true,
    deletedAt: Timestamp.now(),
    deletedBy: uid,
  });

  return { success: true };
});

export const addPrivateNote = onCall(async (request) => {
  const { conversationId, body } = request.data as { conversationId: string; body: string };
  if (!body?.trim()) throw new HttpsError("invalid-argument", "Note body is required.");

  const { convoRef, uid } = await assertConversationAccess(request, conversationId);

  await convoRef.collection("notes").add({
    conversationId,
    authorId: uid,
    body: body.trim(),
    createdAt: Timestamp.now(),
  });

  return { success: true };
});

export const resolveIdentityMatch = onCall(async (request) => {
  const { conversationId, decision } = request.data as {
    conversationId: string;
    decision: "merge" | "keep_separate";
  };
  const { data } = await assertConversationAccess(request, conversationId);

  const customerRef = db.collection("customers").doc(data.customerId);
  const customerSnap = await customerRef.get();
  if (!customerSnap.exists) throw new HttpsError("not-found", "Customer not found.");
  const customer = customerSnap.data()!;

  if (decision === "keep_separate") {
    await customerRef.update({
      identityConfidence: "confirmed",
      possibleDuplicateCustomerId: FieldValue.delete(),
    });
    return { success: true };
  }

  const duplicateId = customer.possibleDuplicateCustomerId;
  if (!duplicateId) {
    throw new HttpsError("failed-precondition", "No candidate match to merge with.");
  }

  // Merge: move duplicate's conversations to the primary customer record,
  // then mark the duplicate inactive. Never silently overwrite history.
  const batch = db.batch();
  const dupeConvos = await db
    .collection("conversations")
    .where("customerId", "==", duplicateId)
    .get();
  dupeConvos.forEach((doc) => {
    batch.update(doc.ref, { customerId: data.customerId });
  });
  batch.update(customerRef, {
    identityConfidence: "confirmed",
    possibleDuplicateCustomerId: FieldValue.delete(),
  });
  batch.update(db.collection("customers").doc(duplicateId), {
    mergedInto: data.customerId,
    active: false,
  });
  await batch.commit();

  return { success: true };
});

export const getAvailableSlots = onCall(async (request) => {
  const { conversationId, dateIso } = request.data as {
    conversationId: string;
    dateIso: string;
  };
  const { data } = await assertConversationAccess(request, conversationId);

  const slots = await findAvailableSlots(data.businessId, new Date(dateIso));
  return { slots };
});

export const createBooking = onCall(async (request) => {
  const { conversationId, startTimeIso, endTimeIso, timezone } = request.data as {
    conversationId: string;
    startTimeIso: string;
    endTimeIso: string;
    timezone: string;
  };
  const { convoRef, data, uid } = await assertConversationAccess(request, conversationId);

  const event = await insertCalendarEvent({
    businessId: data.businessId,
    customerId: data.customerId,
    startTimeIso,
    endTimeIso,
    timezone,
  });

  const now = Timestamp.now();
  const booking = {
    id: event.eventId,
    startTime: Timestamp.fromDate(new Date(startTimeIso)),
    endTime: Timestamp.fromDate(new Date(endTimeIso)),
    timezone,
    status: "confirmed",
    calendarEventId: event.eventId,
  };

  await convoRef.update({
    currentBooking: booking,
    status: "booked",
    updatedAt: now,
  });

  await convoRef.collection("timeline").add({
    _collectionType: "system_event",
    conversationId,
    type: "booking_created",
    label: `Appointment confirmed — ${new Date(startTimeIso).toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    })}`,
    timestamp: now,
    metadata: { bookingId: event.eventId },
  });

  await logSecurityEvent({ type: "booking_created", conversationId, uid });

  return { success: true, bookingId: event.eventId };
});
```

---

## 29. `functions/src/conversation/channelDispatch.ts`

```typescript
// functions/src/conversation/channelDispatch.ts

import { getFirestore } from "firebase-admin/firestore";
import { Channel } from "./types";

const db = getFirestore();

interface SendParams {
  businessId: string;
  customerId: string;
  channel: Channel;
  body: string;
}

/**
 * Provider abstraction (spec §107–108): the rest of the system never
 * references Twilio/Meta/etc. directly — only this module does.
 */
export async function sendOutboundMessage(params: SendParams): Promise<string> {
  const customerSnap = await db.collection("customers").doc(params.customerId).get();
  if (!customerSnap.exists) throw new Error("Customer not found");
  const customer = customerSnap.data()!;

  switch (params.channel) {
    case "whatsapp":
      return sendViaWhatsApp(customer.phone, params.body);
    case "sms":
      return sendViaSms(customer.phone, params.body);
    case "website":
      return sendViaWebsiteWidget(params.customerId, params.body);
    case "phone":
      // Voice channel has no text-send path; caller should use the call flow.
      throw new Error("Cannot send a text message on the phone channel.");
    default:
      throw new Error(`Unsupported channel: ${params.channel}`);
  }
}

async function sendViaWhatsApp(phone: string, body: string): Promise<string> {
  // TODO: integrate WhatsApp Business Cloud API (Meta) send-message endpoint.
  // Return the provider message ID for delivery-status reconciliation.
  const providerMessageId = `wa_${Date.now()}`;
  return providerMessageId;
}

async function sendViaSms(phone: string, body: string): Promise<string> {
  // TODO: integrate Twilio (or equivalent) SMS send.
  const providerMessageId = `sms_${Date.now()}`;
  return providerMessageId;
}

async function sendViaWebsiteWidget(customerId: string, body: string): Promise<string> {
  // TODO: push to the website chat widget's realtime channel.
  const providerMessageId = `web_${Date.now()}`;
  return providerMessageId;
}
```

---

## 30. `functions/src/conversation/ai.ts`

```typescript
// functions/src/conversation/ai.ts

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import { defineSecret } from "firebase-functions/params";

const db = getFirestore();
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

interface SuggestionParams {
  conversationId: string;
  businessId: string;
  customerId: string;
}

/**
 * Reply suggestion (spec §25): contextual, single suggestion, never
 * auto-sent. Also enforces the "no hallucinated facts" gate from spec §47
 * by only allowing the model to draw on stored business facts + the
 * observed conversation.
 */
export async function generateReplySuggestion(
  params: SuggestionParams
): Promise<string | null> {
  const [recentMessages, businessFacts] = await Promise.all([
    getRecentMessages(params.conversationId, 20),
    getBusinessFacts(params.businessId),
  ]);

  if (recentMessages.length === 0) return null;

  const client = new Anthropic({ apiKey: anthropicApiKey.value() });

  const transcript = recentMessages
    .map((m) => `${m.senderType}: ${m.body}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: [
      "You draft one short, concrete reply for a small-business owner to review before sending to a customer.",
      "Only use facts explicitly present in the business facts or the conversation transcript below.",
      "Never invent prices, availability, timelines, or promises the business hasn't stated.",
      "If you cannot draft a safe reply without inventing facts, respond with exactly: NONE",
      `Business facts: ${JSON.stringify(businessFacts)}`,
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: `Conversation so far:\n${transcript}\n\nDraft one short reply from the business.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  if (!text || text === "NONE") return null;
  return text;
}

async function getRecentMessages(conversationId: string, n: number) {
  const snap = await db
    .collection("conversations")
    .doc(conversationId)
    .collection("timeline")
    .where("_collectionType", "==", "message")
    .orderBy("timestamp", "desc")
    .limit(n)
    .get();
  return snap.docs.map((d) => d.data()).reverse() as { senderType: string; body: string }[];
}

async function getBusinessFacts(businessId: string) {
  const snap = await db.collection("businesses").doc(businessId).get();
  if (!snap.exists) return {};
  const data = snap.data()!;
  return {
    services: data.services ?? [],
    pricing: data.pricing ?? {},
    hours: data.hours ?? {},
    policies: data.policies ?? {},
  };
}

/**
 * Rolling conversation summary (spec §74–75). Runs after each new customer
 * message to keep the owner-facing summary current, restricted to
 * business-relevant facts only — never psychological profiling.
 */
export async function regenerateConversationSummary(conversationId: string, businessId: string) {
  const recentMessages = await getRecentMessages(conversationId, 30);
  if (recentMessages.length === 0) return;

  const client = new Anthropic({ apiKey: anthropicApiKey.value() });
  const transcript = recentMessages.map((m) => `${m.senderType}: ${m.body}`).join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 120,
    system: [
      "Summarize this customer conversation in one or two short sentences for a business owner.",
      "Include only: the request, timing/location preferences, quotes/pricing discussed, appointment status, and the next expected action.",
      "Never include personality assessments, sensitive personal characteristics, or speculation.",
    ].join("\n"),
    messages: [{ role: "user", content: transcript }],
  });

  const summary = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  if (summary) {
    await db.collection("conversations").doc(conversationId).update({
      summary,
      updatedAt: Timestamp.now(),
    });
  }
}
```

---

## 31. `functions/src/conversation/calendar.ts`

```typescript
// functions/src/conversation/calendar.ts

import { google } from "googleapis";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";

const db = getFirestore();
const googleClientSecret = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");

async function getAuthorizedClient(businessId: string) {
  const businessSnap = await db.collection("businesses").doc(businessId).get();
  if (!businessSnap.exists) throw new Error("Business not found");
  const business = businessSnap.data()!;
  const tokens = business.googleCalendarTokens;
  if (!tokens?.refresh_token) {
    throw new Error("Calendar isn't connected for this business.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret.value()
  );
  oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
  return oauth2Client;
}

/**
 * Uses Google Calendar's events.insert endpoint for booking creation,
 * as referenced in the spec (§30). Availability is computed from
 * freebusy.query against the business's connected calendar plus a
 * configured working-hours window.
 */
export async function findAvailableSlots(
  businessId: string,
  date: Date
): Promise<{ startIso: string; endIso: string }[]> {
  const businessSnap = await db.collection("businesses").doc(businessId).get();
  const business = businessSnap.data() ?? {};
  const workingHours = business.workingHours ?? { startHour: 9, endHour: 17 };
  const slotMinutes = business.appointmentSlotMinutes ?? 60;
  const calendarId = business.googleCalendarId ?? "primary";

  const auth = await getAuthorizedClient(businessId);
  const calendar = google.calendar({ version: "v3", auth });

  const dayStart = new Date(date);
  dayStart.setHours(workingHours.startHour, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(workingHours.endHour, 0, 0, 0);

  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busy = freebusy.data.calendars?.[calendarId]?.busy ?? [];

  const slots: { startIso: string; endIso: string }[] = [];
  const cursor = new Date(dayStart);
  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + slotMinutes * 60000);
    if (slotEnd > dayEnd) break;

    const overlapsBusy = busy.some((b) => {
      const bStart = new Date(b.start!);
      const bEnd = new Date(b.end!);
      return cursor < bEnd && slotEnd > bStart;
    });

    const isPast = cursor.getTime() < Date.now();

    if (!overlapsBusy && !isPast) {
      slots.push({ startIso: cursor.toISOString(), endIso: slotEnd.toISOString() });
    }
    cursor.setTime(cursor.getTime() + slotMinutes * 60000);
  }

  return slots;
}

export async function insertCalendarEvent(params: {
  businessId: string;
  customerId: string;
  startTimeIso: string;
  endTimeIso: string;
  timezone: string;
}): Promise<{ eventId: string }> {
  const businessSnap = await db.collection("businesses").doc(params.businessId).get();
  const business = businessSnap.data() ?? {};
  const calendarId = business.googleCalendarId ?? "primary";

  const customerSnap = await db.collection("customers").doc(params.customerId).get();
  const customer = customerSnap.data() ?? {};

  const auth = await getAuthorizedClient(params.businessId);
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Appointment — ${customer.name ?? "Customer"}`,
      start: { dateTime: params.startTimeIso, timeZone: params.timezone },
      end: { dateTime: params.endTimeIso, timeZone: params.timezone },
      description: `Booked via Isolynic for customer ${customer.name ?? params.customerId}.`,
    },
  });

  if (!event.data.id) throw new Error("Calendar did not return an event id.");
  return { eventId: event.data.id };
}
```

---

## 32. `functions/src/conversation/audit.ts`

```typescript
// functions/src/conversation/audit.ts

import { getFirestore, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

interface AuditEntry {
  type: string;
  conversationId: string;
  uid: string;
  metadata?: Record<string, unknown>;
}

/**
 * Server-side security event log (spec §122) — records significant
 * actions without exposing internal audit mechanics to the owner UI.
 */
export async function logSecurityEvent(entry: AuditEntry) {
  await db.collection("securityEvents").add({
    ...entry,
    at: Timestamp.now(),
  });
}
```

---

## 33. `functions/src/conversation/triggers.ts`

```typescript
// functions/src/conversation/triggers.ts

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { regenerateConversationSummary } from "./ai";
import { evaluateOpportunityStatus } from "./opportunityEngine";
import { sendOwnerNotification } from "./notifications";

const db = getFirestore();

/**
 * Fires on every new timeline item (message or system event). Owns:
 *  - rolling summary regeneration (customer messages only, to bound cost)
 *  - opportunity status re-evaluation ("needs attention" / "waiting" / etc.)
 *  - meaningful-state-only notifications (spec §54)
 */
export const onTimelineItemCreated = onDocumentCreated(
  "conversations/{conversationId}/timeline/{itemId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const item = snap.data();
    const conversationId = event.params.conversationId as string;

    const convoRef = db.collection("conversations").doc(conversationId);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists) return;
    const conversation = convoSnap.data()!;

    // Update last-activity timestamps.
    if (item._collectionType === "message") {
      const now = Timestamp.now();
      const activityField =
        item.senderType === "CUSTOMER"
          ? "lastCustomerActivity"
          : item.senderType === "OWNER"
          ? "lastOwnerActivity"
          : item.senderType === "ISOLYNIC"
          ? "lastIsolynicActivity"
          : null;

      const updates: Record<string, unknown> = { updatedAt: now };
      if (activityField) updates[activityField] = now;

      if (item.senderType === "CUSTOMER") {
        updates.ownershipMode = conversation.ownershipMode === "OWNER" ? "OWNER" : "WAITING";
      }

      await convoRef.update(updates);
    }

    if (item._collectionType === "message" && item.senderType === "CUSTOMER") {
      await regenerateConversationSummary(conversationId, conversation.businessId);
    }

    const evaluation = await evaluateOpportunityStatus(conversationId);
    if (evaluation.statusChanged) {
      await convoRef.update({
        status: evaluation.status,
        whyHere: evaluation.whyHere,
        recommendedAction: evaluation.recommendedAction,
        updatedAt: Timestamp.now(),
      });

      await convoRef.collection("timeline").add({
        _collectionType: "system_event",
        conversationId,
        type: "status_changed",
        label: evaluation.timelineLabel,
        timestamp: Timestamp.now(),
      });

      if (evaluation.shouldNotifyOwner) {
        await sendOwnerNotification({
          businessId: conversation.businessId,
          conversationId,
          title: evaluation.notificationTitle,
          body: evaluation.notificationBody,
        });
      }
    }
  }
);