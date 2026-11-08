import { transitionId } from "./dfa-engine";
import type { DFA } from "./dfa-types";

/** Binary strings ending in 01. */
export const ENDS_IN_01: DFA = {
  states: ["q0", "q1", "q2"],
  alphabet: ["0", "1"],
  transitions: {
    q0: { "0": "q1", "1": "q0" },
    q1: { "0": "q1", "1": "q2" },
    q2: { "0": "q1", "1": "q0" },
  },
  initial: "q0",
  accepting: ["q2"],
};

export const TRANSITION_NOTES: Record<string, string> = {
  [transitionId("q0", "q1")]: "This 0 could be the start of 01, so the machine moves to q1.",
  [transitionId("q0", "q0")]: "A 1 cannot start 01, so the machine stays in q0.",
  [transitionId("q1", "q1")]: "The most recent symbol is still 0, so the machine stays in q1.",
  [transitionId("q1", "q2")]: "A 0 followed by this 1 makes 01, so the machine moves to q2.",
  [transitionId("q2", "q1")]: "The string no longer ends in 01, but this 0 could start a new one, so the machine returns to q1.",
  [transitionId("q2", "q0")]: "The string now ends in 11, which cannot begin 01, so the machine returns to q0.",
};

export const EXAMPLE_INPUTS = {
  accepted: ["01", "101", "1101", "0001", "100101"],
  rejected: ["0", "1", "10", "11", "100"],
} as const;
