
// components/recovery/Toast.tsx
'use client';

import { createContext, useEffect, useCallback, useContext,useTransition, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { OpportunityDoc } from '@/types/opportunity';
import { statusToHumanLabel } from '@/types/recovery';
import { recoverOpportunity, ignoreOpportunity, markNotACustomer } from '@/lib/firebase';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import type { OpportunityDoc } from '@/types/recovery';
import type { QueueFilter } from '@/hooks/hooks';








interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  tone: 'neutral' | 'success' | 'error';
  action?: ToastAction;
}

interface ToastContextValue {
  push: (message: string, opts?: { tone?: ToastItem['tone']; action?: ToastAction; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback<ToastContextValue['push']>((message, opts) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, tone: opts?.tone ?? 'neutral', action: opts?.action }]);
    timers.current[id] = setTimeout(() => dismiss(id), opts?.durationMs ?? 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              'flex w-full max-w-sm items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-lg text-sm',
              t.tone === 'error'
                ? 'bg-red-600 text-white'
                : t.tone === 'success'
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-900 text-white',
            ].join(' ')}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 font-medium underline underline-offset-2 min-h-[44px] px-2 -my-3"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}



// components/recovery/ConfirmDialog.tsx



interface ConfirmDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <h2 id="confirm-dialog-title" className="text-base font-medium text-neutral-900">
          {title}
        </h2>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="min-h-[44px] flex-1 rounded-xl bg-neutral-900 text-sm font-medium text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}



// components/recovery/OpportunityCard.tsx



const CHANNEL_ICON: Record<string, string> = {
  phone: '📞',
  whatsapp: '💬',
  website: '🌐',
  sms: '✉️',
  email: '✉️',
  other: '•',
};

const PRIORITY_LABEL: Record<OpportunityDoc['priorityBand'], string> = {
  high: 'High priority',
  worth_checking: 'Worth checking',
  low: 'Low priority',
};

interface OpportunityCardProps {
  opportunity: OpportunityDoc;
}

export function OpportunityCard({ opportunity: o }: OpportunityCardProps) {
  const router = useRouter();
  const { push: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [localState, setLocalState] = useState<'idle' | 'recovering' | 'sent'>('idle');
  const [confirmIgnore, setConfirmIgnore] = useState(false);
  const [failed, setFailed] = useState(false);

  const isRecovering = localState === 'recovering' || o.status === 'RECOVERY_SENT' || o.status === 'WAITING';
  const isHumanRequired = o.decisionBand === 'human_required';
  const isResponded = o.status === 'CUSTOMER_RESPONDED' || o.status === 'PROGRESSING';
  const isBooked = o.status === 'BOOKED' || o.status === 'WON';

  const handleRecover = () => {
    setFailed(false);
    setLocalState('recovering');
    startTransition(async () => {
      const result = await recoverOpportunity(o.id);
      if (result.ok) {
        setLocalState('sent');
        toast(`Follow-up sent to ${o.customerName.split(' ')[0]}.`, { tone: 'success' });
      } else {
        setLocalState('idle');
        setFailed(true);
        toast(result.reason ?? "We couldn't send that message.", {
          tone: 'error',
          action: { label: 'Try again', onClick: handleRecover },
        });
      }
    });
  };

  const handleMyself = () => {
    router.push(`/conversations/${o.customerId}?opportunityId=${o.id}`);
  };

  const handleIgnore = () => {
    setConfirmIgnore(false);
    startTransition(async () => {
      const result = await ignoreOpportunity(o.id);
      if (result.ok) {
        toast('Removed from recovery.', {
          action: { label: 'Undo', onClick: () => undo(o.id) },
        });
      } else {
        toast(result.reason ?? "Couldn't do that right now.", { tone: 'error' });
      }
    });
  };

  const handleNotACustomer = () => {
    startTransition(async () => {
      const result = await markNotACustomer(o.id);
      if (result.ok) {
        toast('Marked as not a customer.', {
          action: { label: 'Undo', onClick: () => undo(o.id) },
        });
      } else {
        toast(result.reason ?? "Couldn't do that right now.", { tone: 'error' });
      }
    });
  };

  const undo = async (opportunityId: string) => {
    const { undoAction } = await import('@/lib/recovery');
    await undoAction(opportunityId);
  };

  const primaryButtonLabel = isRecovering
    ? localState === 'recovering'
      ? 'Recovering…'
      : 'Following up'
    : isResponded
    ? 'Continue'
    : 'Recover';

  return (
    <article
      aria-label={`${o.customerName}. ${PRIORITY_LABEL[o.priorityBand]}. ${o.whyNow} Isolynic recommends: ${o.recommendation}.`}
      className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        {/* Who / What / Why */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-neutral-900">{o.customerName}</h3>
            {o.priorityBand !== 'low' && (
              <span
                className={[
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  o.priorityBand === 'high'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-neutral-100 text-neutral-700 border border-neutral-200',
                ].join(' ')}
              >
                {PRIORITY_LABEL[o.priorityBand]}
              </span>
            )}
            {o.sourceChannels.map((c) => (
              <span key={c} aria-hidden="true" className="text-xs text-neutral-400">
                {CHANNEL_ICON[c] ?? '•'}
              </span>
            ))}
          </div>

          <p className="mt-1 text-sm text-neutral-700">{o.intentSummary}</p>

          {isHumanRequired && o.needsOwnerReason ? (
            <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
              {o.needsOwnerReason}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-neutral-500">{o.whyNow}</p>
              <p className="mt-2 text-sm text-neutral-900">
                <span className="font-medium">Isolynic recommends:</span> {o.recommendation}
              </p>
            </>
          )}

          {isRecovering && localState !== 'idle' && (
            <p className="mt-2 text-sm text-neutral-500">
              {localState === 'sent' || o.status === 'RECOVERY_SENT' || o.status === 'WAITING'
                ? 'Waiting for a response.'
                : 'Sending…'}
            </p>
          )}

          {o.handledByName && (
            <p className="mt-2 text-xs text-neutral-400">{o.handledByName} is handling this customer.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-stretch sm:w-40">
          {!isHumanRequired && !isBooked && (
            <button
              onClick={handleRecover}
              disabled={isPending || isRecovering}
              className="min-h-[44px] flex-1 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60 sm:flex-none"
            >
              {primaryButtonLabel}
            </button>
          )}
          {!isBooked && (
            <button
              onClick={handleMyself}
              className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 px-4 text-sm font-medium text-neutral-800 sm:flex-none"
            >
              Handle myself
            </button>
          )}
          {!isHumanRequired && !isResponded && !isBooked && (
            <div className="hidden sm:flex sm:gap-2">
              <button
                onClick={() => setConfirmIgnore(true)}
                className="min-h-[44px] flex-1 rounded-xl px-2 text-xs font-medium text-neutral-400 hover:text-neutral-600"
              >
                Ignore
              </button>
              <button
                onClick={handleNotACustomer}
                className="min-h-[44px] flex-1 rounded-xl px-2 text-xs font-medium text-neutral-400 hover:text-neutral-600"
              >
                Not a customer
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmIgnore}
        title={`Don't recover ${o.customerName.split(' ')[0]}?`}
        confirmLabel="Yes, ignore"
        onConfirm={handleIgnore}
        onCancel={() => setConfirmIgnore(false)}
      />
    </article>
  );
}


// components/recovery/QueueSummary.tsx


function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function QueueSummary({ active }: { active: OpportunityDoc[] }) {
  const total = active.length;
  const autonomous = active.filter((o) => o.decisionBand !== 'human_required').length;
  const needsYou = total - autonomous;

  if (total === 0) return null;

  return (
    <div className="mb-1">
      <h1 className="text-xl font-semibold text-neutral-900">
        {pluralize(total, 'customer')} may be slipping away
      </h1>
      {autonomous > 0 && needsYou > 0 && (
        <p className="mt-1 text-sm text-neutral-500">
          {pluralize(autonomous, 'can be')} handled automatically. {pluralize(needsYou, 'may need you')}.
        </p>
      )}
    </div>
  );
}



// components/recovery/PriorityFilterTabs.tsx

const TABS: { id: QueueFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_you', label: 'Needs you' },
  { id: 'handled', label: 'Handled' },
];

export function PriorityFilterTabs({
  value,
  onChange,
}: {
  value: QueueFilter;
  onChange: (v: QueueFilter) => void;
}) {
  return (
    <div role="tablist" aria-label="Filter recovery queue" className="flex gap-1 rounded-full bg-neutral-100 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            'min-h-[36px] flex-1 rounded-full px-3 text-sm font-medium transition-colors',
            value === tab.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}



// components/recovery/EmptyState.tsx
export function EmptyState({ handledThisWeek }: { handledThisWeek?: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 px-6 py-16 text-center">
      <div aria-hidden="true" className="mb-4 h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-2xl">
        ✓
      </div>
      <h2 className="text-base font-semibold text-neutral-900">You're all caught up.</h2>
      <p className="mt-1 max-w-xs text-sm text-neutral-500">
        Isolynic isn't seeing any customers that need attention right now.
      </p>
      {typeof handledThisWeek === 'number' && handledThisWeek > 0 && (
        <p className="mt-3 text-xs text-neutral-400">
          {handledThisWeek} customer conversations handled this week.
        </p>
      )}
    </div>
  );
}



// components/recovery/RecentlyRecoveredList.tsx

function outcomeText(o: OpportunityDoc): string {
  if (o.outcomeNote) return o.outcomeNote;
  if (o.outcome === 'booked') return 'Appointment booked.';
  if (o.outcome === 'won') return 'Customer returned after follow-up.';
  return 'Customer replied.';
}

export function RecentlyRecoveredList({ items }: { items: OpportunityDoc[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recently-recovered-heading" className="mt-8">
      <h2 id="recently-recovered-heading" className="text-sm font-medium text-neutral-500">
        Recently recovered
      </h2>
      <ul className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-100">
        {items.map((o) => (
          <li key={o.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-neutral-800">{o.customerName}</span>
            <span className="text-sm text-neutral-500">{outcomeText(o)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}



// components/recovery/QueueSkeleton.tsx
export function QueueSkeleton() {
  return (
    <div aria-label="Checking your customers…" role="status" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-neutral-100 p-4 sm:p-5">
          <div className="h-4 w-1/3 rounded bg-neutral-100" />
          <div className="mt-3 h-3 w-2/3 rounded bg-neutral-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
          <div className="mt-4 h-9 w-24 rounded-xl bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}



// components/recovery/Banners.tsx
export function NewOpportunityBanner({ onView, onDismiss }: { onView: () => void; onDismiss: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-sm">
      <span className="text-neutral-700">1 new customer may need attention</span>
      <div className="flex items-center gap-3">
        <button onClick={onView} className="font-medium text-neutral-900 underline underline-offset-2 min-h-[36px]">
          View
        </button>
        <button onClick={onDismiss} aria-label="Dismiss" className="text-neutral-400 min-h-[36px] min-w-[36px]">
          ✕
        </button>
      </div>
    </div>
  );
}

export function OfflineBanner({ fromCache }: { fromCache: boolean }) {
  return (
    <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
      We couldn't check for new customer activity. Your last results are still here.
      {fromCache && <span className="text-amber-600"> (Updated recently)</span>}
    </div>
  );
}