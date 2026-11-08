"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useIsSmallScreen } from "@/hooks/useIsSmallScreen";
import { useSimulationPlayer } from "@/hooks/useSimulationPlayer";
import { simulate, transitionId, validateInput } from "@/lib/dfa-engine";
import { ENDS_IN_01, EXAMPLE_INPUTS, TRANSITION_NOTES } from "@/lib/dfa-presets";
import { autoLayout, diagramFromDFA } from "@/lib/graph-layout";
import { dfaTrace, type MachineTrace } from "@/lib/machine-trace";
import { SPEED_FACTOR, type Phase } from "@/lib/playback";
import { cellStatus, deriveView, toGraphView, type SimulationView } from "@/lib/simulation-view";
import type { DFA } from "@/lib/dfa-types";
import { useActiveView } from "./AppShell";
import { AutomataGraph } from "./AutomataGraph";
import { DFAEditor } from "./DFAEditor";
import { ExecutionLog } from "./ExecutionLog";
import { InputVisualizer, type TapeCell } from "./InputVisualizer";
import { Equation, StateName, withStateNames } from "./Math";
import { SimulationControls } from "./SimulationControls";
import { TransitionTable } from "./TransitionTable";

const DFA_MODEL = ENDS_IN_01;
const DEFAULT_INPUT = "1101";
const MAX_LENGTH = 40;

export const PHASES: { id: Phase; label: string }[] = [
  { id: "read", label: "Read" },
  { id: "transition", label: "Transition" },
  { id: "arrive", label: "Arrive" },
  { id: "consume", label: "Consume" },
];

function checkInput(dfa: DFA, text: string) {
  if (text.length > MAX_LENGTH) {
    return { ok: false as const, index: -1, message: `Enter ${MAX_LENGTH} symbols or fewer. This string has ${text.length}.` };
  }
  return validateInput(dfa, text);
}

function verdictExplanation(trace: MachineTrace): ReactNode {
  const name = <StateName id={trace.finalActive[0]} />;
  if (trace.input === "") {
    return <>The input is empty, so no transition runs. The machine stays in {name}, which is not an accepting state.</>;
  }
  const shown = <span className="math">{trace.input}</span>;
  return trace.accepted ? (
    <>The machine ended in {name}, an accepting state, so {shown} belongs to the language.</>
  ) : (
    <>The machine ended in {name}, which is not an accepting state, so {shown} does not belong to the language.</>
  );
}

function Readout({ trace, view, phase, invalid }: { trace: MachineTrace; view: SimulationView; phase: Phase; invalid: boolean }) {
  const step = view.focusStep;
  let headline: ReactNode;
  let detail: ReactNode;

  if (invalid) {
    headline = <span className="text-muted">Waiting for valid input</span>;
    detail = "Fix the input above to run the machine.";
  } else if (view.finished) {
    const accepted = view.verdict === "accepted";
    headline = (
      <span className={`inline-flex items-center gap-2 font-display font-bold ${accepted ? "text-ok" : "text-no"}`} data-verdict={view.verdict}>
        {accepted ? <Check size={28} strokeWidth={3} aria-hidden /> : <X size={28} strokeWidth={3} aria-hidden />}
        {accepted ? "ACCEPTED" : "REJECTED"}
      </span>
    );
    detail = verdictExplanation(trace);
  } else if (view.step && phase === "read") {
    headline = <Equation from={view.step.active[0]} symbol={view.step.symbol} to={null} symbolClassName="text-amber" />;
    detail = (
      <>
        The machine is in <StateName id={view.step.active[0]} /> and is reading <span className="math text-amber">{view.step.symbol}</span>.
      </>
    );
  } else if (step) {
    headline = <Equation from={step.active[0]} symbol={step.symbol} to={step.nextActive[0]} symbolClassName="text-amber" />;
    detail =
      withStateNames(TRANSITION_NOTES[transitionId(step.active[0], step.nextActive[0])] ?? "The machine follows this transition.");
  } else {
    headline = <StateName id={trace.initialActive[0]} />;
    detail =
      trace.input === ""
        ? "The tape is empty. Press Play to check whether the machine accepts it."
        : "The machine waits in its start state. Press Play to read the tape.";
  }

  return (
    <div className="min-h-[6.25rem] flex-1" aria-live="polite">
      <div className="math flex min-h-11 items-center text-[2.125rem] leading-tight" data-readout>
        {headline}
      </div>
      <p className="mt-0.5 max-w-[64ch] text-[1.0625rem] text-fg/85">{detail}</p>
    </div>
  );
}

export function DFASimulator() {
  const initial = useMemo(() => [dfaTrace(simulate(DFA_MODEL, DEFAULT_INPUT))], []);
  const { player, snapshot } = useSimulationPlayer(initial);
  const view = useMemo(() => deriveView(snapshot), [snapshot]);
  const graphView = useMemo(() => toGraphView(view), [view]);
  const [dfa, setDfa] = useState<DFA>(DFA_MODEL);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [text, setText] = useState(DEFAULT_INPUT);
  const validation = useMemo(() => checkInput(dfa, text), [dfa, text]);
  const diagram = useMemo(() => diagramFromDFA(dfa), [dfa]);
  const layout = useMemo(() => autoLayout(diagram), [diagram]);
  const compactGraph = useIsSmallScreen();
  const activeView = useActiveView();
  const subscribeFrames = useMemo(() => player.framesFor(0), [player]);

  useEffect(() => {
    if (activeView !== "dfa") player.pause();
  }, [activeView, player]);

  const applyInput = useCallback(
    (next: string) => {
      setText(next);
      const check = checkInput(dfa, next);
      player.load([dfaTrace(simulate(dfa, check.ok ? next : ""))]);
    },
    [dfa, player],
  );

  const applyDFA = useCallback(
    (next: DFA) => {
      setDfa(next);
      setText("");
      player.load([dfaTrace(simulate(next, ""))]);
    },
    [player],
  );

  const invalid = !validation.ok;
  const { traces, phase, mode, cursor, speed, evaluated } = snapshot;
  const trace = traces[0];
  const beatMs = Math.round(260 * SPEED_FACTOR[speed]);
  const running = mode === "playing" || mode === "stepping";

  const run = () => {
    player.restart();
    player.play();
  };

  const invalidIndex = validation.ok ? -1 : validation.index;
  const symbols = invalid ? Array.from(text) : Array.from(trace.input);
  const statusAt = (index: number): TapeCell => {
    if (invalid) return index === invalidIndex ? "invalid" : "remaining";
    return cellStatus(index, view, phase);
  };

  const showHead = !invalid && !view.finished && symbols.length > 0;
  const verdictTone = view.verdict === "accepted" ? "ok" : view.verdict === "rejected" ? "no" : null;
  const midStep = phase !== "ready";

  return (
    <section id="simulator" aria-labelledby="simulator-title" className="graph-paper flex flex-col lg:block">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-start gap-x-10 gap-y-3 px-5 pt-3 pb-3 lg:px-10">
        <div className="min-w-[17rem]">
          <h2 id="simulator-title" className="text-[1.75rem] leading-tight font-bold">
            {dfa === DFA_MODEL ? (
              <>Binary strings ending in <span className="math font-normal">01</span></>
            ) : (
              <>Custom DFA <span className="math font-normal">({dfa.states.length} states)</span></>
            )}
          </h2>
          <p className="text-[0.9375rem] text-muted">
            {dfa === DFA_MODEL ? (
              <><StateName id="q1" /> means the last symbol was 0. <StateName id="q2" /> means the string so far ends in 01.</>
            ) : (
              <>Alphabet: <span className="math">{dfa.alphabet.join(", ")}</span></>
            )}
          </p>
        </div>

        <form
          className="min-w-64 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid) run();
          }}
        >
          <div className="flex gap-2">
            <label htmlFor="dfa-input" className="sr-only">
              Input string over the alphabet {dfa.alphabet.join(" and ")}
            </label>
            <input
              id="dfa-input"
              value={text}
              onChange={(event) => applyInput(event.target.value)}
              placeholder={`Type a string over {${dfa.alphabet.join(", ")}}, or leave empty to test ε`}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={invalid}
              aria-describedby={invalid ? "dfa-input-error" : undefined}
              className={`math h-11 w-full min-w-0 rounded-[3px] border bg-midnight/70 px-3 text-[1.3125rem] tracking-[0.12em] placeholder:font-sans placeholder:text-[0.9375rem] placeholder:tracking-normal placeholder:text-muted/70 ${
                invalid ? "border-no" : "border-line"
              }`}
            />
            <button
              type="submit"
              disabled={invalid}
              className="h-11 rounded-[3px] border border-blue px-5 text-[0.9375rem] font-semibold text-blue transition-colors hover:bg-blue/10 disabled:pointer-events-none disabled:opacity-35"
            >
              Run
            </button>
          </div>
          <p id="dfa-input-error" role={invalid ? "alert" : undefined} className="min-h-[1.4rem] text-[0.9375rem] text-no">
            {validation.ok ? "" : validation.message}
          </p>
        </form>

        {dfa === DFA_MODEL && <div className="grid gap-1 text-[0.9375rem]">
          {(
            [
              ["Accepted", EXAMPLE_INPUTS.accepted],
              ["Rejected", EXAMPLE_INPUTS.rejected],
            ] as const
          ).map(([label, examples]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-[4.75rem] text-muted">{label}</span>
              <div className="flex flex-wrap gap-1">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    data-example={example}
                    onClick={() => applyInput(example)}
                    className={`math h-7 rounded-[3px] border px-2 text-[1rem] leading-none transition-colors ${
                      example === text ? "border-amber text-fg" : "border-line text-muted hover:border-muted hover:text-fg"
                    }`}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>}
        <button
          type="button"
          aria-expanded={builderOpen}
          aria-controls="dfa-builder-panel"
          onClick={() => setBuilderOpen((open) => !open)}
          className="h-10 rounded-[3px] border border-blue px-4 text-[0.9375rem] font-semibold text-blue transition-colors hover:bg-blue/10"
        >
          {builderOpen ? "Hide builder" : "Build your own DFA"}
        </button>
      </div>

      <div id="dfa-builder-panel" hidden={!builderOpen}>
        <DFAEditor onApply={applyDFA} />
      </div>

      <div className="contents lg:mx-auto lg:grid lg:max-w-[100rem] lg:grid-cols-[minmax(0,1fr)_23.5rem]">
        <div className="order-1 min-w-0 px-5 lg:order-none lg:px-10">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
            <Readout trace={trace} view={view} phase={phase} invalid={invalid} />
            <ol className="flex gap-4 pt-2 text-[0.9375rem]" aria-label="Phase of the current step" data-phases>
              {PHASES.map(({ id, label }) => (
                <li
                  key={id}
                  aria-current={phase === id ? "step" : undefined}
                  className={`transition-colors ${phase === id ? "font-semibold text-amber" : "text-muted/60"}`}
                >
                  {label}
                </li>
              ))}
            </ol>
          </div>

          <AutomataGraph
            model={diagram}
            layout={layout}
            view={graphView}
            subscribeFrames={subscribeFrames}
            beatMs={beatMs}
            compact={compactGraph}
            title={`State diagram of a DFA with ${dfa.states.length} states over ${dfa.alphabet.join(", ")}.`}
            className="mx-auto block w-full max-w-[60rem] lg:max-h-[calc(100vh-27.5rem)]"
          />
        </div>

        <aside className="order-3 flex min-h-0 flex-col divide-y divide-line border-t border-line bg-[#141853]/80 lg:order-none lg:border-t-0 lg:border-l">
          <TransitionTable dfa={dfa} step={view.focusStep} resolved={phase !== "read"} beatMs={beatMs} />
          <ExecutionLog
            steps={trace.steps}
            count={view.logCount}
            focusIndex={view.focusStep?.index ?? -1}
            runningIndex={view.step && phase !== "rewind" ? view.step.index : -1}
            cursor={cursor}
            phase={phase}
            onSelect={(index) => player.seek(index + 1)}
          />
        </aside>
      </div>

      <div className="order-2 border-t border-line bg-[#141853]/80">
        <div className="mx-auto grid max-w-[100rem] items-center gap-x-10 gap-y-3 px-5 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-10">
          <InputVisualizer
            symbols={symbols}
            statusAt={statusAt}
            head={showHead ? view.headIndex : null}
            consumed={invalid ? 0 : view.consumed}
            remaining={invalid ? 0 : view.remaining}
            currentState={<StateName id={view.activeStates[0]} />}
            beatMs={beatMs}
            verdictTone={verdictTone}
          />
          <SimulationControls
            name="dfa"
            running={running}
            finished={view.finished}
            disabled={invalid}
            canStepBack={mode !== "playing" && (midStep || cursor > 0 || evaluated)}
            canStepForward={mode !== "playing" && !view.finished}
            speed={speed}
            onPlayPause={() => (running ? player.pause() : player.play())}
            onPrevious={() => player.previous()}
            onNext={() => player.next()}
            onRestart={() => player.restart()}
            onSpeed={(next) => player.setSpeed(next)}
          />
        </div>
      </div>
    </section>
  );
}
