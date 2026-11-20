// Renders public/og.png from the same isometric geometry the hero uses.
//
// The scene is built here (rather than screenshotting the app) so the card is
// deterministic: no dev server, no fonts race, no animation state. Run with:
//   node dev/tools/make-og.mjs
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const U = 46;
const COS30 = Math.cos(Math.PI / 6);
const p = (x, y, z = 0) => [(x - y) * COS30 * U, ((x + y) * 0.5 - z) * U];
const poly = (pts) =>
  `M${pts
    .map(([x, y, z]) => {
      const [sx, sy] = p(x, y, z);
      return `${sx.toFixed(1)} ${sy.toFixed(1)}`;
    })
    .join('L')}Z`;

const box = (x, y, z, w, d, h) => ({
  top: poly([
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]),
  left: poly([
    [x, y + d, z + h],
    [x + w, y + d, z + h],
    [x + w, y + d, z],
    [x, y + d, z],
  ]),
  right: poly([
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x + w, y + d, z],
    [x + w, y, z],
  ]),
});

const faces = (f, dash = false) => `
  <path d="${f.top}" fill="${dash ? 'none' : '#FFFFFF'}" stroke="#0A0A0A" stroke-width="1.6" ${dash ? 'stroke-dasharray="6 5"' : ''}/>
  <path d="${f.left}" fill="${dash ? 'none' : '#F2F2F2'}" stroke="#0A0A0A" stroke-width="1.6" ${dash ? 'stroke-dasharray="6 5"' : ''}/>
  <path d="${f.right}" fill="${dash ? 'none' : '#E2E2E2'}" stroke="#0A0A0A" stroke-width="1.6" ${dash ? 'stroke-dasharray="6 5"' : ''}/>`;

const board = box(-3, -2, 0, 6, 4, 0.16);
const blocks = [
  [-2.4, -1.6, 0.55],
  [-1.2, -1.6, 0.78],
  [0, -1.6, 0.42],
  [-2.4, -0.4, 0.62],
  [-1.2, -0.4, 0.34],
];
const committed = box(0, -0.4, 0.16, 0.98, 0.98, 0.5);
const proposal = box(0, -0.4, 1.05, 0.98, 0.98, 0.5);
const mast = box(2.05, -1.85, 0, 0.28, 0.28, 2.5);
const arm = box(0.55, -1.85, 2.3, 1.5, 0.28, 0.2);

const [cx, cy] = p(0, 0, 0);
const scene = `
<svg viewBox="${cx - 250} ${cy - 210} 500 400" width="500" height="400" aria-hidden="true">
  ${faces(board)}
  ${blocks.map(([x, y, h]) => faces(box(x, y, 0.16, 0.98, 0.98, h))).join('')}
  ${faces(committed)}
  ${faces(mast)}
  ${faces(arm)}
  ${faces(proposal, true)}
  ${(() => {
    const [sx, sy] = p(1.35, 0.75, 0);
    return `<path d="M${sx} ${sy}l5 14l3.4 -5l6.2 2.2Z" fill="#0A0A0A"/>`;
  })()}
</svg>`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body {
    margin: 0; width: 1200px; height: 630px; background: #FAFAFA; color: #0A0A0A;
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    display: grid; grid-template-columns: 1.05fr 1fr; align-items: center;
    padding: 64px 56px; gap: 32px;
  }
  .frame { position: absolute; inset: 24px; border: 1px solid #E4E4E4; }
  .tag {
    display: inline-block; padding: 5px 9px; border: 1px dashed #CFCFCF; border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
    letter-spacing: .05em; color: #3F3F3F;
  }
  h1 { font-size: 58px; line-height: 1.03; letter-spacing: -.035em; font-weight: 500; margin: 20px 0 0; }
  p { font-size: 18px; line-height: 1.5; color: #3F3F3F; margin: 18px 0 0; max-width: 30ch; }
  .cta {
    margin-top: 26px; display: inline-block; background: #0A0A0A; color: #FFF;
    padding: 12px 20px; border-radius: 4px; font-size: 15px; font-weight: 500;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #8A8A8A; margin-top: 22px; letter-spacing: .04em; }
  .scene { display: flex; align-items: center; justify-content: center; }
</style></head>
<body>
  <div class="frame"></div>
  <div>
    <span class="tag">dashed = proposed · solid = committed</span>
    <h1>Draw the plan before you build the product.</h1>
    <p>A live canvas where the AI proposes in dashed lines, until you commit it in ink.</p>
    <div class="cta">Start sketching →</div>
    <div class="mono">SKETCHROOM</div>
  </div>
  <div class="scene">${scene}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/og.png');
await page.screenshot({ path: out, type: 'png' });
await browser.close();
await writeFile(path.resolve(path.dirname(out), '.og-built'), new Date().toISOString());
console.log(`wrote ${out}`);
