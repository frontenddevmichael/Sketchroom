import { type AiResult, type Worker, type Thinking, type AiBlock, type AiEdge } from "./types"
import OpenAi from "openai"

const MAX_LABEL = 18;
const MAX_DESC = 80;
const MAX_BLOCKS = 8;
const MAX_EDGES = 40;

function compactBlocks(blocks: AiBlock[]): AiBlock[] {
  const seen = new Set<string>();
  const out: AiBlock[] = [];
  for (const b of blocks) {
    const label = (b.label ?? "").trim().slice(0, MAX_LABEL);
    if (!label) continue;
    const kind = (b.kind ?? "service").trim();
    const key = `${label}|${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const description = b.description
      ? b.description.trim().slice(0, MAX_DESC)
      : undefined;
    out.push({ label, kind, description });
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

function compactEdges(edges: AiEdge[], blockCount: number): AiEdge[] {
  const seen = new Set<string>();
  const out: AiEdge[] = [];
  for (const e of edges) {
    const from = Math.floor(e.from);
    const to = Math.floor(e.to);
    if (
      !Number.isFinite(from) || !Number.isFinite(to) ||
      from < 0 || to < 0 || from >= blockCount || to >= blockCount ||
      from === to
    ) continue;
    const key = `${from}>${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = e.label ? e.label.trim().slice(0, 30) : undefined;
    out.push({ from, to, label });
    if (out.length >= MAX_EDGES) break;
  }
  return out;
}

export function compactResult(result: AiResult): AiResult {
  if (result.error) return result;
  const blocks = compactBlocks(result.blocks ?? []);
  const edges = compactEdges(result.edges ?? [], blocks.length);
  return {
    summary: result.summary?.trim().slice(0, 200),
    blocks,
    edges,
  };
}

export class Model {
  private client: OpenAi
  private model: string

  constructor() {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) throw new Error("AI_API_KEY env var must be set");
    this.client = new OpenAi({
      baseURL: process.env.AI_BASE_URL,
      apiKey,
    })
    this.model = process.env.AI_MODEL ?? "gemini-2.5-flash"
  }

  private SystemPrompt: string = [
    "You are Sketchroom, a collaborative architecture-planning copilot.",
    "Users sketch system diagrams and wireframes on a shared whiteboard.",
    "Voice: be a sharp teammate, not a corporate assistant. Confident, warm, plain-spoken.",
    "Say what the sketch is for and why it works. Occasionally be genuinely clever, but never",
    "twee, never gimmicky, never salesy. No exclamation marks, no emojis, no hype words.",
    "Return STRICT JSON (no markdown, no fences) with this exact shape:",
    '{ "summary": "one short sentence: what this is and the one thing that makes it sound",',
    '  "blocks": [ { "label": "Short Label", "kind": "service", "description": "one line of plain-spoken purpose" } ],',
    '  "edges": [ { "from": 0, "to": 1, "label": "optional short edge label" } ] }',
    "kind must be one of: service, database, api, client, queue, cache, input, button, card, table, navbar, image.",
    "edges reference blocks by zero-based index and only exist where there is a real dependency or flow between them.",
    "Omit edges entirely when relationships do not apply (e.g. a single wireframe page).",
    "Return 3 to 8 blocks. Labels under 18 characters.",
    "Descriptions are one line that says the block's real job, e.g. \"holds the source of truth\" or \"the only door into the system\".",
  ].join("\n");


  private ThinkPrompt: string = [
    "You are Sketchroom's routing layer. Given a user prompt, decide whether it should produce a structured diagram or a freeform response.",
    "Return STRICT JSON (no markdown, no fences) with this exact shape:",
    '{ "route": "completion" | "worker", "reasoning": "one short sentence explaining the choice" }',
    'Use "completion" when the user wants to: draw, sketch, diagram, plan, map, wireframe, layout, flowchart, architect, or create visual structure.',
    'Use "worker" when the user wants to: explain, answer, brainstorm, write, refine text, discuss, or get information without drawing.',
  ].join("\n");

  private WorkerPrompt: string = [
    "You are Sketchroom, a collaborative architecture-planning copilot.",
    "Users sketch system diagrams and wireframes on a shared whiteboard.",
    "Voice: be a sharp teammate, not a corporate assistant. Confident, warm, plain-spoken.",
    "Say what the sketch is for and why it works. Occasionally be genuinely clever, but never",
    "twee, never gimmicky, never salesy. No exclamation marks, no emojis, no hype words.",
    "Return STRICT JSON (no markdown, no fences) with this exact shape:",
    '{ "summary": "one short sentence: what this is and the one thing that makes it sound",',
    '  "data": [ { "label": "Short Label", "kind": "service", "description": "one line of plain-spoken purpose" } ] }',
    "kind must be one of: service, database, api, client, queue, cache, input, button, card, table, navbar, image.",
    "Return 3 to 8 items. Labels under 18 characters.",
    "Descriptions are one line that says the item's real job, e.g. \"holds the source of truth\" or \"the only door into the system\".",
  ].join("\n");

  /** Route a prompt to the right handler. Currently unused — the action
   *  calls `completion()` directly. Kept for future use if freeform responses
   *  are wired in. */
  public async think(prompt: string): Promise<Thinking> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: this.ThinkPrompt },
          { role: "user", content: prompt },
        ]
      });
      const content = res.choices?.[0]?.message?.content;
      if (!content) return { route: "completion", reasoning: "No response from AI.", error: "Empty response." };
      try {
        return JSON.parse(content) as Thinking;
      } catch {
        return { route: "completion", reasoning: "Could not parse routing decision.", error: `Malformed JSON: ${content}` };
      }
    } catch (e) {
      return { route: "completion", reasoning: "AI call failed.", error: `${e}` };
    }
  }

  /** Freeform text response. Currently unused — see `think()`. */
  public async worker(prompt: string): Promise<Worker> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: this.WorkerPrompt },
          { role: "user", content: prompt },
        ]
      });
      const content = res.choices?.[0]?.message?.content ?? "";
      return { response: content, executable: content };
    } catch (e) {
      return { response: "", executable: "", error: `${e}` };
    }
  }

  public async completion(prompt: string): Promise<AiResult> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: this.SystemPrompt },
          { role: "user", content: prompt },
        ]
      });
      const content = res.choices?.[0]?.message?.content;
      if (!content) return { error: "AI returned an empty response." };
      try {
        const raw = JSON.parse(content) as AiResult;
        return compactResult(raw);
      } catch {
        return { error: `AI returned malformed JSON: ${content}` };
      }
    } catch (e) {
      return { error: `${e}` };
    }
  }
}