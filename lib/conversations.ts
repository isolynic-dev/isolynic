
// lib/conversation/actions.ts

"use client";

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export async function sendOwnerMessage(conversationId: string, body: string) {
  const fn = httpsCallable(functions, "sendOwnerMessage");
  return fn({ conversationId, body });
}

export async function takeOverConversation(conversationId: string) {
  const fn = httpsCallable(functions, "takeOverConversation");
  return fn({ conversationId });
}

export async function releaseConversationToIsolynic(conversationId: string) {
  const fn = httpsCallable(functions, "releaseConversationToIsolynic");
  return fn({ conversationId });
}

export async function requestReplySuggestion(conversationId: string) {
  const fn = httpsCallable<{ conversationId: string }, { suggestion: string | null }>(
    functions,
    "suggestReply"
  );
  const result = await fn({ conversationId });
  return result.data.suggestion;
}

export async function markNotOpportunity(conversationId: string) {
  const fn = httpsCallable(functions, "markNotOpportunity");
  return fn({ conversationId });
}

export async function closeConversation(conversationId: string, reason: string) {
  const fn = httpsCallable(functions, "closeConversation");
  return fn({ conversationId, reason });
}

export async function reopenConversation(conversationId: string) {
  const fn = httpsCallable(functions, "reopenConversation");
  return fn({ conversationId });
}

export async function createBooking(
  conversationId: string,
  startTimeIso: string,
  endTimeIso: string,
  timezone: string
) {
  const fn = httpsCallable(functions, "createBooking");
  return fn({ conversationId, startTimeIso, endTimeIso, timezone });
}

export async function getAvailableSlots(conversationId: string, dateIso: string) {
  const fn = httpsCallable<
    { conversationId: string; dateIso: string },
    { slots: { startIso: string; endIso: string }[] }
  >(functions, "getAvailableSlots");
  const result = await fn({ conversationId, dateIso });
  return result.data.slots;
}

export async function resolveIdentityMatch(
  conversationId: string,
  decision: "merge" | "keep_separate"
) {
  const fn = httpsCallable(functions, "resolveIdentityMatch");
  return fn({ conversationId, decision });
}

export async function addPrivateNote(conversationId: string, body: string) {
  const fn = httpsCallable(functions, "addPrivateNote");
  return fn({ conversationId, body });
}

export async function deleteConversation(conversationId: string) {
  const fn = httpsCallable(functions, "deleteConversationRequest");
  return fn({ conversationId });
}

export async function retryFailedMessage(conversationId: string, messageId: string) {
  const fn = httpsCallable(functions, "retryFailedMessage");
  return fn({ conversationId, messageId });
}