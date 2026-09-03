// src/app/home/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";
import { useHomeSummary } from "@/hooks/hooks";
import { track } from "@/lib/analytics";

import { HomeHeader ,
 StatusHero ,
AttentionCard,
NeedsYouCard,
RecoverySummaryCard,
BookingsCard,
WeeklySummaryCard,
ActivityFeed,
CoverageBanner,
AccountStatusBanner,
OfflineIndicator,
HomeSkeleton,
HomeErrorState,
BottomNav,
 SideNav } from "@/components/home";

export default function HomePage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (user) => {
      setOwnerId(user?.uid ?? null);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  const { data, loading, error, isFromCache, isOnline, refresh } = useHomeSummary(
    authResolved ? ownerId : null
  );

  useEffect(() => {
    if (data) {
      track("home_viewed", { status: data.status });
    }
  }, [data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = !authResolved || loading;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <HomeHeader
        notificationCount={
          (data?.needsHumanCount ?? 0) + (data?.attentionCount ?? 0) > 0 ? 1 : 0
        }
      />

      <div className="mx-auto flex max-w-[1320px] md:pl-56">
        <SideNav />

        <main
          id="main-content"
          className="w-full pb-24 md:px-8 md:pb-12 md:pt-6"
          aria-label="Home"
        >
          {isLoading && <HomeSkeleton />}

          {!isLoading && error && !data && (
            <HomeErrorState message={error} onRetry={refresh} />
          )}

          {!isLoading && !error && !ownerId && (
            <HomeErrorState
              message="Sign in to see your customer activity."
              onRetry={refresh}
            />
          )}

          {!isLoading && data && (
            <div className="md:mx-auto md:max-w-3xl">
              <OfflineIndicator
                isOnline={isOnline}
                isFromCache={isFromCache}
                updatedAt={data.updatedAt}
              />

              <AccountStatusBanner account={data.account} />

              <StatusHero
                status={data.status}
                attentionCount={data.attentionCount}
                needsHumanCount={data.needsHumanCount}
              />

              <CoverageBanner
                coverage={data.coverage}
                degradedChannels={data.degradedChannels}
              />

              <NeedsYouCard opportunities={data.needsHumanOpportunities} />

              <AttentionCard
                opportunities={data.attentionOpportunities}
                recoverableAutomatically={data.recoverableAutomatically}
                needsHumanCount={data.needsHumanCount}
              />

              <RecoverySummaryCard
                recoveredThisWeek={data.recoveredThisWeek}
                bookedThisWeek={data.bookedThisWeek}
                repliedThisWeek={data.repliedThisWeek}
                stillDecidingThisWeek={data.stillDecidingThisWeek}
                activeRecoveries={data.activeRecoveries}
              />

              <BookingsCard
                bookingsThisWeekCount={data.bookingsThisWeekCount}
                nextBooking={data.nextBooking}
              />

              {/* §19 Empty state: nothing-to-do is itself a successful state */}
              {data.status === "healthy" && (
                <div className="mx-4 mt-4 rounded-2xl border border-neutral-200 bg-white p-5 text-center md:mx-0 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-[14px] text-neutral-600 dark:text-neutral-400">
                    {data.weeklySummary.recoveredCount} customers recovered this month
                  </p>
                </div>
              )}

              <WeeklySummaryCard summary={data.weeklySummary} />

              <ActivityFeed items={data.recentActivity} />
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}