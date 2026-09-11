// src/lib/scan.ts
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

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

interface ScanResponseData {
  channelIds: ScanChannelId[];
  verified: boolean;
}

export async function callScanBusinessSite(
  input: ScanRequest
): Promise<{ data: ScanResponseData }> {
  const functions = getFunctions(getApp());
  const fn = httpsCallable<ScanRequest, ScanResponseData>(functions, "scanBusinessSite");
  const result = await fn(input);
  return { data: result.data };
}