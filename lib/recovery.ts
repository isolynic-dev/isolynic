
// lib/firebase/recoveryActions.ts
'use client';

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface BaseResult {
  ok: boolean;
  reason?: string; // human-safe reason, e.g. "No follow-up needed right now."
}

export interface RecoverResult extends BaseResult {
  status?: string;
  lastRecoveryAction?: { type: string; at: number; channel: string; messagePreview?: string };
}

function idempotencyKey(opportunityId: string, action: string) {
  // Stable per opportunity+action+minute-bucket isn't safe for true idempotency across retries,
  // so the client generates one key per user gesture and reuses it across retries.
  return `${opportunityId}:${action}:${crypto.randomUUID()}`;
}

export async function recoverOpportunity(opportunityId: string, requestId?: string): Promise<RecoverResult> {
  const call = httpsCallable<{ opportunityId: string; requestId: string }, RecoverResult>(
    functions,
    'recoverOpportunity'
  );
  const res = await call({
    opportunityId,
    requestId: requestId ?? idempotencyKey(opportunityId, 'recover'),
  });
  return res.data;
}

export async function ignoreOpportunity(opportunityId: string, requestId?: string): Promise<BaseResult> {
  const call = httpsCallable<{ opportunityId: string; requestId: string }, BaseResult>(
    functions,
    'ignoreOpportunity'
  );
  const res = await call({
    opportunityId,
    requestId: requestId ?? idempotencyKey(opportunityId, 'ignore'),
  });
  return res.data;
}

export async function markNotACustomer(opportunityId: string, requestId?: string): Promise<BaseResult> {
  const call = httpsCallable<{ opportunityId: string; requestId: string }, BaseResult>(
    functions,
    'markNotACustomer'
  );
  const res = await call({
    opportunityId,
    requestId: requestId ?? idempotencyKey(opportunityId, 'not_a_customer'),
  });
  return res.data;
}

export async function undoAction(opportunityId: string): Promise<BaseResult> {
  const call = httpsCallable<{ opportunityId: string }, BaseResult>(functions, 'undoAction');
  const res = await call({ opportunityId });
  return res.data;
}

export async function claimHandling(opportunityId: string): Promise<BaseResult> {
  const call = httpsCallable<{ opportunityId: string }, BaseResult>(functions, 'claimHandling');
  const res = await call({ opportunityId });
  return res.data;
}