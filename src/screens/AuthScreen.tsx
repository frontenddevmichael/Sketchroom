import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { LoadingScreen } from "../components/LoadingScreen";
import { usePageTitle } from "../lib/usePageTitle";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import "../components/shared.css";
import "./AuthScreen.css";

function GoogleGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.48 24 48 24z"
      />
    </svg>
  );
}

function LogoGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="auth-logo-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z"
        fill="var(--green-500)"
        stroke="var(--green-500)"
      />
    </svg>
  );
}

/* Decorative canvas fragments — small, real-looking pieces of a Sketchroom
   session drifting in the margins around the card. Same block/ghost/cursor
   vocabulary as FeatureShowcase and FinalCta, so signing in still feels like
   the product rather than a generic form page. Purely decorative: hidden
   from AT, and hidden entirely on small screens where there's no margin to
   put them in. */
function AuthCanvasDecor() {
  return (
    <div className="auth-decor" aria-hidden="true">
      <div className="auth-decor-item auth-decor-a">
        <span className="auth-decor-block">Room·42</span>
        <svg className="auth-decor-spark" viewBox="0 0 12 12">
          <path d="M6 0 l1.4 4.6 4.6 1.4 -4.6 1.4 -1.4 4.6 -1.4 -4.6 -4.6 -1.4 4.6 -1.4 z" />
        </svg>
      </div>

      <div className="auth-decor-item auth-decor-b">
        <span className="auth-decor-block auth-decor-ghost">Onboarding·v2</span>
      </div>

      <div className="auth-decor-item auth-decor-c">
        <span className="auth-decor-bubble">back in a sec ✦</span>
      </div>

      <svg className="auth-decor-scribble auth-decor-scribble-a" viewBox="0 0 160 32" preserveAspectRatio="none">
        <path d="M2 18 C 30 6, 55 28, 84 16 S 138 12, 158 20" />
      </svg>

      <svg className="auth-decor-scribble auth-decor-scribble-b" viewBox="0 0 140 28" preserveAspectRatio="none">
        <path d="M2 14 C 24 2, 48 24, 74 12 S 120 6, 138 16" />
      </svg>

      <span className="auth-decor-cursor auth-decor-cursor-a" />
      <span className="auth-decor-cursor auth-decor-cursor-green auth-decor-cursor-b" />
    </div>
  );
}

type Step =
  | { kind: "signin" }
  | { kind: "signup" }
  | { kind: "verify"; email: string }
  | { kind: "forgot" }
  | { kind: "reset"; email: string }
  | { kind: "resetDone" };

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.replace(/^ConvexError: /, "");
  if (/invalidsecret|invalid credentials|invalid password/i.test(msg)) {
    return "That email and password don't match. Try again, or create an account.";
  }
  if (/invalid code/i.test(msg)) {
    return "That code didn't work — double-check the email we sent and try again.";
  }
  if (/email/i.test(msg)) return msg;
  if (/password/i.test(msg)) return msg;
  return "Something went wrong. Please try again.";
}

export function AuthScreen() {
  usePageTitle("Sign in — Sketchroom");
  const { isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const authConfig = useQuery(api.users.authConfig);
  const [step, setStep] = useState<Step>({ kind: "signin" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const reduce = useReducedMotion();

  if (isLoading) return <LoadingScreen />;

  const emailEnabled = authConfig?.emailEnabled ?? false;
  const googleEnabled = authConfig?.googleEnabled ?? false;

  const run = async (provider: string, params: Record<string, string>) => {
    setSubmitting(true);
    setError(null);
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      const oauthParams =
        provider !== "password" && next
          ? { ...params, redirectTo: next }
          : params;
      const { signingIn } = await signIn(provider, oauthParams);
      if (!signingIn) {
        const email = params.email ?? "";
        if (params.flow === "reset") setStep({ kind: "reset", email });
        else if (params.flow === "reset-verification")
          setStep({ kind: "resetDone" });
        else setStep({ kind: "verify", email });
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onPassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void run("password", {
      flow: step.kind === "signup" ? "signUp" : "signIn",
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
      ...(step.kind === "signup"
        ? { name: String(fd.get("name") ?? "").trim() }
        : {}),
    });
  };

  const onVerify = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email =
      step.kind === "verify"
        ? step.email
        : String(fd.get("email") ?? "").trim();
    void run("password", {
      flow: "email-verification",
      email,
      code: String(fd.get("code") ?? "").trim(),
    });
  };

  const onForgot = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void run("password", {
      flow: "reset",
      email: String(fd.get("email") ?? "").trim(),
    });
  };

  const onReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email =
      step.kind === "reset" ? step.email : String(fd.get("email") ?? "").trim();
    void run("password", {
      flow: "reset-verification",
      email,
      code: String(fd.get("code") ?? "").trim(),
      newPassword: String(fd.get("newPassword") ?? ""),
    });
  };

  const goBack = () => {
    setError(null);
    setStep({ kind: "signin" });
  };

  const switchMode = (kind: "signin" | "signup") => {
    setError(null);
    setStep({ kind });
  };

  const onFieldEdit = () => {
    if (error) setError(null);
  };

  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const target = tabActive === "signin" ? "signup" : "signin";
    switchMode(target);
    requestAnimationFrame(() => {
      document
        .getElementById(target === "signin" ? "auth-tab-signin" : "auth-tab-signup")
        ?.focus();
    });
  };

  const tabActive = step.kind === "signup" ? "signup" : "signin";
  const passwordTitle =
    step.kind === "signup" ? "Create your account" : "Welcome back";

  const stepMotionProps = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="auth-screen">
      <AuthCanvasDecor />

      <main className="auth-main">
        <div className="auth-wrap">
          <a className="auth-home-link" href="/">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to home
          </a>
          <aside className="auth-card" aria-label="Account">
            <a className="auth-wordmark" href="/" aria-label="Sketchroom home">
              <LogoGlyph size={18} />
              Sketchroom
            </a>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step.kind} {...stepMotionProps}>
                {step.kind === "signin" || step.kind === "signup" ? (
                  <>
                    <h2 className="auth-card-title">{passwordTitle}</h2>
                    <p className="auth-card-sub">
                      {step.kind === "signup"
                        ? "A few seconds and you're sketching with your team."
                        : "Sign in to pick up right where you left off."}
                    </p>

                    <div
                      className="auth-tabs"
                      role="tablist"
                      aria-label="Sign in or create an account"
                      onKeyDown={onTabsKeyDown}
                    >
                      <button
                        id="auth-tab-signin"
                        className={`auth-tab ${tabActive === "signin" ? "active" : ""}`}
                        role="tab"
                        aria-selected={tabActive === "signin"}
                        aria-controls="auth-tabpanel"
                        tabIndex={tabActive === "signin" ? 0 : -1}
                        onClick={() => switchMode("signin")}
                      >
                        Sign in
                      </button>
                      <button
                        id="auth-tab-signup"
                        className={`auth-tab ${tabActive === "signup" ? "active" : ""}`}
                        role="tab"
                        aria-selected={tabActive === "signup"}
                        aria-controls="auth-tabpanel"
                        tabIndex={tabActive === "signup" ? 0 : -1}
                        onClick={() => switchMode("signup")}
                      >
                        Create account
                      </button>
                    </div>

                    <div
                      id="auth-tabpanel"
                      role="tabpanel"
                      aria-labelledby={`auth-tab-${tabActive}`}
                    >
                      {googleEnabled && (
                        <>
                          <button
                            className="auth-google-btn"
                            type="button"
                            onClick={() => void run("google", {})}
                            disabled={submitting}
                          >
                            <GoogleGlyph size={18} />
                            Continue with Google
                          </button>
                          <div className="auth-card-divider" role="separator">
                            <span>or use your email</span>
                          </div>
                        </>
                      )}

                      <form className="auth-form" onSubmit={onPassword}>
                        {step.kind === "signup" && (
                          <label className="auth-field">
                            <span className="auth-label">Name</span>
                            <input
                              className="input auth-input"
                              name="name"
                              type="text"
                              autoComplete="name"
                              placeholder="Ada Lovelace"
                              maxLength={60}
                              onChange={onFieldEdit}
                            />
                          </label>
                        )}
                        <label className="auth-field">
                          <span className="auth-label">Email</span>
                          <input
                            className="input auth-input"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="you@studio.com"
                            autoFocus
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? "auth-error" : undefined}
                            onChange={onFieldEdit}
                          />
                        </label>
                        <label className="auth-field">
                          <span className="auth-label">Password</span>
                          <div className="auth-password-wrap">
                            <input
                              className="input auth-input auth-password"
                              name="password"
                              type={showPassword ? "text" : "password"}
                              required
                              minLength={8}
                              autoComplete={
                                step.kind === "signup"
                                  ? "new-password"
                                  : "current-password"
                              }
                              placeholder="8+ characters"
                              aria-invalid={error ? true : undefined}
                              aria-describedby={error ? "auth-error" : undefined}
                              onChange={onFieldEdit}
                            />
                            <button
                              type="button"
                              className="auth-password-toggle"
                              onClick={() => setShowPassword((v) => !v)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              aria-pressed={showPassword}
                            >
                              <span key={showPassword ? "on" : "off"} className="auth-icon-pop">
                                {showPassword ? (
                                  <EyeOff size={16} aria-hidden="true" />
                                ) : (
                                  <Eye size={16} aria-hidden="true" />
                                )}
                              </span>
                            </button>
                          </div>
                        </label>
                        {step.kind === "signin" && emailEnabled && (
                          <button
                            type="button"
                            className="auth-link-btn"
                            onClick={() => {
                              setError(null);
                              setStep({ kind: "forgot" });
                            }}
                          >
                            Forgot password?
                          </button>
                        )}
                        {error && (
                          <p className="auth-error" role="alert" id="auth-error">
                            {error}
                          </p>
                        )}
                        <button
                          className="btn btn-primary auth-submit"
                          type="submit"
                          disabled={submitting}
                        >
                          {submitting ? (
                            <span className="auth-spinner" aria-hidden="true" />
                          ) : step.kind === "signup" ? (
                            <>
                              Create account <ArrowRight size={16} />
                            </>
                          ) : (
                            "Sign in"
                          )}
                        </button>
                      </form>
                    </div>

                    <p className="auth-card-small">
                      By continuing you agree to the <a href="/terms">Terms</a> and{" "}
                      <a href="/privacy">Privacy Policy</a>.
                    </p>
                    <footer className="auth-footer">
                      <span>© 2026 Sketchroom</span>
                      <a href="/terms">Terms</a>
                      <a href="/privacy">Privacy</a>
                      <span>Status</span>
                    </footer>
                  </>
                ) : step.kind === "verify" ? (
                  <>
                    <h2 className="auth-card-title">Check your inbox</h2>
                    <p className="auth-card-sub">
                      We sent a code to <strong>{step.email}</strong>. Enter it
                      below to finish signing in.
                    </p>
                    <form className="auth-form" onSubmit={onVerify}>
                      <label className="auth-field">
                        <span className="auth-label">Verification code</span>
                        <input
                          className="input auth-input auth-code"
                          name="code"
                          type="text"
                          required
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={8}
                          placeholder="00000000"
                          autoFocus
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? "auth-error" : undefined}
                          onChange={onFieldEdit}
                        />
                      </label>
                      {error && (
                        <p className="auth-error" role="alert" id="auth-error">
                          {error}
                        </p>
                      )}
                      <button
                        className="btn btn-primary auth-submit"
                        type="submit"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <span className="auth-spinner" aria-hidden="true" />
                        ) : (
                          "Verify and continue"
                        )}
                      </button>
                    </form>
                    <button
                      className="auth-link-btn auth-back"
                      type="button"
                      onClick={goBack}
                    >
                      <ArrowLeft size={14} /> Back to sign in
                    </button>
                  </>
                ) : step.kind === "forgot" ? (
                  <>
                    <h2 className="auth-card-title">Reset your password</h2>
                    <p className="auth-card-sub">
                      Enter your email and we'll send you a one-time code.
                    </p>
                    <form className="auth-form" onSubmit={onForgot}>
                      <label className="auth-field">
                        <span className="auth-label">Email</span>
                        <input
                          className="input auth-input"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="you@studio.com"
                          autoFocus
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? "auth-error" : undefined}
                          onChange={onFieldEdit}
                        />
                      </label>
                      {error && (
                        <p className="auth-error" role="alert" id="auth-error">
                          {error}
                        </p>
                      )}
                      <button
                        className="btn btn-primary auth-submit"
                        type="submit"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <span className="auth-spinner" aria-hidden="true" />
                        ) : (
                          "Send code"
                        )}
                      </button>
                    </form>
                    <button
                      className="auth-link-btn auth-back"
                      type="button"
                      onClick={goBack}
                    >
                      <ArrowLeft size={14} /> Back to sign in
                    </button>
                  </>
                ) : step.kind === "reset" ? (
                  <>
                    <h2 className="auth-card-title">Choose a new password</h2>
                    <p className="auth-card-sub">
                      We sent a code to <strong>{step.email}</strong>. Enter it with
                      your new password.
                    </p>
                    <form className="auth-form" onSubmit={onReset}>
                      <label className="auth-field">
                        <span className="auth-label">Verification code</span>
                        <input
                          className="input auth-input auth-code"
                          name="code"
                          type="text"
                          required
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={8}
                          placeholder="00000000"
                          autoFocus
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? "auth-error" : undefined}
                          onChange={onFieldEdit}
                        />
                      </label>
                      <label className="auth-field">
                        <span className="auth-label">New password</span>
                        <div className="auth-password-wrap">
                          <input
                            className="input auth-input auth-password"
                            name="newPassword"
                            type={showNewPassword ? "text" : "password"}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            placeholder="8+ characters"
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? "auth-error" : undefined}
                            onChange={onFieldEdit}
                          />
                          <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={() => setShowNewPassword((v) => !v)}
                            aria-label={
                              showNewPassword ? "Hide password" : "Show password"
                            }
                            aria-pressed={showNewPassword}
                          >
                            <span key={showNewPassword ? "on" : "off"} className="auth-icon-pop">
                              {showNewPassword ? (
                                <EyeOff size={16} aria-hidden="true" />
                              ) : (
                                <Eye size={16} aria-hidden="true" />
                              )}
                            </span>
                          </button>
                        </div>
                      </label>
                      {error && (
                        <p className="auth-error" role="alert" id="auth-error">
                          {error}
                        </p>
                      )}
                      <button
                        className="btn btn-primary auth-submit"
                        type="submit"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <span className="auth-spinner" aria-hidden="true" />
                        ) : (
                          "Update password"
                        )}
                      </button>
                    </form>
                    <button
                      className="auth-link-btn auth-back"
                      type="button"
                      onClick={goBack}
                    >
                      <ArrowLeft size={14} /> Back to sign in
                    </button>
                  </>
                ) : (
                  <>
                    <span className="auth-done-spark" aria-hidden="true">
                      <Sparkles size={22} />
                    </span>
                    <h2 className="auth-card-title">Password updated</h2>
                    <p className="auth-card-sub">
                      Your password is set. Sign in with the new one.
                    </p>
                    <button
                      className="btn btn-primary auth-submit"
                      type="button"
                      onClick={goBack}
                    >
                      Back to sign in
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </aside>

          <div className="auth-note">
            <p className="auth-note-text">
              Free to start · No credit card · Your data stays yours
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}