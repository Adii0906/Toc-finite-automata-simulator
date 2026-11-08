import { validateNFA } from "./nfa-engine";
import type { NFA } from "./nfa-types";

export const MAX_NFA_STATES = 6;
export const MAX_NFA_SYMBOLS = 4;
const MAX_NAME_LENGTH = 4;

/** What the editor holds. It may be incomplete or invalid at any moment. */
export interface NFADraft {
  statesText: string;
  alphabetText: string;
  initial: string;
  accepting: string[];
  transitions: Record<string, Record<string, string[]>>;
}

export function draftFromNFA(nfa: NFA): NFADraft {
  const transitions: NFADraft["transitions"] = {};
  for (const state of nfa.states) {
    transitions[state] = {};
    for (const symbol of nfa.alphabet) transitions[state][symbol] = [...(nfa.transitions[state]?.[symbol] ?? [])];
  }
  return {
    statesText: nfa.states.join(", "),
    alphabetText: nfa.alphabet.join(", "),
    initial: nfa.initial,
    accepting: [...nfa.accepting],
    transitions,
  };
}

export function splitList(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}

const hasDuplicates = (items: string[]) => new Set(items).size !== items.length;

export function parseDraft(draft: NFADraft): { nfa: NFA; errors: [] } | { nfa: null; errors: string[] } {
  const states = splitList(draft.statesText);
  const alphabet = splitList(draft.alphabetText);
  const errors: string[] = [];

  if (states.length === 0) errors.push("Add at least one state.");
  if (states.length > MAX_NFA_STATES) errors.push(`Use ${MAX_NFA_STATES} states or fewer, so the diagrams stay readable.`);
  if (hasDuplicates(states)) errors.push("Each state name can appear only once.");
  for (const state of states) {
    if (state.length > MAX_NAME_LENGTH || !/^[\p{L}\p{N}_]+$/u.test(state)) {
      errors.push(`State "${state}" needs a name of letters or digits, up to ${MAX_NAME_LENGTH} characters.`);
    }
  }

  if (alphabet.length === 0) errors.push("Add at least one input symbol.");
  if (alphabet.length > MAX_NFA_SYMBOLS) errors.push(`Use ${MAX_NFA_SYMBOLS} input symbols or fewer.`);
  if (hasDuplicates(alphabet)) errors.push("Each input symbol can appear only once.");
  for (const symbol of alphabet) {
    if (symbol === "ε" || symbol.toLowerCase() === "eps" || symbol.toLowerCase() === "epsilon") {
      errors.push("ε is not available: this version handles ordinary NFA transitions only.");
    } else if (Array.from(symbol).length !== 1) {
      errors.push(`Input symbol "${symbol}" must be a single character.`);
    }
  }

  if (!states.includes(draft.initial)) errors.push("Choose an initial state.");
  if (errors.length > 0) return { nfa: null, errors };

  const known = new Set(states);
  const transitions: Record<string, Record<string, string[]>> = {};
  for (const state of states) {
    transitions[state] = {};
    for (const symbol of alphabet) {
      const targets = draft.transitions[state]?.[symbol] ?? [];
      transitions[state][symbol] = states.filter((candidate) => targets.includes(candidate) && known.has(candidate));
    }
  }

  const nfa: NFA = {
    states,
    alphabet,
    transitions,
    initial: draft.initial,
    accepting: states.filter((state) => draft.accepting.includes(state)),
  };
  const problems = validateNFA(nfa);
  return problems.length > 0 ? { nfa: null, errors: problems } : { nfa, errors: [] };
}
