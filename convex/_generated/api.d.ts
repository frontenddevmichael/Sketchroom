/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiDiagram from "../aiDiagram.js";
import type * as aiStore from "../aiStore.js";
import type * as canvas from "../canvas.js";
import type * as errors from "../errors.js";
import type * as invites from "../invites.js";
import type * as lib from "../lib.js";
import type * as presence from "../presence.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as rooms from "../rooms.js";
import type * as snapshots from "../snapshots.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiDiagram: typeof aiDiagram;
  aiStore: typeof aiStore;
  canvas: typeof canvas;
  errors: typeof errors;
  invites: typeof invites;
  lib: typeof lib;
  presence: typeof presence;
  rateLimiter: typeof rateLimiter;
  rooms: typeof rooms;
  snapshots: typeof snapshots;
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
