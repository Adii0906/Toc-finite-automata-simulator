"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useEdgeSweep } from "@/hooks/useEdgeSweep";
import { useSimulationPlayer } from "@/hooks/useSimulationPlayer";
import { simulate, transitionId } from "@/lib/dfa-engine";
import { ENDS_IN_01 } from "@/lib/dfa-presets";
import { ENDS_IN_01_LAYOUT, diagramFromDFA } from "@/lib/graph-layout";
import { dfaTrace } from "@/lib/machine-trace";
import { cellStatus, deriveView, toGraphView, type GraphView, type NodeTone } from "@/lib/simulation-view";
import { AutomataGraph } from "./AutomataGraph";
import { TapeStrip } from "./InputVisualizer";
import { Equation, StateName } from "./Math";

const HERO_INPUT = "1001";
const LOOP_DELAY_MS = 2400;
const DIAGRAM = diagramFromDFA(ENDS_IN_01);
const SWEEP_EDGE = transitionId("q0", "q1");

const allTones = (tone: NodeTone) => Object.fromEntries(ENDS_IN_01.states.map((state) => [state, tone]));

const PARTS: { symbol: ReactNode; name: string; meaning: string; example: ReactNode; view: GraphView; sweep?: boolean }[] = [
  {
    symbol: <i>Q</i>,
    name: "States",
    meaning: "Every situation the machine can be in.",
    example: (
      <>
        {"{"}
        <StateName id="q0" />, <StateName id="q1" />, <StateName id="q2" />
        {"}"}
      </>
    ),
    view: { tones: allTones("lit"), edgeStatus: {} },
  },
  {
    symbol: "Σ",
    name: "Input alphabet",
    meaning: "The symbols it knows how to read.",
    example: "{0, 1}",
    view: { tones: {}, edgeStatus: {}, labelsLit: true },
  },
  {
    symbol: <i>δ</i>,
    name: "Transition function",
    meaning: "From a state and a symbol, the one state to go to next.",
    example: <Equation from="q0" symbol="0" to="q1" />,
    view: { tones: {}, edgeStatus: { [SWEEP_EDGE]: "running" } },
    sweep: true,
  },
  {
    symbol: (
      <>
        <i>q</i>
        <sub>0</sub>
      </>
    ),
    name: "Initial state",
    meaning: "Where every run begins.",
    example: <StateName id="q0" />,
    view: { tones: { q0: "active" }, edgeStatus: {}, startLit: true },
  },
  {
    symbol: <i>F</i>,
    name: "Accepting states",
    meaning: "Finish here and the string is in the language.",
    example: (
      <>
        {"{"}
        <StateName id="q2" />
        {"}"}
      </>
    ),
    view: { tones: { q2: "accepted" }, edgeStatus: {} },
  },
];

export function Hero() {
  const sim = useMemo(() => [dfaTrace(simulate(ENDS_IN_01, HERO_INPUT))], []);
  const { player, snapshot } = useSimulationPlayer(sim);
  const view = useMemo(() => deriveView(snapshot), [snapshot]);
  const graphView = useMemo(() => toGraphView(view), [view]);
  const figure = useRef<HTMLDivElement>(null);
  const inView = useInView(figure, { amount: 0.3 });
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<number | null>(null);
  const part = selected === null ? null : PARTS[selected];
  const sweepFrames = useEdgeSweep(SWEEP_EDGE, inView && Boolean(part?.sweep));
  const runFrames = useMemo(() => player.framesFor(0), [player]);
  const running = inView && selected === null && !reduced;

  useEffect(() => {
    if (reduced) {
      player.seek(sim[0].steps.length);
      return;
    }
    if (!running) {
      player.pause();
      return;
    }
    if (player.getSnapshot().mode !== "playing" && !deriveView(player.getSnapshot()).finished) player.play();
  }, [running, reduced, player, sim]);

  useEffect(() => {
    if (!view.finished || !running) return;
    const timer = window.setTimeout(() => {
      player.restart();
      player.play();
    }, LOOP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [view.finished, running, player]);

  return (
    <div>
      <header className="mx-auto grid max-w-[100rem] items-center gap-x-10 gap-y-6 px-5 pt-6 pb-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
          <h1 className="text-[clamp(3.25rem,8.4vw,8rem)] leading-[0.94] font-extrabold tracking-[-0.03em]">
            See How
            <br />
            Automata
            <br />
            Think.
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1.1875rem] text-fg/85">
            An interactive visual journey through finite automata. Enter a string, follow every transition, and understand how a
            machine decides.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#dfa" data-cta="dfa" className="inline-flex h-12 items-center rounded-[3px] bg-amber px-6 font-semibold text-midnight transition-colors hover:bg-[#ffc78d]">
              Explore Simulator
            </a>
            <a href="#converter" data-cta="converter" className="inline-flex h-12 items-center rounded-[3px] border border-fg/50 px-6 font-semibold transition-colors hover:border-fg">
              Convert an NFA to a DFA
            </a>
          </div>
        </motion.div>

        <motion.div ref={figure} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.15 }}>
          <AutomataGraph
            model={DIAGRAM}
            layout={ENDS_IN_01_LAYOUT}
            view={part ? part.view : graphView}
            subscribeFrames={part ? sweepFrames : runFrames}
            compact
            title="A small DFA reading a string"
            className="block w-full"
          />
          <div className={`mt-2 flex justify-center transition-opacity ${part ? "opacity-30" : ""}`} aria-hidden>
            <TapeStrip
              symbols={Array.from(HERO_INPUT)}
              statusAt={(index) => cellStatus(index, view, snapshot.phase)}
              head={view.finished ? null : view.headIndex}
              cell="2.5rem"
              verdictTone={view.verdict === "accepted" ? "ok" : view.verdict === "rejected" ? "no" : null}
            />
          </div>
        </motion.div>
      </header>

      <section aria-labelledby="intro-title" className="border-t border-fg/15 bg-midnight/35">
        <div className="mx-auto max-w-[100rem] px-5 py-6 lg:px-10">
          <div className="grid gap-x-10 gap-y-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)]">
            <h2 id="intro-title" className="text-[1.625rem] leading-tight font-bold">
              A DFA only knows which state it is in
            </h2>
            <p className="max-w-[46rem] text-fg/85">
              A DFA is a mathematical machine that reads an input string one symbol at a time and determines whether it belongs to
              a particular language. It is defined by five parts. Point at one to see it on the machine above.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5" onMouseLeave={() => setSelected(null)}>
            {PARTS.map((item, index) => {
              const isSelected = selected === index;
              return (
                <button
                  key={item.name}
                  type="button"
                  data-part={item.name}
                  aria-pressed={isSelected}
                  onMouseEnter={() => setSelected(index)}
                  onFocus={() => setSelected(index)}
                  onBlur={() => setSelected(null)}
                  onClick={() => setSelected(index)}
                  className={`flex flex-col items-start justify-start border-t-2 pt-2 text-left transition-colors ${isSelected ? "border-amber" : "border-fg/25"}`}
                >
                  <span className={`math block text-[2.25rem] leading-none transition-colors ${isSelected ? "text-amber" : ""}`}>{item.symbol}</span>
                  <span className="mt-1.5 block font-semibold">{item.name}</span>
                  <span className="block text-[0.9375rem] leading-snug text-muted">{item.meaning}</span>
                  <span className="math mt-1 block text-[1.0625rem]">{item.example}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
