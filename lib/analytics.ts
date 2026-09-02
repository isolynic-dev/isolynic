
// src/lib/analytics.ts
"use client";

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