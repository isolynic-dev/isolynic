'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
formatRelativeFreshness,
useResults,
} from '@/lib/results';

import { useAuthedBusiness } from '@/lib/auth';

import type {
ResultsPeriod,
ResultsHeadline,
} from '@/types/results';

type OpportunityFilter =
| 'recovered'
| 'at_risk'
| 'reactivated'
| 'booked'
| 'lost';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
if (
typeof value === 'object' &&
value !== null
) {
return value as UnknownRecord;
}

return {};
}

function getString(
value: unknown,
keys: string[]
): string | null {
const record = asRecord(value);

for (const key of keys) {
const candidate = record[key];


if (typeof candidate === 'string' && candidate.trim()) {
  return candidate;
}

if (
  typeof candidate === 'number' ||
  typeof candidate === 'boolean'
) {
  return String(candidate);
}


}

return null;
}

function getOpportunityId(value: unknown): string | null {
return getString(value, [
'opportunityId',
'opportunity_id',
'id',
]);
}

function formatCurrency(
value: number | null | undefined,
currency: string,
locale: string
): string {
if (value == null || !Number.isFinite(value)) {
return '—';
}

try {
return new Intl.NumberFormat(locale, {
style: 'currency',
currency,
maximumFractionDigits: 0,
}).format(value);
} catch {
return `${currency} ${Math.round(value).toLocaleString(locale)}`;
}
}

function MetricCard({
label,
value,
description,
onClick,
}: {
label: string;
value: string | number;
description?: string;
onClick?: () => void;
}) {
const content = ( <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"> <p className="text-sm font-medium text-neutral-500">
{label} </p>


  <p className="mt-2 text-2xl font-semibold text-neutral-900">
    {value}
  </p>

  {description && (
    <p className="mt-1 text-sm text-neutral-500">
      {description}
    </p>
  )}
</div>


);

if (!onClick) {
return content;
}

return ( <button
   type="button"
   onClick={onClick}
   className="block w-full text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
 >
{content} </button>
);
}

function LoadingState() {
return ( <div className="space-y-6" aria-busy="true"> <div className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-6"> <div className="h-4 w-32 rounded bg-neutral-200" /> <div className="mt-4 h-10 w-56 rounded bg-neutral-200" /> <div className="mt-3 h-4 w-full max-w-md rounded bg-neutral-100" /> </div>


  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5"
      >
        <div className="h-4 w-24 rounded bg-neutral-200" />
        <div className="mt-4 h-8 w-16 rounded bg-neutral-200" />
        <div className="mt-3 h-3 w-28 rounded bg-neutral-100" />
      </div>
    ))}
  </div>
</div>


);
}

function ErrorState({
onRetry,
}: {
onRetry: () => void;
}) {
return ( <div className="rounded-2xl border border-red-200 bg-red-50 p-6"> <h2 className="text-lg font-semibold text-red-900">
We couldn't load your results </h2>


  <p className="mt-2 text-sm text-red-700">
    Something went wrong while loading your recovery
    results.
  </p>

  <button
    type="button"
    onClick={onRetry}
    className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-900 focus:ring-offset-2"
  >
    Try again
  </button>
</div>


);
}

function ZeroState({
onLearnMore,
}: {
onLearnMore: () => void;
}) {
return ( <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm"> <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"> <span className="text-xl">✓</span> </div>


  <h2 className="mt-4 text-xl font-semibold text-neutral-900">
    No recovery results yet
  </h2>

  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
    Isolynic will show recovered customers, revenue, and
    other outcomes here as recovery activity builds up.
  </p>

  <button
    type="button"
    onClick={onLearnMore}
    className="mt-5 text-sm font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
  >
    Learn how recovery works
  </button>
</div>


);
}

function EarlyUsageState() {
return ( <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"> <h2 className="text-lg font-semibold text-neutral-900">
Recovery is getting started </h2>


  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
    Isolynic is beginning to gather enough activity to
    generate stronger recovery results. Check back as more
    customer activity is recorded.
  </p>
</div>


);
}

function PartialBanner() {
return ( <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"> <p className="text-sm text-amber-900">
Some results may be temporarily incomplete. More data
will appear as processing finishes. </p> </div>
);
}

function PeriodSelector({
value,
onChange,
disabled,
}: {
value: ResultsPeriod;
onChange: (value: ResultsPeriod) => void;
disabled?: boolean;
}) {
const periods = useMemo(
() =>
[
{ label: '7 days', value: 7 },
{ label: '30 days', value: 30 },
{ label: '90 days', value: 90 },
] as Array<{
label: string;
value: ResultsPeriod;
}>,
[]
);

return ( <div className="flex rounded-lg border border-neutral-200 bg-white p-1">
{periods.map((item) => {
const active = value === item.value;


    return (
      <button
        key={String(item.value)}
        type="button"
        disabled={disabled}
        onClick={() => onChange(item.value)}
        className={[
          'rounded-md px-3 py-1.5 text-xs font-medium transition',
          active
            ? 'bg-neutral-900 text-white'
            : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : '',
        ].join(' ')}
      >
        {item.label}
      </button>
    );
  })}
</div>


);
}

function getHeadlineValue(
headline: ResultsHeadline,
key: keyof ResultsHeadline
): number {
const value = headline[key];

return typeof value === 'number' && Number.isFinite(value)
? value
: 0;
}

export default function ResultsPage() {
const router = useRouter();

const {
businessId,
isMobile,
loading: authLoading,
} = useAuthedBusiness();

const [period, setPeriod] = useState<ResultsPeriod>(30);
const [refreshing, setRefreshing] = useState(false);

const {
data,
settings,
loading,
error,
isPartial,
refresh,
lastRefreshedAt,
} = useResults(businessId, period);

useEffect(() => {
document.title = 'Results — Isolynic';
}, []);

const handleRefresh = useCallback(async () => {
try {
setRefreshing(true);
await Promise.resolve(refresh());
} finally {
setRefreshing(false);
}
}, [refresh]);

const goToOpportunities = useCallback(
(filter: OpportunityFilter) => {
router.push(
`/opportunities?filter=${encodeURIComponent(
          filter
        )}&period=${encodeURIComponent(String(period))}`
);
},
[router, period]
);

const goToRecoveryQueue = useCallback(() => {
router.push('/recovery-queue?filter=at_risk');
}, [router]);

const goToOpportunityDetail = useCallback(
(opportunityId: string) => {
router.push(
`/opportunities/${encodeURIComponent(opportunityId)}`
);
},
[router]
);

const goToCustomerValue = useCallback(() => {
router.push(
'/account/settings#typical-customer-value'
);
}, [router]);

const headline = data?.headline ?? null;

const currency =
typeof settings?.currency === 'string' &&
settings.currency.trim()
? settings.currency
: 'USD';

const locale =
typeof settings?.locale === 'string' &&
settings.locale.trim()
? settings.locale
: 'en-US';

const typicalCustomerValue = Number(
settings?.typical_customer_value ?? 0
);

const hasTypicalValue =
Number.isFinite(typicalCustomerValue) &&
typicalCustomerValue > 0;

const evidence = data?.evidence ?? [];
const trend = data?.trend ?? [];

const recovered = headline
? getHeadlineValue(
headline,
'opportunities_recovered'
)
: 0;

const atRisk = headline
? getHeadlineValue(
headline,
'opportunities_still_at_risk'
)
: 0;

const lost = headline
? getHeadlineValue(
headline,
'opportunities_lost'
)
: 0;

const reactivated = headline
? getHeadlineValue(
headline,
'customers_reactivated'
)
: 0;

const bookings = headline
? getHeadlineValue(
headline,
'bookings_recovered'
)
: 0;

const estimatedRevenue =
headline?.estimated_revenue_recovered ?? null;

const isTrulyEmpty =
!loading &&
!authLoading &&
!error &&
headline !== null &&
recovered === 0 &&
atRisk === 0 &&
lost === 0 &&
reactivated === 0 &&
bookings === 0 &&
evidence.length === 0 &&
trend.length === 0;

const isEarlyUsage =
!loading &&
!authLoading &&
!error &&
headline !== null &&
recovered === 0 &&
!isTrulyEmpty;

const shouldShowResults =
!loading &&
!authLoading &&
!error &&
headline !== null &&
!isTrulyEmpty &&
!isEarlyUsage;

const showFreshness =
!loading &&
!authLoading &&
!error &&
lastRefreshedAt != null;

return ( <main className="mx-auto w-full max-w-[1160px] px-4 py-6 sm:px-6 sm:py-10">
{/* ------------------------------------------------------------------ */}
{/* Header                                                              */}
{/* ------------------------------------------------------------------ */}

```
  <header className="mb-6 flex items-start justify-between gap-4 sm:items-center">
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900">
        Results
      </h1>

      <p className="mt-0.5 hidden text-sm text-neutral-500 sm:block">
        See what Isolynic recovered for your business.
      </p>
    </div>

    <div className="flex items-center gap-3">
      <PeriodSelector
        value={period}
        onChange={setPeriod}
        disabled={loading || authLoading}
      />

      <a
        href="/help/results"
        className="hidden text-sm text-neutral-500 hover:text-neutral-900 focus:outline-none sm:inline"
      >
        Help
      </a>
    </div>
  </header>

  {/* ------------------------------------------------------------------ */}
  {/* Freshness                                                           */}
  {/* ------------------------------------------------------------------ */}

  {showFreshness && (
    <div className="mb-4 flex items-center justify-between">
      <span className="text-xs text-neutral-400">
        {formatRelativeFreshness(lastRefreshedAt)}
      </span>

      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="text-xs text-neutral-500 underline hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )}

  {/* ------------------------------------------------------------------ */}
  {/* Authentication/loading                                               */}
  {/* ------------------------------------------------------------------ */}

  {authLoading && <LoadingState />}

  {/* ------------------------------------------------------------------ */}
  {/* Results loading                                                     */}
  {/* ------------------------------------------------------------------ */}

  {!authLoading && loading && <LoadingState />}

  {/* ------------------------------------------------------------------ */}
  {/* Error                                                               */}
  {/* ------------------------------------------------------------------ */}

  {!authLoading && !loading && error && (
    <ErrorState onRetry={handleRefresh} />
  )}

  {/* ------------------------------------------------------------------ */}
  {/* Empty state                                                         */}
  {/* ------------------------------------------------------------------ */}

  {!authLoading &&
    !loading &&
    !error &&
    isTrulyEmpty && (
      <ZeroState
        onLearnMore={() =>
          router.push('/help/how-recovery-works')
        }
      />
    )}

  {/* ------------------------------------------------------------------ */}
  {/* Early usage                                                         */}
  {/* ------------------------------------------------------------------ */}

  {!authLoading &&
    !loading &&
    !error &&
    isEarlyUsage && <EarlyUsageState />}

  {/* ------------------------------------------------------------------ */}
  {/* Main results                                                        */}
  {/* ------------------------------------------------------------------ */}

  {shouldShowResults && headline && (
    <div className="space-y-8">
      {isPartial && <PartialBanner />}

      {/* Primary value */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              Estimated revenue recovered
            </p>

            <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
              {formatCurrency(
                estimatedRevenue,
                currency,
                locale
              )}
            </p>

            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">
              Revenue associated with customers Isolynic
              helped recover during the selected period.
            </p>
          </div>

          {!hasTypicalValue && (
            <button
              type="button"
              onClick={goToCustomerValue}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
            >
              Add customer value
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-5">
          <p className="text-xs leading-5 text-neutral-400">
            Estimates may vary depending on the customer value
            configured for your business.
          </p>
        </div>
      </section>

      {/* Outcome metrics */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            Outcome breakdown
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            See how recovery activity translated into outcomes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Opportunities recovered"
            value={recovered}
            description="Recovered customers"
            onClick={() =>
              goToOpportunities('recovered')
            }
          />

          <MetricCard
            label="Customers reactivated"
            value={reactivated}
            description="Returned customers"
            onClick={() =>
              goToOpportunities('reactivated')
            }
          />

          <MetricCard
            label="Still at risk"
            value={atRisk}
            description="Needs attention"
            onClick={() =>
              goToOpportunities('at_risk')
            }
          />

          <MetricCard
            label="Lost"
            value={lost}
            description="No recovery"
            onClick={() => goToOpportunities('lost')}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Bookings recovered"
            value={bookings}
            description="Recovered bookings"
            onClick={() =>
              goToOpportunities('booked')
            }
          />

          <MetricCard
            label="Customer value"
            value={
              hasTypicalValue
                ? formatCurrency(
                    typicalCustomerValue,
                    currency,
                    locale
                  )
                : 'Not configured'
            }
            description={
              hasTypicalValue
                ? 'Typical customer value'
                : 'Configure your typical value'
            }
            onClick={goToCustomerValue}
          />
        </div>
      </section>

      {/* Recovery evidence */}
      {evidence.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              Recovery evidence
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Recent customer-level recovery activity.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="divide-y divide-neutral-100">
              {evidence.map((item, index) => {
                const opportunityId =
                  getOpportunityId(item);

                const title =
                  getString(item, [
                    'customerName',
                    'customer_name',
                    'name',
                    'title',
                  ]) ??
                  `Recovery event ${index + 1}`;

                const subtitle =
                  getString(item, [
                    'description',
                    'reason',
                    'summary',
                    'event',
                    'status',
                  ]);

                return (
                  <div
                    key={
                      opportunityId ??
                      `evidence-${index}`
                    }
                    className="flex items-center justify-between gap-4 p-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {title}
                      </p>

                      {subtitle && (
                        <p className="mt-1 truncate text-sm text-neutral-500">
                          {subtitle}
                        </p>
                      )}
                    </div>

                    {opportunityId && (
                      <button
                        type="button"
                        onClick={() =>
                          goToOpportunityDetail(
                            opportunityId
                          )
                        }
                        className="shrink-0 text-sm font-medium text-neutral-800 underline underline-offset-4 hover:text-neutral-500"
                      >
                        View
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Historical trend */}
      {trend.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              Recovery trend
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Historical recovery activity for this period.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex min-w-max items-end gap-3">
              {trend.map((point, index) => {
                const record = asRecord(point);

                const rawValue =
                  record.recovered ??
                  record.recovered_count ??
                  record.value ??
                  record.count ??
                  0;

                const value =
                  typeof rawValue === 'number'
                    ? rawValue
                    : Number(rawValue) || 0;

                const height = Math.max(
                  12,
                  Math.min(180, value * 20)
                );

                const label =
                  getString(point, [
                    'label',
                    'date',
                    'period',
                  ]) ?? `#${index + 1}`;

                return (
                  <div
                    key={`trend-${index}`}
                    className="flex w-12 flex-col items-center gap-2"
                  >
                    <span className="text-[11px] text-neutral-500">
                      {value}
                    </span>

                    <div
                      className="w-8 rounded-t-md bg-neutral-900"
                      style={{
                        height: `${height}px`,
                      }}
                      aria-label={`${label}: ${value}`}
                    />

                    <span className="max-w-12 truncate text-[10px] text-neutral-400">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Still at risk */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">
              {atRisk} opportunity
              {atRisk === 1 ? '' : 'ies'} still at risk
            </p>

            <p className="mt-1 text-sm leading-6 text-neutral-300">
              Review customers that may still need recovery
              attention.
            </p>
          </div>

          <button
            type="button"
            onClick={goToRecoveryQueue}
            className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
          >
            Review at-risk customers
          </button>
        </div>
      </section>

      {/* Mobile information */}
      {isMobile && (
        <p className="text-center text-xs text-neutral-400">
          Swipe horizontally on trend data to see more.
        </p>
      )}
    </div>
  )}
</main>


);
}
