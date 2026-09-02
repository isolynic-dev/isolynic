import {
  HumanAuthError,
  signInWithGoogle,
  sendEmailSignInLink,
  sendPhoneCode,
  confirmPhoneCode,
} from "@/lib/auth";
import type { ConfirmationResult } from "firebase/auth";
import { useEffect, useState, useRef } from "react";
import { useReducedMotion } from "@/hooks/hooks";




// src/components/welcome/Header.tsx
"use client";

interface HeaderProps {
  isAuthenticated: boolean;
  onHowItWorks: () => void;
  onSignIn: () => void;
  onProtect: () => void;
  onLogoClick: () => void;
}

export function Header({
  isAuthenticated,
  onHowItWorks,
  onSignIn,
  onProtect,
  onLogoClick,
}: HeaderProps) {
  return (
    <header
      role="banner"
      className="sticky top-0 z-30 w-full border-b border-neutral-100 bg-white/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onLogoClick}
          className="text-lg font-semibold tracking-tight text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent] sm:text-xl"
          aria-label="Isolynic home"
        >
          Isolynic
        </button>

        {/* Desktop / tablet nav */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 sm:flex"
        >
          <button
            type="button"
            onClick={onHowItWorks}
            className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
          >
            How it works
          </button>
          {!isAuthenticated && (
            <button
              type="button"
              onClick={onSignIn}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={onProtect}
            aria-label="Protect my customers"
            className="rounded-full bg-[--brand-accent] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent] active:scale-[0.99]"
          >
            Protect my customers
          </button>
        </nav>

        {/* Mobile nav — logo + sign in only, per spec */}
        <div className="flex items-center sm:hidden">
          {!isAuthenticated && (
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[44px] rounded-full px-3 text-sm font-medium text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// src/components/welcome/RecoveryIllustration.tsx


type Stage = "inquiry" | "risk" | "noticed" | "recovered";

const STAGE_SEQUENCE: Stage[] = ["inquiry", "risk", "noticed", "recovered"];
const STAGE_DURATION_MS = 1100;

const STAGE_COPY: Record<
  Stage,
  {
    title: string;
    detail: string;
    tone: "neutral" | "risk" | "action" | "success";
  }
> = {
  inquiry: {
    title: "Someone just contacted you",
    detail: "Missed call",
    tone: "neutral",
  },
  risk: {
    title: "This opportunity may be slipping away",
    detail: "No response yet",
    tone: "risk",
  },
  noticed: {
    title: "Isolynic noticed",
    detail: "Customer wants an appointment",
    tone: "action",
  },
  recovered: {
    title: "Recovered opportunity",
    detail: "Customer is still engaged",
    tone: "success",
  },
};

const TONE_STYLES: Record<string, string> = {
  neutral: "bg-neutral-50 text-neutral-700 border-neutral-200",
  risk: "bg-amber-50 text-amber-800 border-amber-200",
  action:
    "bg-[--brand-accent-soft] text-[--brand-accent-strong] border-[--brand-accent-border]",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

/**
 * The Hero-side product visual. Communicates:
 * customer intent → risk of loss → Isolynic intervention → recovered opportunity
 * Deliberately not a busy UI screenshot — a legible mini scenario instead.
 */
export default function RecoveryIllustration() {
  const reducedMotion = useReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return; // static final state for reduced-motion users

    const interval = window.setInterval(() => {
      setStageIndex((i) => (i + 1) % STAGE_SEQUENCE.length);
    }, STAGE_DURATION_MS);

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const activeStage: Stage = reducedMotion
    ? "recovered"
    : STAGE_SEQUENCE[stageIndex];

  const copy = STAGE_COPY[activeStage];

  return (
    <div
      role="img"
      aria-label={`Product demonstration: ${copy.title}. ${copy.detail}.`}
      className="w-full max-w-[420px] rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
        3 customers may be slipping away
      </p>

      <ul className="mb-5 space-y-2.5">
        <MiniRow name="Sarah" status="Quote sent — no response" />
        <MiniRow name="Daniel" status="Missed call — no response" />
        <MiniRow
          name="Michael"
          status="Booking started — not completed"
        />
      </ul>

      <div
        className={[
          "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-500",
          TONE_STYLES[copy.tone],
        ].join(" ")}
      >
        <div>
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="text-xs opacity-80">{copy.detail}</p>
        </div>

        {!reducedMotion && (
          <div className="flex gap-1" aria-hidden="true">
            {STAGE_SEQUENCE.map((s) => (
              <span
                key={s}
                className={[
                  "h-1.5 w-1.5 rounded-full transition-opacity duration-300",
                  s === activeStage ? "opacity-100" : "opacity-25",
                ].join(" ")}
                style={{ backgroundColor: "currentColor" }}
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-neutral-700">
        Isolynic is recovering 2 automatically.
      </p>
    </div>
  );
}

function MiniRow({
  name,
  status,
}: {
  name: string;
  status: string;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
      <span className="font-medium text-neutral-800">{name}</span>
      <span className="text-neutral-500">{status}</span>
    </li>
  );
}







// src/components/welcome/Hero.tsx


interface HeroProps {
  onProtect: () => void;
  onSeeHowItWorks: () => void;
}

export function Hero({ onProtect, onSeeHowItWorks }: HeroProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-4 py-10 sm:px-6 md:py-16 lg:grid-cols-12 lg:gap-8 lg:py-24 lg:px-8"
    >
      <div className="order-1 lg:col-span-5">
        <h1
          id="hero-heading"
          className="text-[36px] font-bold leading-[1.05] tracking-tight text-neutral-900 sm:text-[44px] lg:text-[60px]"
        >
          Don&apos;t lose customers just because you were busy.
        </h1>

        <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-neutral-600 sm:text-[19px]">
          Isolynic notices when a customer may be slipping away and helps
          bring them back — so you can focus on running your business.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onProtect}
            aria-label="Protect my customers"
            className="min-h-[52px] w-full rounded-full bg-[--brand-accent] px-7 text-[16px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent] active:scale-[0.99] sm:w-auto"
          >
            Protect my customers
          </button>

          <button
            type="button"
            onClick={onSeeHowItWorks}
            className="min-h-[44px] text-[16px] font-medium text-neutral-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
          >
            See how it works
          </button>
        </div>

        <p className="mt-3 text-sm text-neutral-500">
          Takes about 2 minutes to get started.
        </p>
      </div>

      <div className="order-2 flex justify-center lg:col-span-6 lg:col-start-7 lg:justify-end">
        <RecoveryIllustration />
      </div>
    </section>
  );
}







// src/components/welcome/HowItWorksOverlay.tsx


interface HowItWorksOverlayProps {
  open: boolean;
  onClose: () => void;
  onProtect: () => void;
}

const STEPS = [
  {
    title: "A customer reaches out",
    body: "Call, message, or contact you through your website.",
  },
  {
    title: "Isolynic notices when the opportunity may be slipping",
    body: "It looks for signs that the customer needs a response or follow-up.",
  },
  {
    title: "Isolynic helps recover it",
    body: "It responds, follows up, or asks you to step in.",
  },
];

export function HowItWorksOverlay({
  open,
  onClose,
  onProtect,
}: HowItWorksOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-it-works-heading"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between">
          <h2
            id="how-it-works-heading"
            className="text-xl font-semibold text-neutral-900"
          >
            Here&apos;s what Isolynic does
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-4 rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--brand-accent]"
          >
            <CloseIcon />
          </button>
        </div>

        <ol className="space-y-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[--brand-accent-soft] text-sm font-semibold text-[--brand-accent-strong]"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-semibold text-neutral-900">
                  {step.title}
                </p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-neutral-600">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onProtect}
          className="mt-7 min-h-[48px] w-full rounded-full bg-[--brand-accent] px-6 text-[16px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent] active:scale-[0.99]"
        >
          Protect my customers
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M1 1L17 17M17 1L1 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}






// src/components/welcome/TrustSection.tsx

const ITEMS = [
  {
    title: "You stay in control",
    body: "Take over a conversation at any time.",
  },
  {
    title: "No technical setup",
    body: "Isolynic handles the complicated parts.",
  },
  {
    title: "Start small",
    body: "You can begin with one customer channel.",
  },
];

export function TrustSection() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 md:py-16 lg:px-8"
    >
      <div className="mx-auto max-w-[640px] text-center">
        <h2
          id="trust-heading"
          className="text-2xl font-semibold text-neutral-900 sm:text-3xl"
        >
          You stay in control.
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-neutral-600">
          Isolynic can handle routine customer recovery, and you can step in
          whenever you want.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-5"
          >
            <p className="text-[15px] font-semibold text-neutral-900">
              {item.title}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-600">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}







// src/components/welcome/Footer.tsx



export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-neutral-100 py-8"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 text-sm text-neutral-500 sm:flex-row sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} Isolynic</p>

        <nav aria-label="Legal" className="flex gap-6">
          <a
            href="/privacy"
            className="hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
          >
            Privacy
          </a>

          <a
            href="/terms"
            className="hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
          >
            Terms
          </a>

          <a
            href="/help"
            className="hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
          >
            Help
          </a>
        </nav>
      </div>
    </footer>
  );
}









// src/components/welcome/ExistingAccountPrompt.tsx


interface ExistingAccountPromptProps {
  open: boolean;
  onContinue: () => void;
  onUseAnotherEmail: () => void;
}

export function ExistingAccountPrompt({
  open,
  onContinue,
  onUseAnotherEmail,
}: ExistingAccountPromptProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="existing-account-heading"
        className="w-full max-w-[400px] rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <h2
          id="existing-account-heading"
          className="text-lg font-semibold text-neutral-900"
        >
          You already have an Isolynic account.
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="min-h-[48px] rounded-full bg-[--brand-accent] px-6 text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
          >
            Continue to my account
          </button>
          <button
            type="button"
            onClick={onUseAnotherEmail}
            className="min-h-[48px] rounded-full border border-neutral-200 px-6 text-[15px] font-medium text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
          >
            Use another email
          </button>
        </div>
      </div>
    </div>
  );
}







// src/components/welcome/AuthPanel.tsx



interface AuthPanelProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

type Mode = "choose" | "email" | "email-sent" | "phone" | "phone-code";

const RECAPTCHA_CONTAINER_ID = "isolynic-recaptcha-container";

export function AuthPanel({
  open,
  onClose,
  onAuthenticated,
}: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const runSafely = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof HumanAuthError) {
        setError(e.message);
      } else if (!navigator.onLine) {
        setError(
          "You're having trouble connecting. Check your connection and try again."
        );
      } else {
        setError("Something went wrong. Refresh the page and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = () =>
    runSafely(async () => {
      await signInWithGoogle();
      onAuthenticated();
    });

  const handleSendEmailLink = () =>
    runSafely(async () => {
      await sendEmailSignInLink(email);
      setMode("email-sent");
    });

  const handleSendPhoneCode = () =>
    runSafely(async () => {
      const result = await sendPhoneCode(phone, RECAPTCHA_CONTAINER_ID);
      setConfirmation(result);
      setMode("phone-code");
    });

  const handleConfirmCode = () =>
    runSafely(async () => {
      if (!confirmation) return;
      await confirmPhoneCode(confirmation, code);
      onAuthenticated();
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl sm:p-8"
      >
        <h2 id="auth-heading" className="text-xl font-semibold text-neutral-900">
          Continue to Isolynic
        </h2>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {mode === "choose" && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className="min-h-[48px] rounded-full border border-neutral-200 px-6 text-[15px] font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => setMode("email")}
              className="min-h-[48px] rounded-full border border-neutral-200 px-6 text-[15px] font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Continue with email
            </button>
            <button
              type="button"
              onClick={() => setMode("phone")}
              className="min-h-[48px] rounded-full border border-neutral-200 px-6 text-[15px] font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Continue with phone
            </button>
          </div>
        )}

        {mode === "email" && (
          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendEmailLink();
            }}
          >
            <label htmlFor="email-input" className="text-sm font-medium text-neutral-700">
              Email address
            </label>
            <input
              id="email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[48px] rounded-lg border border-neutral-200 px-4 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--brand-accent]"
              placeholder="you@business.com"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[48px] rounded-full bg-[--brand-accent] px-6 text-[15px] font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Send sign-in link
            </button>
          </form>
        )}

        {mode === "email-sent" && (
          <p className="mt-6 text-[15px] text-neutral-700">
            Check <span className="font-semibold">{email}</span> for a link to
            finish signing in.
          </p>
        )}

        {mode === "phone" && (
          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPhoneCode();
            }}
          >
            <label htmlFor="phone-input" className="text-sm font-medium text-neutral-700">
              Phone number
            </label>
            <input
              id="phone-input"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-[48px] rounded-lg border border-neutral-200 px-4 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--brand-accent]"
              placeholder="+233 XX XXX XXXX"
            />
            <div id={RECAPTCHA_CONTAINER_ID} />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[48px] rounded-full bg-[--brand-accent] px-6 text-[15px] font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Send code
            </button>
          </form>
        )}

        {mode === "phone-code" && (
          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmCode();
            }}
          >
            <label htmlFor="code-input" className="text-sm font-medium text-neutral-700">
              Verification code
            </label>
            <input
              id="code-input"
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-[48px] rounded-lg border border-neutral-200 px-4 text-[15px] tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--brand-accent]"
              placeholder="123456"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[48px] rounded-full bg-[--brand-accent] px-6 text-[15px] font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--brand-accent]"
            >
              Confirm
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full text-center text-sm text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}