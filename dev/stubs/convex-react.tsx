/* eslint-disable */
// Harness-only stub for `convex/react`. Aliased by dev/vite.config.ts so the
// real components render without a Convex backend.
//
// `useQuery` returns a per-function result when the harness registered one
// (two-argument `__setQueryResult(fn, value)`), otherwise the global default
// set by the one-argument form. The room-chrome harness keeps driving every
// query from one value; the full-app harness (`?view=app`) seeds each query
// individually so real screens render realistic data.
//
// `useQuery` subscribes via useSyncExternalStore, so any later
// `__setQueryResult` (from a mutation handler or a test) re-renders the
// mounted components — mirroring Convex's live-query behavior.
//
// `useMutation` records every call (fn + args) for smoke-test assertions and
// routes through a per-function handler registered with
// `__setMutationHandler(fn, handler)`. Without a handler it resolves
// undefined, matching a no-op server.

import { useSyncExternalStore, type JSX } from 'react';

const __defaultQuery: { value: unknown } = { value: undefined };
const __keyedQueries: Map<unknown, unknown> = new Map();
const __mutationHandlers: Map<unknown, (...args: unknown[]) => unknown> = new Map();
const __mutationCalls: { fn: unknown; args: unknown[] }[] = [];

// Version counter + listener set: the snapshot for useSyncExternalStore is
// just a number that bumps on every store change, so React knows to re-read.
let __version = 0;
const __listeners = new Set<() => void>();

function __notify() {
  __version++;
  for (const l of __listeners) l();
}

function __subscribe(listener: () => void) {
  __listeners.add(listener);
  return () => __listeners.delete(listener);
}

function __getSnapshot(): number {
  return __version;
}

export function __setQueryResult(fn: unknown, value?: unknown) {
  if (arguments.length >= 2) {
    if (value === undefined) __keyedQueries.delete(fn);
    else __keyedQueries.set(fn, value);
  } else {
    __defaultQuery.value = fn;
  }
  __notify();
}

export function __getQueryResult(fn: unknown): unknown {
  return __keyedQueries.has(fn) ? __keyedQueries.get(fn) : __defaultQuery.value;
}

export function __setMutationHandler(fn: unknown, handler: (...args: unknown[]) => unknown) {
  __mutationHandlers.set(fn, handler);
}

export function __getMutationCalls(fn: unknown): unknown[][] {
  return __mutationCalls.filter((c) => c.fn === fn).map((c) => c.args);
}

export function __clearCalls() {
  __mutationCalls.length = 0;
}

export function useQuery(fn: unknown, _args?: unknown) {
  useSyncExternalStore(__subscribe, __getSnapshot);
  return __getQueryResult(fn);
}

// convex/react returns a STABLE function per mutation — components rely on
// that identity (effects keyed on the mutation must not re-run on every
// render, or their cleanup cancels in-flight work like the room's debounced
// save). Mirror it here by memoizing per function reference.
const __mutationFns = new Map<unknown, (...args: unknown[]) => Promise<unknown>>();

export function useMutation(fn: unknown) {
  let m = __mutationFns.get(fn);
  if (!m) {
    m = async (...args: unknown[]) => {
      __mutationCalls.push({ fn, args });
      const handler = __mutationHandlers.get(fn);
      return handler ? handler(...args) : undefined;
    };
    __mutationFns.set(fn, m);
  }
  return m;
}

const __actionFns = new Map<unknown, (...args: unknown[]) => Promise<unknown>>();

export function useAction(fn: unknown) {
  let a = __actionFns.get(fn);
  if (!a) {
    a = async (...args: unknown[]) => {
      __mutationCalls.push({ fn, args });
      const handler = __mutationHandlers.get(fn);
      return handler ? handler(...args) : undefined;
    };
    __actionFns.set(fn, a);
  }
  return a;
}

export function useConvexAuth() {
  return { isAuthenticated: true, isLoading: false };
}

export function useConvex() {
  return {};
}

export const ConvexReactClient = class {};

export function ConvexProviderWithClerk({ children }: { children?: unknown }) {
  return children as JSX.Element;
}
