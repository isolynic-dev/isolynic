
// types/conversation.ts

import { Timestamp } from "firebase/firestore";

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

export type DeliveryStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type MessageAttachment = {
  id: string;
  type: "image" | "audio" | "document";
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  sizeBytes?: number;
  durationSeconds?: number; // for audio
  transcript?: string; // for voice messages
  aiCaption?: string; // for images, hedged language only
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderType: SenderType;
  channel: Channel;
  body: string;
  attachments: MessageAttachment[];
  timestamp: Timestamp;
  deliveryStatus?: DeliveryStatus;
  providerReference?: string;
  isAutomaticFollowUp?: boolean; // labels "Automatic follow-up" on Isolynic messages
  isPrivateNote?: boolean;
};

export type SystemEventType =
  | "missed_call"
  | "call_completed"
  | "quote_sent"
  | "quote_requested"
  | "booking_created"
  | "booking_updated"
  | "owner_takeover"
  | "owner_released"
  | "recovery_started"
  | "recovery_completed"
  | "status_changed"
  | "conversation_closed"
  | "not_opportunity";

export type SystemEvent = {
  id: string;
  conversationId: string;
  type: SystemEventType;
  label: string; // human-friendly, already composed server-side
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
};

export type TimelineItem =
  | { kind: "message"; data: ConversationMessage }
  | { kind: "system_event"; data: SystemEvent };

export type RecommendedAction = {
  action: "recover" | "take_over" | "no_action" | "book";
  reason: string;
};

export type BookingDetails = {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  timezone: string;
  status: "confirmed" | "cancelled" | "completed";
  calendarEventId?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  preferredChannel: Channel;
  identityConfidence?: "confirmed" | "possible_match";
  possibleDuplicateCustomerId?: string;
};

export type Conversation = {
  id: string;
  businessId: string;
  customerId: string;
  opportunityId: string;
  channel: Channel;
  status: OpportunityStatus;
  ownershipMode: OwnershipMode;
  summary: string; // rolling AI-maintained summary
  whyHere: string | null; // recovery / attention explanation
  recommendedAction: RecommendedAction | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastCustomerActivity: Timestamp | null;
  lastOwnerActivity: Timestamp | null;
  lastIsolynicActivity: Timestamp | null;
  currentBooking: BookingDetails | null;
  isClosed: boolean;
  closedReason?: string;
};

export type PrivateNote = {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: Timestamp;
};