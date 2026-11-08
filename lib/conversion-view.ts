import { transitionId } from "./dfa-engine";
import type { StateId } from "./dfa-types";
import type { EdgeStatus, GraphView, NodeTone } from "./simulation-view";
import type { ConversionEvent, ConversionResult } from "./subset-construction";

export interface ConversionState {
  event: ConversionEvent | null;
  /** DFA states created so far, in discovery order. */
  discovered: StateId[];
  /** Subsets created but not yet processed, oldest first. */
  worklist: StateId[];
  processed: StateId[];
  processing: StateId | null;
  /** Known transitions: state, then symbol, then target. */
  table: Record<StateId, Record<string, StateId>>;
  acceptingKnown: boolean;
}

/** The algorithm's bookkeeping after events 0 to `index`, by replaying them. */
export function conversionStateAt(result: ConversionResult, index: number): ConversionState {
  const discovered: StateId[] = [];
  const worklist: StateId[] = [];
  const processed: StateId[] = [];
  const table: ConversionState["table"] = {};
  let processing: StateId | null = null;
  let acceptingKnown = false;

  for (const event of result.events.slice(0, index + 1)) {
    switch (event.kind) {
      case "initial":
        discovered.push(event.state);
        worklist.push(event.state);
        break;
      case "select":
        if (processing) processed.push(processing);
        worklist.splice(worklist.indexOf(event.state), 1);
        processing = event.state;
        table[event.state] = {};
        break;
      case "link":
        table[event.state][event.symbol] = event.target;
        if (event.isNew) {
          discovered.push(event.target);
          worklist.push(event.target);
        }
        break;
      case "accepting":
        if (processing) processed.push(processing);
        processing = null;
        acceptingKnown = true;
        break;
      default:
        break;
    }
  }

  return {
    event: result.events[index] ?? null,
    discovered,
    worklist,
    processed,
    processing,
    table,
    acceptingKnown,
  };
}

function setTones(tones: Record<StateId, NodeTone>, states: readonly StateId[], tone: NodeTone) {
  for (const state of states) tones[state] = tone;
}

export function nfaConversionView(result: ConversionResult | null, state: ConversionState | null, animating: boolean): GraphView {
  const tones: Record<StateId, NodeTone> = {};
  const edgeStatus: Record<string, EdgeStatus> = {};
  const event = state?.event;
  if (!result || !event) return { tones, edgeStatus };

  switch (event.kind) {
    case "initial":
    case "select":
      setTones(tones, event.subset, "active");
      break;
    case "compute":
      setTones(tones, event.subset, "active");
      for (const { member, targets } of event.perMember) {
        for (const target of targets) edgeStatus[transitionId(member, target)] = animating ? "running" : "settled";
      }
      if (!animating) setTones(tones, event.union, "reached");
      break;
    case "link":
      setTones(tones, event.union, "reached");
      break;
    case "accepting":
      setTones(tones, result.nfa.accepting, "accepted");
      break;
    default:
      break;
  }
  return { tones, edgeStatus };
}

export function dfaConversionView(result: ConversionResult | null, state: ConversionState | null, animating: boolean, popDelay: number): GraphView {
  const tones: Record<StateId, NodeTone> = {};
  const edgeStatus: Record<string, EdgeStatus> = {};
  const edgeLabels: Record<string, string> = {};
  if (!result || !state) return { tones, edgeStatus, visibleStates: [], visibleEdges: [] };

  const visibleEdges: string[] = [];
  const symbolsByEdge = new Map<string, string[]>();
  for (const [from, row] of Object.entries(state.table)) {
    for (const symbol of result.dfa.alphabet) {
      const to = row[symbol];
      if (to === undefined) continue;
      const id = transitionId(from, to);
      if (!symbolsByEdge.has(id)) visibleEdges.push(id);
      symbolsByEdge.set(id, [...(symbolsByEdge.get(id) ?? []), symbol]);
    }
  }
  symbolsByEdge.forEach((symbols, id) => (edgeLabels[id] = symbols.join(", ")));

  const event = state.event;
  if (state.processing) tones[state.processing] = "lit";
  if (event?.kind === "select" || event?.kind === "compute") tones[event.state] = "active";
  if (event?.kind === "initial") tones[event.state] = "active";
  if (event?.kind === "link") {
    tones[event.state] = "active";
    if (event.target !== event.state) tones[event.target] = "reached";
    edgeStatus[transitionId(event.state, event.target)] = animating ? "running" : "settled";
  }
  if (event?.kind === "accepting") {
    for (const { state: accepted } of event.accepting) tones[accepted] = "accepted";
  }

  return {
    tones,
    edgeStatus,
    visibleStates: state.discovered,
    visibleEdges,
    edgeLabels,
    acceptingVisible: state.acceptingKnown ? result.dfa.accepting : [],
    popState: event?.kind === "link" && event.isNew && animating ? event.target : event?.kind === "initial" && animating ? event.state : null,
    popEdge: event?.kind === "link" && animating ? transitionId(event.state, event.target) : null,
    popDelay,
  };
}
