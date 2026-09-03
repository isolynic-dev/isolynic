
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * §30 Revenue Display Rules — never fabricate a number.
 */
export function formatRevenue(revenue: { amount: number; isEstimate: boolean; hasData: boolean }): string | null {
  if (!revenue.hasData) return null;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(revenue.amount);
  return revenue.isEstimate ? `Estimated ${formatted}` : formatted;
}

/**
 * §52 Offline / staleness labeling.
 */
export function formatUpdatedAt(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin === 1) return "1 minute ago";
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr === 1) return "1 hour ago";
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDay = Math.round(diffHr / 24);
  return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
}

export function formatActivityTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}