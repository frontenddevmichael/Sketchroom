import { describe, it, expect } from 'vitest';
import { TEMPLATES, buildTemplateSeed } from './templates';
import { SCENE_FORMAT, parseScene } from '../canvas/scene';

/**
 * Every template seed must survive the exact read path a room uses. Parsing the
 * seed with `parseScene` and checking the element shape means a malformed
 * template fails here before it can ever reach a real room.
 */
describe('template seeds', () => {
  it('provides curated templates', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(['architecture', 'wireframe', 'planning']).toContain(t.category);
    }
  });

  it.each(TEMPLATES.map((t) => [t.id, t.name] as const))('validates %s', (id) => {
    const seed = buildTemplateSeed(id);
    expect(seed).not.toBe('');

    const raw = JSON.parse(seed) as { format: string; elements: unknown[] };
    expect(raw.format).toBe(SCENE_FORMAT);
    expect(Array.isArray(raw.elements)).toBe(true);
    expect(raw.elements.length).toBeGreaterThan(0);

    // The reader accepts the seed unchanged: nothing is dropped or converted,
    // which is the guarantee that a template opens as the author drew it.
    const scene = parseScene(seed);
    expect(scene.elements.length).toBe(raw.elements.length);

    const ids = new Set<string>();
    for (const element of scene.elements) {
      expect(typeof element.id).toBe('string');
      expect(element.id.length).toBeGreaterThan(0);
      expect(ids.has(element.id)).toBe(false);
      ids.add(element.id);

      expect(element.isDeleted).toBe(false);
      expect(typeof element.type).toBe('string');
      for (const value of [element.x, element.y, element.width, element.height]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      // Monochrome: every stroke is a hex value or explicitly transparent.
      expect(element.strokeColor).toMatch(/^(#[0-9a-fA-F]{3,8}|transparent)$/);
    }
  });
});
