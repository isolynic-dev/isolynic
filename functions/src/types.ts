// functions/src/types.ts

export type RiskState =
  | 'NEW_RISK'
  | 'RECOVERY_RECOMMENDED'
  | 'OWNER_APPROVED'
  | 'RECOVERY_SENT'
  | 'WAITING'
  | 'CUSTOMER_RESPONDED'
  | 'PROGRESSING'
  | 'BOOKED'
  | 'WON'
  | 'LOST'
  | 'HANDLED';

export type ChannelType = 'phone' | 'whatsapp' | 'website' | 'sms' | 'email';

export type OwnerActionType = 'recover' | 'handle_myself' | 'ignore' | 'not_a_customer' | null;

export interface EvidenceItem {
  id: string;
  event_type: string;
  timestamp: number;
  channel: ChannelType;
  summary: string;
  relevance: number;
}

export interface PresenceInfo {
  handled_by_uid: string;
  handled_by_name: string;
  handled_at: number;
}

export interface OpportunityDoc {
  businessId: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string | null;
  source_channels: ChannelType[];

  first_contact_at: number;
  latest_activity_at: number;

  intent_summary: string;
  why_now: string;
  recommendation: string;

  priority: 'high' | 'worth_checking' | 'low';
  priority_score: number;

  value_estimate?: number | null;

  risk_state: RiskState;
  status: 'active' | 'waiting' | 'responded' | 'resolved' | 'lost' | 'handled';

  needs_owner: boolean;
  blocked_reason?: string | null;

  owner_action: OwnerActionType;
  last_recovery_action_id?: string | null;
  follow_up_count: number;
  max_follow_ups: number;
  next_review_at?: number | null;

  cooldown_until?: number | null;
  customer_opted_out?: boolean;
  customer_rejected_at?: number | null;

  evidence: EvidenceItem[];

  outcome?: { type: 'booked' | 'won' | 'lost' | 'handled' | null; note?: string; at?: number } | null;

  presence?: PresenceInfo | null;

  recovery_preview?: { message: string; requires_confirmation: boolean } | null;

  // Snapshot of state before the most recent dismissive action, used for Undo (sec 62)
  pre_dismiss_snapshot?: Partial<OpportunityDoc> | null;

  createdAt: number;
  updatedAt: number;
}

export interface RecoveryActionRecord {
  idempotencyKey: string;
  action: string;
  opportunityId: string;
  businessId: string;
  uid: string;
  status: 'succeeded' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: number;
}

export interface CallablePayload {
  businessId: string;
  opportunityId: string;
  idempotencyKey: string;
}