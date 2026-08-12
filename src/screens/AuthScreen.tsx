import { useState, type FormEvent } from "react";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LoadingScreen } from "../components/LoadingScreen";
import { usePageTitle } from "../lib/usePageTitle";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
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

  if (isLoading) return <LoadingScreen />;

  const emailEnabled = authConfig?.emailEnabled ?? false;
  const googleEnabled = authConfig?.googleEnabled ?? false;

  const run = async (provider: string, params: Record<string, string>) => {
    setSubmitting(true);
    setError(null);
    try {
      const { signingIn } = await signIn(provider, params);
      // If sign-in didn't complete immediately (email verification), the
      // provider has already sent the code — surface the next step.
      if (!signingIn) {
        const email = params.email ?? "";
        if (params.flow === "reset") setStep({ kind: "reset", email });
        else if (params.flow === "reset-verification")
          setStep({ kind: "resetDone" });
        else setStep({ kind: "verify", email });
      }
      // When signingIn is true, PublicRoute redirects to /dashboard.
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

  const tabActive = step.kind === "signup" ? "signup" : "signin";
  const passwordTitle =
    step.kind === "signup" ? "Create your account" : "Welcome back";

  return (
    <div className="auth-screen">


      <main className="auth-main">
        <div className="auth-wrap">
          <span className="auth-card-mark" aria-hidden="true">
            <LogoGlyph size={22} />
          </span>

          <aside className="auth-card" aria-label="Account">
             <a className="auth-home-link" href="/">
          <ArrowLeft size={14} color ={'green'}aria-hidden="true" />
          Back to home
        </a>
              <a className="auth-wordmark" href="/" aria-label="Sketchroom home">
          <LogoGlyph size={18} />
          Sketchroom
        </a>
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
                >
                  <button
                    className={`auth-tab ${tabActive === "signin" ? "active" : ""}`}
                    role="tab"
                    aria-selected={tabActive === "signin"}
                    onClick={() => switchMode("signin")}
                  >
                    Sign in
                  </button>
                  <button
                    className={`auth-tab ${tabActive === "signup" ? "active" : ""}`}
                    role="tab"
                    aria-selected={tabActive === "signup"}
                    onClick={() => switchMode("signup")}
                  >
                    Create account
                  </button>
                </div>

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
                    />
                  </label>
                  <label className="auth-field">
                    <span className="auth-label">Password</span>
                    <input
                      className="input auth-input"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete={
                        step.kind === "signup"
                          ? "new-password"
                          : "current-password"
                      }
                      placeholder="8+ characters"
                    />
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
                    <p className="auth-error" role="alert">
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
                      placeholder="00000000"
                      autoFocus
                    />
                  </label>
                  {error && (
                    <p className="auth-error" role="alert">
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
                    />
                  </label>
                  {error && (
                    <p className="auth-error" role="alert">
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
                      placeholder="00000000"
                    />
                  </label>
                  <label className="auth-field">
                    <span className="auth-label">New password</span>
                    <input
                      className="input auth-input"
                      name="newPassword"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="8+ characters"
                    />
                  </label>
                  {error && (
                    <p className="auth-error" role="alert">
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
                <h2 className="auth-card-title">Password updated</h2>
                <p className="auth-card-sub">
                  Your password is set. Sign in with the new one.
                </p>
                <button
                  className="btn btn-primary auth-submit"
                  type="button"
                  onClick={goBack}
                >
                  <Sparkles size={16} /> Back to sign in
                </button>
              </>
            )}
          </aside>

          <div className="auth-note">
            <div className="auth-avatars" aria-hidden="true">
              <span className="auth-avatar">MK</span>
              <span className="auth-avatar">AJ</span>
              <span className="auth-avatar">SR</span>
              <span className="auth-avatar auth-avatar-ai">✦</span>
            </div>
            <p className="auth-note-text">
              Free to start · No credit card · Your data stays yours
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
