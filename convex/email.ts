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
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const random: RandomReader = {
  read(bytes) {
    // `crypto.getRandomValues` wants a concrete ArrayBuffer-backed view; the
    // interface hands us a generic Uint8Array, so widen it explicitly.
    crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
  },
};

const ALPHABET = "0123456789";
const CODE_LENGTH = 8;
// The code TTL Convex Auth actually enforces (the Resend provider defaults to
// 24h). The emails say "expires in 10 minutes" — this keeps the copy honest
// and the window tight. Seconds, per Auth.js provider.maxAge.
const CODE_TTL_SECONDS = 10 * 60;

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

// The @auth/core Resend provider hardcodes a 24h maxAge and ignores config,
// so the enforced code TTL must be overridden on the returned provider object
// to match the "expires in 10 minutes" copy in the emails.
function withCodeTtl<T extends object>(provider: T): T {
  return { ...provider, maxAge: CODE_TTL_SECONDS };
}

/** Email verification (sign-up / sign-in). */
export const ResendOTP = withCodeTtl(Resend({
  id: "resend-otp",
  ...otpConfig("verify"),
}));

/** Password reset (code delivery). */
export const ResendOTPPasswordReset = withCodeTtl(Resend({
  id: "resend-otp-reset",
  ...otpConfig("reset"),
}));

// ── Room-invite emails ────────────────────────────────────────────────────

// User-controlled text is sanitized for HTML email by stripping tag
// delimiters only — names and room names can never inject markup, and the
// plain-text part carries the raw values untouched.
function emailSafe(value: string): string {
  return value.replace(/[<>]/g, "").slice(0, 80);
}

/**
 * Send one room-invite email. Scheduler-invoked (fire-and-forget) from the
 * invite mutations so a slow mail API never blocks the invite mutation;
 * internal so a client can never trigger arbitrary sends. Without
 * AUTH_RESEND_KEY it no-ops — the invite link still works and stays listed
 * in the Share modal, so nothing is a dead end.
 */
export const sendInviteEmail = internalAction({
  args: {
    inviteId: v.id("invites"),
    email: v.string(),
    roomName: v.string(),
    token: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    inviterName: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    if (!process.env.AUTH_RESEND_KEY) return { sent: false, reason: "no-key" };

    const site = (process.env.SITE_URL ?? "https://sketchroom.app").replace(/\/+$/, "");
    const inviteUrl = `${site}/invite/${args.token}`;
    const roleLabel = args.role === "editor" ? "an editor" : "a viewer";
    const inviterName = args.inviterName?.trim() || "Someone";
    const roomName = args.roomName.trim() || "a room";

    const brand = "#20201E";
    const eyebrow = "#2F6B3F";
    const htmlName = emailSafe(inviterName);
    const htmlRoom = emailSafe(roomName);

    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [args.email],
      subject: `${inviterName} invited you to \u201c${roomName}\u201d on Sketchroom`,
      text: [
        `${inviterName} invited you to \u201c${roomName}\u201d as ${roleLabel} on Sketchroom.`,
        "",
        `Open the room: ${inviteUrl}`,
        "",
        "The invite link expires in 7 days. If you didn't expect this invitation, you can safely ignore it.",
      ].join("\n"),
      html: `
  <div style="background:#F7F7F5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#FFFFFF;border:1px solid #ECECE8;border-radius:16px;padding:32px;">
      <div style="font-size:15px;font-weight:700;color:${brand};margin-bottom:16px;">\u270f\ufe0f Sketchroom</div>
      <h1 style="font-size:19px;line-height:1.3;color:${brand};margin:0 0 8px;">You're in — the room is open</h1>
      <p style="font-size:14px;line-height:1.6;color:#5C5C57;margin:0 0 24px;">
        <strong>${htmlName}</strong> invited you to
        <strong>\u201c${htmlRoom}\u201d</strong> as ${roleLabel} on Sketchroom.
        Sketch the plan together, live.
      </p>
      <div style="text-align:center;padding:4px 0 24px;">
        <a href="${inviteUrl}" style="display:inline-block;background:#25D366;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;">Open the room</a>
      </div>
      <p style="font-size:12px;line-height:1.5;color:#8A8A84;margin:0;">The invite link expires in 7 days. If you didn't expect this invitation, you can safely ignore it.</p>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #ECECE8;font-size:12px;color:${eyebrow};">Sketchroom — think together, in the open.</div>
    </div>
  </div>`,
    });
    if (error) throw new Error(`Could not send invite email: ${error.message}`);
    return { sent: true };
  },
});
