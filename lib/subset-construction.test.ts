import assert from "node:assert/strict";
import { test } from "node:test";
import { conversionStateAt, dfaConversionView } from "./conversion-view";
import { simulate, validateDFA } from "./dfa-engine";
import { compareMachines } from "./equivalence";
import { simulateNFA } from "./nfa-engine";
import type { NFA } from "./nfa-types";
import { CONTAINS_01, NFA_PRESETS, STARTS_WITH_10, THIRD_FROM_LAST_IS_1 } from "./nfa-presets";
import { EMPTY_SET_ID, subsetConstruction } from "./subset-construction";

test("the contains-01 NFA produces the four expected subsets", () => {
  const { dfa, deadState } = subsetConstruction(CONTAINS_01);
  assert.deepEqual(dfa.states, ["{q0}", "{q0,q1}", "{q0,q2}", "{q0,q1,q2}"]);
  assert.deepEqual(dfa.transitions["{q0}"], { "0": "{q0,q1}", "1": "{q0}" });
  assert.deepEqual(dfa.transitions["{q0,q1}"], { "0": "{q0,q1}", "1": "{q0,q2}" });
  assert.deepEqual(dfa.transitions["{q0,q2}"], { "0": "{q0,q1,q2}", "1": "{q0,q2}" });
  assert.deepEqual(dfa.transitions["{q0,q1,q2}"], { "0": "{q0,q1,q2}", "1": "{q0,q2}" });
  assert.equal(dfa.initial, "{q0}");
  assert.deepEqual(dfa.accepting, ["{q0,q2}", "{q0,q1,q2}"]);
  assert.equal(deadState, null);
});

test("every preset yields a total DFA", () => {
  for (const { nfa } of NFA_PRESETS) assert.deepEqual(validateDFA(subsetConstruction(nfa).dfa), []);
});

test("the generated DFA accepts exactly the strings containing 01", () => {
  const { dfa } = subsetConstruction(CONTAINS_01);
  for (let n = 0; n < 2 ** 12; n += 1) {
    for (const input of [n.toString(2), n.toString(2).padStart(12, "0")]) {
      assert.equal(simulate(dfa, input).accepted, input.includes("01"), input);
    }
  }
  assert.equal(simulate(dfa, "").accepted, false);
});

test("the DFA's state always equals the NFA's active set", () => {
  const { dfa, subsets } = subsetConstruction(CONTAINS_01);
  for (const input of ["", "0", "01", "0010", "1101", "100101"]) {
    const nfaRun = simulateNFA(CONTAINS_01, input);
    const dfaRun = simulate(dfa, input);
    dfaRun.steps.forEach((step, index) => {
      assert.deepEqual(subsets[step.nextState], nfaRun.steps[index].nextActive);
    });
  }
});

test("missing moves create a dead state that loops to itself and rejects", () => {
  const { dfa, deadState, subsets } = subsetConstruction(STARTS_WITH_10);
  assert.equal(deadState, EMPTY_SET_ID);
  assert.deepEqual(subsets[EMPTY_SET_ID], []);
  assert.deepEqual(dfa.transitions[EMPTY_SET_ID], { "0": EMPTY_SET_ID, "1": EMPTY_SET_ID });
  assert.equal(dfa.accepting.includes(EMPTY_SET_ID), false);
  assert.equal(simulate(dfa, "011").accepted, false);
  assert.equal(simulate(dfa, "1011").accepted, true);
});

test("no dead state exists when the empty set is unreachable", () => {
  assert.equal(subsetConstruction(CONTAINS_01).deadState, null);
});

test("duplicate subsets are created only once", () => {
  const { dfa, events } = subsetConstruction(CONTAINS_01);
  assert.equal(new Set(dfa.states).size, dfa.states.length);
  const links = events.filter((e) => e.kind === "link");
  assert.equal(links.length, dfa.states.length * dfa.alphabet.length);
  assert.equal(links.filter((e) => e.kind === "link" && e.isNew).length, dfa.states.length - 1);
});

test("the order NFA targets are listed in does not create a different subset", () => {
  const swapped: NFA = {
    ...CONTAINS_01,
    transitions: { ...CONTAINS_01.transitions, q0: { "0": ["q1", "q0"], "1": ["q0"] } },
  };
  assert.deepEqual(subsetConstruction(swapped).dfa, subsetConstruction(CONTAINS_01).dfa);
});

test("the third-from-last NFA needs all 8 subsets", () => {
  const { dfa } = subsetConstruction(THIRD_FROM_LAST_IS_1);
  assert.equal(dfa.states.length, 8);
});

test("only reachable subsets are created", () => {
  const nfa: NFA = {
    states: ["a", "b"],
    alphabet: ["x"],
    transitions: { a: { x: ["a"] }, b: { x: ["b"] } },
    initial: "a",
    accepting: ["b"],
  };
  const { dfa } = subsetConstruction(nfa);
  assert.deepEqual(dfa.states, ["{a}"]);
  assert.deepEqual(dfa.accepting, []);
});

test("an initial accepting state makes the DFA accept empty input", () => {
  const nfa: NFA = { ...CONTAINS_01, accepting: ["q0"] };
  const { dfa } = subsetConstruction(nfa);
  assert.equal(simulate(dfa, "").accepted, true);
});

test("presets agree with their NFA on every short string", () => {
  for (const { nfa } of NFA_PRESETS) {
    const report = compareMachines(nfa, subsetConstruction(nfa).dfa);
    assert.deepEqual(report.disagreements, []);
    assert.equal(report.checked, 2 ** (report.maxLength + 1) - 1);
    assert.equal(report.maxLength, 12);
  }
});

test("random NFAs always agree with their DFA", () => {
  let seed = 7;
  const random = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  for (let round = 0; round < 200; round += 1) {
    const states = Array.from({ length: 1 + random(5) }, (_, i) => `s${i}`);
    const alphabet = ["a", "b"].slice(0, 1 + random(2));
    const transitions: Record<string, Record<string, string[]>> = {};
    for (const state of states) {
      transitions[state] = {};
      for (const symbol of alphabet) transitions[state][symbol] = states.filter(() => random(3) === 0);
    }
    const nfa: NFA = { states, alphabet, transitions, initial: states[0], accepting: states.filter(() => random(3) === 0) };
    const report = compareMachines(nfa, subsetConstruction(nfa).dfa, 1023);
    assert.deepEqual(report.disagreements, [], JSON.stringify(nfa));
  }
});

test("replaying events grows the DFA and empties the worklist", () => {
  const result = subsetConstruction(CONTAINS_01);
  assert.deepEqual(conversionStateAt(result, 0).discovered, []);
  assert.deepEqual(conversionStateAt(result, 1).worklist, ["{q0}"]);
  const end = conversionStateAt(result, result.events.length - 1);
  assert.deepEqual(end.discovered, result.dfa.states);
  assert.deepEqual(end.worklist, []);
  assert.deepEqual(end.table, result.dfa.transitions);
  assert.equal(end.processing, null);
});

test("accepting rings appear only once the accepting step is reached", () => {
  const result = subsetConstruction(CONTAINS_01);
  const before = dfaConversionView(result, conversionStateAt(result, result.events.length - 3), false, 0);
  assert.deepEqual([...(before.acceptingVisible ?? [])], []);
  const view = dfaConversionView(result, conversionStateAt(result, result.events.length - 1), false, 0);
  assert.deepEqual([...(view.acceptingVisible ?? [])], result.dfa.accepting);
});

test("subset construction rejects an invalid NFA", () => {
  assert.throws(() => subsetConstruction({ ...CONTAINS_01, initial: "zz" }));
});
