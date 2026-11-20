/**
 * A room's canvas is one JSON document. The framing is versioned so a stored
 * blob is self-describing: `{ format, elements }`. Anything older (tldraw's
 * record map) is recognised and converted on read by `parseScene`.
 */
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { convertLegacyScene, isLegacyScene } from './convert';

export const SCENE_FORMAT = 'excalidraw/1' as const;

export interface SceneDocument {
  format: typeof SCENE_FORMAT;
  elements: ExcalidrawElement[];
  /** Legacy shapes that had no equivalent, by source type. */
  skipped: Record<string, number>;
}

export function emptyScene(): SceneDocument {
  return { format: SCENE_FORMAT, elements: [], skipped: {} };
}

/** The exact string persisted in `rooms.canvasData` and version snapshots. */
export function serializeScene(elements: readonly ExcalidrawElement[]): string {
  const doc: SceneDocument = {
    format: SCENE_FORMAT,
    elements: elements.filter((element) => !element.isDeleted),
    skipped: {},
  };
  return JSON.stringify(doc);
}

function isElement(value: unknown): value is ExcalidrawElement {
  if (!value || typeof value !== 'object') return false;
  const element = value as { id?: unknown; type?: unknown; isDeleted?: unknown };
  return typeof element.id === 'string' && typeof element.type === 'string' && !element.isDeleted;
}

/**
 * Parse whatever is stored for a room. Three shapes are accepted:
 *  - the current format,
 *  - an Excalidraw file blob (`{ elements: [...] }`),
 *  - a legacy tldraw record map, converted once.
 * Malformed JSON yields an empty scene rather than a crashed room.
 */
export function parseScene(raw: string | null | undefined): SceneDocument {
  if (!raw) return emptyScene();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyScene();
  }

  if (Array.isArray(parsed)) {
    const elements = parsed.filter(isElement);
    return { format: SCENE_FORMAT, elements, skipped: {} };
  }

  if (parsed && typeof parsed === 'object') {
    const candidate = parsed as { elements?: unknown; skipped?: unknown };
    if (Array.isArray(candidate.elements)) {
      return {
        format: SCENE_FORMAT,
        elements: candidate.elements.filter(isElement),
        skipped: {},
      };
    }
    if (isLegacyScene(parsed)) {
      const { elements, skipped } = convertLegacyScene(parsed);
      return { format: SCENE_FORMAT, elements, skipped };
    }
  }

  return emptyScene();
}
