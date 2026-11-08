import type { CSSProperties } from "react";
import type { DFA } from "@/lib/dfa-types";
import type { TraceStep } from "@/lib/machine-trace";
import { StateName } from "./Math";

interface TransitionTableProps {
  dfa: DFA;
  step: TraceStep | null;
  /** False while the symbol is still being read, before δ has resolved. */
  resolved: boolean;
  beatMs: number;
}

export function TransitionTable({ dfa, step, resolved, beatMs }: TransitionTableProps) {
  const current = step?.active[0];
  return (
    <section aria-label="Transition table" className="px-4 pt-4 pb-4">
      <h3 className="text-[1.0625rem] font-semibold">Transition table</h3>
      <table
        className="mt-1 w-full border-collapse text-center text-[1.0625rem]"
        style={{ "--beat": `${beatMs}ms` } as CSSProperties}
      >
        <thead>
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 text-left text-[0.9375rem] font-normal text-muted">State</th>
            {dfa.alphabet.map((symbol) => (
              <th
                key={symbol}
                data-table-col={symbol}
                data-active={step?.symbol === symbol || undefined}
                className={`table-tint py-1.5 text-[0.9375rem] font-normal ${
                  step?.symbol === symbol ? "font-semibold text-amber" : "text-muted"
                }`}
              >
                Input <span className="math">{symbol}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dfa.states.map((state) => {
            const rowActive = current === state;
            return (
              <tr
                key={state}
                data-table-row={state}
                data-active={rowActive || undefined}
                className={`table-tint ${rowActive ? "bg-blue/20" : ""}`}
              >
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  <span className="inline-block w-5 text-muted" aria-hidden>
                    {state === dfa.initial ? "→" : ""}
                  </span>
                  <StateName id={state} />
                  {dfa.accepting.includes(state) && (
                    <span className="math text-muted">
                      <span className="sr-only">, accepting</span>
                      <span aria-hidden> *</span>
                    </span>
                  )}
                </th>
                {dfa.alphabet.map((symbol) => {
                  const columnActive = step?.symbol === symbol;
                  const cellActive = resolved && rowActive && columnActive;
                  return (
                    <td
                      key={symbol}
                      data-table-cell={`${state}-${symbol}`}
                      data-active={cellActive || undefined}
                      className={`table-tint py-1 ${cellActive ? "text-midnight" : columnActive ? "bg-amber/10" : ""}`}
                      style={cellActive ? { backgroundColor: "#35E2F2" } : undefined}
                    >
                      <StateName id={dfa.transitions[state][symbol]} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
