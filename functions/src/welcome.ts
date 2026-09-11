// functions/src/scanBusinessSite.ts
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as cheerio from "cheerio";
import * as dns from "node:dns/promises";

export type ScanChannelId =
  | "phone"
  | "whatsapp"
  | "form"
  | "booking"
  | "hours"
  | "after_hours";

interface ScanRequest {
  website?: string;
  businessName?: string;
  category?: string;
}

interface ScanResponse {
  channelIds: ScanChannelId[];
  // false when we had nothing real to inspect (name+category only) — the
  // client must not present a channel count as fact in that case.
  verified: boolean;
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 500_000; // 500 KB is plenty for header/contact markup
const MAX_REQUESTS_PER_WINDOW = 8;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour per IP

const BOOKING_HOSTS = [
  "calendly.com",
  "acuityscheduling.com",
  "square.site",
  "booksy.com",
  "setmore.com",
  "simplybook.me",
  "fresha.com",
  "vagaro.com",
];

const BOOKING_KEYWORDS = [
  "book now",
  "book an appointment",
  "book appointment",
  "schedule appointment",
  "schedule a consultation",
  "make a reservation",
  "reserve a table",
];

const HOURS_KEYWORDS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "opening hours", "business hours", "store hours", "hours of operation",
];

const AFTER_HOURS_KEYWORDS = [
  "24/7", "24 hours", "after hours", "after-hours", "emergency line", "emergency service",
];

export const scanBusinessSite = onCall<ScanRequest, Promise<ScanResponse>>(
  { cors: true, timeoutSeconds: 15, memory: "256MiB" },
  async (request) => {
    await enforceRateLimit(request);

    const { website } = request.data ?? {};

    if (!website || typeof website !== "string" || !website.trim()) {
      // Name + category path: we have no real page to inspect, so we say so
      // honestly instead of guessing at channels. The client falls back to
      // the generic "what we'd watch for" copy with no channel count.
      return { channelIds: [], verified: false };
    }

    const url = normalizeUrl(website);
    await assertSafeToFetch(url);

    const html = await fetchHtml(url);
    const channelIds = detectChannels(html);

    return { channelIds, verified: true };
  }
);

// ---------------------------------------------------------------------------
// URL handling + SSRF guarding
// ---------------------------------------------------------------------------

function normalizeUrl(raw: string): URL {
  const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new HttpsError("invalid-argument", "That doesn't look like a valid website.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "Only http/https websites are supported.");
  }
  return url;
}

async function assertSafeToFetch(url: URL): Promise<void> {
  const hostname = url.hostname;

  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new HttpsError("invalid-argument", "That website can't be checked.");
  }

  let addresses: string[];
  try {
    const result = await dns.lookup(hostname, { all: true });
    addresses = result.map((r) => r.address);
  } catch {
    throw new HttpsError("invalid-argument", "We couldn't resolve that website.");
  }

  for (const address of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new HttpsError("invalid-argument", "That website can't be checked.");
    }
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  const ipv4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Fetching (bounded time + size, redirect-safe)
// ---------------------------------------------------------------------------

async function fetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "IsolynicScanBot/1.0 (+https://isolynic.com)",
        Accept: "text/html",
      },
    });

    if (!res.ok) {
      throw new HttpsError("not-found", "We couldn't reach that website.");
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new HttpsError("failed-precondition", "That doesn't look like a website page.");
    }

    // Re-check the final URL after redirects for SSRF safety.
    await assertSafeToFetch(new URL(res.url));

    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        chunks.push(value);
        if (received >= MAX_BYTES) {
          controller.abort();
          break;
        }
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("unavailable", "We couldn't reach that website right now.");
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Channel detection — evidence-based only, never an invented claim
// ---------------------------------------------------------------------------

function detectChannels(html: string): ScanChannelId[] {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase().replace(/\s+/g, " ");
  const found = new Set<ScanChannelId>();

  const hasTelLink = $('a[href^="tel:"]').length > 0;
  const phonePattern = /(\+?\d[\d\s().-]{7,}\d)/;
  if (hasTelLink || phonePattern.test(bodyText)) {
    found.add("phone");
  }

  const hasWhatsappLink =
    $('a[href*="wa.me"]').length > 0 || $('a[href*="api.whatsapp.com"]').length > 0;
  if (hasWhatsappLink || bodyText.includes("whatsapp")) {
    found.add("whatsapp");
  }

  // Contact form: a <form> with 2+ meaningful fields, excluding search bars
  $("form").each((_, form) => {
    const el = $(form);
    const meaningfulInputs = el.find(
      'input[type="email"], input[type="text"], input[type="tel"], textarea'
    ).length;
    const isSearchForm = el.attr("role") === "search" || el.find('input[type="search"]').length > 0;
    if (meaningfulInputs >= 2 && !isSearchForm) {
      found.add("form");
    }
  });

  const hasBookingLink = $("a[href]").toArray().some((a) => {
    const href = ($(a).attr("href") ?? "").toLowerCase();
    return BOOKING_HOSTS.some((host) => href.includes(host));
  });
  const hasBookingKeyword = BOOKING_KEYWORDS.some((k) => bodyText.includes(k));
  if (hasBookingLink || hasBookingKeyword) {
    found.add("booking");
  }

  const hasOpeningHoursSchema = html.includes("openingHours");
  const hoursKeywordHits = HOURS_KEYWORDS.filter((k) => bodyText.includes(k)).length;
  if (hasOpeningHoursSchema || hoursKeywordHits >= 2) {
    found.add("hours");
  }

  if (AFTER_HOURS_KEYWORDS.some((k) => bodyText.includes(k))) {
    found.add("after_hours");
  }

  return Array.from(found);
}

// ---------------------------------------------------------------------------
// Abuse protection — this endpoint is intentionally callable pre-sign-in,
// so it needs its own rate limit rather than relying on auth.
// ---------------------------------------------------------------------------

async function enforceRateLimit(request: CallableRequest<ScanRequest>): Promise<void> {
  const ip = request.rawRequest?.ip ?? "unknown";
  const db = getFirestore();
  const docId = Buffer.from(ip).toString("base64url");
  const ref = db.collection("scanRateLimits").doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    const data = snap.data() as { count: number; windowStart: number };
    if (now - data.windowStart > WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    if (data.count >= MAX_REQUESTS_PER_WINDOW) {
      throw new HttpsError("resource-exhausted", "Too many checks — please try again in a bit.");
    }

    tx.update(ref, { count: FieldValue.increment(1) });
  });
}