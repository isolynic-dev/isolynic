
// app/opportunities/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOpportunity } from '@/hooks/hooks';
import { OpportunityHeader ,
CustomerIdentity ,
StatusBanner ,
AttentionReason,
 OpportunitySummaryCard,
 RecommendationPanel ,
SupportingDetails ,
MobileActionBar ,
DismissConfirmDialog,
ResolveDialog } from '@/components/opportunity';
import { logAnalyticsEvent } from '@/lib/analytics';

export default function OpportunityPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const {
    opportunity,
    timeline,
    loading,
    error,
    justUpdated,
    recover,
    takeover,
    dismiss,
    undoDismiss,
    addNote,
    resolve,
  } = useOpportunity(params.id);

  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [resolveDialogOutcome, setResolveDialogOutcome] = useState<'won' | 'lost' | null>(null);
  const [undoToast, setUndoToast] = useState<{ token: string; visible: boolean } | null>(null);

  useEffect(() => {
    if (opportunity) {
      logAnalyticsEvent('opportunity_viewed', { opportunityId: opportunity.opportunityId });
      if (opportunity.recommendedAction.actionType !== 'none') {
        logAnalyticsEvent('recommendation_viewed', { opportunityId: opportunity.opportunityId });
      }
    }
  }, [opportunity?.opportunityId]);

  const handleRecover = useCallback(
    async (message?: string) => {
      if (!opportunity) throw new Error('no opportunity');
      logAnalyticsEvent('recover_clicked', { opportunityId: opportunity.opportunityId });
      if (message) logAnalyticsEvent('message_edited', { opportunityId: opportunity.opportunityId });
      const res = await recover(message);
      if (res.status === 'success') {
        logAnalyticsEvent('recover_completed', { opportunityId: opportunity.opportunityId });
      }
      return res;
    },
    [opportunity, recover]
  );

  const handleTakeover = useCallback(async () => {
    if (!opportunity) return;
    logAnalyticsEvent('takeover_clicked', { opportunityId: opportunity.opportunityId });
    await takeover();
    router.push(`/conversations/${opportunity.customer.id}?opportunityId=${opportunity.opportunityId}`);
  }, [opportunity, takeover, router]);

  const handleConfirmDismiss = useCallback(async () => {
    if (!opportunity) return;
    setDismissDialogOpen(false);
    const res = await dismiss();
    logAnalyticsEvent('dismissed_as_not_opportunity', { opportunityId: opportunity.opportunityId });
    if (res.undoToken) {
      setUndoToast({ token: res.undoToken, visible: true });
      setTimeout(() => setUndoToast((t) => (t ? { ...t, visible: false } : t)), 6000);
    }
  }, [opportunity, dismiss]);

  const handleResolve = useCallback(
    async (detail: { value?: number; reason?: string }) => {
      if (!opportunity || !resolveDialogOutcome) return;
      await resolve(resolveDialogOutcome, detail);
      logAnalyticsEvent(
        resolveDialogOutcome === 'won' ? 'opportunity_resolved_won' : 'opportunity_resolved_lost',
        { opportunityId: opportunity.opportunityId }
      );
      setResolveDialogOutcome(null);
    },
    [opportunity, resolveDialogOutcome, resolve]
  );

  function handleOverflowAction(action: 'not_opportunity' | 'won' | 'lost' | 'call' | 'note') {
    if (action === 'not_opportunity') setDismissDialogOpen(true);
    else if (action === 'won' || action === 'lost') setResolveDialogOutcome(action);
    else if (action === 'call' && opportunity?.customer.phone) {
      window.location.href = `tel:${opportunity.customer.phone}`;
    }
    // 'note' handled inline in SupportingDetails
  }

  if (loading) return <PageSkeleton />;

  if (error === 'not_found') {
    return <ErrorScreen title="Opportunity not found" subtitle="It may have been resolved or removed." />;
  }
  if (error) {
    return <ErrorScreen title="Something went wrong" subtitle="Please try again." />;
  }
  if (!opportunity) return null;

  const earlierCount = Math.max(0, opportunity.followUpCount + timeline.length - 6);

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-10">
      <OpportunityHeader opportunity={opportunity} onOverflowAction={handleOverflowAction} />

      {opportunity.ownerHandling && (
        <div className="bg-neutral-900 text-white text-[13px] text-center py-2 px-4">
          You&apos;re handling this conversation. Isolynic won&apos;t send messages until you give it back.
        </div>
      )}

      <main className="mx-auto max-w-[1320px] px-4 md:px-8 py-6">
        <div className="lg:grid lg:grid-cols-[60%_40%] lg:gap-8">
          {/* Left column */}
          <div className="space-y-6">
            <CustomerIdentity opportunity={opportunity} />
            <StatusBanner status={opportunity.status} justUpdated={justUpdated} />
            <AttentionReason opportunity={opportunity} />
            <OpportunitySummaryCard opportunity={opportunity} />

            {/* Mobile-only recommendation panel appears here, inline */}
            <div className="lg:hidden">
              <RecommendationPanel
                opportunity={opportunity}
                onRecover={handleRecover}
                onTakeover={handleTakeover}
              />
            </div>

            <OpportunityTimeline
              events={timeline}
              earlierCount={earlierCount}
              onViewFullConversation={() =>
                logAnalyticsEvent('view_conversation_clicked', {
                  opportunityId: opportunity.opportunityId,
                })
              }
            />

            <SupportingDetails
              opportunity={opportunity}
              onAddNote={async (note) => {
                await addNote(note);
              }}
              onCall={() => {
                if (opportunity.customer.phone) window.location.href = `tel:${opportunity.customer.phone}`;
              }}
              onMessage={() =>
                router.push(`/conversations/${opportunity.customer.id}?opportunityId=${opportunity.opportunityId}`)
              }
            />
          </div>

          {/* Right column — sticky, desktop only */}
          <div className="hidden lg:block">
            <RecommendationPanel
              opportunity={opportunity}
              onRecover={handleRecover}
              onTakeover={handleTakeover}
              sticky
            />
          </div>
        </div>
      </main>

      <MobileActionBar
        onRecover={() => handleRecover()}
        onHandleMyself={handleTakeover}
        onMore={handleOverflowAction}
        recoverDisabled={opportunity.ownerHandling || opportunity.followUpCount >= opportunity.followUpLimit}
      />

      <DismissConfirmDialog
        open={dismissDialogOpen}
        onConfirm={handleConfirmDismiss}
        onCancel={() => setDismissDialogOpen(false)}
      />

      <ResolveDialog
        open={resolveDialogOutcome !== null}
        outcome={resolveDialogOutcome}
        onConfirm={handleResolve}
        onCancel={() => setResolveDialogOutcome(null)}
      />

      {undoToast?.visible && (
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white rounded-full px-4 py-2.5 text-[14px] flex items-center gap-3 shadow-lg z-50">
          <span>Removed from recovery.</span>
          <button
            className="font-semibold underline"
            onClick={async () => {
              await undoDismiss(undoToast.token);
              setUndoToast(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 md:px-8 py-6 animate-pulse space-y-6">
      <div className="h-11 w-11 rounded-full bg-neutral-200" />
      <div className="h-8 w-1/2 bg-neutral-200 rounded" />
      <div className="h-16 w-full bg-neutral-100 rounded-xl" />
      <div className="h-32 w-full bg-neutral-100 rounded-xl" />
    </div>
  );
}

function ErrorScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-[18px] font-semibold text-neutral-900">{title}</p>
      <p className="text-[14px] text-neutral-500 mt-1">{subtitle}</p>
    </div>
  );
}