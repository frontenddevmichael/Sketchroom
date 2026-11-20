import { describe, expect, it } from 'vitest';
import { convertLegacyScene, plainText } from './convert';
import { SAMPLE_LEGACY_RECORDS } from './sample';
import { SCENE_FORMAT, parseScene, serializeScene } from './scene';
import { INK, OBJECT_PALETTE, fillFor, inkFor, objectPaint } from './ink';

/** A wash must be lighter than the stroke it came from, not a grey. */
function fillForWeightsDrawFromStroke(fill: string): boolean {
  return fill !== INK.fill1 && fill !== INK.fill2 && fill !== 'transparent';
}

const textOf = (elements: ReturnType<typeof convertLegacyScene>['elements']) =>
  elements
    .filter((element) => element.type === 'text')
    .map((element) => (element as unknown as { text: string }).text)
    .join(' | ');

describe('legacy scene conversion', () => {
  it('converts the shapes a real room holds', () => {
    const { elements, skipped } = convertLegacyScene(SAMPLE_LEGACY_RECORDS);
    expect(elements.length).toBeGreaterThan(0);
    // One image has no Excalidraw equivalent and is reported, not dropped.
    expect(skipped).toEqual({ image: 1 });
    expect(elements.some((element) => element.type === 'rectangle')).toBe(true);
    expect(elements.some((element) => element.type === 'arrow')).toBe(true);
    expect(elements.some((element) => element.type === 'line')).toBe(true);
  });

  it('keeps labels and the dashed proposal grammar', () => {
    const { elements } = convertLegacyScene(SAMPLE_LEGACY_RECORDS);
    const texts = textOf(elements);
    expect(texts).toContain('Auth service');
    expect(texts).toContain('Proposed queue');
    expect(texts).toContain('Check the retry budget');
    const dashed = elements.filter(
      (element) => (element as unknown as { strokeStyle: string }).strokeStyle === 'dashed',
    );
    expect(dashed.length).toBe(1);
  });

  it('keeps an object’s colour and forces text to ink', () => {
    expect(objectPaint('black')).toBe('#0A0A0A');
    expect(objectPaint('green')).toBe(OBJECT_PALETTE.green);
    expect(objectPaint('green')).not.toBe(objectPaint('blue'));
    expect(objectPaint('unknown-name')).toBe('#0A0A0A');
    expect(objectPaint('#123456')).toBe('#123456');
    // Text is the one thing on the board that never carries a hue.
    expect(inkFor('green')).toBe(INK.ink);
    expect(inkFor('red')).toBe(INK.ink);
  });

  it('washes a fill from the object’s own colour', () => {
    expect(fillFor('none')).toBe('transparent');
    expect(fillFor('semi', OBJECT_PALETTE.blue)).not.toBe(fillFor('semi', OBJECT_PALETTE.red));
    expect(fillForWeightsDrawFromStroke(fillFor('semi', OBJECT_PALETTE.blue))).toBe(true);
  });

  it('reads tldraw rich text without leaking its document markup', () => {
    expect(
      plainText({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
        ],
      }),
    ).toBe('First\nSecond');
    expect(plainText('already plain')).toBe('already plain');
    expect(plainText(undefined)).toBe('');
  });
});

describe('scene document', () => {
  it('round-trips through the persisted format', () => {
    const { elements } = convertLegacyScene(SAMPLE_LEGACY_RECORDS);
    const parsed = parseScene(serializeScene(elements));
    expect(parsed.format).toBe(SCENE_FORMAT);
    expect(parsed.elements).toHaveLength(elements.length);
    expect(parsed.elements.map((element) => element.id)).toEqual(
      elements.map((element) => element.id),
    );
  });

  it('converts a stored legacy blob on read', () => {
    const parsed = parseScene(JSON.stringify(SAMPLE_LEGACY_RECORDS));
    expect(parsed.format).toBe(SCENE_FORMAT);
    expect(parsed.elements.length).toBeGreaterThan(0);
    expect(parsed.skipped).toEqual({ image: 1 });
  });

  it('never throws on malformed or empty state', () => {
    expect(parseScene('not json').elements).toEqual([]);
    expect(parseScene(null).elements).toEqual([]);
    expect(parseScene(JSON.stringify({ nothing: true })).elements).toEqual([]);
  });
});
