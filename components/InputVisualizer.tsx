"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { CellStatus } from "@/lib/simulation-view";

export type TapeCell = CellStatus | "invalid";

const CELL_CLASS: Record<TapeCell, string> = {
  consumed: "bg-transparent text-muted/45",
  current: "bg-amber text-midnight",
  remaining: "bg-surface text-fg",
  invalid: "bg-no/20 text-no",
};

interface TapeStripProps {
  symbols: string[];
  statusAt: (index: number) => TapeCell;
  head: number | null;
  beatMs?: number;
  /** Width of one tape cell, as a CSS length. */
  cell?: string;
  /** Tracks the head when the tape is wider than its container. */
  scrollable?: boolean;
  verdictTone?: "ok" | "no" | null;
}

export function TapeStrip({
  symbols,
  statusAt,
  head,
  beatMs = 260,
  cell = "clamp(2.5rem, 5vw, 3.25rem)",
  scrollable = false,
  verdictTone = null,
}: TapeStripProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scroller.current;
    if (!element || head === null) return;
    const cellWidth = element.scrollWidth / Math.max(symbols.length, 1);
    element.scrollTo({ left: head * cellWidth - element.clientWidth / 2 + cellWidth / 2, behavior: "smooth" });
  }, [head, symbols.length]);

  const empty = symbols.length === 0;
  const edge = verdictTone === "ok" ? "border-ok" : verdictTone === "no" ? "border-no" : "border-line";

  return (
    <div
      ref={scroller}
      className={scrollable ? "overflow-x-auto pb-1" : undefined}
      style={{ "--cell": cell, "--beat": `${beatMs}ms` } as CSSProperties}
    >
      <div className="relative w-max pt-4">
        {head !== null && (
          <svg
            aria-hidden
            width="14"
            height="10"
            viewBox="0 0 14 10"
            className="tape-head absolute top-1 left-0"
            data-tape-head={head}
            style={{ transform: `translateX(calc(var(--cell) * ${head} + var(--cell) / 2 - 7px))` }}
          >
            <path d="M0 0H14L7 10Z" fill="#FFB46B" />
          </svg>
        )}
        <ol className={`tape-cell flex border-y ${edge}`} aria-label="Input tape">
          {empty ? (
            <li
              className="math flex items-center justify-center text-[1.4rem] text-muted italic"
              style={{ width: "var(--cell)", height: "var(--cell)" }}
            >
              ε
            </li>
          ) : (
            symbols.map((symbol, index) => {
              const status = statusAt(index);
              return (
                <li
                  key={index}
                  data-cell={status}
                  className={`tape-cell math flex items-center justify-center border-r text-[1.5rem] first:border-l ${edge} ${CELL_CLASS[status]}`}
                  style={{ width: "var(--cell)", height: "var(--cell)" }}
                >
                  {symbol}
                </li>
              );
            })
          )}
        </ol>
      </div>
    </div>
  );
}

interface InputVisualizerProps {
  symbols: string[];
  statusAt: (index: number) => TapeCell;
  head: number | null;
  consumed: number;
  remaining: number;
  currentState: ReactNode;
  stateLabel?: string;
  beatMs: number;
  verdictTone: "ok" | "no" | null;
}

export function InputVisualizer({
  symbols,
  statusAt,
  head,
  consumed,
  remaining,
  currentState,
  stateLabel = "State",
  beatMs,
  verdictTone,
}: InputVisualizerProps) {
  const total = symbols.length;
  const position = total === 0 ? 0 : Math.min(consumed + 1, total);
  const percent = total === 0 ? 0 : Math.round((consumed / total) * 100);

  const stats: [string, ReactNode][] = [
    [stateLabel, currentState],
    ["Position", total === 0 ? "None" : `${position} of ${total}`],
    ["Consumed", consumed],
    ["Remaining", remaining],
  ];

  return (
    <div>
      <TapeStrip
        symbols={symbols}
        statusAt={statusAt}
        head={head}
        beatMs={beatMs}
        scrollable
        verdictTone={verdictTone}
      />
      <div
        className="mt-2 h-[3px] bg-line"
        role="progressbar"
        aria-label="Input consumed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full bg-amber"
          style={{ width: `${percent}%`, transitionProperty: "width", transitionDuration: `${beatMs}ms` }}
        />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-[0.9375rem]">
        {stats.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium tabular-nums" data-stat={label.toLowerCase()}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
