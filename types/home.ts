
// src/types/home.ts

export type HomeStatus =
  | "new"               // State 1 — first-time / no history
  | "healthy"           // State 2 — monitoring, nothing to do
  | "attention"         // State 3 — active recovery, opportunities exist
  | "needs_human"       // State 4 — human intervention required
  | "mixed"             // State 5 — attention + needs_human simultaneously
  | "partial_coverage"  // State 6 — one or more channels not connected
  | "degraded"          // State 7 — temporary service problem
  | "account_issue";    // State 8 — billing / subscription problem

export type ChannelId = "whatsapp" | "phone" | "sms" | "email" | "instagram";

export interface ChannelCoverage {
  channel: ChannelId;
  label: string;
  connected: boolean;
}

export interface AttentionOpportunity {
  id: string;
  customerDisplayName: string; // e.g. "Sarah" or "Sarah M." — never full PII
  reason: string;              // human-readable, evidence-based, e.g. "Quote sent 3 days ago · No reply"
  canAutoRecover: boolean;
}

export interface NeedsHumanOpportunity {
  id: string;
  customerDisplayName: string;
  reason: string; // e.g. "Wants to confirm a price Isolynic doesn't know."
}

export interface ActivityItem {
  id: string;
  timestamp: number; // epoch ms
  label: string;      // e.g. "Sarah replied to Isolynic"
  opportunityId?: string;
  navigateTo?: "conversation" | "opportunity" | "booking";
}

export interface RevenueEstimate {
  amount: number;
  isEstimate: boolean; // if true, UI must prefix with "Estimated"
  hasData: boolean;    // if false, do not render any dollar figure
}

export interface NextBooking {
  customerDisplayName: string;
  timeLabel: string; // e.g. "Today, 2:00 PM"
  opportunityId?: string;
}

export interface WeeklySummary {
  recoveredCount: number;
  bookedCount: number;
  stillActiveCount: number;
  lostCount: number;
  revenue: RevenueEstimate;
}

export interface AccountStatus {
  state: "active" | "paused" | "past_due";
  message?: string;
}

export interface HomeSummary {
  status: HomeStatus;

  // Attention
  attentionCount: number;
  recoverableAutomatically: number;
  attentionOpportunities: AttentionOpportunity[];

  // Needs human
  needsHumanCount: number;
  needsHumanOpportunities: NeedsHumanOpportunity[];

  // Recovery / results
  recoveredThisWeek: number;
  bookedThisWeek: number;
  activeRecoveries: number;
  repliedThisWeek: number;
  stillDecidingThisWeek: number;

  // Bookings
  nextBooking: NextBooking | null;
  bookingsThisWeekCount: number;

  // Activity
  recentActivity: ActivityItem[];

  // Weekly performance
  weeklySummary: WeeklySummary;

  // Coverage & account
  coverage: ChannelCoverage[];
  degradedChannels: { channel: ChannelId; label: string }[];
  account: AccountStatus;

  // Meta
  updatedAt: number; // epoch ms — for staleness / offline labeling
}

export interface HomeSummaryDoc extends HomeSummary {
  ownerId: string;
}