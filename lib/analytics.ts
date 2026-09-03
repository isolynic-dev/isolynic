"use client";
// src/lib/analytics.ts


import { logEvent } from "firebase/analytics";
import { getFirebaseAnalytics } from "./firebase";

/**
 * Internal event names — never surfaced to the user.
 * Kept as a union so callers can't typo an event name.
 */
export type WelcomeEvent =
  | "welcome_viewed"
  | "see_how_it_works_clicked"
  | "protect_customers_clicked"
  | "sign_in_clicked"
  | "business_name_started"
  | "business_name_completed"
  | "business_description_completed"
  | "channel_selection_started"
  | "channel_selected"
  | "onboarding_abandoned"
  | "onboarding_completed"
  | "first_test_started"
  | "first_test_completed";

export async function track(
  event: WelcomeEvent,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return;
    logEvent(analytics, event, params);
  } catch {
    // Analytics failures must never affect the user experience.
  }
}






// Event names as specified in §57 "Core Analytics for Home".
export type HomeAnalyticsEvent =
  | "home_viewed"
  | "attention_card_viewed"
  | "review_customers_clicked"
  | "needs_you_clicked"
  | "recovery_results_clicked"
  | "activity_item_clicked"
  | "home_refresh"
  | "home_load_time"
  | "home_error"
  | "customer_action_completed";

interface AnalyticsPayload {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Thin analytics facade. Swap the internals for Segment / Amplitude / GA4 /
 * a Firebase Analytics logEvent call without touching call sites.
 */
export function track(event: HomeAnalyticsEvent, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") return;
  try {
    // Example real wiring:
    // import { getAnalytics, logEvent } from "firebase/analytics";
    // logEvent(getAnalytics(app), event, payload);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[analytics] ${event}`, payload);
    }
    window.dispatchEvent(new CustomEvent("isolynic:analytics", { detail: { event, payload } }));
  } catch {
    // Analytics must never break the product experience.
  }
}