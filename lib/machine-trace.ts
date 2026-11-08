import type { SimulationResult, StateId, InputSymbol } from "./dfa-types";

/** One edge followed while reading a symbol. */
export interface TraceMove {
  from: StateId;
  to: StateId;
  edgeId: string;
}

/**
 * What a machine did on one symbol. A DFA has exactly one active state and one
 * move. An NFA can have many of both, and states with no move are stranded.
 */
export interface TraceStep {
  index: number;
  symbol: InputSymbol;
  active: readonly StateId[];
  moves: readonly TraceMove[];
  stranded: readonly StateId[];
  nextActive: readonly StateId[];
}

/** The common record the animation layer replays for any kind of machine. */
export interface MachineTrace {
  input: string;
  initialActive: readonly StateId[];
  steps: readonly TraceStep[];
  finalActive: readonly StateId[];
  accepted: boolean;
}

export function dfaTrace(result: SimulationResult): MachineTrace {
  return {
    input: result.input,
    initialActive: [result.initialState],
    steps: result.steps.map((step) => ({
      index: step.index,
      symbol: step.symbol,
      active: [step.currentState],
      moves: [{ from: step.currentState, to: step.nextState, edgeId: step.transitionId }],
      stranded: [],
      nextActive: [step.nextState],
    })),
    finalActive: [result.finalState],
    accepted: result.accepted,
  };
}
