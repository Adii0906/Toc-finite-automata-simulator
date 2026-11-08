"use client";

import { useInView } from "framer-motion";
import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useAutoCycle } from "@/hooks/useAutoCycle";
import { useEdgeSweep } from "@/hooks/useEdgeSweep";
import { simulate } from "@/lib/dfa-engine";
import { ENDS_IN_01 } from "@/lib/dfa-presets";
import { ENDS_IN_01_LAYOUT, diagramFromDFA } from "@/lib/graph-layout";
import { nfaMove } from "@/lib/nfa-engine";
import { CONTAINS_01, STARTS_WITH_10 } from "@/lib/nfa-presets";
import type { GraphView } from "@/lib/simulation-view";
import { subsetConstruction } from "@/lib/subset-construction";
import { AutomataGraph } from "./AutomataGraph";
import { TapeStrip, type TapeCell } from "./InputVisualizer";
import { Equation, SetOf, StateName, withStateNames } from "./Math";

const EXAMPLE = "01";
const DIAGRAM = diagramFromDFA(ENDS_IN_01);

interface Scene {
  title: string;
  body: ReactNode;
  view: GraphView;
  cells: [TapeCell, TapeCell];
  head: number | null;
  sweep: string | null;
}

function useScenes(): Scene[] {
  return useMemo(() => {
    const { steps, finalState } = simulate(ENDS_IN_01, EXAMPLE);
    const [first, second] = steps;
    const at = (state: string): GraphView => ({ tones: { [state]: "active" }, edgeStatus: {} });
    const moving = (id: string, from: string): GraphView => ({ tones: { [from]: "active" }, edgeStatus: { [id]: "running" } });

    return [
      {
        title: "Start at q0",
        body: <>Every run begins in the initial state, <StateName id="q0" />, with the head on the first symbol.</>,
        view: { ...at(first.currentState), startLit: true },
        cells: ["remaining", "remaining"],
        head: 0,
        sweep: null,
      },
      {
        title: "Read a symbol",
        body: <>The machine looks at one symbol only. Here it reads <span className="math text-amber">{first.symbol}</span>.</>,
        view: at(first.currentState),
        cells: ["current", "remaining"],
        head: 0,
        sweep: null,
      },
      {
        title: "Follow one transition",
        body: <>There is exactly one matching arrow: <Equation from={first.currentState} symbol={first.symbol} to={first.nextState} />.</>,
        view: moving(first.transitionId, first.currentState),
        cells: ["current", "remaining"],
        head: 0,
        sweep: first.transitionId,
      },
      {
        title: "Move to the next state",
        body: <>The machine is now in <StateName id={first.nextState} />. The symbol is used up and the head moves right.</>,
        view: at(first.nextState),
        cells: ["consumed", "remaining"],
        head: 1,
        sweep: null,
      },
      {
        title: "Repeat until the input ends",
        body: <>The same read and move happens for every symbol: <Equation from={second.currentState} symbol={second.symbol} to={second.nextState} />.</>,
        view: moving(second.transitionId, second.currentState),
        cells: ["consumed", "current"],
        head: 1,
        sweep: second.transitionId,
      },
      {
        title: "Check the final state",
        body: <>The tape is finished. <StateName id={finalState} /> is accepting, so the string <span className="math">{EXAMPLE}</span> is accepted.</>,
        view: { tones: { [finalState]: "accepted" }, edgeStatus: {}, ripple: [finalState] },
        cells: ["consumed", "consumed"],
        head: null,
        sweep: null,
      },
    ];
  }, []);
}

const TURNSTILE: { part: ReactNode; example: string }[] = [
  { part: <i>Q</i>, example: "Locked, unlocked" },
  { part: "Σ", example: "Insert a coin, push the arm" },
  { part: <i>δ</i>, example: "A coin while locked unlocks it" },
  { part: <><i>q</i><sub>0</sub></>, example: "It starts locked" },
  { part: <i>F</i>, example: "Unlocked: you may walk through" },
];

function SubsetRules() {
  // The worked figures below are computed, not typed in.
  const contains = useMemo(() => subsetConstruction(CONTAINS_01), []);
  const dead = useMemo(() => subsetConstruction(STARTS_WITH_10), []);
  const union = nfaMove(CONTAINS_01, ["q0", "q1"], "1");
  const firstAccepting = contains.subsets[contains.dfa.accepting[0]];

  const rules: { rule: string; example: ReactNode }[] = [
    { rule: "Every DFA state stands for a set of NFA states.", example: <SetOf members={["q0", "q1"]} /> },
    { rule: "The DFA starts in the set holding only the NFA's initial state.", example: <SetOf members={[CONTAINS_01.initial]} /> },
    {
      rule: "For each set and symbol, take the union of where its members can go.",
      example: (
        <>
          <SetOf members={["q0", "q1"]} /> on <span className="text-amber">1</span> gives <SetOf members={union} />
        </>
      ),
    },
    { rule: "Each set that has not been seen before becomes a new DFA state. A repeat only adds an arrow.", example: `${contains.dfa.states.length} sets found for "contains 01"` },
    { rule: "If the union is empty, the DFA enters a dead state and can never accept.", example: <>{dead.deadState} loops to itself</> },
    { rule: "A set accepts if at least one of its members is an accepting NFA state.", example: <SetOf members={firstAccepting} /> },
  ];

  return (
    <ol className="mt-3 border-t border-fg/25">
      {rules.map(({ rule, example }, index) => (
        <li key={rule} className="grid gap-x-4 border-b border-fg/25 py-2 sm:grid-cols-[1.75rem_minmax(0,1fr)_minmax(10rem,16rem)]">
          <span className="math text-amber">{index + 1}</span>
          <span>{rule}</span>
          <span className="math text-[1.0625rem] sm:text-right">{example}</span>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  const scenes = useScenes();
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { amount: 0.4 });
  const { index, select } = useAutoCycle(scenes.length, inView, 3200);
  const scene = scenes[index];
  const subscribeFrames = useEdgeSweep(scene.sweep, inView);

  return (
    <section aria-labelledby="how-title" className="mx-auto max-w-[100rem] px-5 pt-4 pb-14 lg:px-10">
      <h2 id="how-title" className="text-[clamp(2.5rem,5vw,4.25rem)] leading-none font-extrabold tracking-[-0.02em]">
        How It Works
      </h2>

      <h3 className="mt-6 text-[1.5rem] font-bold">One run of a DFA</h3>
      <ol className="mt-2 grid grid-cols-2 gap-x-1 gap-y-3 sm:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label="Steps of a DFA run">
        {scenes.map((item, itemIndex) => {
          const selected = itemIndex === index;
          return (
            <li key={item.title} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                data-scene={itemIndex + 1}
                onClick={() => select(itemIndex)}
                className={`flex h-full w-full items-start gap-0 border-t-2 pt-2 pr-3 text-left transition-colors ${itemIndex <= index ? "border-amber" : "border-fg/25"}`}
              >
                <span className={`math mr-1.5 ${selected ? "text-amber" : "text-muted"}`}>{itemIndex + 1}</span>
                <span className={selected ? "font-semibold" : "text-muted"}>{withStateNames(item.title)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div ref={stage} className="mt-5 grid items-center gap-x-16 gap-y-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p className="min-h-[5.5rem] max-w-[30rem] text-[1.3125rem] leading-snug" aria-live="polite">
            {scene.body}
          </p>
          <div className="mt-3">
            <TapeStrip symbols={Array.from(EXAMPLE)} statusAt={(i) => scene.cells[i]} head={scene.head} cell="3rem" verdictTone={scene.view.ripple ? "ok" : null} />
          </div>
        </div>
        <AutomataGraph
          model={DIAGRAM}
          layout={ENDS_IN_01_LAYOUT}
          view={scene.view}
          subscribeFrames={subscribeFrames}
          compact
          title={`The machine at step ${index + 1}: ${scene.title}`}
          className="block w-full max-w-[42rem]"
        />
      </div>

      <div className="mt-12 grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-[1.5rem] font-bold">Subset construction in six rules</h3>
          <p className="mt-0.5 max-w-[60ch] text-fg/85">
            An NFA can be in several states at once. A DFA cannot. So we let one DFA state represent the whole set the NFA could be in.
          </p>
          <SubsetRules />
        </div>
        <div>
          <h3 className="text-[1.5rem] font-bold">Why the two machines agree</h3>
          <p className="mt-1 text-fg/85">
            After every symbol, the DFA's current state is exactly the set of states the NFA could be in. They start equal, and each DFA
            transition is defined as the NFA's next set. So at the end of any string they are still equal. The DFA accepts when that set
            holds an accepting state, which is precisely when the NFA accepts.
          </p>
          <h3 className="mt-7 text-[1.5rem] font-bold">The five parts in a turnstile</h3>
          <dl className="mt-1 grid grid-cols-[2.75rem_minmax(0,1fr)] gap-y-1">
            {TURNSTILE.map((row, rowIndex) => (
              <div key={rowIndex} className="col-span-2 grid grid-cols-subgrid items-baseline">
                <dt className="math text-[1.25rem]">{row.part}</dt>
                <dd>{row.example}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
