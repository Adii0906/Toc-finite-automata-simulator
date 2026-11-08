"use client";

import { useState } from "react";
import { ENDS_IN_01 } from "@/lib/dfa-presets";
import { validateDFA } from "@/lib/dfa-engine";
import type { DFA } from "@/lib/dfa-types";

const MAX_STATES = 6;
const MAX_SYMBOLS = 4;

function nextStateId(states: readonly string[]) {
  let suffix = 0;
  while (states.includes(`q${suffix}`)) suffix += 1;
  return `q${suffix}`;
}

export function DFAEditor({ onApply }: { onApply: (dfa: DFA) => void }) {
  const [dfa, setDfa] = useState<DFA>(ENDS_IN_01);
  const [newSymbol, setNewSymbol] = useState("");
  const [symbolError, setSymbolError] = useState("");

  const addState = () => {
    if (dfa.states.length >= MAX_STATES) return;
    const state = nextStateId(dfa.states);
    const transitions = Object.fromEntries(
      dfa.states.map((current) => [current, { ...dfa.transitions[current] }]),
    );
    transitions[state] = Object.fromEntries(dfa.alphabet.map((symbol) => [symbol, dfa.initial]));
    setDfa({ ...dfa, states: [...dfa.states, state], transitions });
  };

  const removeState = (state: string) => {
    if (dfa.states.length <= 1) return;
    const states = dfa.states.filter((item) => item !== state);
    const fallback = states[0];
    const transitions = Object.fromEntries(
      states.map((current) => [
        current,
        Object.fromEntries(
          dfa.alphabet.map((symbol) => [
            symbol,
            dfa.transitions[current][symbol] === state ? fallback : dfa.transitions[current][symbol],
          ]),
        ),
      ]),
    );
    setDfa({
      ...dfa,
      states,
      transitions,
      initial: dfa.initial === state ? fallback : dfa.initial,
      accepting: dfa.accepting.filter((item) => item !== state),
    });
  };

  const addSymbol = () => {
    const symbol = Array.from(newSymbol);
    if (symbol.length !== 1 || /\s|,/.test(newSymbol)) {
      setSymbolError("Enter one non-space character.");
      return;
    }
    if (dfa.alphabet.includes(newSymbol)) {
      setSymbolError("That input symbol is already in the alphabet.");
      return;
    }
    if (dfa.alphabet.length >= MAX_SYMBOLS) {
      setSymbolError(`A DFA can have up to ${MAX_SYMBOLS} input symbols here.`);
      return;
    }

    const transitions = Object.fromEntries(
      dfa.states.map((state) => [
        state,
        { ...dfa.transitions[state], [newSymbol]: dfa.initial },
      ]),
    );
    setDfa({ ...dfa, alphabet: [...dfa.alphabet, newSymbol], transitions });
    setNewSymbol("");
    setSymbolError("");
  };

  const removeSymbol = (symbol: string) => {
    if (dfa.alphabet.length <= 1) return;
    const alphabet = dfa.alphabet.filter((item) => item !== symbol);
    const transitions = Object.fromEntries(
      dfa.states.map((state) => {
        const row = Object.fromEntries(
          alphabet.map((item) => [item, dfa.transitions[state][item]]),
        );
        return [state, row];
      }),
    );
    setDfa({ ...dfa, alphabet, transitions });
  };

  const setTransition = (state: string, symbol: string, target: string) => {
    setDfa({
      ...dfa,
      transitions: {
        ...dfa.transitions,
        [state]: { ...dfa.transitions[state], [symbol]: target },
      },
    });
  };

  const reset = () => {
    setDfa(ENDS_IN_01);
    setNewSymbol("");
    setSymbolError("");
    onApply(ENDS_IN_01);
  };

  const validation = validateDFA(dfa);

  return (
    <section aria-labelledby="dfa-builder-title" className="border-t border-line bg-[#141853]/90 px-5 py-5 lg:px-10">
      <div className="mx-auto max-w-[100rem]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 id="dfa-builder-title" className="text-[1.25rem] font-bold">Build your DFA</h3>
            <p className="text-[0.9375rem] text-muted">Choose the machine’s states, inputs, and transitions.</p>
          </div>
          <button type="button" onClick={reset} className="text-[0.9375rem] text-blue underline underline-offset-4">
            Reset to example
          </button>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            <fieldset>
              <legend className="text-[0.9375rem] font-semibold">States</legend>
              <p className="text-[0.8125rem] text-muted">The arrow marks the start; check a state to make it accepting.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {dfa.states.map((state) => (
                  <li key={state} className="flex items-center gap-2 rounded-[3px] border border-line px-2 py-1">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="dfa-initial-state"
                        aria-label={`Set ${state} as the start state`}
                        checked={dfa.initial === state}
                        onChange={() => setDfa({ ...dfa, initial: state })}
                      />
                      <span className="math">{state}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[0.875rem]">
                      <input
                        type="checkbox"
                        aria-label={`${state} is accepting`}
                        checked={dfa.accepting.includes(state)}
                        onChange={(event) =>
                          setDfa({
                            ...dfa,
                            accepting: event.target.checked
                              ? [...dfa.accepting, state]
                              : dfa.accepting.filter((item) => item !== state),
                          })
                        }
                      />
                      Accept
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove state ${state}`}
                      disabled={dfa.states.length <= 1}
                      onClick={() => removeState(state)}
                      className="px-1 text-muted hover:text-no disabled:opacity-35"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={addState}
                disabled={dfa.states.length >= MAX_STATES}
                className="mt-2 rounded-[3px] border border-line px-3 py-1 text-[0.875rem] text-blue hover:bg-blue/10 disabled:opacity-35"
              >
                + Add state
              </button>
            </fieldset>

            <fieldset>
              <legend className="text-[0.9375rem] font-semibold">Input symbols</legend>
              <ul className="mt-2 flex flex-wrap gap-2">
                {dfa.alphabet.map((symbol) => (
                  <li key={symbol} className="flex items-center gap-2 rounded-[3px] border border-line px-2 py-1">
                    <span className="math">{symbol}</span>
                    <button
                      type="button"
                      aria-label={`Remove input symbol ${symbol}`}
                      disabled={dfa.alphabet.length <= 1}
                      onClick={() => removeSymbol(symbol)}
                      className="px-1 text-muted hover:text-no disabled:opacity-35"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="mt-2 flex max-w-sm gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addSymbol();
                }}
              >
                <label htmlFor="dfa-new-symbol" className="sr-only">New input symbol</label>
                <input
                  id="dfa-new-symbol"
                  value={newSymbol}
                  onChange={(event) => {
                    setNewSymbol(event.target.value);
                    setSymbolError("");
                  }}
                  maxLength={2}
                  placeholder="e.g. a"
                  className="h-9 w-24 rounded-[3px] border border-line bg-midnight/70 px-2"
                />
                <button
                  type="submit"
                  disabled={dfa.alphabet.length >= MAX_SYMBOLS}
                  className="rounded-[3px] border border-line px-3 text-[0.875rem] text-blue hover:bg-blue/10 disabled:opacity-35"
                >
                  Add symbol
                </button>
              </form>
              <p role={symbolError ? "alert" : undefined} className="min-h-5 text-[0.8125rem] text-no">
                {symbolError}
              </p>
            </fieldset>
          </div>

          <div className="min-w-0">
            <h4 className="text-[0.9375rem] font-semibold">Transitions</h4>
            <p className="text-[0.8125rem] text-muted">For every state and input, choose exactly one next state.</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[22rem] border-collapse text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-3 text-left font-normal text-muted">State</th>
                    {dfa.alphabet.map((symbol) => (
                      <th key={symbol} scope="col" className="px-2 py-2 text-left font-normal text-muted">
                        On <span className="math">{symbol}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dfa.states.map((state) => (
                    <tr key={state} className="border-b border-line/60">
                      <th scope="row" className="py-2 pr-3 text-left font-normal">
                        <span className="mr-2 text-muted">{dfa.initial === state ? "→" : ""}</span>
                        <span className="math">{state}{dfa.accepting.includes(state) ? " *" : ""}</span>
                      </th>
                      {dfa.alphabet.map((symbol) => (
                        <td key={symbol} className="px-2 py-1.5">
                          <select
                            aria-label={`Next state from ${state} on ${symbol}`}
                            value={dfa.transitions[state][symbol]}
                            onChange={(event) => setTransition(state, symbol, event.target.value)}
                            className="h-9 w-full min-w-20 rounded-[3px] border border-line bg-midnight px-2"
                          >
                            {dfa.states.map((target) => (
                              <option key={target} value={target}>{target}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {validation.length > 0 && (
          <p role="alert" className="mt-3 text-[0.875rem] text-no">{validation.join(" ")}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onApply(dfa)}
            disabled={validation.length > 0}
            className="h-10 rounded-[3px] bg-blue px-4 font-semibold text-midnight hover:bg-[#a9c6ff] disabled:pointer-events-none disabled:opacity-35"
          >
            Use this DFA
          </button>
          <span className="text-[0.8125rem] text-muted">
            Up to {MAX_STATES} states and {MAX_SYMBOLS} input symbols.
          </span>
        </div>
      </div>
    </section>
  );
}
