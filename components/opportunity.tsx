
// components/opportunity/OpportunityHeader.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Opportunity, RecoverResponse  } from '@/types/opportunity';
import { relativeTime, formatCurrency, channelLabel } from '@/lib/format';
import type { OpportunityStatus } from '@/types/opportunity';
import type { TimelineEvent } from '@/types/opportunity';
import { dayLabel, timeOfDay } from '@/lib/format';



interface Props {
  opportunity: Opportunity;
  onOverflowAction: (action: 'not_opportunity' | 'won' | 'lost' | 'call' | 'note') => void;
  breadcrumbLabel?: string;
}

export function OpportunityHeader({ opportunity, onOverflowAction, breadcrumbLabel }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-neutral-200">
      <div className="mx-auto max-w-[1320px] px-4 md:px-8 py-3 flex items-center justify-between">
        {/* Mobile back button */}
        <button
          aria-label="Back"
          onClick={() => router.back()}
          className="md:hidden flex items-center gap-1 text-neutral-700 -ml-2 px-2 py-1.5 rounded-lg active:bg-neutral-100"
        >
          <ChevronLeftIcon />
          <span className="text-[15px]">Back</span>
        </button>

        {/* Desktop breadcrumb */}
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-sm text-neutral-500">
          <button onClick={() => router.push('/queue')} className="hover:text-neutral-800">
            Recovery Queue
          </button>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-900 font-medium">{breadcrumbLabel ?? opportunity.customer.name}</span>
        </nav>

        <span className="md:hidden text-[16px] font-semibold text-neutral-900">Opportunity</span>

        <div className="relative">
          <button
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-full active:bg-neutral-100 text-neutral-700"
          >
            <OverflowIcon />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 z-30"
            >
              <MenuItem
                label="Call"
                onClick={() => {
                  setMenuOpen(false);
                  onOverflowAction('call');
                }}
              />
              <MenuItem
                label="Add note"
                onClick={() => {
                  setMenuOpen(false);
                  onOverflowAction('note');
                }}
              />
              <div className="my-1 border-t border-neutral-100" />
              <MenuItem
                label="Mark won"
                onClick={() => {
                  setMenuOpen(false);
                  onOverflowAction('won');
                }}
              />
              <MenuItem
                label="Mark lost"
                onClick={() => {
                  setMenuOpen(false);
                  onOverflowAction('lost');
                }}
              />
              <div className="my-1 border-t border-neutral-100" />
              <MenuItem
                label="Not an opportunity"
                tone="danger"
                onClick={() => {
                  setMenuOpen(false);
                  onOverflowAction('not_opportunity');
                }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-[15px] hover:bg-neutral-50 ${
        tone === 'danger' ? 'text-red-600' : 'text-neutral-800'
      }`}
    >
      {label}
    </button>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OverflowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}




// components/opportunity/CustomerIdentity.tsx



export function CustomerIdentity({ opportunity }: { opportunity: Opportunity }) {
  const initials = opportunity.customer.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0">
        {opportunity.customer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opportunity.customer.avatarUrl}
            alt=""
            className="w-11 h-11 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-11 h-11 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-sm font-semibold"
          >
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h1 className="text-[26px] md:text-[32px] leading-tight font-semibold text-neutral-900 truncate">
          {opportunity.customer.name}
        </h1>
        <p className="text-[16px] text-neutral-600 mt-0.5">{opportunity.intentSummary}</p>
        <p className="text-[13px] text-neutral-400 mt-1">
          {channelLabel(opportunity.channels)} · {relativeTime(opportunity.lastActivityAt)}
        </p>
        {opportunity.valueBasis && opportunity.valueBasis !== 'none' && opportunity.valueEstimate ? (
          <p className="text-[13px] text-neutral-500 mt-1">
            {opportunity.valueBasis === 'owner_average'
              ? `Typical job value: about ${formatCurrency(opportunity.valueEstimate)}`
              : `Estimated value: ${formatCurrency(opportunity.valueEstimate)}`}
          </p>
        ) : (
          <p className="text-[13px] text-neutral-400 mt-1">Value not set</p>
        )}
      </div>
    </div>
  );
}




// components/opportunity/StatusBanner.tsx


const STATUS_CONFIG: Record<
  OpportunityStatus,
  { label: string; subtext: string; tone: 'attention' | 'progress' | 'positive' | 'neutral' }
> = {
  active: { label: 'Active', subtext: 'Customer is still engaged.', tone: 'neutral' },
  needs_attention: {
    label: 'Needs attention',
    subtext: 'This customer may be slipping away.',
    tone: 'attention',
  },
  recovering: { label: 'Recovering', subtext: 'Isolynic is following up.', tone: 'progress' },
  owner_needed: { label: 'Owner needed', subtext: 'This needs your attention.', tone: 'attention' },
  recovered: { label: 'Recovered', subtext: 'Customer is responding again.', tone: 'positive' },
  booked: { label: 'Booked', subtext: 'The next step is confirmed.', tone: 'positive' },
  won: { label: 'Customer recovered', subtext: '', tone: 'positive' },
  lost: { label: 'Lost', subtext: 'This opportunity ended without conversion.', tone: 'neutral' },
  not_opportunity: { label: 'Not an opportunity', subtext: '', tone: 'neutral' },
};

const TONE_STYLES: Record<string, string> = {
  attention: 'bg-amber-50 border-amber-200 text-amber-900',
  progress: 'bg-blue-50 border-blue-200 text-blue-900',
  positive: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  neutral: 'bg-neutral-50 border-neutral-200 text-neutral-700',
};

const DOT_STYLES: Record<string, string> = {
  attention: 'bg-amber-500',
  progress: 'bg-blue-500',
  positive: 'bg-emerald-500',
  neutral: 'bg-neutral-400',
};

export function StatusBanner({
  status,
  overrideSubtext,
  justUpdated,
}: {
  status: OpportunityStatus;
  overrideSubtext?: string;
  justUpdated?: boolean;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 flex items-start gap-2.5 ${TONE_STYLES[config.tone]}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT_STYLES[config.tone]}`}
      />
      <div>
        <p className="font-semibold text-[15px] leading-snug">{config.label}</p>
        {(overrideSubtext ?? config.subtext) && (
          <p className="text-[14px] mt-0.5 opacity-90">{overrideSubtext ?? config.subtext}</p>
        )}
        {justUpdated && <p className="text-[12px] mt-1 font-medium opacity-75">Updated just now</p>}
      </div>
    </div>
  );
}



// components/opportunity/AttentionReason.tsx


function msToDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.floor(ms / 60_000)} minutes`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'}`;
}

export function AttentionReason({ opportunity }: { opportunity: Opportunity }) {
  const { evidence } = opportunity;

  return (
    <section aria-labelledby="why-heading" className="space-y-3">
      <h2 id="why-heading" className="text-[18px] md:text-[20px] font-semibold text-neutral-900">
        Why this needs attention
      </h2>
      <p className="text-[16px] leading-relaxed text-neutral-800">{opportunity.whyExplanation}</p>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-2 border-t border-neutral-100 pt-3">
        {evidence.customerAskedFor && (
          <EvidenceRow label="Customer asked for" value={evidence.customerAskedFor} />
        )}
        {evidence.lastCustomerMessage && (
          <EvidenceRow label="Last customer message" value={`"${evidence.lastCustomerMessage}"`} />
        )}
        {evidence.lastBusinessResponse && (
          <EvidenceRow label="Last business response" value={evidence.lastBusinessResponse} />
        )}
        {typeof evidence.timeSinceLastResponseMs === 'number' && (
          <EvidenceRow
            label="Time since last response"
            value={msToDuration(evidence.timeSinceLastResponseMs)}
          />
        )}
      </dl>
    </section>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-neutral-500">{label}</dt>
      <dd className="text-[15px] text-neutral-900 mt-0.5">{value}</dd>
    </div>
  );
}



// components/opportunity/OpportunitySummaryCard.tsx


export function OpportunitySummaryCard({ opportunity }: { opportunity: Opportunity }) {
  const { summary } = opportunity;
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
      <SummaryItem label="Customer wants" value={summary.customerNeed} />
      <SummaryItem label="Next step" value={summary.nextStep} />
      <SummaryItem label="What's blocking progress" value={summary.blocker} />
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-wide text-neutral-500 font-medium">{label}</p>
      <p className="text-[15px] text-neutral-900 mt-1">{value}</p>
    </div>
  );
}




// components/opportunity/OpportunityTimeline.tsx



interface Props {
  events: TimelineEvent[];
  earlierCount: number; // events not loaded/shown, summarized
  onViewFullConversation: () => void;
}

const EVENT_ICON: Record<string, string> = {
  call: '📞',
  message: '💬',
  quote_sent: '📄',
  booking_started: '🗓️',
  booking_confirmed: '✅',
  recovery_sent: '↩️',
  note_added: '📝',
  status_change: '•',
};

export function OpportunityTimeline({ events, earlierCount, onViewFullConversation }: Props) {
  const [expanded, setExpanded] = useState(false);

  const visibleEvents = expanded ? events : events.slice(-6);
  const groups = groupByDay(visibleEvents);

  return (
    <section aria-labelledby="timeline-heading" className="space-y-4">
      <h2 id="timeline-heading" className="text-[18px] md:text-[20px] font-semibold text-neutral-900">
        What happened
      </h2>

      {earlierCount > 0 && !expanded && (
        <button
          onClick={() => {
            setExpanded(true);
            onViewFullConversation();
          }}
          className="text-[14px] text-blue-600 font-medium hover:underline"
        >
          {earlierCount} earlier message{earlierCount === 1 ? '' : 's'} · View conversation
        </button>
      )}

      <ol className="relative border-l border-neutral-200 pl-5 space-y-5">
        {groups.map((group) => (
          <li key={group.day} className="relative">
            <p className="text-[13px] font-semibold text-neutral-500 mb-2 -ml-5 pl-5">{group.day}</p>
            <ul className="space-y-4">
              {group.events.map((evt) => (
                <li key={evt.id} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[26px] top-1 w-2.5 h-2.5 rounded-full bg-neutral-300 border-2 border-white"
                  />
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] text-neutral-400">{timeOfDay(evt.timestamp)}</span>
                    <span className="text-[15px] font-medium text-neutral-900">{evt.label}</span>
                  </div>
                  {evt.content && (
                    <p className="text-[14px] text-neutral-700 mt-0.5">
                      {evt.actor === 'customer' ? '' : evt.actor === 'owner' ? 'You: ' : 'Isolynic: '}
                      {evt.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function groupByDay(events: TimelineEvent[]) {
  const map = new Map<string, TimelineEvent[]>();
  for (const evt of events) {
    const key = dayLabel(evt.timestamp);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(evt);
  }
  return Array.from(map.entries()).map(([day, events]) => ({ day, events }));
}



// components/opportunity/RecommendationPanel.tsx

interface Props {
  opportunity: Opportunity;
  onRecover: (message?: string) => Promise<RecoverResponse>;
  onTakeover: () => Promise<void>;
  sticky?: boolean;
}

type LocalState = 'idle' | 'sending' | 'sent' | 'error';

export function RecommendationPanel({ opportunity, onRecover, onTakeover, sticky }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(opportunity.recommendedAction.suggestedMessage ?? '');
  const [state, setState] = useState<LocalState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const followUpLimitReached = opportunity.followUpCount >= opportunity.followUpLimit;
  const canRecover =
    !followUpLimitReached &&
    !opportunity.ownerHandling &&
    !opportunity.aiUncertain &&
    !opportunity.contextInsufficient &&
    opportunity.recommendedAction.actionType !== 'none';

  async function handleRecover() {
    setState('sending');
    setErrorMsg(null);
    try {
      const res = await onRecover(editing ? draft : undefined);
      if (res.status === 'success') {
        setState('sent');
      } else {
        setState('error');
        setErrorMsg(res.error ?? "We couldn't send the message.");
      }
    } catch (e) {
      setState('error');
      setErrorMsg("We couldn't send the message.");
    }
  }

  if (opportunity.contextInsufficient) {
    return (
      <PanelShell sticky={sticky}>
        <p className="font-semibold text-[16px] text-neutral-900">We don&apos;t know enough yet.</p>
        <p className="text-[14px] text-neutral-600 mt-1">
          This conversation may be important, but we don&apos;t have enough context to recommend a
          recovery action.
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <SecondaryButton label="View conversation" />
          <SecondaryButton label="Handle it myself" onClick={onTakeover} />
        </div>
      </PanelShell>
    );
  }

  if (opportunity.aiUncertain) {
    return (
      <PanelShell sticky={sticky}>
        <p className="font-semibold text-[16px] text-neutral-900">We need your help</p>
        <p className="text-[14px] text-neutral-600 mt-1">
          We aren&apos;t confident about what this customer needs.
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <PrimaryButton label="Handle it myself" onClick={onTakeover} />
          <SecondaryButton label="View conversation" />
        </div>
      </PanelShell>
    );
  }

  if (followUpLimitReached && opportunity.status !== 'recovered' && opportunity.status !== 'booked') {
    return (
      <PanelShell sticky={sticky}>
        <p className="text-[14px] text-neutral-600">
          Isolynic has tried {opportunity.followUpCount} times without a response.
        </p>
        <p className="font-semibold text-[16px] text-neutral-900 mt-1">
          This opportunity needs your judgment.
        </p>
        <PrimaryButton label="Handle it myself" onClick={onTakeover} className="mt-4" />
      </PanelShell>
    );
  }

  if (state === 'sent') {
    return (
      <PanelShell sticky={sticky}>
        <p className="font-semibold text-[16px] text-emerald-700">Recovery started</p>
        <p className="text-[14px] text-neutral-600 mt-1">Isolynic sent {opportunity.customer.name.split(' ')[0]} a follow-up.</p>
        <p className="text-[14px] text-neutral-500 mt-2">We&apos;ll watch for a response.</p>
        <SecondaryButton label="View conversation" className="mt-4" />
      </PanelShell>
    );
  }

  return (
    <PanelShell sticky={sticky}>
      <p className="text-[13px] uppercase tracking-wide font-semibold text-neutral-500">
        Isolynic recommends
      </p>
      <p className="text-[17px] font-semibold text-neutral-900 mt-1">
        {actionHeadline(opportunity.recommendedAction.actionType)}
      </p>
      <p className="text-[14px] text-neutral-600 mt-1.5 leading-relaxed">
        {opportunity.recommendedAction.reasonText}
      </p>

      {opportunity.recommendedAction.suggestedMessage && (
        <div className="mt-4">
          <p className="text-[13px] font-medium text-neutral-500 mb-1.5">Suggested message</p>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-neutral-300 p-3 text-[14px] text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 text-[14px] text-neutral-800 leading-relaxed">
              {draft}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="text-[13px] text-red-600 mt-2">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-col gap-2 mt-4">
        <PrimaryButton
          label={
            state === 'sending'
              ? 'Sending…'
              : `Recover ${opportunity.customer.name.split(' ')[0]}'s opportunity`
          }
          onClick={handleRecover}
          disabled={!canRecover || state === 'sending'}
        />
        {!editing && (
          <SecondaryButton label="Edit message" onClick={() => setEditing(true)} />
        )}
        <SecondaryButton label="Handle it myself" onClick={onTakeover} />
      </div>
    </PanelShell>
  );
}

function actionHeadline(actionType: Opportunity['recommendedAction']['actionType']): string {
  switch (actionType) {
    case 'follow_up':
      return 'Follow up now';
    case 'ask_clarifying':
      return 'Ask what they need';
    case 'escalate':
      return 'This needs your judgment';
    default:
      return 'No action needed';
  }
}

function PanelShell({ children, sticky }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <div
      className={`bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm ${
        sticky ? 'lg:sticky lg:top-24' : ''
      }`}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled,
  className = '',
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`w-full h-12 rounded-xl bg-neutral-900 text-white font-semibold text-[15px] active:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {label}
    </button>
  );
}

function SecondaryButton({
  label,
  onClick,
  className = '',
}: {
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-full h-12 rounded-xl border border-neutral-300 text-neutral-800 font-medium text-[15px] active:bg-neutral-50 transition-colors ${className}`}
    >
      {label}
    </button>
  );
}




// components/opportunity/SupportingDetails.tsx


interface Props {
  opportunity: Opportunity;
  onAddNote: (note: string) => Promise<void>;
  onCall: () => void;
  onMessage: () => void;
}

export function SupportingDetails({ opportunity, onAddNote, onCall, onMessage }: Props) {
  return (
    <section className="space-y-6">
      <div className="flex gap-2">
        {opportunity.customer.phone && (
          <ContactButton label="Call" onClick={onCall} />
        )}
        <ContactButton label="Message" onClick={onMessage} />
        {opportunity.bookingState.state === 'booked' && (
          <ContactButton label="View booking" onClick={() => {}} />
        )}
      </div>

      <BookingStatus booking={opportunity.bookingState} />

      {opportunity.recoveryAttempts.length > 0 && (
        <RecoveryHistory attempts={opportunity.recoveryAttempts} />
      )}

      <OwnerNote existingNote={opportunity.ownerNote} onSave={onAddNote} />
    </section>
  );
}

function ContactButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 h-10 rounded-lg border border-neutral-300 text-[14px] font-medium text-neutral-700 active:bg-neutral-50"
    >
      {label}
    </button>
  );
}

function BookingStatus({ booking }: { booking: Opportunity['bookingState'] }) {
  const label =
    booking.state === 'none'
      ? 'No appointment'
      : booking.state === 'requested'
      ? 'Appointment requested'
      : 'Appointment booked';

  return (
    <div>
      <h3 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Booking</h3>
      <p className="text-[15px] text-neutral-900">{label}</p>
      {booking.state === 'booked' && booking.scheduledAt && (
        <p className="text-[14px] text-neutral-600 mt-0.5">
          {new Date(booking.scheduledAt).toLocaleDateString(undefined, {
            weekday: 'long',
          })}{' '}
          ·{' '}
          {new Date(booking.scheduledAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}

function RecoveryHistory({ attempts }: { attempts: Opportunity['recoveryAttempts'] }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">
        Recovery history
      </h3>
      <ul className="space-y-1.5">
        {attempts.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-[14px] text-neutral-800">
            <span className="text-neutral-400 w-20 shrink-0">{dayLabel(a.sentAt)}</span>
            <span>{a.responded ? 'Customer responded' : 'Follow-up sent'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OwnerNote({
  existingNote,
  onSave,
}: {
  existingNote?: string;
  onSave: (note: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(existingNote ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Note</h3>
      {!editing && !existingNote && (
        <button onClick={() => setEditing(true)} className="text-[14px] text-blue-600 font-medium">
          + Add note
        </button>
      )}
      {!editing && existingNote && (
        <div>
          <p className="text-[14px] text-neutral-800">{existingNote}</p>
          <button
            onClick={() => setEditing(true)}
            className="text-[13px] text-blue-600 font-medium mt-1"
          >
            Edit
          </button>
        </div>
      )}
      {editing && (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={2}
            placeholder="e.g. Prefers afternoon appointments"
            className="w-full rounded-lg border border-neutral-300 p-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 h-9 rounded-lg bg-neutral-900 text-white text-[13px] font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 h-9 rounded-lg border border-neutral-300 text-[13px] font-medium text-neutral-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}




// components/opportunity/MobileActionBar.tsx


interface Props {
  onRecover: () => void;
  onHandleMyself: () => void;
  onMore: (action: 'not_opportunity' | 'won' | 'lost' | 'call' | 'note') => void;
  recoverDisabled?: boolean;
}

export function MobileActionBar({ onRecover, onHandleMyself, onMore, recoverDisabled }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}
      {moreOpen && (
        <div className="fixed bottom-[76px] left-0 right-0 z-50 mx-4 bg-white rounded-xl border border-neutral-200 shadow-xl py-1 lg:hidden">
          {(['call', 'note', 'won', 'lost', 'not_opportunity'] as const).map((action) => (
            <button
              key={action}
              onClick={() => {
                setMoreOpen(false);
                onMore(action);
              }}
              className={`w-full text-left px-4 py-3 text-[15px] ${
                action === 'not_opportunity' ? 'text-red-600' : 'text-neutral-800'
              }`}
            >
              {moreLabel(action)}
            </button>
          ))}
        </div>
      )}
      <nav
        aria-label="Opportunity actions"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 px-3 py-2.5 flex gap-2 lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
      >
        <button
          onClick={onRecover}
          disabled={recoverDisabled}
          className="flex-[2] h-12 rounded-xl bg-neutral-900 text-white font-semibold text-[15px] disabled:opacity-40"
        >
          Recover
        </button>
        <button
          onClick={onHandleMyself}
          className="flex-1 h-12 rounded-xl border border-neutral-300 text-neutral-800 font-medium text-[15px]"
        >
          Handle myself
        </button>
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More actions"
          className="w-12 h-12 rounded-xl border border-neutral-300 text-neutral-800 flex items-center justify-center"
        >
          ⋯
        </button>
      </nav>
    </>
  );
}

function moreLabel(action: string): string {
  switch (action) {
    case 'call':
      return 'Call';
    case 'note':
      return 'Add note';
    case 'won':
      return 'Mark won';
    case 'lost':
      return 'Mark lost';
    case 'not_opportunity':
      return 'Not an opportunity';
    default:
      return action;
  }
}




// components/opportunity/DismissConfirmDialog.tsx


export function DismissConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dismiss-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <p id="dismiss-title" className="text-[16px] font-semibold text-neutral-900">
          Remove this from your recovery list?
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={onConfirm}
            className="h-12 rounded-xl bg-neutral-900 text-white font-semibold text-[15px]"
          >
            Yes, remove it
          </button>
          <button
            onClick={onCancel}
            className="h-12 rounded-xl border border-neutral-300 text-neutral-800 font-medium text-[15px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}




// components/opportunity/ResolveDialog.tsx


const LOST_REASONS = [
  { value: 'chose_another', label: 'Chose another business' },
  { value: 'no_longer_needed', label: 'No longer needed' },
  { value: 'price', label: 'Price' },
  { value: 'timing', label: 'Timing' },
  { value: 'unreachable', label: "Couldn't reach them" },
  { value: 'other', label: 'Other' },
];

export function ResolveDialog({
  open,
  outcome,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  outcome: 'won' | 'lost' | null;
  onConfirm: (detail: { value?: number; reason?: string }) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  if (!open || !outcome) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        {outcome === 'won' ? (
          <>
            <p className="text-[16px] font-semibold text-emerald-700">Customer recovered</p>
            <p className="text-[14px] text-neutral-600 mt-1">What was the final value? (optional)</p>
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="$0"
              className="w-full mt-2 rounded-lg border border-neutral-300 p-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </>
        ) : (
          <>
            <p className="text-[16px] font-semibold text-neutral-900">Why was this lost?</p>
            <div className="mt-3 space-y-1.5">
              {LOST_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2.5 text-[15px] text-neutral-800">
                  <input
                    type="radio"
                    name="lost-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </>
        )}
        <div className="flex flex-col gap-2 mt-5">
          <button
            onClick={() =>
              onConfirm(outcome === 'won' ? { value: value ? Number(value) : undefined } : { reason })
            }
            className="h-12 rounded-xl bg-neutral-900 text-white font-semibold text-[15px]"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="h-12 rounded-xl border border-neutral-300 text-neutral-800 font-medium text-[15px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}