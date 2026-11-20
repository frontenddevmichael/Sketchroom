import { describe, expect, it } from 'vitest';
import {
  FREE_ROOM_LIMIT as CLIENT_ROOMS,
  FREE_COLLABORATORS_PER_ROOM as CLIENT_COLLABORATORS,
  FREE_AI_LIMIT as CLIENT_AI,
} from './plans';
import {
  FREE_ROOM_LIMIT as SERVER_ROOMS,
  FREE_COLLABORATORS_PER_ROOM as SERVER_COLLABORATORS,
  FREE_AI_SUGGESTIONS_PER_MONTH as SERVER_AI,
} from '../../convex/core/lib';

// The client mirrors the free-plan caps for meters and copy, while the server
// enforces them. A divergence would show one number and enforce another, so it
// fails here instead of in production.
describe('free-plan limits', () => {
  it('mirror the server constants exactly', () => {
    expect(CLIENT_ROOMS).toBe(SERVER_ROOMS);
    expect(CLIENT_COLLABORATORS).toBe(SERVER_COLLABORATORS);
    expect(CLIENT_AI).toBe(SERVER_AI);
  });
});
