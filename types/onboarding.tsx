// src/types/onboarding.ts

/**
 * The internal onboarding state machine.
 * Never exposed to the user — presentation only reacts to it.
 */
export type OnboardingState =
  | "NEW_VISITOR"
  | "CTA_SELECTED"
  | "AUTHENTICATED"
  | "BUSINESS_IDENTITY_STARTED"
  | "BUSINESS_IDENTITY_COMPLETED"
  | "CHANNEL_SELECTION"
  | "CHANNEL_SELECTED"
  | "TEST_READY"
  | "ACTIVATED"
  | "HOME";

export type ChannelType = "whatsapp" | "phone" | "website";

export interface BusinessIdentity {
  businessName: string;
  businessDescription: string;
}

export interface OnboardingRecord {
  uid: string;
  state: OnboardingState;
  businessIdentity?: BusinessIdentity;
  selectedChannel?: ChannelType;
  createdAt: number;
  updatedAt: number;
}

export interface IsolynicUser {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
  onboardingComplete: boolean;
}