
'use client';

import { ResultsPeriod } from '@/types/results';
import { formatCurrency, formatComparisonSentence } from '@/lib/results';
import type { ResultsHeadline } from '@/types/results';
import { useState } from 'react';
import type { RecoveryEvidenceItem } from '@/types/results';
import type { RecoveryTrendPoint } from '@/types/results';




const OPTIONS: { value: ResultsPeriod; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

interface Props {
  value: ResultsPeriod;
  onChange: (period: ResultsPeriod) => void;
  disabled?: boolean;
}

export function TimePeriodSelector({ value, onChange, disabled }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Results time period"
      className="inline-flex items-center gap-1 rounded-full bg-neutral-100 p-1"
    >
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={[
              'px-3 py-1.5 text-sm font-medium rounded-full transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-neutral-900',
              selected
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}





interface Props {
  headline: ResultsHeadline;
  currency: string;
  locale: string;
  hasTypicalValue: boolean;
  onDrillOpportunitiesRecovered: () => void;
  onDrillBookings: () => void;
  onOpenRevenueExplainer: () => void;
  onAddCustomerValue: () => void;
}

export function HeroMetric({
  headline,
  currency,
  locale,
  hasTypicalValue,
  onDrillOpportunitiesRecovered,
  onDrillBookings,
  onOpenRevenueExplainer,
  onAddCustomerValue,
}: Props) {
  const comparison = formatComparisonSentence(
    headline.opportunities_recovered,
    headline.previous_period_opportunities_recovered,
    headline.previous_period_has_enough_data
  );

  return (
    <section aria-labelledby="hero-metric-heading" className="w-full">
      <button
        type="button"
        onClick={onDrillOpportunitiesRecovered}
        className="w-full text-left group focus:outline-none"
      >
        <span
          id="hero-metric-heading"
          className="block text-5xl sm:text-6xl font-semibold tracking-tight text-neutral-900 tabular-nums transition-transform duration-300 group-hover:scale-[1.01]"
        >
          {headline.opportunities_recovered.toLocaleString(locale)}
        </span>
        <span className="block mt-1 text-base sm:text-lg font-medium text-neutral-700">
          Opportunities recovered
        </span>
        <span className="block mt-1 text-sm text-neutral-500 max-w-md">
          Customers who may have been lost but came back after Isolynic stepped in.
        </span>
        {comparison && (
          <span className="block mt-2 text-xs text-neutral-400">{comparison}</span>
        )}
      </button>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={onDrillBookings}
          className="flex items-baseline gap-1.5 text-sm text-neutral-700 hover:text-neutral-900 focus:outline-none focus-visible:underline"
        >
          <span className="font-semibold tabular-nums">{headline.bookings_recovered}</span>
          <span>became bookings</span>
        </button>

        {headline.estimated_revenue_recovered !== null ? (
          <button
            type="button"
            onClick={onOpenRevenueExplainer}
            className="flex items-baseline gap-1.5 text-sm text-neutral-700 hover:text-neutral-900 focus:outline-none focus-visible:underline"
          >
            <span className="font-semibold tabular-nums">
              {formatCurrency(headline.estimated_revenue_recovered, currency, locale)}
            </span>
            <span>estimated value</span>
          </button>
        ) : !hasTypicalValue ? (
          <button
            type="button"
            onClick={onAddCustomerValue}
            className="text-sm text-blue-600 hover:text-blue-700 underline focus:outline-none"
          >
            Add your typical customer value to estimate recovered revenue
          </button>
        ) : null}
      </div>
    </section>
  );
}







export function RevenueEstimateNote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-neutral-400 underline decoration-dotted focus:outline-none"
      >
        Based on the customer value you've provided and the opportunities Isolynic helped recover.
      </button>
      {open && (
        <p className="mt-2 text-xs text-neutral-500 max-w-md bg-neutral-50 rounded-md p-3">
          This is an estimate, not an accounting figure. Isolynic only knows the revenue
          information you provide.
        </p>
      )}
    </div>
  );
}







interface CardDef {
  key: string;
  value: number;
  label: string;
  tone: 'positive' | 'warning' | 'neutral';
  onClick?: () => void;
}

interface Props {
  headline: ResultsHeadline;
  onDrillReactivated: () => void;
  onDrillAtRisk: () => void;
  onDrillLost: () => void;
}

const toneClasses: Record<CardDef['tone'], string> = {
  positive: 'border-emerald-100 bg-emerald-50/50',
  warning: 'border-amber-100 bg-amber-50/50',
  neutral: 'border-neutral-200 bg-neutral-50',
};

export function SecondaryMetricsGrid({
  headline,
  onDrillReactivated,
  onDrillAtRisk,
  onDrillLost,
}: Props) {
  const cards: CardDef[] = [
    {
      key: 'reactivated',
      value: headline.customers_reactivated,
      label: 'Customers reactivated',
      tone: 'positive',
      onClick: onDrillReactivated,
    },
    {
      key: 'at_risk',
      value: headline.opportunities_still_at_risk,
      label: 'Still at risk',
      tone: 'warning',
      onClick: onDrillAtRisk,
    },
    {
      key: 'lost',
      value: headline.opportunities_lost,
      label: 'Opportunities lost',
      tone: 'neutral',
      onClick: onDrillLost,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="list">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          role="listitem"
          onClick={c.onClick}
          className={[
            'text-left rounded-xl border p-4 transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900',
            toneClasses[c.tone],
          ].join(' ')}
        >
          <span className="block text-2xl font-semibold tabular-nums text-neutral-900">
            {c.value.toLocaleString()}
          </span>
          <span className="block mt-0.5 text-sm text-neutral-600">{c.label}</span>
        </button>
      ))}
    </div>
  );
}




interface Props {
  items: RecoveryEvidenceItem[];
  onSelect: (opportunityId: string) => void;
}

export function RecoveryEvidenceList({ items, onSelect }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recovery-evidence-heading" className="w-full">
      <h2 id="recovery-evidence-heading" className="text-sm font-semibold text-neutral-800 mb-3">
        Where the recovery happened
      </h2>
      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
        {items.map((item) => (
          <li key={item.opportunity_id}>
            <button
              type="button"
              onClick={() => onSelect(item.opportunity_id)}
              className="w-full text-left px-4 py-3 hover:bg-neutral-50 focus:outline-none focus-visible:bg-neutral-50 transition-colors"
            >
              <span className="block text-sm font-medium text-neutral-900">
                {item.customer_first_name}
              </span>
              <span className="block text-xs text-neutral-500 mt-0.5">
                {item.stage_label} → {item.intervention_label} → {item.outcome_label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}





interface Props {
  points: RecoveryTrendPoint[];
  isMobile: boolean;
}

export function RecoveryTrend({ points, isMobile }: Props) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.recovered_count), 1);

  if (isMobile) {
    // Concise vertical list per spec section 20 — preferable to a miniature graph.
    return (
      <section aria-labelledby="trend-heading-mobile">
        <h2 id="trend-heading-mobile" className="text-sm font-semibold text-neutral-800 mb-3">
          Recovery this period
        </h2>
        <ul className="space-y-1.5">
          {points.map((p) => (
            <li
              key={p.label}
              className="flex items-center justify-between text-sm text-neutral-700 py-1"
            >
              <span>{p.label}</span>
              <span className="font-medium tabular-nums">{p.recovered_count}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="trend-heading">
      <h2 id="trend-heading" className="text-sm font-semibold text-neutral-800 mb-3">
        Recovery over time
      </h2>
      <div
        role="img"
        aria-label={`Recovered opportunities by period: ${points
          .map((p) => `${p.label}: ${p.recovered_count}`)
          .join(', ')}`}
        className="flex items-end gap-2 h-32"
      >
        {points.map((p) => (
          <div key={p.label} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-sm bg-neutral-800 transition-all duration-500"
              style={{ height: `${Math.max((p.recovered_count / max) * 100, p.recovered_count > 0 ? 6 : 2)}%` }}
            />
            <span className="text-[11px] text-neutral-400">{p.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}





interface Props {
  count: number;
  onReview: () => void;
}

export function StillAtRiskBanner({ count, onReview }: Props) {
  if (count === 0) return null;
  return (
    <section className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3.5">
      <p className="text-sm text-neutral-800">
        <span className="font-semibold tabular-nums">{count}</span>{' '}
        customer{count === 1 ? '' : 's'} may still need attention
      </p>
      <button
        type="button"
        onClick={onReview}
        className="text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700 focus:outline-none"
      >
        Review
      </button>
    </section>
  );
}




export function ResultsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading results">
      <div className="h-4 w-24 bg-neutral-200 rounded" />
      <div className="space-y-2">
        <div className="h-14 w-32 bg-neutral-200 rounded" />
        <div className="h-4 w-56 bg-neutral-100 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 bg-neutral-100 rounded-xl" />
        <div className="h-20 bg-neutral-100 rounded-xl" />
        <div className="h-20 bg-neutral-100 rounded-xl" />
      </div>
      <div className="h-32 bg-neutral-100 rounded-xl" />
      <div className="h-24 bg-neutral-100 rounded-xl" />
    </div>
  );
}

export function ResultsZeroState({ onLearnMore }: { onLearnMore: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <h2 className="text-xl font-semibold text-neutral-900">Your first recovery is coming.</h2>
      <p className="mt-2 text-sm text-neutral-500 max-w-sm">
        When a customer goes quiet after showing interest, Isolynic will let you know what
        happened—and help bring the right ones back.
      </p>
      <button
        type="button"
        onClick={onLearnMore}
        className="mt-5 text-sm font-medium text-blue-600 hover:text-blue-700 underline focus:outline-none"
      >
        See how recovery works
      </button>
    </div>
  );
}

export function ResultsEarlyUsageState() {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <h2 className="text-xl font-semibold text-neutral-900">
        You're protected, but no recoveries yet.
      </h2>
      <p className="mt-2 text-sm text-neutral-500 max-w-sm">
        Isolynic is watching your customer conversations. We'll show your first recovery here
        when one happens.
      </p>
    </div>
  );
}

export function ResultsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4" role="alert">
      <h2 className="text-lg font-semibold text-neutral-900">We couldn't load your results.</h2>
      <p className="mt-2 text-sm text-neutral-500 max-w-sm">
        Your customer activity is safe. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-full hover:bg-neutral-800 focus:outline-none"
      >
        Try again
      </button>
    </div>
  );
}

export function ResultsPartialBanner() {
  return (
    <div
      role="status"
      className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2"
    >
      Your results are still updating.
    </div>
  );
}