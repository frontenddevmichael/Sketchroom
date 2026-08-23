// Sentry configuration for error tracking and performance monitoring
import * as Sentry from "@sentry/react";
import { browserTracingIntegration, replayIntegration } from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || "development";

export function initSentry() {
  if (!SENTRY_DSN || SENTRY_DSN === "your-sentry-dsn") {
    console.log("[Sentry] DSN not configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: import.meta.env.VITE_APP_VERSION || "0.0.0",

    // Performance monitoring
    tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.convex\.cloud/],

    // Session replay (10% of sessions in production, 100% in dev)
    replaysSessionSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      browserTracingIntegration(),
      replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Error filtering
    beforeSend(event, hint) {
      // Don't send errors from development
      if (ENVIRONMENT === "development") {
        console.log("[Sentry] Error captured (dev):", event);
        return null;
      }

      // Filter out common non-actionable errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Ignore network errors that are likely user's connection issues
        if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("Load failed")
        ) {
          return null;
        }

        // Ignore ResizeObserver loop errors (browser bug)
        if (error.message.includes("ResizeObserver loop")) {
          return null;
        }
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      "Non-Error promise rejection captured",
      "ResizeObserver loop",
      "NetworkError",
      "Failed to fetch",
    ],

    // User context
    initialScope: {
      tags: {
        app: "sketchroom",
      },
    },
  });

  console.log("[Sentry] Initialized for", ENVIRONMENT);
}

// Helper to set user context after auth
export function setSentryUser(user: { id: string; name?: string; email?: string } | null) {
  if (!SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      username: user.name,
      email: user.email,
    });
  } else {
    Sentry.setUser(null);
  }
}

// Helper to add room context
export function setSentryRoomContext(roomId: string, roomName: string) {
  if (!SENTRY_DSN) return;

  Sentry.setTag("room_id", roomId);
  Sentry.setTag("room_name", roomName);
  Sentry.setContext("room", { id: roomId, name: roomName });
}

// Helper to clear room context
export function clearSentryRoomContext() {
  if (!SENTRY_DSN) return;

  Sentry.setTag("room_id", "");
  Sentry.setTag("room_name", "");
  Sentry.setContext("room", null);
}

// Manual error capture with context
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("error_context", context);
    }
    Sentry.captureException(error);
  });
}

// Manual message capture
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  if (!SENTRY_DSN) return;

  Sentry.captureMessage(message, level);
}