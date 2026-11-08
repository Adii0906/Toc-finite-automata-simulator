import type { NFA } from "./nfa-types";

/** Strings containing 01. */
export const CONTAINS_01: NFA = {
  states: ["q0", "q1", "q2"],
  alphabet: ["0", "1"],
  transitions: {
    q0: { "0": ["q0", "q1"], "1": ["q0"] },
    q1: { "0": [], "1": ["q2"] },
    q2: { "0": ["q2"], "1": ["q2"] },
  },
  initial: "q0",
  accepting: ["q2"],
};

/** Strings starting with 10. Missing moves produce a dead state in the DFA. */
export const STARTS_WITH_10: NFA = {
  states: ["q0", "q1", "q2"],
  alphabet: ["0", "1"],
  transitions: {
    q0: { "0": [], "1": ["q1"] },
    q1: { "0": ["q2"], "1": [] },
    q2: { "0": ["q2"], "1": ["q2"] },
  },
  initial: "q0",
  accepting: ["q2"],
};

/** Strings whose third symbol from the end is 1. Needs all 8 subsets. */
export const THIRD_FROM_LAST_IS_1: NFA = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  transitions: {
    q0: { "0": ["q0"], "1": ["q0", "q1"] },
    q1: { "0": ["q2"], "1": ["q2"] },
    q2: { "0": ["q3"], "1": ["q3"] },
    q3: { "0": [], "1": [] },
  },
  initial: "q0",
  accepting: ["q3"],
};

export const NFA_PRESETS: { id: string; name: string; nfa: NFA; examples: string[] }[] = [
  { id: "contains-01", name: "Contains 01", nfa: CONTAINS_01, examples: ["01", "1101", "0010", "111", "10", ""] },
  { id: "starts-10", name: "Starts with 10 (has a dead state)", nfa: STARTS_WITH_10, examples: ["10", "1011", "01", "11", "1"] },
  { id: "third-last", name: "Third from last is 1 (8 subsets)", nfa: THIRD_FROM_LAST_IS_1, examples: ["100", "0111", "1011", "000"] },
];
