import { simulate } from "./dfa-engine";
import type { DFA } from "./dfa-types";
import { simulateNFA } from "./nfa-engine";
import type { NFA } from "./nfa-types";

export interface EquivalenceReport {
  maxLength: number;
  checked: number;
  disagreements: string[];
}

/** Largest length whose full set of strings stays within `budget`. */
function lengthWithinBudget(alphabetSize: number, budget: number): number {
  let length = 0;
  let total = 1;
  let level = 1;
  while (true) {
    level *= alphabetSize;
    if (alphabetSize <= 1 ? length >= 30 : total + level > budget) return length;
    total += level;
    length += 1;
  }
}

/** Runs both machines on every string up to a length chosen to fit `budget`. */
export function compareMachines(nfa: NFA, dfa: DFA, budget = 8191): EquivalenceReport {
  const maxLength = lengthWithinBudget(nfa.alphabet.length, budget);
  const disagreements: string[] = [];
  let checked = 0;
  const visit = (prefix: string) => {
    checked += 1;
    if (simulateNFA(nfa, prefix).accepted !== simulate(dfa, prefix).accepted) disagreements.push(prefix);
    if (Array.from(prefix).length === maxLength) return;
    for (const symbol of nfa.alphabet) visit(prefix + symbol);
  };
  visit("");
  return { maxLength, checked, disagreements };
}
