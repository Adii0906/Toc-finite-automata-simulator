import { transitionId } from "./dfa-engine";
import type { StateId } from "./dfa-types";
import type { MachineTrace, TraceMove, TraceStep } from "./machine-trace";
import type { NFA } from "./nfa-types";

export function validateNFA(nfa: NFA): string[] {
  const problems: string[] = [];
  const known = new Set(nfa.states);

  if (nfa.states.length === 0) problems.push("Add at least one state.");
  if (nfa.alphabet.length === 0) problems.push("Add at least one input symbol.");
  if (new Set(nfa.states).size !== nfa.states.length) problems.push("State names must be unique.");
  if (new Set(nfa.alphabet).size !== nfa.alphabet.length) problems.push("Input symbols must be unique.");
  if (!known.has(nfa.initial)) problems.push("Choose an initial state from the list of states.");
  for (const state of nfa.accepting) {
    if (!known.has(state)) problems.push(`Accepting state ${state} is not in the list of states.`);
  }
  for (const state of nfa.states) {
    for (const symbol of nfa.alphabet) {
      for (const target of nfa.transitions[state]?.[symbol] ?? []) {
        if (!known.has(target)) problems.push(`δ(${state}, ${symbol}) points to unknown state ${target}.`);
      }
    }
  }
  return problems;
}

/** Returns `states` in the order the NFA declares them, without duplicates. */
export function canonicalSet(nfa: NFA, states: Iterable<StateId>): StateId[] {
  const wanted = new Set(states);
  return nfa.states.filter((state) => wanted.has(state));
}

export function nfaDelta(nfa: NFA, state: StateId, symbol: string): StateId[] {
  return canonicalSet(nfa, nfa.transitions[state]?.[symbol] ?? []);
}

/** The union of δ(state, symbol) for every state in `active`. */
export function nfaMove(nfa: NFA, active: Iterable<StateId>, symbol: string): StateId[] {
  const reached = new Set<StateId>();
  for (const state of active) {
    for (const target of nfaDelta(nfa, state, symbol)) reached.add(target);
  }
  return canonicalSet(nfa, reached);
}

export function validateNFAInput(nfa: NFA, input: string): { ok: true } | { ok: false; message: string } {
  const alphabet = new Set(nfa.alphabet);
  const symbols = Array.from(input);
  const index = symbols.findIndex((symbol) => !alphabet.has(symbol));
  if (index === -1) return { ok: true };
  return {
    ok: false,
    message: `"${symbols[index]}" at position ${index + 1} is not in the alphabet {${nfa.alphabet.join(", ")}}.`,
  };
}

/** Tracks every reachable state. Accepts if any of them is accepting at the end. */
export function simulateNFA(nfa: NFA, input: string): MachineTrace {
  const validation = validateNFAInput(nfa, input);
  if (!validation.ok) throw new Error(validation.message);

  const initialActive = [nfa.initial];
  let active: StateId[] = initialActive;
  const steps: TraceStep[] = [];

  Array.from(input).forEach((symbol, index) => {
    const moves: TraceMove[] = [];
    const stranded: StateId[] = [];
    for (const from of active) {
      const targets = nfaDelta(nfa, from, symbol);
      if (targets.length === 0) stranded.push(from);
      for (const to of targets) moves.push({ from, to, edgeId: transitionId(from, to) });
    }
    const nextActive = nfaMove(nfa, active, symbol);
    steps.push({ index, symbol, active, moves, stranded, nextActive });
    active = nextActive;
  });

  return {
    input,
    initialActive,
    steps,
    finalActive: active,
    accepted: active.some((state) => nfa.accepting.includes(state)),
  };
}
