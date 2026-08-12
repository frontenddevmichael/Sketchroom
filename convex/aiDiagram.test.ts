import { expect, test } from "vitest";
import { buildDiagram, buildPrompt, fallbackBlocks, sanitizeEdges } from "./aiDiagram";

test("buildDiagram keeps valid blocks and edges", () => {
  const diagram = buildDiagram(
    {
      summary: "flow",
      blocks: [
        { label: "Client", kind: "client" },
        { label: "API", kind: "api", description: "edge" },
      ],
      edges: [{ from: 0, to: 1, label: "https" }],
    },
    "draft a flow"
  );
  expect(diagram.blocks).toEqual([
    { label: "Client", kind: "client", description: undefined },
    { label: "API", kind: "api", description: "edge" },
  ]);
  expect(diagram.edges).toEqual([{ from: 0, to: 1, label: "https" }]);
});

test("buildDiagram falls back to heuristic blocks with a chain when blocks are missing", () => {
  const diagram = buildDiagram({ error: "AI failed" }, "add an auth step to this flow");
  expect(diagram.blocks.length).toBeGreaterThan(0);
  expect(diagram.blocks.some((b) => /auth/i.test(b.label))).toBe(true);
  expect(diagram.edges).toEqual(defaultChain(diagram.blocks.length));
});

test("buildDiagram derives a chain when the model returns no edges", () => {
  const diagram = buildDiagram(
    { blocks: [{ label: "A", kind: "service" }, { label: "B", kind: "service" }, { label: "C", kind: "service" }] },
    "x"
  );
  expect(diagram.edges).toEqual(defaultChain(3));
});

test("buildDiagram drops invalid blocks and clamps unknown kinds to service", () => {
  const diagram = buildDiagram(
    {
      blocks: [
        { label: "  Ok  ", kind: "not-a-kind" },
        { label: "", kind: "service" },
        { label: "Good", kind: "database" },
      ] as never,
    },
    "x"
  );
  expect(diagram.blocks).toEqual([
    { label: "Ok", kind: "service", description: undefined },
    { label: "Good", kind: "database", description: undefined },
  ]);
});

test("buildDiagram caps blocks at eight", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ label: `B${i}`, kind: "service" }));
  const diagram = buildDiagram({ blocks: many as never }, "x");
  expect(diagram.blocks.length).toBe(8);
});

test("sanitizeEdges drops out-of-range, self-loop, duplicate, and malformed edges", () => {
  const edges = sanitizeEdges(
    [
      { from: 0, to: 1 },
      { from: 1, to: 1 },
      { from: 5, to: 0 },
      { from: 0, to: 1 },
      { from: "a", to: 1 },
      { from: 1, to: 0 },
    ],
    3
  );
  expect(edges).toEqual([
    { from: 0, to: 1 },
    { from: 1, to: 0 },
  ]);
});

test("sanitizeEdges returns an empty list when there are fewer than two blocks", () => {
  expect(sanitizeEdges([{ from: 0, to: 1 }], 1)).toEqual([]);
});

test("buildPrompt attaches selected shapes as context", () => {
  const prompt = buildPrompt("Add an auth step to this flow", [
    { label: "Client App", kind: "geo" },
    { label: "Checkout", kind: "geo" },
  ]);
  expect(prompt).toContain("Client App");
  expect(prompt).toContain("selected on the user's canvas");
  expect(prompt).toContain("relate to these existing shapes");
});

test("buildPrompt returns the prompt unchanged without context", () => {
  expect(buildPrompt("plain prompt")).toBe("plain prompt");
  expect(buildPrompt("plain prompt", [])).toBe("plain prompt");
});

test("fallbackBlocks never exceeds eight entries", () => {
  const blocks = fallbackBlocks("api auth database queue worker event api auth database");
  expect(blocks.length).toBeLessThanOrEqual(8);
});

function defaultChain(count: number) {
  const edges = [];
  for (let i = 1; i < count; i++) edges.push({ from: i - 1, to: i });
  return edges;
}
