import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

export type CustomerCurrentState =
  | "active"
  | "needs_attention"
  | "waiting"
  | "booked"
  | "recovered"
  | "completed"
  | "lost"
  | "none";

export interface CustomerRecord {
  businessId: string;
  displayName: string | null;
  phone: string | null;
  photoUrl: string | null;
  channels: { phone?: string; whatsapp?: string };
  preferredChannel: "whatsapp" | "phone" | "web" | "unknown";
  currentState: CustomerCurrentState;
  isCustomer: boolean;
  autoRecoveryBlocked: boolean;
  activeOpportunityIds: string[];
  appointmentIds: string[];
  conversationIds: string[];
  deletedAt: Timestamp | null;
  updatedAt: Timestamp;
}

const db = getFirestore();

/** Verifies the caller is an authenticated member of the business that owns
 * this customer record, and returns both docs for convenience. Every
 * callable below starts with this — no mutation trusts client-supplied
 * businessId. */
export async function requireOwnedCustomer(request: CallableRequest, customerId: string) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  if (!customerId || typeof customerId !== "string") {
    throw new HttpsError("invalid-argument", "customerId is required.");
  }

  const customerRef = db.collection("customers").doc(customerId);
  const snap = await customerRef.get();
  if (!snap.exists || snap.data()?.deletedAt) {
    throw new HttpsError("not-found", "Customer not found.");
  }

  const businessId = snap.data()!.businessId as string;
  const memberSnap = await db
    .collection("businesses")
    .doc(businessId)
    .collection("members")
    .doc(request.auth.uid)
    .get();

  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "You don't have access to this customer.");
  }

  return { customerRef, customerSnap: snap, businessId };
}

// ---------------------------------------------------------------------------
// Mark as not a customer (spec §35)
// ---------------------------------------------------------------------------
export const markCustomerNotACustomer = onCall(async (request) => {
  const { customerId } = request.data as { customerId: string };
  const { customerRef } = await requireOwnedCustomer(request, customerId);

  await customerRef.update({
    isCustomer: false,
    currentState: "none",
    autoRecoveryBlocked: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await customerRef.collection("timeline").add({
    type: "owner_took_over",
    actor: "you",
    headline: "Marked as not a customer",
    detail: null,
    occurredAt: FieldValue.serverTimestamp(),
    relatedOpportunityId: null,
  });

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Delete customer (spec §36) — soft delete + cascading cleanup of dependent
// collections' customer-facing linkage. Underlying message logs are only
// removed where the product's retention policy allows it (kept here as a
// scoped, resumable batched job rather than a promise of full erasure).
// ---------------------------------------------------------------------------
export const deleteCustomer = onCall(async (request) => {
  const { customerId } = request.data as { customerId: string };
  const { customerRef, businessId } = await requireOwnedCustomer(request, customerId);

  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.update(customerRef, {
      deletedAt: now,
      currentState: "none",
      autoRecoveryBlocked: true,
      updatedAt: now,
    });
  });

  // Detach dependent opportunities/appointments/conversations from active
  // surfaces (e.g. Recovery Queue) without silently deleting cross-linked
  // business records the customer doesn't exclusively own.
  const [opps, appts, convos] = await Promise.all([
    db.collection("opportunities").where("customerId", "==", customerId).where("businessId", "==", businessId).get(),
    db.collection("appointments").where("customerId", "==", customerId).get(),
    db.collection("conversations").where("customerId", "==", customerId).get(),
  ]);

  const batch = db.batch();
  opps.docs.forEach((d) => batch.update(d.ref, { state: "lost", customerDeleted: true }));
  appts.docs.forEach((d) => batch.update(d.ref, { status: "cancelled" }));
  convos.docs.forEach((d) => batch.update(d.ref, { customerDeleted: true }));
  await batch.commit();

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Merge customers (spec §68) — owner-confirmed only, never automatic.
// ---------------------------------------------------------------------------
export const mergeCustomers = onCall(async (request) => {
  const { primaryCustomerId, duplicateCustomerId } = request.data as {
    primaryCustomerId: string;
    duplicateCustomerId: string;
  };

  if (primaryCustomerId === duplicateCustomerId) {
    throw new HttpsError("invalid-argument", "Cannot merge a customer with itself.");
  }

  const { customerRef: primaryRef, businessId: primaryBiz } = await requireOwnedCustomer(request, primaryCustomerId);
  const { customerRef: dupRef, businessId: dupBiz } = await requireOwnedCustomer(request, duplicateCustomerId);

  if (primaryBiz !== dupBiz) {
    throw new HttpsError("failed-precondition", "Customers belong to different businesses.");
  }

  const [primarySnap, dupSnap] = await Promise.all([primaryRef.get(), dupRef.get()]);
  const primary = primarySnap.data()!;
  const dup = dupSnap.data()!;

  const mergedChannels = { ...dup.channels, ...primary.channels };
  const mergedOppIds = Array.from(new Set([...(primary.activeOpportunityIds ?? []), ...(dup.activeOpportunityIds ?? [])]));
  const mergedApptIds = Array.from(new Set([...(primary.appointmentIds ?? []), ...(dup.appointmentIds ?? [])]));
  const mergedConvoIds = Array.from(new Set([...(primary.conversationIds ?? []), ...(dup.conversationIds ?? [])]));

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  batch.update(primaryRef, {
    channels: mergedChannels,
    activeOpportunityIds: mergedOppIds,
    appointmentIds: mergedApptIds,
    conversationIds: mergedConvoIds,
    possibleDuplicateOf: null,
    identityConfidence: "confirmed",
    updatedAt: now,
  });
  batch.update(dupRef, { deletedAt: now, mergedInto: primaryCustomerId, updatedAt: now });

  // Re-point dependent records to the surviving customer.
  const [opps, appts, convos] = await Promise.all([
    db.collection("opportunities").where("customerId", "==", duplicateCustomerId).get(),
    db.collection("appointments").where("customerId", "==", duplicateCustomerId).get(),
    db.collection("conversations").where("customerId", "==", duplicateCustomerId).get(),
  ]);
  opps.docs.forEach((d) => batch.update(d.ref, { customerId: primaryCustomerId }));
  appts.docs.forEach((d) => batch.update(d.ref, { customerId: primaryCustomerId }));
  convos.docs.forEach((d) => batch.update(d.ref, { customerId: primaryCustomerId }));

  await batch.commit();

  await primaryRef.collection("timeline").add({
    type: "owner_took_over",
    actor: "you",
    headline: "Merged duplicate customer record",
    detail: null,
    occurredAt: now,
    relatedOpportunityId: null,
  });

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Edit customer identity (spec §34) — name, phone, preferred channel only.
// ---------------------------------------------------------------------------
export const editCustomerIdentity = onCall(async (request) => {
  const { customerId, updates } = request.data as {
    customerId: string;
    updates: { displayName?: string; phone?: string; preferredChannel?: "whatsapp" | "phone" | "web" };
  };
  const { customerRef } = await requireOwnedCustomer(request, customerId);

  const allowed: Record<string, unknown> = {};
  if (typeof updates?.displayName === "string") {
    const trimmed = updates.displayName.trim();
    if (trimmed.length > 120) throw new HttpsError("invalid-argument", "Name is too long.");
    allowed.displayName = trimmed || null;
  }
  if (typeof updates?.phone === "string") {
    const trimmed = updates.phone.trim();
    if (trimmed && !/^[+\d][\d\s()-]{4,20}$/.test(trimmed)) {
      throw new HttpsError("invalid-argument", "Phone number doesn't look valid.");
    }
    allowed.phone = trimmed || null;
  }
  if (updates?.preferredChannel) {
    if (!["whatsapp", "phone", "web"].includes(updates.preferredChannel)) {
      throw new HttpsError("invalid-argument", "Unknown channel.");
    }
    allowed.preferredChannel = updates.preferredChannel;
  }

  if (Object.keys(allowed).length === 0) {
    throw new HttpsError("invalid-argument", "No valid fields to update.");
  }

  allowed.updatedAt = FieldValue.serverTimestamp();
  await customerRef.update(allowed);

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Take over conversation (spec §37, §44) — pauses autonomous messaging.
// No confirmation needed: reversible, time-sensitive (spec §73).
// ---------------------------------------------------------------------------
export const takeOverConversation = onCall(async (request) => {
  const { customerId, opportunityId } = request.data as { customerId: string; opportunityId?: string };
  const { customerRef } = await requireOwnedCustomer(request, customerId);

  const now = FieldValue.serverTimestamp();
  await customerRef.update({ currentState: "active", updatedAt: now });

  if (opportunityId) {
    await db.collection("opportunities").doc(opportunityId).update({
      recoveryState: "stopped",
      lastActivityAt: now,
    });
  }

  await customerRef.collection("timeline").add({
    type: "owner_took_over",
    actor: "you",
    headline: "Took over the conversation",
    detail: "Autonomous customer messaging paused until resumed.",
    occurredAt: now,
    relatedOpportunityId: opportunityId ?? null,
  });

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Resume automatic recovery / "Let Isolynic help again" (spec §44)
// ---------------------------------------------------------------------------
export const resumeAutomaticRecovery = onCall(async (request) => {
  const { customerId, opportunityId } = request.data as { customerId: string; opportunityId: string };
  const { customerRef } = await requireOwnedCustomer(request, customerId);

  if (!opportunityId) throw new HttpsError("invalid-argument", "opportunityId is required.");

  const now = FieldValue.serverTimestamp();
  await db.collection("opportunities").doc(opportunityId).update({
    recoveryState: "in_progress",
    recoveryLastMessageAt: now,
    lastActivityAt: now,
  });
  await customerRef.update({ currentState: "waiting", updatedAt: now });

  await customerRef.collection("timeline").add({
    type: "recovery_started",
    actor: "isolynic",
    headline: "Recovery started",
    detail: null,
    occurredAt: now,
    relatedOpportunityId: opportunityId,
  });

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Stop recovery (spec §42) — owner can halt an in-progress recovery attempt.
// ---------------------------------------------------------------------------
export const stopRecovery = onCall(async (request) => {
  const { customerId, opportunityId } = request.data as { customerId: string; opportunityId: string };
  const { customerRef } = await requireOwnedCustomer(request, customerId);

  if (!opportunityId) throw new HttpsError("invalid-argument", "opportunityId is required.");

  const now = FieldValue.serverTimestamp();
  await db.collection("opportunities").doc(opportunityId).update({
    recoveryState: "stopped",
    lastActivityAt: now,
  });
  await customerRef.update({ currentState: "active", updatedAt: now });

  await customerRef.collection("timeline").add({
    type: "owner_took_over",
    actor: "you",
    headline: "Stopped automatic recovery",
    detail: null,
    occurredAt: now,
    relatedOpportunityId: opportunityId,
  });

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Block / unblock automatic messages (spec §69) — confirmation required.
// ---------------------------------------------------------------------------
export const setAutoRecoveryBlocked = onCall(async (request) => {
  const { customerId, blocked } = request.data as { customerId: string; blocked: boolean };
  const { customerRef } = await requireOwnedCustomer(request, customerId);

  await customerRef.update({ autoRecoveryBlocked: Boolean(blocked), updatedAt: FieldValue.serverTimestamp() });

  await customerRef.collection("timeline").add({
    type: "owner_took_over",
    actor: "you",
    headline: blocked ? "Turned off automatic messages" : "Turned on automatic messages",
    detail: null,
    occurredAt: FieldValue.serverTimestamp(),
    relatedOpportunityId: null,
  });

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Confirm or ignore a smart suggestion (spec §29)
// ---------------------------------------------------------------------------
export const confirmSmartSuggestion = onCall(async (request) => {
  const { customerId, suggestionId, accept } = request.data as {
    customerId: string;
    suggestionId: string;
    accept: boolean;
  };
  const { customerRef } = await requireOwnedCustomer(request, customerId);

  const suggestionRef = customerRef.collection("smartSuggestions").doc(suggestionId);
  const suggestionSnap = await suggestionRef.get();
  if (!suggestionSnap.exists) {
    throw new HttpsError("not-found", "Suggestion not found.");
  }
  const suggestion = suggestionSnap.data()!;

  if (!accept) {
    await suggestionRef.update({ status: "ignored" });
    return { ok: true as const };
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.update(suggestionRef, { status: "saved" });

  if (suggestion.kind === "note") {
    const noteRef = customerRef.collection("notes").doc();
    batch.set(noteRef, { text: suggestion.proposedValue, createdBy: "owner", createdAt: now });
  } else if (suggestion.kind === "preferred_channel") {
    batch.update(customerRef, { preferredChannel: suggestion.proposedValue, updatedAt: now });
  } else if (suggestion.kind === "preferred_time") {
    batch.update(customerRef, { "preferences.communicationTime": suggestion.proposedValue, updatedAt: now });
  }

  await batch.commit();
  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Send a message (spec §12, §74) — owner-authored, always an explicit send.
// Queues onto the appropriate channel; delivery is handled by an existing
// messaging integration (WhatsApp/etc.) outside this function's scope.
// ---------------------------------------------------------------------------
export const sendCustomerMessage = onCall(async (request) => {
  const { customerId, opportunityId, text } = request.data as {
    customerId: string;
    opportunityId: string | null;
    text: string;
  };
  const { customerRef, customerSnap } = await requireOwnedCustomer(request, customerId);

  const trimmed = (text ?? "").trim();
  if (!trimmed) throw new HttpsError("invalid-argument", "Message text is required.");
  if (trimmed.length > 4000) throw new HttpsError("invalid-argument", "Message is too long.");

  const customer = customerSnap.data()!;
  const channel: "whatsapp" | "phone" | "web" | null = customer.channels?.whatsapp
    ? "whatsapp"
    : customer.channels?.phone
    ? "phone"
    : null;
  if (!channel) {
    throw new HttpsError("failed-precondition", "We don't have a messaging channel for this customer yet.");
  }

  const now = FieldValue.serverTimestamp();
  const outboundRef = db.collection("outboundMessages").doc();
  await outboundRef.set({
    customerId,
    opportunityId: opportunityId ?? null,
    channel,
    text: trimmed,
    author: "you",
    status: "queued",
    createdAt: now,
  });

  await customerRef.update({ lastContactedAt: now, updatedAt: now });

  return { ok: true as const, queued: true as const };
});

/** Translates opportunity state transitions into the plain-language
 * timeline events described in spec §21–23. Runs server-side so the
 * client never has to (and never could accidentally) fabricate history. */
export const onOpportunityWriteBuildTimeline = onDocumentUpdated(
  "opportunities/{opportunityId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.state === after.state && before.recoveryState === after.recoveryState) return;

    const customerRef = db.collection("customers").doc(after.customerId);
    const timelineRef = customerRef.collection("timeline");
    const now = FieldValue.serverTimestamp();

    if (before.recoveryState !== "in_progress" && after.recoveryState === "in_progress") {
      await timelineRef.add({
        type: "recovery_started",
        actor: "isolynic",
        headline: "Recovery started",
        detail: null,
        occurredAt: now,
        relatedOpportunityId: event.params.opportunityId,
      });
    }

    if (after.state === "booked" && before.state !== "booked") {
      await Promise.all([
        timelineRef.add({
          type: after.recoveryState === "in_progress" ? "recovery_succeeded" : "appointment_created",
          actor: after.recoveryState === "in_progress" ? "isolynic" : "customer",
          headline: after.recoveryState === "in_progress" ? "Customer returned and booked" : "Appointment booked",
          detail: null,
          occurredAt: now,
          relatedOpportunityId: event.params.opportunityId,
        }),
        customerRef.update({
          currentState: after.recoveryState === "in_progress" ? "recovered" : "booked",
          updatedAt: now,
        }),
      ]);
    }

    if (after.state === "lost" && before.state !== "lost") {
      await Promise.all([
        timelineRef.add({
          type: "opportunity_lost",
          actor: "system",
          headline: "Opportunity marked lost",
          detail: null,
          occurredAt: now,
          relatedOpportunityId: event.params.opportunityId,
        }),
        customerRef.update({ currentState: "lost", updatedAt: now }),
      ]);
    }

    if (after.state === "completed" && before.state !== "completed") {
      await Promise.all([
        timelineRef.add({
          type: "appointment_completed",
          actor: "system",
          headline: "Request completed",
          detail: null,
          occurredAt: now,
          relatedOpportunityId: event.params.opportunityId,
        }),
        customerRef.update({ currentState: "completed", updatedAt: now }),
      ]);
    }
  }
);

/** New appointment => timeline entry + link on the customer doc. */
export const onAppointmentCreatedBuildTimeline = onDocumentCreated(
  "appointments/{appointmentId}",
  async (event) => {
    const appt = event.data?.data();
    if (!appt) return;

    const customerRef = db.collection("customers").doc(appt.customerId);
    const now = FieldValue.serverTimestamp();

    await Promise.all([
      customerRef.collection("timeline").add({
        type: "appointment_created",
        actor: "system",
        headline: "Appointment created",
        detail: appt.title ?? null,
        occurredAt: now,
        relatedOpportunityId: appt.opportunityId ?? null,
      }),
      customerRef.update({
        appointmentIds: FieldValue.arrayUnion(event.params.appointmentId),
        updatedAt: now,
      }),
    ]);
  }
);

/** Appointment status/time change => timeline entry (spec §22). */
export const onAppointmentUpdatedBuildTimeline = onDocumentUpdated(
  "appointments/{appointmentId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status && before.startsAt?.isEqual?.(after.startsAt)) return;

    const customerRef = db.collection("customers").doc(after.customerId);
    const now = FieldValue.serverTimestamp();

    const headline =
      after.status === "cancelled"
        ? "Appointment cancelled"
        : after.status === "completed"
        ? "Appointment completed"
        : "Appointment changed";

    await customerRef.collection("timeline").add({
      type: after.status === "completed" ? "appointment_completed" : "appointment_changed",
      actor: "system",
      headline,
      detail: null,
      occurredAt: now,
      relatedOpportunityId: after.opportunityId ?? null,
    });
  }
);

/** Inbound/outbound message => lightweight "contacted" timeline entry.
 * Keeps the full thread on Screen 5 while giving Screen 6 a memory trail. */
export const onMessageCreatedBuildTimeline = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const conversationSnap = await db.collection("conversations").doc(event.params.conversationId).get();
    if (!conversationSnap.exists) return;
    const customerId = conversationSnap.data()!.customerId as string;
    const customerRef = db.collection("customers").doc(customerId);
    const now = FieldValue.serverTimestamp();

    const type =
      message.author === "customer" ? "customer_contacted" : message.author === "isolynic" ? "isolynic_contacted" : "owner_contacted";
    const headline =
      message.author === "customer" ? "Customer sent a message" : message.author === "isolynic" ? "Isolynic followed up" : "You sent a message";

    await Promise.all([
      customerRef.collection("timeline").add({
        type,
        actor: message.author,
        headline,
        detail: null,
        occurredAt: now,
        relatedOpportunityId: null,
      }),
      customerRef.update({
        lastContactedAt: now,
        updatedAt: now,
        ...(message.author === "customer" ? { currentState: "needs_attention" } : {}),
      }),
    ]);
  }
);