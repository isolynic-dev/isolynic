
// types/opportunity.ts

export type OpportunityStatus =
  | 'active'
  | 'needs_attention'
  | 'recovering'
  | 'owner_needed'
  | 'recovered'
  | 'booked'
  | 'won'
  | 'lost'
  | 'not_opportunity';

export type RiskLevel = 'low' | 'moderate' | 'high';

export type Channel = 'phone' | 'whatsapp' | 'website' | 'email';

export type IntentType =
  | 'repair_request'
  | 'booking_request'
  | 'quote_request'
  | 'general_inquiry'
  | 'missed_call'
  | 'booking_abandonment'
  | 'unknown';

export type ConfidenceLevel = 'high' | 'moderate' | 'low';

export type ActorType = 'customer' | 'owner' | 'isolynic';

export type EventType =
  | 'call'
  | 'message'
  | 'quote_sent'
  | 'booking_started'
  | 'booking_confirmed'
  | 'recovery_sent'
  | 'note_added'
  | 'status_change';

export interface TimelineEvent {
  id: string;
  type: EventType;
  actor: ActorType;
  channel: Channel;
  timestamp: number; // epoch ms
  label: string; // e.g. "Missed call", "Quote sent"
  content?: string; // message body, if applicable
  metadata?: Record<string, unknown>;
}

export interface OpportunitySummaryFields {
  customerNeed: string; // "Washing-machine repair"
  nextStep: string; // "Schedule an appointment"
  blocker: string; // "No response to quote"
}

export interface RecommendedAction {
  actionType: 'follow_up' | 'ask_clarifying' | 'escalate' | 'none';
  reasonText: string; // human-readable, e.g. "Sarah has shown clear interest..."
  suggestedMessage?: string;
  confidence: ConfidenceLevel;
}

export interface BookingInfo {
  state: 'none' | 'requested' | 'booked';
  scheduledAt?: number;
  bookingId?: string;
}

export interface RecoveryAttempt {
  id: string;
  sentAt: number;
  channel: Channel;
  message: string;
  responded: boolean;
  respondedAt?: number;
}

export interface AuditRecord {
  id: string;
  timestamp: number;
  actor: ActorType;
  action: string;
  channel?: Channel;
  message?: string;
  result: 'success' | 'failure' | 'pending';
}

export interface Opportunity {
  opportunityId: string;
  customerId: string;
  businessId: string;
  createdAt: number;
  lastActivityAt: number;
  updatedAt: number;

  channel: Channel;
  channels: Channel[]; // for multi-channel display, e.g. ["whatsapp", "phone"]
  intentType: IntentType;
  intentSummary: string; // "Washing-machine repair"

  valueEstimate?: number; // only set if grounded in real data
  valueBasis?: 'owner_average' | 'explicit' | 'none';

  status: OpportunityStatus;
  riskLevel: RiskLevel;
  riskReason: string; // human-readable
  confidence: ConfidenceLevel;

  customerState?: string;
  businessState?: string;

  attentionHeadline: string; // "Needs attention"
  attentionSubtext: string; // "This customer may be slipping away."
  whyExplanation: string; // longer explanation paragraph
  evidence: {
    customerAskedFor?: string;
    lastCustomerMessage?: string;
    lastBusinessResponse?: string;
    timeSinceLastResponseMs?: number;
  };

  summary: OpportunitySummaryFields;
  recommendedAction: RecommendedAction;

  followUpCount: number;
  followUpLimit: number; // policy threshold, e.g. 2
  recoveryAttempts: RecoveryAttempt[];

  lastIsolynicAction?: string;
  lastOwnerAction?: string;

  bookingState: BookingInfo;
  resolutionState?: 'won' | 'lost';
  resolutionReason?: string;
  resolutionValue?: number;

  ownerHandling: boolean; // true if owner has taken over
  ownerNote?: string;

  customer: {
    id: string;
    name: string;
    avatarUrl?: string;
    phone?: string;
  };

  contextInsufficient?: boolean; // true = "we don't know enough yet"
  aiUncertain?: boolean; // true = "we need your help"

  dedupeGroupId?: string; // links merged multi-channel opportunities
}

// ---- API contracts ----

export interface RecoverResponse {
  status: 'success' | 'failure';
  messageId?: string;
  opportunityStatus: OpportunityStatus;
  nextCheckAt?: number;
  customerChannel: Channel;
  error?: string;
}

export interface TakeoverResponse {
  status: 'success' | 'failure';
  opportunityStatus: OpportunityStatus;
}

export interface DismissResponse {
  status: 'success' | 'failure';
  opportunityStatus: OpportunityStatus;
  undoToken?: string;
}

export interface ResolveResponse {
  status: 'success' | 'failure';
  opportunityStatus: OpportunityStatus;
}