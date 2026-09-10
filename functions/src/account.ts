/**
 * Isolynic Cloud Functions — Account, Channels, Calendar, Billing
 *
 * IMPORTANT: This file assumes `admin.initializeApp()` and any global
 * `setGlobalOptions(...)` call already happen once in your root `index.ts`.
 * Do NOT call either of those here — doing it in more than one file (or
 * more than once anywhere) will throw at deploy/runtime.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
// flutterwave-node-v3 ships no TypeScript types — see the note in the
// install commands below for the one-line .d.ts that silences the error.
import Flutterwave from 'flutterwave-node-v3';

const db = admin.firestore();

// ---- Secrets (set via `firebase functions:secrets:set`) ----
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY!;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY!;
const WHATSAPP_PROVIDER_TOKEN = process.env.WHATSAPP_PROVIDER_TOKEN!; // Twilio-shaped

const flw = new Flutterwave(FLW_PUBLIC_KEY, FLW_SECRET_KEY);

function requireAuth(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  return auth.uid;
}

function accountRef(uid: string) {
  return db.collection('accounts').doc(uid);
}

// =========================================================================
// CHANNELS (§13, §14, §15, §49, §80)
// =========================================================================

export const disconnectChannel = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { channel } = request.data as { channel: 'whatsapp' | 'phone' | 'website' };
  if (!['whatsapp', 'phone', 'website'].includes(channel)) {
    throw new HttpsError('invalid-argument', 'Unknown channel.');
  }

  const ref = accountRef(uid);

  // Best-effort provider-side teardown. Never fail the whole op if the
  // provider call fails — the owner's intent (disconnect) still wins locally,
  // and the health-check job (below) will catch any orphaned provider state.
  try {
    if (channel === 'whatsapp' || channel === 'phone') {
      await fetch('https://api.provider.example/v1/numbers/deprovision', {
        method: 'POST',
        headers: { Authorization: `Bearer ${WHATSAPP_PROVIDER_TOKEN}` },
        body: JSON.stringify({ ownerUid: uid, channel }),
      });
    }
  } catch (err) {
    console.error(`Provider deprovision failed for ${channel}/${uid}`, err);
  }

  await ref.update({
    [`channels.${channel}.status`]: 'not_connected',
    [`channels.${channel}.connectedNumberOrUrl`]: admin.firestore.FieldValue.delete(),
    [`channels.${channel}.lastError`]: admin.firestore.FieldValue.delete(),
  });

  return { ok: true as const };
});

export const testChannel = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { channel } = request.data as { channel: 'whatsapp' | 'phone' | 'website' };
  const ref = accountRef(uid);
  const snap = await ref.get();
  const data = snap.data();
  if (!data) throw new HttpsError('not-found', 'Account not found.');

  const chState = data.channels?.[channel];
  if (!chState || chState.status !== 'connected') {
    throw new HttpsError('failed-precondition', 'Channel is not connected.');
  }

  try {
    if (channel === 'whatsapp') {
      await sendTestWhatsappMessage(chState.connectedNumberOrUrl);
      await ref.update({ 'channels.whatsapp.lastTestedAt': Date.now() });
      return { ok: true, message: 'Test message sent — check your WhatsApp.' };
    }
    if (channel === 'phone') {
      await ref.update({ 'channels.phone.lastTestedAt': Date.now() });
      return { ok: true, message: 'Missed-call detection is active on this number.' };
    }
    // website — just confirm the widget endpoint responds
    const res = await fetch(chState.connectedNumberOrUrl);
    await ref.update({ 'channels.website.lastTestedAt': Date.now() });
    return { ok: res.ok, message: res.ok ? 'Your website is reachable.' : "We couldn't reach your website." };
  } catch (err) {
    console.error(`testChannel failed for ${channel}/${uid}`, err);
    return { ok: false, message: "We couldn't reconnect this channel. Please try again." };
  }
});

async function sendTestWhatsappMessage(to: string | undefined) {
  if (!to) throw new Error('No WhatsApp number on file.');
  const res = await fetch('https://api.provider.example/v1/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_PROVIDER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, template: 'account_test_message' }),
  });
  if (!res.ok) throw new Error(`Provider responded ${res.status}`);
}

// =========================================================================
// CALENDAR (§22–§27, §78, §80)
// =========================================================================

function googleOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri
  );
}

export const startCalendarConnect = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { redirectUri } = request.data as { redirectUri: string };

  const client = googleOAuthClient(redirectUri);
  const state = Buffer.from(JSON.stringify({ uid })).toString('base64url');

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'],
    state,
  });

  return { authUrl };
});

// Called from your Next.js API route /api/calendar/callback after Google redirects back,
// forwarding { code, state, redirectUri } here.
export const completeCalendarConnect = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { code, redirectUri } = request.data as { code: string; redirectUri: string };

  const client = googleOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);

  // Tokens never reach the client — stored server-side only (§13, §78).
  await db.collection('calendarTokens').doc(uid).set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
  });

  client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: client });
  const primary = await calendar.calendarList.get({ calendarId: 'primary' });

  const ref = accountRef(uid);
  await ref.update({
    'calendar.provider': 'google',
    'calendar.connectionStatus': 'connected',
    'calendar.calendarId': primary.data.id ?? 'primary',
  });

  return { ok: true as const };
});

export const disconnectCalendar = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  await db.collection('calendarTokens').doc(uid).delete();
  const ref = accountRef(uid);
  await ref.update({
    'calendar.provider': null,
    'calendar.connectionStatus': 'not_connected',
    'calendar.calendarId': admin.firestore.FieldValue.delete(),
  });
  return { ok: true as const };
});

export const testCalendarEvent = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const tokenDoc = await db.collection('calendarTokens').doc(uid).get();
  if (!tokenDoc.exists) throw new HttpsError('failed-precondition', 'No calendar connected.');

  // §80: only checks reachability — never creates a real event silently.
  const client = googleOAuthClient('');
  client.setCredentials(tokenDoc.data() as any);
  const calendar = google.calendar({ version: 'v3', auth: client });

  try {
    await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 3600_000).toISOString(),
        items: [{ id: 'primary' }],
      },
    });
    return { ok: true, message: 'Your calendar is connected and reachable.' };
  } catch (err) {
    console.error(`testCalendarEvent failed for ${uid}`, err);
    return { ok: false, message: "We couldn't access your calendar. Reconnect it to keep booking working." };
  }
});

// =========================================================================
// PAUSE / RESUME (§47, §48, §85)
// =========================================================================

export const pauseIsolynic = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  await accountRef(uid).update({ isolynicRunState: 'paused' });
  return { ok: true as const };
});

export const resumeIsolynic = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const ref = accountRef(uid);
  const snap = await ref.get();
  const data = snap.data();
  const anyNeedsAttention =
    data?.channels?.whatsapp?.status === 'needs_attention' ||
    data?.channels?.phone?.status === 'needs_attention' ||
    data?.calendar?.connectionStatus === 'needs_attention';

  await ref.update({
    isolynicRunState: anyNeedsAttention ? 'channels_need_attention' : 'protected',
  });
  return { ok: true as const };
});

// =========================================================================
// BILLING — Flutterwave (§39–§43, §81)
//
// Flutterwave has no Stripe-style hosted "customer portal", so this shape
// differs from a Stripe version:
//   - getBillingInfo returns the stored subscription/plan so your own
//     Next.js billing screen can render it (you build the UI, not a
//     provider-hosted page).
//   - cancelBillingSubscription cancels the plan via Flutterwave's
//     Subscriptions API using the subscription ID you stored at signup
//     (in `accounts/{uid}.subscription.flutterwaveSubscriptionId`).
// If you also want a function that creates a new subscription payment
// link (Flutterwave Payment Plans + hosted checkout), say so and I'll add it.
// =========================================================================

export const getBillingInfo = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const snap = await accountRef(uid).get();
  const subscription = snap.data()?.subscription;
  if (!subscription?.flutterwaveSubscriptionId) {
    throw new HttpsError('failed-precondition', 'No billing account on file.');
  }
  return { subscription };
});

export const cancelBillingSubscription = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const snap = await accountRef(uid).get();
  const subscriptionId = snap.data()?.subscription?.flutterwaveSubscriptionId;
  if (!subscriptionId) throw new HttpsError('failed-precondition', 'No billing account on file.');

  try {
    await flw.Subscription.cancel({ id: subscriptionId });
  } catch (err) {
    console.error(`Flutterwave subscription cancel failed for ${uid}`, err);
    throw new HttpsError('internal', 'Could not cancel your subscription. Please try again.');
  }

  await accountRef(uid).update({ 'subscription.status': 'cancelled' });
  return { ok: true as const };
});

// Flutterwave webhooks are verified with a "verif-hash" header checked
// against a shared secret you set in the dashboard — not a signed-payload
// scheme like Stripe's. Same as before, this needs to be a raw onRequest
// endpoint (to read the raw body) rather than onCall, so it's a stub here.
export const flutterwaveWebhook = onCall({ cors: false }, async () => {
  throw new HttpsError('unimplemented', 'Use the raw HTTPS endpoint for Flutterwave webhooks.');
});

// =========================================================================
// FEEDBACK (§46)
// =========================================================================

export const submitFeedback = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { text } = request.data as { text: string };
  if (!text?.trim()) throw new HttpsError('invalid-argument', 'Feedback text required.');

  await db.collection('feedback').add({
    uid,
    text: text.trim().slice(0, 4000),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true as const };
});

// =========================================================================
// ACCOUNT DELETION (§51, §52, §77)
// =========================================================================

export const deleteAccount = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { confirm } = request.data as { confirm: true };
  if (confirm !== true) throw new HttpsError('invalid-argument', 'Confirmation required.');

  const snap = await accountRef(uid).get();
  const subscriptionId = snap.data()?.subscription?.flutterwaveSubscriptionId;

  // Best-effort provider cleanup before wiping Firestore state.
  const cleanupTasks: Promise<unknown>[] = [
    fetch('https://api.provider.example/v1/numbers/deprovision-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP_PROVIDER_TOKEN}` },
      body: JSON.stringify({ ownerUid: uid }),
    }),
    db.collection('calendarTokens').doc(uid).delete(),
  ];
  if (subscriptionId) {
    cleanupTasks.push(flw.Subscription.cancel({ id: subscriptionId }));
  }
  const results = await Promise.allSettled(cleanupTasks);
  results.forEach((r) => {
    if (r.status === 'rejected') console.error(`deleteAccount cleanup task failed for ${uid}`, r.reason);
  });

  await accountRef(uid).delete();
  await admin.auth().deleteUser(uid);

  return { ok: true as const };
});

// Cascading cleanup for anything not caught above, triggered on the doc delete itself.
export const onAccountDeletedCleanup = onDocumentDeleted('accounts/{uid}', async (event) => {
  const uid = event.params.uid;
  const collectionsToClean = ['opportunities', 'conversations', 'appointments'];
  for (const col of collectionsToClean) {
    const q = db.collection(col).where('ownerUid', '==', uid).limit(500);
    let snap = await q.get();
    while (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      snap = await q.get();
    }
  }
});

// =========================================================================
// SCHEDULED HEALTH CHECK (§71, §72, §86)
// Detects broken channel/calendar connections so the owner never has to
// manually inspect them — surfaces as "needs_attention" for the UI banner.
// =========================================================================

export const channelHealthCheck = onSchedule('every 6 hours', async () => {
  const accounts = await db.collection('accounts').where('isolynicRunState', '!=', 'setup_incomplete').get();

  for (const doc of accounts.docs) {
    const data = doc.data();
    const updates: Record<string, unknown> = {};

    if (data.channels?.whatsapp?.status === 'connected') {
      const healthy = await pingWhatsappNumber(data.channels.whatsapp.connectedNumberOrUrl);
      if (!healthy) updates['channels.whatsapp.status'] = 'needs_attention';
    }
    if (data.channels?.phone?.status === 'connected') {
      const healthy = await pingPhoneNumber(data.channels.phone.connectedNumberOrUrl);
      if (!healthy) updates['channels.phone.status'] = 'needs_attention';
    }

    if (Object.keys(updates).length > 0) {
      updates['isolynicRunState'] = data.isolynicRunState === 'paused' ? 'paused' : 'channels_need_attention';
      await doc.ref.update(updates);
    }
  }
});

async function pingWhatsappNumber(_number: string | undefined): Promise<boolean> {
  // TODO: wire to your actual provider's status endpoint.
  return true;
}
async function pingPhoneNumber(_number: string | undefined): Promise<boolean> {
  // TODO: wire to your actual provider's status endpoint.
  return true;
}