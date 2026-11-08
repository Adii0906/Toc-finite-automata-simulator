"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import type { EquivalenceReport } from "@/lib/equivalence";
import type { MachineTrace, TraceStep } from "@/lib/machine-trace";
import type { PlaybackSnapshot, SimulationPlayer } from "@/lib/playback";
import { cellStatus, type SimulationView } from "@/lib/simulation-view";
import type { ConversionResult } from "@/lib/subset-construction";
import { TapeStrip, type TapeCell } from "../InputVisualizer";
import { SetOf, StateName } from "../Math";
import { SimulationControls } from "../SimulationControls";

function branchStory(step: TraceStep): ReactNode {
  const bySource = step.active.map((source) => ({
    source,
    targets: step.moves.filter((move) => move.from === source).map((move) => move.to),
  }));
  if (step.active.length === 0) return <>No NFA states are active, so nothing can happen on this symbol.</>;
  return (
    <>
      {bySource.map(({ source, targets }, index) => (
        <span key={source}>
          {index > 0 && " "}
          <StateName id={source} />{" "}
          {targets.length === 0 ? (
            "has no move, so that branch ends."
          ) : targets.length === 1 ? (
            <>
              moves to <StateName id={targets[0]} />.
            </>
          ) : (
            <>
              branches to <SetOf members={targets} />.
            </>
          )}
        </span>
      ))}
    </>
  );
}

function VerdictWord({ accepted, label }: { accepted: boolean; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-muted">{label}</span>
      <span className={`inline-flex items-center gap-1 font-display font-bold ${accepted ? "text-ok" : "text-no"}`} data-machine-verdict={label}>
        {accepted ? <Check size={18} strokeWidth={3} aria-hidden /> : <X size={18} strokeWidth={3} aria-hidden />}
        {accepted ? "ACCEPTED" : "REJECTED"}
      </span>
    </span>
  );
}

interface MachineRunProps {
  result: ConversionResult;
  player: SimulationPlayer;
  snapshot: PlaybackSnapshot;
  nfaView: SimulationView;
  dfaView: SimulationView;
  text: string;
  error: string | null;
  examples: readonly string[];
  report: EquivalenceReport | null;
  onText: (text: string) => void;
}

export function MachineRun({ result, player, snapshot, nfaView, dfaView, text, error, examples, report, onText }: MachineRunProps) {
  const { traces, phase, mode, cursor, speed, evaluated } = snapshot;
  const [nfaTrace, dfaTrace] = traces as [MachineTrace, MachineTrace];
  const running = mode === "playing" || mode === "stepping";
  const invalid = error !== null;
  const symbols = invalid ? Array.from(text) : Array.from(nfaTrace.input);
  const statusAt = (index: number): TapeCell => (invalid ? "remaining" : cellStatus(index, nfaView, phase));
  const dfaSubset = result.subsets[dfaView.activeStates[0]] ?? [];
  const same = nfaView.activeStates.join() === dfaSubset.join();
  const step = nfaView.focusStep;

  return (
    <div className="grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" data-machine-run>
      <div className="min-w-0">
        <div className="flex gap-2">
          <label htmlFor="run-input" className="sr-only">
            Input string for both machines
          </label>
          <input
            id="run-input"
            value={text}
            onChange={(event) => onText(event.target.value)}
            placeholder="Same string for both machines"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={invalid}
            className={`math h-11 w-full min-w-0 rounded-[3px] border bg-midnight/60 px-3 text-[1.3125rem] tracking-[0.12em] placeholder:font-sans placeholder:text-[0.9375rem] placeholder:tracking-normal placeholder:text-muted/70 ${
              invalid ? "border-no" : "border-line"
            }`}
          />
          <div className="flex shrink-0 gap-1">
            {examples.map((example) => (
              <button
                key={example || "empty"}
                type="button"
                data-run-example={example}
                onClick={() => onText(example)}
                className={`math h-11 rounded-[3px] border px-2 text-[1rem] transition-colors ${
                  example === text ? "border-amber text-fg" : "border-line text-muted hover:text-fg"
                }`}
              >
                {example || "ε"}
              </button>
            ))}
          </div>
        </div>
        <p role={invalid ? "alert" : undefined} className="min-h-[1.4rem] text-[0.9375rem] text-no">
          {error}
        </p>

        <TapeStrip
          symbols={symbols}
          statusAt={statusAt}
          head={!invalid && !nfaView.finished && symbols.length > 0 ? nfaView.headIndex : null}
          scrollable
          verdictTone={nfaView.verdict === "accepted" ? "ok" : nfaView.verdict === "rejected" ? "no" : null}
        />

        <div className="mt-3">
          <SimulationControls
            name="run"
            running={running}
            finished={nfaView.finished}
            disabled={invalid}
            canStepBack={mode !== "playing" && (phase !== "ready" || cursor > 0 || evaluated)}
            canStepForward={mode !== "playing" && !nfaView.finished}
            speed={speed}
            onPlayPause={() => (running ? player.pause() : player.play())}
            onPrevious={() => player.previous()}
            onNext={() => player.next()}
            onRestart={() => player.restart()}
            onSpeed={(next) => player.setSpeed(next)}
          />
        </div>
      </div>

      <div className="text-[1.0625rem]" aria-live="polite">
        {nfaView.finished ? (
          <div data-agreement>
            <div className="flex flex-wrap gap-x-8 text-[1.25rem]">
              <VerdictWord accepted={nfaTrace.accepted} label="NFA" />
              <VerdictWord accepted={dfaTrace.accepted} label="DFA" />
            </div>
            <p className="mt-1 font-semibold" data-agree={nfaTrace.accepted === dfaTrace.accepted}>
              {nfaTrace.accepted === dfaTrace.accepted ? "Both machines agree." : "The machines disagree."}
            </p>
            <p className="text-fg/85">
              The NFA ended with active set <SetOf members={nfaTrace.finalActive} />.{" "}
              {nfaTrace.accepted ? "At least one of those states is accepting." : "None of those states is accepting."}
            </p>
          </div>
        ) : (
          <div className="min-h-[4.5rem]">
            {step ? (
              <p>
                On <span className="math text-amber">{step.symbol}</span>: {branchStory(step)}
              </p>
            ) : (
              <p className="text-fg/85">Press Play. The NFA follows every possible move at once. The DFA follows exactly one arrow.</p>
            )}
          </div>
        )}

        <div className="mt-3 grid gap-0.5 border-t border-line pt-2">
          <div className="flex items-baseline gap-2">
            <span className="w-32 shrink-0 text-muted">NFA active set</span>
            <span data-nfa-set><SetOf members={nfaView.activeStates} /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="w-32 shrink-0 text-muted">DFA state</span>
            <span data-dfa-set><StateName id={dfaView.activeStates[0]} /></span>
          </div>
          <p className={same ? "text-cyan" : "text-no"} data-same-set={same}>
            {same ? "They are the same set at every step. That is why the two machines must agree." : "The sets differ."}
          </p>
        </div>

        {report && (
          <p className="mt-2 text-[0.9375rem] text-muted" data-equivalence>
            Also checked just now: all {report.checked.toLocaleString("en-US")} strings up to length {report.maxLength}.{" "}
            {report.disagreements.length === 0
              ? "The machines gave the same answer on every one."
              : `They disagreed on ${report.disagreements.length}.`}
          </p>
        )}
      </div>
    </div>
  );
}
