
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthedBusiness } from '@/lib/auth'; // existing app hook: returns { businessId, isMobile }
import { useResults } from '@/lib/results';
import { formatRelativeFreshness } from '@/lib/results';
import type { ResultsPeriod } from '@/types/results';
import { TimePeriodSelector } from '@/components/results';
import { HeroMetric } from '@/components/results';
import { RevenueEstimateNote } from '@/components/results';
import { SecondaryMetricsGrid } from '@/components/results';
import { RecoveryEvidenceList } from '@/components/results';
import { RecoveryTrend } from '@/components/results';
import { StillAtRiskBanner } from '@/components/results';
import {
  ResultsSkeleton,
  ResultsZeroState,
  ResultsEarlyUsageState,
  ResultsErrorState,
  ResultsPartialBanner,
} from '@/components/results';

export default function ResultsPage() {
  const router = useRouter();
  const { businessId, isMobile } = useAuthedBusiness();
  const [period, setPeriod] = useState<ResultsPeriod>(30);

  const { data, settings, loading, error, isPartial, refresh, lastRefreshedAt } = useResults(
    businessId,
    period
  );

  // Pull-to-refresh (mobile) support via native scroll listener could be wired
  // in a shared layout; here we expose a manual refresh affordance instead.
  const handleRefresh = useCallback(() => refresh(), [refresh]);

  const goToOpportunities = useCallback(
    (filter: 'recovered' | 'at_risk' | 'reactivated' | 'booked' | 'lost') => {
      router.push(`/opportunities?filter=${filter}&period=${period}`);
    },
    [router, period]
  );

  const goToRecoveryQueue = useCallback(() => {
    router.push('/recovery-queue?filter=at_risk');
  }, [router]);

  const goToOpportunityDetail = useCallback(
    (opportunityId: string) => {
      router.push(`/opportunities/${opportunityId}`);
    },
    [router]
  );

  const goToAccountCustomerValue = useCallback(() => {
    router.push('/account/settings#typical-customer-value');
  }, [router]);

  const [revenueExplainerOpen, setRevenueExplainerOpen] = useState(false);

  useEffect(() => {
    document.title = 'Results — Isolynic';
  }, []);

  const headline = data?.headline ?? null;
  const currency = settings?.currency ?? 'USD';
  const locale = settings?.locale ?? 'en-US';
  const hasTypicalValue = !!settings?.typical_customer_value;

  const isTrulyEmpty =
    !loading && !error && headline && headline.opportunities_recovered === 0 &&
    headline.opportunities_still_at_risk === 0 && headline.opportunities_lost === 0 &&
    (data?.evidence?.length ?? 0) === 0 &&
    // no activity at all recorded historically for this business
    headline.customers_reactivated === 0 && headline.bookings_recovered === 0;

  const isEarlyUsage =
    !loading && !error && headline && headline.opportunities_recovered === 0 &&
    !isTrulyEmpty;

  return (
    <main className="mx-auto w-full max-w-[1160px] px-4 sm:px-6 py-6 sm:py-10">
      {/* Region A — Header */}
      <header className="flex items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Results</h1>
          <p className="hidden sm:block text-sm text-neutral-500 mt-0.5">
            See what Isolynic recovered for your business.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Region B — Time period selector */}
          <TimePeriodSelector value={period} onChange={setPeriod} disabled={loading} />
          
            href="/help/results"
            className="hidden sm:inline text-sm text-neutral-500 hover:text-neutral-800 focus:outline-none"
          >
            Help
          </a>
        </div>
      </header>

      {lastRefreshedAt && !loading && !error && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-neutral-400">
            {formatRelativeFreshness(lastRefreshedAt)}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs text-neutral-500 hover:text-neutral-800 underline focus:outline-none"
          >
            Refresh
          </button>
        </div>
      )}

      {loading && <ResultsSkeleton />}

      {!loading && error && <ResultsErrorState onRetry={handleRefresh} />}

      {!loading && !error && isTrulyEmpty && (
        <ResultsZeroState onLearnMore={() => router.push('/help/how-recovery-works')} />
      )}

      {!loading && !error && !isTrulyEmpty && isEarlyUsage && <ResultsEarlyUsageState />}

      {!loading && !error && headline && !isTrulyEmpty && !isEarlyUsage && (
        <div className="space-y-8">
          {isPartial && <ResultsPartialBanner />}

          {/* Region C — Primary value summary */}
          <div>
            <HeroMetric
              headline={headline}
              currency={currency}
              locale={locale}
              hasTypicalValue={hasTypicalValue}
              onDrillOpportunitiesRecovered={() => goToOpportunities('recovered')}
              onDrillBookings={() => goToOpportunities('booked')}
              onOpenRevenueExplainer={() => setRevenueExplainerOpen(true)}
              onAddCustomerValue={goToAccountCustomerValue}
            />
            {headline.estimated_revenue_recovered !== null && (
              <RevenueEstimateNote />
            )}
          </div>

          {/* Region D — Outcome breakdown */}
          <SecondaryMetricsGrid
            headline={headline}
            onDrillReactivated={() => goToOpportunities('reactivated')}
            onDrillAtRisk={() => goToOpportunities('at_risk')}
            onDrillLost={() => goToOpportunities('lost')}
          />

          {/* Region E — Recovery evidence */}
          {data && data.evidence.length > 0 && (
            <RecoveryEvidenceList items={data.evidence} onSelect={goToOpportunityDetail} />
          )}

          {/* Region F — Lightweight historical view */}
          {data && data.trend.length > 0 && (
            <RecoveryTrend points={data.trend} isMobile={isMobile} />
          )}

          {/* Still-at-risk CTA — feeds back into action, never a dead end */}
          <StillAtRiskBanner
            count={headline.opportunities_still_at_risk}
            onReview={goToRecoveryQueue}
          />
        </div>
      )}
    </main>
  );
}