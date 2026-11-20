/**
 * Sample legacy records used by the converter tests and the dev harness.
 *
 * These are the exercises a real room hands the converter: geometry with a
 * label, dashed proposal work, a sticky note, a connector, a freehand stroke
 * and one image (which has no free-engine equivalent and must be counted, not
 * dropped silently).
 */

export const SAMPLE_LEGACY_RECORDS: Record<string, unknown> = {
  'shape:a1': {
    id: 'shape:a1',
    typeName: 'shape',
    type: 'geo',
    x: 120,
    y: 160,
    rotation: 0,
    index: 'a1',
    props: {
      geo: 'rectangle',
      w: 180,
      h: 90,
      color: 'black',
      fill: 'semi',
      dash: 'solid',
      size: 'm',
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Auth service' }],
          },
        ],
      },
    },
  },
  'shape:a2': {
    id: 'shape:a2',
    typeName: 'shape',
    type: 'geo',
    x: 420,
    y: 160,
    rotation: 0,
    index: 'a2',
    props: {
      geo: 'rectangle',
      w: 180,
      h: 90,
      color: 'black',
      fill: 'none',
      dash: 'dashed',
      size: 'm',
      richText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Proposed queue' }] }],
      },
    },
  },
  'shape:a3': {
    id: 'shape:a3',
    typeName: 'shape',
    type: 'arrow',
    x: 300,
    y: 205,
    rotation: 0,
    index: 'a3',
    props: {
      start: { x: 0, y: 0 },
      end: { x: 120, y: 0 },
      bend: 0,
      color: 'black',
      dash: 'solid',
      size: 'm',
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
    },
  },
  'shape:a4': {
    id: 'shape:a4',
    typeName: 'shape',
    type: 'note',
    x: 120,
    y: 320,
    rotation: 0,
    index: 'a4',
    props: {
      w: 200,
      h: 160,
      growY: 0,
      color: 'black',
      size: 'm',
      richText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Check the retry budget' }] }],
      },
    },
  },
  'shape:a5': {
    id: 'shape:a5',
    typeName: 'shape',
    type: 'draw',
    x: 420,
    y: 340,
    rotation: 0,
    index: 'a5',
    props: {
      color: 'black',
      dash: 'draw',
      size: 'm',
      segments: [
        {
          type: 'free',
          points: [
            { x: 0, y: 0, z: 0.5 },
            { x: 40, y: 24, z: 0.5 },
            { x: 90, y: 8, z: 0.5 },
          ],
        },
      ],
    },
  },
  'shape:a6': {
    id: 'shape:a6',
    typeName: 'shape',
    type: 'image',
    x: 700,
    y: 400,
    rotation: 0,
    index: 'a6',
    props: { w: 100, h: 100, assetId: 'asset:1' },
  },
  'page:page': {
    id: 'page:page',
    typeName: 'page',
    name: 'Page 1',
    index: 'a1',
  },
};
