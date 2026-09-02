"use client";
// src/app/page.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/hooks";
import { useOnboardingState } from "@/hooks/hooks";
import { isOnboardingComplete } from "@/lib/onboarding";
import { track } from "@/lib/analytics";
import { completeEmailSignInIfPresent } from "@/lib/auth";
import "./globals.css";
import {
  Header,
  Hero,
  HowItWorksOverlay,
  TrustSection,
  Footer,
  AuthPanel,
  ExistingAccountPrompt,
} from "@/components/welcome";


export default function WelcomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { record, updateState } = useOnboardingState(user?.uid ?? null);

  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [existingAccountOpen, setExistingAccountOpen] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);

  const viewedTracked = useRef(false);

  // --- Fire welcome_viewed exactly once ---
  useEffect(() => {
    if (!viewedTracked.current) {
      viewedTracked.current = true;
      track("welcome_viewed");
    }
  }, []);

  // --- Complete any pending email-link sign-in on load ---
  useEffect(() => {
    completeEmailSignInIfPresent().catch(() => {
      /* silently ignored — user can retry via the auth panel */
    });
  }, []);

  // --- Returning, authenticated users bypass Welcome ---
  useEffect(() => {
    if (authLoading || !user) return;

    if (!record) return; // wait for onboarding record to resolve

    if (isOnboardingComplete(record.state)) {
      router.replace("/home");
      return;
    }

    // Onboarding incomplete: resume at the exact point they left off.
    if (pendingRedirect) {
      router.replace(mapStateToRoute(record.state));
    }
  }, [authLoading, user, record, router, pendingRedirect]);

  const handleProtectCustomers = useCallback(() => {
    track("protect_customers_clicked");
    setHowItWorksOpen(false);

    if (user) {
      // Already authenticated → go straight to business setup.
      setPendingRedirect(true);
    } else {
      setAuthOpen(true);
    }
  }, [user]);

  const handleSeeHowItWorks = useCallback(() => {
    track("see_how_it_works_clicked");
    setHowItWorksOpen(true);
  }, []);

  const handleSignInClick = useCallback(() => {
    track("sign_in_clicked");
    setAuthOpen(true);
  }, []);

  const handleAuthenticated = useCallback(async () => {
    setAuthOpen(false);
    if (!user) return;

    if (record && isOnboardingComplete(record.state)) {
      router.replace("/home");
      return;
    }

    await updateState({ state: "BUSINESS_IDENTITY_STARTED" });
    router.replace("/onboarding/business");
  }, [user, record, router, updateState]);

  const handleLogoClick = useCallback(() => {
    if (user && record && isOnboardingComplete(record.state)) {
      router.push("/home");
    }
    // Unauthenticated users simply stay on Welcome — no-op.
  }, [user, record, router]);

  return (
    <main className="min-h-screen bg-white">
      <Header
        isAuthenticated={Boolean(user)}
        onHowItWorks={handleSeeHowItWorks}
        onSignIn={handleSignInClick}
        onProtect={handleProtectCustomers}
        onLogoClick={handleLogoClick}
      />

      <Hero
        onProtect={handleProtectCustomers}
        onSeeHowItWorks={handleSeeHowItWorks}
      />

      <TrustSection />

      <Footer />

      <HowItWorksOverlay
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        onProtect={handleProtectCustomers}
      />

      <AuthPanel
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
      />

      <ExistingAccountPrompt
        open={existingAccountOpen}
        onContinue={() => {
          setExistingAccountOpen(false);
          setAuthOpen(true);
        }}
        onUseAnotherEmail={() => setExistingAccountOpen(false)}
      />
    </main>
  );
}

function mapStateToRoute(
  state:
    | "NEW_VISITOR"
    | "CTA_SELECTED"
    | "AUTHENTICATED"
    | "BUSINESS_IDENTITY_STARTED"
    | "BUSINESS_IDENTITY_COMPLETED"
    | "CHANNEL_SELECTION"
    | "CHANNEL_SELECTED"
    | "TEST_READY"
    | "ACTIVATED"
    | "HOME"
): string {
  switch (state) {
    case "AUTHENTICATED":
    case "BUSINESS_IDENTITY_STARTED":
      return "/onboarding/business";
    case "BUSINESS_IDENTITY_COMPLETED":
    case "CHANNEL_SELECTION":
      return "/onboarding/channel";
    default:
      return "/home";
  }
}