// Lets the Convex framework verify the JWTs issued by Convex Auth.
// (This is the file the auth error "no providers configured" points at.)
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
