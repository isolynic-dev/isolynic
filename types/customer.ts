
// types/customer.ts
// Shared domain types for Screen 6 — Customer.
// Mirrors the conceptual data model in the spec (§60) without exposing
// internal fields to the UI layer.

import type { Timestamp } from "firebase/firestore";
import type { OpportunityDoc } from "./recovery";

/** High-level, human-readable customer state (spec §16). Never expose the
 * underlying scoring model that produces this — only this enum. */
export type CustomerCurrentState =
  | "active"
  | "needs_attention"
  | "waiting"
  | "booked"
  | "recovered"
  | "completed"
  | "lost"
  | "none";

export type RecoveryState = "idle" | "in_progress" | "succeeded" | "stopped";

export type PreferredChannel = "whatsapp" | "phone" | "web" | "unknown";

export type IdentityConfidence = "confirmed" | "likely" | "uncertain";

export interface CustomerChannels {
  phone?: string;
  whatsapp?: string;
}

export interface CustomerPreferences {
  communicationTime?: "morning" | "afternoon" | "evening" | "unspecified";
  language?: string;
}

/** Root customer document: customers/{customerId} */
export interface CustomerDoc {
  id: string;
  businessId: string;
  displayName: string | null;
  phone: string | null;
  photoUrl: string | null;
  channels: CustomerChannels;
  preferredChannel: PreferredChannel;
  preferences: CustomerPreferences;
  currentState: CustomerCurrentState;
  identityConfidence: IdentityConfidence;
  possibleDuplicateOf: string | null; // customerId, when a merge candidate exists
  activeOpportunityIds: string[];
  appointmentIds: string[];
  conversationIds: string[];
  isCustomer: boolean; // false after "Mark as not a customer"
  autoRecoveryBlocked: boolean; // "Don't contact automatically"
  deletedAt: Timestamp | null;
  lastContactedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TimelineEventType =
  | "customer_contacted"
  | "owner_contacted"
  | "isolynic_contacted"
  | "quote_discussed"
  | "appointment_created"
  | "appointment_changed"
  | "appointment_completed"
  | "recovery_started"
  | "recovery_succeeded"
  | "opportunity_lost"
  | "owner_took_over";

export type TimelineActor = "you" | "customer" | "isolynic" | "system";

/** customers/{customerId}/timeline/{eventId} — natural-language only (spec §23) */
export interface TimelineEventDoc {
  id: string;
  type: TimelineEventType;
  actor: TimelineActor;
  headline: string; // "Missed call"
  detail: string | null; // "Sarah called but nobody answered."
  occurredAt: Timestamp;
  relatedOpportunityId: string | null;
}

export type ConversationChannel = "whatsapp" | "phone" | "web" | "isolynic";

/** conversations/{conversationId} */
export interface ConversationDoc {
  id: string;
  customerId: string;
  channel: ConversationChannel;
  lastMessagePreview: string | null;
  lastMessageAt: Timestamp | null;
}

export type MessageAuthor = "you" | "customer" | "isolynic" | "system";

/** conversations/{conversationId}/messages/{messageId} — preview only, most
 * recent few (spec §19–20). Full thread lives on Screen 5. */
export interface MessagePreviewDoc {
  id: string;
  author: MessageAuthor;
  text: string;
  sentAt: Timestamp;
}

export type AppointmentStatus = "confirmed" | "pending" | "cancelled" | "completed";

/** appointments/{appointmentId} */
export interface AppointmentDoc {
  id: string;
  customerId: string;
  opportunityId: string | null;
  title: string; // "Repair visit"
  startsAt: Timestamp;
  status: AppointmentStatus;
}

/** customers/{customerId}/notes/{noteId} — plain text only (spec §27–28) */
export interface CustomerNoteDoc {
  id: string;
  text: string;
  createdBy: "owner";
  createdAt: Timestamp;
}

/** customers/{customerId}/smartSuggestions/{suggestionId} — unconfirmed
 * machine-detected notes/preferences (spec §29) */
export interface SmartSuggestionDoc {
  id: string;
  kind: "note" | "preferred_channel" | "preferred_time";
  summary: string; // "Customer usually asks for afternoon appointments."
  proposedValue: string;
  createdAt: Timestamp;
  status: "pending" | "saved" | "ignored";
}

/** Aggregated shape the screen actually consumes — assembled client-side
 * from the above collections (mirrors spec §83's conceptual API shape,
 * but built from real-time listeners rather than one REST call). */
export interface CustomerScreenData {
  customer: CustomerDoc;
  activeOpportunities: OpportunityDoc[];
  recentConversation: {
    conversation: ConversationDoc | null;
    messages: MessagePreviewDoc[];
  };
  timeline: TimelineEventDoc[];
  timelineHasMore: boolean;
  appointments: AppointmentDoc[];
  notes: CustomerNoteDoc[];
  pendingSuggestions: SmartSuggestionDoc[];
}