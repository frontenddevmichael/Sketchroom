// HTTP router. Convex Auth's `auth` object registers the routes the framework
// needs for token verification (OIDC discovery, JWKS) and OAuth callbacks.
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
