// Resend-backed OTP email providers for Convex Auth.
//
// Both providers are only wired into `convex/auth.ts` when `AUTH_RESEND_KEY`
// is set — without it, sign-up skips email verification and the "forgot
// password" flow is hidden (the auth screen learns this from the
// `users.authConfig` query). Production must set `AUTH_RESEND_KEY`.
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { generateRandomString } from "@oslojs/crypto/random";
import type { RandomReader } from "@oslojs/crypto/random";

const random: RandomReader = {
  read(bytes) {
    // `crypto.getRandomValues` wants a concrete ArrayBuffer-backed view; the
    // interface hands us a generic Uint8Array, so widen it explicitly.
    crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
  },
};

const ALPHABET = "0123456789";
const CODE_LENGTH = 8;

const FROM = process.env.AUTH_EMAIL_FROM ?? "Sketchroom <onboarding@resend.dev>";

type EmailKind = "verify" | "reset";

function subjectFor(kind: EmailKind): string {
  return kind === "verify" ? "Your Sketchroom verification code" : "Reset your Sketchroom password";
}

function htmlFor(kind: EmailKind, code: string): string {
  const headline =
    kind === "verify"
      ? "Confirm it's you"
      : "You asked to reset your password";
  const body =
    kind === "verify"
      ? "Use the code below to finish signing in to Sketchroom."
      : "Enter the code below to choose a new password. It expires in 10 minutes.";
  const brand = "#20201E";
  const accent = "#2F6B3F";
  return `
  <div style="background:#F7F7F5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:420px;margin:0 auto;background:#FFFFFF;border:1px solid #ECECE8;border-radius:16px;padding:32px;">
      <div style="font-size:15px;font-weight:700;color:${brand};margin-bottom:16px;">✏️ Sketchroom</div>
      <h1 style="font-size:19px;line-height:1.3;color:${brand};margin:0 0 8px;">${headline}</h1>
      <p style="font-size:14px;line-height:1.5;color:#5C5C57;margin:0 0 24px;">${body}</p>
      <div style="text-align:center;padding:20px 0 24px;">
        <span style="display:inline-block;font-size:28px;font-weight:700;letter-spacing:8px;color:${brand};font-variant-numeric:tabular-nums;">${code}</span>
      </div>
      <p style="font-size:12px;line-height:1.5;color:#8A8A84;margin:0;">If you didn't request this, you can safely ignore this email — your account stays protected.</p>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #ECECE8;font-size:12px;color:${accent};">Sketchroom — think together, in the open.</div>
    </div>
  </div>`;
}

async function sendCodeEmail(kind: EmailKind, email: string, code: string) {
  const resend = new ResendAPI(process.env.AUTH_RESEND_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: subjectFor(kind),
    html: htmlFor(kind, code),
  });
  if (error) throw new Error(`Could not send ${kind} email: ${error.message}`);
}

function otpConfig(kind: EmailKind) {
  return {
    apiKey: process.env.AUTH_RESEND_KEY,
    async generateVerificationToken() {
      return generateRandomString(random, ALPHABET, CODE_LENGTH);
    },
    async sendVerificationRequest({ identifier: email, token }: { identifier: string; token: string }) {
      await sendCodeEmail(kind, email, token);
    },
  };
}

/** Email verification (sign-up / sign-in). */
export const ResendOTP = Resend({
  id: "resend-otp",
  ...otpConfig("verify"),
});

/** Password reset (code delivery). */
export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-reset",
  ...otpConfig("reset"),
});
