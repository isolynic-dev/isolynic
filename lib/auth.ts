'use client';

import { useEffect, useState } from 'react';
import {
onAuthStateChanged,
RecaptchaVerifier,
sendSignInLinkToEmail,
signInWithEmailLink,
signInWithPhoneNumber,
signInWithPopup,
isSignInWithEmailLink,
type ConfirmationResult,
type User,
} from 'firebase/auth';

import { auth, googleProvider } from './firebase';

export class HumanAuthError extends Error {
constructor(message: string) {
super(message);
this.name = 'HumanAuthError';
}
}

function toHumanError(): HumanAuthError {
return new HumanAuthError(
"We couldn't sign you in. Please try again."
);
}

/* -------------------------------------------------------------------------- */
/* Google authentication                                                       */
/* -------------------------------------------------------------------------- */

export async function signInWithGoogle() {
try {
return await signInWithPopup(auth, googleProvider);
} catch {
throw toHumanError();
}
}

/* -------------------------------------------------------------------------- */
/* Email-link authentication                                                   */
/* -------------------------------------------------------------------------- */

const EMAIL_STORAGE_KEY = 'isolynic_pending_email';

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
if (!isSignInWithEmailLink(auth, window.location.href)) {
return null;
}

const email = window.localStorage.getItem(EMAIL_STORAGE_KEY);

if (!email) {
return null;
}

try {
const result = await signInWithEmailLink(
auth,
email,
window.location.href
);


window.localStorage.removeItem(EMAIL_STORAGE_KEY);

return result;


} catch {
throw toHumanError();
}
}

/* -------------------------------------------------------------------------- */
/* Phone authentication                                                        */
/* -------------------------------------------------------------------------- */

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function ensureRecaptcha(
containerId: string
): RecaptchaVerifier {
if (recaptchaVerifier) {
return recaptchaVerifier;
}

recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
size: 'invisible',
});

return recaptchaVerifier;
}

export async function sendPhoneCode(
phoneNumber: string,
containerId: string
): Promise<ConfirmationResult> {
try {
const verifier = ensureRecaptcha(containerId);


return await signInWithPhoneNumber(
  auth,
  phoneNumber,
  verifier
);


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

/* -------------------------------------------------------------------------- */
/* Authenticated business hook                                                 */
/* -------------------------------------------------------------------------- */

/**

* Returns the currently authenticated user as the business identity.
*
* This implementation uses the Firebase user's UID as businessId.
* If your application stores a separate business ID, replace the
* `businessId` assignment below with that value.
  */
  export function useAuthedBusiness(): {
  user: User | null;
  businessId: string | null;
  isMobile: boolean;
  loading: boolean;
  } {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(
  auth.currentUser === null
  );

const [isMobile, setIsMobile] = useState<boolean>(() => {
if (typeof window === 'undefined') {
return false;
}


return window.matchMedia('(max-width: 767px)').matches;


});

useEffect(() => {
const unsubscribe = onAuthStateChanged(
auth,
(currentUser) => {
setUser(currentUser);
setLoading(false);
},
() => {
setUser(null);
setLoading(false);
}
);


return unsubscribe;


}, []);

useEffect(() => {
if (typeof window === 'undefined') {
return undefined;
}


const mediaQuery = window.matchMedia(
  '(max-width: 767px)'
);

const handleChange = (event: MediaQueryListEvent) => {
  setIsMobile(event.matches);
};

setIsMobile(mediaQuery.matches);

if (mediaQuery.addEventListener) {
  mediaQuery.addEventListener('change', handleChange);

  return () => {
    mediaQuery.removeEventListener(
      'change',
      handleChange
    );
  };
}

mediaQuery.addListener(handleChange);

return () => {
  mediaQuery.removeListener(handleChange);
};


}, []);

return {
user,
businessId: user?.uid ?? null,
isMobile,
loading,
};
}
