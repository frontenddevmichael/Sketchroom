// Shared type definitions for the Convex backend.

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

export interface Worker {
  response: string,
  executable: string;
  error?: string;
}

export interface Thinking {
  route: "completion" | "worker";
  reasoning: string;
  error?: string;
}

export interface AiContextItem {
  label: string;
  kind?: string;
  description?: string;
  x?: number;
  y?: number;
  selected?: boolean;
}

export interface FreePlanCheck {
  roomLimit: number;
  aiLimit: number;
}
