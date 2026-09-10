
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';





const db = getFirestore();

// ---------- Types (mirrors client types/results.ts) ----------

type ResultOutcome =
  | 'ACTIVE'
  | 'AT_RISK'
  | 'RECOVERED'
  | 'BOOKED'
  | 'LOST'
  | 'DECLINED'
  | 'OWNER_HANDLED';

type AttributionStatus = 'ATTRIBUTED' | 'PROBABLE' | 'UNCONFIRMED' | 'NOT_ATTRIBUTED';

interface OpportunityResult {
  opportunity_id: string;
  business_id: string;
  customer_id: string;
  customer_name: string;
  detected_at: number;
  risk_started_at: number | null;
  recovery_action_at: number | null;
  reengaged_at: number | null;
  booking_at: number | null;
  outcome: ResultOutcome;
  estimated_value: number | null;
  attribution_status: AttributionStatus;
  source_channel: string;
  manual_override?: 'RECOVERED' | 'NOT_RECOVERED' | null;
  summary_stage_label?: string;
  summary_intervention_label?: string;
  summary_outcome_label?: string;
  updated_at: number;
}

type ResultsPeriod = 7 | 30 | 90;

// Recovery attribution window (section 27) — configurable but must be applied
// consistently. Defaulted here; can be product-tuned via /config/results doc.
const DEFAULT_ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Statuses that are allowed to count toward headline "recovered" metrics (section 26/44).
const RECOVERY_ELIGIBLE_ATTRIBUTION: AttributionStatus[] = ['ATTRIBUTED', 'PROBABLE'];

// ---------- Helpers ----------

function periodBounds(periodDays: ResultsPeriod, now: number) {
  const end = now;
  const start = now - periodDays * 24 * 60 * 60 * 1000;
  const prevEnd = start;
  const prevStart = start - periodDays * 24 * 60 * 60 * 1000;
  return { start, end, prevStart, prevEnd };
}

function isRecovered(o: OpportunityResult, windowMs: number): boolean {
  if (o.manual_override === 'NOT_RECOVERED') return false;
  if (o.manual_override === 'RECOVERED') return true;

  if (!RECOVERY_ELIGIBLE_ATTRIBUTION.includes(o.attribution_status)) return false;
  if (!o.recovery_action_at || !o.reengaged_at) return false;
  if (o.reengaged_at < o.recovery_action_at) return false;
  if (o.reengaged_at - o.recovery_action_at > windowMs) return false;

  // Must show meaningful progression, not just an automated reply with no
  // subsequent behavior (section 11) — reengaged_at existing satisfies this
  // because upstream event capture only sets it on qualifying customer actions.
  return o.outcome === 'RECOVERED' || o.outcome === 'BOOKED';
}

function isReactivated(o: OpportunityResult): boolean {
  return !!o.reengaged_at && o.outcome !== 'LOST' && o.outcome !== 'DECLINED';
}

function isBookingRecovered(o: OpportunityResult, windowMs: number): boolean {
  return isRecovered(o, windowMs) && o.outcome === 'BOOKED' && !!o.booking_at;
}

function isStillAtRisk(o: OpportunityResult): boolean {
  return o.outcome === 'AT_RISK';
}

function isLost(o: OpportunityResult): boolean {
  return o.outcome === 'LOST';
}

function firstName(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return 'A customer';
  return trimmed.split(/\s+/)[0];
}

function weekBucketLabel(index: number): string {
  return `W${index + 1}`;
}

async function fetchOpportunities(
  businessId: string,
  start: number,
  end: number
): Promise<OpportunityResult[]> {
  // Query on detected_at within the window; opportunities that started before
  // the window but resolved within it are also relevant for "recovered" counts,
  // so we additionally query on a resolved_at-style field if present. For V1,
  // we index on `updated_at` to capture any opportunity touched during the period.
  const snap = await db
    .collection('businesses')
    .doc(businessId)
    .collection('opportunityResults')
    .where('updated_at', '>=', start)
    .where('updated_at', '<=', end)
    .get();

  return snap.docs.map((d) => d.data() as OpportunityResult);
}

async function getAttributionWindowMs(businessId: string): Promise<number> {
  const cfgSnap = await db.collection('businesses').doc(businessId).get();
  const cfg = cfgSnap.data();
  return cfg?.recovery_attribution_window_ms ?? DEFAULT_ATTRIBUTION_WINDOW_MS;
}

async function computeBundleForPeriod(businessId: string, period: ResultsPeriod, now: number) {
  const { start, end, prevStart, prevEnd } = periodBounds(period, now);
  const windowMs = await getAttributionWindowMs(businessId);

  const [current, previous, settingsSnap] = await Promise.all([
    fetchOpportunities(businessId, start, end),
    fetchOpportunities(businessId, prevStart, prevEnd),
    db.collection('businesses').doc(businessId).get(),
  ]);

  const settings = settingsSnap.data() ?? {};
  const typicalCustomerValue: number | null = settings.typical_customer_value ?? null;
  const typicalBookingValue: number | null = settings.typical_booking_value ?? null;

  const recovered = current.filter((o) => isRecovered(o, windowMs));
  const reactivated = current.filter((o) => isReactivated(o));
  const bookingsRecovered = current.filter((o) => isBookingRecovered(o, windowMs));
  const stillAtRisk = current.filter((o) => isStillAtRisk(o));
  const lost = current.filter((o) => isLost(o));

  const prevRecoveredCount = previous.filter((o) => isRecovered(o, windowMs)).length;
  const previousPeriodHasEnoughData = previous.length >= 5; // section 30: minimum meaningful volume

  // Revenue estimate (section 14, 46) — verified values take priority over estimates,
  // and the two are tracked separately, never silently summed together.
  let verifiedRevenue = 0;
  let verifiedCount = 0;
  let estimableRecoveredCount = 0;

  for (const o of recovered) {
    if (o.estimated_value !== null && o.attribution_status === 'ATTRIBUTED' && o.manual_override === 'RECOVERED') {
      // Treated as verified only when explicitly confirmed by the owner with a value.
      verifiedRevenue += o.estimated_value;
      verifiedCount += 1;
    } else {
      estimableRecoveredCount += 1;
    }
  }

  let estimatedFromTypical = 0;
  if (typicalCustomerValue) {
    estimatedFromTypical += estimableRecoveredCount * typicalCustomerValue;
  }
  if (typicalBookingValue) {
    // Avoid double counting: booking value estimate replaces base customer
    // value estimate for the subset that also became bookings.
    const bookingSubset = bookingsRecovered.filter(
      (o) => !(o.estimated_value !== null && o.manual_override === 'RECOVERED')
    ).length;
    estimatedFromTypical += bookingSubset * (typicalBookingValue - (typicalCustomerValue ?? 0));
  }

  let estimatedRevenueRecovered: number | null = null;
  let basis: 'CUSTOMER_PROVIDED' | 'VERIFIED' | 'MIXED' | 'NONE' = 'NONE';

  if (verifiedCount > 0 && estimableRecoveredCount > 0 && typicalCustomerValue) {
    estimatedRevenueRecovered = verifiedRevenue + estimatedFromTypical;
    basis = 'MIXED';
  } else if (verifiedCount > 0) {
    estimatedRevenueRecovered = verifiedRevenue;
    basis = 'VERIFIED';
  } else if (typicalCustomerValue) {
    estimatedRevenueRecovered = estimatedFromTypical;
    basis = 'CUSTOMER_PROVIDED';
  }

  // Trend buckets — weekly for 30/90 day windows, daily-ish for 7 days.
  const bucketCount = period === 7 ? 7 : period === 30 ? 4 : Math.min(12, Math.ceil(period / 7));
  const bucketMs = (end - start) / bucketCount;
  const trend = Array.from({ length: bucketCount }).map((_, i) => {
    const bStart = start + i * bucketMs;
    const bEnd = bStart + bucketMs;
    const count = recovered.filter((o) => {
      const t = o.reengaged_at ?? o.updated_at;
      return t >= bStart && t < bEnd;
    }).length;
    return {
      label: period === 7 ? shortDayLabel(bStart) : weekBucketLabel(i),
      recovered_count: count,
      period_start: bStart,
      period_end: bEnd,
    };
  });

  // Recovery evidence — up to 5 recent, privacy-safe examples (sections 17-18).
  const evidence = recovered
    .filter((o) => o.summary_stage_label && o.summary_intervention_label && o.summary_outcome_label)
    .sort((a, b) => (b.reengaged_at ?? 0) - (a.reengaged_at ?? 0))
    .slice(0, 5)
    .map((o) => ({
      opportunity_id: o.opportunity_id,
      customer_first_name: firstName(o.customer_name),
      stage_label: o.summary_stage_label!,
      intervention_label: o.summary_intervention_label!,
      outcome_label: o.summary_outcome_label!,
      occurred_at: o.reengaged_at ?? o.updated_at,
    }));

  const headline = {
    business_id: businessId,
    period_days: period,
    period_start: start,
    period_end: end,
    opportunities_recovered: recovered.length,
    customers_reactivated: reactivated.length,
    bookings_recovered: bookingsRecovered.length,
    opportunities_still_at_risk: stillAtRisk.length,
    opportunities_lost: lost.length,
    estimated_revenue_recovered: estimatedRevenueRecovered,
    estimated_revenue_basis: basis,
    previous_period_opportunities_recovered: previousPeriodHasEnoughData ? prevRecoveredCount : null,
    previous_period_has_enough_data: previousPeriodHasEnoughData,
    computed_at: now,
    is_partial: false,
  };

  return { headline, trend, evidence };
}

function shortDayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short' });
}

// ---------- Callable: on-demand compute (used by client on cache miss / refresh) ----------

export const computeResultsForBusiness = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const { businessId, period, force } = request.data as {
      businessId: string;
      period: ResultsPeriod;
      force?: boolean;
    };

    if (!businessId || ![7, 30, 90].includes(period)) {
      throw new HttpsError('invalid-argument', 'A valid businessId and period are required.');
    }

    await assertOwnerOfBusiness(uid, businessId);

    const cacheRef = db
      .collection('businesses')
      .doc(businessId)
      .collection('resultsCache')
      .doc(String(period));

    if (!force) {
      const cached = await cacheRef.get();
      if (cached.exists) {
        const data = cached.data();
        const fresh = data?.headline?.computed_at && Date.now() - data.headline.computed_at < 60_000;
        if (fresh) return { cached: true };
      }
    }

    try {
      const bundle = await computeBundleForPeriod(businessId, period, Date.now());
      await cacheRef.set(bundle);
      return { cached: false };
    } catch (err) {
      logger.error('computeResultsForBusiness failed', { businessId, period, err });
      // Mark partial so the client can show the "still updating" state rather
      // than a hard error if a stale cache exists.
      await cacheRef.set({ headline: { is_partial: true } }, { merge: true }).catch(() => {});
      throw new HttpsError('internal', "We couldn't load your results.");
    }
  }
);

// ---------- Callable: manual correction (section 28) ----------

export const submitResultCorrection = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const { businessId, opportunityId, wasRecovered } = request.data as {
      businessId: string;
      opportunityId: string;
      wasRecovered: boolean;
    };

    if (!businessId || !opportunityId || typeof wasRecovered !== 'boolean') {
      throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    await assertOwnerOfBusiness(uid, businessId);

    const oppRef = db
      .collection('businesses')
      .doc(businessId)
      .collection('opportunityResults')
      .doc(opportunityId);

    const oppSnap = await oppRef.get();
    if (!oppSnap.exists) throw new HttpsError('not-found', 'Opportunity not found.');

    await oppRef.update({
      manual_override: wasRecovered ? 'RECOVERED' : 'NOT_RECOVERED',
      updated_at: Date.now(),
    });

    // Invalidate cached result docs so next load recomputes.
    const cacheColl = db.collection('businesses').doc(businessId).collection('resultsCache');
    const batch = db.batch();
    for (const p of [7, 30, 90]) {
      batch.set(cacheColl.doc(String(p)), { headline: { is_partial: true } }, { merge: true });
    }
    await batch.commit();

    return { ok: true };
  }
);

async function assertOwnerOfBusiness(uid: string, businessId: string) {
  const bizSnap = await db.collection('businesses').doc(businessId).get();
  if (!bizSnap.exists) throw new HttpsError('not-found', 'Business not found.');
  const biz = bizSnap.data();
  if (biz?.owner_uid !== uid) {
    throw new HttpsError('permission-denied', 'Not authorized for this business.');
  }
}

// ---------- Trigger: keep resultsCache invalidated when raw opportunity data changes ----------

export const onOpportunityResultWrite = onDocumentWritten(
  'businesses/{businessId}/opportunityResults/{opportunityId}',
  async (event) => {
    const businessId = event.params.businessId as string;
    const cacheColl = db.collection('businesses').doc(businessId).collection('resultsCache');

    const batch = db.batch();
    for (const p of [7, 30, 90]) {
      batch.set(cacheColl.doc(String(p)), { headline: { is_partial: true } }, { merge: true });
    }
    await batch.commit();
  }
);

// ---------- Scheduled: recompute all businesses' caches periodically ----------
// Keeps "Updated N minutes ago" meaningful without relying solely on user-triggered
// refreshes, and keeps computeResultsForBusiness calls cheap for the client.

export const recomputeResultsCachesScheduled = onSchedule(
  { schedule: 'every 15 minutes', region: 'us-central1', timeZone: 'UTC' },
  async () => {
    const businessesSnap = await db.collection('businesses').get();
    const now = Date.now();

    const jobs = businessesSnap.docs.map(async (bizDoc) => {
      const businessId = bizDoc.id;
      for (const period of [7, 30, 90] as ResultsPeriod[]) {
        try {
          const bundle = await computeBundleForPeriod(businessId, period, now);
          await db
            .collection('businesses')
            .doc(businessId)
            .collection('resultsCache')
            .doc(String(period))
            .set(bundle);
        } catch (err) {
          logger.error('scheduled recompute failed', { businessId, period, err });
        }
      }
    });

    await Promise.all(jobs);
  }
);

// ---------- Scheduled: weekly summary notification (section 56-57) ----------

export const weeklyResultsSummary = onSchedule(
  { schedule: 'every monday 09:00', region: 'us-central1', timeZone: 'UTC' },
  async () => {
    const businessesSnap = await db.collection('businesses').get();
    const now = Date.now();

    const jobs = businessesSnap.docs.map(async (bizDoc) => {
      const businessId = bizDoc.id;
      const business = bizDoc.data();
      if (business.notifications_opt_out?.weekly_summary) return;

      try {
        const bundle = await computeBundleForPeriod(businessId, 7, now);
        const h = bundle.headline;

        // Skip sending an empty, potentially discouraging notification.
        if (h.opportunities_recovered === 0 && h.opportunities_still_at_risk === 0) return;

        await db
          .collection('businesses')
          .doc(businessId)
          .collection('notifications')
          .add({
            type: 'weekly_results_summary',
            title: `You recovered ${h.opportunities_recovered} customer opportunit${
              h.opportunities_recovered === 1 ? 'y' : 'ies'
            } this week.`,
            body: `${h.bookings_recovered} became bookings.`,
            cta_label: 'See your results',
            cta_route: '/results?period=7',
            created_at: now,
            read: false,
          });
      } catch (err) {
        logger.error('weeklyResultsSummary failed', { businessId, err });
      }
    });

    await Promise.all(jobs);
  }
);