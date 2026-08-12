// Pure, side-effect-free helpers shared by the AI copilot action (convex/ai.ts)
// and its unit tests. Deliberately free of Convex imports so tests run anywhere.

export interface AiBlock {
  label: string;
  kind: string;
  description?: string;
}

export interface AiEdge {
  from: number;
  to: number;
  label?: string;
}

export interface AiDiagram {
  blocks: AiBlock[];
  edges: AiEdge[];
}

export interface AiResult {
  summary?: string;
  blocks?: AiBlock[];
  edges?: AiEdge[];
  error?: string;
}

export interface AiContextItem {
  label: string;
  kind?: string;
  description?: string;
}

export const ALLOWED_KINDS = new Set([
  "service",
  "database",
  "api",
  "client",
  "queue",
  "cache",
  "input",
  "button",
  "card",
  "table",
  "navbar",
  "image",
]);

const MAX_BLOCKS = 8;
const MAX_EDGES = 40;
const MAX_LABEL = 40;

export function fallbackBlocks(prompt: string): AiBlock[] {
  const guess = prompt.toLowerCase();
  const blocks: AiBlock[] = [];
  if (/api|graphql|rest|endpoint/.test(guess)) blocks.push({ label: "API Gateway", kind: "api" });
  blocks.push({ label: "Client App", kind: "client" });
  blocks.push({ label: "Core Service", kind: "service" });
  if (/auth|login|signup|session/.test(guess)) blocks.push({ label: "Auth Service", kind: "service" });
  if (/database|db|postgres|mongo|sql|store/.test(guess)) blocks.push({ label: "Database", kind: "database" });
  if (/queue|worker|job|message|event/.test(guess)) blocks.push({ label: "Queue", kind: "queue" });
  blocks.push({ label: "Cache", kind: "cache" });
  return blocks.slice(0, MAX_BLOCKS);
}

function sanitizeBlock(raw: unknown): AiBlock | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) return null;
  const kind = typeof b.kind === "string" && ALLOWED_KINDS.has(b.kind) ? b.kind : "service";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  return {
    label: label.slice(0, MAX_LABEL),
    kind,
    description: description ? description.slice(0, 200) : undefined,
  };
}

export function sanitizeBlocks(raw: unknown): AiBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: AiBlock[] = [];
  for (const entry of raw) {
    const block = sanitizeBlock(entry);
    if (block) out.push(block);
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

export function sanitizeEdges(raw: unknown, count: number): AiEdge[] {
  if (!Array.isArray(raw) || count < 2) return [];
  const seen = new Set<string>();
  const out: AiEdge[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const from = (entry as { from?: unknown }).from;
    const to = (entry as { to?: unknown }).to;
    if (typeof from !== "number" || typeof to !== "number") continue;
    const f = Math.floor(from);
    const t = Math.floor(to);
    if (!Number.isFinite(f) || !Number.isFinite(t)) continue;
    if (f < 0 || f >= count || t < 0 || t >= count || f === t) continue;
    const key = `${f}>${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = (entry as { label?: unknown }).label;
    const trimmed = typeof label === "string" ? label.trim() : "";
    out.push({
      from: f,
      to: t,
      label: trimmed ? trimmed.slice(0, MAX_LABEL) : undefined,
    });
    if (out.length >= MAX_EDGES) break;
  }
  return out;
}

export function defaultEdges(count: number): AiEdge[] {
  const out: AiEdge[] = [];
  for (let i = 1; i < count; i++) out.push({ from: i - 1, to: i });
  return out;
}

// Normalizes a raw AI result into a valid diagram. Falls back to heuristic
// blocks and a linear edge chain whenever the model returns garbage.
export function buildDiagram(result: AiResult, prompt: string): AiDiagram {
  const blocks = sanitizeBlocks(result.blocks);
  const finalBlocks = blocks.length > 0 ? blocks : fallbackBlocks(prompt);
  const edges =
    result.edges !== undefined && Array.isArray(result.edges)
      ? sanitizeEdges(result.edges, finalBlocks.length)
      : defaultEdges(finalBlocks.length);
  return { blocks: finalBlocks, edges };
}

// Builds the user-facing prompt, attaching selected shapes as canvas context.
export function buildPrompt(prompt: string, context?: AiContextItem[]): string {
  if (!context || context.length === 0) return prompt;
  const lines = context.slice(0, 30).map((item, i) => {
    const label = item.label || item.kind || "shape";
    const kind = item.kind ? ` (${item.kind})` : "";
    return `- [${i + 1}] ${label}${kind}`;
  });
  return [
    prompt,
    "",
    "The following shapes are currently selected on the user's canvas:",
    ...lines,
    "Build your sketch to extend or relate to these existing shapes where sensible.",
  ].join("\n");
}
