
// app/account/page.tsx

'use client';

import { useAccount } from '@/hooks/hooks';
import { useAuth } from '@/hooks/hooks';
import { StatusBanner } from '@/components/account';
import { BusinessSection } from '@/components/account';
import { ChannelsSection } from '@/components/account';
import { BusinessHoursSection } from '@/components/account';
import { CalendarSection } from '@/components/account';
import { RecoveryPreferencesSection } from '@/components/account';
import { NotificationsSection } from '@/components/account';
import { BillingSection } from '@/components/account';
import { HelpAndControlsSection } from '@/components/account';




export default function AccountPage() {
  const { user } = useAuth();
  const { account, loading, error } = useAccount();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-gray-500">Loading your account…</p>
      </div>
    );
  }

  if (error || !account || !user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-red-700">We couldn't load your account. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your business information and how Isolynic works for you.
        </p>
      </header>

      <div className="mb-6">
        <StatusBanner account={account} />
      </div>

      {/* §55: single column on mobile, 2-column grid from tablet up */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BusinessSection uid={user.uid} business={account.business} />
        <ChannelsSection channels={account.channels} />
        <BusinessHoursSection uid={user.uid} hours={account.hours} />
        <CalendarSection uid={user.uid} calendar={account.calendar} />
        <RecoveryPreferencesSection uid={user.uid} recovery={account.recovery} />
        <NotificationsSection uid={user.uid} notifications={account.notifications} />
        <BillingSection subscription={account.subscription} />
        <HelpAndControlsSection runState={account.isolynicRunState} />
      </div>
    </div>
  );
}