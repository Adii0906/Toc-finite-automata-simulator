export type StateId = string;
export type InputSymbol = string;

/** The formal 5-tuple (Q, Σ, δ, q0, F). */
export interface DFA {
  states: readonly StateId[];
  alphabet: readonly InputSymbol[];
  transitions: Readonly<Record<StateId, Readonly<Record<InputSymbol, StateId>>>>;
  initial: StateId;
  accepting: readonly StateId[];
}

/** One application of δ, produced by the engine and consumed by the animation. */
export interface SimulationStep {
  /** Zero-based position of the symbol in the input. */
  index: number;
  currentState: StateId;
  symbol: InputSymbol;
  nextState: StateId;
  transitionId: string;
}

export interface SimulationResult {
  input: string;
  initialState: StateId;
  /** The transition history, in execution order. */
  steps: readonly SimulationStep[];
  finalState: StateId;
  accepted: boolean;
}

export type InputValidation =
  | { ok: true }
  | { ok: false; symbol: InputSymbol; index: number; message: string };
