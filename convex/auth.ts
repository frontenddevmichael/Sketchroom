// Convex Auth configuration — the app's native authentication layer.
//
// Email + password (Scrypt-hashed by default) is always available. Email
// verification and password reset activate when `AUTH_RESEND_KEY` is set, and
// Google OAuth activates when `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` are set.
// The client learns which features are live via the `users.authConfig` query
// and shows/hides the corresponding controls.


import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { AuthProviderConfig } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { ConvexError } from "convex/values";
import { ResendOTP, ResendOTPPasswordReset } from "./core/email";



const passwordConfig: Parameters<typeof Password>[0] = {
  // Normalize the sign-up email and surface a friendly error early. `name` is
  // optional (falls back to the email local-part when omitted).
  profile(params) {
    const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError("Enter a valid email address.");
    }
    const rawName = typeof params.name === "string" ? params.name.trim() : "";
    const name = rawName || email.split("@")[0] || "Sketch artist";
    return { email, name: name.slice(0, 60) };
  },
  validatePasswordRequirements(password: string) {
    if (password.length < 8) {
      throw new ConvexError("Password must be at least 8 characters.");
    }
  },
};

if (process.env.AUTH_RESEND_KEY) {
  passwordConfig.verify = ResendOTP;
  passwordConfig.reset = ResendOTPPasswordReset;
}

const providers: AuthProviderConfig[] = [Password(passwordConfig)];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      profile(googleProfile) {
        return {
          email: googleProfile.email as string,
          name: (googleProfile.name as string) ?? (googleProfile.email as string).split("@")[0],
          image: (googleProfile.picture as string) ?? null,
        };
      },
    })
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  callbacks: {
    async redirect({ redirectTo }) {
      const allowed = ["/verify-otp", "/dashboard"];
      const path = new URL(redirectTo, "http://localhost").pathname;
      if (allowed.some((prefix) => path.startsWith(prefix))) {
        return redirectTo;
      }
      throw new Error(`Invalid redirect: ${redirectTo}`);
    },
  },
  session: {
    // A 30-day rolling session, matching the previous provider's default.
    totalDurationMs: 30 * 24 * 60 * 60 * 1000,
    inactiveDurationMs: 30 * 24 * 60 * 60 * 1000,
  },
});
