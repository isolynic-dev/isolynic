
// app/recovery/page.tsx
'use client';

import { useAuthedBusiness } from '@/hooks/hooks'; // returns { businessId } from session
import { useRecoveryQueue, useFilteredQueue, useOnlineStatus, type QueueFilter } from '@/hooks/hooks';
import { QueueSummary } from '@/components/recovery';
import { PriorityFilterTabs } from '@/components/recovery';
import { OpportunityCard } from '@/components/recovery';
import { RecentlyRecoveredList } from '@/components/recovery';
import { EmptyState } from '@/components/recovery';
import { QueueSkeleton } from '@/components/recovery';
import { NewOpportunityBanner, OfflineBanner } from '@/components/recovery';
import { ToastProvider } from '@/components/recovery';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';




function RecoveryQueueScreen() {
  const { businessId } = useAuthedBusiness();
  const [filter, setFilter] = useState<QueueFilter>('all');
  const online = useOnlineStatus();

  const { loading, errored, fromCache, active, recentlyRecovered, newlyArrivedId, dismissNewlyArrived } =
    useRecoveryQueue(businessId);

  const filtered = useFilteredQueue(active, filter);

  return (
    <main className="mx-auto w-full max-w-[1150px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Recovery</p>
          <p className="text-sm text-neutral-400">Customers who may need saving</p>
        </div>
      </header>

      {!online && <OfflineBanner fromCache={fromCache} />}
      {errored && (
        <OfflineBanner fromCache={fromCache} />
      )}

      {newlyArrivedId && (
        <NewOpportunityBanner
          onView={() => {
            document.getElementById(`opportunity-${newlyArrivedId}`)?.scrollIntoView({ behavior: 'smooth' });
            dismissNewlyArrived();
          }}
          onDismiss={dismissNewlyArrived}
        />
      )}

      <div className="mb-4">
        <QueueSummary active={active} />
      </div>

      {active.length > 0 && (
        <div className="mb-5 max-w-xs">
          <PriorityFilterTabs value={filter} onChange={setFilter} />
        </div>
      )}

      {loading ? (
        <QueueSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState handledThisWeek={recentlyRecovered.length} />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div id={`opportunity-${o.id}`} key={o.id}>
              <OpportunityCard opportunity={o} />
            </div>
          ))}
        </div>
      )}

      {filter === 'all' && <RecentlyRecoveredList items={recentlyRecovered} />}
    </main>
  );
}

export default function RecoveryQueuePage() {
  return (
    <ToastProvider>
      <RecoveryQueueScreen />
    </ToastProvider>
  );
}

// hooks/useAuthedBusiness.ts


export function useAuthedBusiness() {
  const [uid, setUid] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null)), []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), (snap) => {
      setBusinessId((snap.data()?.businessId as string) ?? null);
    });
  }, [uid]);

  return { uid, businessId };
}