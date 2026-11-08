import type { InputSymbol, StateId } from "./dfa-types";

/** An NFA without ε-moves. δ maps a state and a symbol to a set of states. */
export interface NFA {
  states: readonly StateId[];
  alphabet: readonly InputSymbol[];
  transitions: Readonly<Record<StateId, Readonly<Record<InputSymbol, readonly StateId[]>>>>;
  initial: StateId;
  accepting: readonly StateId[];
}
