// lib/accountService.ts

import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type {
  AccountState,
  BusinessInfo,
  BusinessHoursState,
  RecoveryPreferencesState,
  NotificationsState,
  CalendarState,
} from '@/types/account';

type Channel = 'whatsapp' | 'phone' | 'website';

// No-argument callables use this instead of `{}`, which structurally
// matches almost any object and defeats the purpose of typing the call.
type NoArgs = Record<string, never>;

// ---------------------------------------------------------------------------
// Named request/response shapes for every callable.
// ---------------------------------------------------------------------------

type OkResponse = { ok: true };
type TestResponse = { ok: boolean; message: string };

type DisconnectChannelRequest = { channel: Channel };
type TestChannelRequest = { channel: Channel };

type StartCalendarConnectRequest = { redirectUri: string };
type StartCalendarConnectResponse = { authUrl: string };

type CreateBillingPortalSessionRequest = { returnUrl: string };
type CreateBillingPortalSessionResponse = { url: string };

type DeleteAccountRequest = { confirm: true };

type SubmitFeedbackRequest = { text: string };

const accountDocRef = (uid: string) => doc(db, 'accounts', uid);

// ---------------------------------------------------------------------------
// Realtime subscription
// ---------------------------------------------------------------------------

export function subscribeToAccount(uid: string, onChange: (state: AccountState | null) => void, onError: (err: Error) => void): Unsubscribe {
  return onSnapshot(
    accountDocRef(uid),
    (snap) => onChange(snap.exists() ? (snap.data() as AccountState) : null),
    (err) => onError(err)
  );
}

// ---------------------------------------------------------------------------
// Simple field-level writes (immediate save per §58)
// ---------------------------------------------------------------------------

function toDotPaths<T extends object>(prefix: string, partial: Partial<T>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(partial).map(([key, value]) => [`${prefix}.${key}`, value])
  );
}

export async function updateBusinessInfo(uid: string, business: Partial<BusinessInfo>): Promise<void> {
  await updateDoc(accountDocRef(uid), {
    ...toDotPaths<BusinessInfo>('business', business),
    'business.updatedAt': serverTimestamp(),
  });
}

export async function updateBusinessHours(uid: string, hours: BusinessHoursState): Promise<void> {
  await updateDoc(accountDocRef(uid), { hours });
}

export async function updateCalendarPrefs(uid: string, calendar: Partial<CalendarState>): Promise<void> {
  await updateDoc(accountDocRef(uid), toDotPaths<CalendarState>('calendar', calendar));
}

export async function updateRecoveryPreferences(uid: string, recovery: Partial<RecoveryPreferencesState>): Promise<void> {
  await updateDoc(accountDocRef(uid), toDotPaths<RecoveryPreferencesState>('recovery', recovery));
}

export async function updateNotifications(uid: string, notifications: Partial<NotificationsState>): Promise<void> {
  await updateDoc(accountDocRef(uid), toDotPaths<NotificationsState>('notifications', notifications));
}

// ---------------------------------------------------------------------------
// Callable Cloud Functions (anything that touches provider infra)
// ---------------------------------------------------------------------------

type DisconnectChannelCallable = HttpsCallable<DisconnectChannelRequest, OkResponse>;
export const callDisconnectChannel: DisconnectChannelCallable = httpsCallable(functions, 'disconnectChannel');

type TestChannelCallable = HttpsCallable<TestChannelRequest, TestResponse>;
export const callTestChannel: TestChannelCallable = httpsCallable(functions, 'testChannel');

type StartCalendarConnectCallable = HttpsCallable<StartCalendarConnectRequest, StartCalendarConnectResponse>;
export const callStartCalendarConnect: StartCalendarConnectCallable = httpsCallable(functions, 'startCalendarConnect');

type DisconnectCalendarCallable = HttpsCallable<NoArgs, OkResponse>;
export const callDisconnectCalendar: DisconnectCalendarCallable = httpsCallable(functions, 'disconnectCalendar');

type TestCalendarEventCallable = HttpsCallable<NoArgs, TestResponse>;
export const callTestCalendarEvent: TestCalendarEventCallable = httpsCallable(functions, 'testCalendarEvent');

type PauseIsolynicCallable = HttpsCallable<NoArgs, OkResponse>;
export const callPauseIsolynic: PauseIsolynicCallable = httpsCallable(functions, 'pauseIsolynic');

type ResumeIsolynicCallable = HttpsCallable<NoArgs, OkResponse>;
export const callResumeIsolynic: ResumeIsolynicCallable = httpsCallable(functions, 'resumeIsolynic');

type CreateBillingPortalSessionCallable = HttpsCallable<CreateBillingPortalSessionRequest, CreateBillingPortalSessionResponse>;
export const callCreateBillingPortalSession: CreateBillingPortalSessionCallable = httpsCallable(functions, 'createBillingPortalSession');

type DeleteAccountCallable = HttpsCallable<DeleteAccountRequest, OkResponse>;
export const callDeleteAccount: DeleteAccountCallable = httpsCallable(functions, 'deleteAccount');

type SubmitFeedbackCallable = HttpsCallable<SubmitFeedbackRequest, OkResponse>;
export const callSubmitFeedback: SubmitFeedbackCallable = httpsCallable(functions, 'submitFeedback');