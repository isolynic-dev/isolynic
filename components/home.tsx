
// src/components/home/HomeHeader.tsx
"use client";

import Link from "next/link";
import { Home as HomeIcon, LifeBuoy, Users, Bell, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeStatus } from "@/types/home";
import { useEffect, useRef } from "react";
import type { AttentionOpportunity } from "@/types/home";
import type { NeedsHumanOpportunity } from "@/types/home";
import type { NextBooking } from "@/types/home";
import type { WeeklySummary } from "@/types/home";
import { formatRevenue } from "@/lib/utils";
import { useRouter, usePathname } from "next/navigation";
import type { ActivityItem } from "@/types/home";
import { formatActivityTime } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { ChannelCoverage, ChannelId } from "@/types/home";
import type { AccountStatus } from "@/types/home";
import { formatUpdatedAt } from "@/lib/utils";





interface HomeHeaderProps {
  notificationCount?: number;
}

export function HomeHeader({ notificationCount = 0 }: HomeHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200/70 bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 md:h-16 md:px-8 dark:border-neutral-800/70 dark:bg-neutral-950/90"
      role="banner"
    >
      <Link
        href="/home"
        className="text-[15px] font-semibold tracking-tight text-neutral-900 md:text-base dark:text-neutral-50"
      >
        Isolynic
      </Link>

      <div className="flex items-center gap-1.5 md:gap-3">
        <Link
          href="/notifications"
          aria-label={
            notificationCount > 0
              ? `Notifications, ${notificationCount} unread`
              : "Notifications"
          }
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500"
              aria-hidden="true"
            />
          )}
        </Link>

        <Link
          href="/account"
          aria-label="Account"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          <User className="h-[18px] w-[18px]" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}







// src/components/home/StatusHero.tsx



interface StatusHeroProps {
  status: HomeStatus;
  attentionCount: number;
  needsHumanCount: number;
}

function getHeroContent(status: HomeStatus, attentionCount: number, needsHumanCount: number) {
  switch (status) {
    case "new":
      return {
        eyebrow: "Here's what needs your attention",
        headline: "You're ready.",
        supporting: "Isolynic is now watching for customer inquiries.",
        secondary: "When a customer needs attention, you'll see it here.",
        tone: "calm" as const,
      };
    case "healthy":
      return {
        eyebrow: "Your customer activity",
        headline: "You're covered.",
        supporting: "No important customer opportunities need your attention right now.",
        secondary: "Isolynic is still watching for customers who may be slipping away.",
        tone: "calm" as const,
      };
    case "attention":
      return {
        eyebrow: "Here's what needs your attention",
        headline:
          attentionCount === 1
            ? "1 customer may need your attention"
            : `${attentionCount} customers may need your attention`,
        supporting: `Isolynic found ${attentionCount} ${
          attentionCount === 1 ? "opportunity" : "opportunities"
        } that may be slipping away.`,
        secondary: null,
        tone: "attention" as const,
      };
    case "needs_human":
      return {
        eyebrow: "Here's what needs your attention",
        headline:
          needsHumanCount === 1 ? "1 customer needs you" : `${needsHumanCount} customers need you`,
        supporting: "Isolynic doesn't have enough information to handle this on its own.",
        secondary: null,
        tone: "urgent" as const,
      };
    case "mixed":
      return {
        eyebrow: "Here's what needs your attention",
        headline:
          attentionCount === 1 ? "1 customer may need your attention" : `${attentionCount} customers may need your attention`,
        supporting: `${needsHumanCount === 1 ? "1 of them needs" : `${needsHumanCount} of them need`} you personally.`,
        secondary: null,
        tone: "urgent" as const,
      };
    case "partial_coverage":
      return {
        eyebrow: "Your customer activity",
        headline: "You're partially covered.",
        supporting: "Some channels aren't connected yet.",
        secondary: null,
        tone: "calm" as const,
      };
    case "degraded":
      return {
        eyebrow: "Your customer activity",
        headline: "Isolynic is still watching.",
        supporting: "One of your channels is temporarily unavailable.",
        secondary: "We'll keep checking and let you know when it's working again.",
        tone: "calm" as const,
      };
    case "account_issue":
      return {
        eyebrow: "Your customer activity",
        headline: "Your protection has paused.",
        supporting: "Update your plan to continue recovering customers.",
        secondary: null,
        tone: "urgent" as const,
      };
    default:
      return {
        eyebrow: "Your customer activity",
        headline: "You're covered.",
        supporting: "",
        secondary: null,
        tone: "calm" as const,
      };
  }
}

export function StatusHero({ status, attentionCount, needsHumanCount }: StatusHeroProps) {
  const content = getHeroContent(status, attentionCount, needsHumanCount);

  return (
    <section aria-labelledby="home-status-headline" className="px-4 pt-6 md:px-0 md:pt-2">
      <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
        {content.eyebrow}
      </p>
      <h1
        id="home-status-headline"
        className={cn(
          "mt-1 text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]",
          content.tone === "calm" && "text-neutral-900 dark:text-neutral-50",
          content.tone === "attention" && "text-neutral-900 dark:text-neutral-50",
          content.tone === "urgent" && "text-rose-600 dark:text-rose-400"
        )}
      >
        {content.headline}
      </h1>
      {content.supporting && (
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
          {content.supporting}
        </p>
      )}
      {content.secondary && (
        <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-500">
          {content.secondary}
        </p>
      )}
    </section>
  );
}






// src/components/home/AttentionCard.tsx



interface AttentionCardProps {
  opportunities: AttentionOpportunity[];
  recoverableAutomatically: number;
  needsHumanCount: number;
}

export function AttentionCard({
  opportunities,
  recoverableAutomatically,
  needsHumanCount,
}: AttentionCardProps) {
  const router = useRouter();
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (!hasTrackedView.current && opportunities.length > 0) {
      track("attention_card_viewed", { count: opportunities.length });
      hasTrackedView.current = true;
    }
  }, [opportunities.length]);

  if (opportunities.length === 0) return null;

  const handleReview = () => {
    track("review_customers_clicked", { count: opportunities.length });
    router.push("/recover");
  };

  return (
    <section
      aria-labelledby="attention-card-heading"
      className="mx-4 mt-5 overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/60 md:mx-0 dark:border-amber-900/40 dark:bg-amber-950/20"
    >
      <div className="px-5 pt-5">
        <h2
          id="attention-card-heading"
          className="text-[13px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-400"
        >
          Customers may be slipping away
        </h2>
        <p className="mt-0.5 text-[13px] text-amber-700/80 dark:text-amber-500/80">
          {opportunities.length} {opportunities.length === 1 ? "opportunity" : "opportunities"}
          {recoverableAutomatically > 0 &&
            ` · ${recoverableAutomatically} can be recovered automatically`}
          {needsHumanCount > 0 && ` · ${needsHumanCount} needs you`}
        </p>
      </div>

      <ul className="mt-3 divide-y divide-amber-200/70 dark:divide-amber-900/40" role="list">
        {opportunities.slice(0, 6).map((opp) => (
          <li key={opp.id} className="px-5 py-3">
            <button
              type="button"
              onClick={() => {
                track("activity_item_clicked", { opportunityId: opp.id, source: "attention_card" });
                router.push(`/recover/${opp.id}`);
              }}
              className="flex w-full flex-col items-start rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            >
              <span className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">
                {opp.customerDisplayName}
              </span>
              <span className="mt-0.5 text-[13px] text-neutral-600 dark:text-neutral-400">
                {opp.reason}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="px-5 pb-5 pt-2">
        <button
          type="button"
          onClick={handleReview}
          className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:bg-neutral-950 md:w-auto dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Review customers
        </button>
      </div>
    </section>
  );
}








// src/components/home/NeedsYouCard.tsx



interface NeedsYouCardProps {
  opportunities: NeedsHumanOpportunity[];
}

export function NeedsYouCard({ opportunities }: NeedsYouCardProps) {
  const router = useRouter();

  if (opportunities.length === 0) return null;

  const primary = opportunities[0];
  const extraCount = opportunities.length - 1;

  const handleHandle = (opportunityId: string) => {
    track("needs_you_clicked", { opportunityId });
    router.push(`/recover/${opportunityId}?mode=handle`);
  };

  return (
    <section
      aria-labelledby="needs-you-heading"
      className="mx-4 mt-4 rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 md:mx-0 dark:border-rose-900/60 dark:bg-rose-950/30"
    >
      <h2 id="needs-you-heading" className="text-[17px] font-semibold text-rose-700 dark:text-rose-400">
        {opportunities.length === 1
          ? "1 customer needs you"
          : `${opportunities.length} customers need you`}
      </h2>

      <p className="mt-1.5 text-[15px] text-neutral-800 dark:text-neutral-200">
        <span className="font-medium">{primary.customerDisplayName}</span>{" "}
        {primary.reason}
      </p>

      <button
        type="button"
        onClick={() => handleHandle(primary.id)}
        className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 active:bg-rose-800 md:w-auto"
      >
        Handle now
      </button>

      {extraCount > 0 && (
        <button
          type="button"
          onClick={() => router.push("/recover?filter=needs_human")}
          className="mt-2 block text-[13px] font-medium text-rose-700 underline-offset-2 hover:underline dark:text-rose-400"
        >
          {extraCount === 1 ? "See 1 more" : `See ${extraCount} more`}
        </button>
      )}
    </section>
  );
}










// src/components/home/RecoverySummaryCard.tsx



interface RecoverySummaryCardProps {
  recoveredThisWeek: number;
  bookedThisWeek: number;
  repliedThisWeek: number;
  stillDecidingThisWeek: number;
  activeRecoveries: number;
}

export function RecoverySummaryCard({
  recoveredThisWeek,
  bookedThisWeek,
  repliedThisWeek,
  stillDecidingThisWeek,
  activeRecoveries,
}: RecoverySummaryCardProps) {
  const router = useRouter();

  if (recoveredThisWeek === 0 && activeRecoveries === 0) return null;

  return (
    <section
      aria-labelledby="recovery-summary-heading"
      className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 md:mx-0 dark:border-emerald-900/40 dark:bg-emerald-950/20"
    >
      <h2 id="recovery-summary-heading" className="text-[17px] font-semibold text-emerald-800 dark:text-emerald-400">
        {recoveredThisWeek > 0
          ? `Isolynic recovered ${recoveredThisWeek} ${
              recoveredThisWeek === 1 ? "customer" : "customers"
            } this week`
          : `${activeRecoveries} ${activeRecoveries === 1 ? "customer is" : "customers are"} being recovered automatically`}
      </h2>

      {recoveredThisWeek > 0 && (
        <p className="mt-1 text-[14px] text-emerald-700/90 dark:text-emerald-500/90">
          {[
            bookedThisWeek > 0 && `${bookedThisWeek} booked`,
            repliedThisWeek > 0 && `${repliedThisWeek} replied`,
            stillDecidingThisWeek > 0 &&
              `${stillDecidingThisWeek} still deciding`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {activeRecoveries > 0 && recoveredThisWeek > 0 && (
        <p className="mt-1 text-[13px] text-emerald-700/70 dark:text-emerald-500/70">
          Isolynic is handling {activeRecoveries} more right now.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          track("recovery_results_clicked");
          router.push("/results");
        }}
        className="mt-3 text-[14px] font-semibold text-emerald-800 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 dark:text-emerald-400"
      >
        See results
      </button>
    </section>
  );
}









// src/components/home/BookingsCard.tsx



interface BookingsCardProps {
  bookingsThisWeekCount: number;
  nextBooking: NextBooking | null;
}

export function BookingsCard({ bookingsThisWeekCount, nextBooking }: BookingsCardProps) {
  const router = useRouter();

  if (bookingsThisWeekCount === 0 && !nextBooking) return null;

  return (
    <section
      aria-labelledby="bookings-heading"
      className="mx-4 mt-4 rounded-2xl border border-neutral-200 bg-white p-5 md:mx-0 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 id="bookings-heading" className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
        Appointments
      </h2>
      <p className="mt-1 text-[14px] text-neutral-600 dark:text-neutral-400">
        {bookingsThisWeekCount} recovered {bookingsThisWeekCount === 1 ? "booking" : "bookings"} this
        week
      </p>

      {nextBooking && (
        <p className="mt-2 text-[14px] text-neutral-800 dark:text-neutral-200">
          Next appointment:{" "}
          <span className="font-medium">
            {nextBooking.customerDisplayName} — {nextBooking.timeLabel}
          </span>
        </p>
      )}

      <button
        type="button"
        onClick={() =>
          router.push(
            nextBooking?.opportunityId ? `/recover/${nextBooking.opportunityId}` : "/results"
          )
        }
        className="mt-3 text-[14px] font-semibold text-neutral-900 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:text-neutral-100"
      >
        View bookings
      </button>
    </section>
  );
}









// src/components/home/WeeklySummaryCard.tsx



interface WeeklySummaryCardProps {
  summary: WeeklySummary;
}

export function WeeklySummaryCard({ summary }: WeeklySummaryCardProps) {
  const revenueLabel = formatRevenue(summary.revenue);
  const total =
    summary.recoveredCount + summary.stillActiveCount + summary.lostCount;

  if (total === 0) return null;

  return (
    <section
      aria-labelledby="weekly-summary-heading"
      className="mx-4 mt-4 rounded-2xl border border-neutral-200 bg-white p-5 md:mx-0 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 id="weekly-summary-heading" className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        This week
      </h2>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Opportunities recovered" value={summary.recoveredCount} />
        <SummaryStat label="Bookings" value={summary.bookedCount} />
        <SummaryStat label="Still active" value={summary.stillActiveCount} />
        <SummaryStat label="Lost" value={summary.lostCount} />
      </dl>

      {revenueLabel && (
        <p className="mt-4 text-[14px] text-neutral-700 dark:text-neutral-300">
          {revenueLabel} recovered
        </p>
      )}
      {!revenueLabel && (
        <p className="mt-4 text-[14px] text-neutral-700 dark:text-neutral-300">
          {summary.recoveredCount} {summary.recoveredCount === 1 ? "opportunity" : "opportunities"} recovered
        </p>
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[12px] text-neutral-500 dark:text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-[20px] font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </dd>
    </div>
  );
}








// src/components/home/ActivityFeed.tsx



interface ActivityFeedProps {
  items: ActivityItem[];
}

const ROUTE_MAP: Record<NonNullable<ActivityItem["navigateTo"]>, (id: string) => string> = {
  conversation: (id) => `/customers/${id}/conversation`,
  opportunity: (id) => `/recover/${id}`,
  booking: (id) => `/recover/${id}`,
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="activity-feed-heading"
      className="mx-4 mt-4 rounded-2xl border border-neutral-200 bg-white p-5 md:mx-0 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 id="activity-feed-heading" className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Recent activity
      </h2>

      <ul className="mt-3 space-y-3" role="list">
        {items.slice(0, 8).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={!item.opportunityId || !item.navigateTo}
              onClick={() => {
                if (!item.opportunityId || !item.navigateTo) return;
                track("activity_item_clicked", { activityId: item.id });
                router.push(ROUTE_MAP[item.navigateTo](item.opportunityId));
              }}
              className="flex w-full items-baseline gap-3 rounded-lg text-left disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              <span className="w-16 shrink-0 text-[12px] tabular-nums text-neutral-400">
                {formatActivityTime(item.timestamp)}
              </span>
              <span className="text-[14px] text-neutral-700 dark:text-neutral-300">
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}








// src/components/home/CoverageBanner.tsx


interface CoverageBannerProps {
  coverage: ChannelCoverage[];
  degradedChannels: { channel: ChannelId; label: string }[];
}

export function CoverageBanner({ coverage, degradedChannels }: CoverageBannerProps) {
  const disconnected = coverage.filter((c) => !c.connected);

  if (disconnected.length === 0 && degradedChannels.length === 0) return null;

  return (
    <div className="mx-4 mt-4 space-y-2 md:mx-0">
      {disconnected.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[13px] text-neutral-700 dark:text-neutral-300">
            {coverage
              .filter((c) => c.connected)
              .map((c) => c.label)
              .join(", ") || "Some channels"}{" "}
            {coverage.filter((c) => c.connected).length === 1 ? "is" : "are"} connected.{" "}
            {disconnected.map((c) => c.label).join(", ")}{" "}
            {disconnected.length === 1 ? "isn't" : "aren't"} connected yet.
          </p>
          <Link
            href="/account/setup"
            className="shrink-0 text-[13px] font-semibold text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            Finish setup
          </Link>
        </div>
      )}

      {degradedChannels.map((c) => (
        <div
          key={c.channel}
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <p className="text-[13px] text-neutral-700 dark:text-neutral-300">
            {c.label} recovery is temporarily unavailable.
          </p>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            We&apos;ll keep checking and let you know when it&apos;s working again.
          </p>
        </div>
      ))}
    </div>
  );
}






// src/components/home/AccountStatusBanner.tsx



interface AccountStatusBannerProps {
  account: AccountStatus;
}

export function AccountStatusBanner({ account }: AccountStatusBannerProps) {
  if (account.state === "active") return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 md:mx-0 dark:border-rose-900/50 dark:bg-rose-950/30"
    >
      <p className="text-[13px] text-rose-700 dark:text-rose-400">
        {account.message ?? "Your protection has paused. Update your plan to continue recovering customers."}
      </p>
      <Link
        href="/account/billing"
        className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-rose-700"
      >
        Continue protection
      </Link>
    </div>
  );
}







// src/components/home/OfflineIndicator.tsx



interface OfflineIndicatorProps {
  isOnline: boolean;
  isFromCache: boolean;
  updatedAt: number;
}

export function OfflineIndicator({ isOnline, isFromCache, updatedAt }: OfflineIndicatorProps) {
  if (isOnline && !isFromCache) return null;

  return (
    <div className="mx-4 mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-center text-[12px] text-neutral-600 md:mx-0 dark:bg-neutral-900 dark:text-neutral-400">
      {!isOnline
        ? "You're offline. Showing your latest information."
        : `Last updated ${formatUpdatedAt(updatedAt)}`}
    </div>
  );
}










// src/components/home/HomeSkeleton.tsx
export function HomeSkeleton() {
  return (
    <div className="animate-pulse px-4 pt-6 md:px-0" aria-busy="true" aria-label="Loading your customer activity">
      <div className="h-3 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-3 h-8 w-64 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-6 h-40 w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-4 h-24 w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-4 h-24 w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}







// src/components/home/HomeErrorState.tsx


interface HomeErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function HomeErrorState({ message, onRetry }: HomeErrorStateProps) {
  return (
    <div className="mx-4 mt-10 flex flex-col items-center rounded-2xl border border-neutral-200 bg-white p-8 text-center md:mx-0 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-[15px] text-neutral-700 dark:text-neutral-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl bg-neutral-900 px-4 py-2 text-[14px] font-semibold text-white hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900"
      >
        Try again
      </button>
    </div>
  );
}








// src/components/home/BottomNav.tsx



const ITEMS = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/recover", label: "Recover", icon: LifeBuoy },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/account", label: "Account", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900"
          >
            <Icon
              className={cn("h-5 w-5", active ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-400")}
              aria-hidden="true"
            />
            <span
              className={cn(
                "text-[11px] font-medium",
                active ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-400"
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}






// src/components/home/SideNav.tsx



const ITEMS = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/recover", label: "Recover", icon: LifeBuoy },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/account", label: "Account", icon: User },
] as const;

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-56 flex-col gap-1 border-r border-neutral-200 bg-white px-3 py-4 md:flex dark:border-neutral-800 dark:bg-neutral-950"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
              active
                ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900"
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}