import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://close-cow-73.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;