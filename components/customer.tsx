
// components/customer/Avatar.tsx
"use client";

import { useMemo } from "react";
import { Avatar } from "./Avatar";
import type { CustomerDoc, OpportunityDoc } from "@/types/customer";
import type { ConversationDoc, MessagePreviewDoc } from "@/types/customer";
import type { TimelineEventDoc } from "@/types/customer";
import type { AppointmentDoc } from "@/types/customer";
import type { CustomerNoteDoc, SmartSuggestionDoc } from "@/types/customer";
import { createNote } from "@/lib/firebase";
import { confirmSmartSuggestion } from "@/lib/firebase";
import { useEffect, useRef, useState } from "react";
import { editCustomerIdentity } from "@/lib/firebase";




interface AvatarProps {
  name: string | null;
  photoUrl: string | null;
  size?: number;
}

function getInitials(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Three states per spec §9: real photo, initials, or generic person icon. */
export function Avatar({ name, photoUrl, size = 56 }: AvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const style = { width: size, height: size };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        role="presentation"
        style={style}
        className="rounded-full object-cover bg-neutral-200"
      />
    );
  }

  if (initials) {
    return (
      <div
        style={style}
        aria-hidden="true"
        className="rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold"
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      style={style}
      aria-hidden="true"
      className="rounded-full bg-neutral-200 text-neutral-500 flex items-center justify-center"
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
      </svg>
    </div>
  );
}




// components/customer/ConfirmDialog.tsx


interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Used for every "confirmation required" action in spec §73:
 * delete customer, disable automatic recovery, mark not a customer. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-neutral-900">
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="mt-2 text-sm text-neutral-600">
          {description}
        </p>
        <div className="mt-5 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 min-h-[44px]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white min-h-[44px] ${
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
            } disabled:opacity-60`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}



// components/customer/Skeletons.tsx
export function IdentitySkeleton() {
  return (
    <div className="flex items-center gap-4 animate-pulse" aria-hidden="true">
      <div className="w-14 h-14 rounded-full bg-neutral-200" />
      <div className="space-y-2">
        <div className="h-4 w-32 bg-neutral-200 rounded" />
        <div className="h-3 w-24 bg-neutral-200 rounded" />
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2 rounded-xl border border-neutral-200 p-4" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-neutral-200 rounded" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}




// components/customer/CustomerIdentity.tsx



function formatChannel(channel: CustomerDoc["preferredChannel"]): string | null {
  switch (channel) {
    case "whatsapp":
      return "WhatsApp";
    case "phone":
      return "Phone";
    case "web":
      return "Web";
    default:
      return null;
  }
}

function formatRelativeTime(ms: number | null): string | null {
  if (ms === null) return null;
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface CustomerIdentityProps {
  customer: CustomerDoc;
}

/** Spec §8–10: name, contact, channel, last-activity; graceful degradation
 * for unknown/partial identity (§55); "possibly the same customer" for
 * unresolved identity matches rather than silent merging (§10). */
export function CustomerIdentity({ customer }: CustomerIdentityProps) {
  const name = customer.displayName ?? "Unknown customer";
  const lastContacted = formatRelativeTime(
    customer.lastContactedAt ? customer.lastContactedAt.toMillis() : null
  );
  const channelLabel = formatChannel(customer.preferredChannel);

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar name={customer.displayName} photoUrl={customer.photoUrl} />
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{name}</h1>
          {customer.phone && <p className="text-sm text-neutral-600">{customer.phone}</p>}
          {channelLabel && <p className="text-sm text-neutral-500">{channelLabel}</p>}
        </div>
      </div>

      {lastContacted && (
        <p className="mt-2 text-xs text-neutral-500">Last contacted {lastContacted}</p>
      )}

      {customer.identityConfidence === "uncertain" && customer.possibleDuplicateOf && (
        <div
          role="status"
          className="mt-3 rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2"
        >
          Possibly the same customer as another record.
        </div>
      )}
    </div>
  );
}



// components/customer/CustomerActions.tsx



interface CustomerActionsProps {
  customer: CustomerDoc;
  activeOpportunities: OpportunityDoc[];
  onMessage: () => void;
  onCall: () => void;
  onViewOpportunity: () => void;
}

/** Spec §11–14: Message / Call / View opportunity. The most prominent
 * action reflects context (waiting on the owner => Message is emphasized). */
export function CustomerActions({
  customer,
  activeOpportunities,
  onMessage,
  onCall,
  onViewOpportunity,
}: CustomerActionsProps) {
  const hasChannel = Boolean(customer.channels.whatsapp || customer.channels.phone);
  const hasPhoneForCall = Boolean(customer.phone || customer.channels.phone);
  const messageIsPrimary = customer.currentState === "needs_attention" || customer.currentState === "waiting";

  const oppLabel =
    activeOpportunities.length === 0
      ? null
      : activeOpportunities.length === 1
      ? "View opportunity"
      : `${activeOpportunities.length} active opportunities`;

  const buttonBase =
    "min-h-[48px] px-4 rounded-xl text-sm font-medium flex-1 flex items-center justify-center gap-2 transition-colors";

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onMessage}
        disabled={!hasChannel}
        aria-label="Message customer"
        className={`${buttonBase} ${
          messageIsPrimary
            ? "bg-indigo-600 text-white hover:bg-indigo-700"
            : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Message
      </button>

      <button
        type="button"
        onClick={onCall}
        disabled={!hasPhoneForCall}
        aria-label="Call customer"
        className={`${buttonBase} bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Call
      </button>

      {oppLabel && (
        <button
          type="button"
          onClick={onViewOpportunity}
          className={`${buttonBase} bg-neutral-100 text-neutral-800 hover:bg-neutral-200`}
        >
          {oppLabel}
        </button>
      )}
    </div>
  );
}



// components/customer/CurrentSituationCard.tsx



interface CurrentSituationCardProps {
  customer: CustomerDoc;
  primaryOpportunity: OpportunityDoc | null;
  onRecoverNow: () => void;
  onHandleMyself: () => void;
  onStopRecovery: () => void;
  onViewConversation: () => void;
  onLetIsolynicHelpAgain: () => void;
}

const toneStyles: Record<string, string> = {
  neutral: "bg-neutral-50 border-neutral-200 text-neutral-800",
  attention: "bg-amber-50 border-amber-200 text-amber-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  warning: "bg-orange-50 border-orange-200 text-orange-900",
};

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Spec §15–17, §41–44: the most important section on the screen. Every
 * state renders as plain language — never a confidence score (§17, §97). */
export function CurrentSituationCard({
  customer,
  primaryOpportunity,
  onRecoverNow,
  onHandleMyself,
  onStopRecovery,
  onViewConversation,
  onLetIsolynicHelpAgain,
}: CurrentSituationCardProps) {
  const state = customer.currentState;

  const buttonClass =
    "min-h-[48px] px-4 rounded-xl text-sm font-medium flex-1 flex items-center justify-center";

  if (state === "none") {
    return (
      <div className={`rounded-xl border p-4 ${toneStyles.neutral}`} role="status">
        <p className="font-medium">Nothing needs your attention</p>
        <p className="text-sm mt-1 opacity-80">This customer has no active opportunity right now.</p>
      </div>
    );
  }

  if (state === "needs_attention") {
    return (
      <div className={`rounded-xl border p-4 ${toneStyles.attention}`} role="status" aria-live="polite">
        <p className="font-medium">May be slipping away</p>
        {primaryOpportunity?.whyFlagged && (
          <p className="text-sm mt-1">{primaryOpportunity.whyFlagged}</p>
        )}
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={onRecoverNow} className={`${buttonClass} bg-amber-600 text-white hover:bg-amber-700`}>
            Recover now
          </button>
          <button type="button" onClick={onHandleMyself} className={`${buttonClass} bg-white text-amber-900 border border-amber-300 hover:bg-amber-100`}>
            Handle myself
          </button>
        </div>
      </div>
    );
  }

  if (state === "waiting") {
    if (primaryOpportunity?.recoveryState === "in_progress") {
      const lastMsg = primaryOpportunity.recoveryLastMessageAt
        ? formatRelative(primaryOpportunity.recoveryLastMessageAt.toMillis())
        : null;
      return (
        <div className={`rounded-xl border p-4 ${toneStyles.attention}`} role="status">
          <p className="font-medium">We're trying to bring this customer back.</p>
          {lastMsg && <p className="text-sm mt-1">Last message sent {lastMsg}.</p>}
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={onViewConversation} className={`${buttonClass} bg-white text-amber-900 border border-amber-300 hover:bg-amber-100`}>
              View conversation
            </button>
            <button type="button" onClick={onStopRecovery} className={`${buttonClass} bg-neutral-100 text-neutral-800 hover:bg-neutral-200`}>
              Stop recovery
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className={`rounded-xl border p-4 ${toneStyles.neutral}`} role="status">
        <p className="font-medium">You're waiting for the customer.</p>
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className={`rounded-xl border p-4 ${toneStyles.neutral}`} role="status">
        <p className="font-medium">You're currently helping this customer.</p>
      </div>
    );
  }

  if (state === "booked") {
    return (
      <div className={`rounded-xl border p-4 ${toneStyles.success}`} role="status">
        <p className="font-medium">Booked</p>
        <p className="text-sm mt-1 opacity-90">Appointment booked.</p>
      </div>
    );
  }

  if (state === "recovered") {
    return (
      <div className={`rounded-xl border p-4 ${toneStyles.success}`} role="status">
        <p className="font-medium">Recovered</p>
        <p className="text-sm mt-1 opacity-90">Isolynic helped bring this customer back.</p>
      </div>
    );
  }

  if (state === "completed") {
    return (
      <div className={`rounded-xl border p-4 ${toneStyles.neutral}`} role="status">
        <p className="font-medium">This customer's request is complete.</p>
      </div>
    );
  }

  // lost
  return (
    <div className={`rounded-xl border p-4 ${toneStyles.neutral}`} role="status">
      <p className="font-medium">This opportunity ended without a booking.</p>
    </div>
  );
}

// components/customer/OpportunitySummary.tsx



function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function stateLabel(state: OpportunityDoc["state"]): string {
  switch (state) {
    case "new":
      return "New";
    case "waiting_for_customer":
      return "Waiting for customer";
    case "waiting_for_owner":
      return "Waiting for you";
    case "recovering":
      return "Recovery in progress";
    case "booked":
      return "Booked";
    case "completed":
      return "Completed";
    case "lost":
      return "Lost";
  }
}

function formatValue(opp: OpportunityDoc): string {
  if (opp.bookedValue !== null) {
    return `${opp.currency} ${opp.bookedValue.toLocaleString()}`;
  }
  if (opp.estimatedValueMin !== null && opp.estimatedValueMax !== null) {
    return `Estimated opportunity: ${opp.currency} ${opp.estimatedValueMin.toLocaleString()}–${opp.estimatedValueMax.toLocaleString()}`;
  }
  return "Value not recorded";
}

interface OpportunitySummaryProps {
  opportunities: OpportunityDoc[];
  onView: (opportunityId: string) => void;
}

/** Spec §18, §76: compact opportunity summary — never a collapsed "customer
 * value", each opportunity keeps its own value. */
export function OpportunitySummary({ opportunities, onView }: OpportunitySummaryProps) {
  if (opportunities.length === 0) return null;

  return (
    <section aria-labelledby="opportunity-heading" className="rounded-xl border border-neutral-200 p-4">
      <h2 id="opportunity-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {opportunities.length > 1 ? "Active opportunities" : "Active opportunity"}
      </h2>
      <ul className="mt-2 space-y-3">
        {opportunities.map((opp) => (
          <li key={opp.id}>
            <p className="font-medium text-neutral-900">{opp.title}</p>
            <p className="text-sm text-neutral-600">{stateLabel(opp.state)}</p>
            <p className="text-xs text-neutral-500 mt-1">
              Started {formatDate(opp.startedAt.toMillis())} · Last activity{" "}
              {formatDate(opp.lastActivityAt.toMillis())}
            </p>
            <p className="text-xs text-neutral-500">{formatValue(opp)}</p>
            <button
              type="button"
              onClick={() => onView(opp.id)}
              className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View opportunity
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}



// components/customer/ConversationPreview.tsx


const authorLabel: Record<MessagePreviewDoc["author"], string> = {
  you: "You",
  customer: "Customer",
  isolynic: "Isolynic",
  system: "System",
};

interface ConversationPreviewProps {
  conversation: ConversationDoc | null;
  messages: MessagePreviewDoc[];
  onViewFull: () => void;
}

/** Spec §19–20, §38: recent messages only, actor always labeled explicitly
 * (never color-only) so it's clear who said what. */
export function ConversationPreview({ conversation, messages, onViewFull }: ConversationPreviewProps) {
  return (
    <section aria-labelledby="conversation-heading" className="rounded-xl border border-neutral-200 p-4">
      <h2 id="conversation-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Recent conversation
      </h2>

      {!conversation || messages.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No previous conversation yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="text-sm">
              <span className="font-medium text-neutral-800">{authorLabel[m.author]}: </span>
              <span className="text-neutral-700">{m.text}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onViewFull}
        disabled={!conversation}
        className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-neutral-300 disabled:cursor-not-allowed"
      >
        View full conversation
      </button>
    </section>
  );
}



// components/customer/Timeline.tsx



const actorLabel: Record<TimelineEventDoc["actor"], string> = {
  you: "You",
  customer: "Customer",
  isolynic: "Isolynic",
  system: "System",
};

function formatDay(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "Today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface TimelineProps {
  events: TimelineEventDoc[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

/** Spec §21–23, §86: natural-language, grouped-by-day history with
 * pagination — never implementation terminology, never unlimited history. */
export function Timeline({ events, hasMore, loadingMore, onLoadMore }: TimelineProps) {
  if (events.length === 0) {
    return (
      <section aria-labelledby="history-heading" className="rounded-xl border border-neutral-200 p-4">
        <h2 id="history-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          History
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          No previous history. This is your first recorded interaction with this customer.
        </p>
      </section>
    );
  }

  let lastDay = "";

  return (
    <section aria-labelledby="history-heading" className="rounded-xl border border-neutral-200 p-4">
      <h2 id="history-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        History
      </h2>
      <ol className="mt-3 space-y-3">
        {events.map((event) => {
          const day = formatDay(event.occurredAt.toMillis());
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <li key={event.id}>
              {showDay && <p className="text-xs font-semibold text-neutral-400 mb-1">{day}</p>}
              <p className="text-sm font-medium text-neutral-800">
                <span className="text-neutral-500">{actorLabel[event.actor]} · </span>
                {event.headline}
              </p>
              {event.detail && <p className="text-sm text-neutral-600">{event.detail}</p>}
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load earlier history"}
        </button>
      )}
    </section>
  );
}



// components/customer/AppointmentSummary.tsx

function formatDateTime(ms: number): string {
  const date = new Date(ms);
  const dateStr = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${timeStr}`;
}

function statusLabel(status: AppointmentDoc["status"]): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "pending":
      return "Pending confirmation";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
  }
}

interface AppointmentSummaryProps {
  appointments: AppointmentDoc[];
  onView: (id: string) => void;
  onChange: (id: string) => void;
  onCancel: (id: string) => void;
  onViewAll: () => void;
}

/** Spec §24–25: next appointment first; "View N appointments" if more than one. */
export function AppointmentSummary({ appointments, onView, onChange, onCancel, onViewAll }: AppointmentSummaryProps) {
  return (
    <section aria-labelledby="appointments-heading" className="rounded-xl border border-neutral-200 p-4">
      <h2 id="appointments-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Appointments
      </h2>

      {appointments.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No appointments yet.</p>
      ) : (
        <>
          <div className="mt-2">
            <p className="font-medium text-neutral-900">{formatDateTime(appointments[0].startsAt.toMillis())}</p>
            <p className="text-sm text-neutral-600">{appointments[0].title}</p>
            <p className="text-sm text-neutral-500">{statusLabel(appointments[0].status)}</p>
            <div className="mt-2 flex gap-4">
              <button type="button" onClick={() => onView(appointments[0].id)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View
              </button>
              <button type="button" onClick={() => onChange(appointments[0].id)} className="text-sm font-medium text-neutral-600 hover:text-neutral-800">
                Change
              </button>
              <button type="button" onClick={() => onCancel(appointments[0].id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                Cancel
              </button>
            </div>
          </div>

          {appointments.length > 1 && (
            <button type="button" onClick={onViewAll} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View {appointments.length} appointments
            </button>
          )}
        </>
      )}
    </section>
  );
}



// components/customer/CustomerNotes.tsx


interface CustomerNotesProps {
  customerId: string;
  notes: CustomerNoteDoc[];
  pendingSuggestions: SmartSuggestionDoc[];
}

/** Spec §27–30: plain-text notes only, no custom fields; smart suggestions
 * require explicit Save/Ignore rather than silently becoming fact (§29). */
export function CustomerNotes({ customerId, notes, pendingSuggestions }: CustomerNotesProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionBusy, setSuggestionBusy] = useState<string | null>(null);

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createNote(customerId, draft);
      setDraft("");
      setAdding(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggestion(suggestion: SmartSuggestionDoc, accept: boolean) {
    setSuggestionBusy(suggestion.id);
    try {
      await confirmSmartSuggestion(customerId, suggestion.id, accept);
    } finally {
      setSuggestionBusy(null);
    }
  }

  return (
    <section aria-labelledby="notes-heading" className="rounded-xl border border-neutral-200 p-4">
      <h2 id="notes-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Notes
      </h2>

      {pendingSuggestions.map((s) => (
        <div key={s.id} className="mt-2 rounded-lg bg-indigo-50 text-indigo-900 text-sm p-3">
          <p>We noticed: {s.summary}</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => handleSuggestion(s, true)}
              disabled={suggestionBusy === s.id}
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
            >
              Save to customer
            </button>
            <button
              type="button"
              onClick={() => handleSuggestion(s, false)}
              disabled={suggestionBusy === s.id}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              Ignore
            </button>
          </div>
        </div>
      ))}

      {notes.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Nothing to remember yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="text-sm text-neutral-700">
              {n.text}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write something you'll want to remember…"
            maxLength={1000}
            rows={3}
            className="w-full rounded-lg border border-neutral-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="min-h-[44px] px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft("");
                setError(null);
              }}
              disabled={saving}
              className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Add a note
        </button>
      )}

      {justSaved && (
        <p role="status" className="mt-2 text-sm text-emerald-600">
          Saved
        </p>
      )}
    </section>
  );
}



// components/customer/CustomerMenu.tsx



interface CustomerMenuProps {
  autoRecoveryBlocked: boolean;
  onEdit: () => void;
  onMarkNotCustomer: () => void;
  onDelete: () => void;
  onToggleBlockMessages: () => void;
}

/** Spec §33–36, §69: deliberately tiny — Edit, Mark as not a customer,
 * Delete, and (optionally) Block messages. No technical controls. */
export function CustomerMenu({
  autoRecoveryBlocked,
  onEdit,
  onMarkNotCustomer,
  onDelete,
  onToggleBlockMessages,
}: CustomerMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        onClick={() => setOpen((o) => !o)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-neutral-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-200 bg-white shadow-lg py-1 z-40"
        >
          <button role="menuitem" onClick={() => choose(onEdit)} className="w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50">
            Edit customer
          </button>
          <button role="menuitem" onClick={() => choose(onToggleBlockMessages)} className="w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50">
            {autoRecoveryBlocked ? "Allow automatic messages" : "Don't contact this customer automatically"}
          </button>
          <button role="menuitem" onClick={() => choose(onMarkNotCustomer)} className="w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50">
            Mark as not a customer
          </button>
          <button role="menuitem" onClick={() => choose(onDelete)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Delete customer
          </button>
        </div>
      )}
    </div>
  );
}



// components/customer/EditCustomerDialog.tsx



interface EditCustomerDialogProps {
  open: boolean;
  customer: CustomerDoc;
  onClose: () => void;
}

/** Spec §34: editing is limited to name, phone, and preferred channel — no
 * CRM-style fields. */
export function EditCustomerDialog({ open, customer, onClose }: EditCustomerDialogProps) {
  const [name, setName] = useState(customer.displayName ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [channel, setChannel] = useState<"whatsapp" | "phone" | "web">(
    customer.preferredChannel === "unknown" ? "whatsapp" : customer.preferredChannel
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await editCustomerIdentity(customer.id, {
        displayName: name.trim() || undefined,
        phone: phone.trim() || undefined,
        preferredChannel: channel,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-customer-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="edit-customer-title" className="text-base font-semibold text-neutral-900">
          Edit customer
        </h2>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">Preferred communication channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as "whatsapp" | "phone" | "web")}
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone</option>
              <option value="web">Web</option>
            </select>
          </label>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-3 justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 min-h-[44px]">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 min-h-[44px] disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}