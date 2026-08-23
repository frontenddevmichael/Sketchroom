/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as core_email from "../core/email.js";
import type * as core_errors from "../core/errors.js";
import type * as core_lib from "../core/lib.js";
import type * as core_rateLimiter from "../core/rateLimiter.js";
import type * as core_usage from "../core/usage.js";
import type * as core_users from "../core/users.js";
import type * as cronActions from "../cronActions.js";
import type * as crons from "../crons.js";
import type * as features_ai from "../features/ai.js";
import type * as features_aiDiagram from "../features/aiDiagram.js";
import type * as features_aiStore from "../features/aiStore.js";
import type * as features_canvas from "../features/canvas.js";
import type * as features_comments from "../features/comments.js";
import type * as features_invites from "../features/invites.js";
import type * as features_presence from "../features/presence.js";
import type * as features_rooms from "../features/rooms.js";
import type * as features_snapshots from "../features/snapshots.js";
import type * as http from "../http.js";
import type * as utils_model from "../utils/model.js";
import type * as utils_types from "../utils/types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "core/email": typeof core_email;
  "core/errors": typeof core_errors;
  "core/lib": typeof core_lib;
  "core/rateLimiter": typeof core_rateLimiter;
  "core/usage": typeof core_usage;
  "core/users": typeof core_users;
  cronActions: typeof cronActions;
  crons: typeof crons;
  "features/ai": typeof features_ai;
  "features/aiDiagram": typeof features_aiDiagram;
  "features/aiStore": typeof features_aiStore;
  "features/canvas": typeof features_canvas;
  "features/comments": typeof features_comments;
  "features/invites": typeof features_invites;
  "features/presence": typeof features_presence;
  "features/rooms": typeof features_rooms;
  "features/snapshots": typeof features_snapshots;
  http: typeof http;
  "utils/model": typeof utils_model;
  "utils/types": typeof utils_types;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
