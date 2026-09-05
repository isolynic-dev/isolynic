
// types/recoveryqueue.ts

export type OpportunityLifecycleStatus =
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
  | 'HANDLED'
  | 'IGNORED'
  | 'NOT_A_CUSTOMER';

export type PriorityBand = 'high' | 'worth_checking' | 'low';
export type DecisionBand = 'autonomous' | 'assisted' | 'human_required';
export type ChannelType = 'phone' | 'whatsapp' | 'website' | 'sms' | 'email' | 'other';

export interface EvidenceItem {
  id: string;
  eventType: string;
  timestamp: number; // epoch ms
  channel: ChannelType;
  summary: string;
  relevance: 'primary' | 'supporting';
}

export interface LastRecoveryAction {
  type: 'follow_up' | 'reconnect' | 'reminder' | 'custom';
  at: number;
  channel: ChannelType;
  messagePreview?: string;
}

export interface OpportunityDoc {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  sourceChannels: ChannelType[];
  firstContactAt: number;
  latestActivityAt: number;

  intentSummary: string;   // "Asked for a repair appointment yesterday."
  whyNow: string;          // "You sent a quote 3 days ago and haven't heard back."
  recommendation: string;  // "A short follow-up could bring this customer back."

  valueEstimate?: number | null;
  riskState: 'stable' | 'deteriorating' | 'critical';

  status: OpportunityLifecycleStatus;
  priorityBand: PriorityBand;
  priorityScore: number;
  decisionBand: DecisionBand;

  ownerAction?: 'recover' | 'handle_myself' | 'ignore' | 'not_a_customer' | null;
  lastRecoveryAction?: LastRecoveryAction | null;

  followUpCount: number;
  maxFollowUps: number;
  cooldownUntil?: number | null;
  explicitlyRejected?: boolean;

  needsOwnerReason?: string | null; // populated when decisionBand === 'human_required'

  handledByUid?: string | null;
  handledByName?: string | null;

  nextReviewAt?: number | null;
  evidence: EvidenceItem[];
  outcome?: 'booked' | 'won' | 'lost' | null;
  outcomeNote?: string | null;

  undoExpiresAt?: number | null;
  priorSnapshot?: Partial<OpportunityDoc> | null;

  createdAt: number;
  updatedAt: number;
  version: number; // monotonic, used for optimistic concurrency / CAS
}

export const ACTIVE_QUEUE_STATUSES: OpportunityLifecycleStatus[] = [
  'NEW_RISK',
  'RECOVERY_RECOMMENDED',
  'OWNER_APPROVED',
  'RECOVERY_SENT',
  'WAITING',
  'CUSTOMER_RESPONDED',
  'PROGRESSING',
];

export const RECENTLY_RESOLVED_STATUSES: OpportunityLifecycleStatus[] = [
  'BOOKED',
  'WON',
  'HANDLED',
];

export function statusToHumanLabel(o: Pick<OpportunityDoc, 'status' | 'lastRecoveryAction'>): string {
  switch (o.status) {
    case 'NEW_RISK':
    case 'RECOVERY_RECOMMENDED':
      return 'Needs attention';
    case 'OWNER_APPROVED':
    case 'RECOVERY_SENT':
    case 'WAITING':
      return 'Following up';
    case 'CUSTOMER_RESPONDED':
    case 'PROGRESSING':
      return 'Customer replied';
    case 'BOOKED':
    case 'WON':
      return 'Booked';
    case 'HANDLED':
      return 'Done';
    case 'LOST':
      return 'Opportunity lost';
    case 'IGNORED':
      return 'Ignored';
    case 'NOT_A_CUSTOMER':
      return 'Not a customer';
    default:
      return 'Needs attention';
  }
}