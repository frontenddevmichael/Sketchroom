import { describe, it, expect } from 'vitest';
import { createTLSchema } from '@tldraw/tlschema';
import type { TLRecord } from 'tldraw';
import { TEMPLATES, buildTemplateSeed } from './templates';

/**
 * Every template seed must validate against tldraw's own schema. The schema's
 * RecordType validators run the same eager validation a store would perform on
 * put, so a malformed record throws here before it can ever reach a real room.
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

  it.each(TEMPLATES.map((t) => [t.id, t.name] as const))('validates %s', (_id) => {
    const seed = buildTemplateSeed(_id);
    const raw = JSON.parse(seed) as Record<string, TLRecord>;
    expect(Object.keys(raw).length).toBeGreaterThan(0);

    const schema = createTLSchema();
    for (const record of Object.values(raw)) {
      expect(() => schema.types[record.typeName].validate(record)).not.toThrow();
    }
  });
});
