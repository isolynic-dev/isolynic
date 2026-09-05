"use client";


import { useState } from "react";
import { Play, Pause, Download, ImageOff } from "lucide-react";
import { MessageAttachment } from "@/types/conversations";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { Conversation, Customer } from "@/types/conversations";
import { StatusPill } from "./StatusPill";
import { ConversationOverflowMenu } from "./ConversationOverflowMenu";
import { useState } from "react";
import { Customer } from "@/types/conversations";
import { resolveIdentityMatch } from "@/lib/conversations";
import { useState } from "react";
import { Conversation } from "@/types/conversations";
import {
  markNotOpportunity,
  closeConversation,
  reopenConversation,
  deleteConversation,
} from "@/lib/conversations";
import { ConfirmDialog } from "./ConfirmDialog";
import { useState } from "react";
import { Conversation } from "@/types/conversations";
import { takeOverConversation } from "@/lib/conversations";
import { SystemEvent } from "@/types/conversations";
import { formatTimelineTimestamp } from "@/lib/format";
import { ConversationMessage } from "@/types/conversations";
import { AttachmentView } from "./AttachmentView";
import { retryFailedMessage } from "@/lib/conversations";
import { useEffect, useRef } from "react";
import { TimelineItem } from "@/types/conversations";
import { dayKey, formatDaySeparator } from "@/lib/format";
import { DateSeparator } from "./timeline/DateSeparator";
import { SystemEventRow } from "./timeline/SystemEventRow";
import { MessageBubble } from "./timeline/MessageBubble";
import { useState, useRef, useEffect } from "react";
import { Send, Phone, UserCheck } from "lucide-react";
import { Conversation } from "@/types/conversations";
import {
  sendOwnerMessage,
  requestReplySuggestion,
  takeOverConversation,
} from "@/lib/conversations";
import { useState } from "react";
import { Conversation, Customer } from "@/types/conversations";
import { addPrivateNote } from "@/lib/conversations";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getAvailableSlots, createBooking } from "@/lib/conversations";






// components/conversation/StatusPill.tsx

import { OpportunityStatus } from "@/types/conversations";

const STATUS_COPY: Record<OpportunityStatus, string> = {
  active: "Active",
  isolynic_handling: "Isolynic is handling this",
  waiting_for_customer: "Waiting for customer",
  needs_attention: "Needs your attention",
  booked: "Booked",
  recovered: "Recovered",
  lost: "Closed",
};

const STATUS_STYLES: Record<OpportunityStatus, string> = {
  active: "bg-slate-100 text-slate-700",
  isolynic_handling: "bg-slate-100 text-slate-700",
  waiting_for_customer: "bg-slate-100 text-slate-700",
  needs_attention: "bg-amber-100 text-amber-800 border border-amber-300",
  booked: "bg-emerald-100 text-emerald-800",
  recovered: "bg-emerald-100 text-emerald-800",
  lost: "bg-slate-100 text-slate-500",
};

// Non-color status indicator per accessibility spec §95 — an icon glyph
// accompanies color so state is never conveyed by color alone.
const STATUS_ICON: Record<OpportunityStatus, string> = {
  active: "●",
  isolynic_handling: "◐",
  waiting_for_customer: "○",
  needs_attention: "▲",
  booked: "✓",
  recovered: "✓",
  lost: "■",
};

export function StatusPill({ status }: { status: OpportunityStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
      role="status"
    >
      <span aria-hidden="true">{STATUS_ICON[status]}</span>
      {STATUS_COPY[status]}
    </span>
  );
}

export { STATUS_COPY };



// components/conversation/ConversationHeader.tsx



type Props = {
  conversation: Conversation;
  customer: Customer | null;
  onBack: () => void;
};

export function ConversationHeader({ conversation, customer, onBack }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[17px] font-semibold text-slate-900">
            {customer?.name ?? "Customer"}
          </h1>
        </div>
        <div className="mt-0.5">
          <StatusPill status={conversation.status} />
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        >
          <MoreVertical size={20} />
        </button>
        {menuOpen && (
          <ConversationOverflowMenu
            conversation={conversation}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </header>
  );
}



// components/conversation/ConversationOverflowMenu.tsx



export function ConversationOverflowMenu({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState<"delete" | "not_opportunity" | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleNotOpportunity() {
    setBusy(true);
    try {
      await markNotOpportunity(conversation.id);
    } finally {
      setBusy(false);
      setConfirming(null);
      onClose();
    }
  }

  async function handleCloseOrReopen() {
    setBusy(true);
    try {
      if (conversation.isClosed) {
        await reopenConversation(conversation.id);
      } else {
        await closeConversation(conversation.id, "Closed by owner");
      }
    } finally {
      setBusy(false);
      onClose();
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteConversation(conversation.id);
    } finally {
      setBusy(false);
      setConfirming(null);
      onClose();
    }
  }

  return (
    <>
      <div
        role="menu"
        className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
      >
        <button
          role="menuitem"
          disabled={busy}
          onClick={() => setConfirming("not_opportunity")}
          className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          Not an opportunity
        </button>
        <button
          role="menuitem"
          disabled={busy}
          onClick={handleCloseOrReopen}
          className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          {conversation.isClosed ? "Reopen" : "Close"}
        </button>
        <button
          role="menuitem"
          onClick={() => {
            window.open("mailto:support@isolynic.com?subject=Report a problem", "_blank");
            onClose();
          }}
          className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          Report a problem
        </button>
        <div className="my-1 border-t border-slate-100" />
        <button
          role="menuitem"
          disabled={busy}
          onClick={() => setConfirming("delete")}
          className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete conversation
        </button>
      </div>

      {confirming === "not_opportunity" && (
        <ConfirmDialog
          title="Remove from recovery?"
          body="This conversation won't be treated as an opportunity anymore."
          confirmLabel="Yes, remove"
          onConfirm={handleNotOpportunity}
          onCancel={() => setConfirming(null)}
          busy={busy}
        />
      )}
      {confirming === "delete" && (
        <ConfirmDialog
          title="Delete this conversation?"
          body="This removes it from your Isolynic account."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setConfirming(null)}
          busy={busy}
        />
      )}
    </>
  );
}


// components/conversation/ConfirmDialog.tsx


export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-slate-600">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}



// components/conversation/OpportunityBanner.tsx




const RECOMMEND_LABEL: Record<string, string> = {
  recover: "Recommended: Recover",
  take_over: "Recommended: Take over",
  no_action: "Recommended: No action needed",
  book: "Recommended: Book",
};

/**
 * Region B — explains why this conversation is surfaced and offers a
 * single primary action, per spec §11, §22, §80–83. Never shows a
 * confidence percentage.
 */
export function OpportunityBanner({
  conversation,
  onRecover,
  onBook,
}: {
  conversation: Conversation;
  onRecover: () => void;
  onBook: () => void;
}) {
  const [takingOver, setTakingOver] = useState(false);

  if (conversation.isClosed) {
    return (
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-medium text-slate-700">
          {conversation.status === "lost" ? "Closed" : "This customer has been handled."}
        </p>
        {conversation.closedReason && (
          <p className="mt-0.5 text-sm text-slate-500">{conversation.closedReason}</p>
        )}
      </div>
    );
  }

  if (!conversation.whyHere && conversation.status !== "needs_attention") {
    return null;
  }

  async function handleTakeOver() {
    setTakingOver(true);
    try {
      await takeOverConversation(conversation.id);
    } finally {
      setTakingOver(false);
    }
  }

  const rec = conversation.recommendedAction;

  return (
    <div
      className={`border-b px-4 py-3 ${
        conversation.status === "needs_attention"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      {conversation.whyHere && (
        <p className="text-sm text-slate-700">{conversation.whyHere}</p>
      )}

      {rec && (
        <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {RECOMMEND_LABEL[rec.action] ?? ""}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {rec?.action === "recover" && (
          <button
            onClick={onRecover}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Recover
          </button>
        )}
        {rec?.action === "book" && (
          <button
            onClick={onBook}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Book
          </button>
        )}
        {conversation.ownershipMode !== "OWNER" && (
          <button
            onClick={handleTakeOver}
            disabled={takingOver}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {takingOver ? "Taking over…" : "Handle myself"}
          </button>
        )}
      </div>
    </div>
  );
}



// components/conversation/ConversationSummary.tsx



export function ConversationSummary({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!summary) return null;

  return (
    <div className="border-b border-slate-100 px-4 py-2 sm:hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <p className={`text-sm text-slate-600 ${expanded ? "" : "line-clamp-1"}`}>
          {summary}
        </p>
        {expanded ? (
          <ChevronUp size={16} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        )}
      </button>
    </div>
  );
}



// components/conversation/timeline/DateSeparator.tsx

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center justify-center" role="separator" aria-label={label}>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
        {label}
      </span>
    </div>
  );
}



// components/conversation/timeline/SystemEventRow.tsx



/**
 * Timeline milestones (spec §14–17, §38): not chat bubbles, rendered as
 * a centered inline record. Covers missed calls, bookings, takeovers,
 * recovery state changes, and closures.
 */
export function SystemEventRow({ event }: { event: SystemEvent }) {
  return (
    <div className="my-2 flex items-center justify-center gap-2" role="status">
      <span
        className="sr-only"
      >{`${event.label}, ${formatTimelineTimestamp(event.timestamp)}`}</span>
      <span
        aria-hidden="true"
        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500"
      >
        {event.label} · {formatTimelineTimestamp(event.timestamp)}
      </span>
    </div>
  );
}

// components/conversation/timeline/MessageBubble.tsx


/**
 * A single conversational turn. AI-transparency requirement (spec §19–20,
 * §110–112) is non-negotiable: Isolynic messages always carry a visible
 * label; owner messages never carry AI branding.
 */
export function MessageBubble({ message }: { message: ConversationMessage }) {
  const isCustomer = message.senderType === "CUSTOMER";
  const isOwner = message.senderType === "OWNER";
  const isIsolynic = message.senderType === "ISOLYNIC";

  const align = isCustomer ? "items-start" : "items-end";
  const bubbleStyle = isCustomer
    ? "bg-slate-100 text-slate-900"
    : isIsolynic
    ? "bg-indigo-50 text-slate-900 border border-indigo-100"
    : "bg-slate-900 text-white";

  const senderLabel = isCustomer ? undefined : isOwner ? "You" : "Isolynic";

  const screenReaderPrefix = isCustomer
    ? "Customer"
    : isOwner
    ? "You"
    : "Isolynic";

  return (
    <div className={`flex flex-col ${align} gap-1 px-4 py-1`}>
      <div
        className="max-w-[85%] sm:max-w-[70%]"
        aria-label={`${screenReaderPrefix}, ${formatTimelineTimestamp(
          message.timestamp
        )}: ${message.body}`}
      >
        {senderLabel && (
          <div className="mb-0.5 flex items-center gap-1.5 px-1 text-xs font-medium text-slate-500">
            {senderLabel}
            {message.isAutomaticFollowUp && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
                Automatic follow-up
              </span>
            )}
          </div>
        )}

        <div className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${bubbleStyle}`}>
          {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
          {message.attachments?.map((att) => (
            <AttachmentView key={att.id} attachment={att} />
          ))}
        </div>

        <div className="mt-0.5 flex items-center gap-2 px-1">
          <span className="text-[11px] text-slate-400">
            {formatTimelineTimestamp(message.timestamp)}
          </span>
          {isOwner && message.deliveryStatus && (
            <DeliveryStatusLabel
              status={message.deliveryStatus}
              onRetry={() =>
                retryFailedMessage(message.conversationId, message.id)
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryStatusLabel({
  status,
  onRetry,
}: {
  status: NonNullable<ConversationMessage["deliveryStatus"]>;
  onRetry: () => void;
}) {
  if (status === "failed") {
    return (
      <span className="text-[11px] text-red-600">
        Couldn&apos;t send ·{" "}
        <button onClick={onRetry} className="underline">
          Try again
        </button>
      </span>
    );
  }
  const label =
    status === "sending"
      ? "Sending…"
      : status === "sent"
      ? "Sent"
      : status === "delivered"
      ? "Delivered"
      : "Read";
  return <span className="text-[11px] text-slate-400">{label}</span>;
}

// components/conversation/timeline/AttachmentView.tsx


export function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  if (attachment.type === "image") return <ImageAttachment attachment={attachment} />;
  if (attachment.type === "audio") return <AudioAttachment attachment={attachment} />;
  return <DocumentAttachment attachment={attachment} />;
}

function ImageAttachment({ attachment }: { attachment: MessageAttachment }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className="mt-2">
      <div className="relative overflow-hidden rounded-lg bg-slate-200">
        {!loaded && !errored && (
          <div className="flex h-40 w-56 animate-pulse items-center justify-center text-xs text-slate-400">
            Loading attachment…
          </div>
        )}
        {errored ? (
          <div className="flex h-40 w-56 flex-col items-center justify-center gap-1 text-slate-400">
            <ImageOff size={20} />
            <span className="text-xs">Couldn&apos;t load image</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt={attachment.aiCaption ?? "Customer attachment"}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={`max-h-72 max-w-full object-cover ${loaded ? "block" : "hidden"}`}
          />
        )}
      </div>
      {attachment.aiCaption && (
        <p className="mt-1 text-xs italic text-slate-500">{attachment.aiCaption}</p>
      )}
    </div>
  );
}

function AudioAttachment({ attachment }: { attachment: MessageAttachment }) {
  const [playing, setPlaying] = useState(false);
  const duration = attachment.durationSeconds ?? 0;
  const mm = Math.floor(duration / 60);
  const ss = String(Math.floor(duration % 60)).padStart(2, "0");

  return (
    <div className="mt-2 rounded-lg bg-white/60 p-2.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? "Pause voice message" : "Play voice message"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <span className="text-xs text-slate-500">
          Voice message — {mm}:{ss}
        </span>
        <audio
          src={attachment.url}
          className="hidden"
          onEnded={() => setPlaying(false)}
        />
      </div>
      {attachment.transcript && (
        <p className="mt-1.5 text-xs text-slate-500">
          Summary: {attachment.transcript}
        </p>
      )}
    </div>
  );
}

function DocumentAttachment({ attachment }: { attachment: MessageAttachment }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 rounded-lg bg-white/60 p-2.5 text-xs text-slate-600 hover:bg-white"
    >
      <Download size={14} />
      Document attachment
    </a>
  );
}



// components/conversation/ConversationTimeline.tsx




type Props = {
  items: TimelineItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadOlder: () => void;
};

/**
 * Region C. Groups messages by day (spec §17), distinguishes four event
 * types, and supports upward pagination without an infinite in-memory
 * conversation (spec §58).
 */
export function ConversationTimeline({
  items,
  loading,
  loadingMore,
  hasMore,
  onLoadOlder,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  // Scroll to latest on first load (spec §57).
  useEffect(() => {
    if (!loading && !didInitialScroll.current && items.length > 0) {
      bottomRef.current?.scrollIntoView({ block: "end" });
      didInitialScroll.current = true;
    }
  }, [loading, items.length]);

  // Infinite-upward pagination.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          const prevHeight = container.scrollHeight;
          onLoadOlder();
          // Preserve scroll position after older items are prepended.
          requestAnimationFrame(() => {
            const newHeight = container.scrollHeight;
            container.scrollTop += newHeight - prevHeight;
          });
        }
      },
      { root: container, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadOlder]);

  if (loading) {
    return <TimelineSkeleton />;
  }

  if (items.length === 0) {
    return <EmptyTimeline />;
  }

  let lastDayKey: string | null = null;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto py-3"
      aria-label="Conversation timeline"
      aria-live="polite"
    >
      <div ref={sentinelRef} />
      {loadingMore && (
        <p className="py-2 text-center text-xs text-slate-400">Loading earlier messages…</p>
      )}

      {items.map((item) => {
        const ts = item.kind === "message" ? item.data.timestamp : item.data.timestamp;
        const key = dayKey(ts);
        const showSeparator = key !== lastDayKey;
        lastDayKey = key;

        return (
          <div key={item.data.id}>
            {showSeparator && <DateSeparator label={formatDaySeparator(ts)} />}
            {item.kind === "system_event" ? (
              <SystemEventRow event={item.data} />
            ) : (
              <MessageBubble message={item.data} />
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="flex-1 space-y-3 overflow-hidden px-4 py-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-12 w-2/3 animate-pulse rounded-2xl bg-slate-100 ${
            i % 2 === 0 ? "mr-auto" : "ml-auto"
          }`}
        />
      ))}
    </div>
  );
}

function EmptyTimeline() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
      <p className="text-sm font-medium text-slate-600">No messages yet</p>
      <p className="text-sm text-slate-400">This customer has not sent a message yet.</p>
    </div>
  );
}




// components/conversation/Composer.tsx

type Props = {
  conversation: Conversation;
  isOnline: boolean;
  onCall: () => void;
  onBook?: () => void;
};

/**
 * Region E. Deliberately minimal: no prompt controls, no tone/model
 * selectors (spec §24). The one AI-assisted affordance is a single
 * optional suggested reply that never auto-sends (spec §25).
 */
export function Composer({ conversation, isOnline, onCall }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasFocusedOnce = useRef(false);

  const isOwnerHandling = conversation.ownershipMode === "OWNER";

  async function handleFocus() {
    if (hasFocusedOnce.current || !isOwnerHandling || text.trim()) return;
    hasFocusedOnce.current = true;
    setSuggestionLoading(true);
    try {
      const s = await requestReplySuggestion(conversation.id);
      setSuggestion(s);
    } catch {
      setSuggestion(null);
    } finally {
      setSuggestionLoading(false);
    }
  }

  async function handleSend() {
    const body = text.trim();
    if (!body || sending || !isOnline) return;
    setSending(true);
    setText("");
    setSuggestion(null);
    try {
      await sendOwnerMessage(conversation.id, body);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleTakeOver() {
    setTakingOver(true);
    try {
      await takeOverConversation(conversation.id);
    } finally {
      setTakingOver(false);
    }
  }

  // Keep composer visible above mobile keyboard (spec §85).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      document.documentElement.style.setProperty("--vv-offset", `${window.innerHeight - vv.height}px`);
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  return (
    <div
      className="border-t border-slate-200 bg-white px-3 py-2.5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      {!isOnline && (
        <div className="mb-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
          You&apos;re offline. Messages can&apos;t be sent right now.
        </div>
      )}

      {suggestionLoading && (
        <div className="mb-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-400">
          Preparing a suggested reply…
        </div>
      )}

      {suggestion && !text && (
        <div className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
          <p className="text-xs font-medium text-indigo-600">Suggested reply</p>
          <p className="mt-0.5 text-sm text-slate-700">{suggestion}</p>
          <div className="mt-1.5 flex gap-3">
            <button
              onClick={() => {
                setText(suggestion);
                setSuggestion(null);
                textareaRef.current?.focus();
              }}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Use
            </button>
            <button
              onClick={() => setSuggestion(null)}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={!isOnline || sending}
          placeholder="Write a message…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:bg-slate-50"
        />

        <button
          onClick={onCall}
          aria-label="Call customer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100"
        >
          <Phone size={18} />
        </button>

        {isOwnerHandling ? (
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || !isOnline}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        ) : (
          <button
            onClick={handleTakeOver}
            disabled={takingOver}
            aria-label="Take over conversation"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <UserCheck size={16} />
            {takingOver ? "…" : "Take over"}
          </button>
        )}
      </div>

      {isOwnerHandling && (
        <p className="mt-1.5 px-1 text-xs text-slate-400">
          You&apos;re in control now. Isolynic won&apos;t message this customer until you turn it
          back on.{" "}
          <ReleaseControlLink conversationId={conversation.id} />
        </p>
      )}
    </div>
  );
}

function ReleaseControlLink({ conversationId }: { conversationId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { releaseConversationToIsolynic } = await import("@/lib/conversation/actions");
        try {
          await releaseConversationToIsolynic(conversationId);
        } finally {
          setBusy(false);
        }
      }}
      className="font-medium text-slate-600 underline"
    >
      Let Isolynic handle it again
    </button>
  );
}




// components/conversation/CustomerContextPanel.tsx


/**
 * Region F. Deliberately minimal — "what do I need to know to handle this
 * customer", not a full CRM record (spec §31–32).
 */
export function CustomerContextPanel({
  conversation,
  customer,
  onCall,
  onBook,
}: {
  conversation: Conversation;
  customer: Customer | null;
  onCall: () => void;
  onBook: () => void;
}) {
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveNote() {
    const body = note.trim();
    if (!body) return;
    setSavingNote(true);
    try {
      await addPrivateNote(conversation.id, body);
      setNote("");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-slate-200 bg-white px-4 py-4">
      <Section title="Customer">
        <p className="text-sm font-medium text-slate-900">{customer?.name ?? "Unknown"}</p>
        {customer?.phone && <p className="text-sm text-slate-500">{customer.phone}</p>}
        {customer?.preferredChannel && (
          <p className="mt-0.5 text-xs text-slate-400 capitalize">
            Prefers {customer.preferredChannel}
          </p>
        )}
      </Section>

      <Section title="What they want">
        <p className="text-sm text-slate-600">{conversation.summary || "No summary yet."}</p>
      </Section>

      <Section title="Opportunity">
        <p className="text-sm text-slate-600 capitalize">
          {conversation.status.replace(/_/g, " ")}
        </p>
      </Section>

      {conversation.currentBooking && (
        <Section title="Booking">
          <p className="text-sm text-slate-600">
            {conversation.currentBooking.startTime.toDate().toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            ({conversation.currentBooking.timezone})
          </p>
          <p className="mt-0.5 text-xs capitalize text-slate-400">
            {conversation.currentBooking.status}
          </p>
        </Section>
      )}

      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCall}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Call
          </button>
          <button
            onClick={onBook}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Book
          </button>
        </div>
      </Section>

      <Section title="Private notes">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note only you can see…"
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <button
          onClick={handleSaveNote}
          disabled={!note.trim() || savingNote}
          className="mt-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {savingNote ? "Saving…" : "Add note"}
        </button>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 border-b border-slate-100 pb-4 last:border-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}




// components/conversation/BookingSheet.tsx

type Slot = { startIso: string; endIso: string };

function nextNDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

/**
 * Booking flow (spec §30): pick a day, then a slot, create on the
 * connected calendar via Cloud Function → Google Calendar events.insert.
 */
export function BookingSheet({
  conversationId,
  onClose,
  onBooked,
}: {
  conversationId: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const days = nextNDays(5);
  const [selectedDay, setSelectedDay] = useState<Date>(days[0]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setError(null);
    getAvailableSlots(conversationId, selectedDay.toISOString())
      .then((s) => {
        if (!cancelled) setSlots(s);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load availability. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, selectedDay]);

  async function handleBook(slot: Slot) {
    setBooking(true);
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await createBooking(conversationId, slot.startIso, slot.endIso, tz);
      onBooked();
      onClose();
    } catch {
      setError("Couldn't complete the booking. Try again.");
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Book appointment</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
          {days.map((d) => {
            const isSelected = d.toDateString() === selectedDay.toDateString();
            const label =
              d.toDateString() === new Date().toDateString()
                ? "Today"
                : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDay(d)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          {loadingSlots ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No available times on this day.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startIso}
                  disabled={booking}
                  onClick={() => handleBook(slot)}
                  className="rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:border-slate-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  {new Date(slot.startIso).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




// components/conversation/IdentityConflictBanner.tsx




export function IdentityConflictBanner({
  conversationId,
  customer,
}: {
  conversationId: string;
  customer: Customer;
}) {
  const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (customer.identityConfidence !== "possible_match" || resolved) return null;

  async function resolve(decision: "merge" | "keep_separate") {
    setBusy(true);
    try {
      await resolveIdentityMatch(conversationId, decision);
      setResolved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
      <p className="text-sm text-slate-700">
        We couldn&apos;t confirm this customer&apos;s identity.
      </p>
      <div className="mt-1.5 flex gap-2">
        <button
          disabled={busy}
          onClick={() => resolve("merge")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Same customer
        </button>
        <button
          disabled={busy}
          onClick={() => resolve("keep_separate")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Different customer
        </button>
      </div>
    </div>
  );
}