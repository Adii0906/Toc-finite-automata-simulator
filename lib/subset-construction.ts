import type { DFA, StateId } from "./dfa-types";
import { canonicalSet, nfaDelta, validateNFA } from "./nfa-engine";
import type { NFA } from "./nfa-types";

export const EMPTY_SET_ID = "∅";

export function subsetId(members: readonly StateId[]): StateId {
  return members.length === 0 ? EMPTY_SET_ID : `{${members.join(",")}}`;
}

export interface MemberMove {
  member: StateId;
  targets: StateId[];
}

/** One teachable moment of the algorithm, recorded in execution order. */
export type ConversionEvent =
  | { kind: "intro" }
  | { kind: "initial"; state: StateId; subset: StateId[] }
  | { kind: "select"; state: StateId; subset: StateId[] }
  | {
      kind: "compute";
      state: StateId;
      subset: StateId[];
      symbol: string;
      perMember: MemberMove[];
      union: StateId[];
    }
  | {
      kind: "link";
      state: StateId;
      subset: StateId[];
      symbol: string;
      perMember: MemberMove[];
      union: StateId[];
      target: StateId;
      isNew: boolean;
      isDead: boolean;
    }
  | { kind: "accepting"; accepting: { state: StateId; via: StateId[] }[] }
  | { kind: "done"; stateCount: number };

export interface ConversionResult {
  nfa: NFA;
  dfa: DFA;
  /** Which NFA states each DFA state stands for. */
  subsets: Record<StateId, StateId[]>;
  deadState: StateId | null;
  events: ConversionEvent[];
}

/**
 * Subset construction. Each DFA state is a set of NFA states, and only subsets
 * reachable from {initial} are created. The events describe the run so the
 * interface can replay it without doing any of the mathematics itself.
 */
export function subsetConstruction(nfa: NFA): ConversionResult {
  const problems = validateNFA(nfa);
  if (problems.length > 0) throw new Error(problems.join(" "));

  const initialSubset = canonicalSet(nfa, [nfa.initial]);
  const initialId = subsetId(initialSubset);
  const subsets: Record<StateId, StateId[]> = { [initialId]: initialSubset };
  const order: StateId[] = [initialId];
  const worklist: StateId[] = [initialId];
  const transitions: Record<StateId, Record<string, StateId>> = {};
  const events: ConversionEvent[] = [
    { kind: "intro" },
    { kind: "initial", state: initialId, subset: initialSubset },
  ];

  while (worklist.length > 0) {
    const state = worklist.shift()!;
    const subset = subsets[state];
    transitions[state] = {};
    events.push({ kind: "select", state, subset });

    for (const symbol of nfa.alphabet) {
      const perMember = subset.map((member) => ({ member, targets: nfaDelta(nfa, member, symbol) }));
      const union = canonicalSet(nfa, perMember.flatMap((move) => move.targets));
      events.push({ kind: "compute", state, subset, symbol, perMember, union });

      const target = subsetId(union);
      // The canonical id makes {q1,q0} and {q0,q1} the same state.
      const isNew = !(target in subsets);
      if (isNew) {
        subsets[target] = union;
        order.push(target);
        worklist.push(target);
      }
      transitions[state][symbol] = target;
      events.push({
        kind: "link",
        state,
        subset,
        symbol,
        perMember,
        union,
        target,
        isNew,
        isDead: union.length === 0,
      });
    }
  }

  const accepting = order
    .map((state) => ({ state, via: subsets[state].filter((member) => nfa.accepting.includes(member)) }))
    .filter((entry) => entry.via.length > 0);

  events.push({ kind: "accepting", accepting });
  events.push({ kind: "done", stateCount: order.length });

  return {
    nfa,
    dfa: {
      states: order,
      alphabet: nfa.alphabet,
      transitions,
      initial: initialId,
      accepting: accepting.map((entry) => entry.state),
    },
    subsets,
    deadState: EMPTY_SET_ID in subsets ? EMPTY_SET_ID : null,
    events,
  };
}
