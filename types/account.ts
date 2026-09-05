
// types/account.ts

export type ChannelStatus = 'connected' | 'not_connected' | 'needs_attention' | 'paused';
export type PersistenceLevel = 'gentle' | 'balanced' | 'persistent';
export type AfterHoursBehavior = 'auto_help' | 'ask_first' | 'pause';
export type CalendarAvailabilitySource = 'calendar' | 'business_hours';
export type IsolynicRunState = 'protected' | 'paused' | 'setup_incomplete' | 'channels_need_attention';

export interface BusinessInfo {
  businessName: string;
  description: string;
  category: string | null;
  phone: string;
  whatsapp: string;
  website: string;
  serviceArea: string;
  updatedAt: number;
}

export interface ChannelState {
  status: ChannelStatus;
  connectedNumberOrUrl?: string;
  lastTestedAt?: number;
  lastError?: string;
}

export interface ChannelsState {
  whatsapp: ChannelState;
  phone: ChannelState;
  website: ChannelState;
}

export interface DayHours {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  isOpen: boolean;
  openTime: string; // "08:00"
  closeTime: string; // "18:00"
}

export interface BusinessHoursState {
  timezone: string; // e.g. "Africa/Accra"
  days: DayHours[];
  afterHoursBehavior: AfterHoursBehavior;
}

export interface CalendarState {
  provider: 'google' | null;
  connectionStatus: ChannelStatus;
  calendarId?: string;
  availabilitySource: CalendarAvailabilitySource;
  appointmentDurationMinutes: 15 | 30 | 45 | 60;
  bufferMinutes: 0 | 15 | 30;
  confirmationEnabled: boolean;
}

export interface RecoveryPreferencesState {
  automaticRecovery: boolean;
  persistenceLevel: PersistenceLevel;
  maxFollowups: 1 | 2 | 3 | 4;
  requireHumanApproval: boolean;
}

export interface NotificationsState {
  customersNeedingAttention: boolean;
  importantRecovery: boolean;
  dailySummary: boolean;
  weeklyResults: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
}

export interface SubscriptionState {
  planName: string;
  priceLabel: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  renewalDateISO: string | null;
  paymentProviderCustomerId: string | null;
  paymentMethodLast4: string | null;
  billingEmail: string | null;
  usage: {
    opportunitiesProtected: number;
    opportunitiesRecovered: number;
    usagePercentOfPlan: number | null;
  };
}

export interface AccountState {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  isolynicRunState: IsolynicRunState;
  business: BusinessInfo;
  channels: ChannelsState;
  hours: BusinessHoursState;
  calendar: CalendarState;
  recovery: RecoveryPreferencesState;
  notifications: NotificationsState;
  subscription: SubscriptionState;
}

export const DEFAULT_RECOVERY_PREFERENCES: RecoveryPreferencesState = {
  automaticRecovery: true,
  persistenceLevel: 'balanced',
  maxFollowups: 3,
  requireHumanApproval: true,
};

export const DEFAULT_NOTIFICATIONS: NotificationsState = {
  customersNeedingAttention: true,
  importantRecovery: true,
  dailySummary: true,
  weeklyResults: true,
  channels: { inApp: true, email: true, push: false },
};