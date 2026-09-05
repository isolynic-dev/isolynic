import { Timestamp } from "firebase/firestore";





// lib/format.ts

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;

  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    value
  );
}

export function channelLabel(channels: string[]): string {
  const map: Record<string, string> = { phone: 'Phone', whatsapp: 'WhatsApp', website: 'Website', email: 'Email' };
  return channels.map((c) => map[c] ?? c).join(' + ');
}





// lib/format/time.ts


/**
 * Timestamp display rules per spec §18/§60:
 * - same day → "10:42 AM"
 * - yesterday → "Yesterday, 4:42 PM"
 * - older → "Aug 28"
 * Always computed against the viewer's local time from a normalized
 * server timestamp — never a client-guessed timezone offset for storage.
 */
export function formatTimelineTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  const date = ts.toDate();
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isSameDay) return timeStr;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDaySeparator(ts: Timestamp): string {
  const date = ts.toDate();
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";

  const daysAgo = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (daysAgo < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export function dayKey(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}