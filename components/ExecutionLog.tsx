"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { TraceStep } from "@/lib/machine-trace";
import type { Phase } from "@/lib/playback";
import { Equation, StateName } from "./Math";

interface ExecutionLogProps {
  steps: readonly TraceStep[];
  count: number;
  /** Index of the highlighted row, or -1. */
  focusIndex: number;
  /** Index of the row still being executed, or -1. */
  runningIndex: number;
  /** Rows at or beyond this index have been rewound past. */
  cursor: number;
  phase: Phase;
  onSelect: (index: number) => void;
}

const cellClass = "px-2 py-1.5 text-left font-normal";

export function ExecutionLog({ steps, count, focusIndex, runningIndex, cursor, phase, onSelect }: ExecutionLogProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scroller.current;
    const row = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!container || !row) return;
    const top = row.offsetTop - container.clientHeight / 2 + row.offsetHeight / 2;
    container.scrollTo({ top, behavior: "smooth" });
  }, [focusIndex, count]);

  const showTransition = phase !== "read";
  const showNext = phase === "arrive" || phase === "consume";

  return (
    <section aria-label="Execution log" className="flex min-h-0 flex-1 flex-col">
      <h3 className="px-4 pt-4 pb-1 text-[1.0625rem] font-semibold">Execution log</h3>
      <div ref={scroller} className="relative max-h-64 min-h-[8rem] flex-1 overflow-y-auto lg:max-h-none lg:basis-0">
        <table className="w-full border-collapse text-[0.9375rem] tabular-nums">
          <thead className="sticky top-0 z-10 bg-[#141853] text-muted">
            <tr>
              <th className={`${cellClass} pl-4`}>Step</th>
              <th className={cellClass}>State</th>
              <th className={cellClass}>Input</th>
              <th className={cellClass}>Transition</th>
              <th className={cellClass}>Next</th>
            </tr>
          </thead>
          <tbody>
            {steps.slice(0, count).map((step) => {
              const isFocus = step.index === focusIndex;
              const isRunning = step.index === runningIndex;
              const isAhead = step.index >= cursor && !isRunning;
              return (
                <motion.tr
                  key={step.index}
                  data-log-row={step.index + 1}
                  aria-current={isFocus ? "step" : undefined}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: isAhead ? 0.45 : 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  onClick={() => onSelect(step.index)}
                  className={`table-tint cursor-pointer ${isFocus ? "bg-blue/20" : "hover:bg-fg/5"}`}
                >
                  <td className="p-0">
                    <button type="button" className="w-full py-1.5 pr-2 pl-4 text-left" aria-label={`Go to step ${step.index + 1}`}>
                      {step.index + 1}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <StateName id={step.active[0]} />
                  </td>
                  <td className="math px-2 py-1.5">{step.symbol}</td>
                  <td className="px-2 py-1.5">
                    {(!isRunning || showTransition) && <Equation from={step.active[0]} symbol={step.symbol} />}
                  </td>
                  <td className="px-2 py-1.5">{(!isRunning || showNext) && <StateName id={step.nextActive[0]} />}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {count === 0 && <p className="px-4 py-3 text-[0.9375rem] text-muted">Each transition appears here as the machine runs it.</p>}
      </div>
    </section>
  );
}
