---
name: sketchroom-blueprint
description: Visual language for Sketchroom (marketing site and product). Monochrome isometric line-art on hairline-gridded paper. Use for ANY UI, illustration, motion or copy work in this repo.
---

# Sketchroom Blueprint — design skill

Match `/design/refs/*.jpg`. Open them before every UI task. If your output would not sit next to them without looking like a different brand, it is wrong.

## The one idea (what makes this not generic)
**Line weight is state.** Sketchroom is where plans move from construction lines to ink.
- `dashed 1px` = proposed / ghost / AI suggestion / not yet real
- `solid 1.25px` = committed, real, on the canvas
- `solid + #0A0A0A fill` = decided / selected / primary action
- `concentric arcs ")))"` (ref 1) = presence and AI signal: someone or something is *live here*
Every illustration, empty state, loader, button and hover must obey this grammar. Repeat it until it is recognisable. Decoration that does not express state is deleted.

## Look (from refs)
- Paper `#FAFAFA` ground, ink `#0A0A0A`, greys only. No gradients, no glass blur, no glow, no emoji, no stickers, no colored shadows.
- **Hairline frame**: content sits in a centered column bounded by 1px vertical lines (ref 1) and the page has dashed vertical guides at the gutters (ref 2). Sections are separated by full-bleed 1px horizontal rules. Layout is cells, not floating cards.
- Primary button: black fill, white text, 0 radius reduced to 4px max, label + `→`. Secondary: text only. (ref 2)
- Icon tiles: 44–52px square, `#EDEDED`, radius 12, monoline icon 1.5px, label to the right. (ref 2 bottom row)
- Annotation tag: dotted 1px border box, `Geist Mono` 11px, e.g. `3 cursors live`. Used as hero eyebrow and as callouts inside illustrations with a dashed leader line ending in a filled dot (ref 2).
- Headline: Geist 500, tight tracking (-0.035em), 72/0.98 desktop, sentence case, max 2 lines, ink. Sub-copy in `--ink-3`, 18px.
- Black footer strip with logo row is allowed once per page (ref 3).
- Dot-grid texture (ref 3) only as 1 background layer behind the canvas and hero, 8% ink.

## Illustration rules
Full spec in `ILLUSTRATION-SYSTEM.md`. Non-negotiable: isometric 30°, one stroke width (non-scaling), grey fills only (`#FFFFFF`, `#F2F2F2`, `#E2E2E2`, `#CFCFCF`), black fills only for 1–3 focal accents per scene, every scene has one dashed "ghost" element and one signal-arc element.

## Motion rules
- Draw-in: `DrawSVGPlugin` on strokes, 0.9s, `power3.out`, staggered 0.04s. Dashed elements animate by `strokeDashoffset`, never by DrawSVG.
- **Commit moment** (signature): a dashed ghost solidifies (dash → solid, fill `#fff → #F2F2F2`, 1 frame of 2px offset settle). Reused in hero, AI accept, version restore.
- Scroll: Lenis + ScrollTrigger `scrub: 0.6` for illustration assembly only. Text uses a single fade+8px rise, once.
- Product UI: 160ms ease-out for hovers, 280ms `cubic-bezier(0.22,1,0.36,1)` for panels. No spring overshoot except the commit settle.
- Respect `prefers-reduced-motion`: render final state, no scrub.

## Product translation
- App chrome = same paper/ink/hairline. Panels are 1px-bordered white sheets (`--surface`) on `--paper`, 12px radius max, no blur.
- AI ghost blocks use dashed strokes + `)))` arcs; Accept = commit moment.
- Presence cursor: strictly monochrome. Collaborators are told apart by initials in the name tag, a distinct arrow style (solid, outlined, hatched, dotted) and a grey step from `--fill-4` to `--ink`. No hue anywhere, including tldraw collaborator colors, comment pins, shape colors and AI ghost blocks (override tldraw's palette to a grey ramp).
- Empty states are small isometric line scenes (see illustration doc). Loaders are the sketch-in draw. Skeletons are hairline wireframes with a dashed shimmer, never grey blobs.
- Dark mode = negative blueprint: `#0A0A0A` ground, lines at 14% white, fills `#141414/#1C1C1C`, text `#F5F5F5`. Same grammar.

## Copy voice
Plain, technical, a little dry. Verbs of drafting: sketch, propose, commit, revise, restore. No "supercharge", "magic", "seamless", exclamation marks, or emoji. Numbers must be real or removed (never invent "2M builds").

## Anti-patterns (delete on sight)
Emoji, rotated sticker pills, gradient text, glassmorphism, any hue at all (green, blue, red) except `--danger` for destructive errors, hero ring backgrounds, stock "isometric" 3D renders, unDraw/blob people, centered-stack hero with 3 feature cards, shadows deeper than `0 1px 2px rgb(0 0 0 / .06)`.

## Rebuild, never patch
No old class, token, wrapper or override survives next to new work. If touching a component, rebuild it from `src/ui` primitives and delete the old one in the same commit.

## Definition of done for any screen
1. Screenshot at 375/768/1280/1920, light+dark, placed beside the refs; fidelity ≥ "same family".
2. Zero hardcoded colors/px outside `tokens.css`; zero legacy token usage.
3. Every stroke uses `vector-effect: non-scaling-stroke`.
4. axe: 0 serious/critical; focus rings visible (2px ink + 2px paper offset); tap targets ≥ 44px.
5. Reduced-motion verified. LCP < 2.5s on landing (mobile throttled).
