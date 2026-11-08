import type {
  DFA,
  InputSymbol,
  InputValidation,
  SimulationResult,
  SimulationStep,
  StateId,
} from "./dfa-types";

/** Stable identifier of the graph edge between two states. */
export function transitionId(from: StateId, to: StateId): string {
  return `${from}->${to}`;
}

/** Lists everything that stops `dfa` from being a valid, total DFA. */
export function validateDFA(dfa: DFA): string[] {
  const problems: string[] = [];
  const known = new Set(dfa.states);

  if (!known.has(dfa.initial)) problems.push(`Initial state ${dfa.initial} is not in Q.`);
  for (const state of dfa.accepting) {
    if (!known.has(state)) problems.push(`Accepting state ${state} is not in Q.`);
  }
  for (const state of dfa.states) {
    for (const symbol of dfa.alphabet) {
      const target = dfa.transitions[state]?.[symbol];
      if (target === undefined) problems.push(`δ(${state}, ${symbol}) is undefined.`);
      else if (!known.has(target)) problems.push(`δ(${state}, ${symbol}) targets unknown ${target}.`);
    }
  }
  return problems;
}

export function delta(dfa: DFA, state: StateId, symbol: InputSymbol): StateId {
  const next = dfa.transitions[state]?.[symbol];
  if (next === undefined) throw new Error(`δ(${state}, ${symbol}) is undefined.`);
  return next;
}

export function validateInput(dfa: DFA, input: string): InputValidation {
  const alphabet = new Set(dfa.alphabet);
  const symbols = Array.from(input);
  const index = symbols.findIndex((symbol) => !alphabet.has(symbol));
  if (index === -1) return { ok: true };

  const shown = symbols[index] === " " ? "A space" : `"${symbols[index]}"`;
  const set = dfa.alphabet.join(", ");
  return {
    ok: false,
    symbol: symbols[index],
    index,
    message: `${shown} at position ${index + 1} is not in the alphabet {${set}}. Use only ${dfa.alphabet.join(" and ")}.`,
  };
}

/** Runs the DFA to completion. Throws if `input` contains a symbol outside Σ. */
export function simulate(dfa: DFA, input: string): SimulationResult {
  const validation = validateInput(dfa, input);
  if (!validation.ok) throw new Error(validation.message);

  const steps: SimulationStep[] = [];
  let currentState = dfa.initial;

  Array.from(input).forEach((symbol, index) => {
    const nextState = delta(dfa, currentState, symbol);
    steps.push({
      index,
      currentState,
      symbol,
      nextState,
      transitionId: transitionId(currentState, nextState),
    });
    currentState = nextState;
  });

  return {
    input,
    initialState: dfa.initial,
    steps,
    finalState: currentState,
    accepted: dfa.accepting.includes(currentState),
  };
}
