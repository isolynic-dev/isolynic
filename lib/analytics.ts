"use client";

import {
  getFirebaseAnalytics,
} from "./firebase";

import {
  logEvent,
  type Analytics,
} from "firebase/analytics";

// ---------------------------------------------------------------------------
// Shared analytics payload
// ---------------------------------------------------------------------------

export interface AnalyticsPayload {
  [key: string]:
    | string
    | number
    | boolean
    | undefined;
}

// ---------------------------------------------------------------------------
// Welcome analytics events
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Home analytics events
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// All application analytics events
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  | WelcomeEvent
  | HomeAnalyticsEvent;

// ---------------------------------------------------------------------------
// Firebase Analytics instance helper
// ---------------------------------------------------------------------------

let cachedAnalytics: Analytics | null = null;

async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (cachedAnalytics) {
    return cachedAnalytics;
  }

  const analytics = await getFirebaseAnalytics();

  if (!analytics) {
    return null;
  }

  cachedAnalytics = analytics;

  return analytics;
}

// ---------------------------------------------------------------------------
// Browser event helper
// ---------------------------------------------------------------------------

function emitLocalAnalyticsEvent(
  event: AnalyticsEvent,
  payload: AnalyticsPayload
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent("isolynic:analytics", {
        detail: {
          event,
          payload,
        },
      })
    );
  } catch {
    // Local analytics events must never break the product.
  }
}

// ---------------------------------------------------------------------------
// Main analytics tracker
// ---------------------------------------------------------------------------

export async function track(
  event: AnalyticsEvent,
  payload: AnalyticsPayload = {}
): Promise<void> {
  try {
    const analytics = await getAnalyticsInstance();

    if (analytics) {
      logEvent(
        analytics,
        event,
        payload
      );
    }

    emitLocalAnalyticsEvent(
      event,
      payload
    );

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(
        `[analytics] ${event}`,
        payload
      );
    }
  } catch {
    // Analytics failures must never affect the user experience.
  }
}

// ---------------------------------------------------------------------------
// Backwards-compatible generic analytics helper
// ---------------------------------------------------------------------------

export async function logAnalyticsEvent(
  name: string,
  params?: Record<string, unknown>
): Promise<void> {
  try {
    const analytics = await getAnalyticsInstance();

    if (!analytics) {
      return;
    }

    const safeParams: AnalyticsPayload = {};

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === undefined
        ) {
          safeParams[key] = value;
        }
      }
    }

    logEvent(
      analytics,
      name,
      safeParams
    );
  } catch {
    // Analytics failures must never break the UI.
  }
}