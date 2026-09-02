"use client";
// src/lib/auth.ts


import {
  signInWithPopup,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export class HumanAuthError extends Error {}

function toHumanError(): HumanAuthError {
  return new HumanAuthError("We couldn't sign you in. Please try again.");
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch {
    throw toHumanError();
  }
}

const EMAIL_STORAGE_KEY = "isolynic_pending_email";

export async function sendEmailSignInLink(email: string) {
  try {
    await sendSignInLinkToEmail(auth, email, {
      url: `${window.location.origin}/`,
      handleCodeInApp: true,
    });
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
  } catch {
    throw toHumanError();
  }
}

export async function completeEmailSignInIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  if (!email) return null; // caller should prompt; kept simple for V1
  try {
    const result = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    return result;
  } catch {
    throw toHumanError();
  }
}

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function ensureRecaptcha(containerId: string): RecaptchaVerifier {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
  });
  return recaptchaVerifier;
}

export async function sendPhoneCode(
  phoneNumber: string,
  containerId: string
): Promise<ConfirmationResult> {
  try {
    const verifier = ensureRecaptcha(containerId);
    return await signInWithPhoneNumber(auth, phoneNumber, verifier);
  } catch {
    throw toHumanError();
  }
}

export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string
) {
  try {
    return await confirmation.confirm(code);
  } catch {
    throw toHumanError();
  }
}