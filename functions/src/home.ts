// functions/src/home.ts
//
// ISOLYNIC — SCREEN 2: HOME — CLOUD FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────
// This file implements the entire server-side business-intelligence layer
// for the Home screen, per the Screen 2 blueprint:
//
//   §11  Attention Card must be curated (evidence, context, plausibility,
//        recovery probability, low annoyance risk)
//   §12  Priority ordering = value × likelihood × urgency (never shown raw)
//   §13  Every surfaced opportunity has a human-readable reason
//   §17  "Needs You" — explains WHY human attention is required
//   §21  Partial channel coverage must be reported honestly
//   §22  Temporary service degradation — human language, no infra errors
//   §29–30 Weekly summary + revenue display rules (never fabricate $)
//   §44  All eight Home engineering states must be supported
//   §45  Account/subscription state — quiet, non-destructive messaging
//   §48–49 Compact HomeSummary object; frontend NEVER computes intelligence
//   §51  Event-driven refresh — Firestore listeners, not polling
//   §57  Analytics events (home_error etc. — client-side; server just logs)
//
// Firestore collections this file reads from (written by upstream systems):
//
//   opportunities/{opportunityId}
//     ownerId: string
//     customerDisplayName: string
//     channel: ChannelId
//     status: 'open' | 'at_risk' | 'recovering' | 'recovered' | 'lost'
//     reason: string                     // human-readable evidence (§13)
//     createdAt: Timestamp
//     updatedAt: Timestamp
//     resolvedAt?: Timestamp
//     estimatedValue?: number
//     hasEstimatedValueData: boolean     // §30 — only show $ if this is true
//     isEstimate: boolean                // §30 — label "Estimated $X" vs "$X"
//     intentScore: number        (0–1)   // evidence of commercial intent
//     contextScore: number       (0–1)   // enough context to justify action
//     deteriorationPlausibility: number (0–1)
//     recoveryProbability: number (0–1)
//     annoyanceRisk: number      (0–1)   // lower is safer to surface
//     urgencyScore: number       (0–1)
//     canAutoRecover: boolean
//     requiresHuman: boolean
//     humanReason?: string               // why AI can't handle it (§17)
//     outcomeCategory?: 'booked' | 'replied' | 'still_deciding' | 'lost'
//     bookingId?: string
//
//   bookings/{bookingId}
//     ownerId, opportunityId, customerDisplayName, startTime: Timestamp,
//     createdAt: Timestamp, status: 'scheduled' | 'completed' | 'cancelled'
//
//   activityEvents/{eventId}
//     ownerId, type, label: string, timestamp: Timestamp,
//     opportunityId?, navigateTo?: 'conversation' | 'opportunity' | 'booking'
//
//   channelConnections/{ownerId}
//     connectedChannels: ChannelId[]
//
//   channelHealth/{channelId}
//     status: 'operational' | 'degraded', label: string, updatedAt: Timestamp
//
//   accounts/{ownerId}
//     billingStatus: 'active' | 'paused' | 'past_due'
//     createdAt: Timestamp
//     hasProcessedFirstOpportunity: boolean
//
// Writes to:
//   homeSummaries/{ownerId}   ← the ONLY document the Home screen listens to
//
// ─────────────────────────────────────────────────────────────────────────

import { setGlobalOptions } from "firebase-functions/v2";
import {
  onDocumentWritten,
  onDocumentCreated,
  type FirestoreEvent,
  type Change,
  type QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

setGlobalOptions({ region: "us-central1", maxInstances: 20 });

// ───────────────────────────────────────────────────────────────────────
// TYPES — mirrors src/types/home.ts on the frontend exactly.
// ───────────────────────────────────────────────────────────────────────

type ChannelId = "whatsapp" | "phone" | "sms" | "email" | "instagram";

type HomeStatus =
  | "new"
  | "healthy"
  | "attention"
  | "needs_human"
  | "mixed"
  | "partial_coverage"
  | "degraded"
  | "account_issue";

type OpportunityStatus =
  | "open"
  | "at_risk"
  | "recovering"
  | "recovered"
  | "lost";

type OutcomeCategory = "booked" | "replied" | "still_deciding" | "lost";

interface OpportunityDoc {
  ownerId: string;
  customerDisplayName: string;
  channel: ChannelId;
  status: OpportunityStatus;
  reason: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  resolvedAt?: FirebaseFirestore.Timestamp;
  estimatedValue?: number;
  hasEstimatedValueData?: boolean;
  isEstimate?: boolean;
  intentScore?: number;
  contextScore?: number;
  deteriorationPlausibility?: number;
  recoveryProbability?: number;
  annoyanceRisk?: number;
  urgencyScore?: number;
  canAutoRecover?: boolean;
  requiresHuman?: boolean;
  humanReason?: string;
  outcomeCategory?: OutcomeCategory;
  bookingId?: string;
}

interface BookingDoc {
  ownerId: string;
  opportunityId?: string;
  customerDisplayName: string;
  startTime: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  status: "scheduled" | "completed" | "cancelled";
}

interface ActivityEventDoc {
  ownerId: string;
  type: string;
  label: string;
  timestamp: FirebaseFirestore.Timestamp;
  opportunityId?: string;
  navigateTo?: "conversation" | "opportunity" | "booking";
}

interface ChannelConnectionsDoc {
  connectedChannels: ChannelId[];
}

interface ChannelHealthDoc {
  status: "operational" | "degraded";
  label: string;
  updatedAt: FirebaseFirestore.Timestamp;
}

interface AccountDoc {
  billingStatus: "active" | "paused" | "past_due";
  createdAt: FirebaseFirestore.Timestamp;
  hasProcessedFirstOpportunity: boolean;
}

// Output shape written to homeSummaries/{ownerId}
interface HomeSummary {
  ownerId: string;
  status: HomeStatus;

  attentionCount: number;
  recoverableAutomatically: number;
  attentionOpportunities: {
    id: string;
    customerDisplayName: string;
    reason: string;
    canAutoRecover: boolean;
  }[];

  needsHumanCount: number;
  needsHumanOpportunities: {
    id: string;
    customerDisplayName: string;
    reason: string;
  }[];

  recoveredThisWeek: number;
  bookedThisWeek: number;
  activeRecoveries: number;
  repliedThisWeek: number;
  stillDecidingThisWeek: number;

  nextBooking: {
    customerDisplayName: string;
    timeLabel: string;
    opportunityId?: string;
  } | null;
  bookingsThisWeekCount: number;

  recentActivity: {
    id: string;
    timestamp: number;
    label: string;
    opportunityId?: string;
    navigateTo?: "conversation" | "opportunity" | "booking";
  }[];

  weeklySummary: {
    recoveredCount: number;
    bookedCount: number;
    stillActiveCount: number;
    lostCount: number;
    revenue: { amount: number; isEstimate: boolean; hasData: boolean };
  };

  coverage: { channel: ChannelId; label: string; connected: boolean }[];
  degradedChannels: { channel: ChannelId; label: string }[];
  account: { state: "active" | "paused" | "past_due"; message?: string };

  updatedAt: number;
}

// ───────────────────────────────────────────────────────────────────────
// CONFIG / THRESHOLDS
// ───────────────────────────────────────────────────────────────────────

const ALL_CHANNELS: ChannelId[] = [
  "whatsapp",
  "phone",
  "sms",
  "email",
  "instagram",
];

const CHANNEL_LABELS: Record<ChannelId, string> = {
  whatsapp: "WhatsApp",
  phone: "Phone",
  sms: "SMS",
  email: "Email",
  instagram: "Instagram",
};

// §11 — Curation thresholds. An opportunity must clear ALL of these to be
// surfaced on Home. These numbers are the "internal threshold for
// meaningful attention" the spec refers to — tune them empirically against
// the "false-alert rate" metric in §57.
const ATTENTION_THRESHOLDS = {
  minIntentScore: 0.5, // evidence of commercial intent
  minContextScore: 0.5, // enough context to justify intervention
  minDeteriorationPlausibility: 0.4, // plausible reason for deterioration
  minRecoveryProbability: 0.3, // meaningful probability of recovery
  maxAnnoyanceRisk: 0.65, // sufficiently low risk of annoying the customer
};

const MAX_ATTENTION_CARDS = 6;
const MAX_NEEDS_HUMAN_CARDS = 8;
const MAX_RECENT_ACTIVITY = 12;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

// Activity event types considered "meaningful" per §25 — everything else
// (webhook received, message sent, AI generated response) is suppressed.
const MEANINGFUL_ACTIVITY_TYPES = new Set([
  "replied",
  "recovered",
  "booked",
  "missed_call_recovered",
  "quote_accepted",
  "customer_confirmed",
]);

// ───────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ───────────────────────────────────────────────────────────────────────

function daysAgoTimestamp(days: number): FirebaseFirestore.Timestamp {
  return Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
}

function formatBookingTimeLabel(start: FirebaseFirestore.Timestamp): string {
  const date = start.toDate();
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  if (isToday) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  return `${dayLabel}, ${time}`;
}

/**
 * §11 — Curation gate. An opportunity clears the bar only if it has
 * evidence of commercial intent, enough context, a plausible reason for
 * deterioration, meaningful recovery probability, and low annoyance risk.
 * Missing scores fail closed (never surfaced) rather than fail open —
 * false positives erode trust (§57 "false-alert rate") far more than a
 * missed one costs, since the underlying pipeline will re-evaluate on the
 * next event anyway.
 */
function clearsAttentionThreshold(opp: OpportunityDoc): boolean {
  const {
    intentScore,
    contextScore,
    deteriorationPlausibility,
    recoveryProbability,
    annoyanceRisk,
  } = opp;

  if (
    intentScore === undefined ||
    contextScore === undefined ||
    deteriorationPlausibility === undefined ||
    recoveryProbability === undefined ||
    annoyanceRisk === undefined
  ) {
    return false;
  }

  return (
    intentScore >= ATTENTION_THRESHOLDS.minIntentScore &&
    contextScore >= ATTENTION_THRESHOLDS.minContextScore &&
    deteriorationPlausibility >=
      ATTENTION_THRESHOLDS.minDeteriorationPlausibility &&
    recoveryProbability >= ATTENTION_THRESHOLDS.minRecoveryProbability &&
    annoyanceRisk <= ATTENTION_THRESHOLDS.maxAnnoyanceRisk
  );
}

/**
 * §12 — Priority ordering = value × likelihood × urgency. This score is
 * used ONLY for server-side sort order; it is never exposed to the client
 * as a raw number ("the user should see natural-language reasons").
 */
function priorityScore(opp: OpportunityDoc): number {
  const normalizedValue = opp.hasEstimatedValueData
    ? Math.min((opp.estimatedValue ?? 0) / 1000, 3) // soft-cap influence of huge outliers
    : 0.5; // neutral weight when no value data exists — don't penalize or inflate
  const likelihood = opp.recoveryProbability ?? 0;
  const urgency = opp.urgencyScore ?? 0;
  return normalizedValue * likelihood * urgency;
}

// ───────────────────────────────────────────────────────────────────────
// DATA FETCHERS — each isolated so triggers can be added/removed cleanly.
// ───────────────────────────────────────────────────────────────────────

async function fetchActivePipelineOpportunities(
  ownerId: string
): Promise<{ id: string; data: OpportunityDoc }[]> {
  const snap = await db
    .collection("opportunities")
    .where("ownerId", "==", ownerId)
    .where("status", "in", ["open", "at_risk", "recovering"])
    .get();

  return snap.docs.map((d) => ({ id: d.id, data: d.data() as OpportunityDoc }));
}

async function fetchResolvedOpportunitiesThisWeek(
  ownerId: string
): Promise<{ id: string; data: OpportunityDoc }[]> {
  const weekAgo = daysAgoTimestamp(7);
  const snap = await db
    .collection("opportunities")
    .where("ownerId", "==", ownerId)
    .where("status", "in", ["recovered", "lost"])
    .where("resolvedAt", ">=", weekAgo)
    .get();

  return snap.docs.map((d) => ({ id: d.id, data: d.data() as OpportunityDoc }));
}

async function fetchHasEverHadOpportunity(ownerId: string): Promise<boolean> {
  const snap = await db
    .collection("opportunities")
    .where("ownerId", "==", ownerId)
    .limit(1)
    .get();
  return !snap.empty;
}

async function fetchBookingsThisWeek(
  ownerId: string
): Promise<{ id: string; data: BookingDoc }[]> {
  const weekAgo = daysAgoTimestamp(7);
  const snap = await db
    .collection("bookings")
    .where("ownerId", "==", ownerId)
    .where("createdAt", ">=", weekAgo)
    .where("status", "in", ["scheduled", "completed"])
    .get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as BookingDoc }));
}

async function fetchNextBooking(
  ownerId: string
): Promise<{ id: string; data: BookingDoc } | null> {
  const now = Timestamp.now();
  const snap = await db
    .collection("bookings")
    .where("ownerId", "==", ownerId)
    .where("status", "==", "scheduled")
    .where("startTime", ">=", now)
    .orderBy("startTime", "asc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() as BookingDoc };
}

async function fetchRecentActivity(
  ownerId: string
): Promise<{ id: string; data: ActivityEventDoc }[]> {
  // Over-fetch slightly and filter client-side (Firestore can't do an
  // efficient "type in MEANINGFUL_ACTIVITY_TYPES" alongside ordering
  // without a composite index per type set; a fixed `in` clause works
  // and stays index-friendly).
  const snap = await db
    .collection("activityEvents")
    .where("ownerId", "==", ownerId)
    .where("type", "in", Array.from(MEANINGFUL_ACTIVITY_TYPES))
    .orderBy("timestamp", "desc")
    .limit(MAX_RECENT_ACTIVITY)
    .get();

  return snap.docs.map((d) => ({ id: d.id, data: d.data() as ActivityEventDoc }));
}

async function fetchCoverage(
  ownerId: string
): Promise<{ connected: ChannelId[]; doc: ChannelConnectionsDoc | null }> {
  const docSnap = await db.collection("channelConnections").doc(ownerId).get();
  if (!docSnap.exists) return { connected: [], doc: null };
  const data = docSnap.data() as ChannelConnectionsDoc;
  return { connected: data.connectedChannels ?? [], doc: data };
}

async function fetchDegradedChannels(
  connectedChannels: ChannelId[]
): Promise<{ channel: ChannelId; label: string }[]> {
  if (connectedChannels.length === 0) return [];

  const snaps = await Promise.all(
    connectedChannels.map((channel) =>
      db.collection("channelHealth").doc(channel).get()
    )
  );

  const degraded: { channel: ChannelId; label: string }[] = [];
  snaps.forEach((snap, idx) => {
    if (!snap.exists) return;
    const data = snap.data() as ChannelHealthDoc;
    if (data.status === "degraded") {
      degraded.push({
        channel: connectedChannels[idx],
        label: data.label || CHANNEL_LABELS[connectedChannels[idx]],
      });
    }
  });
  return degraded;
}

async function fetchAccount(ownerId: string): Promise<AccountDoc | null> {
  const snap = await db.collection("accounts").doc(ownerId).get();
  if (!snap.exists) return null;
  return snap.data() as AccountDoc;
}

// ───────────────────────────────────────────────────────────────────────
// CURATION / SHAPING
// ───────────────────────────────────────────────────────────────────────

function curateAttention(
  opportunities: { id: string; data: OpportunityDoc }[]
): {
  attentionOpportunities: HomeSummary["attentionOpportunities"];
  recoverableAutomatically: number;
} {
  const eligible = opportunities.filter(
    (o) => !o.data.requiresHuman && clearsAttentionThreshold(o.data)
  );

  eligible.sort((a, b) => priorityScore(b.data) - priorityScore(a.data));

  const top = eligible.slice(0, MAX_ATTENTION_CARDS);

  return {
    attentionOpportunities: top.map((o) => ({
      id: o.id,
      customerDisplayName: o.data.customerDisplayName,
      reason: o.data.reason,
      canAutoRecover: !!o.data.canAutoRecover,
    })),
    recoverableAutomatically: eligible.filter((o) => o.data.canAutoRecover)
      .length,
  };
}

function curateNeedsHuman(
  opportunities: { id: string; data: OpportunityDoc }[]
): HomeSummary["needsHumanOpportunities"] {
  const flagged = opportunities.filter((o) => o.data.requiresHuman);

  // §17 — urgency-first: the human should see the most time-sensitive
  // item as the primary card.
  flagged.sort((a, b) => (b.data.urgencyScore ?? 0) - (a.data.urgencyScore ?? 0));

  return flagged.slice(0, MAX_NEEDS_HUMAN_CARDS).map((o) => ({
    id: o.id,
    customerDisplayName: o.data.customerDisplayName,
    reason:
      o.data.humanReason ||
      "Isolynic doesn't have enough information to handle this automatically.",
  }));
}

function buildWeeklySummary(
  resolved: { id: string; data: OpportunityDoc }[],
  bookingsThisWeek: { id: string; data: BookingDoc }[]
): HomeSummary["weeklySummary"] {
  const recovered = resolved.filter((o) => o.data.status === "recovered");
  const lost = resolved.filter((o) => o.data.status === "lost");

  // §30 Revenue Display Rules — never fabricate a number.
  const withValueData = recovered.filter((o) => o.data.hasEstimatedValueData);
  const hasData = withValueData.length > 0;
  const isEstimate = withValueData.some((o) => o.data.isEstimate);
  const amount = withValueData.reduce(
    (sum, o) => sum + (o.data.estimatedValue ?? 0),
    0
  );

  return {
    recoveredCount: recovered.length,
    bookedCount: bookingsThisWeek.length,
    stillActiveCount: 0, // filled in by caller (needs the active-pipeline count)
    lostCount: lost.length,
    revenue: { amount, isEstimate, hasData },
  };
}

/**
 * §44 — Home Screen States. Precedence order reflects §18 ("never punish
 * the user") and §57 (trustworthy relevance over completeness): a genuine
 * customer-facing issue (needs_human / attention) always outranks
 * account or coverage messaging as the HEADLINE, even though those other
 * banners still render independently (see frontend CoverageBanner /
 * AccountStatusBanner, which read their own fields regardless of `status`).
 */
function determineStatus(input: {
  attentionCount: number;
  needsHumanCount: number;
  accountState: "active" | "paused" | "past_due";
  degradedChannels: { channel: ChannelId; label: string }[];
  connectedChannels: ChannelId[];
  hasEverHadOpportunity: boolean;
}): HomeStatus {
  const {
    attentionCount,
    needsHumanCount,
    accountState,
    degradedChannels,
    connectedChannels,
    hasEverHadOpportunity,
  } = input;

  if (needsHumanCount > 0 && attentionCount > 0) return "mixed";
  if (needsHumanCount > 0) return "needs_human";
  if (attentionCount > 0) return "attention";
  if (accountState !== "active") return "account_issue";
  if (degradedChannels.length > 0) return "degraded";
  if (connectedChannels.length > 0 && connectedChannels.length < ALL_CHANNELS.length)
    return "partial_coverage";
  if (!hasEverHadOpportunity) return "new";
  return "healthy";
}

function mapAccountState(
  account: AccountDoc | null
): { state: "active" | "paused" | "past_due"; message?: string } {
  if (!account) return { state: "active" };

  switch (account.billingStatus) {
    case "paused":
      return {
        state: "paused",
        message:
          "Your protection has paused. Update your plan to continue recovering customers.",
      };
    case "past_due":
      return {
        state: "past_due",
        message:
          "There's a billing issue on your account. Update your payment method to keep Isolynic protecting your customers.",
      };
    default:
      return { state: "active" };
  }
}

// ───────────────────────────────────────────────────────────────────────
// CORE ORCHESTRATOR — assembles + writes the HomeSummary document.
// This is the single source of truth all triggers below call into.
// ───────────────────────────────────────────────────────────────────────

async function computeHomeSummary(ownerId: string): Promise<HomeSummary> {
  const [
    activeOpportunities,
    resolvedThisWeek,
    bookingsThisWeek,
    nextBookingResult,
    recentActivityDocs,
    coverageResult,
    account,
    hasEverHadOpportunity,
  ] = await Promise.all([
    fetchActivePipelineOpportunities(ownerId),
    fetchResolvedOpportunitiesThisWeek(ownerId),
    fetchBookingsThisWeek(ownerId),
    fetchNextBooking(ownerId),
    fetchRecentActivity(ownerId),
    fetchCoverage(ownerId),
    fetchAccount(ownerId),
    fetchHasEverHadOpportunity(ownerId),
  ]);

  const degradedChannels = await fetchDegradedChannels(
    coverageResult.connected
  );

  const { attentionOpportunities, recoverableAutomatically } =
    curateAttention(activeOpportunities);
  const needsHumanOpportunities = curateNeedsHuman(activeOpportunities);

  const activeRecoveries = activeOpportunities.filter(
    (o) => o.data.status === "recovering"
  ).length;

  const repliedThisWeek = resolvedThisWeek.filter(
    (o) => o.data.outcomeCategory === "replied"
  ).length;
  const stillDecidingThisWeek = resolvedThisWeek.filter(
    (o) => o.data.outcomeCategory === "still_deciding"
  ).length;

  const weeklySummary = buildWeeklySummary(resolvedThisWeek, bookingsThisWeek);
  weeklySummary.stillActiveCount = activeOpportunities.length;

  const coverage = ALL_CHANNELS.map((channel) => ({
    channel,
    label: CHANNEL_LABELS[channel],
    connected: coverageResult.connected.includes(channel),
  }));

  const accountState = mapAccountState(account);

  const status = determineStatus({
    attentionCount: attentionOpportunities.length,
    needsHumanCount: needsHumanOpportunities.length,
    accountState: accountState.state,
    degradedChannels,
    connectedChannels: coverageResult.connected,
    hasEverHadOpportunity,
  });

  const nextBooking = nextBookingResult
    ? {
        customerDisplayName: nextBookingResult.data.customerDisplayName,
        timeLabel: formatBookingTimeLabel(nextBookingResult.data.startTime),
        opportunityId: nextBookingResult.data.opportunityId,
      }
    : null;

  const recentActivity = recentActivityDocs.map((a) => ({
    id: a.id,
    timestamp: a.data.timestamp.toMillis(),
    label: a.data.label,
    opportunityId: a.data.opportunityId,
    navigateTo: a.data.navigateTo,
  }));

  const summary: HomeSummary = {
    ownerId,
    status,
    attentionCount: attentionOpportunities.length,
    recoverableAutomatically,
    attentionOpportunities,
    needsHumanCount: needsHumanOpportunities.length,
    needsHumanOpportunities,
    recoveredThisWeek: weeklySummary.recoveredCount,
    bookedThisWeek: bookingsThisWeek.length,
    activeRecoveries,
    repliedThisWeek,
    stillDecidingThisWeek,
    nextBooking,
    bookingsThisWeekCount: bookingsThisWeek.length,
    recentActivity,
    weeklySummary,
    coverage,
    degradedChannels,
    account: accountState,
    updatedAt: Date.now(),
  };

  return summary;
}

/**
 * Writes the computed summary. Uses `set` with merge:false intentionally —
 * HomeSummary is a fully-derived snapshot; partial merges would risk
 * leaving stale fields (e.g. a resolved attention card) behind.
 */
async function computeAndWriteHomeSummary(ownerId: string): Promise<HomeSummary> {
  const summary = await computeHomeSummary(ownerId);
  await db
    .collection("homeSummaries")
    .doc(ownerId)
    .set(
      { ...summary, updatedAt: FieldValue.serverTimestamp() as unknown as number },
      { merge: false }
    );
  return summary;
}

/**
 * Simple per-invocation guard so a burst of writes for the same owner
 * (e.g. 50 messages ingested in one batch) doesn't trigger 50 redundant
 * full recomputes in the same second. For very high-volume owners in
 * production, replace this with a Cloud Tasks-based trailing debounce
 * keyed on ownerId; this in-memory map is a best-effort optimization
 * scoped to a single function instance and is safe to omit correctness-
 * wise (recompute is idempotent) — it only reduces cost.
 */
const recentRecomputeAt = new Map<string, number>();
const RECOMPUTE_DEBOUNCE_MS = 1500;

async function requestRecompute(ownerId: string, reason: string): Promise<void> {
  const last = recentRecomputeAt.get(ownerId) ?? 0;
  const now = Date.now();
  if (now - last < RECOMPUTE_DEBOUNCE_MS) {
    return;
  }
  recentRecomputeAt.set(ownerId, now);

  try {
    await computeAndWriteHomeSummary(ownerId);
  } catch (err) {
    // §55 — never let internals leak; log richly server-side instead.
    logger.error("home_summary_recompute_failed", {
      ownerId,
      reason,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err; // allow Firestore trigger retry semantics to kick in
  }
}

// ───────────────────────────────────────────────────────────────────────
// TRIGGERS — every collection that can change what Home should show.
// ───────────────────────────────────────────────────────────────────────

/**
 * Fires on any opportunity create/update/delete. Opportunities drive
 * attention count, needs-human count, weekly summary, and active
 * recoveries — the majority of Home's surface area.
 */

export const onOpportunityWritten = onDocumentWritten(
  { document: "opportunities/{opportunityId}", retry: true },
  async (event) => {
    const before = event.data?.before?.data() as OpportunityDoc | undefined;
    const after = event.data?.after?.data() as OpportunityDoc | undefined;

    const ownerId = after?.ownerId ?? before?.ownerId;

    if (!ownerId) {
      logger.warn("opportunity_write_missing_owner", {
        opportunityId: event.params.opportunityId,
      });
      return;
    }

    await requestRecompute(ownerId, "opportunity_write");
  }
);

/**
 * Fires on booking create/update/delete — affects the Bookings card
 * and the weekly "booked" count.
 */
export const onBookingWritten = onDocumentWritten(
  { document: "bookings/{bookingId}", retry: true },
  async (event) => {
    const before = event.data?.before?.data() as BookingDoc | undefined;
    const after = event.data?.after?.data() as BookingDoc | undefined;

    const ownerId = after?.ownerId ?? before?.ownerId;

    if (!ownerId) {
      logger.warn("booking_write_missing_owner", {
        bookingId: event.params.bookingId,
      });
      return;
    }

    await requestRecompute(ownerId, "booking_write");
  }
);

/**
 * Fires when a new meaningful activity event is created (§25 — recovered,
 * replied, booked, etc.). Updates the Recent Activity feed.
 */
export const onActivityEventCreated = onDocumentCreated(
  { document: "activityEvents/{eventId}", retry: true },
  async (event) => {
    const data = event.data?.data() as ActivityEventDoc | undefined;
    if (!data?.ownerId) return;

    // Only recompute for activity types that actually surface on Home;
    // this keeps low-signal event streams (if any get written here by
    // mistake) from causing unnecessary writes.
    if (!MEANINGFUL_ACTIVITY_TYPES.has(data.type)) return;

    await requestRecompute(data.ownerId, "activity_event_created");
  }
);

/**
 * Fires when an owner's connected channels change — drives the
 * "partial coverage" banner and status (§21).
 */
export const onChannelConnectionsWritten = onDocumentWritten(
  { document: "channelConnections/{ownerId}", retry: true },
  async (event) => {
    const ownerId = event.params.ownerId as string;
    await requestRecompute(ownerId, "channel_connections_write");
  }
);

/**
 * Fires when billing/account status changes — drives account_issue
 * status and the "protection has paused" banner (§45).
 */
export const onAccountWritten = onDocumentWritten(
  { document: "accounts/{ownerId}", retry: true },
  async (event) => {
    const ownerId = event.params.ownerId as string;
    await requestRecompute(ownerId, "account_write");
  }
);

/**
 * Fires when a channel's platform-wide health status changes (e.g. the
 * WhatsApp webhook integration goes down). Fans out the recompute to
 * every owner who has that channel connected (§22 — temporary service
 * degradation).
 *
 * NOTE ON SCALE: for very large owner bases, replace the direct fan-out
 * below with a paginated batch job (query in pages of 300, dispatch via
 * Cloud Tasks) to stay within function memory/time limits. The logic
 * itself does not change — only the iteration strategy.
 */
export const onChannelHealthWritten = onDocumentWritten(
  { document: "channelHealth/{channelId}", retry: true },
  async (event) => {
    const channelId = event.params.channelId as ChannelId;
    const after = event.data?.after?.data() as ChannelHealthDoc | undefined;
    if (!after) return; // health doc deleted — nothing to fan out

    const affectedOwners = await db
      .collection("channelConnections")
      .where("connectedChannels", "array-contains", channelId)
      .get();

    if (affectedOwners.empty) return;

    logger.info("channel_health_fanout", {
      channelId,
      status: after.status,
      ownerCount: affectedOwners.size,
    });

    // Bounded concurrency to avoid overwhelming Firestore on large fan-outs.
    const BATCH_SIZE = 25;
    const ownerIds = affectedOwners.docs.map((d) => d.id);
    for (let i = 0; i < ownerIds.length; i += BATCH_SIZE) {
      const batch = ownerIds.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((ownerId) =>
          computeAndWriteHomeSummary(ownerId).catch((err) =>
            logger.error("channel_health_fanout_recompute_failed", {
              ownerId,
              error: err instanceof Error ? err.message : String(err),
            })
          )
        )
      );
    }
  }
);

// ───────────────────────────────────────────────────────────────────────
// SCHEDULED JOBS
// ───────────────────────────────────────────────────────────────────────

/**
 * The 7-day "this week" window in weeklySummary needs to roll forward even
 * when nothing new happens for an owner (an opportunity resolved 7 days
 * and 1 hour ago should silently drop out of the count). Event-driven
 * triggers alone won't catch that — so a periodic sweep recomputes every
 * account that has any historical activity. Runs hourly; cheap because
 * computeHomeSummary's queries are all indexed and owner-scoped.
 */
export const refreshHomeSummariesHourly = onSchedule(
  { schedule: "every 60 minutes", retryCount: 2 },
  async () => {
    const BATCH_SIZE = 200;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let totalProcessed = 0;

    // Page through accounts collection rather than homeSummaries so that
    // brand-new owners (no homeSummaries doc yet) also get bootstrapped.
    for (;;) {
      let query = db
        .collection("accounts")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc.id);
      }

      const snap = await query.get();
      if (snap.empty) break;

      await Promise.all(
        snap.docs.map((docSnap) =>
          computeAndWriteHomeSummary(docSnap.id).catch((err) =>
            logger.error("scheduled_refresh_failed", {
              ownerId: docSnap.id,
              error: err instanceof Error ? err.message : String(err),
            })
          )
        )
      );

      totalProcessed += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];

      if (snap.size < BATCH_SIZE) break;
    }

    logger.info("scheduled_refresh_complete", { totalProcessed });
  }
);

// ───────────────────────────────────────────────────────────────────────
// CLIENT-FACING ENDPOINTS
//
// The frontend's primary path is a Firestore listener on
// homeSummaries/{ownerId} (§51 — event-driven, no polling). These two
// endpoints exist for (a) the manual pull-to-refresh action, and (b) as
// the literal REST equivalent of the "GET /home/summary" contract
// described in §49, for any non-Firestore client (e.g. a future native
// app or server-to-server integration).
// ───────────────────────────────────────────────────────────────────────

/**
 * Callable version — used by the web app's `refresh()` action.
 * Verifies the caller can only ever recompute their OWN summary.
 */
export const getHomeSummary = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const ownerId = request.auth.uid;

  try {
    const summary = await computeAndWriteHomeSummary(ownerId);
    return summary;
  } catch (err) {
    logger.error("get_home_summary_callable_failed", {
      ownerId,
      error: err instanceof Error ? err.message : String(err),
    });
    // §55 — human-readable, no stack traces to the client.
    throw new HttpsError(
      "internal",
      "We couldn't load your customer activity."
    );
  }
});

/**
 * REST/HTTP version mirroring the exact `GET /home/summary` example in
 * §49. Requires a Firebase ID token in the Authorization header:
 *
 *   GET /homeSummaryHttp
 *   Authorization: Bearer <Firebase ID token>
 *
 * The owner is always derived from the verified token — never from a
 * client-supplied parameter — so one owner can never read another's data.
 */
export const homeSummaryHttp = onRequest(async (req, res) => {
  // Basic CORS support for browser-based callers.
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const ownerId = decoded.uid;

    const summary = await computeAndWriteHomeSummary(ownerId);

    // Shape mirrors the conceptual example in §49 (camelCase, pre-
    // interpreted fields only — no raw scores, no internal thresholds).
    res.status(200).json({
      status: summary.status,
      attentionCount: summary.attentionCount,
      recoverableAutomatically: summary.recoverableAutomatically,
      needsHuman: summary.needsHumanCount,
      recoveredThisWeek: summary.recoveredThisWeek,
      bookedThisWeek: summary.bookedThisWeek,
      activeRecoveries: summary.activeRecoveries,
      recentActivity: summary.recentActivity,
      attentionOpportunities: summary.attentionOpportunities,
      needsHumanOpportunities: summary.needsHumanOpportunities,
      nextBooking: summary.nextBooking,
      bookingsThisWeekCount: summary.bookingsThisWeekCount,
      weeklySummary: summary.weeklySummary,
      coverage: summary.coverage,
      degradedChannels: summary.degradedChannels,
      account: summary.account,
      updatedAt: summary.updatedAt,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "auth/id-token-expired"
    ) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    logger.error("home_summary_http_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "We couldn't load your customer activity." });
  }
});