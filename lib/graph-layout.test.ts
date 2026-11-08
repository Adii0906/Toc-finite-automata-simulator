import assert from "node:assert/strict";
import { test } from "node:test";
import { autoLayout, buildGraph, diagramFromDFA, diagramFromNFA } from "./graph-layout";
import { CONTAINS_01, NFA_PRESETS, THIRD_FROM_LAST_IS_1 } from "./nfa-presets";
import { ENDS_IN_01 } from "./dfa-presets";
import { subsetConstruction } from "./subset-construction";

test("each edge between the same pair merges its symbols", () => {
  const model = diagramFromNFA(CONTAINS_01);
  const loop = model.edges.find((e) => e.from === "q2" && e.to === "q2");
  assert.deepEqual(loop?.symbols, ["0", "1"]);
  assert.equal(model.edges.length, 4);
});

test("every edge of every machine gets a path, arrow and label inside the view", () => {
  const models = [diagramFromDFA(ENDS_IN_01), ...NFA_PRESETS.flatMap(({ nfa }) => [diagramFromNFA(nfa), diagramFromDFA(subsetConstruction(nfa).dfa)])];
  for (const model of models) {
    const graph = buildGraph(model, autoLayout(model));
    const [x, y, w, h] = graph.viewBox.split(" ").map(Number);
    assert.equal(graph.edges.length, model.edges.length);
    for (const edge of graph.edges) {
      assert.ok(!edge.d.includes("NaN"), edge.id);
      assert.ok(edge.labelAt.x >= x && edge.labelAt.x <= x + w && edge.labelAt.y >= y && edge.labelAt.y <= y + h, `${edge.id} label`);
    }
  }
});

test("self-loops are circular arcs and opposite edges curve apart", () => {
  const graph = buildGraph(diagramFromDFA(subsetConstruction(CONTAINS_01).dfa));
  const loop = graph.edges.find((e) => e.isLoop);
  assert.match(loop!.d, / A 34 34 0 1 1 /);
  const forward = graph.edges.find((e) => e.id === "{q0,q2}->{q0,q1,q2}")!;
  const backward = graph.edges.find((e) => e.id === "{q0,q1,q2}->{q0,q2}")!;
  assert.notDeepEqual(forward.labelAt, backward.labelAt);
});

test("states never overlap in the layout", () => {
  const model = diagramFromDFA(subsetConstruction(THIRD_FROM_LAST_IS_1).dfa);
  const graph = buildGraph(model);
  for (const a of graph.nodes) {
    for (const b of graph.nodes) {
      if (a !== b) assert.ok(Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) > 2 * graph.radius + 20);
    }
  }
});
