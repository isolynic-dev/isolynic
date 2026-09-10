import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Transaction, FieldValue } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  timestamp: number;
  channel: ChannelType;
  summary: string;
  relevance: 'primary' | 'supporting';
}

export interface OpportunityDoc {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  sourceChannels: ChannelType[];
  firstContactAt: number;
  latestActivityAt: number;
  intentSummary: string;
  whyNow: string;
  recommendation: string;
  valueEstimate?: number | null;
  riskState: 'stable' | 'deteriorating' | 'critical';
  status: OpportunityLifecycleStatus;
  priorityBand: PriorityBand;
  priorityScore: number;
  decisionBand: DecisionBand;
  ownerAction?: string | null;
  lastRecoveryAction?: { type: string; at: number; channel: ChannelType; messagePreview?: string } | null;
  followUpCount: number;
  maxFollowUps: number;
  cooldownUntil?: number | null;
  explicitlyRejected?: boolean;
  needsOwnerReason?: string | null;
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
  version: number;
}

interface ScoreInputs {
  intentConfidence: number;      // 0–1
  valueEstimate: number | null;  // currency, null if unknown
  avgTransactionValue: number | null;
  deteriorationRisk: number;     // 0–1
  recoveryEffectiveness: number; // 0–1 estimated benefit of intervention
}

const DEFAULT_TRANSACTION_VALUE = 100;
const UNDO_WINDOW_MS = 10_000;

const db = getFirestore();

// ---------------------------------------------------------------------------
// Scoring (spec §11 / §42)
// ---------------------------------------------------------------------------

/** Recovery Priority = Intent × Value × Risk of Loss × Recovery Effectiveness (spec §11/§42). */
export function computePriorityScore(inputs: ScoreInputs): number {
  const value =
    inputs.valueEstimate ?? inputs.avgTransactionValue ?? DEFAULT_TRANSACTION_VALUE;
  const normalizedValue = Math.min(value / 1000, 1); // cap influence of very large values
  const raw =
    inputs.intentConfidence * 0.35 +
    normalizedValue * 0.25 +
    inputs.deteriorationRisk * 0.25 +
    inputs.recoveryEffectiveness * 0.15;
  return Math.round(raw * 1000) / 1000;
}

export function scoreToPriorityBand(score: number): PriorityBand {
  if (score >= 0.65) return 'high';
  if (score >= 0.35) return 'worth_checking';
  return 'low';
}

export function scoreToDecisionBand(params: {
  score: number;
  hasRequiredPricingInfo: boolean;
  isAmbiguousIntent: boolean;
}): DecisionBand {
  if (!params.hasRequiredPricingInfo || params.isAmbiguousIntent) return 'human_required';
  if (params.score >= 0.65) return 'autonomous';
  return 'assisted';
}

// ---------------------------------------------------------------------------
// Idempotency (spec §34)
// ---------------------------------------------------------------------------

/**
 * Ensures a client-supplied requestId is only ever processed once, guarding against
 * duplicate webhooks, retried callable invocations, and multi-tab double-taps (spec §34).
 * Must be called from within the same transaction that performs the state mutation.
 */
export async function claimIdempotencyKey(tx: Transaction, requestId: string): Promise<boolean> {
  const ref = db.collection('actionRequests').doc(requestId);
  const snap = await tx.get(ref);
  if (snap.exists) return false; // already processed — caller should no-op successfully
  tx.set(ref, { createdAt: Date.now() });
  return true;
}

// ---------------------------------------------------------------------------
// Eligibility (spec §55–56)
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

/** Anti-spam / anti-harassment gate (spec §55–56). */
export function checkRecoveryEligibility(o: OpportunityDoc, now: number): EligibilityResult {
  if (o.explicitlyRejected) {
    return { eligible: false, reason: 'No follow-up needed right now.' };
  }
  if (o.cooldownUntil && o.cooldownUntil > now) {
    return { eligible: false, reason: 'No follow-up needed right now.' };
  }
  if (o.followUpCount >= o.maxFollowUps) {
    return { eligible: false, reason: 'No follow-up needed right now.' };
  }
  if (o.status === 'IGNORED' || o.status === 'NOT_A_CUSTOMER' || o.status === 'LOST') {
    return { eligible: false, reason: 'This customer is no longer in recovery.' };
  }
  if (o.status === 'BOOKED' || o.status === 'WON' || o.status === 'HANDLED') {
    return { eligible: false, reason: 'This customer has already been handled.' };
  }
  if (o.status === 'RECOVERY_SENT' || o.status === 'WAITING') {
    return { eligible: false, reason: 'A follow-up is already on its way.' };
  }
  if (o.decisionBand === 'human_required') {
    return { eligible: false, reason: 'This one needs your input first.' };
  }
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/**
 * Integration point for the actual outbound-messaging provider (SMS/WhatsApp/email gateway).
 * Kept as a template-based generator here; swap the body for a real provider call.
 * Selecting template/channel/tone/timing is Isolynic's job, never the owner's (spec §17).
 */
export async function sendRecoveryMessage(o: OpportunityDoc): Promise<{
  channel: ChannelType;
  messagePreview: string;
}> {
  const channel: ChannelType = o.sourceChannels[0] ?? 'sms';
  const firstName = o.customerName.split(' ')[0];

  const messagePreview =
    o.status === 'CUSTOMER_RESPONDED'
      ? `Hi ${firstName}, great — let's get that scheduled.`
      : `Hi ${firstName}, just checking whether you'd still like us to move forward. Happy to help whenever works for you.`;

  // TODO: replace with real provider call (Twilio / WhatsApp Business API / SES, etc).
  // await messagingProvider.send({ to: o.customerId, channel, body: messagePreview });

  return { channel, messagePreview };
}

// ---------------------------------------------------------------------------
// recoverOpportunity
// ---------------------------------------------------------------------------

interface RecoverInput {
  opportunityId: string;
  requestId: string;
}

export const recoverOpportunity = onCall<RecoverInput>({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { opportunityId, requestId } = request.data;
  if (!opportunityId || !requestId) {
    throw new HttpsError('invalid-argument', 'opportunityId and requestId are required.');
  }

  const oppRef = db.collection('opportunities').doc(opportunityId);

  const result = await db.runTransaction(async (tx) => {
    const fresh = await claimIdempotencyKey(tx, requestId);

    const snap = await tx.get(oppRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Opportunity not found.');
    const o = snap.data() as OpportunityDoc;

    // Ownership check — the caller must belong to the same business as the opportunity.
    const userSnap = await tx.get(db.collection('users').doc(uid));
    const userBusinessId = userSnap.data()?.businessId;
    if (userBusinessId !== o.businessId) {
      throw new HttpsError('permission-denied', 'Not authorized for this opportunity.');
    }

    if (!fresh) {
      // Duplicate request already processed — return current state idempotently, no re-send.
      return { ok: true, status: o.status, lastRecoveryAction: o.lastRecoveryAction ?? null };
    }

    const now = Date.now();
    const eligibility = checkRecoveryEligibility(o, now);
    if (!eligibility.eligible) {
      return { ok: false, reason: eligibility.reason };
    }

    return { pending: true, opportunity: o };
  });

  // Fresh, eligible recovery: perform the send outside the transaction, then commit atomically.
  if ('pending' in result && result.pending) {
    const o = result.opportunity;
    const sent = await sendRecoveryMessage(o);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(oppRef);
      const current = snap.data() as OpportunityDoc;

      // Compare-and-swap guard: if state changed between read and write (e.g. customer
      // replied in the meantime, or another concurrent call won the race), don't overwrite it.
      if (current.status !== o.status || current.version !== o.version) {
        return;
      }

      const evidenceEntry: EvidenceItem = {
        id: db.collection('_').doc().id,
        eventType: 'recovery_sent',
        timestamp: Date.now(),
        channel: sent.channel,
        summary: sent.messagePreview,
        relevance: 'primary',
      };

      tx.update(oppRef, {
        status: 'RECOVERY_SENT',
        ownerAction: 'recover',
        lastRecoveryAction: {
          type: 'follow_up',
          at: Date.now(),
          channel: sent.channel,
          messagePreview: sent.messagePreview,
        },
        followUpCount: current.followUpCount + 1,
        cooldownUntil: Date.now() + 24 * 60 * 60 * 1000,
        evidence: [...current.evidence, evidenceEntry],
        version: current.version + 1,
        updatedAt: Date.now(),
      });

      tx.set(
        db.collection('auditLog').doc(),
        {
          opportunityId,
          businessId: current.businessId,
          actorUid: uid,
          action: 'recover',
          at: Date.now(),
        }
      );
    });

    return {
      ok: true,
      status: 'RECOVERY_SENT',
      lastRecoveryAction: { type: 'follow_up', at: Date.now(), channel: sent.channel, messagePreview: sent.messagePreview },
    };
  }

  return result as { ok: boolean; reason?: string; status?: string };
});

// ---------------------------------------------------------------------------
// ignoreOpportunity
// ---------------------------------------------------------------------------

export const ignoreOpportunity = onCall<{ opportunityId: string; requestId: string }>(
  { cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { opportunityId, requestId } = request.data;

    const oppRef = db.collection('opportunities').doc(opportunityId);

    return db.runTransaction(async (tx) => {
      const fresh = await claimIdempotencyKey(tx, requestId);
      const snap = await tx.get(oppRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Opportunity not found.');
      const o = snap.data() as OpportunityDoc;

      const userSnap = await tx.get(db.collection('users').doc(uid));
      if (userSnap.data()?.businessId !== o.businessId) {
        throw new HttpsError('permission-denied', 'Not authorized for this opportunity.');
      }

      if (!fresh) return { ok: true };

      tx.update(oppRef, {
        status: 'IGNORED',
        ownerAction: 'ignore',
        priorSnapshot: { status: o.status, ownerAction: o.ownerAction ?? null },
        undoExpiresAt: Date.now() + UNDO_WINDOW_MS,
        version: o.version + 1,
        updatedAt: Date.now(),
      });

      return { ok: true };
    });
  }
);

// ---------------------------------------------------------------------------
// markNotACustomer
// ---------------------------------------------------------------------------

export const markNotACustomer = onCall<{ opportunityId: string; requestId: string }>(
  { cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { opportunityId, requestId } = request.data;

    const oppRef = db.collection('opportunities').doc(opportunityId);

    return db.runTransaction(async (tx) => {
      const fresh = await claimIdempotencyKey(tx, requestId);
      const snap = await tx.get(oppRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Opportunity not found.');
      const o = snap.data() as OpportunityDoc;

      const userSnap = await tx.get(db.collection('users').doc(uid));
      if (userSnap.data()?.businessId !== o.businessId) {
        throw new HttpsError('permission-denied', 'Not authorized for this opportunity.');
      }

      if (!fresh) return { ok: true };

      tx.update(oppRef, {
        status: 'NOT_A_CUSTOMER',
        ownerAction: 'not_a_customer',
        priorSnapshot: { status: o.status, ownerAction: o.ownerAction ?? null },
        undoExpiresAt: Date.now() + UNDO_WINDOW_MS,
        version: o.version + 1,
        updatedAt: Date.now(),
      });

      // Feed the business-level learning signal (spec §76) — reduces future false positives
      // for similar interaction categories without changing the UI.
      const learningRef = db.collection('businesses').doc(o.businessId).collection('learning').doc('notACustomerCategories');
      tx.set(
        learningRef,
        {
          [`counts.${o.intentSummary.slice(0, 40)}`]: FieldValue.increment(1),
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      return { ok: true };
    });
  }
);

// ---------------------------------------------------------------------------
// undoAction
// ---------------------------------------------------------------------------

export const undoAction = onCall<{ opportunityId: string }>({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { opportunityId } = request.data;

  const oppRef = db.collection('opportunities').doc(opportunityId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(oppRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Opportunity not found.');
    const o = snap.data() as OpportunityDoc;

    const userSnap = await tx.get(db.collection('users').doc(uid));
    if (userSnap.data()?.businessId !== o.businessId) {
      throw new HttpsError('permission-denied', 'Not authorized for this opportunity.');
    }

    if (!o.undoExpiresAt || o.undoExpiresAt < Date.now() || !o.priorSnapshot) {
      return { ok: false, reason: 'This can no longer be undone.' };
    }

    tx.update(oppRef, {
      status: o.priorSnapshot.status,
      ownerAction: o.priorSnapshot.ownerAction ?? null,
      priorSnapshot: null,
      undoExpiresAt: null,
      version: o.version + 1,
      updatedAt: Date.now(),
    });

    return { ok: true };
  });
});

// ---------------------------------------------------------------------------
// claimHandling
// ---------------------------------------------------------------------------

/** Lightweight presence/ownership so "Handle myself" doesn't collide across staff (spec §35). */
export const claimHandling = onCall<{ opportunityId: string }>({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { opportunityId } = request.data;

  const oppRef = db.collection('opportunities').doc(opportunityId);
  const userSnap = await db.collection('users').doc(uid).get();
  const businessId = userSnap.data()?.businessId;
  const displayName = userSnap.data()?.displayName ?? 'A teammate';

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(oppRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Opportunity not found.');
    const o = snap.data() as OpportunityDoc;

    if (o.businessId !== businessId) {
      throw new HttpsError('permission-denied', 'Not authorized for this opportunity.');
    }

    if (o.handledByUid && o.handledByUid !== uid) {
      return { ok: false, reason: `${o.handledByName ?? 'Someone else'} is already handling this.` };
    }

    tx.update(oppRef, {
      handledByUid: uid,
      handledByName: displayName,
      ownerAction: 'handle_myself',
      version: o.version + 1,
      updatedAt: Date.now(),
    });

    return { ok: true };
  });
});

// ---------------------------------------------------------------------------
// onOpportunityWrite
// ---------------------------------------------------------------------------

/**
 * Keeps priorityScore / priorityBand / decisionBand in sync whenever an opportunity's
 * underlying signals change, so the client never computes prioritization itself (spec §11/§42).
 * Also enforces basic deduplication safety: if two opportunity docs end up representing the
 * same customer + business with high-confidence identity match, the newer one is merged
 * into the older and marked HANDLED rather than left to duplicate in the queue (spec §36).
 */
export const onOpportunityWrite = onDocumentWritten('opportunities/{opportunityId}', async (event) => {
  const after = event.data?.after;
  if (!after || !after.exists) return; // deleted — nothing to do

  const o = after.data() as OpportunityDoc;
  const before = event.data?.before?.exists ? (event.data.before.data() as OpportunityDoc) : null;

  // Avoid infinite loops: skip if only fields this function itself writes have changed.
  if (
    before &&
    before.intentSummary === o.intentSummary &&
    before.valueEstimate === o.valueEstimate &&
    before.riskState === o.riskState &&
    before.status === o.status
  ) {
    return;
  }

  const businessSnap = await db.collection('businesses').doc(o.businessId).get();
  const avgTransactionValue = (businessSnap.data()?.avgTransactionValue as number) ?? null;

  const intentConfidence = o.evidence.some((e) => e.relevance === 'primary') ? 0.8 : 0.5;
  const deteriorationRisk = o.riskState === 'critical' ? 1 : o.riskState === 'deteriorating' ? 0.7 : 0.3;
  const recoveryEffectiveness = o.followUpCount === 0 ? 0.8 : Math.max(0.2, 0.8 - o.followUpCount * 0.2);

  const priorityScore = computePriorityScore({
    intentConfidence,
    valueEstimate: o.valueEstimate ?? null,
    avgTransactionValue,
    deteriorationRisk,
    recoveryEffectiveness,
  });

  const priorityBand = scoreToPriorityBand(priorityScore);
  const hasRequiredPricingInfo = businessSnap.data()?.hasPricingConfigured !== false;
  const decisionBand = scoreToDecisionBand({
    score: priorityScore,
    hasRequiredPricingInfo,
    isAmbiguousIntent: intentConfidence < 0.55,
  });

  const needsOwnerReason =
    decisionBand === 'human_required'
      ? !hasRequiredPricingInfo
        ? `${o.customerName.split(' ')[0]} wants a price for a service you haven't given Isolynic pricing for.`
        : `This customer may be important, but Isolynic needs your input before continuing.`
      : null;

  const changed =
    o.priorityScore !== priorityScore ||
    o.priorityBand !== priorityBand ||
    o.decisionBand !== decisionBand ||
    o.needsOwnerReason !== needsOwnerReason;

  if (changed) {
    await after.ref.update({
      priorityScore,
      priorityBand,
      decisionBand,
      needsOwnerReason,
      updatedAt: Date.now(),
    });
  }

  // Deduplication safety net (spec §36): same customer + business, both still active.
  if (o.status !== 'HANDLED' && o.status !== 'IGNORED' && o.status !== 'NOT_A_CUSTOMER') {
    const dupSnap = await db
      .collection('opportunities')
      .where('businessId', '==', o.businessId)
      .where('customerId', '==', o.customerId)
      .where('status', 'in', ['NEW_RISK', 'RECOVERY_RECOMMENDED', 'OWNER_APPROVED', 'RECOVERY_SENT', 'WAITING'])
      .get();

    if (dupSnap.size > 1) {
      const sorted = dupSnap.docs.sort(
        (a, b) => (a.data().createdAt as number) - (b.data().createdAt as number)
      );
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      await db.runTransaction(async (tx) => {
        const canonicalSnap = await tx.get(canonical.ref);
        const canonicalData = canonicalSnap.data() as OpportunityDoc;
        let mergedEvidence = canonicalData.evidence;

        for (const dup of duplicates) {
          const dupData = dup.data() as OpportunityDoc;
          mergedEvidence = [...mergedEvidence, ...dupData.evidence];
          tx.update(dup.ref, {
            status: 'HANDLED',
            outcomeNote: 'Merged into a single opportunity for this customer.',
            version: (dupData.version ?? 0) + 1,
            updatedAt: Date.now(),
          });
        }

        tx.update(canonical.ref, {
          evidence: mergedEvidence,
          sourceChannels: Array.from(new Set(mergedEvidence.map((e) => e.channel))),
          version: (canonicalData.version ?? 0) + 1,
          updatedAt: Date.now(),
        });
      });
    }
  }
});