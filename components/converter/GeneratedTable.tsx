import type { StateId } from "@/lib/dfa-types";
import type { ConversionResult } from "@/lib/subset-construction";
import { StateName } from "../Math";

interface GeneratedTableProps {
  result: ConversionResult;
  /** Rows to show, in discovery order. */
  states: readonly StateId[];
  table: Record<StateId, Record<string, StateId>>;
  showAccepting: boolean;
  /** The row and column being worked on, if any. */
  focus?: { state: StateId; symbol?: string } | null;
}

export function GeneratedTable({ result, states, table, showAccepting, focus }: GeneratedTableProps) {
  const { dfa, deadState } = result;
  return (
    <table className="w-full border-collapse text-[1.0625rem]" data-generated-table>
      <thead>
        <tr className="border-b border-line">
          <th className="py-1.5 pr-3 text-left text-[0.9375rem] font-normal text-muted">DFA state</th>
          {dfa.alphabet.map((symbol) => (
            <th
              key={symbol}
              className={`py-1.5 pr-3 text-left text-[0.9375rem] font-normal ${focus?.symbol === symbol ? "font-semibold text-amber" : "text-muted"}`}
            >
              Input <span className="math">{symbol}</span>
            </th>
          ))}
          <th className="py-1.5 text-left text-[0.9375rem] font-normal text-muted">Role</th>
        </tr>
      </thead>
      <tbody>
        {states.map((state) => {
          const roles = [
            state === dfa.initial ? "initial" : null,
            showAccepting && dfa.accepting.includes(state) ? "accepting" : null,
            state === deadState ? "dead" : null,
          ].filter(Boolean);
          return (
            <tr key={state} data-generated-row={state} className={`table-tint border-b border-line ${focus?.state === state ? "bg-blue/20" : ""}`}>
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                <span className="inline-block w-5 text-muted" aria-hidden>
                  {state === dfa.initial ? "→" : ""}
                </span>
                <StateName id={state} />
              </th>
              {dfa.alphabet.map((symbol) => {
                const target = table[state]?.[symbol];
                const focused = focus?.state === state && focus.symbol === symbol;
                return (
                  <td key={symbol} data-generated-cell={`${state}|${symbol}`} className={`table-tint py-1 pr-3 ${focused ? "bg-amber/25" : ""}`}>
                    {target ? <StateName id={target} /> : <span className="text-muted/50">?</span>}
                  </td>
                );
              })}
              <td className="py-1 text-[0.9375rem] text-muted">{roles.join(", ")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
