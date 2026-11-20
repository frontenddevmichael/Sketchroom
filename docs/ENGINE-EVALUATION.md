# Canvas engine evaluation

**Question.** tldraw SDK 4.0+ (September 2025) changed licence: the SDK now runs
in production only with a licence key. The free hobby licence is discretionary,
non-commercial, and keeps the "made with tldraw" watermark. A commercial
licence is quoted by sales, publicly referenced at ~$6,000/yr for teams under
ten. Sketchroom is a paid product, so running tldraw as-is is either a $6k/yr
line item or a permanent watermark. This document evaluates replacing the
engine with a licence-free one.

## What the engine actually has to do

Sketchroom is not a generic whiteboard wrapper; the room screen owns a lot of
behaviour that sits on top of tldraw's editor and store:

| Responsibility | Where it lives today |
| --- | --- |
| Infinite canvas, shapes, text, arrows, freehand, groups, frames | tldraw |
| Object model + record store + undo/redo history | tldraw (`createTLStore`, `Editor`) |
| Persistent state (`{[id]: TLRecord}`, versioned batches, snapshots) | `convex/features/canvas.ts`, `convex/schema.ts` |
| Live sync (record patches put/remove, last-write-wins) | `RoomScreen` store listener → `applyCanvasChanges` |
| Presence cursors on canvas coordinates | `PresenceCursors`, `ViewportAwareness` |
| Comment pins anchored to shapes | `CommentPins` |
| AI ghost blocks + accept/reject | `GhostBlocks`, `useAiCopilot` |
| Block library / template insertion | `BlockLibrary`, `templates.ts`, `blocks.ts` |
| Selection-aware teamwork UI | `SelectionAwareness`, `FocusDim` |
| Tool options, export (PNG/PDF), version history previews | `ToolOptions`, `ExportDialog`, `VersionHistory` |

Roughly **4,500 lines** of canvas-coupled modules plus the room screen
(1,981 TSX / 1,967 CSS). Any engine swap is a room rebuild, not a dependency
bump.

## Candidates

### 1. Excalidraw (`@excalidraw/excalidraw`) — MIT

The only candidate that is a complete, product-grade infinite-canvas editor
under a permissive licence. MIT, no licence key, no watermark, embeddable in
React, and self-hostable forever. It ships shapes, text, arrows, freehand,
frames, images, groups, selection, undo/redo, PNG/SVG export and a
collaboration surface (`onChange`, `updateScene`, `getSceneElements`) that a
custom adapter can drive.

*Strengths:* everything above the object model already exists; MIT removes the
licence problem permanently; its hand-drawn default is closer to the
"blueprint" language than tldraw's clean geometry.

*Costs:* the embedded editor's chrome is opinionated and only partly
styleable — getting hairline, monochrome chrome means hiding most of it and
driving `excalidrawAPI` from our own rail (which we already do with tldraw).
The package is large (~1 MB gzip-ish with fonts/locales) and its React peer
range needs checking against React 19. Our record-patch sync, comment pins,
ghost blocks and AI insert flow are written against tldraw's store and must be
rebuilt against Excalidraw's element array + `updateScene`. Stored rooms are
tldraw snapshots and need a converter (`geo → rectangle/ellipse/diamond`,
`text → text`, `note → rectangle + ink`, `draw → freedraw`, `arrow → arrow`,
`frame → frame`, `image → image`; unknown shapes flattened to an image or
dropped with a warning).

### 2. Konva / react-konva — MIT

A 2D scene graph, not an editor. MIT and genuinely free forever, with the best
rendering control of any option (we could make edges, dashes and line weights
exactly the design system's "line weight is state"). But selection, transform
handles, text editing, arrow routing, snapping, undo/redo, export and
accessibility all become our code. This is a 6–10 week build for one
engineer, and it competes with the product work Prompt 3 through 4 already
schedules. The landing page's `DemoCanvas` shows we can render a canvas in
house — but it is a scripted, non-editable scene, not an editor.

### 3. Fabric.js 6 — MIT

Same class as Konva: object model and hit-testing, no editor UX, weaker React
integration and a heavier imperative surface. No advantage over Konva here.

### 4. tldraw trial / hobby licence

The 100-day trial key removes the watermark but expires; the hobby licence is
non-commercial and keeps the watermark. Neither is viable for a paid product,
and the trial is a deferral, not a decision.

## Decision matrix

Scores 1–5 (5 best). Weighted by what Sketchroom needs.

| Criterion (weight) | Excalidraw | Konva | Fabric | tldraw trial |
| --- | --- | --- | --- | --- |
| Licence freedom (5) | 5 | 5 | 5 | 2 |
| Editor features out of the box (5) | 5 | 1 | 1 | 5 |
| Visual control / design fit (3) | 3 | 5 | 4 | 3 |
| Migration effort from today's code (4) | 3 | 1 | 1 | 5 |
| Collaboration fit with our Convex sync (3) | 3 | 2 | 2 | 5 |
| Long-term maintenance (2) | 4 | 2 | 3 | 2 |
| **Weighted total** | **77** | **56** | **55** | **76** |

Excalidraw and "keep tldraw on a trial" score almost identically on features,
but they are not the same decision: the trial ends and the product is still
unlicensed. **Excalidraw is the recommendation** — it is the only option that
keeps a real editor while making the licence problem go away permanently.

## If we proceed: migration shape

1. **Pin down the engine surface.** A thin `src/canvas/` adapter: mount, load
   scene, subscribe to changes, apply remote patches, read selection, insert
   element, export. Nothing outside `src/canvas/` imports the engine package.
   This is also what makes a second swap cheap if Excalidraw disappoints.
2. **Format.** New `canvasFormat: "excalidraw/1"` alongside the existing
   tldraw records; read old rooms through a one-way converter at load, write
   only the new format. Convex keeps storing a JSON blob, so the sync
   mutations and version batching survive with a changed payload.
3. **Room rebuild.** Rail, tool options, presence, comments, ghost blocks, AI
   insert, block library and export against the adapter — the Prompt 3 room
   work, done once, on the free engine.
4. **Verify.** Existing room loads, two-user edit/reconnect, presence,
   comments, AI accept/reject, PNG/PDF export, and the before/after screen set.

Estimated effort: **3–5 focused sessions** — one for the adapter + converter,
one to two for the room rebuild, one for the feature modules, one for
verification. It is a rebuild of the room feature, not a swap of a prop.

## Implementation status (step 1 of 4)

Done:

- `@excalidraw/excalidraw@0.18.1` installed (MIT; its peer range includes
  React 19).
- `src/canvas/` is in place: `scene.ts` (versioned `{ format: "excalidraw/1",
  elements }` document, with legacy detection), `convert.ts` (tldraw records →
  Excalidraw elements, local builders so the data path carries no editor
  runtime), `ink.ts` (legacy colour names → ink ramp, fills, stroke styles),
  `CanvasSurface.tsx` (the engine mount), `assets.ts` (self-hosted font/locale
  base).
- Excalidraw's fonts and locales are served from `public/excalidraw/` (2.2 MB,
  the 13 MB Xiaolai CJK face is excluded) because the production CSP is
  `font-src 'self'` and the package otherwise fetches fonts from `esm.sh`.
- `/dev/canvas` (dev builds only) mounts the engine on the converted sample,
  inserts a block, fits the view and persists the new scene format locally.
  Verified in the browser: 8 elements, image reported as skipped, Liberation
  Sans fetched from `/excalidraw/`, no console errors. 7 converter/scene tests
  pass.

Still to do (steps 2–4): the room itself is untouched and still renders tldraw,
so the watermark remains until the room is rebuilt on `CanvasSurface`. The
component set that takes an `Editor` (presence, comments, ghost blocks, block
library, tool options, AI copilot, export, version history, templates) moves to
Excalidraw's element API in that pass.

## Recommendation

Adopt **Excalidraw (MIT)** behind a `src/canvas/` adapter. Do not buy a tldraw
licence, and do not build a canvas from scratch on Konva: the first is a
recurring cost for a licence we can avoid, the second spends the entire
Prompt 3 budget on infrastructure instead of product.

Open decisions before implementation starts:

- Whether old tldraw rooms must be converted losslessly or best-effort (frames,
  custom shapes and rich text do not map 1:1).
- Whether the comment-pin and presence anchor model moves to Excalidraw element
  ids (recommended, since it is the only stable anchor).
