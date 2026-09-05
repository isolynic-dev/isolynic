
// app/conversations/page.tsx

"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

import { useConversation } from "@/hooks/hooks";
import { useConversationTimeline } from "@/hooks/hooks";
import { useCustomer } from "@/hooks/hooks";
import { useConnectionStatus } from "@/hooks/hooks";
import { ConversationHeader } from "@/components/conversations";
import { OpportunityBanner } from "@/components/conversations";
import { ConversationSummary } from "@/components/conversations";
import { ConversationTimeline } from "@/components/conversations";
import { Composer } from "@/components/conversations";
import { CustomerContextPanel } from "@/components/conversations";
import { BookingSheet } from "@/components/conversations";
import { IdentityConflictBanner } from "@/components/conversations";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params?.id ?? null;

  const { conversation, loading: convoLoading } = useConversation(conversationId);
  const { customer } = useCustomer(conversation?.customerId ?? null);
  const timeline = useConversationTimeline(conversationId);
  const { isOnline, justReconnected } = useConnectionStatus();

  const [bookingOpen, setBookingOpen] = useState(false);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleCall = useCallback(() => {
    if (!customer?.phone) return;
    window.location.href = `tel:${customer.phone}`;
  }, [customer]);

  const handleRecover = useCallback(async () => {
    if (!conversationId) return;
    const { requestReplySuggestion, sendOwnerMessage } = await import(
      "@/lib/conversations"
    );
    // "Recover" surfaces a suggested follow-up for the owner to review/send —
    // it never sends on its own (spec §25, §82: every recommendation is optional).
    const suggestion = await requestReplySuggestion(conversationId);
    if (suggestion) {
      const confirmed = window.confirm(`Send this follow-up?\n\n${suggestion}`);
      if (confirmed) await sendOwnerMessage(conversationId, suggestion);
    }
  }, [conversationId]);

  if (convoLoading) {
    return <PageSkeleton />;
  }

  if (!conversation) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-slate-600">This conversation isn&apos;t available.</p>
        <button onClick={handleBack} className="text-sm text-indigo-600 underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-white sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col sm:basis-[68%]">
        <ConversationHeader conversation={conversation} customer={customer} onBack={handleBack} />

        {justReconnected && (
          <div className="bg-emerald-50 px-4 py-1.5 text-center text-xs text-emerald-700">
            You&apos;re back online.
          </div>
        )}

        {customer && (
          <IdentityConflictBanner conversationId={conversation.id} customer={customer} />
        )}

        <OpportunityBanner
          conversation={conversation}
          onRecover={handleRecover}
          onBook={() => setBookingOpen(true)}
        />

        <ConversationSummary summary={conversation.summary} />

        <ConversationTimeline
          items={timeline.items}
          loading={timeline.loading}
          loadingMore={timeline.loadingMore}
          hasMore={timeline.hasMore}
          onLoadOlder={timeline.loadOlder}
        />

        {!conversation.isClosed && (
          <Composer
            conversation={conversation}
            isOnline={isOnline}
            onCall={handleCall}
            onBook={() => setBookingOpen(true)}
          />
        )}
      </div>

      <div className="hidden sm:block sm:w-[32%] sm:max-w-sm">
        <CustomerContextPanel
          conversation={conversation}
          customer={customer}
          onCall={handleCall}
          onBook={() => setBookingOpen(true)}
        />
      </div>

      {bookingOpen && (
        <BookingSheet
          conversationId={conversation.id}
          onClose={() => setBookingOpen(false)}
          onBooked={() => setBookingOpen(false)}
        />
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-12 w-2/3 animate-pulse rounded-2xl bg-slate-100 ${
              i % 2 ? "ml-auto" : ""
            }`}
          />
        ))}
      </div>
      <div className="h-16 border-t border-slate-200" />
    </div>
  );
}