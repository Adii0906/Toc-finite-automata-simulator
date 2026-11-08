import assert from "node:assert/strict";
import { test } from "node:test";
import { simulate, validateDFA, validateInput } from "./dfa-engine";
import { ENDS_IN_01, EXAMPLE_INPUTS } from "./dfa-presets";

test("the preset is a total, valid DFA", () => {
  assert.deepEqual(validateDFA(ENDS_IN_01), []);
});

test("every transition matches the assignment table", () => {
  const table = [
    ["q0", "0", "q1"],
    ["q0", "1", "q0"],
    ["q1", "0", "q1"],
    ["q1", "1", "q2"],
    ["q2", "0", "q1"],
    ["q2", "1", "q0"],
  ];
  for (const [from, symbol, to] of table) {
    assert.equal(ENDS_IN_01.transitions[from][symbol], to);
  }
});

test("1101 follows q0, q0, q0, q1, q2 and accepts", () => {
  const result = simulate(ENDS_IN_01, "1101");
  assert.deepEqual(
    result.steps.map((s) => [s.currentState, s.symbol, s.nextState]),
    [
      ["q0", "1", "q0"],
      ["q0", "1", "q0"],
      ["q0", "0", "q1"],
      ["q1", "1", "q2"],
    ],
  );
  assert.equal(result.finalState, "q2");
  assert.equal(result.accepted, true);
});

test("listed examples get the listed result", () => {
  for (const input of EXAMPLE_INPUTS.accepted) assert.equal(simulate(ENDS_IN_01, input).accepted, true, input);
  for (const input of EXAMPLE_INPUTS.rejected) assert.equal(simulate(ENDS_IN_01, input).accepted, false, input);
});

test("empty input is rejected in q0 with no steps", () => {
  const result = simulate(ENDS_IN_01, "");
  assert.equal(result.steps.length, 0);
  assert.equal(result.finalState, "q0");
  assert.equal(result.accepted, false);
});

test("acceptance agrees with endsWith('01') for every string up to length 12", () => {
  for (let length = 0; length <= 12; length += 1) {
    for (let n = 0; n < 2 ** length; n += 1) {
      const input = length === 0 ? "" : n.toString(2).padStart(length, "0");
      assert.equal(simulate(ENDS_IN_01, input).accepted, input.endsWith("01"), input);
    }
  }
});

test("invalid symbols are reported with their position", () => {
  const result = validateInput(ENDS_IN_01, "01a1");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.index, 2);
    assert.equal(result.symbol, "a");
  }
  assert.throws(() => simulate(ENDS_IN_01, "2"));
});
