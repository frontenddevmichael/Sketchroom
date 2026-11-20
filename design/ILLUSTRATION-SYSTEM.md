# Illustration system — isometric line kit

Goal: scenes like refs 1–3, consistent across 20+ assets, themeable, animatable. **Primary method is code, not AI images.** AI vector output is only for one-off hero art and must pass the cleanup pipeline.

## 1. Build `src/illustration/iso.ts` (the kit)
Projection (true isometric, 30°): `sx = (x - y) * cos30 * U`, `sy = ((x + y) * sin30 - z) * U`, `U` = unit px (24).
Primitives returning SVG path data + face ids (`top`, `left`, `right`): `slab(w,d,h)`, `cube`, `screen(w,h)` (browser-window plane with 3 dots + title bar, ref 1), `book`, `cursor`, `arm` (placement arm, ref 2), `conveyor`, `pipe(path[])` (orthogonal dashed router with filled end dots), `arcs(n)` (concentric signal, ref 1), `tag(text)` (dotted box, mono).
Faces fill: top `--fill-1`, left `--fill-2`, right `--fill-3`; edges `--ink` at `--stroke`; ghost = same geometry, `fill:none`, `stroke-dasharray: var(--dash)`.
Each scene is a React component `<SceneName state="draft|committed" />` composed from primitives with stable `id`/`data-layer` attributes (`ghost`, `solid`, `signal`, `accent`) so GSAP can target layers.

## 2. Scene inventory (all required)
| Scene | Used for | Composition |
|---|---|---|
| HeroDraftingTable | landing hero | slab canvas, 6 cubes as architecture blocks, dashed pipes between, placement arm lowering a ghost cube, two cursors with arcs, tag `3 cursors live` |
| LiveCanvas | feature 1 | two screens (wireframe + architecture), cursors with arcs converging |
| GlassBoxCopilot | feature 2 | open book (ref 1) emitting arcs onto ghost blocks, Accept/Reject chips |
| TimeStack | feature 3 | stacked slabs V1.0 V2.0 V3.0 with timeline nodes (ref 1 top) |
| ShareRoom, ExportSheet, BlockLibrary | secondary | small 240px scenes |
| EmptyRooms, EmptyHistory, EmptyAi, EmptyInvites, Solo, LimitReached, Offline, NotFound, Error | product empty/error states | 160–240px, one ghost element each |
| SketchIn | loader | hero cube drawn by DrawSVG, loops |

## 3. Colour & stroke rules
Greys only (`--fill-*`). Black fill for 1–3 accents (cursor arrow, one dot, one chip). `vector-effect: non-scaling-stroke` on every path. Stroke caps/joins `round`. Never use opacity for hierarchy, use the fill ramp.

## 4. Optional AI assets (Recraft V4 Vector, ~$0.08/image base, Pro Vector ~$0.33)
Create ONE custom style in Recraft from the three refs, then reuse it. Prompt skeleton:
`isometric line illustration, 30 degree projection, monochrome black hairline outlines on white, light grey face shading in three tones, no gradients, no colour, thin uniform stroke, dashed outline for one proposed object, concentric arc signal marks, tiny solid black accents, clean empty background, subject: <X>`
Reject any output with colour, gradients, perspective, or varying stroke weight.
Cleanup script `scripts/clean-svg.mjs`: SVGO (remove metadata, merge paths), snap stroke to token, map fills to nearest `--fill-*` via CSS vars, add `vector-effect`, split into `data-layer` groups, assert size < 40 kB and no `<image>`/`<text>` (convert text to paths or HTML overlay).

## 5. Choreography (GSAP, all plugins free)
- Hero load: `DrawSVG` solid edges 0→100% staggered back-to-front, fills fade, ghost cube drops on the arm (`MotionPathPlugin` along the pipe), commit moment fires at 1.6s, arcs pulse every 3s.
- Features: ScrollTrigger `scrub:0.6` assembles each scene (pieces translate along iso axes from -24px with opacity 0 → 1).
- Hover on a scene piece: tag leader line draws in, 160ms.
- Provide `useSceneTimeline(ref, { trigger })` hook with `gsap.context` cleanup and `matchMedia` for reduced motion.
