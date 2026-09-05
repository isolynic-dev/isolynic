
// app/customers/[customerId]/page.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useCustomerScreen } from "@/hooks/hooks";
import { CustomerIdentity } from "@/components/customer";
import { CustomerActions } from "@/components/customer";
import { CurrentSituationCard } from "@/components/customer";
import { OpportunitySummary } from "@/components/customer";
import { ConversationPreview } from "@/components/customer";
import { Timeline } from "@/components/customer";
import { AppointmentSummary } from "@/components/customer";
import { CustomerNotes } from "@/components/customer";
import { CustomerMenu } from "@/components/customer";
import { EditCustomerDialog } from "@/components/customer";
import { ConfirmDialog } from "@/components/customer";
import { IdentitySkeleton, CardSkeleton } from "@/components/customer";
import {
  markCustomerNotACustomer,
  deleteCustomer,
  takeOverConversation,
  resumeAutomaticRecovery,
  stopRecovery,
  setAutoRecoveryBlocked,
} from "@/lib/customer";

type PendingConfirm =
  | { kind: "delete" }
  | { kind: "mark_not_customer" }
  | { kind: "block_messages"; nextBlocked: boolean }
  | null;

/** Screen 6 — Customer. Responsive: single column on mobile (spec §46),
 * hybrid two-column on tablet (§47), sticky left identity panel + scrolling
 * right "memory" column on desktop (§48–49). */
export default function CustomerScreenPage() {
  const router = useRouter();
  const params = useParams<{ customerId: string }>();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("from"); // preserves back-navigation context (§5, §59)

  const customerId = params?.customerId ?? null;
  const {
    loadState,
    customer,
    activeOpportunities,
    conversation,
    messages,
    timeline,
    timelineHasMore,
    loadMoreTimeline,
    timelineLoadingMore,
    appointments,
    notes,
    pendingSuggestions,
    isOffline,
    retry,
  } = useCustomerScreen(customerId);

  const [editOpen, setEditOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const primaryOpportunity = activeOpportunities[0] ?? null;

  const goBack = useCallback(() => {
    if (returnTo) router.push(returnTo);
    else router.back();
  }, [returnTo, router]);

  const handleMessage = useCallback(() => {
    if (!customer) return;
    if (!customer.channels.whatsapp && !customer.channels.phone) {
      setActionNotice("We don't have a messaging channel for this customer yet.");
      return;
    }
    router.push(`/conversations?customerId=${customer.id}&from=/customers/${customer.id}`);
  }, [customer, router]);

  const handleCall = useCallback(() => {
    if (!customer) return;
    const number = customer.phone ?? customer.channels.phone;
    if (!number) return;
    window.location.href = `tel:${number}`;
  }, [customer]);

  const handleViewOpportunity = useCallback(() => {
    if (!customer) return;
    if (activeOpportunities.length === 1) {
      router.push(`/opportunities/${activeOpportunities[0].id}?from=/customers/${customer.id}`);
    } else if (activeOpportunities.length > 1) {
      router.push(`/customers/${customer.id}/opportunities`);
    }
  }, [customer, activeOpportunities, router]);

  const handleRecoverNow = useCallback(async () => {
    if (!customer || !primaryOpportunity) return;
    try {
      await resumeAutomaticRecovery(customer.id, primaryOpportunity.id);
    } catch (e) {
      setActionNotice(e instanceof Error ? e.message : "Couldn't start recovery.");
    }
  }, [customer, primaryOpportunity]);

  const handleHandleMyself = useCallback(async () => {
    if (!customer) return;
    try {
      await takeOverConversation(customer.id, primaryOpportunity?.id);
    } catch (e) {
      setActionNotice(e instanceof Error ? e.message : "Couldn't take over the conversation.");
    }
  }, [customer, primaryOpportunity]);

  const handleStopRecovery = useCallback(async () => {
    if (!customer || !primaryOpportunity) return;
    try {
      await stopRecovery(customer.id, primaryOpportunity.id);
    } catch (e) {
      setActionNotice(e instanceof Error ? e.message : "Couldn't stop recovery.");
    }
  }, [customer, primaryOpportunity]);

  const handleLetIsolynicHelpAgain = useCallback(async () => {
    if (!customer || !primaryOpportunity) return;
    try {
      await resumeAutomaticRecovery(customer.id, primaryOpportunity.id);
    } catch (e) {
      setActionNotice(e instanceof Error ? e.message : "Couldn't resume Isolynic.");
    }
  }, [customer, primaryOpportunity]);

  async function handleConfirm() {
    if (!pendingConfirm || !customer) return;
    setConfirmBusy(true);
    try {
      if (pendingConfirm.kind === "delete") {
        await deleteCustomer(customer.id);
        setPendingConfirm(null);
        goBack();
        return;
      }
      if (pendingConfirm.kind === "mark_not_customer") {
        await markCustomerNotACustomer(customer.id);
      }
      if (pendingConfirm.kind === "block_messages") {
        await setAutoRecoveryBlocked(customer.id, pendingConfirm.nextBlocked);
      }
      setPendingConfirm(null);
    } catch (e) {
      setActionNotice(e instanceof Error ? e.message : "That action couldn't be completed.");
      setPendingConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const confirmCopy = useMemo(() => {
    switch (pendingConfirm?.kind) {
      case "delete":
        return {
          title: "Delete this customer?",
          description:
            "This removes the customer record from Isolynic. Information may also be removed from related conversations where applicable.",
          confirmLabel: "Delete",
          destructive: true,
        };
      case "mark_not_customer":
        return {
          title: "Mark as not a customer?",
          description: "We'll stop treating this person as a customer opportunity.",
          confirmLabel: "Mark as not a customer",
          destructive: false,
        };
      case "block_messages":
        return pendingConfirm.nextBlocked
          ? {
              title: "Stop automatic messages?",
              description: "Isolynic will stop automatic messages to this customer.",
              confirmLabel: "Don't contact automatically",
              destructive: false,
            }
          : {
              title: "Allow automatic messages?",
              description: "Isolynic will be able to send automatic recovery messages to this customer again.",
              confirmLabel: "Allow automatic messages",
              destructive: false,
            };
      default:
        return null;
    }
  }, [pendingConfirm]);

  // ---- Error / not-found states (spec §72) --------------------------------

  if (loadState === "not_found") {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-neutral-800 font-medium">We couldn't load this customer's information.</p>
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={goBack} className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100">
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-neutral-800 font-medium">We couldn't load this customer's information.</p>
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={retry} className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
            Try again
          </button>
          <button onClick={goBack} className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const identityReady = loadState === "ready" && customer !== null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header (§7) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <button onClick={goBack} aria-label="Back" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-neutral-900">Customer</h1>
        {identityReady ? (
          <CustomerMenu
            autoRecoveryBlocked={customer.autoRecoveryBlocked}
            onEdit={() => setEditOpen(true)}
            onMarkNotCustomer={() => setPendingConfirm({ kind: "mark_not_customer" })}
            onDelete={() => setPendingConfirm({ kind: "delete" })}
            onToggleBlockMessages={() =>
              setPendingConfirm({ kind: "block_messages", nextBlocked: !customer.autoRecoveryBlocked })
            }
          />
        ) : (
          <div className="w-11" />
        )}
      </header>

      {isOffline && (
        <div role="status" className="bg-neutral-800 text-white text-xs text-center py-1.5">
          You're offline. Some information may be out of date.
        </div>
      )}

      {actionNotice && (
        <div role="status" className="mx-4 mt-3 rounded-lg bg-neutral-100 text-neutral-700 text-sm px-3 py-2 flex justify-between items-center">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} aria-label="Dismiss" className="ml-3 text-neutral-500">
            ×
          </button>
        </div>
      )}

      {/* Content — responsive (§46–49) */}
      <main className="max-w-[1280px] mx-auto px-4 py-5 lg:grid lg:grid-cols-[38%_62%] lg:gap-8">
        {/* Left / primary column */}
        <div className="lg:sticky lg:top-16 lg:self-start space-y-5">
          {!identityReady ? (
            <IdentitySkeleton />
          ) : (
            <>
              <CustomerIdentity customer={customer} />
              <CustomerActions
                customer={customer}
                activeOpportunities={activeOpportunities}
                onMessage={handleMessage}
                onCall={handleCall}
                onViewOpportunity={handleViewOpportunity}
              />
              <CurrentSituationCard
                customer={customer}
                primaryOpportunity={primaryOpportunity}
                onRecoverNow={handleRecoverNow}
                onHandleMyself={handleHandleMyself}
                onStopRecovery={handleStopRecovery}
                onViewConversation={() =>
                  router.push(`/conversations?customerId=${customer.id}&from=/customers/${customer.id}`)
                }
                onLetIsolynicHelpAgain={handleLetIsolynicHelpAgain}
              />
              <OpportunitySummary
                opportunities={activeOpportunities}
                onView={(id) => router.push(`/opportunities/${id}?from=/customers/${customer.id}`)}
              />
              <AppointmentSummary
                appointments={appointments}
                onView={(id) => router.push(`/appointments/${id}`)}
                onChange={(id) => router.push(`/appointments/${id}/edit`)}
                onCancel={(id) => router.push(`/appointments/${id}/cancel`)}
                onViewAll={() => router.push(`/customers/${customer.id}/appointments`)}
              />
              <CustomerNotes customerId={customer.id} notes={notes} pendingSuggestions={pendingSuggestions} />
            </>
          )}
        </div>

        {/* Right / history column */}
        <div className="mt-5 lg:mt-0 space-y-5">
          {!identityReady ? (
            <>
              <CardSkeleton lines={4} />
              <CardSkeleton lines={5} />
            </>
          ) : (
            <>
              <ConversationPreview
                conversation={conversation}
                messages={messages}
                onViewFull={() =>
                  router.push(`/conversations?customerId=${customer.id}&from=/customers/${customer.id}`)
                }
              />
              <Timeline
                events={timeline}
                hasMore={timelineHasMore}
                loadingMore={timelineLoadingMore}
                onLoadMore={loadMoreTimeline}
              />
            </>
          )}
        </div>
      </main>

      {identityReady && (
        <EditCustomerDialog open={editOpen} customer={customer} onClose={() => setEditOpen(false)} />
      )}

      {confirmCopy && (
        <ConfirmDialog
          open={Boolean(pendingConfirm)}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          destructive={confirmCopy.destructive}
          busy={confirmBusy}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}