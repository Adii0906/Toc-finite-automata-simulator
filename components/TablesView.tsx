"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { ENDS_IN_01 } from "@/lib/dfa-presets";
import { StateName, SetOf } from "./Math";
import { useConverter } from "./converter/ConverterContext";
import { GeneratedTable } from "./converter/GeneratedTable";

function Heading({ title, note }: { title: string; note: ReactNode }) {
  return (
    <>
      <h3 className="text-[1.5rem] leading-tight font-bold">{title}</h3>
      <p className="mt-0.5 text-[0.9375rem] text-muted">{note}</p>
    </>
  );
}

const headClass = "py-1.5 pr-3 text-left text-[0.9375rem] font-normal text-muted";

export function TablesView() {
  const { nfa, snapshot } = useConverter();
  const { result, completed } = snapshot;
  const finished = Boolean(result && completed);
  const nfaShown = result?.nfa ?? nfa;
  const dfa = ENDS_IN_01;
  const accepted = useMemo(() => result?.dfa.accepting.length ?? 0, [result]);

  return (
    <section aria-labelledby="tables-title" className="on-paper">
      <div className="mx-auto max-w-[100rem] px-5 pt-5 pb-14 lg:px-10">
        <h2 id="tables-title" className="text-[clamp(2.5rem,5vw,4.25rem)] leading-none font-extrabold tracking-[-0.02em]">
          Transition Tables
        </h2>
        <p className="mt-2 max-w-[60ch]">
          Every machine on this site, written out. An arrow marks the initial state and a star marks an accepting state.
        </p>

        <div className="mt-8 grid gap-x-16 gap-y-10 lg:grid-cols-2">
          <div>
            <Heading title="DFA for strings ending in 01" note="The machine in the DFA Simulator." />
            <table className="mt-2 w-full border-collapse text-[1.0625rem]" data-table="dfa">
              <thead>
                <tr className="border-b-2 border-fg/70">
                  <th className={headClass}>State</th>
                  {dfa.alphabet.map((symbol) => (
                    <th key={symbol} className={headClass}>
                      Input <span className="math">{symbol}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dfa.states.map((state) => (
                  <tr key={state} className="border-b border-line">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      <span className="inline-block w-5 text-muted">{state === dfa.initial ? "→" : ""}</span>
                      <StateName id={state} />
                      {dfa.accepting.includes(state) ? " *" : ""}
                    </th>
                    {dfa.alphabet.map((symbol) => (
                      <td key={symbol} className="py-1.5 pr-3">
                        <StateName id={dfa.transitions[state][symbol]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <Heading title="Your NFA" note="From the converter. A cell can hold any number of states, including none." />
            <table className="mt-2 w-full border-collapse text-[1.0625rem]" data-table="nfa">
              <thead>
                <tr className="border-b-2 border-fg/70">
                  <th className={headClass}>State</th>
                  {nfaShown.alphabet.map((symbol) => (
                    <th key={symbol} className={headClass}>
                      Input <span className="math">{symbol}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nfaShown.states.map((state) => (
                  <tr key={state} className="border-b border-line">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      <span className="inline-block w-5 text-muted">{state === nfaShown.initial ? "→" : ""}</span>
                      <StateName id={state} />
                      {nfaShown.accepting.includes(state) ? " *" : ""}
                    </th>
                    {nfaShown.alphabet.map((symbol) => (
                      <td key={symbol} className="py-1.5 pr-3">
                        <SetOf members={nfaShown.transitions[state]?.[symbol] ?? []} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-2">
            <Heading
              title="Generated DFA"
              note={
                finished ? (
                  <>
                    {result!.dfa.states.length} states, {accepted} accepting
                    {result!.deadState ? ", 1 dead" : ", no dead state"}. Built by subset construction from the NFA above.
                  </>
                ) : (
                  "Appears here once a conversion has finished."
                )
              }
            />
            {finished ? (
              <div className="mt-2 max-w-[60rem]">
                <GeneratedTable result={result!} states={result!.dfa.states} table={result!.dfa.transitions as Record<string, Record<string, string>>} showAccepting />
              </div>
            ) : (
              <a href="#converter" data-tables-go className="mt-3 inline-flex h-11 items-center rounded-[3px] bg-ink px-5 font-semibold text-paper">
                Go to the converter
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
