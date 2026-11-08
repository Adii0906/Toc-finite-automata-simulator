"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useIsSmallScreen } from "@/hooks/useIsSmallScreen";
import { useSimulationPlayer } from "@/hooks/useSimulationPlayer";
import { EVENT_MS } from "@/lib/conversion-player";
import { conversionStateAt, dfaConversionView, nfaConversionView } from "@/lib/conversion-view";
import { simulate } from "@/lib/dfa-engine";
import { compareMachines } from "@/lib/equivalence";
import { diagramFromDFA, diagramFromNFA } from "@/lib/graph-layout";
import { dfaTrace, type MachineTrace } from "@/lib/machine-trace";
import { simulateNFA, validateNFAInput } from "@/lib/nfa-engine";
import { CONTAINS_01, NFA_PRESETS } from "@/lib/nfa-presets";
import { SPEED_FACTOR } from "@/lib/playback";
import { deriveView, toGraphView } from "@/lib/simulation-view";
import { subsetConstruction, type ConversionResult, type ConversionEvent } from "@/lib/subset-construction";
import { useActiveView } from "../AppShell";
import { AutomataGraph } from "../AutomataGraph";
import { StateName } from "../Math";
import { SimulationControls } from "../SimulationControls";
import { useConverter } from "./ConverterContext";
import { ConversionWorksheet } from "./ConversionWorksheet";
import { GeneratedTable } from "./GeneratedTable";
import { MachineRun } from "./MachineRun";
import { MergeOverlay } from "./MergeOverlay";
import { NFAEditor } from "./NFAEditor";

type Mode = "convert" | "run";

const MERGE_SHARE = 0.5;

function tracesFor(result: ConversionResult, input: string): MachineTrace[] {
  return [simulateNFA(result.nfa, input), dfaTrace(simulate(result.dfa, input))];
}

function PanelTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[1.25rem] font-bold">{children}</h3>
      {note && <span className="text-[0.9375rem] text-muted">{note}</span>}
    </div>
  );
}

function Scrubber({ events, index, onSeek }: { events: ConversionEvent[]; index: number; onSeek: (i: number) => void }) {
  return (
    <ol className="flex h-5 min-w-0 flex-1 items-center gap-[2px]" aria-label="Conversion steps" data-scrubber>
      {events.map((event, eventIndex) => (
        <li key={eventIndex} className="min-w-0 flex-1">
          <button
            type="button"
            aria-label={`Go to step ${eventIndex + 1} of ${events.length}`}
            aria-current={eventIndex === index ? "step" : undefined}
            data-seek={eventIndex}
            onClick={() => onSeek(eventIndex)}
            className="block h-5 w-full py-[7px]"
          >
            <span
              className={`block h-full w-full transition-colors ${
                eventIndex === index ? "bg-amber" : eventIndex < index ? (event.kind === "link" && event.isNew ? "bg-cyan" : "bg-blue/70") : "bg-fg/20"
              }`}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}

function WorklistRow({ label, items, emphasis }: { label: string; items: string[]; emphasis?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="w-[6.5rem] shrink-0 text-muted">{label}</span>
      {items.length === 0 ? (
        <span className="text-muted/60">none</span>
      ) : (
        items.map((item) => (
          <span key={item} className={emphasis ? "text-amber" : ""}>
            <StateName id={item} />
          </span>
        ))
      )}
    </div>
  );
}

export function NFAConverter() {
  const { nfa, presetId, player: conversion, snapshot, edit } = useConverter();
  const { result, index, mode: convMode, speed: convSpeed, completed } = snapshot;

  const [mode, setMode] = useState<Mode>("convert");
  const stage = useRef<HTMLDivElement>(null);
  const compact = useIsSmallScreen();
  const activeView = useActiveView();

  const placeholder = useMemo(() => tracesFor(subsetConstruction(CONTAINS_01), ""), []);
  const { player: runner, snapshot: runSnapshot } = useSimulationPlayer(placeholder);
  const [runText, setRunText] = useState("");
  const [runError, setRunError] = useState<string | null>(null);

  const nfaFrames = useMemo(() => runner.framesFor(0), [runner]);
  const dfaFrames = useMemo(() => runner.framesFor(1), [runner]);

  const applyRunText = useCallback(
    (text: string, target: ConversionResult) => {
      setRunText(text);
      const check = validateNFAInput(target.nfa, text);
      setRunError(check.ok ? null : check.message);
      runner.load(tracesFor(target, check.ok ? text : ""));
    },
    [runner],
  );

  const preset = NFA_PRESETS.find((candidate) => candidate.id === presetId);
  const examples = preset ? preset.examples : result ? [result.nfa.alphabet.slice(0, 2).join(""), ""] : [];

  useEffect(() => {
    setMode("convert");
    if (result) applyRunText(preset?.examples[1] ?? result.nfa.alphabet.slice(0, 2).join("").repeat(2), result);
    // Only a new conversion resets the run panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    if (activeView !== "converter") {
      conversion.pause();
      runner.pause();
    }
  }, [activeView, conversion, runner]);

  useEffect(() => {
    if (mode === "run") conversion.pause();
    else runner.pause();
  }, [mode, conversion, runner]);

  const nfaDiagram = useMemo(() => diagramFromNFA(result?.nfa ?? nfa), [result, nfa]);
  const dfaDiagram = useMemo(() => (result ? diagramFromDFA(result.dfa, result.deadState) : null), [result]);
  const report = useMemo(() => (result && mode === "run" ? compareMachines(result.nfa, result.dfa) : null), [result, mode]);

  const animating = convMode !== "stopped";
  const state = useMemo(() => (result && index >= 0 ? conversionStateAt(result, index) : null), [result, index]);
  const event = state?.event ?? null;
  const beatMs = Math.round(260 * SPEED_FACTOR[convSpeed]);
  const popDelay = ((EVENT_MS.link * SPEED_FACTOR[convSpeed]) / 1000) * MERGE_SHARE * 0.85;

  const nfaRunView = useMemo(() => deriveView(runSnapshot, 0), [runSnapshot]);
  const dfaRunView = useMemo(() => deriveView(runSnapshot, 1), [runSnapshot]);

  const running = mode === "run";
  const nfaGraphView = running ? toGraphView(nfaRunView) : nfaConversionView(result, state, animating);
  const dfaGraphView = running ? toGraphView(dfaRunView) : dfaConversionView(result, state, animating, popDelay);
  const runBeat = Math.round(260 * SPEED_FACTOR[runSnapshot.speed]);

  const lastIndex = (result?.events.length ?? 1) - 1;
  const atEnd = index === lastIndex;
  const isAuto = convMode === "playing" || convMode === "stepping";

  const mergeMembers = event?.kind === "link" && event.isNew && animating ? event.union : [];
  const mergeTarget = event?.kind === "link" && event.isNew ? event.target : null;
  const focus = event && "state" in event ? { state: event.state, symbol: "symbol" in event ? event.symbol : undefined } : null;

  return (
    <section aria-labelledby="converter-title" className="pb-8">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-end justify-between gap-x-8 gap-y-2 px-5 pt-3 lg:px-10">
        <div>
          <h2 id="converter-title" className="text-[1.75rem] leading-tight font-bold">
            NFA to DFA Converter
          </h2>
          {!result && (
            <p className="max-w-[62ch] text-[0.9375rem] text-muted">
              Subset construction turns a machine that can be in many states into one that is always in exactly one, by making each set
              of NFA states a single DFA state.
            </p>
          )}
        </div>
        {result && (
          <div className="flex items-center gap-3">
            {completed && (
              <div className="flex rounded-[3px] border border-line" role="tablist" aria-label="Converter mode">
                {(
                  [
                    ["convert", "Conversion"],
                    ["run", "Run both machines"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mode === id}
                    data-mode={id}
                    onClick={() => setMode(id)}
                    className={`h-10 px-3.5 text-[0.9375rem] transition-colors ${mode === id ? "bg-fg/15 font-semibold" : "text-muted hover:text-fg"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              data-edit
              onClick={edit}
              className="inline-flex h-10 items-center gap-2 rounded-[3px] border border-line px-3.5 text-[0.9375rem] transition-colors hover:border-muted"
            >
              <Pencil size={15} aria-hidden />
              Edit NFA
            </button>
          </div>
        )}
      </div>

      <div ref={stage} className="relative mx-auto mt-2 grid max-w-[100rem] gap-y-2 px-5 lg:grid-cols-2 lg:px-10">
        <div className="min-w-0 lg:border-r lg:border-line lg:pr-8">
          <PanelTitle note={result ? "Can be in several states at once" : "Updates as you edit"}>Original NFA</PanelTitle>
          <div data-diagram="nfa">
            <AutomataGraph
              model={nfaDiagram}
              view={nfaGraphView}
              subscribeFrames={running ? nfaFrames : conversion.subscribeNFA}
              beatMs={running ? runBeat : beatMs}
              compact={compact}
              title="The original NFA"
              className={`mx-auto block w-full ${result ? "lg:max-h-[calc(100vh-32rem)]" : "lg:max-h-[62vh]"}`}
            />
          </div>
        </div>

        <div className={`min-w-0 lg:pl-8 ${result ? "" : "min-h-[28rem]"}`}>
          <AnimatePresence mode="wait" initial={false}>
            {result && dfaDiagram ? (
              <motion.div key="dfa" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <PanelTitle
                  note={
                    state
                      ? `${state.discovered.length} state${state.discovered.length === 1 ? "" : "s"} ${atEnd ? "in total" : "so far"}`
                      : undefined
                  }
                >
                  Generated DFA
                </PanelTitle>
                <div data-diagram="dfa">
                  <AutomataGraph
                    model={dfaDiagram}
                    view={dfaGraphView}
                    subscribeFrames={running ? dfaFrames : conversion.subscribeDFA}
                    beatMs={running ? runBeat : beatMs}
                    compact={compact}
                    title="The generated DFA, whose states are sets of NFA states"
                    className="mx-auto block w-full lg:max-h-[calc(100vh-32rem)]"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="editor" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full">
                <EditorSlot />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {result && mode === "convert" && (
          <MergeOverlay stage={stage} members={mergeMembers} target={mergeTarget} eventKey={index} subscribe={conversion.subscribeMerge} />
        )}
      </div>

      {result && state && mode === "convert" && (
        <div className="mt-2 border-t border-line bg-midnight/30">
          <div className="mx-auto max-w-[100rem] px-5 py-2.5 lg:px-10">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <SimulationControls
                name="convert"
                running={isAuto}
                finished={atEnd && !animating}
                disabled={false}
                canStepBack={convMode !== "playing" && index > 0}
                canStepForward={convMode !== "playing" && !(atEnd && !animating)}
                speed={convSpeed}
                onPlayPause={() => (isAuto ? conversion.pause() : conversion.play())}
                onPrevious={() => conversion.previous()}
                onNext={() => conversion.next()}
                onRestart={() => conversion.restart()}
                onSpeed={(next) => conversion.setSpeed(next)}
              />
              <span className="text-[0.9375rem] text-muted tabular-nums" data-step-count>
                Step {index + 1} of {result.events.length}
              </span>
              <div className="flex min-w-[12rem] flex-1">
                <Scrubber events={result.events} index={index} onSeek={(i) => conversion.seek(i)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {result && state && mode === "convert" && (
        <div className="mx-auto grid max-w-[100rem] gap-x-14 gap-y-4 px-5 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:px-10">
          <div className="min-w-0">
            <ConversionWorksheet state={state} nfa={result.nfa} eventIndex={index} />
            {atEnd && !animating && (
              <button
                type="button"
                data-go-run
                onClick={() => setMode("run")}
                className="mt-3 h-11 rounded-[3px] bg-amber px-5 font-semibold text-midnight transition-colors hover:bg-[#ffc78d]"
              >
                Run both machines on a string
              </button>
            )}
          </div>
          <div className="min-w-0">
            <GeneratedTable result={result} states={state.discovered} table={state.table} showAccepting={state.acceptingKnown} focus={focus} />
            <div className="mt-3 grid gap-0.5 text-[0.9375rem]" data-worklist>
              <WorklistRow label="Working on" items={state.processing ? [state.processing] : []} emphasis />
              <WorklistRow label="Still to do" items={state.worklist} />
            </div>
          </div>
        </div>
      )}

      {result && mode === "run" && (
        <div className="mt-2 border-t border-line bg-midnight/30">
          <div className="mx-auto max-w-[100rem] px-5 py-4 lg:px-10">
            <MachineRun
              result={result}
              player={runner}
              snapshot={runSnapshot}
              nfaView={nfaRunView}
              dfaView={dfaRunView}
              text={runText}
              error={runError}
              examples={examples}
              report={report}
              onText={(text) => applyRunText(text, result)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function EditorSlot() {
  return (
    <div className="flex h-full flex-col">
      <PanelTitle>Define your NFA</PanelTitle>
      <div className="mt-1 min-h-0 flex-1">
        <NFAEditor />
      </div>
    </div>
  );
}
