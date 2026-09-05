import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

initializeApp();
const db = getFirestore();

// ---------- Shared types ----------

type OpportunityStatus =
  | 'active'
  | 'needs_attention'
  | 'recovering'
  | 'owner_needed'
  | 'recovered'
  | 'booked'
  | 'won'
  | 'lost'
  | 'not_opportunity';

interface AuthContext {
  uid: string;
  businessId: string;
}

// ---------- Auth / ownership guard ----------

async function requireOpportunityOwner(
  auth: { uid?: string } | undefined,
  opportunityId: string
): Promise<{ ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData; authCtx: AuthContext }> {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const ref = db.collection('opportunities').doc(opportunityId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Opportunity not found.');
  }
  const data = snap.data()!;

  const userSnap = await db.collection('users').doc(auth.uid).get();
  const businessId = userSnap.data()?.businessId;
  if (!businessId || businessId !== data.businessId) {
    throw new HttpsError('permission-denied', 'You do not have access to this opportunity.');
  }

  return { ref, data, authCtx: { uid: auth.uid, businessId } };
}

async function writeAudit(
  opportunityId: string,
  record: {
    actor: 'customer' | 'owner' | 'isolynic';
    action: string;
    channel?: string;
    message?: string;
    result: 'success' | 'failure' | 'pending';
  }
) {
  await db
    .collection('opportunities')
    .doc(opportunityId)
    .collection('audit')
    .add({
      ...record,
      timestamp: Date.now(),
    });
}

async function writeTimelineEvent(
  opportunityId: string,
  event: {
    type: string;
    actor: 'customer' | 'owner' | 'isolynic';
    channel: string;
    label: string;
    content?: string;
  }
) {
  await db
    .collection('opportunities')
    .doc(opportunityId)
    .collection('timeline')
    .add({
      ...event,
      id: randomUUID(),
      timestamp: Date.now(),
    });
}

// ---------- Policy / safety layer (§77) ----------

interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

function runSafetyPolicy(data: FirebaseFirestore.DocumentData): PolicyCheckResult {
  // 1. Known customer interaction?
  if (!data.customerId) {
    return { allowed: false, reason: 'unknown_customer' };
  }
  // 2. Customer explicitly declined?
  if (data.customerState === 'declined') {
    return { allowed: false, reason: 'customer_declined' };
  }
  // 3. Follow-up limit exceeded?
  if ((data.followUpCount ?? 0) >= (data.followUpLimit ?? 2)) {
    return { allowed: false, reason: 'follow_up_limit_reached' };
  }
  // 4. High-risk / regulated conversation?
  if (data.highRiskFlag === true) {
    return { allowed: false, reason: 'high_risk_requires_owner' };
  }
  // 5. AI uncertain / insufficient context?
  if (data.aiUncertain === true || data.contextInsufficient === true) {
    return { allowed: false, reason: 'insufficient_confidence' };
  }
  return { allowed: true };
}

// ---------- recoverOpportunity ----------

export const recoverOpportunity = onCall<{ opportunityId: string; message?: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { opportunityId, message } = request.data;
    if (!opportunityId) throw new HttpsError('invalid-argument', 'opportunityId is required.');

    const { ref, data } = await requireOpportunityOwner(request.auth, opportunityId);

    const policy = runSafetyPolicy(data);
    if (!policy.allowed) {
      await writeAudit(opportunityId, {
        actor: 'owner',
        action: 'recover_blocked',
        result: 'failure',
      });
      throw new HttpsError('failed-precondition', `Cannot recover: ${policy.reason}`);
    }

    const finalMessage: string = message?.trim() || data.recommendedAction?.suggestedMessage || '';
    if (!finalMessage) {
      throw new HttpsError('failed-precondition', 'No message available to send.');
    }

    const messageId = randomUUID();
    const channel: string = data.channel ?? 'whatsapp';

    try {
      // Integration point: call your messaging provider (WhatsApp Business API, SMS, etc.)
      // await sendCustomerMessage({ businessId: data.businessId, customerId: data.customerId, channel, message: finalMessage });

      const nextCheckAt = Date.now() + 24 * 60 * 60 * 1000; // check again in 24h

      await ref.update({
        status: 'recovering' as OpportunityStatus,
        lastIsolynicAction: 'follow_up_sent',
        followUpCount: FieldValue.increment(1),
        updatedAt: Date.now(),
        recoveryAttempts: FieldValue.arrayUnion({
          id: messageId,
          sentAt: Date.now(),
          channel,
          message: finalMessage,
          responded: false,
        }),
      });

      await writeTimelineEvent(opportunityId, {
        type: 'recovery_sent',
        actor: 'isolynic',
        channel,
        label: 'Isolynic followed up',
        content: finalMessage,
      });

      await writeAudit(opportunityId, {
        actor: 'isolynic',
        action: 'recover_sent',
        channel,
        message: finalMessage,
        result: 'success',
      });

      return {
        status: 'success',
        messageId,
        opportunityStatus: 'recovering',
        nextCheckAt,
        customerChannel: channel,
      };
    } catch (err) {
      await writeAudit(opportunityId, {
        actor: 'isolynic',
        action: 'recover_sent',
        channel,
        message: finalMessage,
        result: 'failure',
      });
      return {
        status: 'failure',
        opportunityStatus: data.status,
        customerChannel: channel,
        error: "We couldn't send the message.",
      };
    }
  }
);

// ---------- takeoverOpportunity ----------

export const takeoverOpportunity = onCall<{ opportunityId: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { opportunityId } = request.data;
    if (!opportunityId) throw new HttpsError('invalid-argument', 'opportunityId is required.');

    const { ref } = await requireOpportunityOwner(request.auth, opportunityId);

    await ref.update({
      status: 'owner_needed' as OpportunityStatus,
      ownerHandling: true,
      lastOwnerAction: 'takeover',
      updatedAt: Date.now(),
    });

    await writeTimelineEvent(opportunityId, {
      type: 'status_change',
      actor: 'owner',
      channel: 'system',
      label: 'Owner took over the conversation',
    });

    await writeAudit(opportunityId, { actor: 'owner', action: 'takeover', result: 'success' });

    return { status: 'success', opportunityStatus: 'owner_needed' };
  }
);

// ---------- dismissOpportunity ----------

export const dismissOpportunity = onCall<{ opportunityId: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { opportunityId } = request.data;
    if (!opportunityId) throw new HttpsError('invalid-argument', 'opportunityId is required.');

    const { ref, data } = await requireOpportunityOwner(request.auth, opportunityId);

    const undoToken = randomUUID();
    const previousStatus = data.status as OpportunityStatus;

    await ref.update({
      status: 'not_opportunity' as OpportunityStatus,
      lastOwnerAction: 'dismissed',
      updatedAt: Date.now(),
    });

    // Store undo context with short TTL
    await db
      .collection('opportunities')
      .doc(opportunityId)
      .collection('undoTokens')
      .doc(undoToken)
      .set({
        action: 'dismiss',
        previousStatus,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

    await writeAudit(opportunityId, { actor: 'owner', action: 'dismiss', result: 'success' });

    // Learning signal (§24) — never exposed to user as "retraining"
    await db.collection('correctionSignals').add({
      opportunityId,
      businessId: data.businessId,
      intentType: data.intentType,
      correctionType: 'not_opportunity',
      createdAt: Date.now(),
    });

    return { status: 'success', opportunityStatus: 'not_opportunity', undoToken };
  }
);

// ---------- undoOpportunityAction ----------

export const undoOpportunityAction = onCall<{ opportunityId: string; undoToken: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { opportunityId, undoToken } = request.data;
    if (!opportunityId || !undoToken) {
      throw new HttpsError('invalid-argument', 'opportunityId and undoToken are required.');
    }

    const { ref } = await requireOpportunityOwner(request.auth, opportunityId);

    const tokenRef = db
      .collection('opportunities')
      .doc(opportunityId)
      .collection('undoTokens')
      .doc(undoToken);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      throw new HttpsError('not-found', 'This action can no longer be undone.');
    }
    const tokenData = tokenSnap.data()!;
    if (Date.now() > tokenData.expiresAt) {
      throw new HttpsError('deadline-exceeded', 'The window to undo this action has passed.');
    }

    await ref.update({
      status: tokenData.previousStatus,
      updatedAt: Date.now(),
    });

    await tokenRef.delete();
    await writeAudit(opportunityId, { actor: 'owner', action: 'undo_dismiss', result: 'success' });

    return { status: 'success' };
  }
);

// ---------- addOpportunityNote ----------

export const addOpportunityNote = onCall<{ opportunityId: string; note: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { opportunityId, note } = request.data;
    if (!opportunityId || typeof note !== 'string') {
      throw new HttpsError('invalid-argument', 'opportunityId and note are required.');
    }
    if (note.length > 500) {
      throw new HttpsError('invalid-argument', 'Note is too long.');
    }

    const { ref } = await requireOpportunityOwner(request.auth, opportunityId);

    await ref.update({ ownerNote: note, updatedAt: Date.now() });

    await writeTimelineEvent(opportunityId, {
      type: 'note_added',
      actor: 'owner',
      channel: 'system',
      label: 'Owner added a note',
      content: note,
    });

    return { status: 'success' };
  }
);

// ---------- resolveOpportunity ----------

export const resolveOpportunity = onCall<{
  opportunityId: string;
  outcome: 'won' | 'lost';
  value?: number;
  reason?: string;
}>({ region: 'us-central1' }, async (request) => {
  const { opportunityId, outcome, value, reason } = request.data;
  if (!opportunityId || !outcome) {
    throw new HttpsError('invalid-argument', 'opportunityId and outcome are required.');
  }

  const { ref, data } = await requireOpportunityOwner(request.auth, opportunityId);

  const update: Record<string, unknown> = {
    status: outcome as OpportunityStatus,
    resolutionState: outcome,
    updatedAt: Date.now(),
  };
  if (outcome === 'won' && typeof value === 'number') {
    update.resolutionValue = value;
  }
  if (outcome === 'lost' && reason) {
    update.resolutionReason = reason;
  }

  await ref.update(update);

  await writeTimelineEvent(opportunityId, {
    type: 'status_change',
    actor: 'owner',
    channel: 'system',
    label: outcome === 'won' ? 'Marked as won' : 'Marked as lost',
  });

  await writeAudit(opportunityId, { actor: 'owner', action: `resolve_${outcome}`, result: 'success' });

  // Learning signal — outcome feeds back into opportunity intelligence (§83)
  await db.collection('correctionSignals').add({
    opportunityId,
    businessId: data.businessId,
    intentType: data.intentType,
    correctionType: outcome === 'won' ? 'positive_outcome' : 'negative_outcome',
    reason: reason ?? null,
    createdAt: Date.now(),
  });

  return { status: 'success', opportunityStatus: outcome };
});

// ---------- Firestore trigger: recovery limit escalation (§33) ----------
// When followUpCount reaches the limit after an update, flip status to owner_needed automatically.

export const onOpportunityUpdatedEnforceFollowUpLimit = onDocumentUpdated(
  'opportunities/{opportunityId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const limitJustReached =
      (after.followUpCount ?? 0) >= (after.followUpLimit ?? 2) &&
      (before.followUpCount ?? 0) < (after.followUpLimit ?? 2) &&
      after.status === 'recovering';

    if (limitJustReached) {
      await event.data!.after.ref.update({
        status: 'owner_needed' as OpportunityStatus,
        updatedAt: Date.now(),
      });
      await writeTimelineEvent(event.params.opportunityId, {
        type: 'status_change',
        actor: 'isolynic',
        channel: 'system',
        label: 'Follow-up limit reached — escalated to owner',
      });
    }
  }
);