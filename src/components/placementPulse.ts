// A tiny pub/sub so any insert site (block library, AI copilot) can announce
// "something landed here" without prop-drilling a callback through two
// component trees. The rendered layer lives in PlacementPulses.tsx.
export interface PlacementPulseEvent {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** neutral = library insert; ai = the copilot placed it (green moment). */
  tone: 'neutral' | 'ai';
}

type Listener = (e: PlacementPulseEvent) => void;

const listeners = new Set<Listener>();
let seq = 0;

export function emitPlacementPulse(
  rect: { x: number; y: number; w: number; h: number },
  tone: 'neutral' | 'ai' = 'neutral'
) {
  const e: PlacementPulseEvent = { id: ++seq, ...rect, tone };
  for (const l of listeners) l(e);
}

export function onPlacementPulse(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
