
// components/account/ui/Card.tsx
import { ReactNode } from 'react';
import type { AccountState } from '@/types/account';
import type { ChannelStatus } from '@/types/account';
import { useState } from 'react';
import { AccountCard } from './ui/Card';
import { SavedPill } from './ui/SavedPill';
import { updateBusinessInfo } from '@/lib/account';
import { useSavedConfirmation } from '@/hooks/hooks';
import type { BusinessInfo } from '@/types/account';
import { useState } from 'react';
import { AccountCard } from './ui/Card';
import { StatusBadge } from './ui/StatusBadge';
import { callDisconnectChannel, callTestChannel } from '@/lib/account';
import type { ChannelsState } from '@/types/account';
import { useState } from 'react';
import { AccountCard } from './ui/Card';
import { updateBusinessHours } from '@/lib/account';
import { useSavedConfirmation } from '@/hooks/hooks';
import { SavedPill } from './ui/SavedPill';
import type { BusinessHoursState, DayHours, AfterHoursBehavior } from '@/types/account';
import { useState } from 'react';
import { AccountCard } from './ui/Card';
import { StatusBadge } from './ui/StatusBadge';
import {
  callStartCalendarConnect,
  callDisconnectCalendar,
  callTestCalendarEvent,
  updateCalendarPrefs,
} from '@/lib/account';
import type { CalendarState } from '@/types/account';
import { AccountCard } from './ui/Card';
import { Toggle } from './ui/Toggle';
import { updateRecoveryPreferences } from '@/lib/account';
import { useSavedConfirmation } from '@/hooks/hooks';
import { SavedPill } from './ui/SavedPill';
import type { RecoveryPreferencesState, PersistenceLevel } from '@/types/account';
import { AccountCard } from './ui/Card';
import { Toggle } from './ui/Toggle';
import { updateNotifications } from '@/lib/account';
import { useSavedConfirmation } from '@/hooks/hooks';
import { SavedPill } from './ui/SavedPill';
import type { NotificationsState } from '@/types/account';
import { useState } from 'react';
import { AccountCard } from './ui/Card';
import { callCreateBillingPortalSession } from '@/lib/account';
import type { SubscriptionState } from '@/types/account';
import { useState } from 'react';
import { AccountCard } from './ui/Card';
import {
  callPauseIsolynic,
  callResumeIsolynic,
  callDeleteAccount,
  callSubmitFeedback,
} from '@/lib/account';
import type { IsolynicRunState } from '@/types/account';








export function AccountCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </header>
      <div className="space-y-3">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}



// components/account/ui/StatusBadge.tsx



const STATUS_CONFIG: Record<ChannelStatus, { label: string; className: string; icon: string }> = {
  connected: { label: 'Connected', className: 'bg-green-50 text-green-700', icon: '✓' },
  not_connected: { label: 'Not connected', className: 'bg-gray-100 text-gray-600', icon: '' },
  needs_attention: { label: 'Needs attention', className: 'bg-amber-50 text-amber-700', icon: '!' },
  paused: { label: 'Paused', className: 'bg-gray-100 text-gray-600', icon: '' },
};

// §57: never rely on color alone — icon + text always present
export function StatusBadge({ status }: { status: ChannelStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
      role="status"
      aria-label={cfg.label}
    >
      {cfg.icon && <span aria-hidden="true">{cfg.icon}</span>}
      {cfg.label}
    </span>
  );
}



// components/account/ui/Toggle.tsx

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label} — ${checked ? 'On' : 'Off'}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors
          ${checked ? 'bg-emerald-600' : 'bg-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}




// components/account/ui/SavedPill.tsx

export function SavedPill({ visible }: { visible: boolean }) {
  if (!visible) return null;
  // §60/§73: plain confirmation, not "configuration persisted"
  return (
    <span className="ml-2 text-xs font-medium text-emerald-600 transition-opacity" role="status">
      Saved
    </span>
  );
}


// components/account/BusinessSection.tsx



const CATEGORIES = [
  'Home services', 'Repair', 'Beauty', 'Automotive',
  'Education', 'Professional services', 'Hospitality', 'Retail', 'Other',
];

export function BusinessSection({ uid, business }: { uid: string; business: BusinessInfo }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(business);
  const [saving, setSaving] = useState(false);
  const { saved, flash } = useSavedConfirmation();

  const isComplete = Boolean(
    draft.businessName && draft.description && draft.phone && draft.serviceArea
  );

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessInfo(uid, draft);
      setEditing(false);
      flash();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <AccountCard title="Edit business" subtitle="This is what Isolynic uses to understand and help your customers.">
        <label className="block text-sm font-medium text-gray-700">
          Business name
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.businessName}
            onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          What do you do?
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Tell us what your business does."
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          What type of business is this?
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.category ?? ''}
            onChange={(e) => setDraft({ ...draft, category: e.target.value || null })}
          >
            <option value="">Not set</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Main phone
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          WhatsApp number
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.whatsapp}
            onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Website
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.website}
            onChange={(e) => setDraft({ ...draft, website: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Where do you serve customers?
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.serviceArea}
            onChange={(e) => setDraft({ ...draft, serviceArea: e.target.value })}
          />
        </label>
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            onClick={() => { setDraft(business); setEditing(false); }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
        </div>
      </AccountCard>
    );
  }

  return (
    <AccountCard
      title="Business"
      subtitle="The information Isolynic uses to understand and help your customers."
      action={
        <button
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Edit business
        </button>
      }
    >
      <p className="text-sm text-gray-900">{business.businessName || '—'}</p>
      <p className="text-sm text-gray-500">{business.description || 'No description yet'}</p>
      <p className="text-sm text-gray-500">{business.serviceArea || 'No service area set'}</p>
      <div className="flex items-center text-sm">
        <span className={isComplete ? 'text-emerald-700' : 'text-amber-700'}>
          {isComplete ? '✓ Up to date' : 'Some information is missing'}
        </span>
        <SavedPill visible={saved} />
      </div>
    </AccountCard>
  );
}



// components/account/ChannelsSection.tsx




type ChannelKey = 'whatsapp' | 'phone' | 'website';

const CHANNEL_COPY: Record<ChannelKey, { title: string; connectedLine: string }> = {
  whatsapp: { title: 'WhatsApp', connectedLine: 'Isolynic can help recover customer conversations here.' },
  phone: { title: 'Phone', connectedLine: 'Isolynic can detect missed customer calls here.' },
  website: { title: 'Website', connectedLine: 'Customers can contact you through your website.' },
};

export function ChannelsSection({ channels }: { channels: ChannelsState }) {
  const [openChannel, setOpenChannel] = useState<ChannelKey | null>(null);
  const [busy, setBusy] = useState<ChannelKey | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [confirmDisconnect, setConfirmDisconnect] = useState<ChannelKey | null>(null);

  async function handleTest(channel: ChannelKey) {
    setBusy(channel);
    try {
      const res = await callTestChannel({ channel });
      setTestResult((r) => ({ ...r, [channel]: res.data.message }));
    } catch {
      setTestResult((r) => ({ ...r, [channel]: "We couldn't reach this channel. Please try again." }));
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(channel: ChannelKey) {
    setBusy(channel);
    try {
      await callDisconnectChannel({ channel });
      setConfirmDisconnect(null);
      setOpenChannel(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AccountCard title="Customer channels" subtitle="Manage where customers can reach you.">
      {(Object.keys(channels) as ChannelKey[]).map((key) => {
        const ch = channels[key];
        const copy = CHANNEL_COPY[key];
        const isOpen = openChannel === key;

        return (
          <div key={key} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setOpenChannel(isOpen ? null : key)}
            >
              <span className="text-sm font-medium text-gray-900">{copy.title}</span>
              <StatusBadge status={ch.status} />
            </button>

            {isOpen && (
              <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
                {ch.status === 'connected' ? (
                  <>
                    <p className="text-sm text-gray-600">{copy.connectedLine}</p>
                    {ch.connectedNumberOrUrl && (
                      <p className="text-sm text-gray-900">{ch.connectedNumberOrUrl}</p>
                    )}
                    {testResult[key] && <p className="text-sm text-gray-600">{testResult[key]}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(key)}
                        disabled={busy === key}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => setConfirmDisconnect(key)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700"
                      >
                        Disconnect
                      </button>
                    </div>
                  </>
                ) : ch.status === 'needs_attention' ? (
                  <>
                    <p className="text-sm text-amber-700">
                      {copy.title} protection is paused. We need to reconnect your business {key === 'website' ? 'site' : 'number'}.
                    </p>
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
                      Reconnect {copy.title.toLowerCase()}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Let customers reach you where they already look for businesses.
                    </p>
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
                      Connect {copy.title.toLowerCase()}
                    </button>
                  </>
                )}

                {confirmDisconnect === key && (
                  <div className="rounded-lg border border-red-200 bg-white p-3">
                    <p className="text-sm font-medium text-gray-900">Stop protecting this channel?</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Isolynic will no longer receive customer activity from this channel.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleDisconnect(key)}
                        disabled={busy === key}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                      <button
                        onClick={() => setConfirmDisconnect(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700"
                      >
                        Keep connected
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </AccountCard>
  );
}



// components/account/BusinessHoursSection.tsx



const DAY_LABELS: Record<DayHours['day'], string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

const AFTER_HOURS_OPTIONS: { value: AfterHoursBehavior; label: string; description: string }[] = [
  { value: 'auto_help', label: 'Help customers automatically', description: 'Isolynic can respond to routine inquiries and help customers take the next step.' },
  { value: 'ask_first', label: 'Ask me first', description: 'Isolynic alerts you before taking action.' },
  { value: 'pause', label: 'Pause customer recovery', description: "Isolynic won't send recovery messages while you're closed." },
];

export function BusinessHoursSection({ uid, hours }: { uid: string; hours: BusinessHoursState }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(hours);
  const { saved, flash } = useSavedConfirmation();

  function setDay(day: DayHours['day'], patch: Partial<DayHours>) {
    setDraft((d) => ({
      ...d,
      days: d.days.map((row) => (row.day === day ? { ...row, ...patch } : row)),
    }));
  }

  async function handleSave() {
    await updateBusinessHours(uid, draft);
    setEditing(false);
    flash();
  }

  if (editing) {
    return (
      <AccountCard title="Edit hours" subtitle="Tell Isolynic when your business is normally available.">
        {draft.days.map((row) => (
          <div key={row.day} className="flex items-center justify-between gap-3 py-1">
            <span className="w-24 text-sm text-gray-900">{DAY_LABELS[row.day]}</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.isOpen}
                onChange={(e) => setDay(row.day, { isOpen: e.target.checked })}
              />
              Open
            </label>
            {row.isOpen && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  value={row.openTime}
                  onChange={(e) => setDay(row.day, { openTime: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1"
                />
                <span>→</span>
                <input
                  type="time"
                  value={row.closeTime}
                  onChange={(e) => setDay(row.day, { closeTime: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1"
                />
              </div>
            )}
          </div>
        ))}

        <div className="pt-2">
          <p className="text-sm font-medium text-gray-900">How should Isolynic help customers outside your normal hours?</p>
          <div className="mt-2 space-y-2">
            {AFTER_HOURS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-start gap-2 rounded-lg border border-gray-200 p-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={draft.afterHoursBehavior === opt.value}
                  onChange={() => setDraft((d) => ({ ...d, afterHoursBehavior: opt.value }))}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                  <span className="block text-sm text-gray-500">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
            Save changes
          </button>
          <button
            onClick={() => { setDraft(hours); setEditing(false); }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
        </div>
      </AccountCard>
    );
  }

  return (
    <AccountCard
      title="Business hours"
      subtitle="Tell Isolynic when your business is normally available."
      action={
        <button onClick={() => setEditing(true)} className="text-sm font-medium text-emerald-700 hover:underline">
          Edit hours
        </button>
      }
    >
      {hours.days.map((row) => (
        <div key={row.day} className="flex justify-between text-sm">
          <span className="text-gray-500">{DAY_LABELS[row.day]}</span>
          <span className="text-gray-900">{row.isOpen ? `${row.openTime} – ${row.closeTime}` : 'Closed'}</span>
        </div>
      ))}
      <SavedPill visible={saved} />
    </AccountCard>
  );
}



// components/account/CalendarSection.tsx



export function CalendarSection({ uid, calendar }: { uid: string; calendar: CalendarState }) {
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function handleConnect() {
    setBusy(true);
    try {
      const redirectUri = `${window.location.origin}/account/calendar/callback`;
      const { data } = await callStartCalendarConnect({ redirectUri });
      window.location.href = data.authUrl;
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await callDisconnectCalendar({});
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    try {
      const { data } = await callTestCalendarEvent({});
      setTestMsg(data.message);
    } finally {
      setBusy(false);
    }
  }

  if (calendar.connectionStatus !== 'connected') {
    return (
      <AccountCard title="Calendar" subtitle="Let Isolynic help customers book available times.">
        <p className="text-sm text-gray-500">No calendar connected yet.</p>
        <button
          onClick={handleConnect}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Connect Google Calendar
        </button>
      </AccountCard>
    );
  }

  return (
    <AccountCard title="Calendar" subtitle="Let Isolynic help customers book available times.">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-900">Google Calendar</span>
        <StatusBadge status={calendar.connectionStatus} />
      </div>

      <label className="block text-sm font-medium text-gray-700">
        When should customers be able to book?
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={calendar.availabilitySource}
          onChange={(e) =>
            updateCalendarPrefs(uid, { availabilitySource: e.target.value as CalendarState['availabilitySource'] })
          }
        >
          <option value="calendar">Use my calendar availability</option>
          <option value="business_hours">Use my business hours</option>
        </select>
      </label>

      <label className="block text-sm font-medium text-gray-700">
        Typical appointment length
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={calendar.appointmentDurationMinutes}
          onChange={(e) =>
            updateCalendarPrefs(uid, {
              appointmentDurationMinutes: Number(e.target.value) as CalendarState['appointmentDurationMinutes'],
            })
          }
        >
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>60 min</option>
        </select>
      </label>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">Advanced</summary>
        <label className="mt-2 block text-sm font-medium text-gray-700">
          Leave time between appointments
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={calendar.bufferMinutes}
            onChange={(e) =>
              updateCalendarPrefs(uid, { bufferMinutes: Number(e.target.value) as CalendarState['bufferMinutes'] })
            }
          >
            <option value={0}>Off</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
          </select>
        </label>
      </details>

      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-medium text-gray-900">Appointment confirmation</span>
        <input
          type="checkbox"
          checked={calendar.confirmationEnabled}
          onChange={(e) => updateCalendarPrefs(uid, { confirmationEnabled: e.target.checked })}
        />
      </div>

      {testMsg && <p className="text-sm text-gray-600">{testMsg}</p>}

      <div className="flex gap-2 pt-2">
        <button onClick={handleTest} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          Test
        </button>
        <button onClick={handleDisconnect} disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50">
          Disconnect
        </button>
      </div>
    </AccountCard>
  );
}



// components/account/RecoveryPreferencesSection.tsx


const PERSISTENCE_OPTIONS: { value: PersistenceLevel; label: string; description: string }[] = [
  { value: 'gentle', label: 'Gentle', description: 'Fewer follow-ups. Best if you prefer to keep communication minimal.' },
  { value: 'balanced', label: 'Balanced', description: 'A reasonable amount of follow-up for most businesses.' },
  { value: 'persistent', label: 'Persistent', description: 'More follow-up when a customer seems genuinely interested.' },
];

export function RecoveryPreferencesSection({
  uid,
  recovery,
}: {
  uid: string;
  recovery: RecoveryPreferencesState;
}) {
  const { saved, flash } = useSavedConfirmation();

  async function patch(update: Partial<RecoveryPreferencesState>) {
    await updateRecoveryPreferences(uid, update);
    flash();
  }

  return (
    <AccountCard
      title="Recovery preferences"
      subtitle="Choose how Isolynic should help when a customer may be slipping away."
    >
      <Toggle
        label="Automatic recovery"
        description="When a customer may be slipping away, Isolynic can follow up for you."
        checked={recovery.automaticRecovery}
        onChange={(v) => patch({ automaticRecovery: v })}
      />

      {recovery.automaticRecovery && (
        <div className="rounded-lg bg-gray-50 p-3 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900">How persistent should Isolynic be?</p>
            <div className="mt-2 space-y-2">
              {PERSISTENCE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={recovery.persistenceLevel === opt.value}
                    onChange={() => patch({ persistenceLevel: opt.value })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                    <span className="block text-sm text-gray-500">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Maximum follow-ups
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={recovery.maxFollowups}
              onChange={(e) =>
                patch({ maxFollowups: Number(e.target.value) as RecoveryPreferencesState['maxFollowups'] })
              }
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <Toggle
            label="Ask me before sending sensitive messages"
            description="Isolynic will ask you before sending messages when it isn't confident about what to say."
            checked={recovery.requireHumanApproval}
            onChange={(v) => patch({ requireHumanApproval: v })}
          />
        </div>
      )}
      <SavedPill visible={saved} />
    </AccountCard>
  );
}



// components/account/NotificationsSection.tsx




export function NotificationsSection({
  uid,
  notifications,
}: {
  uid: string;
  notifications: NotificationsState;
}) {
  const { saved, flash } = useSavedConfirmation();

  async function patch(update: Partial<NotificationsState>) {
    await updateNotifications(uid, update);
    flash();
  }

  return (
    <AccountCard title="Notifications" subtitle="We'll only notify you when something matters.">
      <Toggle
        label="Customers needing you"
        description="Tell me when a customer needs my attention."
        checked={notifications.customersNeedingAttention}
        onChange={(v) => patch({ customersNeedingAttention: v })}
      />
      <Toggle
        label="Important customer recovery"
        description="Tell me when an important opportunity is at risk."
        checked={notifications.importantRecovery}
        onChange={(v) => patch({ importantRecovery: v })}
      />
      <Toggle
        label="Daily summary"
        description="Send me a simple summary of customer activity."
        checked={notifications.dailySummary}
        onChange={(v) => patch({ dailySummary: v })}
      />
      <Toggle
        label="Weekly results"
        description="Show me what Isolynic recovered this week."
        checked={notifications.weeklyResults}
        onChange={(v) => patch({ weeklyResults: v })}
      />
      <SavedPill visible={saved} />
    </AccountCard>
  );
}



// components/account/BillingSection.tsx




export function BillingSection({ subscription }: { subscription: SubscriptionState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManagePlan() {
    setBusy(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/account`;
      const { data } = await callCreateBillingPortalSession({ returnUrl });
      window.location.href = data.url;
    } catch {
      setError("We couldn't update your plan. Try again or contact support.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountCard title="Plan & billing" subtitle="Manage your Isolynic subscription.">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">{subscription.planName}</span>
        <span className="text-gray-900">{subscription.priceLabel}</span>
      </div>
      {subscription.renewalDateISO && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Next payment</span>
          <span className="text-gray-900">
            {new Date(subscription.renewalDateISO).toLocaleDateString(undefined, {
              month: 'long', day: 'numeric',
            })}
          </span>
        </div>
      )}

      <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
        This month
        <p className="mt-1 text-gray-900">
          {subscription.usage.opportunitiesProtected} customer opportunities protected ·{' '}
          {subscription.usage.opportunitiesRecovered} recovered
        </p>
        {subscription.usage.usagePercentOfPlan != null && subscription.usage.usagePercentOfPlan >= 80 && (
          <p className="mt-1 text-amber-700">
            You've used {subscription.usage.usagePercentOfPlan}% of your monthly customer conversations.
          </p>
        )}
      </div>

      {subscription.status === 'past_due' && (
        <p className="text-sm text-red-700">
          We couldn't update your plan. <button onClick={handleManagePlan} className="underline">Try again</button> or{' '}
          <a href="/support" className="underline">get help</a>.
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        onClick={handleManagePlan}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Manage plan
      </button>
    </AccountCard>
  );
}



// components/account/HelpAndControlsSection.tsx


export function HelpAndControlsSection({ runState }: { runState: IsolynicRunState }) {
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const isPaused = runState === 'paused';

  async function handlePauseToggle() {
    setBusy(true);
    try {
      if (isPaused) await callResumeIsolynic({});
      else await callPauseIsolynic({});
    } finally {
      setBusy(false);
    }
  }

  async function handleSendFeedback() {
    if (!feedbackText.trim()) return;
    await callSubmitFeedback({ text: feedbackText });
    setFeedbackText('');
    setFeedbackOpen(false);
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 2500);
  }

  async function handleDeleteConfirmed() {
    setBusy(true);
    try {
      await callDeleteAccount({ confirm: true });
      window.location.href = '/goodbye';
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AccountCard title="Help" subtitle="Need a hand?">
        <a href="/support" className="block text-sm font-medium text-emerald-700 hover:underline">
          Get help
        </a>
        {!feedbackOpen ? (
          <button
            onClick={() => setFeedbackOpen(true)}
            className="block text-sm font-medium text-emerald-700 hover:underline"
          >
            Give feedback
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="What should we improve?"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <button
              onClick={handleSendFeedback}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              Send feedback
            </button>
          </div>
        )}
        {feedbackSent && <p className="text-sm text-emerald-600">Thanks — we read every one of these.</p>}
      </AccountCard>

      <AccountCard title="Account controls" subtitle="">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {isPaused ? 'Resume Isolynic' : 'Pause customer recovery'}
          </p>
          <p className="text-sm text-gray-500">
            {isPaused
              ? 'Customer recovery is currently off.'
              : "Isolynic will stop recovering customer opportunities until you turn it back on."}
          </p>
          <button
            onClick={handlePauseToggle}
            disabled={busy}
            className={`mt-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              isPaused ? 'bg-emerald-600 text-white' : 'border border-amber-300 text-amber-800'
            }`}
          >
            {isPaused ? 'Resume Isolynic' : 'Pause Isolynic'}
          </button>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <a href="/logout" className="text-sm font-medium text-gray-700 hover:underline">
            Sign out
          </a>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm font-medium text-red-700 hover:underline"
          >
            Delete account
          </button>
          <p className="text-sm text-gray-500">
            Permanently delete your Isolynic account and stored data.
          </p>
        </div>
      </AccountCard>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5">
            <h3 className="text-base font-semibold text-gray-900">Delete your account?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently delete your Isolynic account and stored information. This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeleteConfirmed}
                disabled={busy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Delete account
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



// components/account/StatusBanner.tsx


export function StatusBanner({ account }: { account: AccountState }) {
  const { isolynicRunState, channels, calendar } = account;

  if (isolynicRunState === 'protected') {
    return (
      <div className="rounded-xl bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-800">Isolynic is protecting your customers</p>
        <ul className="mt-1 space-y-0.5 text-sm text-emerald-700">
          {channels.whatsapp.status === 'connected' && <li>✓ WhatsApp connected</li>}
          {channels.phone.status === 'connected' && <li>✓ Phone connected</li>}
          {calendar.connectionStatus === 'connected' && <li>✓ Calendar connected</li>}
        </ul>
      </div>
    );
  }

  if (isolynicRunState === 'paused') {
    return (
      <div className="rounded-xl bg-gray-100 p-4">
        <p className="text-sm font-medium text-gray-800">Isolynic is paused</p>
        <p className="text-sm text-gray-600">Customer recovery is currently off.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-800">Isolynic needs your attention</p>
      <p className="text-sm text-amber-700">
        {channels.whatsapp.status === 'needs_attention' && 'Your WhatsApp connection needs to be reconnected. '}
        {channels.phone.status === 'needs_attention' && 'Your phone connection needs to be reconnected. '}
        {calendar.connectionStatus === 'needs_attention' && 'Your calendar needs reconnecting. '}
      </p>
    </div>
  );
}