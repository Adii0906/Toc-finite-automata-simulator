import type { StateId } from "./dfa-types";
import type { TraceStep } from "./machine-trace";
import type { PlaybackSnapshot } from "./playback";

export type EdgeStatus = "idle" | "running" | "settled";
export type Verdict = "accepted" | "rejected" | null;
export type CellStatus = "consumed" | "current" | "remaining";
export type NodeTone = "idle" | "lit" | "active" | "reached" | "stranded" | "accepted" | "rejected";

/** Everything a diagram needs to draw one moment. Contains no mathematics. */
export interface GraphView {
  tones: Readonly<Record<StateId, NodeTone>>;
  edgeStatus: Readonly<Record<string, EdgeStatus>>;
  arriving?: readonly StateId[];
  ripple?: readonly StateId[];
  /** When present, only these states and edges are drawn. */
  visibleStates?: readonly StateId[];
  visibleEdges?: readonly string[];
  edgeLabels?: Readonly<Record<string, string>>;
  /** When present, replaces the model's list of double-ringed states. */
  acceptingVisible?: readonly StateId[];
  labelsLit?: boolean;
  startLit?: boolean;
  /** Seconds to hold back the state that has just been created. */
  popDelay?: number;
  popState?: StateId | null;
  popEdge?: string | null;
}

export interface SimulationView {
  activeStates: readonly StateId[];
  strandedStates: readonly StateId[];
  /** The step being executed, if any. */
  step: TraceStep | null;
  /** The executing step, or else the last completed one. */
  focusStep: TraceStep | null;
  edgeStatus: Record<string, EdgeStatus>;
  arriving: readonly StateId[];
  finished: boolean;
  verdict: Verdict;
  consumed: number;
  remaining: number;
  headIndex: number;
  /** How many execution log rows exist. */
  logCount: number;
}

export function deriveView(snap: PlaybackSnapshot, traceIndex = 0): SimulationView {
  const { traces, cursor, phase, furthest, evaluated } = snap;
  const trace = traces[traceIndex];
  const total = trace.steps.length;
  const step = phase === "ready" ? null : (trace.steps[cursor] ?? null);
  const focusStep = step ?? trace.steps[cursor - 1] ?? null;

  let activeStates: readonly StateId[];
  if (phase === "arrive" || phase === "consume") activeStates = step!.nextActive;
  else if (step) activeStates = step.active;
  else activeStates = cursor === 0 ? trace.initialActive : trace.steps[cursor - 1].nextActive;

  const edgeStatus: Record<string, EdgeStatus> = {};
  if (focusStep && phase !== "read") {
    const status: EdgeStatus = phase === "transition" || phase === "rewind" ? "running" : "settled";
    for (const move of focusStep.moves) edgeStatus[move.edgeId] = status;
  }

  const finished = phase === "ready" && (total === 0 ? evaluated : cursor >= total);
  const consumed = cursor + (phase === "consume" ? 1 : 0);

  return {
    activeStates,
    strandedStates: phase === "transition" || phase === "arrive" ? (step?.stranded ?? []) : [],
    step,
    focusStep,
    edgeStatus,
    arriving: phase === "arrive" ? step!.nextActive : [],
    finished,
    verdict: finished ? (trace.accepted ? "accepted" : "rejected") : null,
    consumed,
    remaining: total - consumed,
    headIndex: consumed,
    logCount: Math.max(furthest, step && phase !== "rewind" ? cursor + 1 : 0),
  };
}

export function toGraphView(view: SimulationView): GraphView {
  const tones: Record<StateId, NodeTone> = {};
  const activeTone: NodeTone =
    view.verdict === "accepted" ? "accepted" : view.verdict === "rejected" ? "rejected" : "active";
  for (const state of view.activeStates) tones[state] = activeTone;
  for (const state of view.strandedStates) tones[state] = "stranded";
  return {
    tones,
    edgeStatus: view.edgeStatus,
    arriving: view.arriving,
    ripple: view.finished ? view.activeStates : [],
  };
}

export function cellStatus(index: number, view: SimulationView, phase: PlaybackSnapshot["phase"]): CellStatus {
  if (index < view.consumed) return "consumed";
  const reading = phase === "read" || phase === "transition" || phase === "arrive";
  return reading && index === view.consumed ? "current" : "remaining";
}
