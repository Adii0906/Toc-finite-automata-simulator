import assert from "node:assert/strict";
import { test } from "node:test";
import { nfaMove, simulateNFA, validateNFA } from "./nfa-engine";
import { draftFromNFA, parseDraft } from "./nfa-draft";
import { CONTAINS_01, NFA_PRESETS, STARTS_WITH_10 } from "./nfa-presets";

const allStrings = (max: number) => {
  const out = [""];
  for (let i = 0; out[i] !== undefined && out[i].length < max; i += 1) out.push(out[i] + "0", out[i] + "1");
  return out;
};

test("presets are valid", () => {
  for (const { nfa } of NFA_PRESETS) assert.deepEqual(validateNFA(nfa), []);
});

test("the example NFA accepts exactly the strings containing 01", () => {
  for (const input of allStrings(11)) assert.equal(simulateNFA(CONTAINS_01, input).accepted, input.includes("01"), input);
});

test("the move is the union over all active states", () => {
  assert.deepEqual(nfaMove(CONTAINS_01, ["q0", "q1"], "1"), ["q0", "q2"]);
  assert.deepEqual(nfaMove(CONTAINS_01, ["q1"], "0"), []);
});

test("the trace records branching and stranded branches", () => {
  const { steps } = simulateNFA(CONTAINS_01, "00");
  assert.deepEqual(steps[0].moves.map((m) => m.to), ["q0", "q1"]);
  assert.deepEqual(steps[1].active, ["q0", "q1"]);
  assert.deepEqual(steps[1].stranded, ["q1"]);
  assert.deepEqual(steps[1].nextActive, ["q0", "q1"]);
});

test("empty input depends only on the initial state", () => {
  assert.equal(simulateNFA(CONTAINS_01, "").accepted, false);
  assert.equal(simulateNFA({ ...CONTAINS_01, accepting: ["q0"] }, "").accepted, true);
});

test("an NFA with no active states left rejects", () => {
  const trace = simulateNFA(STARTS_WITH_10, "0");
  assert.deepEqual(trace.finalActive, []);
  assert.equal(trace.accepted, false);
});

test("invalid input throws", () => {
  assert.throws(() => simulateNFA(CONTAINS_01, "012"));
});

test("a draft round-trips to the same NFA", () => {
  const parsed = parseDraft(draftFromNFA(CONTAINS_01));
  assert.deepEqual(parsed.nfa, CONTAINS_01);
});

test("drafts reject ε, duplicates and missing fields", () => {
  const base = draftFromNFA(CONTAINS_01);
  assert.match(parseDraft({ ...base, alphabetText: "0, ε" }).errors.join(), /ordinary NFA/);
  assert.match(parseDraft({ ...base, statesText: "q0, q0" }).errors.join(), /once/);
  assert.match(parseDraft({ ...base, statesText: "" }).errors.join(), /at least one state/);
  assert.match(parseDraft({ ...base, initial: "nope" }).errors.join(), /initial/);
  assert.match(parseDraft({ ...base, alphabetText: "ab" }).errors.join(), /single character/);
});

test("transitions to removed states are dropped", () => {
  const parsed = parseDraft({ ...draftFromNFA(CONTAINS_01), statesText: "q0, q2", accepting: ["q2"] });
  assert.deepEqual(parsed.nfa?.transitions.q0["0"], ["q0"]);
});
