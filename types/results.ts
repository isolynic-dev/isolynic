
// types/results.ts

export type ResultOutcome =
  | 'ACTIVE'
  | 'AT_RISK'
  | 'RECOVERED'
  | 'BOOKED'
  | 'LOST'
  | 'DECLINED'
  | 'OWNER_HANDLED';

export type AttributionStatus =
  | 'ATTRIBUTED'
  | 'PROBABLE'
  | 'UNCONFIRMED'
  | 'NOT_ATTRIBUTED';

export type SourceChannel = 'sms' | 'call' | 'email' | 'chat' | 'web_form' | 'other';

export interface OpportunityResult {
  opportunity_id: string;
  business_id: string;
  customer_id: string;
  customer_name: string; // display name only, no PII beyond first name/initial per privacy rules
  detected_at: number; // epoch ms
  risk_started_at: number | null;
  recovery_action_at: number | null;
  reengaged_at: number | null;
  booking_at: number | null;
  outcome: ResultOutcome;
  estimated_value: number | null;
  attribution_status: AttributionStatus;
  source_channel: SourceChannel;
  manual_override?: 'RECOVERED' | 'NOT_RECOVERED' | null;
  summary_stage_label?: string; // e.g. "Missed call"
  summary_intervention_label?: string; // e.g. "followed up"
  summary_outcome_label?: string; // e.g. "booked appointment"
  updated_at: number;
}

export type ResultsPeriod = 7 | 30 | 90;

export interface ResultsHeadline {
  business_id: string;
  period_days: ResultsPeriod;
  period_start: number;
  period_end: number;
  opportunities_recovered: number;
  customers_reactivated: number;
  bookings_recovered: number;
  opportunities_still_at_risk: number;
  opportunities_lost: number;
  estimated_revenue_recovered: number | null;
  estimated_revenue_basis: 'CUSTOMER_PROVIDED' | 'VERIFIED' | 'MIXED' | 'NONE';
  previous_period_opportunities_recovered: number | null;
  previous_period_has_enough_data: boolean;
  computed_at: number;
  data_freshness_note?: string;
  is_partial: boolean;
}

export interface RecoveryTrendPoint {
  label: string; // "W1", "W2" or date label
  recovered_count: number;
  period_start: number;
  period_end: number;
}

export interface RecoveryEvidenceItem {
  opportunity_id: string;
  customer_first_name: string;
  stage_label: string;
  intervention_label: string;
  outcome_label: string;
  occurred_at: number;
}

export interface ResultsBundle {
  headline: ResultsHeadline;
  trend: RecoveryTrendPoint[];
  evidence: RecoveryEvidenceItem[];
}

export interface BusinessSettings {
  business_id: string;
  typical_customer_value: number | null;
  typical_booking_value: number | null;
  currency: string; // ISO 4217, e.g. "USD", "GHS", "EUR"
  locale: string; // e.g. "en-US", "en-GH"
  plan: string;
  plan_opportunity_limit?: number | null;
}