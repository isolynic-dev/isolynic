
// lib/results/useResults.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, firebaseApp} from '@/lib/firebase';
import type { ResultsBundle, ResultsPeriod, BusinessSettings } from '@/types/results';

interface UseResultsState {
  data: ResultsBundle | null;
  settings: BusinessSettings | null;
  loading: boolean;
  error: string | null;
  isPartial: boolean;
  refresh: () => void;
  lastRefreshedAt: number | null;
}

// Results are precomputed server-side by a Cloud Function into
// /businesses/{businessId}/resultsCache/{period}
// This keeps the client cheap and avoids recomputing aggregation on every load.
export function useResults(businessId: string | null, period: ResultsPeriod): UseResultsState {
  const [data, setData] = useState<ResultsBundle | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const isPartial = useMemo(() => !!data?.headline?.is_partial, [data]);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    setError(null);

    const cacheRef = doc(db, 'businesses', businessId, 'resultsCache', String(period));

    const unsubscribe = onSnapshot(
      cacheRef,
      (snap) => {
        if (!snap.exists()) {
          // No cache yet — trigger a compute via callable, then wait for snapshot update.
          triggerCompute(businessId, period).catch((e) => {
            setError(e?.message ?? 'We couldn\'t load your results.');
          });
          setLoading(false);
          setData(null);
          return;
        }
        const bundle = snap.data() as ResultsBundle;
        setData(bundle);
        setLastRefreshedAt(bundle.headline?.computed_at ?? Date.now());
        setLoading(false);
      },
      (err) => {
        setError(err?.message ?? 'We couldn\'t load your results.');
        setLoading(false);
      }
    );

    const settingsRef = doc(db, 'businesses', businessId);
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as BusinessSettings);
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, [businessId, period, refreshToken]);

  const refresh = useCallback(() => {
    if (!businessId) return;
    setLoading(true);
    triggerCompute(businessId, period, true)
      .then(() => setRefreshToken((t) => t + 1))
      .catch((e) => setError(e?.message ?? 'We couldn\'t refresh your results.'))
      .finally(() => setLoading(false));
  }, [businessId, period]);

  return { data, settings, loading, error, isPartial, refresh, lastRefreshedAt };
}

async function triggerCompute(businessId: string, period: ResultsPeriod, force = false) {
  const functions = getFunctions(firebaseApp);
  const computeResults = httpsCallable(functions, 'computeResultsForBusiness');
  await computeResults({ businessId, period, force });
}



// lib/results/useManualCorrection.ts


export async function submitManualCorrection(
  businessId: string,
  opportunityId: string,
  wasRecovered: boolean
) {
  const functions = getFunctions(firebaseApp);
  const correct = httpsCallable(functions, 'submitResultCorrection');
  await correct({ businessId, opportunityId, wasRecovered });
}



// lib/results/format.ts

export function formatCurrency(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatComparisonSentence(
  current: number,
  previous: number | null,
  hasEnoughData: boolean,
  noun = 'opportunities recovered'
): string | null {
  if (!hasEnoughData || previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return `Same number of ${noun} as the previous period.`;
  const direction = diff > 0 ? 'more' : 'fewer';
  return `${Math.abs(diff)} ${direction} ${noun} than the previous period.`;
}

export function formatRelativeFreshness(computedAt: number | null): string {
  if (!computedAt) return '';
  const diffMs = Date.now() - computedAt;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Updated just now';
  if (diffMin === 1) return 'Updated 1 minute ago';
  if (diffMin < 60) return `Updated ${diffMin} minutes ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Updated ${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  return 'Updated recently';
}



















